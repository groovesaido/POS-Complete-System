const express = require('express');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Generate receipt number
function generateReceiptNumber() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RCP-${y}${m}${d}-${random}`;
}

function generateInvoiceNumber() {
  const date = new Date();
  const ts = date.getTime().toString().slice(-8);
  return `INV-${ts}`;
}

// Create transaction (checkout)
router.post('/', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { items, payments, discount = 0, tax = 0, notes, mpesaCheckoutRequestId, mpesaPhone, mpesaAmount, cashAmount } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    // Validate products and calculate totals
    let subtotal = 0;
    const transactionItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        return res.status(400).json({ error: `Product ID ${item.productId} not found.` });
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` });
      }

      // Use the appropriate price based on pricing type (per item)
      const unitPrice = item.pricingType === 'wholesale' ? product.wholesalePrice : product.retailPrice;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      transactionItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        pricingType: item.pricingType || 'retail',
      });
    }

    const taxAmount = parseFloat(tax) || 0;
    const discountAmount = parseFloat(discount) || 0;
    const total = subtotal + taxAmount - discountAmount;
    const amountPaid = parseFloat(payments?.[0]?.amount) || total;
    const change = Math.max(0, amountPaid - total);
    const paymentMethod = payments?.[0]?.method || 'cash';

    // Detect split M-Pesa + cash payment (mpesaAmount < total)
    const isMpesa = paymentMethod === 'mpesa';
    const parsedMpesaAmount = mpesaAmount ? parseFloat(mpesaAmount) : null;
    const parsedCashAmount = cashAmount ? parseFloat(cashAmount) : null;
    const isSplitPayment = isMpesa && parsedMpesaAmount !== null && parsedMpesaAmount < total;
    const forceCompleteMpesa = req.body.forceCompleteMpesa === true;

    // Determine initial status:
    // - Full M-Pesa (mpesaAmount = total): pending until callback
    // - Split payment (mpesaAmount < total): completed immediately (cash collected)
    // - Cash/card: completed immediately
    // - forceCompleteMpesa (standard plan): completed immediately (record M-Pesa, no STK push)
    const initialStatus = isSplitPayment || forceCompleteMpesa ? 'completed' : (isMpesa ? 'pending_mpesa' : 'completed');

    // Build notes with split payment info if applicable
    let transactionNotes = notes || '';
    if (isSplitPayment && parsedMpesaAmount !== null && parsedCashAmount !== null) {
      transactionNotes = `Split payment: M-Pesa KSh ${parsedMpesaAmount.toFixed(2)} + Cash KSh ${parsedCashAmount.toFixed(2)}${notes ? ' | ' + notes : ''}`;
    }

    // Create transaction with items
    const transaction = await prisma.transaction.create({
      data: {
        receiptNumber: generateReceiptNumber(),
        invoiceNumber: generateInvoiceNumber(),
        subtotal,
        tax: taxAmount,
        discount: discountAmount,
        total,
        paymentMethod: isSplitPayment ? 'mixed' : paymentMethod,
        amountPaid: isSplitPayment ? total : amountPaid,
        change: isSplitPayment ? 0 : change,
        status: initialStatus,
        mpesaCheckoutRequestId: isMpesa ? mpesaCheckoutRequestId : null,
        mpesaPhone: isMpesa ? mpesaPhone : null,
        mpesaAmount: parsedMpesaAmount || null,
        cashAmount: isSplitPayment ? parsedCashAmount : null,
        cashierId: req.user.id,
        notes: transactionNotes,
        items: {
          create: transactionItems,
        },
      },
      include: {
        items: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    // For cash/card and split payments - decrement inventory immediately
    // For full M-Pesa - decrement inventory only when callback confirms
    // For forceCompleteMpesa (standard plan) - decrement immediately (no STK push)
    const shouldDeductInventory = !isMpesa || isSplitPayment || forceCompleteMpesa;
    if (shouldDeductInventory) {
      for (const item of transactionItems) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        await prisma.product.update({
          where: { id: item.productId },
          data: { quantity: { decrement: item.quantity } },
        });

        await prisma.inventoryLog.create({
          data: {
            productId: item.productId,
            change: -item.quantity,
            quantity: product.quantity - item.quantity,
            type: 'sale',
            reference: transaction.receiptNumber,
          },
        });
      }
    }

    // Log activity
    const statusSuffix = isSplitPayment
      ? ' (M-Pesa + Cash split)'
      : isMpesa ? ' (Pending M-Pesa)' : '';
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_TRANSACTION',
        details: `Transaction ${transaction.receiptNumber} created - Total: ${total}${statusSuffix}`,
      },
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction.' });
  }
});

