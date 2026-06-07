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

const FILTER_OPTIONS = [
  { value: 'daily-sales', label: 'Daily', sublabel: 'Sales', icon: '📅' },
  { value: 'daily-hours', label: 'Daily', sublabel: 'Hours', icon: '🕐' },
  { value: 'weekly', label: 'Weekly', sublabel: 'Day of Week', icon: '📆' },
  { value: 'monthly', label: 'Monthly', sublabel: 'Week 1-4', icon: '📊' },
  { value: 'yearly', label: 'Yearly', sublabel: 'By Month', icon: '📈' },
];

const SummaryCard = ({ title, value, icon, color, loading }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold mt-1">{value}</p>
        )}
      </div>
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${color}`}>
        {icon}
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
      fetchStats();
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
  };

  const formatCurrency = (value) => {
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
          <div className="text-6xl mb-4">👋</div>
          <h2 className="text-2xl font-bold mb-2">Welcome, {user.name}!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You're logged in as a Cashier. Head to the POS to start serving customers.
          </p>
          <Link
            to="/pos"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            💳 Open POS
          </Link>
        </div>
      </div>
    );
  }

  const statsList = [
    { title: "Today's Sales", value: formatCurrency(stats?.summary?.todaySales), icon: '💰', color: 'bg-green-100 dark:bg-green-900/30' },
    { title: 'Weekly Sales', value: formatCurrency(stats?.summary?.weekSales), icon: '📈', color: 'bg-blue-100 dark:bg-blue-900/30' },
    { title: 'Monthly Sales', value: formatCurrency(stats?.summary?.monthSales), icon: '📊', color: 'bg-purple-100 dark:bg-purple-900/30' },
    { title: 'Total Revenue', value: formatCurrency(stats?.summary?.totalRevenue), icon: '🏆', color: 'bg-yellow-100 dark:bg-yellow-900/30' },
    { title: 'Total Products', value: stats?.summary?.totalProducts?.toLocaleString(), icon: '📦', color: 'bg-indigo-100 dark:bg-indigo-900/30' },
    { title: 'Transactions', value: stats?.summary?.totalTransactions?.toLocaleString(), icon: '🧾', color: 'bg-teal-100 dark:bg-teal-900/30' },
    { title: 'Active Cashiers', value: stats?.summary?.totalCashiers, icon: '👥', color: 'bg-pink-100 dark:bg-pink-900/30' },
    { title: 'Low Stock Items', value: stats?.summary?.lowStockProducts, icon: '⚠️', color: 'bg-red-100 dark:bg-red-900/30' },
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
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center flex-wrap gap-3">
            <h3 className="font-semibold text-sm">Chart Filters</h3>
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
              <button
                onClick={() => fetchStats()}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {!loading && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Filterable Sales Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-2">
            {/* Filter Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">
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
                          <span className="text-lg">{opt.icon}</span>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
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
                />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Sales" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Sales Pie */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-4">Sales by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.categorySales}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {stats.categorySales.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Selling Products */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-4">Top Selling Products</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.topProducts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="quantity" fill="#10b981" name="Quantity" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Profit Report */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            {/* Header with date filter */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Profit Report</h3>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(profitData.totalRevenue)}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Cost of Goods</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(profitData.totalCost)}
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Profit</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(profitData.netProfit)}
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">% Profit</p>
                    <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
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
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={(v) => `KSh ${(v / 1000).toFixed(0)}k`} />
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

          {/* Peak Hours Heatmap */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-2">
            <h3 className="font-semibold mb-4">Peak Hours Heatmap (Last 7 Days)</h3>
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
        </div>
      )}

      {/* Recent Transactions */}
      {stats?.recentTransactions?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold mb-4">Recent Transactions</h3>
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
              <tbody>
                {stats.recentTransactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-2 font-mono text-xs">{t.receiptNumber}</td>
                    <td className="py-3 px-2">{t.cashier?.name}</td>
                    <td className="py-3 px-2 capitalize">{t.paymentMethod.replace('_', ' ')}</td>
                    <td className="py-3 px-2 text-right font-medium">{formatCurrency(t.total)}</td>
                    <td className="py-3 px-2 text-right text-gray-500">
                      {new Date(t.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
