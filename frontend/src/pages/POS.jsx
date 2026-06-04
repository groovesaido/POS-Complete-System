import { useState, useEffect, useRef } from 'react';
import { productsAPI, categoriesAPI, transactionsAPI, settingsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function POS() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedCat, setSelectedCat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(null);
  const [settings, setSettings] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [discount, setDiscount] = useState(0);
  const searchRef = useRef(null);

  useEffect(() => {
    loadProducts();
    categoriesAPI.getAll().then(({ data }) => setCategories(data)).catch(() => {});
    settingsAPI.getAll().then(({ data }) => setSettings(data)).catch(() => {});
    // Focus search on mount
    searchRef.current?.focus();
  }, [categoryFilter]);

  const loadProducts = async () => {
    try {
      const params = { limit: 100 };
      if (categoryFilter) params.categoryId = categoryFilter;
      const { data } = await productsAPI.getAll(params);
      setProducts(data.products.filter(p => p.quantity > 0));
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadProducts();
  };

  // Barcode scanner support - listens for rapid Enter keypresses
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && search.length > 3) {
        const product = products.find(p => p.barcode === search || p.sku === search);
        if (product) {
          addToCart(product);
          setSearch('');
        } else {
          loadProducts();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [search, products]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast.error(`Only ${product.quantity} available`);
          return prev;
        }
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        unitPrice: product.sellingPrice,
        quantity: 1,
        totalPrice: product.sellingPrice,
        stock: product.quantity,
      }];
    });
    toast.success(`${product.name} added`);
  };

  const updateQuantity = (productId, qty) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        if (qty > item.stock) {
          toast.error(`Only ${item.stock} available`);
          return item;
        }
        return { ...item, quantity: qty, totalPrice: qty * item.unitPrice };
      }
      return item;
    }));
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    toast.success('Cart cleared');
  };

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount = discount > 0 ? (subtotal * discount) / 100 : 0;
  const tax = (subtotal - discountAmount) * 0.16; // 16% VAT
  const total = subtotal - discountAmount + tax;
  const change = Math.max(0, parseFloat(amountPaid || 0) - total);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (paymentMethod === 'cash' && parseFloat(amountPaid || 0) < total) {
      toast.error('Insufficient payment');
      return;
    }

    setCheckoutLoading(true);
    try {
      const { data } = await transactionsAPI.create({
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        payments: [{ method: paymentMethod, amount: parseFloat(amountPaid || total) }],
        discount: discountAmount,
        tax,
        notes: '',
      });
      setShowReceipt(data);
      setCart([]);
      setAmountPaid('');
      setDiscount(0);
      setShowCheckout(false);
      loadProducts();
      toast.success('Sale completed!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Checkout failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const Receipt = ({ tx, onClose }) => {
    const printReceipt = () => window.print();
    const formatCurrency = (v) => `KSh ${Number(v || 0).toLocaleString()}`;

    return (
      <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl receipt" onClick={e => e.stopPropagation()}>
          <div className="text-center mb-4">
            <h2 className="font-bold text-lg">{settings.store_name || 'My Store'}</h2>
            <p className="text-xs text-gray-500">{settings.store_address || ''}</p>
            <p className="text-xs text-gray-500">Tel: {settings.store_phone || ''}</p>
            <hr className="border-dashed my-2" />
            <p className="text-xs">Receipt: {tx.receiptNumber}</p>
            <p className="text-xs">Invoice: {tx.invoiceNumber}</p>
            <p className="text-xs">{new Date(tx.createdAt).toLocaleString()}</p>
            <p className="text-xs">Cashier: {tx.cashier?.name}</p>
          </div>
          <hr className="border-dashed" />
          <table className="w-full text-xs receipt-table mt-2">
            <thead><tr><th className="text-left">Item</th><th className="text-center">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {tx.items?.map((item, i) => (
                <tr key={i}>
                  <td className="py-1">{item.productName}</td>
                  <td className="py-1 text-center">{item.quantity}</td>
                  <td className="py-1 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-1 text-right">{formatCurrency(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr className="border-dashed my-2" />
          <div className="text-xs space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(tx.subtotal)}</span></div>
            {tx.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(tx.discount)}</span></div>}
            <div className="flex justify-between"><span>Tax (16%)</span><span>{formatCurrency(tx.tax)}</span></div>
            <div className="flex justify-between font-bold text-sm"><span>Total</span><span>{formatCurrency(tx.total)}</span></div>
            <hr className="border-dashed my-1" />
            <div className="flex justify-between"><span>Paid ({tx.paymentMethod})</span><span>{formatCurrency(tx.amountPaid)}</span></div>
            {tx.change > 0 && <div className="flex justify-between"><span>Change</span><span>{formatCurrency(tx.change)}</span></div>}
          </div>
          <hr className="border-dashed my-2" />
          <p className="text-xs text-center text-gray-500">Thank you for your purchase!</p>
          <div className="flex justify-center gap-3 mt-3 no-print">
            <button onClick={printReceipt} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">🖨️ Print</button>
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">Close</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Products Section */}
      <div className="flex-1 flex flex-col">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <form onSubmit={handleSearch} className="flex-1">
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search products or scan barcode..."
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-lg" />
          </form>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          <button onClick={() => setCategoryFilter('')}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${!categoryFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            All
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setCategoryFilter(cat.id.toString())}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${categoryFilter === cat.id.toString() ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {loading ? (
              <div className="col-span-full text-center py-12 text-gray-500">Loading products...</div>
            ) : products.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">No products available</div>
            ) : products.map(product => (
              <button key={product.id} onClick={() => addToCart(product)}
                className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all text-left group">
                <div className="w-full h-20 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-700 dark:to-gray-600 rounded-lg mb-2 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                  📦
                </div>
                <p className="font-medium text-sm truncate">{product.name}</p>
                <p className="text-blue-600 dark:text-blue-400 font-bold">KSh {product.sellingPrice.toLocaleString()}</p>
                <p className={`text-xs ${product.quantity <= product.reorderLevel ? 'text-red-500' : 'text-gray-400'}`}>
                  Stock: {product.quantity}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-full lg:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">🛒 Cart</h2>
            <p className="text-sm text-gray-500">{cart.length} items</p>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-600">Clear All</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🛒</p>
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Click products to add</p>
            </div>
          ) : cart.map(item => (
            <div key={item.productId} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-gray-500">KSh {item.unitPrice.toLocaleString()} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 font-bold text-sm">-</button>
                <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 font-bold text-sm">+</button>
              </div>
              <p className="font-medium text-sm w-20 text-right">KSh {item.totalPrice.toLocaleString()}</p>
              <button onClick={() => removeFromCart(item.productId)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
            </div>
          ))}
        </div>

        {/* Cart Totals */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>KSh {subtotal.toLocaleString()}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span>Discount (%)</span>
              <input type="number" value={discount} onChange={e => setDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="w-20 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm" />
            </div>
            {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-KSh {discountAmount.toLocaleString()}</span></div>}
            <div className="flex justify-between"><span>Tax (16%)</span><span>KSh {tax.toLocaleString()}</span></div>
            <div className="flex justify-between font-bold text-lg pt-1 border-t border-gray-200 dark:border-gray-700">
              <span>Total</span><span className="text-blue-600 dark:text-blue-400">KSh {total.toLocaleString()}</span>
            </div>
          </div>

          <button onClick={() => setShowCheckout(true)} disabled={cart.length === 0}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-colors text-lg">
            💳 Checkout (KSh {total.toLocaleString()})
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setShowCheckout(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Checkout</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>KSh {subtotal.toLocaleString()}</span></div>
                {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-KSh {discountAmount.toLocaleString()}</span></div>}
                <div className="flex justify-between"><span>Tax (16%)</span><span>KSh {tax.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>Total</span><span>KSh {total.toLocaleString()}</span></div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'cash', label: '💵 Cash' },
                    { value: 'mpesa', label: '📱 M-Pesa' },
                    { value: 'debit_card', label: '💳 Debit Card' },
                    { value: 'credit_card', label: '💳 Credit Card' },
                  ].map(pm => (
                    <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                      className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                        paymentMethod === pm.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}>
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'cash' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Amount Paid</label>
                  <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter amount" autoFocus />
                  {parseFloat(amountPaid || 0) >= total && (
                    <p className="text-sm text-green-600 mt-1">Change: KSh {change.toLocaleString()}</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCheckout(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button onClick={handleCheckout} disabled={checkoutLoading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                  {checkoutLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> : '✅'}
                  {checkoutLoading ? 'Processing...' : 'Complete Sale'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && <Receipt tx={showReceipt} onClose={() => setShowReceipt(null)} />}
    </div>
  );
}
