import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
const adminNavItems = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: "./icons/dashboard-icon.png",
  },
  { path: "/pos", label: "POS", icon: "./icons/pos-icon.png" },
  { path: "/products", label: "Products", icon: "./icons/product-icon.png" },
  {
    path: "/categories",
    label: "Categories",
    icon: "./icons/category-icon.png",
  },
  { path: "/users", label: "Users", icon: "./icons/users-icon.png" },
  {
    path: "/transactions",
    label: "Transactions",
    icon: "./icons/transaction-icon.png",
  },
  {
    path: "/reports",
    label: "Reports",
    icon: "./icons/report-icon.png",
  },
  {
    path: "/account",
    label: "Account",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M20 21a8 8 0 1 0-16 0'/%3E%3C/svg%3E",
  },
  { path: "/settings", label: "Settings", icon: "./icons/setting-icon.png" },
];

const cashierNavItems = [
  { path: "/pos", label: "POS", icon: "./icons/cashier-icon.png" },
  {
    path: "/transactions",
    label: "Transactions",
    icon: "./icons/transaction-icon.png",
  },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = user?.role === "admin" ? adminNavItems : cashierNavItems;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 ease-in-out ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0 lg:w-16"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
            <Link
              to="/dashboard"
              className={`font-bold text-xl text-blue-600 dark:text-blue-400 ${!sidebarOpen && "lg:hidden"}`}
            >
              POS System
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  } ${!sidebarOpen && "lg:justify-center"}`}
                  title={item.label}
                >
                  {item.icon ? (
                    <img src={item.icon} alt="" className="w-6 h-6" />
                  ) : (
                    <span className="text-xl">{item.icon}</span>
                  )}
                  <span className={`${!sidebarOpen && "lg:hidden"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex items-center justify-center w-full p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            >
              {sidebarOpen ? "◀" : "▶"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-16 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              ☰
            </button>
            <h2 className="text-lg font-semibold capitalize">
              {location.pathname === "/"
                ? "Dashboard"
                : location.pathname.slice(1).replace("/", " - ")}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme toggle slider */}
            <button
              onClick={toggleTheme}
              className="relative w-16 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors duration-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {/* Sun icon (left) */}
              <img
                src="./icons/sun-icon.png"
                alt=""
                className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-all duration-300 ${
                  isDark ? "opacity-30 scale-90" : "opacity-100 scale-100"
                }`}
              />
              {/* Moon icon (right) */}
              <img
                src="./icons/moon-icon.png"
                alt=""
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-all duration-300 ${
                  isDark ? "opacity-100 scale-100" : "opacity-30 scale-90"
                }`}
              />
              {/* Sliding knob */}
              <span
                className={`absolute top-0.5 w-7 h-7 rounded-full bg-white dark:bg-gray-300 shadow-md transition-all duration-300 ${
                  isDark ? "translate-x-[-32px]" : "translate-x-[2px]"
                }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {user?.role}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
