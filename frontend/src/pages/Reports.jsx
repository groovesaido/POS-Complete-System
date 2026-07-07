import { useState } from 'react';
import { reportsAPI, settingsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const formatCurrency = (v) => `KSh ${Number(v || 0).toLocaleString()}`;

// Helper: format a Date as YYYY-MM-DD using local timezone (avoids .toISOString() UTC shift)
const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper: add a header/footer to PDF pages
const addPdfHeader = (doc, storeInfo, title, pageWidth) => {
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header bar
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(storeInfo.store_name || 'POS System', pageWidth / 2, 14, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  if (storeInfo.store_address) {
    doc.text(storeInfo.store_address, pageWidth / 2, 21, { align: 'center' });
  }
  if (storeInfo.store_phone) {
    doc.text(`Tel: ${storeInfo.store_phone}${storeInfo.store_email ? ` | Email: ${storeInfo.store_email}` : ''}`, pageWidth / 2, 27, { align: 'center' });
  }
  doc.text(`Currency: ${storeInfo.currency || 'KES'}`, pageWidth / 2, 33, { align: 'center' });

  // Separator line
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(14, 38, pageWidth - 14, 38);

  // Report title below header
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(title, 14, 50);

  // Subtitle with date
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 57);
};

const addPdfFooter = (doc, pageWidth) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
    doc.text('POS System Report', 14, pageHeight - 8);
  }
};

