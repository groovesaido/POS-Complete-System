const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const SANDBOX_BASE = 'https://sandbox.safaricom.co.ke';
const PRODUCTION_BASE = 'https://api.safaricom.co.ke';

// ── OAuth token cache ──
// Keys are `${consumerKey}:${useSandbox}` — reuses tokens across calls
// until they're close to expiry.
const tokenCache = new Map();
const TOKEN_SAFETY_BUFFER_SEC = 60; // refresh 60s before actual expiry

/**
 * Generate a timestamp in YYYYMMDDHHmmss format
 */
function getTimestamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}${h}${min}${s}`;
}

/**
 * Get OAuth access token from Daraja API with caching.
 * Tokens are valid for 1 hour; cached tokens are reused until
 * TOKEN_SAFETY_BUFFER_SEC before expiry.
 */
async function getAccessToken(consumerKey, consumerSecret, useSandbox = true) {
  const cacheKey = `${consumerKey}:${useSandbox}`;
  const cached = tokenCache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const base = useSandbox ? SANDBOX_BASE : PRODUCTION_BASE;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const { data } = await axios.get(
    `${base}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 15000,
    }
  );

  // Cache with safety buffer so we refresh before the token actually expires
  const expiresAt = Date.now() + (data.expires_in - TOKEN_SAFETY_BUFFER_SEC) * 1000;
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt });

  return data.access_token;
}

/**
 * Initiate STK Push (Lipa na M-Pesa Online)
 */