// Get all transactions
router.get('/', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { search, startDate, endDate, cashierId, status, page = 1, limit = 20 } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { receiptNumber: { contains: search } },
        { invoiceNumber: { contains: search } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
    }
    if (cashierId) {
      where.cashierId = parseInt(cashierId);
    }
    if (status) {
      where.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          items: true,
          cashier: { select: { id: true, name: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

// Get single transaction
router.get('/:id', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const transaction = await prisma.transaction.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        items: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transaction.' });
  }
});

// Update a pending transaction (edit items, notes, etc.)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id);
    const { items, notes, discount, tax, paymentMethod } = req.body;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
    if (transaction.status !== 'pending_mpesa') {
      return res.status(400).json({ error: 'Only pending M-Pesa transactions can be edited.' });
    }

    // If items are provided, recalculate and update
    let subtotal = transaction.subtotal;
    let taxAmount = tax !== undefined ? parseFloat(tax) : transaction.tax;
    let discountAmount = discount !== undefined ? parseFloat(discount) : transaction.discount;

    if (items && items.length > 0) {
      // Delete old items
      await prisma.transactionItem.deleteMany({ where: { transactionId: id } });

      // Recalculate with new items
      subtotal = 0;
      const transactionItems = [];

      for (const item of items) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          return res.status(400).json({ error: `Product ID ${item.productId} not found.` });
        }

        const unitPrice = item.pricingType === 'wholesale' ? product.wholesalePrice : product.retailPrice;
        const totalPrice = unitPrice * item.quantity;
        subtotal += totalPrice;

        transactionItems.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
          pricingType: item.pricingType || 'retail',
        });
      }

      // Recreate items
      await prisma.transactionItem.createMany({
        data: transactionItems.map(item => ({
          ...item,
          transactionId: id,
        })),
      });
    }

    const total = subtotal + taxAmount - discountAmount;

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        subtotal,
        tax: taxAmount,
        discount: discountAmount,
        total,
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        items: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_PENDING_TRANSACTION',
        details: `Updated pending transaction #${transaction.receiptNumber} - New total: ${subtotal}`,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction.' });
  }
});

// Manually complete a pending M-Pesa transaction (e.g., customer paid cash instead)
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id);
    const { amountPaid, paymentMethod, notes } = req.body;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
    if (transaction.status !== 'pending_mpesa') {
      return res.status(400).json({ error: 'Transaction is not pending M-Pesa.' });
    }

    const finalPaymentMethod = paymentMethod || transaction.paymentMethod;
    const finalAmountPaid = parseFloat(amountPaid) || transaction.total;
    const change = Math.max(0, finalAmountPaid - transaction.total);

    // Deduct inventory since M-Pesa didn't go through callback
    for (const item of transaction.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (product) {
        // Check stock is still available
        if (product.quantity < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${item.productName}. Available: ${product.quantity}, needed: ${item.quantity}`,
          });
        }
        await prisma.product.update({
          where: { id: item.productId },
          data: { quantity: { decrement: item.quantity } },
        });

        await prisma.inventoryLog.create({
          data: {
            productId: item.productId,
            change: -item.quantity,
            quantity: product.quantity - item.quantity,
            type: 'sale',
            reference: transaction.receiptNumber,
          },
        });
      }
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        status: 'completed',
        amountPaid: finalAmountPaid,
        change,
        paymentMethod: finalPaymentMethod,
        ...(notes ? { notes: transaction.notes ? `${transaction.notes}; ${notes}` : notes } : {}),
      },
      include: {
        items: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'COMPLETE_PENDING_TRANSACTION',
        details: `Manually completed pending transaction #${transaction.receiptNumber} as ${finalPaymentMethod}`,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Complete transaction error:', error);
    res.status(500).json({ error: 'Failed to complete transaction.' });
  }
});

