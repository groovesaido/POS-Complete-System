import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { productsAPI, getUploadUrl } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import ConfirmDialog from "../components/ConfirmDialog";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [editUploading, setEditUploading] = useState(false);
  const editFileInputRef = useRef(null);

  // Stock modal state
  const [stockQuantity, setStockQuantity] = useState("");
  const [addingStock, setAddingStock] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false });

  const fetchProduct = async () => {
    try {
      const { data } = await productsAPI.getById(id);
      setProduct(data);
    } catch {
      toast.error("Failed to load product details");
      navigate("/products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const openEdit = () => {
    setEditForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || "",
      description: product.description || "",
      costPrice: product.costPrice,
      retailPrice: product.retailPrice,
      wholesalePrice: product.wholesalePrice,
      imageUrl: product.imageUrl || "",
      quantity: product.quantity,
      reorderLevel: product.reorderLevel,
      categoryId: product.categoryId,
    });
    setShowEditModal(true);
  };

  const handleEditImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setEditUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await productsAPI.uploadImage(formData);
      setEditForm((prev) => ({ ...prev, imageUrl: data.url }));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload image");
    } finally {
      setEditUploading(false);
    }
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await productsAPI.update(id, editForm);
      setProduct(data);
      setShowEditModal(false);
      toast.success("Product updated");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handleAddStock = async () => {
    if (!stockQuantity || parseInt(stockQuantity) <= 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }
    setAddingStock(true);
    try {
      const { data } = await productsAPI.addStock(id, {
        quantity: parseInt(stockQuantity),
      });
      setProduct(data);
      setStockQuantity("");
      toast.success(`Added ${stockQuantity} units`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add stock");
    } finally {
      setAddingStock(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteConfirm({ open: true });
  };

  const handleDeleteConfirm = async () => {
    setDeleteConfirm({ open: false });
    try {
      await productsAPI.delete(id);
      toast.success("Product deleted");
      navigate("/products");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete product");
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ open: false });
  };

  const getStockBadge = (p) => {
    if (p.quantity === 0)
      return (
        <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-full font-medium">
          Out of Stock
        </span>
      );
    if (p.quantity <= p.reorderLevel)
      return (
        <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-sm rounded-full font-medium">
          Low Stock
        </span>
      );
    return (
      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm rounded-full font-medium">
        In Stock
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading product details...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Product not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/products")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Back to Products"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
          </div>
        </div>
        {getStockBadge(product)}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">SKU</p>
          <p className="text-sm font-mono font-bold mt-1">{product.sku}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Barcode</p>
          <p className="text-sm font-mono font-bold mt-1">{product.barcode || "—"}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Category</p>
          <p className="text-sm font-bold mt-1">{product.category?.name || "—"}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Reorder Level</p>
          <p className="text-sm font-bold mt-1">{product.reorderLevel}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image Section */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="aspect-square bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              {product.imageUrl ? (
                <img
                  src={getUploadUrl(product.imageUrl)}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-6xl opacity-30">📦</span>
              )}
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {product.description && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{product.description}</p>
            </div>
          )}

          {/* Pricing */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-4">Pricing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Cost Price</p>
                <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
                  {Number(product.costPrice).toLocaleString()}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Retail Price</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {Number(product.retailPrice).toLocaleString()}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Wholesale Price</p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {Number(product.wholesalePrice).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Stock Management */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-4">Stock Management</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <p className="text-sm text-gray-500">Current Stock</p>
                <p className="text-3xl font-bold">{product.quantity}</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">Reorder Level</p>
                <p className="text-3xl font-bold">{product.reorderLevel}</p>
              </div>
            </div>
            {user?.role === "admin" && (
              <div className="flex items-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Add Stock</label>
                  <input
                    type="number"
                    min="1"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    placeholder="Quantity..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <button
                  onClick={handleAddStock}
                  disabled={addingStock}
                  className="shrink-0 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  <img src="./icons/cart-icon.png" alt="Add Stock" className="w-5 h-5" />
                  {addingStock ? "Adding..." : "Add Stock"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {user?.role === "admin" && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={openEdit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2"
          >
            <img src="./icons/edit-icon.png" alt="Edit" className="w-5 h-5" />
            Edit Product
          </button>
          <button
            onClick={handleDeleteClick}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-2"
          >
            <img src="./icons/delete-icon.png" alt="Delete" className="w-5 h-5" />
            Delete Product
          </button>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Product"
        message={`Delete "${product.name}"? This cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Edit Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">Edit Product</h2>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SKU *</label>
                  <input
                    required
                    value={editForm.sku}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Barcode</label>
                  <input
                    value={editForm.barcode}
                    onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cost Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.costPrice}
                    onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Retail Price *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={editForm.retailPrice}
                    onChange={(e) => setEditForm({ ...editForm, retailPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Wholesale Price *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={editForm.wholesalePrice}
                    onChange={(e) => setEditForm({ ...editForm, wholesalePrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                {/* Image Upload */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Product Image</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={editUploading}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                    >
                      {editUploading ? "Uploading..." : "📷 Choose Image"}
                    </button>
                    {editForm.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, imageUrl: "" })}
                        className="text-sm text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageUpload}
                      className="hidden"
                    />
                  </div>
                  {editForm.imageUrl && (
                    <div className="mt-2 w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                      <img
                        src={getUploadUrl(editForm.imageUrl)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reorder Level</label>
                  <input
                    type="number"
                    value={editForm.reorderLevel}
                    onChange={(e) => setEditForm({ ...editForm, reorderLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
