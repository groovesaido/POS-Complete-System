import { useState, useEffect } from 'react';
import { transactionsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTx, setSelectedTx] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const fetchTransactions = async () => {
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;
      const { data } = await transactionsAPI.getAll(params);
      setTransactions(data.transactions);
      setTotalPages(data.pagination.totalPages);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTransactions(); }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const handleRefund = async (tx) => {
    if (!window.confirm(`Refund transaction ${tx.receiptNumber}? This will restore inventory.`)) return;
    try {
      await transactionsAPI.refund(tx.id);
      toast.success('Transaction refunded');
      fetchTransactions();
      setSelectedTx(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to refund');
    }
  };

  const formatCurrency = (v) => `KSh ${Number(v || 0).toLocaleString()}`;

  const ReceiptModal = ({ tx, onClose }) => {
    if (!tx) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
          <div className="receipt text-center mb-4">
            <h2 className="text-lg font-bold">RECEIPT</h2>
            <p className="text-xs text-gray-500">{tx.receiptNumber}</p>
            <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}</p>
            <p className="text-xs text-gray-500">Cashier: {tx.cashier?.name}</p>
          </div>
          <hr className="border-dashed mb-2" />
          <table className="w-full text-sm receipt-table">
            <thead>
              <tr><th className="text-left">Item</th><th className="text-center">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {tx.items?.map((item) => (
                <tr key={item.id}>
                  <td>{item.productName}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="text-right">{formatCurrency(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr className="border-dashed my-2" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(tx.subtotal)}</span></div>
            {tx.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(tx.discount)}</span></div>}
            {tx.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(tx.tax)}</span></div>}
            <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(tx.total)}</span></div>
            <hr className="border-dashed my-1" />
            <div className="flex justify-between"><span>Paid ({tx.paymentMethod})</span><span>{formatCurrency(tx.amountPaid)}</span></div>
            {tx.change > 0 && <div className="flex justify-between"><span>Change</span><span>{formatCurrency(tx.change)}</span></div>}
          </div>
          <hr className="border-dashed my-2" />
          <p className="text-xs text-center text-gray-500 mt-2">Thank you for your purchase!</p>
          <div className="flex justify-center gap-3 mt-4">
            <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">🖨️ Print</button>
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Close</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transactions</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by receipt or invoice number..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </form>
        <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        <button onClick={() => { setPage(1); fetchTransactions(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Filter</button>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Receipt</th>
                <th className="text-left py-3 px-4 font-medium">Cashier</th>
                <th className="text-left py-3 px-4 font-medium">Payment</th>
                <th className="text-right py-3 px-4 font-medium">Items</th>
                <th className="text-right py-3 px-4 font-medium">Total</th>
                <th className="text-center py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Date</th>
                <th className="text-center py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">Loading...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">No transactions found</td></tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 px-4 font-mono text-xs">{tx.receiptNumber}</td>
                  <td className="py-3 px-4">{tx.cashier?.name}</td>
                  <td className="py-3 px-4 capitalize">{tx.paymentMethod.replace('_', ' ')}</td>
                  <td className="py-3 px-4 text-right">{tx.items?.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="py-3 px-4 text-right font-medium">{formatCurrency(tx.total)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      tx.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                    }`}>{tx.status}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => setSelectedTx(tx)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="View">👁️</button>
                      {user?.role === 'admin' && tx.status === 'completed' && (
                        <button onClick={() => handleRefund(tx)} className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded" title="Refund">↩️</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>

      {selectedTx && <ReceiptModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}
    </div>
  );
}