// Refund transaction
router.post('/:id/refund', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id);

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
    if (transaction.status === 'refunded') return res.status(400).json({ error: 'Transaction already refunded.' });
    if (transaction.status !== 'completed') return res.status(400).json({ error: 'Only completed transactions can be refunded.' });

    // Restore inventory
    for (const item of transaction.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      await prisma.product.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
      });

      await prisma.inventoryLog.create({
        data: {
          productId: item.productId,
          change: item.quantity,
          quantity: product.quantity + item.quantity,
          type: 'refund',
          reference: transaction.receiptNumber,
        },
      });
    }

    await prisma.transaction.update({
      where: { id },
      data: { status: 'refunded' },
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'REFUND_TRANSACTION',
        details: `Refunded transaction ${transaction.receiptNumber}`,
      },
    });

    res.json({ message: 'Transaction refunded successfully.' });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ error: 'Failed to refund transaction.' });
  }
});

// ── Save Draft Transaction ──
// Saves the current cart as a draft with status 'draft'.
// Does NOT deduct inventory — that happens when the draft is completed.
router.post('/save-draft', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { items, discount = 0, tax = 0, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    // Validate products and calculate totals
    let subtotal = 0;
    const transactionItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        return res.status(400).json({ error: `Product ID ${item.productId} not found.` });
      }
      // Do NOT check stock here — just warn if insufficient
      const unitPrice = item.pricingType === 'wholesale' ? product.wholesalePrice : product.retailPrice;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      transactionItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        pricingType: item.pricingType || 'retail',
      });
    }

    const taxAmount = parseFloat(tax) || 0;
    const discountAmount = parseFloat(discount) || 0;
    const total = subtotal + taxAmount - discountAmount;

    // Create draft transaction (status = 'draft', no inventory deduction)
    const draft = await prisma.transaction.create({
      data: {
        receiptNumber: generateReceiptNumber(),
        invoiceNumber: generateInvoiceNumber(),
        subtotal,
        tax: taxAmount,
        discount: discountAmount,
        total,
        paymentMethod: 'draft',
        amountPaid: 0,
        change: 0,
        status: 'draft',
        cashierId: req.user.id,
        notes: notes || 'Draft transaction',
        items: {
          create: transactionItems,
        },
      },
      include: {
        items: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'SAVE_DRAFT',
        details: `Saved draft transaction ${draft.receiptNumber} - Total: ${total}`,
      },
    });

    console.log(`[Backend] Draft saved: ${draft.receiptNumber} by user ${req.user.id}`);
    res.status(201).json(draft);
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: 'Failed to save draft transaction.' });
  }
});

// Delete a draft transaction (cleanup after completing or cancelling a draft)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id);

    const transaction = await prisma.transaction.findUnique({ where: { id } });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });

    // Only allow deleting drafts or pending_mpesa
    if (transaction.status !== 'draft' && transaction.status !== 'pending_mpesa') {
      return res.status(400).json({ error: 'Only draft or pending transactions can be deleted.' });
    }

    // Cascade delete will remove items automatically
    await prisma.transaction.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_DRAFT',
        details: `Deleted draft transaction ${transaction.receiptNumber}`,
      },
    });

    res.json({ message: 'Draft deleted.' });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({ error: 'Failed to delete draft.' });
  }
});

module.exports = router;
