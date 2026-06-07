import { useState, useEffect, useRef, useMemo } from "react";
import { productsAPI, categoriesAPI, getUploadUrl } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import useMobileScanner from "../hooks/useMobileScanner";
import toast from "react-hot-toast";
import ConfirmDialog from "../components/ConfirmDialog";

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    description: "",
    costPrice: "",
    retailPrice: "",
    wholesalePrice: "",
    quantity: "",
    reorderLevel: "5",
    categoryId: "",
    imageUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [stockModal, setStockModal] = useState({
    open: false,
    product: null,
    quantity: "",
  });
  const [addingStock, setAddingStock] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, product: null });
  const [scanFlash, setScanFlash] = useState(false); // green flash on successful scan
  const [barcodeFlash, setBarcodeFlash] = useState(false); // flash for modal barcode field

  // Barcode scanner support — uses a ref buffer to avoid React state timing issues
  const scanBufferRef = useRef("");
  const scanTimeoutRef = useRef(null);
  const searchRef = useRef(null);
  const barcodeInputRef = useRef(null); // ref for the barcode field in Add/Edit modal
  const lastKeystrokeRef = useRef(0); // for modal barcode field scanner detection
  const flashTimeoutRef = useRef(null);
  const barcodeFlashTimeoutRef = useRef(null);

  // Mobile scanner app integration — shared hook handles polling
  const {
    mobileScans,
    showMobileScans,
    setShowMobileScans,
    newScanAlert,
    setMobileScans,
  } = useMobileScanner({
    onScans: (scans) => handleMobileScans(scans),
  });

  /** Process mobile scanner scans based on where the cursor is. */
  const handleMobileScans = (scans) => {
    const searchHasFocus = document.activeElement === searchRef.current;
    const barcodeHasFocus =
      showModal && document.activeElement === barcodeInputRef.current;
    const unhandled = [];

    for (const scan of scans) {
      const barcode = scan.barcode || "";
      if (barcode.length === 0) {
        unhandled.push(scan);
        continue;
      }

      if (barcodeHasFocus) {
        // Cursor is on barcode field — fill it in
        setForm((prev) => ({ ...prev, barcode }));
        if (barcodeFlashTimeoutRef.current)
          clearTimeout(barcodeFlashTimeoutRef.current);
        setBarcodeFlash(true);
        barcodeFlashTimeoutRef.current = setTimeout(
          () => setBarcodeFlash(false),
          600,
        );
        continue;
      }

      if (searchHasFocus) {
        // Cursor is on search bar — search by barcode
        setSearch(barcode);
        scanBufferRef.current = barcode;
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        setScanFlash(true);
        flashTimeoutRef.current = setTimeout(() => setScanFlash(false), 600);
        setPage(1);
        // Trigger the search
        productsAPI
          .getAll({
            page: 1,
            limit: 20,
            sortBy: "createdAt",
            sortOrder: "desc",
            search: barcode,
            ...(categoryFilter ? { categoryId: categoryFilter } : {}),
          })
          .then(({ data }) => {
            setProducts(data.products);
            setTotalPages(data.pagination.totalPages);
          })
          .catch(() => {});
        continue;
      }

      unhandled.push(scan);
    }
    return unhandled;
  };

  // Mobile scanner phone panel: click a scan to search for it
  const handleMobileScanAdd = (scan) => {
    const barcode = scan.barcode || "";
    setSearch(barcode);
    scanBufferRef.current = barcode;
    setPage(1);
    // Trigger search
    productsAPI
      .getAll({
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
        search: barcode,
        ...(categoryFilter ? { categoryId: categoryFilter } : {}),
      })
      .then(({ data }) => {
        setProducts(data.products);
        setTotalPages(data.pagination.totalPages);
      })
      .catch(() => {});
  };

  const fetchProducts = async () => {
    try {
      const params = {
        page,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      };
      if (search) params.search = search;
      if (categoryFilter) params.categoryId = categoryFilter;
      const { data } = await productsAPI.getAll(params);
      setProducts(data.products);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, categoryFilter]);

  useEffect(() => {
    categoriesAPI
      .getAll()
      .then(({ data }) => setCategories(data))
      .catch((err) => console.error("Failed to load categories:", err));
  }, []);

  // Barcode scanner support
  // Uses a ref buffer to accumulate scanner keystrokes and detect rapid typing + Enter.
  // On Enter with buffer > 3 chars, looks up the product by barcode or SKU and sets search.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && scanBufferRef.current.length > 3) {
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }
        const scanned = scanBufferRef.current;
        scanBufferRef.current = "";
        // Flash search input green to confirm scan
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        setScanFlash(true);
        flashTimeoutRef.current = setTimeout(() => setScanFlash(false), 600);
        setSearch(scanned);
        setPage(1);
        // Trigger search immediately with the scanned code
        productsAPI
          .getAll({
            page: 1,
            limit: 20,
            sortBy: "createdAt",
            sortOrder: "desc",
            search: scanned,
            ...(categoryFilter ? { categoryId: categoryFilter } : {}),
          })
          .then(({ data }) => {
            setProducts(data.products);
            setTotalPages(data.pagination.totalPages);
          })
          .catch(() => {});
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
  }, [categoryFilter]);

  // Sync the search input with the scan buffer, and auto-reset buffer after 1s without Enter
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    scanBufferRef.current = value;
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      scanBufferRef.current = "";
    }, 1000);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const openCreate = () => {
    setEditingProduct(null);
    setForm({
      name: "",
      sku: "",
      barcode: "",
      description: "",
      costPrice: "",
      retailPrice: "",
      wholesalePrice: "",
      quantity: "",
      reorderLevel: "5",
      categoryId: categories[0]?.id || "",
      imageUrl: "",
    });
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || "",
      description: product.description || "",
      costPrice: product.costPrice,
      retailPrice: product.retailPrice,
      wholesalePrice: product.wholesalePrice,
      quantity: product.quantity,
      reorderLevel: product.reorderLevel,
      categoryId: product.categoryId,
      imageUrl: product.imageUrl || "",
    });
    setShowModal(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await productsAPI.uploadImage(formData);
      setForm((prev) => ({ ...prev, imageUrl: data.url }));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, form);
        toast.success("Product updated");
      } else {
        await productsAPI.create(form);
        toast.success("Product created");
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (product) => {
    setDeleteConfirm({ open: true, product });
  };

  const handleDeleteConfirm = async () => {
    const product = deleteConfirm.product;
    if (!product) return;
    setDeleteConfirm({ open: false, product: null });
    try {
      await productsAPI.delete(product.id);
      toast.success("Product deleted");
      await fetchProducts();
      // Restore focus to search input after deletion
      searchRef.current?.focus();
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to delete product";
      toast.error(msg);
      // Restore focus even on error
      searchRef.current?.focus();
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ open: false, product: null });
  };

  const handleAddStock = async () => {
    const { product, quantity } = stockModal;
    if (!quantity || parseInt(quantity) <= 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }
    setAddingStock(true);
    try {
      await productsAPI.addStock(product.id, { quantity: parseInt(quantity) });
      toast.success(`Added ${quantity} units to ${product.name}`);
      setStockModal({ open: false, product: null, quantity: "" });
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add stock");
    } finally {
      setAddingStock(false);
    }
  };

  // Sort products: out of stock first, then low stock, then in stock
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const getPriority = (p) => {
        if (p.quantity === 0) return 0; // out of stock — highest priority
        if (p.quantity <= p.reorderLevel) return 1; // low stock
        return 2; // in stock
      };
      return getPriority(a) - getPriority(b);
    });
  }, [products]);

  const getStockBadge = (product) => {
    if (product.quantity === 0)
      return (
        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full font-medium">
          Out of Stock
        </span>
      );
    if (product.quantity <= product.reorderLevel)
      return (
        <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-xs rounded-full font-medium">
          Low Stock
        </span>
      );
    return (
      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full font-medium">
        In Stock
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        {user?.role === "admin" && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2"
          >
            + Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="🔍 Search by name, SKU, or scan barcode..."
            className={`w-full px-4 py-2 border rounded-lg text-gray-900 dark:text-white outline-none transition-all duration-300 ${
              scanFlash
                ? "border-green-500 dark:border-green-400 ring-4 ring-green-300 dark:ring-green-600/50 bg-green-50 dark:bg-green-900/30"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
            }`}
          />
        </form>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Image</th>
                <th className="text-left py-3 px-4 font-medium">Name</th>
                <th className="text-left py-3 px-4 font-medium">SKU</th>
                <th className="text-left py-3 px-4 font-medium">Category</th>
                <th className="text-right py-3 px-4 font-medium">Cost</th>
                <th className="text-right py-3 px-4 font-medium">Retail</th>
                <th className="text-right py-3 px-4 font-medium">Wholesale</th>
                <th className="text-right py-3 px-4 font-medium">Qty</th>
                <th className="text-center py-3 px-4 font-medium">Status</th>
                {user?.role === "admin" && (
                  <th className="text-center py-3 px-4 font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={user?.role === "admin" ? 11 : 10}
                    className="text-center py-12 text-gray-500"
                  >
                    Loading...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td
                    colSpan={user?.role === "admin" ? 11 : 10}
                    className="text-center py-12 text-gray-500"
                  >
                    No products found
                  </td>
                </tr>
              ) : (
                sortedProducts.map((product) => (
                  <tr
                    key={product.id}
                    className={`border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${product.quantity <= product.reorderLevel ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                        {product.imageUrl ? (
                          <img
                            src={getUploadUrl(product.imageUrl)}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">📦</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{product.name}</p>
                      {product.barcode && (
                        <p className="text-xs text-gray-400">
                          Code: {product.barcode}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {product.sku}
                    </td>
                    <td className="py-3 px-4">{product.category?.name}</td>
                    <td className="py-3 px-4 text-right">
                      {Number(product.costPrice).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {Number(product.retailPrice).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-purple-600 dark:text-purple-400">
                      {Number(product.wholesalePrice).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">{product.quantity}</td>
                    <td className="py-3 px-4 text-center">
                      {getStockBadge(product)}
                    </td>
                    {user?.role === "admin" && (
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() =>
                              setStockModal({
                                open: true,
                                product,
                                quantity: "",
                              })
                            }
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                            title="Add Stock"
                          >
                            📦
                          </button>
                          <button
                            onClick={() => openEdit(product)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteClick(product)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

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
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        {scan.barcode}
                      </span>
                      {scan.product && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium ml-1">
                          ✓ Found
                        </span>
                      )}
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
                      {scan.product ? "Search" : "---"}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Product"
        message={`Delete "${deleteConfirm.product?.name}"? This cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Add Stock Modal */}
      {stockModal.open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setStockModal({ ...stockModal, open: false })}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1">Add Stock</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Adding stock to{" "}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {stockModal.product?.name}
              </span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Current stock:{" "}
              <span className="font-semibold">
                {stockModal.product?.quantity}
              </span>
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddStock();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">
                  Quantity to Add *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  autoFocus
                  value={stockModal.quantity}
                  onChange={(e) =>
                    setStockModal({ ...stockModal, quantity: e.target.value })
                  }
                  placeholder="Enter quantity..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setStockModal({ open: false, product: null, quantity: "" })
                  }
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingStock}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {addingStock ? "Adding..." : "➕ Add Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">
              {editingProduct ? "Edit Product" : "Add Product"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    SKU *
                  </label>
                  <input
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Barcode{" "}
                    <span className="text-xs text-gray-400">
                      (scan or type)
                    </span>
                  </label>
                  <input
                    ref={barcodeInputRef}
                    value={form.barcode}
                    onChange={(e) =>
                      setForm({ ...form, barcode: e.target.value })
                    }
                    onKeyDown={(e) => {
                      // Detect scanner Enter (rapid keystrokes) and prevent form submission
                      if (e.key === "Enter" && e.target.value.length > 3) {
                        const now = Date.now();
                        if (now - lastKeystrokeRef.current < 150) {
                          e.preventDefault();
                          // Flash the barcode field green to confirm scan
                          if (barcodeFlashTimeoutRef.current)
                            clearTimeout(barcodeFlashTimeoutRef.current);
                          setBarcodeFlash(true);
                          barcodeFlashTimeoutRef.current = setTimeout(
                            () => setBarcodeFlash(false),
                            600,
                          );
                        }
                      }
                      lastKeystrokeRef.current = Date.now();
                    }}
                    placeholder="Scan or type barcode..."
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition-all duration-300 ${
                      barcodeFlash
                        ? "border-green-500 dark:border-green-400 ring-4 ring-green-300 dark:ring-green-600/50 bg-green-50 dark:bg-green-900/30"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
                    }`}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Image Upload */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Product Image
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                    >
                      {uploading ? "Uploading..." : "📷 Choose Image"}
                    </button>
                    {form.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, imageUrl: "" })}
                        className="text-sm text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                  {form.imageUrl && (
                    <div className="mt-2 w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                      <img
                        src={getUploadUrl(form.imageUrl)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm({ ...form, categoryId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    value={form.reorderLevel}
                    onChange={(e) =>
                      setForm({ ...form, reorderLevel: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Cost Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm({ ...form, costPrice: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Retail Price *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={form.retailPrice}
                    onChange={(e) =>
                      setForm({ ...form, retailPrice: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Wholesale Price *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={form.wholesalePrice}
                    onChange={(e) =>
                      setForm({ ...form, wholesalePrice: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                {!editingProduct && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Initial Quantity *
                    </label>
                    <input
                      required
                      type="number"
                      value={form.quantity}
                      onChange={(e) =>
                        setForm({ ...form, quantity: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingProduct ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