async function stkPush({
  consumerKey,
  consumerSecret,
  passKey,
  businessShortCode,
  amount,
  phoneNumber,
  callbackUrl,
  accountReference,
  transactionDesc,
  transactionType = 'CustomerPayBillOnline',
  useSandbox = true,
}) {
  const base = useSandbox ? SANDBOX_BASE : PRODUCTION_BASE;
  const accessToken = await getAccessToken(consumerKey, consumerSecret, useSandbox);
  const timestamp = getTimestamp();
  const password = Buffer.from(
    `${businessShortCode}${passKey}${timestamp}`
  ).toString('base64');

  // Normalize phone number: remove leading 0 or +254, ensure 254 format
  const normalizedPhone = phoneNumber.replace(/^\+?254/, '').replace(/^0?/, '');
  const partyA = `254${normalizedPhone}`;
  const partyB = businessShortCode;

  const payload = {
    BusinessShortCode: businessShortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: transactionType,
    Amount: Math.round(amount),
    PartyA: partyA,
    PartyB: partyB,
    PhoneNumber: partyA,
    CallBackURL: callbackUrl,
    AccountReference: accountReference || 'POS-Sale',
    TransactionDesc: transactionDesc || 'Payment for goods',
  };

  const { data } = await axios.post(
    `${base}/mpesa/stkpush/v1/processrequest`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return data;
}

/**
 * Query STK Push status
 */
async function stkQuery({
  consumerKey,
  consumerSecret,
  passKey,
  businessShortCode,
  checkoutRequestId,
  useSandbox = true,
}) {
  const base = useSandbox ? SANDBOX_BASE : PRODUCTION_BASE;
  const accessToken = await getAccessToken(consumerKey, consumerSecret, useSandbox);
  const timestamp = getTimestamp();
  const password = Buffer.from(
    `${businessShortCode}${passKey}${timestamp}`
  ).toString('base64');

  const payload = {
    BusinessShortCode: businessShortCode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  const { data } = await axios.post(
    `${base}/mpesa/stkpushquery/v1/query`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return data;
}

/**
 * Helper to get M-Pesa accounts from settings
 */
async function getMpesaAccounts(prisma) {
  const setting = await prisma.setting.findUnique({
    where: { key: 'mpesa_accounts' },
  });
  if (!setting) return [];
  try {
    return JSON.parse(setting.value);
  } catch {
    return [];
  }
}

/**
 * Helper to get the default (or first) M-Pesa account
 */
async function getDefaultMpesaAccount(prisma) {
  const accounts = await getMpesaAccounts(prisma);
  return accounts.find((a) => a.isDefault) || accounts[0] || null;
}

/**
 * Get or auto-generate the callback secret token used to verify that
 * incoming callbacks genuinely originated from our STK push requests.
 * The secret is persisted in the Setting table so it survives restarts.
 * Uses upsert for atomicity — no race conditions on first creation.
 */
async function getCallbackSecret(prisma) {
  const setting = await prisma.setting.upsert({
    where: { key: 'mpesa_callback_secret' },
    update: {},
    create: {
      key: 'mpesa_callback_secret',
      value: crypto.randomBytes(16).toString('hex'),
    },
  });
  return setting.value;
}

/**
 * Build the callback URL with the secret token appended as a query parameter.
 * If the user has set a custom callback URL in settings, it is used as-is
 * and the token is appended. Otherwise the URL is derived from the request.
 */
async function buildCallbackUrl(req, prisma) {
  const [callbackSetting, secret] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'mpesa_callback_url' } }),
    getCallbackSecret(prisma),
  ]);

  const base = callbackSetting?.value || `${req.protocol}://${req.get('host')}/api/mpesa/callback`;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${secret}`;
}

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────

/**
 * POST /api/mpesa/stkpush
 * Initiate an STK push to the customer's phone.
 * Body: { phoneNumber, amount, accountId? }
 */
router.post('/stkpush', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { phoneNumber, amount, accountId, accountReference } = req.body;

    if (!phoneNumber || !amount) {
      return res.status(400).json({ error: 'Phone number and amount are required.' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero.' });
    }

    // Build the callback URL with the secret token for origin validation
    const callbackUrl = await buildCallbackUrl(req, prisma);

    // Get selected account or default
    let account;
    if (accountId) {
      const accounts = await getMpesaAccounts(prisma);
      account = accounts.find((a) => a.id === accountId);
      if (!account) {
        return res.status(400).json({ error: 'M-Pesa account not found.' });
      }
    } else {
      account = await getDefaultMpesaAccount(prisma);
      if (!account) {
        return res.status(400).json({
          error: 'No M-Pesa account configured. Please add one in Settings.',
        });
      }
    }

    const useSandbox = account.useSandbox !== false; // default to sandbox

    const transactionType = account.type === 'till' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';

    const result = await stkPush({
      consumerKey: account.consumerKey,
      consumerSecret: account.consumerSecret,
      passKey: account.passKey,
      businessShortCode: account.number,
      amount,
      phoneNumber,
      callbackUrl,
      accountReference: accountReference || `POS-${Date.now().toString().slice(-6)}`,
      transactionDesc: `Payment of KSh ${amount}`,
      transactionType,
      useSandbox,
    });

    res.json({
      success: result.ResponseCode === '0',
      responseCode: result.ResponseCode,
      responseDescription: result.ResponseDescription,
      merchantRequestId: result.MerchantRequestID,
      checkoutRequestId: result.CheckoutRequestID,
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
        number: account.number,
      },
    });
  } catch (error) {
    console.error('M-Pesa STK push error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to initiate M-Pesa payment.',
      details: error.response?.data?.errorMessage || error.message,
    });
  }
});

/**
 * POST /api/mpesa/callback
 * Callback URL for M-Pesa STK push results.
 * Safaricom posts to this URL with the transaction result.
 */
router.post('/callback', async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const body = req.body;
    const { token } = req.query;

    // Validate the callback secret token to prevent forged callbacks
    const expectedSecret = await getCallbackSecret(prisma);
    if (!token || token !== expectedSecret) {
      console.warn('[M-Pesa] Callback rejected — invalid or missing secret token');
      return res.status(403).json({ error: 'Forbidden' });
    }

    console.log('M-Pesa callback received:', JSON.stringify(body, null, 2));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      return res.status(400).json({ error: 'Invalid callback payload.' });
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = stkCallback;

    // Find the transaction by checkout request ID
    const transaction = await prisma.transaction.findFirst({
      where: { mpesaCheckoutRequestId: CheckoutRequestID },
    });

    if (!transaction) {
      console.warn(`No transaction found for CheckoutRequestID: ${CheckoutRequestID}`);
      // Accept the callback anyway (Safaricom expects 200)
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (ResultCode === 0) {
      // Payment successful - extract metadata
      let mpesaReceiptCode = '';
      let amount = 0;
      let transactionDate = '';

      if (CallbackMetadata?.Item) {
        for (const item of CallbackMetadata.Item) {
          if (item.Name === 'MpesaReceiptNumber') mpesaReceiptCode = item.Value;
          if (item.Name === 'Amount') amount = item.Value;
          if (item.Name === 'TransactionDate') transactionDate = item.Value;
        }
      }

      // For split payments (mixed), the transaction is already 'completed'
      // Just update the M-Pesa receipt code and mpesa amount
      if (transaction.status === 'completed' && transaction.paymentMethod === 'mixed') {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            mpesaReceiptCode,
            mpesaAmount: amount || transaction.mpesaAmount,
          },
        });

        await prisma.activityLog.create({
          data: {
            userId: transaction.cashierId,
            action: 'MPESA_PAYMENT_RECEIVED',
            details: `M-Pesa payment received for split transaction #${transaction.receiptNumber}. Receipt: ${mpesaReceiptCode}, Amount: ${amount}`,
          },
        });

        console.log(`M-Pesa split payment confirmed: ${mpesaReceiptCode} for transaction #${transaction.receiptNumber}`);
      } else {
        // Full M-Pesa payment - mark as completed
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'completed',
            mpesaReceiptCode,
            amountPaid: amount || transaction.total,
            change: 0,
          },
        });

        // Log activity
        await prisma.activityLog.create({
          data: {
            userId: transaction.cashierId,
            action: 'MPESA_PAYMENT_RECEIVED',
            details: `M-Pesa payment received. Receipt: ${mpesaReceiptCode}, Amount: ${amount}`,
          },
        });

        console.log(`M-Pesa payment completed: ${mpesaReceiptCode} for transaction #${transaction.receiptNumber}`);
      }
    } else {
      // Payment failed or cancelled
      // NOTE: Inventory was never deducted for full pending M-Pesa transactions
      // (see transactions.js - only deducts for non-M-Pesa payments),
      // so we do NOT restore inventory here.
      // For split payments, inventory was already deducted since cash was collected.
      // The cashier should handle this manually (collect remaining cash).
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: transaction.paymentMethod === 'mixed' ? 'completed' : 'failed',
          notes: transaction.notes
            ? `${transaction.notes} | M-Pesa failed: ${ResultDesc} (Code: ${ResultCode})`
            : `M-Pesa failed: ${ResultDesc} (Code: ${ResultCode})`,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: transaction.cashierId,
          action: 'MPESA_PAYMENT_FAILED',
          details: `M-Pesa payment failed for transaction #${transaction.receiptNumber}. ${ResultDesc}`,
        },
      });

      console.log(`M-Pesa payment failed: ${ResultDesc} for transaction #${transaction.receiptNumber}`);
    }

    // Safaricom expects a response with ResultCode 0 to acknowledge receipt
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    // Always return 200 to Safaricom to acknowledge receipt
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  }
});

