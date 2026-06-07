const express = require('express');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

/** Parse a YYYY-MM-DD string as local-time midnight (avoids UTC interpretation) */
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Parse a YYYY-MM-DD string as local-time end-of-day (23:59:59.999) */
const parseLocalEndDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
};

// Get daily sales report
router.get('/daily-sales', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { date } = req.query;
    const startDate = date ? parseLocalDate(date) : new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, status: 'completed' },
      include: { items: true, cashier: { select: { name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      totalSales: transactions.reduce((sum, t) => sum + t.total, 0),
      totalTransactions: transactions.length,
      totalItems: transactions.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0), 0),
      paymentMethods: {},
      cashiers: {},
    };

    transactions.forEach(t => {
      summary.paymentMethods[t.paymentMethod] = (summary.paymentMethods[t.paymentMethod] || 0) + t.total;
      const cashierName = t.cashier.name;
      summary.cashiers[cashierName] = (summary.cashiers[cashierName] || 0) + t.total;
    });

    res.json({ transactions, summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// Get weekly sales report
router.get('/weekly-sales', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { startDate, endDate } = req.query;

    const start = startDate ? parseLocalDate(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = endDate ? parseLocalEndDate(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: start, lte: end }, status: 'completed' },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const dailyData = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      dailyData[key] = { date: key, sales: 0, count: 0 };
    }

    transactions.forEach(t => {
      const key = t.createdAt.toISOString().split('T')[0];
      if (dailyData[key]) {
        dailyData[key].sales += t.total;
        dailyData[key].count += 1;
      }
    });

    res.json({
      totalSales: transactions.reduce((sum, t) => sum + t.total, 0),
      totalTransactions: transactions.length,
      dailyData: Object.values(dailyData),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// Get monthly sales report
router.get('/monthly-sales', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { year } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();

    const start = new Date(targetYear, 0, 1);
    const end = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: start, lte: end }, status: 'completed' },
    });

    const monthlyData = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthNames.forEach((m, i) => {
      monthlyData[i + 1] = { month: m, sales: 0, count: 0 };
    });

    transactions.forEach(t => {
      const month = t.createdAt.getMonth() + 1;
      monthlyData[month].sales += t.total;
      monthlyData[month].count += 1;
    });

    res.json({
      year: targetYear,
      totalSales: transactions.reduce((sum, t) => sum + t.total, 0),
      totalTransactions: transactions.length,
      monthlyData: Object.values(monthlyData),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// Get product sales report
router.get('/product-sales', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { startDate, endDate } = req.query;

    const where = { status: 'completed' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = parseLocalDate(startDate);
      if (endDate) where.createdAt.lte = parseLocalEndDate(endDate);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { items: true },
    });

    const productSales = {};
    transactions.forEach(t => {
      t.items.forEach(item => {
        if (!productSales[item.productName]) {
          productSales[item.productName] = { name: item.productName, quantity: 0, revenue: 0 };
        }
        productSales[item.productName].quantity += item.quantity;
        productSales[item.productName].revenue += item.totalPrice;
      });
    });

    res.json(Object.values(productSales).sort((a, b) => b.revenue - a.revenue));
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// Get inventory report
router.get('/inventory', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    const report = {
      totalProducts: products.length,
      lowStock: products.filter(p => p.quantity <= p.reorderLevel).length,
      outOfStock: products.filter(p => p.quantity === 0).length,
      totalValue: products.reduce((sum, p) => sum + p.costPrice * p.quantity, 0),
      totalRetailValue: products.reduce((sum, p) => sum + p.retailPrice * p.quantity, 0),
      products: products.map(p => ({
        ...p,
        stockStatus: p.quantity === 0 ? 'out_of_stock' : p.quantity <= p.reorderLevel ? 'low' : 'ok',
      })),
    };

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// Get cashier performance report
router.get('/cashier-performance', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { startDate, endDate } = req.query;

    const where = { status: 'completed' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = parseLocalDate(startDate);
      if (endDate) where.createdAt.lte = parseLocalEndDate(endDate);
    }

    const cashiers = await prisma.user.findMany({
      where: { role: 'cashier' },
      select: { id: true, name: true, username: true },
    });

    const transactions = await prisma.transaction.findMany({
      where,
      include: { items: true, cashier: { select: { id: true, name: true } } },
    });

    const performance = cashiers.map(cashier => {
      const cashierTransactions = transactions.filter(t => t.cashier.id === cashier.id);
      return {
        ...cashier,
        totalTransactions: cashierTransactions.length,
        totalSales: cashierTransactions.reduce((sum, t) => sum + t.total, 0),
        totalItems: cashierTransactions.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0), 0),
        averageTransactionValue: cashierTransactions.length > 0
          ? cashierTransactions.reduce((sum, t) => sum + t.total, 0) / cashierTransactions.length
          : 0,
      };
    });

    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// Get profit and loss report
router.get('/profit-loss', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { startDate, endDate } = req.query;

    const where = { status: 'completed' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = parseLocalDate(startDate);
      if (endDate) where.createdAt.lte = parseLocalEndDate(endDate);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { items: true },
    });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const t of transactions) {
      totalRevenue += t.total;
      totalTax += t.tax;
      totalDiscount += t.discount;

      for (const item of t.items) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (product) {
          totalCost += product.costPrice * item.quantity;
        }
      }
    }

    const grossProfit = totalRevenue - totalCost;
    const netProfit = totalRevenue - totalCost - totalDiscount;

    res.json({
      period: { startDate, endDate },
      totalRevenue,
      totalCost,
      grossProfit,
      grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      totalTax,
      totalDiscount,
      netProfit,
      netMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      totalTransactions: transactions.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

module.exports = router;
