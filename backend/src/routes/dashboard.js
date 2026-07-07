const express = require('express');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

/** Format a Date as YYYY-MM-DD using local timezone (avoids .toISOString() UTC shift) */
const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

router.get('/stats', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Optional date filter for charts (category sales & top products)
    // Parse date strings as local timezone, not UTC
    let chartStartDate = null;
    if (req.query.chartStartDate) {
      const [y, m, d] = req.query.chartStartDate.split('-').map(Number);
      chartStartDate = new Date(y, m - 1, d);
    }
    let chartEndDate = null;
    if (req.query.chartEndDate) {
      const [y, m, d] = req.query.chartEndDate.split('-').map(Number);
      chartEndDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    }

    // Build a date filter for chart-related queries if provided
    const chartDateFilter = (chartStartDate || chartEndDate)
      ? {
          createdAt: {
            ...(chartStartDate ? { gte: chartStartDate } : {}),
            ...(chartEndDate ? { lte: chartEndDate } : {}),
          },
        }
      : null;

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

    // Build transaction filter for chart queries
    const chartTransactionFilter = chartDateFilter
      ? { ...chartDateFilter, status: 'completed' }
      : { status: 'completed' };

    // Top selling products (filtered by chart date if provided)
    // Group by both productId and productName so we can look up cost prices
    const topProductsRaw = await prisma.transactionItem.groupBy({
      by: ['productName', 'productId'],
      _sum: { quantity: true, totalPrice: true },
      where: chartDateFilter ? {
        transaction: chartTransactionFilter,
      } : undefined,
      orderBy: { _sum: { totalPrice: 'desc' } },
    });

    // Fetch cost prices for all products involved
    const productIds = topProductsRaw
      .filter(p => p.productId != null)
      .map(p => p.productId);
    const costPriceMap = {};
    if (productIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, costPrice: true },
      });
      for (const p of products) {
        costPriceMap[p.id] = p.costPrice;
      }
    }

    // Build enriched top products with profit data
    const topProducts = topProductsRaw.map((p, index) => {
      const quantity = p._sum.quantity || 0;
      const revenue = p._sum.totalPrice || 0;
      const unitCost = p.productId != null ? (costPriceMap[p.productId] || 0) : 0;
      const cost = unitCost * quantity;
      const profit = revenue - cost;
      return {
        rank: index + 1,
        productId: p.productId,
        name: p.productName,
        quantity,
        revenue,
        cost,
        profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        unitCost,
        unitPrice: quantity > 0 ? revenue / quantity : 0,
      };
    });

    // Sales by category (filtered by chart date if provided)
    const categorySales = await prisma.category.findMany({
      include: {
        products: {
          include: {
            transactionItems: {
              where: {
                transaction: chartTransactionFilter,
              },
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
        date: toLocalDateStr(date),
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: dayTransactions.reduce((sum, t) => sum + t.total, 0),
        count: dayTransactions.length,
      });
    }

    // Hourly sales for today (daily hours view)
    const hourlySales = [];
    for (let h = 0; h < 24; h++) {
      const hourTransactions = todayTransactions.filter(t => {
        const hour = new Date(t.createdAt).getHours();
        return hour === h;
      });
      hourlySales.push({
        hour: h,
        label: h === 0 ? '12AM' : h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`,
        sales: hourTransactions.reduce((sum, t) => sum + t.total, 0),
        count: hourTransactions.length,
      });
    }

    // Weekly sales by day of week (current week: Mon-Sun)
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(todayStart.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    const weekByDayTransactions = allTransactions.filter(
      t => t.createdAt >= monday && t.createdAt <= weekEnd
    );
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekdaySales = dayNames.map((name, index) => {
      const dayDate = new Date(monday.getTime() + index * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayDate.getTime() + 24 * 60 * 60 * 1000 - 1);
      const dayTxns = weekByDayTransactions.filter(
        t => t.createdAt >= dayDate && t.createdAt <= dayEnd
      );
      return {
        day: name,
        fullDate: toLocalDateStr(dayDate),
        sales: dayTxns.reduce((sum, t) => sum + t.total, 0),
        count: dayTxns.length,
      };
    });

    // Monthly sales by week (week 1-4)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthWeekSales = [];
    for (let w = 0; w < 4; w++) {
      const weekStartDate = new Date(monthStart.getTime() + w * 7 * 24 * 60 * 60 * 1000);
      const weekEndDate = new Date(Math.min(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1, monthEnd.getTime()));
      const weekTxns = monthTransactions.filter(
        t => t.createdAt >= weekStartDate && t.createdAt <= weekEndDate
      );
      monthWeekSales.push({
        week: `Week ${w + 1}`,
        sales: weekTxns.reduce((sum, t) => sum + t.total, 0),
        count: weekTxns.length,
      });
    }

    // Yearly sales by month
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    const yearTransactions = allTransactions.filter(
      t => t.createdAt >= yearStart && t.createdAt <= yearEnd
    );
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yearlySales = monthNames.map((name, index) => {
      const monthStartDate = new Date(now.getFullYear(), index, 1);
      const monthEndDate = new Date(now.getFullYear(), index + 1, 0, 23, 59, 59, 999);
      const monthTxns = yearTransactions.filter(
        t => t.createdAt >= monthStartDate && t.createdAt <= monthEndDate
      );
      return {
        month: name,
        sales: monthTxns.reduce((sum, t) => sum + t.total, 0),
        count: monthTxns.length,
      };
    });

    // Payment method distribution
    const paymentMethods = {};
    allTransactions.forEach(t => {
      paymentMethods[t.paymentMethod] = (paymentMethods[t.paymentMethod] || 0) + t.total;
    });

    // Peak hours - transactions grouped by hour for last 7 days
    const peakHours = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      const end = new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
      const dayTransactions = allTransactions.filter(
        t => t.createdAt >= date && t.createdAt <= end
      );
      const hours = {};
      for (let h = 0; h < 24; h++) {
        hours[h] = 0;
      }
      dayTransactions.forEach(t => {
        const hour = new Date(t.createdAt).getHours();
        hours[hour] = (hours[hour] || 0) + 1;
      });
      peakHours.push({
        date: toLocalDateStr(date),
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        hours,
      });
    }

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
      hourlySales,
      weekdaySales,
      monthWeekSales: monthWeekSales,
      yearlySales,
      topProducts,
      categorySales: categorySalesData.filter(c => c.revenue > 0),
      paymentMethods: Object.entries(paymentMethods).map(([method, amount]) => ({
        method,
        amount,
      })),
      recentTransactions,
      peakHours,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

module.exports = router;