/**
 * POST /api/mpesa/query
 * Query the status of an STK push transaction
 * Body: { checkoutRequestId, accountId? }
 */
router.post('/query', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { checkoutRequestId, accountId } = req.body;

    if (!checkoutRequestId) {
      return res.status(400).json({ error: 'CheckoutRequestID is required.' });
    }

    // Get account
    let account;
    if (accountId) {
      const accounts = await getMpesaAccounts(prisma);
      account = accounts.find((a) => a.id === accountId);
      if (!account) {
        return res.status(400).json({ error: 'M-Pesa account not found.' });
      }
    } else {
      account = await getDefaultMpesaAccount(prisma);
      if (!account) {
        return res.status(400).json({ error: 'No M-Pesa account configured.' });
      }
    }

    const useSandbox = account.useSandbox !== false;

    const result = await stkQuery({
      consumerKey: account.consumerKey,
      consumerSecret: account.consumerSecret,
      passKey: account.passKey,
      businessShortCode: account.number,
      checkoutRequestId,
      useSandbox,
    });

    // Also check local transaction status
    const transaction = await prisma.transaction.findFirst({
      where: { mpesaCheckoutRequestId: checkoutRequestId },
    });

    res.json({
      responseCode: result.ResponseCode,
      responseDescription: result.ResponseDescription,
      resultCode: result.ResultCode,
      resultDesc: result.ResultDesc,
      transaction,
    });
  } catch (error) {
    console.error('M-Pesa query error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to query M-Pesa payment.',
      details: error.response?.data?.errorMessage || error.message,
    });
  }
});

/**
 * PATCH /api/mpesa/transaction/:transactionId/link
 * Link a pending transaction with an M-Pesa checkout request ID after STK push succeeds.
 * Body: { checkoutRequestId }
 */
