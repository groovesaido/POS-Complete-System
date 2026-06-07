import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { transactionsAPI, mpesaAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const formatCurrency = (v) => `KSh ${Number(v || 0).toLocaleString()}`;

function ReceiptModal({ tx, onClose, onAction }) {
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
          {tx.mpesaReceiptCode && (
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>M-Pesa Code</span>
              <span className="font-mono text-xs">{tx.mpesaReceiptCode}</span>
            </div>
          )}
        </div>
        <hr className="border-dashed my-2" />
        <p className="text-xs text-center text-gray-500 mt-2">Thank you for your purchase!</p>
        <div className="flex justify-center gap-3 mt-4">
          {onAction && tx.status === 'pending_mpesa' && (
            <>
              <button onClick={() => onAction('retry', tx)}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                📱 Retry M-Pesa
              </button>
              <button onClick={() => onAction('complete_cash', tx)}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                💵 Complete as Cash
              </button>
              <button onClick={() => onAction('cancel', tx)}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                ✕ Cancel
              </button>
            </>
          )}
          <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">🖨️ Print</button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

function CompleteModal({ tx, onClose, onComplete }) {
  const [amountPaid, setAmountPaid] = useState(tx.total.toString());
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);

  if (!tx) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onComplete(tx.id, { amountPaid: parseFloat(amountPaid) || tx.total, paymentMethod });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-3">Complete Pending Transaction</h3>
        <p className="text-sm text-gray-500 mb-4">
          Receipt: {tx.receiptNumber}<br />
          Total: {formatCurrency(tx.total)}<br />
          Items: {tx.items?.length} products
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Complete As</label>
            <div className="grid grid-cols-2 gap-2">
              {['cash', 'debit_card', 'credit_card'].map(m => (
                <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                  className={`p-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    paymentMethod === m
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}>
                  {m === 'cash' ? '💵 Cash' : m === 'debit_card' ? '💳 Debit' : '💳 Credit'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount Paid</label>
            <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              autoFocus />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={submitting || parseFloat(amountPaid) < tx.total}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {submitting ? 'Completing...' : '✅ Complete Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RetryMpesaModal({ tx, onClose, onRetry }) {
  const [phone, setPhone] = useState(tx.mpesaPhone || '');
  const [submitting, setSubmitting] = useState(false);

  if (!tx) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleaned = phone.replace(/[\s\-]/g, '');
    if (!/^(\+?254|0)[17]\d{8}$/.test(cleaned)) {
      toast.error('Please enter a valid Kenyan phone number');
      return;
    }
    setSubmitting(true);
    await onRetry(tx, cleaned);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-3">📱 Retry M-Pesa Payment</h3>
        <p className="text-sm text-gray-500 mb-3">
          Receipt: {tx.receiptNumber}<br />
          Amount: {formatCurrency(tx.total)}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Customer Phone Number</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="0712 345 678"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
              autoFocus />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {submitting ? (
                <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> Sending...</>
              ) : (
                '📱 Send M-Pesa Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Transactions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTx, setSelectedTx] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState('');

  // Barcode scanner support — uses a ref buffer to detect rapid scanner keystrokes
  const scanBufferRef = useRef('');
  const scanTimeoutRef = useRef(null);
  const searchRef = useRef(null);
  const flashTimeoutRef = useRef(null);
  const [scanFlash, setScanFlash] = useState(false);  // green flash on successful scan

  // Modals for pending management
  const [completeModalTx, setCompleteModalTx] = useState(null);
  const [retryModalTx, setRetryModalTx] = useState(null);

  const statusTabs = [
    { id: '', label: 'All', color: 'gray' },
    { id: 'completed', label: '✅ Completed', color: 'green' },
    { id: 'pending_mpesa', label: '⏳ Pending M-Pesa', color: 'yellow' },
    { id: 'refunded', label: '↩️ Refunded', color: 'orange' },
    { id: 'failed', label: '❌ Failed', color: 'red' },
  ];

  const fetchTransactions = async () => {
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;
      if (statusFilter) params.status = statusFilter;
      const { data } = await transactionsAPI.getAll(params);
      setTransactions(data.transactions);
      setTotalPages(data.pagination.totalPages);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTransactions(); }, [page, statusFilter]);

  // Barcode scanner support — detects rapid keystrokes + Enter from scanner
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && scanBufferRef.current.length > 3) {
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }
        const scanned = scanBufferRef.current;
        scanBufferRef.current = '';
        // Flash search input green to confirm scan
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        setScanFlash(true);
        flashTimeoutRef.current = setTimeout(() => setScanFlash(false), 600);
        setSearch(scanned);
        setPage(1);
        // Trigger search immediately with the scanned code
        transactionsAPI.getAll({
          page: 1, limit: 20, search: scanned,
          ...(dateRange.start ? { startDate: dateRange.start } : {}),
          ...(dateRange.end ? { endDate: dateRange.end } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        }).then(({ data }) => {
          setTransactions(data.transactions);
          setTotalPages(data.pagination.totalPages);
        }).catch(() => {});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, [dateRange, statusFilter]);

  // Sync search input with scan buffer, auto-reset buffer after 1s without Enter
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    scanBufferRef.current = value;
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      scanBufferRef.current = '';
    }, 1000);
  };

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

  // Complete a pending M-Pesa transaction as cash/card
  const handleCompletePending = async (txId, data) => {
    try {
      await transactionsAPI.completePending(txId, data);
      toast.success('Transaction completed successfully!');
      setCompleteModalTx(null);
      setSelectedTx(null);
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to complete transaction');
    }
  };

  // Retry M-Pesa STK push for pending transaction
  const handleRetryMpesa = async (tx, phoneNumber) => {
    try {
      const { data } = await mpesaAPI.retry(tx.id, { phoneNumber });
      if (data.success) {
        toast.success('M-Pesa request sent! Check customer phone.');
        setRetryModalTx(null);
        setSelectedTx(null);
        fetchTransactions();
      } else {
        toast.error(data.responseDescription || 'M-Pesa retry failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to retry M-Pesa');
    }
  };

  // Cancel/void a pending transaction
  const handleCancelPending = async (tx) => {
    if (!window.confirm(`Cancel pending transaction ${tx.receiptNumber}? Items will NOT be restored (they were never deducted).`)) return;
    try {
      await mpesaAPI.cancelPending(tx.id);
      toast.success('Transaction cancelled');
      setSelectedTx(null);
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel');
    }
  };

  // Handle action from receipt modal
  const handleReceiptAction = (action, tx) => {
    setSelectedTx(null);
    if (action === 'retry') {
      setRetryModalTx(tx);
    } else if (action === 'complete_cash') {
      setCompleteModalTx(tx);
    } else if (action === 'cancel') {
      handleCancelPending(tx);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-green-100 dark:bg-green-900/30 text-green-600',
      pending_mpesa: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600',
      refunded: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600',
      failed: 'bg-red-100 dark:bg-red-900/30 text-red-600',
    };
    const labels = {
      completed: 'Completed',
      pending_mpesa: '⏳ Pending',
      refunded: 'Refunded',
      failed: 'Failed',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${styles[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transactions</h1>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
        {statusTabs.map((tab) => (
          <button key={tab.id} onClick={() => { setStatusFilter(tab.id); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-t-lg transition-colors ${
              statusFilter === tab.id
                ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-b-white dark:border-b-gray-800 -mb-px font-medium'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}>
            {tab.label}
            {tab.id === 'pending_mpesa' && transactions.some(t => t.status === 'pending_mpesa') && statusFilter !== 'pending_mpesa' && (
              <span className="ml-1.5 inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1">
          <input ref={searchRef} type="text" value={search} onChange={handleSearchChange}
            placeholder="🔍 Search by receipt, invoice, or scan barcode..."
            className={`w-full px-4 py-2 border rounded-lg text-gray-900 dark:text-white outline-none transition-all duration-300 ${
              scanFlash
                ? 'border-green-500 dark:border-green-400 ring-4 ring-green-300 dark:ring-green-600/50 bg-green-50 dark:bg-green-900/30'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500'
            }`} />
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
                <tr key={tx.id} onClick={() => navigate(`/transactions/${tx.id}`)} className={`border-t border-gray-100 dark:border-gray-700/50 hover:bg-blue-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                  tx.status === 'pending_mpesa' ? 'bg-yellow-50/50 dark:bg-yellow-900/5' : ''
                }`}>
                  <td className="py-3 px-4 font-mono text-xs">{tx.receiptNumber}</td>
                  <td className="py-3 px-4">{tx.cashier?.name}</td>
                  <td className="py-3 px-4 capitalize">{tx.paymentMethod.replace('_', ' ')}</td>
                  <td className="py-3 px-4 text-right">{tx.items?.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="py-3 px-4 text-right font-medium">{formatCurrency(tx.total)}</td>
                  <td className="py-3 px-4 text-center">{getStatusBadge(tx.status)}</td>
                  <td className="py-3 px-4 text-right text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedTx(tx); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="View">👁️</button>
                      {tx.status === 'pending_mpesa' && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); setRetryModalTx(tx); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Retry M-Pesa">📱</button>
                          <button onClick={(e) => { e.stopPropagation(); setCompleteModalTx(tx); }} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded" title="Complete as Cash/Card">💵</button>
                          <button onClick={(e) => { e.stopPropagation(); handleCancelPending(tx); }} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Cancel/Void">✕</button>
                        </>
                      )}
                      {user?.role === 'admin' && tx.status === 'completed' && (
                        <button onClick={(e) => { e.stopPropagation(); handleRefund(tx); }} className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded" title="Refund">↩️</button>
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

      {selectedTx && <ReceiptModal tx={selectedTx} onClose={() => setSelectedTx(null)} onAction={handleReceiptAction} />}
      {completeModalTx && <CompleteModal tx={completeModalTx} onClose={() => setCompleteModalTx(null)} onComplete={handleCompletePending} />}
      {retryModalTx && <RetryMpesaModal tx={retryModalTx} onClose={() => setRetryModalTx(null)} onRetry={handleRetryMpesa} />}
    </div>
  );
}
