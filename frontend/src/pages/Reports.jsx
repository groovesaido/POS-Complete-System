import { useState } from 'react';
import { reportsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [dates, setDates] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    date: new Date().toISOString().split('T')[0],
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

  const handleExportCSV = () => {
    if (!data) return;
    let csv = 'Report Data\n';
    csv += Object.entries(data).map(([k, v]) => `${k},${v}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${activeTab}-report.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const formatCurrency = (v) => `KSh ${Number(v || 0).toLocaleString()}`;

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
                <p className="text-sm text-gray-500">Gross Profit</p><p className="text-xl font-bold">{formatCurrency(data.grossProfit)}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Gross Margin</p><p className="text-xl font-bold">{data.grossMargin?.toFixed(1)}%</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Tax</p><p className="text-xl font-bold">{formatCurrency(data.totalTax)}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Discounts</p><p className="text-xl font-bold">{formatCurrency(data.totalDiscount)}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Net Profit</p><p className="text-xl font-bold text-green-600">{formatCurrency(data.netProfit)}</p></div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500">Net Margin</p><p className="text-xl font-bold">{data.netMargin?.toFixed(1)}%</p></div>
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
          {data && <button onClick={handleExportCSV} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">📥 Export CSV</button>}
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