router.patch('/transaction/:transactionId/link', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const transactionId = parseInt(req.params.transactionId);
    const { checkoutRequestId, phoneNumber } = req.body;

    if (!checkoutRequestId) {
      return res.status(400).json({ error: 'CheckoutRequestID is required.' });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    if (transaction.status !== 'pending_mpesa') {
      return res.status(400).json({ error: 'Transaction is not in pending M-Pesa status.' });
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        mpesaCheckoutRequestId: checkoutRequestId,
        mpesaPhone: phoneNumber || transaction.mpesaPhone,
      },
    });

    res.json({ success: true, message: 'Transaction linked to M-Pesa checkout request.' });
  } catch (error) {
    console.error('M-Pesa link error:', error);
    res.status(500).json({ error: 'Failed to link transaction.' });
  }
});

/**
 * POST /api/mpesa/transaction/:transactionId/retry
 * Retry the STK push for a pending M-Pesa transaction.
 * Body: { phoneNumber, amount }
 */
router.post('/transaction/:transactionId/retry', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const transactionId = parseInt(req.params.transactionId);
    const { phoneNumber, amount } = req.body;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { items: true },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    if (transaction.status !== 'pending_mpesa') {
      return res.status(400).json({ error: 'Transaction is not in pending M-Pesa status.' });
    }

    // Build the callback URL with the secret token for origin validation
    const callbackUrl = await buildCallbackUrl(req, prisma);

    // Get the default M-Pesa account
    const accounts = await getMpesaAccounts(prisma);
    const account = accounts.find((a) => a.isDefault) || accounts[0] || null;

    if (!account) {
      return res.status(400).json({ error: 'No M-Pesa account configured. Please add one in Settings.' });
    }

    const targetPhone = phoneNumber || transaction.mpesaPhone;
    if (!targetPhone) {
      return res.status(400).json({ error: 'No phone number provided and no phone on transaction.' });
    }

    const targetAmount = Math.round(amount || transaction.total);
    const useSandbox = account.useSandbox !== false;

    const transactionType = account.type === 'till' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';

    const result = await stkPush({
      consumerKey: account.consumerKey,
      consumerSecret: account.consumerSecret,
      passKey: account.passKey,
      businessShortCode: account.number,
      amount: targetAmount,
      phoneNumber: targetPhone,
      callbackUrl,
      accountReference: transaction.receiptNumber,
      transactionDesc: `Payment of KSh ${targetAmount}`,
      transactionType,
      useSandbox,
    });

    if (result.ResponseCode === '0') {
      // Update the checkout request ID
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          mpesaCheckoutRequestId: result.CheckoutRequestID,
          mpesaPhone: targetPhone,
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: req.user.id,
          action: 'RETRY_MPESA',
          details: `Retried M-Pesa payment for transaction #${transaction.receiptNumber}`,
        },
      });
    }

    res.json({
      success: result.ResponseCode === '0',
      responseCode: result.ResponseCode,
      responseDescription: result.ResponseDescription,
      merchantRequestId: result.MerchantRequestID,
      checkoutRequestId: result.CheckoutRequestID,
    });
  } catch (error) {
    console.error('M-Pesa retry error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to retry M-Pesa payment.',
      details: error.response?.data?.errorMessage || error.message,
    });
  }
});

/**
 * POST /api/mpesa/transaction/:transactionId/cancel
 * Cancel a pending M-Pesa transaction (e.g., when user cancels or polling times out).
 */
router.post('/transaction/:transactionId/cancel', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const transactionId = parseInt(req.params.transactionId);

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    if (transaction.status !== 'pending_mpesa') {
      return res.status(400).json({ error: 'Transaction is not in pending M-Pesa status.' });
    }

    // No inventory to restore — it was never deducted for pending M-Pesa
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'failed',
        notes: 'Cancelled by cashier',
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'CANCEL_MPESA',
        details: `Cancelled pending M-Pesa transaction #${transaction.receiptNumber}`,
      },
    });

    res.json({ success: true, message: 'Transaction cancelled.' });
  } catch (error) {
    console.error('M-Pesa cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel transaction.' });
  }
});

/**
 * GET /api/mpesa/status/:checkoutRequestId
 * Quick status check for frontend polling
 */
router.get('/status/:checkoutRequestId', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { checkoutRequestId } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: { mpesaCheckoutRequestId: checkoutRequestId },
      include: {
        items: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    if (!transaction) {
      return res.json({ status: 'unknown' });
    }

    res.json({
      status: transaction.status,
      transaction: transaction.status === 'completed' ? transaction : null,
      mpesaReceiptCode: transaction.mpesaReceiptCode,
    });
  } catch (error) {
    console.error('M-Pesa status error:', error);
    res.status(500).json({ error: 'Failed to check M-Pesa status.' });
  }
});

module.exports = router;
