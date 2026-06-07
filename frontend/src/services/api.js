import axios from "axios";

// Request interceptor to add auth token
const isElectron = navigator.userAgent.toLowerCase().includes("electron");

const api = axios.create({
  baseURL: isElectron ? "http://localhost:5000/api" : "/api",
  headers: { "Content-Type": "application/json" },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.hash = "#/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;

//image upload
export const getUploadUrl = (path) => {
  const isElectron = navigator.userAgent.toLowerCase().includes("electron");
  return isElectron ? `http://localhost:5000${path}` : path;
};

// Auth
export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
  changePassword: (data) => api.post("/auth/change-password", data),
};

// Products
export const productsAPI = {
  getAll: (params) => api.get("/products", { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post("/products", data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  addStock: (id, data) => api.post(`/products/${id}/add-stock`, data),
  getInventoryLogs: (id) => api.get(`/products/${id}/inventory-logs`),
  uploadImage: (formData) =>
    api.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// Categories
export const categoriesAPI = {
  getAll: () => api.get("/categories"),
  create: (data) => api.post("/categories", data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// Users
export const usersAPI = {
  getAll: () => api.get("/users"),
  create: (data) => api.post("/users", data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getActivityLogs: (params) => api.get("/users/activity-logs", { params }),
};

// Transactions
export const transactionsAPI = {
  getAll: (params) => api.get("/transactions", { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post("/transactions", data),
  update: (id, data) => api.patch(`/transactions/${id}`, data),
  completePending: (id, data) => api.post(`/transactions/${id}/complete`, data),
  refund: (id) => api.post(`/transactions/${id}/refund`),
};

// Reports
export const reportsAPI = {
  dailySales: (params) => api.get("/reports/daily-sales", { params }),
  weeklySales: (params) => api.get("/reports/weekly-sales", { params }),
  monthlySales: (params) => api.get("/reports/monthly-sales", { params }),
  productSales: (params) => api.get("/reports/product-sales", { params }),
  inventory: () => api.get("/reports/inventory"),
  cashierPerformance: (params) =>
    api.get("/reports/cashier-performance", { params }),
  profitLoss: (params) => api.get("/reports/profit-loss", { params }),
};

// Dashboard
export const dashboardAPI = {
  getStats: (params) => api.get("/dashboard/stats", { params }),
};

// Settings
export const settingsAPI = {
  getAll: () => api.get("/settings"),
  update: (data) => api.put("/settings", data),
  backup: () => api.post("/settings/backup"),
  getNetworkInfo: () => api.get("/settings/network-info"),
};

// Scanner (mobile barcode scanner app)
export const scannerAPI = {
  getRecent: (since) => api.get("/scanner/recent", { params: { since } }),
};

// M-Pesa
export const mpesaAPI = {
  stkPush: (data) => api.post("/mpesa/stkpush", data),
  query: (data) => api.post("/mpesa/query", data),
  getStatus: (checkoutRequestId) =>
    api.get(`/mpesa/status/${checkoutRequestId}`),
  linkTransaction: (transactionId, data) =>
    api.patch(`/mpesa/transaction/${transactionId}/link`, data),
  cancelPending: (transactionId) =>
    api.post(`/mpesa/transaction/${transactionId}/cancel`),
  retry: (transactionId, data) =>
    api.post(`/mpesa/transaction/${transactionId}/retry`, data),
};
