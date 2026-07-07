import { useState, useEffect } from 'react';
import { dashboardAPI, reportsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const RANK_COLORS = [
  '#fbbf24', // gold
  '#9ca3af', // silver
  '#d97706', // bronze
  '#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#fb923c', '#22d3ee', '#e879f9',
];

const DATE_OPTIONS = ['Today', 'Last 7 Days', 'Last 30 Days', 'This Year', 'All Time'];

/** Smart axis formatter: shows KSh with k/M suffixes for large values, avoids '0k' for small values */
const formatAxisCurrency = (v) => {
  if (Math.abs(v) >= 1000000) return `KSh ${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `KSh ${(v / 1000).toFixed(0)}k`;
  return `KSh ${Math.round(v)}`;
};

function TopProductsTable({ products, formatCurrency, dateLabel, onDateChange }) {
  const [showAll, setShowAll] = useState(false);
  const [sortField, setSortField] = useState('revenue');
  const [sortDir, setSortDir] = useState('desc');
  const [showDateMenu, setShowDateMenu] = useState(false);

  if (!products || products.length === 0) {
    return (
      <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="h-1 w-full bg-emerald-500" />
        <div className="p-5 text-center text-gray-400 text-sm">No product sales data yet.</div>
      </div>
    );
  }

  const sorted = [...products].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'name') return mul * a.name.localeCompare(b.name);
    return mul * ((a[sortField] || 0) - (b[sortField] || 0));
  });

  const displayed = showAll ? sorted : sorted.slice(0, 10);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-gray-300 dark:text-gray-600 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-in-out overflow-hidden">
      <div className="h-1 w-full bg-emerald-500" />
      <div className="p-5">
        {/* Header with date dropdown */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Top Selling Products
            </h3>
            {/* Date dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDateMenu(!showDateMenu)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {dateLabel}
                <svg className={`w-3.5 h-3.5 transition-transform ${showDateMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showDateMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDateMenu(false)} />
                  <div className="absolute left-0 mt-1 w-36 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                    {DATE_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { onDateChange(opt); setShowDateMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                          dateLabel === opt
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
            {showAll ? `${products.length} products` : `Top 10 of ${products.length}`}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-4">
          Click column headers to sort by that metric.
        </p>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-2.5 px-2 text-left w-12">#</th>
                <th className="py-2.5 px-2 text-left cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('name')}>
                  Product <SortIcon field="name" />
                </th>
                <th className="py-2.5 px-2 text-right cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('quantity')}>
                  Qty <SortIcon field="quantity" />
                </th>
                <th className="py-2.5 px-2 text-right cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('revenue')}>
                  Revenue <SortIcon field="revenue" />
                </th>
                <th className="py-2.5 px-2 text-right cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('cost')}>
                  Cost <SortIcon field="cost" />
                </th>
                <th className="py-2.5 px-2 text-right cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('profit')}>
                  Profit <SortIcon field="profit" />
                </th>
                <th className="py-2.5 px-2 text-right cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => toggleSort('margin')}>
                  Margin <SortIcon field="margin" />
                </th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((p, i) => {
                const rank = sorted.indexOf(p) + 1;
                const isTop3 = rank <= 3;
                return (
                  <tr
                    key={`${p.productId || p.name}-${i}`}
                    className="group/row border-b border-gray-100 dark:border-gray-700/50 transition-all duration-150 ease-in-out hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
                  >
                    <td className="py-2.5 px-2 text-center">
                      {isTop3 ? (
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white shadow-sm"
                          style={{ backgroundColor: RANK_COLORS[rank - 1] }}
                        >
                          {rank}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs font-mono">{rank}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 font-medium text-gray-900 dark:text-white min-w-[120px]">
                      <span className="group-hover/row:text-emerald-600 dark:group-hover/row:text-emerald-400 transition-colors">
                        {p.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-sm tabular-nums">{p.quantity.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-sm tabular-nums text-blue-600 dark:text-blue-400">
                      {formatCurrency(p.revenue)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-sm tabular-nums text-gray-500 dark:text-gray-400">
                      {formatCurrency(p.cost)}
                    </td>
                    <td className={`py-2.5 px-2 text-right font-mono text-sm tabular-nums font-medium ${p.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      {p.profit >= 0 ? formatCurrency(p.profit) : `-${formatCurrency(Math.abs(p.profit))}`}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.margin >= 30 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                        p.margin >= 15 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                        p.margin >= 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      }`}>
                        {p.margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Show All / Show Top 10 toggle */}
        {products.length > 10 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors"
            >
              {showAll ? (
                <>Show Top 10 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg></>
              ) : (
                <>Show All ({products.length} products) <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const FILTER_OPTIONS = [
  { value: 'daily-sales', label: 'Daily', sublabel: 'Sales', icon: './icons/sales-icon.png' },
  { value: 'daily-hours', label: 'Daily', sublabel: 'Hours', icon: './icons/weekly-sale-icon.png' },
  { value: 'weekly', label: 'Weekly', sublabel: 'Day of Week', icon: './icons/weekly-sale-icon.png' },
  { value: 'monthly', label: 'Monthly', sublabel: 'Week 1-4', icon: './icons/montly-sale-icon.png' },
  { value: 'yearly', label: 'Yearly', sublabel: 'By Month', icon: './icons/report-icon.png' },
];

const SummaryCard = ({ title, value, icon, color, accentColor, textColor, loading }) => (
  <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-in-out overflow-hidden">
    {/* Colored accent bar at top */}
    <div className={`h-1 w-full ${accentColor || 'bg-transparent'}`} />
    <div className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {title}
          </p>
          {loading ? (
            <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
          ) : (
            <p className={`text-2xl font-bold mt-1.5 ${textColor || 'text-gray-900 dark:text-white'}`}>
              {value}
            </p>
          )}
        </div>
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color} group-hover:scale-110 group-hover:shadow-md transition-all duration-300 ease-out`}
        >
          <img src={icon} alt="" className="w-7 h-7" />
        </div>
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('daily-sales');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [profitData, setProfitData] = useState(null);
  const [profitStartDate, setProfitStartDate] = useState('');
  const [profitEndDate, setProfitEndDate] = useState('');
  const [profitDateLabel, setProfitDateLabel] = useState('All Time');
  const [chartDateRange, setChartDateRange] = useState({ start: '', end: '' });
  const [chartDateLabel, setChartDateLabel] = useState('All Time');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [salesActiveIndex, setSalesActiveIndex] = useState(-1);
  const [topProductsDateLabel, setTopProductsDateLabel] = useState('Today');

  /** Compute date range from a preset label */
  const getDateRange = (label) => {
    const now = new Date();
    if (label === 'Today') {
      const d = toLocalDate(now);
      return { start: d, end: d };
    }
    if (label === 'Last 7 Days') {
      const seven = new Date(now);
      seven.setDate(seven.getDate() - 6);
      return { start: toLocalDate(seven), end: toLocalDate(now) };
    }
    if (label === 'Last 30 Days') {
      const thirty = new Date(now);
      thirty.setDate(thirty.getDate() - 29);
      return { start: toLocalDate(thirty), end: toLocalDate(now) };
    }
    if (label === 'This Year') {
      const first = new Date(now.getFullYear(), 0, 1);
      return { start: toLocalDate(first), end: toLocalDate(now) };
    }
    return { start: '', end: '' }; // All Time
  };

  const handleTopProductsDateChange = (label) => {
    setTopProductsDateLabel(label);
    const { start, end } = getDateRange(label);
    fetchStats(start, end);
  };

  /** Format a Date as YYYY-MM-DD using local timezone (avoids .toISOString() UTC shift) */
  const toLocalDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  /** Preset date ranges for quick selection */
  const presets = [
    {
      label: 'Today',
      getRange: () => {
        const d = new Date();
        const local = toLocalDate(d);
        return { start: local, end: local };
      },
    },
    {
      label: 'This Week',
      getRange: () => {
        const now = new Date();
        const day = now.getDay();
        const mon = new Date(now);
        mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        return { start: toLocalDate(mon), end: toLocalDate(now) };
      },
    },
    {
      label: 'This Month',
      getRange: () => {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: toLocalDate(first), end: toLocalDate(now) };
      },
    },
    {
      label: 'Last 7 Days',
      getRange: () => {
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        return { start: toLocalDate(sevenDaysAgo), end: toLocalDate(now) };
      },
    },
    {
      label: 'Last 30 Days',
      getRange: () => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        return { start: toLocalDate(thirtyDaysAgo), end: toLocalDate(now) };
      },
    },
    {
      label: 'This Year',
      getRange: () => {
        const now = new Date();
        const first = new Date(now.getFullYear(), 0, 1);
        return { start: toLocalDate(first), end: toLocalDate(now) };
      },
    },
    {
      label: 'All Time',
      getRange: () => ({ start: '', end: '' }),
    },
  ];

  /** Apply a preset date range */
  const applyPreset = (preset) => {
    const { start, end } = preset.getRange();
    setProfitStartDate(start);
    setProfitEndDate(end);
    setProfitDateLabel(preset.label);
  };

  // Auto-fetch profit data when date range changes
  useEffect(() => {
    if (user?.role === 'admin') {
      fetchProfitData();
    }
  }, [user, profitStartDate, profitEndDate]);

  useEffect(() => {
    if (user?.role === 'admin') {
      // Default to today's date for the top products view
      const { start, end } = getDateRange('Today');
      fetchStats(start, end);
    } else setLoading(false);
  }, [user]);

  const fetchStats = async (startDateOverride, endDateOverride) => {
    try {
      const params = {};
      const start = startDateOverride !== undefined ? startDateOverride : chartDateRange.start;
      const end = endDateOverride !== undefined ? endDateOverride : chartDateRange.end;
      if (start) params.chartStartDate = start;
      if (end) params.chartEndDate = end;
      const { data } = await dashboardAPI.getStats(params);
      setStats(data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfitData = async () => {
    try {
      const params = {};
      if (profitStartDate) params.startDate = profitStartDate;
      if (profitEndDate) params.endDate = profitEndDate;
      const { data } = await reportsAPI.profitLoss(params);
      setProfitData(data);
    } catch (err) {
      // silently fail — profit data is supplemental
    }
  };  const formatCurrency = (value) => {
    return `KSh ${Number(value || 0).toLocaleString()}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="text-sm" style={{ color: p.color }}>
              {p.name}: {p.name === 'Sales' ? formatCurrency(p.value) : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // If user is cashier, show simplified dashboard
  if (user?.role === 'cashier') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm text-center">
          <img src="./icons/dashboard-icon.png" alt="" className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Welcome, {user.name}!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You're logged in as a Cashier. Head to the POS to start serving customers.
          </p>
          <Link
            to="/pos"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <img src="./icons/card-icon.png" alt="" className="w-5 h-5" /> Open POS
          </Link>
        </div>
      </div>
    );
  }

  const statsList = [
    { title: "Today's Sales", value: formatCurrency(stats?.summary?.todaySales), icon: './icons/sales-icon.png', color: 'bg-green-100 dark:bg-green-900/30', accentColor: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' },
    { title: 'Weekly Sales', value: formatCurrency(stats?.summary?.weekSales), icon: './icons/weekly-sale-icon.png', color: 'bg-blue-100 dark:bg-blue-900/30', accentColor: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400' },
    { title: 'Monthly Sales', value: formatCurrency(stats?.summary?.monthSales), icon: './icons/montly-sale-icon.png', color: 'bg-purple-100 dark:bg-purple-900/30', accentColor: 'bg-purple-500', textColor: 'text-purple-600 dark:text-purple-400' },
    { title: 'Total Revenue', value: formatCurrency(stats?.summary?.totalRevenue), icon: './icons/revenue-icon.png', color: 'bg-yellow-100 dark:bg-yellow-900/30', accentColor: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400' },
    { title: 'Total Products', value: stats?.summary?.totalProducts?.toLocaleString(), icon: './icons/product-icon.png', color: 'bg-indigo-100 dark:bg-indigo-900/30', accentColor: 'bg-indigo-500', textColor: 'text-indigo-600 dark:text-indigo-400' },
    { title: 'Transactions', value: stats?.summary?.totalTransactions?.toLocaleString(), icon: './icons/transaction-icon.png', color: 'bg-teal-100 dark:bg-teal-900/30', accentColor: 'bg-teal-500', textColor: 'text-teal-600 dark:text-teal-400' },
    { title: 'Active Cashiers', value: stats?.summary?.totalCashiers, icon: './icons/cashier-icon.png', color: 'bg-pink-100 dark:bg-pink-900/30', accentColor: 'bg-pink-500', textColor: 'text-pink-600 dark:text-pink-400' },
    { title: 'Low Stock Items', value: stats?.summary?.lowStockProducts, icon: './icons/error-icon.png', color: 'bg-red-100 dark:bg-red-900/30', accentColor: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsList.map((card, i) => (
          <SummaryCard key={i} {...card} loading={loading} />
        ))}
      </div>

      {/* Charts Date Filter */}
      {!loading && stats && (
        <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-in-out overflow-hidden">
          <div className="h-1 w-full bg-blue-500" />
          <div className="p-4">
          <div className="flex items-center flex-wrap gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Chart Filters</h3>
            <div className="flex items-center gap-2">
              {['Today','This Week','This Month','Last 7 Days','Last 30 Days','This Year','All Time'].map(label => (
                <button
                  key={label}
                  onClick={() => {
                    const now = new Date();
                    let start = '', end = '';
                    if (label === 'Today') {
                      start = toLocalDate(now);
                      end = start;
                    } else if (label === 'This Week') {
                      const day = now.getDay();
                      const mon = new Date(now);
                      mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
                      start = toLocalDate(mon);
                      end = toLocalDate(now);
                    } else if (label === 'This Month') {
                      start = toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
                      end = toLocalDate(now);
                    } else if (label === 'Last 7 Days') {
                      const sevenDaysAgo = new Date(now);
                      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
                      start = toLocalDate(sevenDaysAgo);
                      end = toLocalDate(now);
                    } else if (label === 'Last 30 Days') {
                      const thirtyDaysAgo = new Date(now);
                      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
                      start = toLocalDate(thirtyDaysAgo);
                      end = toLocalDate(now);
                    } else if (label === 'This Year') {
                      start = toLocalDate(new Date(now.getFullYear(), 0, 1));
                      end = toLocalDate(now);
                    }
                    setChartDateRange({ start, end });
                    setChartDateLabel(label);
                    fetchStats(start, end);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    chartDateLabel === label
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="flex items-center gap-1 ml-1">
                <input
                  type="date"
                  value={chartDateRange.start}
                  onChange={(e) => {
                    setChartDateRange(p => ({ ...p, start: e.target.value }));
                    setChartDateLabel('Custom');
                  }}
                  className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-32"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={chartDateRange.end}
                  onChange={(e) => {
                    setChartDateRange(p => ({ ...p, end: e.target.value }));
                    setChartDateLabel('Custom');
                  }}
                  className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-32"
                />
              </div>

            </div>
          </div>
        </div>
        </div>
      )}

      {/* Charts */}
      {!loading && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Filterable Sales Chart */}
          <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-in-out overflow-hidden lg:col-span-2">
            <div className="h-1 w-full bg-blue-500" />
            <div className="p-5">
            {/* Filter Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {activeFilter === 'daily-sales' && 'Daily Sales (Last 7 Days)'}
                  {activeFilter === 'daily-hours' && 'Today by Hour'}
                  {activeFilter === 'weekly' && 'This Week by Day'}
                  {activeFilter === 'monthly' && 'This Month by Week'}
                  {activeFilter === 'yearly' && 'This Year by Month'}
                </h3>
                {activeFilter === 'daily-sales' && <span className="text-xs text-gray-400">Sales over days</span>}
                {activeFilter === 'daily-hours' && <span className="text-xs text-gray-400">Sales per hour</span>}
                {activeFilter === 'weekly' && <span className="text-xs text-gray-400">Mon — Sun</span>}
                {activeFilter === 'monthly' && <span className="text-xs text-gray-400">Week 1 — Week 4</span>}
                {activeFilter === 'yearly' && <span className="text-xs text-gray-400">Jan — Dec</span>}
              </div>

              {/* Filter Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {/* Filter funnel icon */}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span className="font-medium">
                    {FILTER_OPTIONS.find(f => f.value === activeFilter)?.label}
                  </span>
                  <span className="text-xs text-gray-400 hidden sm:inline">
                    · {FILTER_OPTIONS.find(f => f.value === activeFilter)?.sublabel}
                  </span>
                  <svg className={`w-4 h-4 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showFilterMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowFilterMenu(false)} />
                    <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                      {FILTER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setActiveFilter(opt.value); setShowFilterMenu(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${activeFilter === opt.value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''}`}
                        >
                          <img src={opt.icon} alt="" className="w-5 h-5" />
                          <div className="text-left">
                            <p className="font-medium">{opt.label}</p>
                            <p className="text-xs text-gray-400">{opt.sublabel}</p>
                          </div>
                          {activeFilter === opt.value && (
                            <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={
                  activeFilter === 'daily-sales' ? stats.dailySales :
                  activeFilter === 'daily-hours' ? stats.hourlySales :
                  activeFilter === 'weekly' ? stats.weekdaySales :
                  activeFilter === 'monthly' ? stats.monthWeekSales :
                  stats.yearlySales
                }
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="salesBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                  <filter id="sales-bar-shadow">
                    <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
                  </filter>
                  <filter id="sales-bar-active-shadow">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.35" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey={
                    activeFilter === 'daily-sales' ? 'date' :
                    activeFilter === 'daily-hours' ? 'label' :
                    activeFilter === 'weekly' ? 'day' :
                    activeFilter === 'monthly' ? 'week' :
                    'month'
                  }
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="sales"
                  fill="url(#salesBarGradient)"
                  name="Sales"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={true}
                  animationBegin={0}
                  animationDuration={1200}
                  animationEasing="ease-out"
                  filter="url(#sales-bar-shadow)"
                  maxBarSize={80}
                  activeIndex={salesActiveIndex}
                  onMouseEnter={(_, index) => setSalesActiveIndex(index)}
                  onMouseLeave={() => setSalesActiveIndex(-1)}
                  activeBar={{
                    fill: '#60a5fa',
                    stroke: '#2563eb',
                    strokeWidth: 2,
                    filter: 'url(#sales-bar-active-shadow)',
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* Category Sales Donut */}
          <style>{`
            @keyframes donutFadeInUp {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes donutPulseSoft {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.85; transform: scale(1.02); }
            }
            .donut-center-total:hover tspan {
              animation: donutPulseSoft 1.5s ease-in-out infinite;
            }
          `}</style>
          <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-in-out overflow-hidden">
            <div className="h-1 w-full bg-purple-500" />
            <div className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Sales by Category</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="60%" height={280}>
                <PieChart>
                  <defs>
                    <filter id="donut-shadow">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                    </filter>
                  </defs>
                  <Pie
                    data={stats.categorySales}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    isAnimationActive={true}
                    animationBegin={0}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth={2}
                    filter="url(#donut-shadow)"
                  >
                    {stats.categorySales.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  {/* Clickable center text — opens category breakdown modal */}
                  {stats.categorySales.length > 0 && (() => {
                    const total = stats.categorySales.reduce((s, e) => s + e.revenue, 0);
                    return (
                      <g className="donut-center-total" style={{ cursor: 'pointer' }} onClick={() => setShowCategoryModal(true)}>
                        <rect x="35%" y="35%" width="30%" height="30%" fill="transparent" />
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none', fontFamily: 'system-ui, sans-serif' }}>
                          <tspan x="50%" dy="-0.6em" className="fill-gray-400" style={{ fontSize: 11 }}>Total</tspan>
                          <tspan x="50%" dy="1.4em" className="fill-gray-900 dark:fill-white" style={{ fontSize: 14, fontWeight: 700 }}>
                            {formatCurrency(total)}
                          </tspan>
                        </text>
                      </g>
                    );
                  })()}
                </PieChart>
              </ResponsiveContainer>
              {/* Custom Legend with values */}
              <div className="flex-1 min-w-[180px] divide-y divide-gray-100 dark:divide-gray-700/50">
                {stats.categorySales.map((entry, index) => {
                  const total = stats.categorySales.reduce((s, e) => s + e.revenue, 0);
                  const percent = total > 0 ? ((entry.revenue / total) * 100).toFixed(1) : 0;
                  return (
                    <div
                      key={entry.name}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors duration-200 first:pt-0 last:pb-0"
                      style={{ animation: `donutFadeInUp 0.4s ease-out ${index * 0.08}s both` }}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white dark:ring-gray-800 shadow-sm"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">
                        {entry.name}
                      </span>
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
                        {percent}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          </div>

          {/* Top Selling Products Bar Chart */}
          <style>{`
            .top-product-bar:hover {
              filter: brightness(1.15);
            }
          `}</style>
          <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-in-out overflow-hidden">
            <div className="h-1 w-full bg-emerald-500" />
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Top Products</h3>
                </div>
                {stats.topProducts && stats.topProducts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                      {topProductsDateLabel}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Top {Math.min(10, stats.topProducts.length)} of {stats.topProducts.length}
                    </span>
                  </div>
                )}
              </div>
              {stats.topProducts && stats.topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={stats.topProducts.slice(0, 10)}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    layout="vertical"
                    barCategoryGap="20%"
                  >
                    <defs>
                      {stats.topProducts.slice(0, 10).map((_, i) => (
                        <linearGradient key={`grad-${i}`} id={`topBarGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.85} />
                          <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={1} />
                        </linearGradient>
                      ))}
                      <filter id="top-product-bar-shadow">
                        <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.2" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      stroke="#9ca3af"
                      axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                      tickLine={false}
                      tickFormatter={formatAxisCurrency}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fontWeight: 500 }}
                      stroke="#9ca3af"
                      axisLine={false}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const product = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 min-w-[180px]">
                              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: payload[0].color }} />
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{label}</p>
                              </div>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-400">Revenue</span>
                                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(product.revenue)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-400">Quantity</span>
                                  <span className="font-medium text-gray-700 dark:text-gray-200">{product.quantity?.toLocaleString() || 0}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-400">Profit</span>
                                  <span className={`font-medium ${product.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                    {product.profit >= 0 ? formatCurrency(product.profit) : `-${formatCurrency(Math.abs(product.profit))}`}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4 pt-1 border-t border-gray-100 dark:border-gray-700">
                                  <span className="text-gray-400">Margin</span>
                                  <span className={`font-medium ${
                                    product.margin >= 30 ? 'text-emerald-600' :
                                    product.margin >= 15 ? 'text-blue-600' :
                                    product.margin >= 0 ? 'text-yellow-600' :
                                    'text-red-500'
                                  }`}>
                                    {product.margin?.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      name="Revenue"
                      radius={[0, 6, 6, 0]}
                      filter="url(#top-product-bar-shadow)"
                      maxBarSize={24}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={1000}
                      animationEasing="ease-out"
                    >
                      {stats.topProducts.slice(0, 10).map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`url(#topBarGrad-${index})`}
                          className="top-product-bar"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  <div className="text-center">
                    <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <p className="text-sm">No product data available</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Profit Report */}
          <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-in-out overflow-hidden lg:col-span-2">
            <div className="h-1 w-full bg-indigo-500" />
            <div className="p-5">
            {/* Header with date filter */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Profit Report</h3>
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                {profitDateLabel}
              </span>
            </div>

            {/* Date range presets & custom inputs */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    profitDateLabel === preset.label
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <div className="flex items-center gap-2 ml-1">
                <input
                  type="date"
                  value={profitStartDate}
                  onChange={(e) => {
                    setProfitStartDate(e.target.value);
                    setProfitDateLabel('Custom');
                  }}
                  className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-36"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={profitEndDate}
                  onChange={(e) => {
                    setProfitEndDate(e.target.value);
                    setProfitDateLabel('Custom');
                  }}
                  className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-36"
                />
              </div>
            </div>

            {profitData ? (
              <div className="space-y-6">
                {/* Profit summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="group bg-green-50 dark:bg-green-900/20 rounded-lg p-4 shadow-sm border border-green-200 dark:border-green-800/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-in-out">
                    <div className="h-0.5 w-full bg-green-500 rounded-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Revenue</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
                      {formatCurrency(profitData.totalRevenue)}
                    </p>
                  </div>
                  <div className="group bg-red-50 dark:bg-red-900/20 rounded-lg p-4 shadow-sm border border-red-200 dark:border-red-800/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-in-out">
                    <div className="h-0.5 w-full bg-red-500 rounded-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Cost of Goods</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">
                      {formatCurrency(profitData.totalCost)}
                    </p>
                  </div>
                  <div className="group bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 shadow-sm border border-blue-200 dark:border-blue-800/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-in-out">
                    <div className="h-0.5 w-full bg-blue-500 rounded-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Profit</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {formatCurrency(profitData.netProfit)}
                    </p>
                  </div>
                  <div className="group bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 shadow-sm border border-purple-200 dark:border-purple-800/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-in-out">
                    <div className="h-0.5 w-full bg-purple-500 rounded-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">% Profit</p>
                    <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-1">
                      {profitData.netMargin.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Profit waterfall bar chart */}
                {(() => {
                  const chartData = [
                    { name: 'Revenue', value: profitData.totalRevenue, fill: '#10b981' },
                    { name: 'Cost', value: -profitData.totalCost, fill: '#ef4444' },
                    { name: 'Discount', value: -profitData.totalDiscount, fill: '#8b5cf6' },
                    { name: 'Profit', value: profitData.netProfit, fill: '#3b82f6' },
                  ];
                  return (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={formatAxisCurrency} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" width={80} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const val = payload[0].value;
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                                  <p className="text-sm font-medium">{label}</p>
                                  <p className="text-sm" style={{ color: payload[0].color }}>
                                    {val >= 0 ? formatCurrency(val) : `(${formatCurrency(Math.abs(val))})`}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}

                {/* Additional profit details */}
                <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
                  <span>Transactions: {profitData.totalTransactions}</span>
                  <span>
                    Profit/Transaction: {formatCurrency(profitData.totalTransactions > 0 ? profitData.netProfit / profitData.totalTransactions : 0)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400">
                <p>Loading profit data...</p>
              </div>
            )}
          </div>
          </div>

          {/* Peak Hours Heatmap */}
          <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-in-out overflow-hidden lg:col-span-2">
            <div className="h-1 w-full bg-amber-500" />
            <div className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Peak Hours Heatmap (Last 7 Days)</h3>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Header - hours */}
                <div className="flex">
                  <div className="w-16 flex-shrink-0" />
                  {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="flex-1 text-center text-[10px] text-gray-400 dark:text-gray-500 font-medium leading-none pb-2">
                      {i % 3 === 0 ? (i === 0 ? '12AM' : i < 12 ? `${i}AM` : i === 12 ? '12PM' : `${i - 12}PM`) : ''}
                    </div>
                  ))}
                </div>
                {/* Rows - days */}
                {stats.peakHours.map((day) => {
                  const maxCount = Math.max(1, ...Object.values(day.hours));
                  return (
                    <div key={day.date} className="flex items-center mb-0.5">
                      <div className="w-16 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 font-medium pr-2 text-right">
                        {day.dayName}
                      </div>
                      {Array.from({ length: 24 }, (_, hour) => {
                        const count = day.hours[hour] || 0;
                        const intensity = count / maxCount;
                        // Color scale from cool blue (low) to warm red (high)
                        let bg;
                        if (count === 0) {
                          bg = 'bg-gray-50 dark:bg-gray-800';
                        } else if (intensity < 0.25) {
                          bg = 'bg-blue-100 dark:bg-blue-900/40';
                        } else if (intensity < 0.5) {
                          bg = 'bg-blue-300 dark:bg-blue-700/60';
                        } else if (intensity < 0.75) {
                          bg = 'bg-orange-300 dark:bg-orange-600/60';
                        } else {
                          bg = 'bg-red-400 dark:bg-red-500/70';
                        }
                        return (
                          <div
                            key={hour}
                            className={`flex-1 h-7 rounded-sm mx-px ${bg} flex items-center justify-center cursor-default transition-all duration-100 hover:scale-110 hover:ring-1 hover:ring-gray-400 dark:hover:ring-gray-500 group relative`}
                            title={`${day.dayName} ${hour}:00 - ${count} transaction${count !== 1 ? 's' : ''}`}
                          >
                            {count > 0 && (
                              <span className="text-[9px] font-medium text-gray-700 dark:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                                {count}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {/* Legend */}
                <div className="flex items-center justify-end gap-3 mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-400">Low</span>
                  <div className="w-4 h-4 rounded-sm bg-blue-100 dark:bg-blue-900/40" />
                  <div className="w-4 h-4 rounded-sm bg-blue-300 dark:bg-blue-700/60" />
                  <div className="w-4 h-4 rounded-sm bg-orange-300 dark:bg-orange-600/60" />
                  <div className="w-4 h-4 rounded-sm bg-red-400 dark:bg-red-500/70" />
                  <span className="text-xs text-gray-400">High</span>
                </div>
            </div>
          </div>
          </div>

          {/* Top Selling Products — Enhanced Table */}
          <div className="lg:col-span-2 mt-8">
            <TopProductsTable
              products={stats.topProducts}
              formatCurrency={formatCurrency}
              dateLabel={topProductsDateLabel}
              onDateChange={handleTopProductsDateChange}
            />
          </div>

        </div>
        </div>
      )}

      {/* Recent Transactions */}
      {stats?.recentTransactions?.length > 0 && (
        <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-in-out overflow-hidden">
          <div className="h-1 w-full bg-teal-500" />
          <div className="p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Recent Transactions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2">Receipt</th>
                  <th className="text-left py-3 px-2">Cashier</th>
                  <th className="text-left py-3 px-2">Payment</th>
                  <th className="text-right py-3 px-2">Total</th>
                  <th className="text-right py-3 px-2">Time</th>
                </tr>
              </thead>
              <tbody>          {stats.recentTransactions.map((t) => (
                    <tr
                      key={t.id}
                      className="group border-b border-gray-100 dark:border-gray-700/50 transition-all duration-200 ease-in-out hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      <td className="py-3 px-2 font-mono text-xs border-l-2 border-transparent group-hover:border-l-blue-500 transition-all duration-200">{t.receiptNumber}</td>
                      <td className="py-3 px-2">{t.cashier?.name}</td>
                      <td className="py-3 px-2 capitalize">{t.paymentMethod.replace('_', ' ')}</td>
                      <td className="py-3 px-2 text-right font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">{formatCurrency(t.total)}</td>
                      <td className="py-3 px-2 text-right text-gray-500">
                        {new Date(t.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* Category Breakdown Modal */}
      {showCategoryModal && stats?.categorySales && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCategoryModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Sales by Category</h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {stats.categorySales.map((entry, index) => {
                const total = stats.categorySales.reduce((s, e) => s + e.revenue, 0);
                const percent = total > 0 ? ((entry.revenue / total) * 100) : 0;
                return (
                  <div key={entry.name} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-semibold text-gray-900 dark:text-white">{entry.name}</span>
                      </div>
                      <span className="text-sm font-bold">{formatCurrency(entry.revenue)}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(percent, 100)}%`,
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-400">Share of total</span>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer total */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-gray-900 dark:text-white">Total Revenue</span>
              <span className="text-lg font-bold">
                {formatCurrency(stats.categorySales.reduce((s, e) => s + e.revenue, 0))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
