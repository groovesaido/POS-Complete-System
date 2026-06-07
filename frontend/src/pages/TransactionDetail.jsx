import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { transactionsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const formatCurrency = (v) => `KSh ${Number(v || 0).toLocaleString()}`;

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const { data } = await transactionsAPI.getById(id);
        setTx(data);
      } catch (err) {
        toast.error('Failed to load transaction details');
        navigate('/transactions');
      } finally {
        setLoading(false);
      }
    };
    fetchTransaction();
  }, [id, navigate]);

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      pending_mpesa: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      refunded: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
      failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    };
    const labels = {
      completed: 'Completed',
      pending_mpesa: 'Pending M-Pesa',
      refunded: 'Refunded',
      failed: 'Failed',
    };
    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading transaction details...</div>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Transaction not found</div>
      </div>
    );
  }

  const handleRefund = async () => {
    if (!window.confirm(`Refund transaction ${tx.receiptNumber}?\n\nThis will restore inventory for all ${tx.items?.length || 0} items. This action cannot be undone.`)) return;
    try {
      await transactionsAPI.refund(tx.id);
      toast.success('Transaction refunded successfully');
      // Update local state to reflect the refund
      setTx(prev => ({ ...prev, status: 'refunded' }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to refund transaction');
    }
  };

  const handlePrint = () => {
    try {
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print the receipt');
        return;
      }

      printWindow.document.write(`
      <html>
      <head>
        <title>Receipt - ${tx.receiptNumber}</title>
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            width: 300px;
            margin: 20px auto;
            padding: 0 16px;
            color: #333;
          }
          .header { text-align: center; margin-bottom: 12px; }
          .header h2 { margin: 0; font-size: 16px; font-weight: bold; }
          .header p { margin: 2px 0; font-size: 11px; color: #666; }
          .divider { border: none; border-top: 1px dashed #999; margin: 10px 0; }
          .receipt-info { text-align: center; font-size: 11px; margin-bottom: 8px; }
          .receipt-info p { margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { text-align: left; padding: 4px 2px; border-bottom: 1px dashed #999; }
          th.right, td.right { text-align: right; }
          th.center, td.center { text-align: center; }
          td { padding: 4px 2px; vertical-align: top; }
          .totals { margin-top: 4px; }
          .totals .row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; }
          .totals .row.bold { font-weight: bold; font-size: 14px; border-top: 1px dashed #999; padding-top: 4px; margin-top: 4px; }
          .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #888; }
          .payment-breakdown { margin-top: 6px; padding-top: 4px; border-top: 1px dashed #999; }
          @media print {
            body { margin: 0; width: auto; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>RECEIPT</h2>
        </div>
        <div class="receipt-info">
          <p><strong>${tx.receiptNumber}</strong></p>
          <p>Invoice: ${tx.invoiceNumber}</p>
          <p>${new Date(tx.createdAt).toLocaleString()}</p>
          <p>Cashier: ${tx.cashier?.name || 'N/A'}</p>
          <p>Status: ${tx.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
        </div>
        <hr class="divider" />
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="center">Qty</th>
              <th class="right">Price</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${tx.items?.map(item => `
              <tr>
                <td>${item.productName}</td>
                <td class="center">${item.quantity}</td>
                <td class="right">${formatCurrency(item.unitPrice)}</td>
                <td class="right">${formatCurrency(item.totalPrice)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <hr class="divider" />
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>${formatCurrency(tx.subtotal)}</span></div>
          ${tx.discount > 0 ? `<div class="row"><span>Discount</span><span style="color:#dc2626;">-${formatCurrency(tx.discount)}</span></div>` : ''}
          ${tx.tax > 0 ? `<div class="row"><span>Tax</span><span>${formatCurrency(tx.tax)}</span></div>` : ''}
          <div class="row bold"><span>Total</span><span>${formatCurrency(tx.total)}</span></div>
          <hr class="divider" />
          <div class="row"><span>Paid (${tx.paymentMethod.replace('_', ' ')})</span><span>${formatCurrency(tx.amountPaid)}</span></div>
          ${tx.change > 0 ? `<div class="row"><span>Change</span><span style="color:#16a34a;">${formatCurrency(tx.change)}</span></div>` : ''}
          ${tx.mpesaReceiptCode ? `<div class="row"><span>M-Pesa Code</span><span style="font-size:11px;">${tx.mpesaReceiptCode}</span></div>` : ''}
          ${tx.mpesaPhone ? `<div class="row"><span>M-Pesa Phone</span><span>${tx.mpesaPhone}</span></div>` : ''}
        </div>
        <hr class="divider" />
        <div class="footer">
          <p>Thank you for your purchase!</p>
          <p style="font-size:10px; margin-top:4px;">Transaction Detail · ${tx.receiptNumber}</p>
        </div>
        <div style="text-align:center; margin-top:16px;">
          <button onclick="window.print()" style="padding:8px 24px; font-size:14px; cursor:pointer; border:1px solid #ccc; border-radius:6px; background:#2563eb; color:#fff;">🖨️ Print</button>
          <button onclick="window.close()" style="padding:8px 24px; font-size:14px; cursor:pointer; border:1px solid #ccc; border-radius:6px; margin-left:8px;">Close</button>
        </div>
        <script>
          (function() {
            var autoPrintTimer = setTimeout(function() { window.print(); }, 500);
            var closeTimer = null;
            window.onafterprint = function() {
              if (closeTimer) clearTimeout(closeTimer);
              if (autoPrintTimer) clearTimeout(autoPrintTimer);
              closeTimer = setTimeout(function() { window.close(); }, 500);
            };
            // Fallback: auto-close after 2 minutes if user just reads the receipt
            setTimeout(function() {
              if (autoPrintTimer) clearTimeout(autoPrintTimer);
            }, 120000);
          })();
        </script>
      </body>
      </html>
    `);
      printWindow.document.close();
    } catch {
      toast.error('Failed to open print window. Please allow pop-ups.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/transactions')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Back to Transactions"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold">Transaction Details</h1>
            <p className="text-sm text-gray-500">{tx.receiptNumber}</p>
          </div>
        </div>
        {getStatusBadge(tx.status)}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Receipt</p>
          <p className="text-sm font-mono font-bold mt-1">{tx.receiptNumber}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice</p>
          <p className="text-sm font-mono font-bold mt-1">{tx.invoiceNumber}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
          <p className="text-sm font-bold mt-1">{new Date(tx.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Time</p>
          <p className="text-sm font-bold mt-1">{new Date(tx.createdAt).toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Payment & Cashier Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Payment Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span>💳</span> Payment Details
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(tx.subtotal)}</span>
            </div>
            {tx.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="font-medium text-red-500">-{formatCurrency(tx.discount)}</span>
              </div>
            )}
            {tx.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax</span>
                <span className="font-medium">{formatCurrency(tx.tax)}</span>
              </div>
            )}
            <hr className="border-gray-200 dark:border-gray-700" />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>{formatCurrency(tx.total)}</span>
            </div>
            <hr className="border-gray-200 dark:border-gray-700" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Payment Method</span>
              <span className="font-medium capitalize">{tx.paymentMethod.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Amount Paid</span>
              <span className="font-medium">{formatCurrency(tx.amountPaid)}</span>
            </div>
            {tx.change > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Change</span>
                <span className="font-medium text-green-600">{formatCurrency(tx.change)}</span>
              </div>
            )}
            {tx.mpesaReceiptCode && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">M-Pesa Code</span>
                <span className="font-mono text-xs text-green-600 dark:text-green-400">{tx.mpesaReceiptCode}</span>
              </div>
            )}
            {tx.mpesaPhone && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">M-Pesa Phone</span>
                <span className="font-medium">{tx.mpesaPhone}</span>
              </div>
            )}
            {tx.notes && (
              <div className="pt-2">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">{tx.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Cashier Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span>👤</span> Cashier Information
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Name</span>
              <span className="font-medium">{tx.cashier?.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Username</span>
              <span className="font-medium">{tx.cashier?.username || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span>{getStatusBadge(tx.status)}</span>
            </div>
          </div>

          {/* Summary Stats */}
          <h3 className="font-semibold mt-6 mb-3 flex items-center gap-2">
            <span>📊</span> Summary
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Items</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{tx.items?.length || 0}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Total Qty</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {tx.items?.reduce((s, i) => s + i.quantity, 0) || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold flex items-center gap-2">
            <span>🛒</span> Items ({tx.items?.length || 0})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left py-3 px-4 font-medium">#</th>
                <th className="text-left py-3 px-4 font-medium">Product</th>
                <th className="text-center py-3 px-4 font-medium">Quantity</th>
                <th className="text-right py-3 px-4 font-medium">Unit Price</th>
                <th className="text-right py-3 px-4 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {tx.items?.map((item, index) => (
                <tr key={item.id} className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                  <td className="py-3 px-4 font-medium">{item.productName}</td>
                  <td className="py-3 px-4 text-center">{item.quantity}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-3 px-4 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-700/30">
              <tr>
                <td colSpan={4} className="py-3 px-4 text-right font-semibold">Total</td>
                <td className="py-3 px-4 text-right font-bold">{formatCurrency(tx.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/transactions')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Transactions
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 18v4h12v-4M8 14h8" />
            </svg>
            🖨️ Print Receipt
          </button>
        </div>
        {user?.role === 'admin' && tx.status === 'completed' && (
          <button
            onClick={handleRefund}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            ↩️ Refund Transaction
          </button>
        )}
      </div>
    </div>
  );
}
