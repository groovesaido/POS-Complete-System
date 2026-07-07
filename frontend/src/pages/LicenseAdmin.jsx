import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "../components/ConfirmDialog";

const LICENSE_SERVER = import.meta.env.VITE_LICENSE_SERVER_URL || "https://licensing-server-three.vercel.app";

/**
 * License Admin Dashboard
 *
 * Connects to the license server to manage licenses.
 * Requires the ADMIN_SECRET to be entered once and stored in localStorage.
 *
 * Features:
 * - List all licenses with status badges
 * - Generate new licenses
 * - Renew licenses (extend by 1 year)
 * - Suspend licenses
 * - Copy license keys
 * - Search/filter by name, email, or key
 */
export default function LicenseAdmin() {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminSecret, setAdminSecret] = useState("");
  const [secretInputValue, setSecretInputValue] = useState("");
  const [search, setSearch] = useState("");

  // Generate modal state
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genForm, setGenForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    plan: "standard",
    validityDays: 365,
  });

  // Action confirm state
  const [confirmAction, setConfirmAction] = useState({ open: false, type: "", license: null });

  // Renew modal state (with plan change option)
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewingLicense, setRenewingLicense] = useState(null);
  const [renewPlan, setRenewPlan] = useState("");
  const [renewing, setRenewing] = useState(false);

  // Initialize admin secret from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("_licenseAdminSecret");
    if (stored) {
      setAdminSecret(stored);
    }
  }, []);

  // Fetch licenses when admin secret is set
  const fetchLicenses = useCallback(async () => {
    if (!adminSecret) return;
    setLoading(true);
    try {
      const resp = await fetch(`${LICENSE_SERVER}/licenses`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
      });
      if (!resp.ok) {
        if (resp.status === 403) {
          toast.error("Invalid admin secret. Please re-enter it.");
          setAdminSecret("");
          localStorage.removeItem("_licenseAdminSecret");
          return;
        }
        throw new Error(`Server error: ${resp.status}`);
      }
      const data = await resp.json();
      setLicenses(data.licenses || []);
    } catch (err) {
      toast.error(
        `Failed to load licenses: ${err.message}. Is the license server running on ${LICENSE_SERVER}?`,
      );
    } finally {
      setLoading(false);
    }
  }, [adminSecret]);

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  // ── Admin Secret Setup ──

  function handleSaveSecret(e) {
    e.preventDefault();
    if (!secretInputValue.trim()) {
      toast.error("Admin secret is required");
      return;
    }
    localStorage.setItem("_licenseAdminSecret", secretInputValue.trim());
    setAdminSecret(secretInputValue.trim());
    setSecretInputValue("");
    toast.success("Admin secret saved");
  }

  function handleClearSecret() {
    localStorage.removeItem("_licenseAdminSecret");
    setAdminSecret("");
    setLicenses([]);
    toast.success("Admin secret cleared");
  }

  // ── Generate License ──

  async function handleGenerate(e) {
    e.preventDefault();
    if (!genForm.customerName.trim() || !genForm.customerEmail.trim()) {
      toast.error("Customer name and email are required");
      return;
    }
    setGenerating(true);
    try {
      const resp = await fetch(`${LICENSE_SERVER}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          customerName: genForm.customerName.trim(),
          customerEmail: genForm.customerEmail.trim(),
          customerPhone: genForm.customerPhone.trim() || undefined,
          plan: genForm.plan,
          validityDays: parseInt(genForm.validityDays, 10) || 365,
        }),
      });
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || "Generate failed");
      }
      const data = await resp.json();
      toast.success(`License generated: ${data.license.key}`);
      setShowGenerate(false);
      setGenForm({ customerName: "", customerEmail: "", customerPhone: "", plan: "standard", validityDays: 365 });
      await fetchLicenses();
    } catch (err) {
      toast.error(`Failed to generate license: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  // ── Renew License (with optional plan change) ──

  function openRenewModal(lic) {
    setRenewingLicense(lic);
    setRenewPlan("");
    setShowRenewModal(true);
  }

  function closeRenewModal() {
    setShowRenewModal(false);
    setRenewingLicense(null);
    setRenewPlan("");
  }

  async function handleRenewConfirm() {
    const lic = renewingLicense;
    if (!lic) return;
    setRenewing(true);
    try {
      const body = { key: lic.key, days: 365 };
      if (renewPlan) body.plan = renewPlan;

      const resp = await fetch(`${LICENSE_SERVER}/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || "Renew failed");
      }
      const data = await resp.json();
      const planMsg = renewPlan ? ` (plan: ${renewPlan})` : "";
      toast.success(`License renewed until ${data.license.expiresAt.slice(0, 10)}${planMsg}`);
      closeRenewModal();
      await fetchLicenses();
    } catch (err) {
      toast.error(`Failed to renew license: ${err.message}`);
    } finally {
      setRenewing(false);
    }
  }

  // ── Suspend License ──

  async function handleSuspendConfirm() {
    const lic = confirmAction.license;
    if (!lic) return;
    try {
      const resp = await fetch(`${LICENSE_SERVER}/suspend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({ key: lic.key }),
      });
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || "Suspend failed");
      }
      toast.success(`License ${lic.key} suspended`);
      setConfirmAction({ open: false, type: "", license: null });
      await fetchLicenses();
    } catch (err) {
      toast.error(`Failed to suspend license: ${err.message}`);
    }
  }

  // ── Copy to clipboard ──

  function handleCopyKey(key) {
    navigator.clipboard.writeText(key).then(
      () => toast.success("License key copied"),
      () => toast.error("Failed to copy"),
    );
  }

  // ── Format helpers ──

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getStatusBadge(status) {
    const styles = {
      active: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
      expired: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
      suspended: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    };
    return (
      <span
        className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${
          styles[status] || "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
        }`}
      >
        {status}
      </span>
    );
  }

  function getDaysLeft(expiresAt) {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return diff;
  }

  // ── Filtered licenses ──

  const filtered = licenses.filter((lic) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      lic.key.toLowerCase().includes(q) ||
      lic.customerName?.toLowerCase().includes(q) ||
      lic.customerEmail?.toLowerCase().includes(q) ||
      lic.customerPhone?.toLowerCase().includes(q)
    );
  });

  // ── No admin secret: show setup screen ──

  if (!adminSecret) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">License Management</h1>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-lg mb-2">Admin Authentication</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Enter your license server admin secret to manage licenses.
            This is stored locally in your browser.
          </p>
          <form onSubmit={handleSaveSecret} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Admin Secret
              </label>
              <input
                type="password"
                value={secretInputValue}
                onChange={(e) => setSecretInputValue(e.target.value)}
                placeholder="Enter your ADMIN_SECRET"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                This is the ADMIN_SECRET from your license server .env file.
                Set via the x-admin-secret header.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Connect
              </button>
            </div>
          </form>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <strong>Tip:</strong> The license server must be running at{" "}
            <code className="text-xs bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
              {LICENSE_SERVER}
            </code>
          </p>
        </div>
      </div>
    );
  }

  // ── Main dashboard ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">License Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            License server:{" "}
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
              {LICENSE_SERVER}
            </code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClearSecret}
            className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-red-300 transition-colors"
          >
            Disconnect
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Generate License
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold mt-1">{licenses.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-green-200 dark:border-green-800/40 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Active</p>
          <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
            {licenses.filter((l) => l.status === "active").length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800/40 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Expired</p>
          <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
            {licenses.filter((l) => l.status === "expired").length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-amber-200 dark:border-amber-800/40 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Suspended</p>
          <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {licenses.filter((l) => l.status === "suspended").length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or key..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Licenses table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Key</th>
                <th className="text-left py-3 px-4 font-medium">Customer</th>
                <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">Email</th>
                <th className="text-center py-3 px-4 font-medium">Status</th>
                <th className="text-center py-3 px-4 font-medium hidden md:table-cell">Expires</th>
                <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Machine</th>
                <th className="text-center py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading licenses...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    {search ? "No licenses match your search" : "No licenses found. Generate one!"}
                  </td>
                </tr>
              ) : (
                filtered.map((lic) => {
                  const daysLeft = getDaysLeft(lic.expiresAt);
                  return (
                    <tr
                      key={lic.id}
                      className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {lic.key}
                          </code>
                          <button
                            onClick={() => handleCopyKey(lic.key)}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 shrink-0"
                            title="Copy key"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                        <span className="text-xs text-gray-400 mt-0.5 block sm:hidden">
                          {lic.customerEmail}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{lic.customerName}</div>
                        {lic.customerPhone && (
                          <div className="text-xs text-gray-400">{lic.customerPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 hidden sm:table-cell">
                        {lic.customerEmail}
                      </td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(lic.status)}</td>
                      <td className="py-3 px-4 text-center hidden md:table-cell">
                        <div className="text-xs">{formatDate(lic.expiresAt)}</div>
                        {lic.status === "active" && daysLeft !== null && daysLeft <= 30 && (
                          <div className="text-xs text-amber-500 mt-0.5">{daysLeft} days left</div>
                        )}
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <code className="text-xs text-gray-500 font-mono">
                          {lic.machineId || "—"}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => {
                              openRenewModal(lic);
                            }}
                            disabled={lic.status === "suspended"}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Renew (extend by 1 year)"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleCopyKey(lic.key)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded sm:hidden"
                            title="Copy key"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setConfirmAction({ open: true, type: "suspend", license: lic });
                            }}
                            disabled={lic.status !== "active"}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Suspend license"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Generate Modal ── */}
      {showGenerate && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
          onClick={() => setShowGenerate(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Generate License Key</h2>
              <button
                onClick={() => setShowGenerate(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={genForm.customerName}
                  onChange={(e) => setGenForm({ ...genForm, customerName: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Customer Email <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="email"
                  value={genForm.customerEmail}
                  onChange={(e) => setGenForm({ ...genForm, customerEmail: e.target.value })}
                  placeholder="e.g. john@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Customer Phone
                </label>
                <input
                  value={genForm.customerPhone}
                  onChange={(e) => setGenForm({ ...genForm, customerPhone: e.target.value })}
                  placeholder="e.g. +254700000000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Validity Period
                </label>
                <select
                  value={genForm.validityDays}
                  onChange={(e) => setGenForm({ ...genForm, validityDays: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value={10}>10 days</option>
                  <option value={30}>30 days (1 month)</option>
                  <option value={90}>90 days (3 months)</option>
                  <option value={180}>180 days (6 months)</option>
                  <option value={365}>365 days (1 year)</option>
                  <option value={730}>730 days (2 years)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Plan
                </label>
                <select
                  value={genForm.plan}
                  onChange={(e) => setGenForm({ ...genForm, plan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerate(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {generating ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Renew License Modal (with plan change option) ── */}
      {showRenewModal && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
          onClick={closeRenewModal}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Renew License</h2>
              <button
                onClick={closeRenewModal}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                    {renewingLicense?.key}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Current plan: <strong>{renewingLicense?.plan || "standard"}</strong> · Expires:{" "}
                  {renewingLicense?.expiresAt
                    ? new Date(renewingLicense.expiresAt).toLocaleDateString()
                    : "—"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Change Plan (optional)
                </label>
                <select
                  value={renewPlan}
                  onChange={(e) => setRenewPlan(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">Keep current plan</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  The license will be renewed by 1 year. You can optionally change the plan.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRenewModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenewConfirm}
                  disabled={renewing}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm"
                >
                  {renewing ? "Renewing..." : "Renew License"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Action Dialog (suspend only) ── */}
      <ConfirmDialog
        open={confirmAction.open}
        title={
          confirmAction.type === "suspend"
            ? "Suspend License"
            : ""
        }
        icon={confirmAction.type === "suspend" ? "⚠️" : "🔄"}
        confirmText={
          confirmAction.type === "suspend"
            ? "Suspend"
            : ""
        }
        message={
          confirmAction.type === "suspend"
            ? `Suspend "${confirmAction.license?.key}"? The license will stop working immediately.`
            : ""
        }
        onConfirm={
          confirmAction.type === "suspend"
            ? handleSuspendConfirm
            : () => {}
        }
        onCancel={() => setConfirmAction({ open: false, type: "", license: null })}
      />
    </div>
  );
}