// Helper: add a summary card row in the PDF
const addSummaryRow = (doc, items, startY) => {
  let x = 14;
  const cardWidth = (doc.internal.pageSize.getWidth() - 28 - 12) / Math.min(items.length, 4);
  const gap = 4;

  items.slice(0, 4).forEach((item, i) => {
    const cx = x;
    // Card background
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(cx, startY, cardWidth, 18, 2, 2, 'F');
    // Card border
    doc.setDrawColor(220, 225, 235);
    doc.roundedRect(cx, startY, cardWidth, 18, 2, 2, 'S');
    // Label
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(item.label, cx + 4, startY + 6);
    // Value
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(String(item.value), cx + 4, startY + 15);
    x += cardWidth + gap;
  });

  return startY + 24;
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [dates, setDates] = useState(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return {
      startDate: formatLocalDate(thirtyDaysAgo),
      endDate: formatLocalDate(today),
      date: formatLocalDate(today),
    };
  });

  const tabs = [
    { id: 'daily', label: 'Daily Sales' },
    { id: 'weekly', label: 'Weekly Sales' },
    { id: 'monthly', label: 'Monthly Sales' },
    { id: 'products', label: 'Product Sales' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'cashiers', label: 'Cashier Performance' },
    { id: 'pnl', label: 'Profit & Loss' },
  ];

  const fetchReport = async (type) => {
    setLoading(true);
    try {
      let response;
      switch (type) {
        case 'daily': response = await reportsAPI.dailySales({ date: dates.date }); break;
        case 'weekly': response = await reportsAPI.weeklySales({ startDate: dates.startDate, endDate: dates.endDate }); break;
        case 'monthly': response = await reportsAPI.monthlySales({ year: new Date().getFullYear() }); break;
        case 'products': response = await reportsAPI.productSales({ startDate: dates.startDate, endDate: dates.endDate }); break;
        case 'inventory': response = await reportsAPI.inventory(); break;
        case 'cashiers': response = await reportsAPI.cashierPerformance({ startDate: dates.startDate, endDate: dates.endDate }); break;
        case 'pnl': response = await reportsAPI.profitLoss({ startDate: dates.startDate, endDate: dates.endDate }); break;
      }
      setData(response.data);
    } catch (err) {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!data) return;

    // Fetch store settings for the PDF header
    let storeInfo = {};
    try {
      const { data: settings } = await settingsAPI.getAll();
      storeInfo = settings;
    } catch {
      // Use defaults
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const title = tabs.find(t => t.id === activeTab)?.label || 'Report';
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Add header to first page
    addPdfHeader(doc, storeInfo, title, pageWidth);

    let yPos = 64;

    // Render based on report type
    if (activeTab === 'daily' && data.summary) {
      // Summary cards
      yPos = addSummaryRow(doc, [
        { label: 'Total Sales', value: formatCurrency(data.summary.totalSales) },
        { label: 'Transactions', value: data.summary.totalTransactions || data.transactions?.length || 0 },
        { label: 'Items Sold', value: data.summary.totalItems || 0 },
        { label: 'Avg per Transaction', value: data.summary.totalTransactions ? formatCurrency(data.summary.totalSales / data.summary.totalTransactions) : 'KSh 0' },
      ], yPos);

      yPos += 4;

      // Payment Methods Breakdown
      if (data.summary.paymentMethods && Object.keys(data.summary.paymentMethods).length > 0) {
        if (yPos > 230) { doc.addPage(); yPos = 20; addPdfHeader(doc, storeInfo, title, pageWidth); yPos = 62; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('Payment Methods Breakdown', 14, yPos);
        yPos += 5;
        autoTable(doc, {
          startY: yPos,
          head: [['Method', 'Sales', '% of Total']],
          body: Object.entries(data.summary.paymentMethods).map(([method, amount]) => [
            method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            formatCurrency(amount),
            `${((amount / data.summary.totalSales) * 100).toFixed(1)}%`,
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 0: { cellWidth: 50 } },
        });
        yPos = doc.lastAutoTable.finalY + 8;
      }

      // Cashier Performance
      if (data.summary.cashiers && Object.keys(data.summary.cashiers).length > 0) {
        if (yPos > 230) { doc.addPage(); yPos = 20; addPdfHeader(doc, storeInfo, title, pageWidth); yPos = 62; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('Cashier Performance', 14, yPos);
        yPos += 5;
        autoTable(doc, {
          startY: yPos,
          head: [['Cashier', 'Sales', '% of Total']],
          body: Object.entries(data.summary.cashiers).map(([name, amount]) => [
            name,
            formatCurrency(amount),
            `${((amount / data.summary.totalSales) * 100).toFixed(1)}%`,
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 0: { cellWidth: 50 } },
        });
        yPos = doc.lastAutoTable.finalY + 8;
      }

      // Transactions Table
      if (data.transactions?.length > 0) {
        if (yPos > 220) { doc.addPage(); yPos = 20; addPdfHeader(doc, storeInfo, title, pageWidth); yPos = 62; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text(`Transactions (${data.transactions.length})`, 14, yPos);
        yPos += 5;
        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Receipt', 'Cashier', 'Payment', 'Items', 'Total', 'Time']],
          body: data.transactions.map((t, i) => [
            String(i + 1),
            t.receiptNumber,
            t.cashier?.name || '',
            t.paymentMethod.replace('_', ' '),
            String(t.items?.reduce((s, it) => s + it.quantity, 0) || 0),
            formatCurrency(t.total),
            new Date(t.createdAt).toLocaleTimeString(),
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 28 } },
        });
      }
    } else if (activeTab === 'weekly') {
      yPos = addSummaryRow(doc, [
        { label: 'Total Sales', value: formatCurrency(data.totalSales) },
        { label: 'Transactions', value: data.totalTransactions || 0 },
        { label: 'Avg Daily', value: data.dailyData?.length ? formatCurrency(data.totalSales / data.dailyData.length) : 'KSh 0' },
        { label: 'Period', value: `${data.startDate?.split('T')[0] || ''} - ${data.endDate?.split('T')[0] || ''}` },
      ], yPos);

      yPos += 4;

      if (data.dailyData?.length > 0) {
        if (yPos > 230) { doc.addPage(); yPos = 20; addPdfHeader(doc, storeInfo, title, pageWidth); yPos = 62; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('Daily Breakdown', 14, yPos);
        yPos += 5;
        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Date', 'Sales', 'Transactions', 'Avg per Transaction']],
          body: data.dailyData.map((d, i) => [
            String(i + 1),
            d.date,
            formatCurrency(d.sales),
            String(d.count || 0),
            d.count ? formatCurrency(d.sales / d.count) : 'KSh 0',
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
        });
      }
    } else if (activeTab === 'monthly') {
      yPos = addSummaryRow(doc, [
        { label: 'Year', value: data.year || 'N/A' },
        { label: 'Total Sales', value: formatCurrency(data.totalSales) },
        { label: 'Transactions', value: data.totalTransactions || 0 },
        { label: 'Monthly Avg', value: data.monthlyData?.length ? formatCurrency(data.totalSales / data.monthlyData.length) : 'KSh 0' },
      ], yPos);

      yPos += 4;

      if (data.monthlyData?.length > 0) {
        if (yPos > 230) { doc.addPage(); yPos = 20; addPdfHeader(doc, storeInfo, title, pageWidth); yPos = 62; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('Monthly Breakdown', 14, yPos);
        yPos += 5;
        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Month', 'Sales', 'Transactions', 'Avg per Transaction']],
          body: data.monthlyData.map((d, i) => [
            String(i + 1),
            d.month,
            formatCurrency(d.sales),
            String(d.count || 0),
            d.count ? formatCurrency(d.sales / d.count) : 'KSh 0',
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
        });
      }
    } else if (activeTab === 'products') {
      const products = Array.isArray(data) ? data : [];
      const totalRevenue = products.reduce((s, p) => s + (p.revenue || 0), 0);
      const totalQty = products.reduce((s, p) => s + (p.quantity || 0), 0);

      yPos = addSummaryRow(doc, [
        { label: 'Total Products', value: products.length },
        { label: 'Total Quantity', value: totalQty },
        { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
        { label: 'Top Product', value: products[0]?.name || 'N/A' },
      ], yPos);

      yPos += 4;

      if (products.length > 0) {
        if (yPos > 220) { doc.addPage(); yPos = 20; addPdfHeader(doc, storeInfo, title, pageWidth); yPos = 62; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('Product Sales Breakdown', 14, yPos);
        yPos += 5;
        // Add rank, name, qty, revenue, % of total
        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Product', 'Qty Sold', 'Revenue', '% of Total']],
          body: products.map((p, i) => [
            String(i + 1),
            p.name,
            String(p.quantity || 0),
            formatCurrency(p.revenue),
            totalRevenue > 0 ? `${((p.revenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('No product sales data available for the selected period.', 14, yPos);
      }
    } else if (activeTab === 'inventory') {
      yPos = addSummaryRow(doc, [
        { label: 'Total Products', value: data.totalProducts || 0 },
        { label: 'Low Stock Items', value: data.lowStock || 0 },
        { label: 'Out of Stock', value: data.outOfStock || 0 },
        { label: 'Total Value (Cost)', value: formatCurrency(data.totalValue) },
      ], yPos);

      yPos += 2;

      // Second row of summary
      yPos = addSummaryRow(doc, [
        { label: 'Retail Value', value: formatCurrency(data.totalRetailValue) },
        { label: 'Potential Profit', value: formatCurrency((data.totalRetailValue || 0) - (data.totalValue || 0)) },
        { label: 'Healthy Stock', value: (data.totalProducts || 0) - (data.lowStock || 0) - (data.outOfStock || 0) },
        { label: 'Stock Health', value: data.totalProducts > 0 ? `${(((data.totalProducts - data.lowStock - data.outOfStock) / data.totalProducts) * 100).toFixed(1)}%` : '0%' },
      ], yPos);

      yPos += 4;

      // Low stock alert section
      const lowStockItems = data.products?.filter(p => p.stockStatus === 'low' || p.stockStatus === 'out_of_stock') || [];
      if (lowStockItems.length > 0) {
        if (yPos > 220) { doc.addPage(); yPos = 20; addPdfHeader(doc, storeInfo, title, pageWidth); yPos = 62; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(220, 50, 50);
        doc.text(`⚠ Low Stock Alerts (${lowStockItems.length} items)`, 14, yPos);
        yPos += 5;
        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Product', 'Category', 'Current Qty', 'Reorder Level', 'Status']],
          body: lowStockItems.map((p, i) => [
            String(i + 1),
            p.name,
            p.category?.name || '',
            String(p.quantity),
            String(p.reorderLevel),
            p.stockStatus === 'out_of_stock' ? 'Out of Stock' : 'Low Stock',
          ]),
          theme: 'striped',
          headStyles: { fillColor: [220, 50, 50], fontSize: 8, textColor: [255, 255, 255] },
          bodyStyles: { fontSize: 8 },
        });
        yPos = doc.lastAutoTable.finalY + 8;
      }

      // Full inventory list
      if (data.products?.length > 0) {
        if (yPos > 220) { doc.addPage(); yPos = 20; addPdfHeader(doc, storeInfo, title, pageWidth); yPos = 62; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('Complete Inventory List', 14, yPos);
        yPos += 5;
        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Product', 'Category', 'Qty', 'Cost Price', 'Retail Price', 'Reorder', 'Status']],
          body: data.products.map((p, i) => [
            String(i + 1),
            p.name,
            p.category?.name || '',
            String(p.quantity),
            formatCurrency(p.costPrice),
            formatCurrency(p.retailPrice),
            String(p.reorderLevel),
            (p.stockStatus || '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], fontSize: 7 },
          bodyStyles: { fontSize: 7 },
        });
      }
    } else if (activeTab === 'cashiers') {
      const cashiers = Array.isArray(data) ? data : [];
      const totalSales = cashiers.reduce((s, c) => s + (c.totalSales || 0), 0);
      const totalTx = cashiers.reduce((s, c) => s + (c.totalTransactions || 0), 0);

      yPos = addSummaryRow(doc, [
        { label: 'Total Cashiers', value: cashiers.length },
        { label: 'Total Transactions', value: totalTx },
        { label: 'Total Sales', value: formatCurrency(totalSales) },
        { label: 'Avg per Cashier', value: cashiers.length ? formatCurrency(totalSales / cashiers.length) : 'KSh 0' },
      ], yPos);

      yPos += 4;

      if (cashiers.length > 0) {
        if (yPos > 220) { doc.addPage(); yPos = 20; addPdfHeader(doc, storeInfo, title, pageWidth); yPos = 62; }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('Cashier Performance Breakdown', 14, yPos);
        yPos += 5;
        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Name', 'Transactions', 'Items Sold', 'Total Sales', 'Avg/Transaction', '% of Total']],
          body: cashiers.map((c, i) => [
            String(i + 1),
            c.name,
            String(c.totalTransactions || 0),
            String(c.totalItems || 0),
            formatCurrency(c.totalSales),
            formatCurrency(c.averageTransactionValue || 0),
            totalSales > 0 ? `${((c.totalSales / totalSales) * 100).toFixed(1)}%` : '0%',
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
          bodyStyles: { fontSize: 7 },
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('No cashier performance data available for the selected period.', 14, yPos);
      }
    } else if (activeTab === 'pnl') {
      yPos = addSummaryRow(doc, [
        { label: 'Total Revenue', value: formatCurrency(data.totalRevenue) },
        { label: 'Total Cost', value: formatCurrency(data.totalCost) },
        { label: 'Profit', value: formatCurrency(data.netProfit) },
        { label: '% Profit', value: `${(data.netMargin || 0).toFixed(1)}%` },
      ], yPos);

      yPos += 2;

      yPos = addSummaryRow(doc, [
        { label: 'Tax', value: formatCurrency(data.totalTax) },
        { label: 'Discounts', value: formatCurrency(data.totalDiscount) },
      ], yPos);

      yPos += 4;

      if (yPos > 230) { doc.addPage(); yPos = 20; addPdfHeader(doc, storeInfo, title, pageWidth); yPos = 62; }
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Detailed P&L Statement', 14, yPos);
      yPos += 5;
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value', '% of Revenue']],
        body: [
          ['Total Revenue', formatCurrency(data.totalRevenue), '100%'],
          ['Less: Cost of Goods Sold', formatCurrency(data.totalCost), data.totalRevenue > 0 ? `${((data.totalCost / data.totalRevenue) * 100).toFixed(1)}%` : '0%'],
          ['Less: Discounts', `(${formatCurrency(data.totalDiscount)})`, data.totalRevenue > 0 ? `${((data.totalDiscount / data.totalRevenue) * 100).toFixed(1)}%` : '0%'],
          ['Profit', formatCurrency(data.netProfit), data.totalRevenue > 0 ? `${((data.netProfit / data.totalRevenue) * 100).toFixed(1)}%` : '0%'],
          ['Less: Tax', formatCurrency(data.totalTax), data.totalRevenue > 0 ? `${((data.totalTax / data.totalRevenue) * 100).toFixed(1)}%` : '0%'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Key metrics summary
      if (yPos > 250) { doc.addPage(); yPos = 20; addPdfHeader(doc, storeInfo, title, pageWidth); yPos = 62; }
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Key Metrics', 14, yPos);
      yPos += 5;
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: [
          ['Total Transactions', String(data.totalTransactions || 0)],
          ['Profit per Transaction', data.totalTransactions ? formatCurrency(data.netProfit / data.totalTransactions) : 'KSh 0'],
          ['% Profit', `${(data.netMargin || 0).toFixed(1)}%`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
      });
    }

    // Add page numbers to all pages
    addPdfFooter(doc, pageWidth);

    doc.save(`${activeTab}-report-${formatLocalDate(new Date())}.pdf`);
    toast.success('PDF exported successfully!');
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="text-sm" style={{ color: p.color }}>{p.name}: {p.name === 'Sales' || p.name === 'Revenue' ? formatCurrency(p.value) : p.value}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderReport = () => {
    if (loading) return <div className="text-center py-12 text-gray-500">Loading report...</div>;
    if (!data) return <div className="text-center py-12 text-gray-500">Click "Generate" to load report</div>;

    switch (activeTab) {
      case 'daily':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Total Sales</p>
                <p className="text-xl font-bold">{formatCurrency(data.summary?.totalSales)}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Transactions</p>
                <p className="text-xl font-bold">{data.summary?.totalTransactions || data.transactions?.length || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Items Sold</p>
                <p className="text-xl font-bold">{data.summary?.totalItems || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Avg per Transaction</p>
                <p className="text-xl font-bold">{data.summary?.totalTransactions ? formatCurrency(data.summary.totalSales / data.summary.totalTransactions) : 'KSh 0'}</p>
              </div>
            </div>
            {data.transactions?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 overflow-x-auto">
                <h3 className="font-semibold mb-3">Transactions</h3>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">Receipt</th><th className="text-left py-2">Cashier</th><th className="text-left py-2">Payment</th><th className="text-right py-2">Total</th><th className="text-right py-2">Time</th></tr></thead>
                  <tbody>{data.transactions.map(t => (
                    <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-2 font-mono text-xs">{t.receiptNumber}</td>
                      <td className="py-2">{t.cashier?.name}</td>
                      <td className="py-2 capitalize">{t.paymentMethod}</td>
                      <td className="py-2 text-right">{formatCurrency(t.total)}</td>
                      <td className="py-2 text-right text-gray-500">{new Date(t.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        );

      case 'weekly':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Total Sales</p>
                <p className="text-xl font-bold">{formatCurrency(data.totalSales)}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Transactions</p>
                <p className="text-xl font-bold">{data.totalTransactions}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Avg Daily</p>
                <p className="text-xl font-bold">{data.dailyData?.length ? formatCurrency(data.totalSales / data.dailyData.length) : 'KSh 0'}</p>
              </div>
            </div>
            {data.dailyData?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold mb-3">Daily Breakdown</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="sales" fill="#3b82f6" radius={[4,4,0,0]} name="Sales" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );

      case 'monthly':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Year</p><p className="text-xl font-bold">{data.year}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Total Sales</p><p className="text-xl font-bold">{formatCurrency(data.totalSales)}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Transactions</p><p className="text-xl font-bold">{data.totalTransactions}</p></div>
            </div>
            {data.monthlyData?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold mb-3">Monthly Breakdown</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="month" stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} name="Sales" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );

      case 'products':
        return (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <h3 className="font-semibold mb-3">Product Sales</h3>
              {Array.isArray(data) && data.length > 0 ? (
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">Product</th><th className="text-right py-2">Quantity Sold</th><th className="text-right py-2">Revenue</th></tr></thead>
                  <tbody>{data.map((p, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-2">{p.name}</td><td className="py-2 text-right">{p.quantity}</td><td className="py-2 text-right">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <p className="text-gray-500 text-center py-4">No product sales data</p>}
            </div>
          </div>
        );

      case 'inventory':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Total Products</p><p className="text-xl font-bold">{data.totalProducts}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Low Stock</p><p className="text-xl font-bold text-yellow-600">{data.lowStock}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Out of Stock</p><p className="text-xl font-bold text-red-600">{data.outOfStock}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Total Value</p><p className="text-xl font-bold">{formatCurrency(data.totalValue)}</p></div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <h3 className="font-semibold mb-3">Inventory List</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2">Product</th><th className="text-left py-2">Category</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Reorder</th><th className="text-center py-2">Status</th></tr></thead>
                <tbody>{data.products?.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2">{p.name}</td><td className="py-2">{p.category?.name}</td>
                    <td className="py-2 text-right">{p.quantity}</td><td className="py-2 text-right">{p.reorderLevel}</td>
                    <td className="py-2 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${p.stockStatus === 'out_of_stock' ? 'bg-red-100 text-red-600' : p.stockStatus === 'low' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
                        {p.stockStatus.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        );

      case 'cashiers':
        return (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <h3 className="font-semibold mb-3">Cashier Performance</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2">Name</th><th className="text-right py-2">Transactions</th><th className="text-right py-2">Total Sales</th><th className="text-right py-2">Items Sold</th><th className="text-right py-2">Avg per Transaction</th></tr></thead>
                <tbody>{data?.map((c, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2">{c.name}</td>
                    <td className="py-2 text-right">{c.totalTransactions}</td>
                    <td className="py-2 text-right">{formatCurrency(c.totalSales)}</td>
                    <td className="py-2 text-right">{c.totalItems}</td>
                    <td className="py-2 text-right">{formatCurrency(c.averageTransactionValue)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        );

      case 'pnl':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Total Revenue</p><p className="text-xl font-bold text-green-600">{formatCurrency(data.totalRevenue)}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Total Cost</p><p className="text-xl font-bold text-red-600">{formatCurrency(data.totalCost)}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Profit</p><p className="text-xl font-bold">{formatCurrency(data.netProfit)}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">% Profit</p><p className="text-xl font-bold">{data.netMargin?.toFixed(1)}%</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Tax</p><p className="text-xl font-bold">{formatCurrency(data.totalTax)}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Discounts</p><p className="text-xl font-bold">{formatCurrency(data.totalDiscount)}</p></div>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-2">
          {data && <button onClick={handleExportPDF} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"><img src="./icons/report-icon.png" alt="" className="w-4 h-4" /> Export PDF</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setData(null); }}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {activeTab !== 'monthly' && activeTab !== 'inventory' && (
          <>
            {(activeTab === 'daily') ? (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">Date:</label>
                <input type="date" value={dates.date} onChange={e => setDates(p => ({...p, date: e.target.value}))}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500">From:</label>
                  <input type="date" value={dates.startDate} onChange={e => setDates(p => ({...p, startDate: e.target.value}))}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500">To:</label>
                  <input type="date" value={dates.endDate} onChange={e => setDates(p => ({...p, endDate: e.target.value}))}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
                </div>
              </>
            )}
            <button onClick={() => fetchReport(activeTab)} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Generate</button>
          </>
        )}
        {(activeTab === 'inventory') && (
          <button onClick={() => fetchReport(activeTab)} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Generate Report</button>
        )}
        {activeTab === 'monthly' && (
          <button onClick={() => fetchReport(activeTab)} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Generate Report</button>
        )}
      </div>

      {/* Report Content */}
      <div>{renderReport()}</div>
    </div>
  );
}
