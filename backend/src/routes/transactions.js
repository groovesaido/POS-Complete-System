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
    const { items, payments, discount = 0, tax = 0, notes } = req.body;

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

      const unitPrice = product.sellingPrice;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      transactionItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      });
    }

    const taxAmount = parseFloat(tax) || 0;
    const discountAmount = parseFloat(discount) || 0;
    const total = subtotal + taxAmount - discountAmount;
    const amountPaid = parseFloat(payments?.[0]?.amount) || total;
    const change = Math.max(0, amountPaid - total);
    const paymentMethod = payments?.[0]?.method || 'cash';

    // Create transaction with items
    const transaction = await prisma.transaction.create({
      data: {
        receiptNumber: generateReceiptNumber(),
        invoiceNumber: generateInvoiceNumber(),
        subtotal,
        tax: taxAmount,
        discount: discountAmount,
        total,
        paymentMethod,
        amountPaid,
        change,
        status: 'completed',
        cashierId: req.user.id,
        notes,
        items: {
          create: transactionItems,
        },
      },
      include: {
        items: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    // Update inventory and create logs
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

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_TRANSACTION',
        details: `Transaction ${transaction.receiptNumber} created - Total: ${total}`,
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
    const { search, startDate, endDate, cashierId, page = 1, limit = 20 } = req.query;

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

module.exports = router;
