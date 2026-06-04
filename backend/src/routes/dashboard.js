const express = require('express');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel
    const [
      todayTransactions,
      weekTransactions,
      monthTransactions,
      allTransactions,
      totalProducts,
      lowStockProducts,
      totalCashiers,
      totalCategories,
    ] = await Promise.all([
      prisma.transaction.findMany({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, status: 'completed' },
      }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: weekStart, lte: todayEnd }, status: 'completed' },
      }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: monthStart, lte: todayEnd }, status: 'completed' },
      }),
      prisma.transaction.findMany({
        where: { status: 'completed' },
      }),
      prisma.product.count(),
      prisma.product.findMany().then(products => 
        products.filter(p => p.quantity <= p.reorderLevel).length
      ),
      prisma.user.count({ where: { role: 'cashier', status: 'active' } }),
      prisma.category.count(),
    ]);

    // Calculate summary
    const todaySales = todayTransactions.reduce((sum, t) => sum + t.total, 0);
    const weekSales = weekTransactions.reduce((sum, t) => sum + t.total, 0);
    const monthSales = monthTransactions.reduce((sum, t) => sum + t.total, 0);
    const totalRevenue = allTransactions.reduce((sum, t) => sum + t.total, 0);
    const totalTransactions = allTransactions.length;

    // Recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: { status: 'completed' },
      include: { cashier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Top selling products
    const topProducts = await prisma.transactionItem.groupBy({
      by: ['productName'],
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    // Sales by category
    const categorySales = await prisma.category.findMany({
      include: {
        products: {
          include: {
            transactionItems: {
              where: { transaction: { status: 'completed' } },
            },
          },
        },
      },
    });

    const categorySalesData = categorySales.map(cat => {
      const totalRevenue = cat.products.reduce((sum, p) =>
        sum + p.transactionItems.reduce((s, i) => s + i.totalPrice, 0), 0);
      return { name: cat.name, revenue: totalRevenue };
    });

    // Daily sales for last 7 days
    const dailySales = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      const end = new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
      const dayTransactions = allTransactions.filter(
        t => t.createdAt >= date && t.createdAt <= end
      );
      dailySales.push({
        date: date.toISOString().split('T')[0],
        sales: dayTransactions.reduce((sum, t) => sum + t.total, 0),
        count: dayTransactions.length,
      });
    }

    // Payment method distribution
    const paymentMethods = {};
    allTransactions.forEach(t => {
      paymentMethods[t.paymentMethod] = (paymentMethods[t.paymentMethod] || 0) + t.total;
    });

    res.json({
      summary: {
        todaySales,
        weekSales,
        monthSales,
        totalRevenue,
        totalProducts,
        totalTransactions,
        totalCashiers,
        lowStockProducts,
        totalCategories,
      },
      dailySales,
      topProducts: topProducts.map(p => ({
        name: p.productName,
        quantity: p._sum.quantity,
        revenue: p._sum.totalPrice,
      })),
      categorySales: categorySalesData.filter(c => c.revenue > 0),
      paymentMethods: Object.entries(paymentMethods).map(([method, amount]) => ({
        method,
        amount,
      })),
      recentTransactions,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

module.exports = router;
