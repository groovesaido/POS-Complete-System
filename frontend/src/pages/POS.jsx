import { useState, useEffect, useRef } from "react";
import {
  productsAPI,
  categoriesAPI,
  transactionsAPI,
  settingsAPI,
  mpesaAPI,
  getUploadUrl,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import useMobileScanner from "../hooks/useMobileScanner";
import { playCheckoutSound } from "../utils/sound";
import toast from "react-hot-toast";

export default function POS() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(null);
  const [settings, setSettings] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [discount, setDiscount] = useState(0);

  // Retail / Wholesale pricing toggle
  const [pricingType, setPricingType] = useState("retail");
  const soundEnabled = settings.sound_enabled !== "false";

  // M-Pesa flow state
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaAmount, setMpesaAmount] = useState("");
  const [mpesaCheckoutId, setMpesaCheckoutId] = useState(null);
  const [mpesaStatus, setMpesaStatus] = useState("idle"); // idle, sending, waiting, completed, failed
  const [mpesaError, setMpesaError] = useState("");
  const [mpesaProcessing, setMpesaProcessing] = useState(false);
  const pollingRef = useRef(null);
  const [mpesaTxId, setMpesaTxId] = useState(null); // track pending transaction ID for cleanup
  const mpesaTxIdRef = useRef(null); // sync ref for use inside interval closures

  // Keep mpesaTxIdRef in sync with mpesaTxId state
  useEffect(() => {
    mpesaTxIdRef.current = mpesaTxId;
  }, [mpesaTxId]);

  // Mobile scanner app integration — shared hook handles polling
  const {
    mobileScans,
    showMobileScans,
    setShowMobileScans,
    newScanAlert,
    setMobileScans,
  } = useMobileScanner({
    onScans: (scans) => handleMobileScans(scans),
    soundEnabled,
  });

  /** Process mobile scanner scans based on where the cursor is. */
  const handleMobileScans = (scans) => {
    const searchHasFocus = document.activeElement === searchRef.current;
    const unhandled = [];

    for (const scan of scans) {
      const barcode = scan.barcode || "";
      if (searchHasFocus && barcode.length > 0) {
        // Set barcode in search bar (like hardware scanner does)
        setSearch(barcode);
        scanBufferRef.current = barcode;

        // Flash search input green to confirm scan (whether matched or not)
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        setScanFlash(true);
        flashTimeoutRef.current = setTimeout(() => setScanFlash(false), 600);
        // Leave the scanned code in the search bar so the user can review or search manually
        // (no longer auto-adds to cart)
      } else {
        unhandled.push(scan);
      }
    }
    return unhandled;
  };

  const handleMobileScanAdd = (scan) => {
    if (scan.product) {
      addToCart(scan.product);
      toast.success(`📱 Scanned: ${scan.product.name}`);
    } else {
      toast.error(`Barcode ${scan.barcode} not found in system`);
    }
  };

  const searchRef = useRef(null);
  const productsRef = useRef(products); // always holds latest products (avoids stale closure in pollScans)
  useEffect(() => {
    productsRef.current = products;
  }, [products]);
  const scanBufferRef = useRef(""); // ref-based buffer for barcode scanner (avoids React state timing issues)
  const scanTimeoutRef = useRef(null); // resets buffer if scanner pauses mid-scan
  const flashTimeoutRef = useRef(null); // timeout ref for scan flash animation
  const [scanFlash, setScanFlash] = useState(false); // green flash on successful scan

  const taxRate = parseFloat(settings.tax_rate) || 0;

  // Client-side search filter: filter products as user types
  const filteredProducts = search.trim()
    ? products.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
        );
      })
    : products;

  useEffect(() => {
    loadProducts();
    categoriesAPI
      .getAll()
      .then(({ data }) => setCategories(data))
      .catch(() => {});
    settingsAPI
      .getAll()
      .then(({ data }) => setSettings(data))
      .catch(() => {});
    searchRef.current?.focus();
  }, [categoryFilter]);

  const loadProducts = async () => {
    try {
      const params = { limit: 100 };
      if (categoryFilter) params.categoryId = categoryFilter;
      const { data } = await productsAPI.getAll(params);
      setProducts(data.products.filter((p) => p.quantity > 0));
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadProducts();
  };

  // Barcode scanner support
  // Uses a ref buffer (scanBufferRef) instead of React state to avoid timing race conditions.
  // The onChange handler on the input keeps both state and ref in sync.
  // On Enter, we read from the ref (always current) to find the product by barcode/SKU.
  useEffect(() => {
    const handleKeyDown = (e) => {
      // A scanner sends characters followed by Enter very rapidly.
      // If the buffer is too short (< 3 chars) it's likely a manual search, not a scan.
      if (e.key === "Enter" && scanBufferRef.current.length > 3) {
        e.preventDefault(); // prevent form submit from triggering loadProducts()
        // Clear any pending auto-reset timer
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }

        const scanned = scanBufferRef.current;
        const product = products.find(
          (p) => p.barcode === scanned || p.sku === scanned,
        );

        // Flash search input green to confirm scan
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        setScanFlash(true);
        flashTimeoutRef.current = setTimeout(() => setScanFlash(false), 600);

        if (product) {
          if (product.quantity > 0) {
            addToCart(product);
          } else {
            toast.error(`${product.name} is out of stock`);
          }
        } else {
          toast.error(`No product found for barcode/SKU: ${scanned}`);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, [products]); // only depends on products — not `search`, to avoid constant re-attachment

  // Auto-reset the scan buffer if characters arrive but no Enter follows within 1 second.
  // This prevents partial scans from accumulating when a human types in the search box.
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    scanBufferRef.current = value;

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      scanBufferRef.current = "";
    }, 1000);
  };

  const unitPrice = (product) => {
    return pricingType === "retail"
      ? product.retailPrice
      : product.wholesalePrice;
  };

  const addToCart = (product) => {
    const price = unitPrice(product);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast.error(`Only ${product.quantity} available`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                totalPrice: (item.quantity + 1) * price,
              }
            : item,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          unitPrice: price,
          quantity: 1,
          totalPrice: price,
          stock: product.quantity,
          pricingType,
        },
      ];
    });
    toast.success(`${product.name} added at ${pricingType} price`);

    // Clear search bar and refocus so the next scan starts fresh
    setSearch("");
    scanBufferRef.current = "";
    searchRef.current?.focus();
  };

  const updateQuantity = (productId, qty) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          if (qty > item.stock) {
            toast.error(`Only ${item.stock} available`);
            return item;
          }
          return { ...item, quantity: qty, totalPrice: qty * item.unitPrice };
        }
        return item;
      }),
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    toast.success("Cart cleared");
  };

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount = discount;
  const tax = (subtotal - discountAmount) * (taxRate / 100);
  const total = subtotal - discountAmount + tax;
  const change = Math.max(0, parseFloat(amountPaid || 0) - total);

  // Derive M-Pesa split payment values (must be after total is declared)
  const mpesaAmountVal =
    paymentMethod === "mpesa" ? parseFloat(mpesaAmount || total) : 0;
  const cashAmountVal =
    paymentMethod === "mpesa" ? Math.max(0, total - mpesaAmountVal) : 0;
  const isSplit =
    paymentMethod === "mpesa" && mpesaAmountVal > 0 && mpesaAmountVal < total;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const POLLING_TIMEOUT_MS = 120 * 1000; // 2 minutes max

  const pollMpesaStatus = async (checkoutRequestId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    const startTime = Date.now();

    pollingRef.current = setInterval(async () => {
      // Check for timeout
      if (Date.now() - startTime > POLLING_TIMEOUT_MS) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        // Cleanup pending transaction on timeout
        if (mpesaTxIdRef.current) {
          mpesaAPI.cancelPending(mpesaTxIdRef.current).catch(() => {});
          setMpesaTxId(null);
          mpesaTxIdRef.current = null;
        }
        setMpesaStatus("failed");
        setMpesaError(
          "Payment timed out. Customer did not complete the payment.",
        );
        setCheckoutLoading(false);
        toast.error("M-Pesa payment timed out");
        return;
      }

      try {
        const { data } = await mpesaAPI.getStatus(checkoutRequestId);
        // Split payment: transaction is already 'completed', wait for M-Pesa receipt code
        if (data.status === "completed" && data.mpesaReceiptCode) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setMpesaStatus("completed");
          setShowReceipt(data.transaction);
          // Play cash register sound (if enabled)
          if (soundEnabled) {
            playCheckoutSound();
          }
          setCart([]);
          setAmountPaid("");
          setDiscount(0);
          setMpesaPhone("");
          setMpesaAmount("");
          setCheckoutLoading(false);
          setMpesaProcessing(false);
          loadProducts();
          toast.success(
            data.transaction.paymentMethod === "mixed"
              ? "Split payment completed! M-Pesa confirmed."
              : "M-Pesa payment received!",
          );
        } else if (data.status === "failed") {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setMpesaStatus("failed");
          setMpesaError("Payment was cancelled or failed");
          setCheckoutLoading(false);
          toast.error("M-Pesa payment failed");
        }
      } catch {
        // Silently retry
      }
    }, 3000);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (paymentMethod === "cash" && parseFloat(amountPaid || 0) < total) {
      toast.error("Insufficient payment");
      return;
    }
    if (paymentMethod === "mpesa" && !mpesaPhone.trim()) {
      toast.error("Please enter customer phone number");
      return;
    }

    setCheckoutLoading(true);

    // M-Pesa flow: create transaction FIRST, then initiate STK push
    if (paymentMethod === "mpesa") {
      // Basic Kenyan phone validation
      const cleanedPhone = mpesaPhone.replace(/[\s\-]/g, "");
      if (!/^(\+?254|0)[17]\d{8}$/.test(cleanedPhone)) {
        setCheckoutLoading(false);
        toast.error(
          "Please enter a valid Kenyan phone number (e.g. 0712 345 678)",
        );
        return;
      }

      setMpesaStatus("sending");
      setMpesaError("");

      try {
        if (isSplit) {
          // ── SPLIT PAYMENT: M-Pesa + Cash ──
          // Step 1: Create completed transaction immediately (cash collected, inventory deducted)
          const { data: tx } = await transactionsAPI.create({
            items: cart.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              pricingType: item.pricingType,
            })),
            payments: [{ method: "mpesa", amount: total }],
            discount: discountAmount,
            tax,
            notes: "",
            mpesaPhone: mpesaPhone,
            mpesaAmount: mpesaAmountVal,
            cashAmount: cashAmountVal,
          });

          setMpesaTxId(tx.id);

          // Step 2: Initiate STK push for the M-Pesa portion only
          const { data: stkResult } = await mpesaAPI.stkPush({
            phoneNumber: mpesaPhone,
            amount: Math.round(mpesaAmountVal),
            accountReference: tx.receiptNumber,
          });

          if (!stkResult.success) {
            throw new Error(stkResult.responseDescription || "STK push failed");
          }

          // Step 3: Link the transaction with the checkout request ID
          await mpesaAPI.linkTransaction(tx.id, {
            checkoutRequestId: stkResult.checkoutRequestId,
            phoneNumber: mpesaPhone,
          });

          setMpesaCheckoutId(stkResult.checkoutRequestId);
          setMpesaStatus("waiting");

          // Start polling for M-Pesa confirmation
          pollMpesaStatus(stkResult.checkoutRequestId);
          toast.success(
            `M-Pesa STK push sent! Cash collected: KSh ${cashAmountVal.toLocaleString()}`,
          );
        } else {
          // ── FULL M-PESA PAYMENT ──
          // Step 1: Create pending transaction first
          const { data: tx } = await transactionsAPI.create({
            items: cart.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              pricingType: item.pricingType,
            })),
            payments: [
              { method: "mpesa", amount: parseFloat(amountPaid || total) },
            ],
            discount: discountAmount,
            tax,
            notes: "",
            mpesaPhone: mpesaPhone,
          });

          // Track the transaction ID for cleanup on cancel
          setMpesaTxId(tx.id);

          // Step 2: Initiate STK push
          const { data: stkResult } = await mpesaAPI.stkPush({
            phoneNumber: mpesaPhone,
            amount: Math.round(total),
            accountReference: tx.receiptNumber,
          });

          if (!stkResult.success) {
            throw new Error(stkResult.responseDescription || "STK push failed");
          }

          // Step 3: Link the transaction with the checkout request ID from Daraja
          await mpesaAPI.linkTransaction(tx.id, {
            checkoutRequestId: stkResult.checkoutRequestId,
            phoneNumber: mpesaPhone,
          });

          setMpesaCheckoutId(stkResult.checkoutRequestId);
          setMpesaStatus("waiting");

          // Start polling for status
          pollMpesaStatus(stkResult.checkoutRequestId);
          toast.success("STK push sent! Check customer phone.");
        }
      } catch (err) {
        setMpesaStatus("failed");
        setMpesaError(
          err.response?.data?.error || err.message || "M-Pesa payment failed",
        );
        setMpesaTxId(null); // cleanup orphan tracking
        setCheckoutLoading(false);
        toast.error(err.response?.data?.error || "M-Pesa payment failed");
      }
      return;
    }

    // Cash / Card flow
    try {
      const { data } = await transactionsAPI.create({
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          pricingType: item.pricingType,
        })),
        payments: [
          { method: paymentMethod, amount: parseFloat(amountPaid || total) },
        ],
        discount: discountAmount,
        tax,
        notes: "",
      });
      setShowReceipt(data);
      // Play cash register sound (if enabled)
      if (soundEnabled) {
        playCheckoutSound();
      }
      setCart([]);
      setAmountPaid("");
      setDiscount(0);
      setShowCheckout(false);
      loadProducts();
      toast.success("Sale completed!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Cancel pending M-Pesa transaction on server
  const cancelPendingMpesa = async () => {
    if (mpesaTxId) {
      try {
        await mpesaAPI.cancelPending(mpesaTxId);
      } catch {
        // Clean up best-effort
      }
      setMpesaTxId(null);
    }
  };

  // Go back from M-Pesa waiting to checkout (without canceling the transaction)
  const goBackToCheckout = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setMpesaStatus("idle");
    setMpesaCheckoutId(null);
    setCheckoutLoading(false);
    setMpesaProcessing(false);
    setMpesaError("");
    // Keep the pending transaction alive; don't cancel
  };

  // Close checkout modal - cleanup M-Pesa state
  const closeCheckout = async () => {
    setShowCheckout(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    await cancelPendingMpesa();
    setMpesaStatus("idle");
    setMpesaCheckoutId(null);
    setMpesaError("");
    setMpesaAmount("");
  };

  const Receipt = ({ tx, onClose }) => {
    const printReceipt = () => window.print();
    const formatCurrency = (v) => `KSh ${Number(v || 0).toLocaleString()}`;

    return (
      <div
        className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl receipt"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center mb-4">
            <h2 className="font-bold text-lg">
              {settings.store_name || "My Store"}
            </h2>
            <p className="text-xs text-gray-500">
              {settings.store_address || ""}
            </p>
            <p className="text-xs text-gray-500">
              Tel: {settings.store_phone || ""}
            </p>
            <hr className="border-dashed my-2" />
            <p className="text-xs">Receipt: {tx.receiptNumber}</p>
            <p className="text-xs">Invoice: {tx.invoiceNumber}</p>
            <p className="text-xs">{new Date(tx.createdAt).toLocaleString()}</p>
            <p className="text-xs">Cashier: {tx.cashier?.name}</p>
          </div>
          <hr className="border-dashed" />
          <table className="w-full text-xs receipt-table mt-2">
            <thead>
              <tr>
                <th className="text-left">Item</th>
                <th className="text-center">Qty</th>
                <th className="text-right">Price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {tx.items?.map((item, i) => (
                <tr key={i}>
                  <td className="py-1">{item.productName}</td>
                  <td className="py-1 text-center">{item.quantity}</td>
                  <td className="py-1 text-right">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="py-1 text-right">
                    {formatCurrency(item.totalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr className="border-dashed my-2" />
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(tx.subtotal)}</span>
            </div>
            {tx.discount > 0 && (
              <div className="flex justify-between">
                <span>Discount</span>
                <span>-{formatCurrency(tx.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax ({taxRate}%)</span>
              <span>{formatCurrency(tx.tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm">
              <span>Total</span>
              <span>{formatCurrency(tx.total)}</span>
            </div>
            <hr className="border-dashed my-1" />
            {tx.paymentMethod === "mixed" ? (
              <>
                <div className="flex justify-between text-blue-600 dark:text-blue-400">
                  <span>📱 Paid via M-Pesa</span>
                  <span>{formatCurrency(tx.mpesaAmount || 0)}</span>
                </div>
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>💵 Paid via Cash</span>
                  <span>{formatCurrency(tx.cashAmount || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-dashed pt-1 mt-1">
                  <span>Total Paid</span>
                  <span>{formatCurrency(tx.amountPaid)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span>Paid ({tx.paymentMethod})</span>
                <span>{formatCurrency(tx.amountPaid)}</span>
              </div>
            )}
            {tx.change > 0 && (
              <div className="flex justify-between">
                <span>Change</span>
                <span>{formatCurrency(tx.change)}</span>
              </div>
            )}
            {tx.mpesaReceiptCode && (
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>M-Pesa Code</span>
                <span className="font-mono text-xs">{tx.mpesaReceiptCode}</span>
              </div>
            )}
          </div>
          <hr className="border-dashed my-2" />
          <p className="text-xs text-center text-gray-500">
            Thank you for your purchase!
          </p>
          <div className="flex justify-center gap-3 mt-3 no-print">
            <button
              onClick={printReceipt}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
            >
              🖨️ Print
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Mobile Scanner Alert Banner */}
      {newScanAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-green-500 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3">
            <span className="text-xl">📱</span>
            <span className="font-medium">
              New barcode scanned from mobile!
            </span>
          </div>
        </div>
      )}

      {/* Mobile Scanner Panel Toggle */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        {showMobileScans && mobileScans.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-80 max-h-96 overflow-hidden mb-2">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                📱 Mobile Scanner ({mobileScans.length})
              </h3>
              <button
                onClick={() => setShowMobileScans(false)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto max-h-80">
              {mobileScans.map((scan) => (
                <div
                  key={scan.id}
                  className="p-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {scan.barcode}
                        </span>
                        {scan.product && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            ✓ Found
                          </span>
                        )}
                      </div>
                      {scan.product ? (
                        <p className="text-sm font-medium mt-1 truncate">
                          {scan.product.name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">
                          {scan.label || "Unknown product"}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(scan.scannedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleMobileScanAdd(scan)}
                      disabled={!scan.product}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        scan.product
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {scan.product ? "+ Add" : "---"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => setShowMobileScans(!showMobileScans)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all text-xl ${
            showMobileScans
              ? "bg-blue-600 text-white ring-4 ring-blue-300"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600"
          }`}
          title="Mobile Scanner Scans"
        >
          📱
        </button>
      </div>

      {/* Products Section */}
      <div className="flex-1 flex flex-col">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <form onSubmit={handleSearch} className="flex-1">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="🔍 Search products or scan barcode..."
              className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white outline-none text-lg transition-all duration-300 ${
                scanFlash
                  ? "border-green-500 dark:border-green-400 ring-4 ring-green-300 dark:ring-green-600/50 bg-green-50 dark:bg-green-900/30"
                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
              }`}
            />
          </form>
        </div>

        {/* Pricing Type Toggle + Category Pills */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {/* Retail / Wholesale Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setPricingType("retail")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                pricingType === "retail"
                  ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              🏪 Retail
            </button>
            <button
              onClick={() => setPricingType("wholesale")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                pricingType === "wholesale"
                  ? "bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              📦 Wholesale
            </button>
          </div>

          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <button
              onClick={() => setCategoryFilter("")}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${!categoryFilter ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id.toString())}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${categoryFilter === cat.id.toString() ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {loading ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                Loading products...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                {search
                  ? "No products match your search"
                  : "No products available"}
              </div>
            ) : (
              filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all text-left group"
                >
                  {/* Product Image */}
                  <div className="w-full h-24 rounded-lg mb-2 overflow-hidden bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                    {product.imageUrl ? (
                      <img
                        src={getUploadUrl(product.imageUrl)}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <span className="text-3xl group-hover:scale-110 transition-transform">
                        📦
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`font-bold text-sm ${pricingType === "retail" ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}
                    >
                      R: KSh {Number(product.retailPrice).toLocaleString()}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span
                      className={`font-bold text-sm ${pricingType === "wholesale" ? "text-purple-600 dark:text-purple-400" : "text-gray-400"}`}
                    >
                      W: KSh {Number(product.wholesalePrice).toLocaleString()}
                    </span>
                  </div>
                  <p
                    className={`text-xs ${product.quantity <= product.reorderLevel ? "text-red-500" : "text-gray-400"}`}
                  >
                    Stock: {product.quantity}
                  </p>
                </button>
              ))
            )}
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
            <button
              onClick={clearCart}
              className="text-sm text-red-500 hover:text-red-600"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🛒</p>
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Click products to add</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-600 flex items-center justify-center shrink-0">
                  {item.imageUrl ? (
                    <img
                      src={getUploadUrl(item.imageUrl)}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg">📦</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    KSh {item.unitPrice.toLocaleString()} each
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateQuantity(item.productId, item.quantity - 1)
                    }
                    className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 font-bold text-sm"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-medium text-sm">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() =>
                      updateQuantity(item.productId, item.quantity + 1)
                    }
                    className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 font-bold text-sm"
                  >
                    +
                  </button>
                </div>
                <p className="font-medium text-sm w-20 text-right">
                  KSh {item.totalPrice.toLocaleString()}
                </p>
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {/* Cart Totals */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>KSh {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">Discount (KSh)</span>
              <input
                type="number"
                value={discount}
                onChange={(e) =>
                  setDiscount(
                    Math.max(0, parseFloat(e.target.value) || 0),
                  )
                }
                className="w-24 px-2 py-1 text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-KSh {discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax ({taxRate}%)</span>
              <span>KSh {tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-1 border-t border-gray-200 dark:border-gray-700">
              <span>Total</span>
              <span className="text-blue-600 dark:text-blue-400">
                KSh {total.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowCheckout(true)}
            disabled={cart.length === 0}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-colors text-lg"
          >
            💳 Checkout (KSh {total.toLocaleString()})
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {/* M-Pesa Processing Modal */}
      {mpesaStatus === "waiting" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 w-full max-w-sm shadow-xl text-center">
            <div className="animate-pulse text-5xl mb-4">📱</div>
            <h3 className="text-lg font-bold mb-2">
              {isSplit
                ? "Waiting for M-Pesa Confirmation"
                : "Waiting for M-Pesa Payment"}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {isSplit ? (
                <>
                  An STK push of{" "}
                  <strong>KSh {mpesaAmountVal.toLocaleString()}</strong> has
                  been sent to <strong>{mpesaPhone}</strong>.<br />
                  The cash portion (
                  <strong>KSh {cashAmountVal.toLocaleString()}</strong>) has
                  already been collected.
                  <br />
                  Please check the customer's phone and enter the M-Pesa PIN to
                  complete payment.
                </>
              ) : (
                <>
                  An STK push has been sent to <strong>{mpesaPhone}</strong>.
                  <br />
                  Please check the customer's phone and enter the M-Pesa PIN to
                  complete payment.
                </>
              )}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-4">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></span>
              Waiting for confirmation...
            </div>
            <p className="text-xs text-gray-400">
              Total: <strong>KSh {total.toLocaleString()}</strong>
            </p>
            {isSplit && (
              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs">
                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>📱 M-Pesa</span>
                  <span>KSh {mpesaAmountVal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>💵 Cash ✓</span>
                  <span>KSh {cashAmountVal.toLocaleString()}</span>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={async () => {
                  if (pollingRef.current) clearInterval(pollingRef.current);
                  await cancelPendingMpesa();
                  setMpesaStatus("idle");
                  setCheckoutLoading(false);
                  setShowCheckout(false);
                }}
                className="px-4 py-2 text-sm border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                ✕ Cancel & Void
              </button>
              <button
                onClick={goBackToCheckout}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                ↩️ Go Back to Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckout && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
          onClick={closeCheckout}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">Checkout</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>KSh {subtotal.toLocaleString()}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-KSh {discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax ({taxRate}%)</span>
                  <span>KSh {tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-1 border-t">
                  <span>Total</span>
                  <span>KSh {total.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "cash", label: "💵 Cash" },
                    { value: "mpesa", label: "📱 M-Pesa" },
                    { value: "debit_card", label: "💳 Debit Card" },
                    { value: "credit_card", label: "💳 Credit Card" },
                  ].map((pm) => (
                    <button
                      key={pm.value}
                      onClick={() => {
                        setPaymentMethod(pm.value);
                        if (pm.value !== "mpesa") {
                          setMpesaPhone("");
                          setMpesaAmount("");
                        }
                      }}
                      className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                        paymentMethod === pm.value
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                          : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === "cash" && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Amount Paid
                  </label>
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter amount"
                    autoFocus
                  />
                  {parseFloat(amountPaid || 0) >= total && (
                    <p className="text-sm text-green-600 mt-1">
                      Change: KSh {change.toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === "mpesa" && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Customer Phone Number
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🇰🇪</span>
                    <input
                      type="tel"
                      value={mpesaPhone}
                      onChange={(e) => setMpesaPhone(e.target.value)}
                      placeholder="0712 345 678"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      autoFocus
                    />
                  </div>

                  <label className="block text-sm font-medium mb-1 mt-3">
                    M-Pesa Amount
                  </label>
                  <input
                    type="number"
                    value={mpesaAmount}
                    onChange={(e) => setMpesaAmount(e.target.value)}
                    placeholder={`Total: KSh ${total.toLocaleString()}`}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />

                  {mpesaAmount &&
                    parseFloat(mpesaAmount || 0) > 0 &&
                    parseFloat(mpesaAmount) < total && (
                      <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                          <span>💵</span>
                          <span>
                            Cash to collect:{" "}
                            <strong>
                              KSh{" "}
                              {(
                                total - parseFloat(mpesaAmount)
                              ).toLocaleString()}
                            </strong>
                          </span>
                        </div>
                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                          The remaining balance will be paid in cash at the
                          counter.
                        </p>
                      </div>
                    )}

                  <p className="text-xs text-gray-500 mt-1">
                    Enter the amount to charge via M-Pesa. Any remaining balance
                    will be paid in cash.
                  </p>
                  {mpesaStatus === "failed" && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                      {mpesaError || "M-Pesa payment failed. Please try again."}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={closeCheckout}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {checkoutLoading ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  ) : paymentMethod === "mpesa" ? (
                    "📱"
                  ) : (
                    "✅"
                  )}
                  {checkoutLoading
                    ? paymentMethod === "mpesa"
                      ? "Sending STK Push..."
                      : "Processing..."
                    : paymentMethod === "mpesa"
                      ? "Send M-Pesa Request"
                      : "Complete Sale"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && (
        <Receipt tx={showReceipt} onClose={() => setShowReceipt(null)} />
      )}
    </div>
  );
}
