import {
  HashRouter as BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LicenseProvider, useLicense } from "./contexts/LicenseContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Categories from "./pages/Categories";
import Users from "./pages/Users";
import Transactions from "./pages/Transactions";
import TransactionDetail from "./pages/TransactionDetail";
import Reports from "./pages/Reports";
import POS from "./pages/POS";
import Settings from "./pages/Settings";
import Account from "./pages/Account";
import LicenseAdmin from "./pages/LicenseAdmin";
import useAutoBackupNotification from "./hooks/useAutoBackupNotification";

function AppRoutes() {
  // Listen for auto-backup completion events (shows toast anywhere in the app)
  useAutoBackupNotification();
  const { isLicenseReady } = useLicense();

  if (!isLicenseReady) return null;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pos"
        element={
          <ProtectedRoute>
            <Layout>
              <POS />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/products"
        element={
          <ProtectedRoute role="admin">
            <Layout>
              <Products />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/products/:id"
        element={
          <ProtectedRoute role="admin">
            <Layout>
              <ProductDetail />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/categories"
        element={
          <ProtectedRoute role="admin">
            <Layout>
              <Categories />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute role="admin">
            <Layout>
              <Users />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <Layout>
              <Transactions />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/transactions/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <TransactionDetail />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute role="admin">
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/account"
        element={
          <ProtectedRoute role="admin">
            <Layout>
              <Account />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute role="admin">
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/licenses"
        element={
          <ProtectedRoute role="admin">
            <Layout>
              <LicenseAdmin />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LicenseProvider>
        <ThemeProvider>
          <AuthProvider>
            <Toaster position="top-right" containerClassName="no-print" />
            <AppRoutes />
          </AuthProvider>
        </ThemeProvider>
      </LicenseProvider>
    </BrowserRouter>
  );
}
