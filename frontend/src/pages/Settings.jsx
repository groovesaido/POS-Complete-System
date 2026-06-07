import { useState, useEffect, useCallback, useRef } from "react";
import { settingsAPI } from "../services/api";
import toast from "react-hot-toast";

// ── Preload API type guard ──
const updater = window.electronUpdater;

export default function Settings() {
  const [settings, setSettings] = useState({
    store_name: "",
    store_phone: "",
    store_email: "",
    store_address: "",
    tax_rate: "16",
    currency: "KES",
    mpesa_callback_url: "",
    sound_enabled: "true",
  });

  const [mpesaAccounts, setMpesaAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMpesaForm, setShowMpesaForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [networkInfoLoading, setNetworkInfoLoading] = useState(true);

  // ── Update State ──
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [updateStatus, setUpdateStatus] = useState("idle"); // idle | checking | available | downloading | downloaded | error | uptodate
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateError, setUpdateError] = useState(null);

  const [mpesaForm, setMpesaForm] = useState({
    name: "",
    type: "paybill",
    number: "",
    consumerKey: "",
    consumerSecret: "",
    passKey: "",
    isDefault: false,
    useSandbox: true,
  });

  const uptodateTimerRef = useRef(null);

  // ── Updater IPC Listeners ──
  useEffect(() => {
    if (!updater) return;

    // Get version
    updater.getVersion().then(setAppVersion).catch(() => {});

    // Listen for events
    const unsubAvailable = updater.onUpdateAvailable((info) => {
      setUpdateStatus("available");
      setUpdateInfo(info);
      toast.success(
        `Update v${info.version} available — downloading...`,
        { duration: 4000 },
      );
      // Auto-download in background (electron-updater handles this)
    });

    const unsubDownloaded = updater.onUpdateDownloaded((info) => {
      setUpdateStatus("downloaded");
      setUpdateInfo(info);
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <span>
              Update v{info.version} ready to install!
            </span>
            <button
              onClick={() => {
                updater.installUpdate();
                toast.dismiss(t.id);
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Restart Now
            </button>
          </div>
        ),
        { duration: 60000 },
      );
    });

    const unsubProgress = updater.onDownloadProgress((progress) => {
      setUpdateStatus("downloading");
      setDownloadProgress(progress.percent || 0);
    });

    const unsubUpToDate = updater.onUpToDate(() => {
      setUpdateStatus("uptodate");
      setUpdateError(null);
      uptodateTimerRef.current = setTimeout(() => setUpdateStatus("idle"), 5000);
    });

    const unsubError = updater.onUpdateError((message) => {
      setUpdateStatus("error");
      setUpdateError(message);
    });

    return () => {
      unsubAvailable();
      unsubDownloaded();
      unsubProgress();
      unsubUpToDate();
      unsubError();
      if (uptodateTimerRef.current) {
        clearTimeout(uptodateTimerRef.current);
        uptodateTimerRef.current = null;
      }
    };
  }, []);

  const handleCheckUpdates = useCallback(() => {
    if (!updater) return;
    setUpdateStatus("checking");
    setUpdateError(null);
    updater.checkForUpdates();
  }, []);

  useEffect(() => {
    loadSettings();
    loadNetworkInfo();
  }, []);

  const loadNetworkInfo = async () => {
    try {
      const { data } = await settingsAPI.getNetworkInfo();
      setNetworkInfo(data);
    } catch {
      setNetworkInfo(null);
    } finally {
      setNetworkInfoLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { data } = await settingsAPI.getAll();
      setSettings((prev) => ({ ...prev, ...data }));

      // Load M-Pesa accounts from settings
      if (data.mpesa_accounts) {
        try {
          setMpesaAccounts(JSON.parse(data.mpesa_accounts));
        } catch {
          setMpesaAccounts([]);
        }
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Include M-Pesa accounts as JSON string in settings
      const payload = {
        ...settings,
        mpesa_accounts: JSON.stringify(mpesaAccounts),
      };
      await settingsAPI.update(payload);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      const { data } = await settingsAPI.backup();
      toast.success(`Backup created: ${data.path}`);
    } catch {
      toast.error("Backup failed");
    }
  };

  // M-Pesa account management
  const resetForm = () => {
    setMpesaForm({
      name: "",
      type: "paybill",
      number: "",
      consumerKey: "",
      consumerSecret: "",
      passKey: "",
      isDefault: false,
      useSandbox: true,
    });
    setEditingAccount(null);
    setShowMpesaForm(false);
  };

  const handleEditAccount = (account) => {
    setMpesaForm({
      name: account.name,
      type: account.type,
      number: account.number,
      consumerKey: account.consumerKey,
      consumerSecret: account.consumerSecret,
      passKey: account.passKey,
      isDefault: account.isDefault || false,
      useSandbox: account.useSandbox !== false,
    });
    setEditingAccount(account);
    setShowMpesaForm(true);
  };

  const handleSaveMpesaAccount = (e) => {
    e.preventDefault();

    if (!mpesaForm.name.trim() || !mpesaForm.number.trim()) {
      toast.error("Account name and number are required.");
      return;
    }

    let updatedAccounts;
    if (editingAccount) {
      updatedAccounts = mpesaAccounts.map((a) =>
        a.id === editingAccount.id
          ? { ...mpesaForm, id: editingAccount.id }
          : a,
      );
    } else {
      const newAccount = {
        ...mpesaForm,
        id: Date.now().toString(),
      };
      updatedAccounts = [...mpesaAccounts, newAccount];
    }

    // If this account is set as default, unset others
    if (mpesaForm.isDefault) {
      updatedAccounts = updatedAccounts.map((a) => ({
        ...a,
        isDefault: a.id === (editingAccount?.id || Date.now().toString()),
      }));
    }

    setMpesaAccounts(updatedAccounts);
    resetForm();
    toast.success(editingAccount ? "Account updated" : "Account added");
  };

  const handleDeleteAccount = (accountId) => {
    if (!window.confirm("Delete this M-Pesa account?")) return;
    setMpesaAccounts((prev) => prev.filter((a) => a.id !== accountId));
    toast.success("Account removed");
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">Loading settings...</div>
    );
  }

  const AccountForm = () => (
    <form
      onSubmit={handleSaveMpesaAccount}
      className="space-y-4 border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/10"
    >
      <h4 className="font-medium text-sm">
        {editingAccount ? "Edit M-Pesa Account" : "Add M-Pesa Account"}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Account Name</label>
          <input
            value={mpesaForm.name}
            onChange={(e) =>
              setMpesaForm((p) => ({ ...p, name: e.target.value }))
            }
            placeholder="e.g. Main Paybill"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Account Type</label>
          <select
            value={mpesaForm.type}
            onChange={(e) =>
              setMpesaForm((p) => ({ ...p, type: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            <option value="paybill">Paybill</option>
            <option value="till">Till Number</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            {mpesaForm.type === "paybill" ? "Paybill Number" : "Till Number"}
          </label>
          <input
            value={mpesaForm.number}
            onChange={(e) =>
              setMpesaForm((p) => ({ ...p, number: e.target.value }))
            }
            placeholder="e.g. 174379"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Consumer Key</label>
          <input
            value={mpesaForm.consumerKey}
            onChange={(e) =>
              setMpesaForm((p) => ({ ...p, consumerKey: e.target.value }))
            }
            placeholder="From Daraja API"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Consumer Secret
          </label>
          <input
            value={mpesaForm.consumerSecret}
            onChange={(e) =>
              setMpesaForm((p) => ({ ...p, consumerSecret: e.target.value }))
            }
            type="password"
            placeholder="From Daraja API"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Pass Key</label>
          <input
            value={mpesaForm.passKey}
            onChange={(e) =>
              setMpesaForm((p) => ({ ...p, passKey: e.target.value }))
            }
            type="password"
            placeholder="Lipa na M-Pesa Online passkey"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mpesaForm.isDefault}
              onChange={(e) =>
                setMpesaForm((p) => ({ ...p, isDefault: e.target.checked }))
              }
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Set as default
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mpesaForm.useSandbox}
              onChange={(e) =>
                setMpesaForm((p) => ({ ...p, useSandbox: e.target.checked }))
              }
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Use sandbox (test)
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={resetForm}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          {editingAccount ? "Update" : "Add"} Account
        </button>
      </div>
    </form>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Store Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Store Name
              </label>
              <input
                value={settings.store_name}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, store_name: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                value={settings.store_phone}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, store_phone: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={settings.store_email}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, store_email: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <textarea
                value={settings.store_address}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, store_address: e.target.value }))
                }
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Tax Rate (%)
              </label>
              <input
                type="number"
                value={settings.tax_rate}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, tax_rate: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <input
                value={settings.currency}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, currency: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Sound Settings */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
            <h3 className="font-medium text-sm mb-3">
              🔊 Sound &amp; Notifications
            </h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.sound_enabled !== "false"}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    sound_enabled: e.target.checked ? "true" : "false",
                  }))
                }
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium">Enable POS sounds</span>
                <p className="text-xs text-gray-500">
                  Play scan notification and cash register sounds during
                  checkout
                </p>
              </div>
            </label>
          </div>

          {/* M-Pesa Callback URL */}
          <div>
            <label className="block text-sm font-medium mb-1">
              M-Pesa Callback URL
            </label>
            <input
              value={settings.mpesa_callback_url}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  mpesa_callback_url: e.target.value,
                }))
              }
              placeholder="e.g. https://your-domain.com/api/mpesa/callback (leave blank to auto-detect)"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Public URL for M-Pesa to send payment callbacks. Use ngrok in
              development.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>

      {/* M-Pesa Accounts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">📱 M-Pesa Accounts</h2>
          <button
            onClick={() => setShowMpesaForm(true)}
            disabled={showMpesaForm}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            + Add Account
          </button>
        </div>

        {showMpesaForm && <AccountForm />}

        {mpesaAccounts.length === 0 && !showMpesaForm && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">📱</p>
            <p className="text-sm">No M-Pesa accounts configured</p>
            <p className="text-xs">
              Add a Paybill or Till number to accept M-Pesa payments
            </p>
          </div>
        )}

        {mpesaAccounts.length > 0 && (
          <div className="space-y-3">
            {mpesaAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{account.name}</span>
                    {account.isDefault && (
                      <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded">
                        Default
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded-full ${account.useSandbox ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600" : "bg-green-100 dark:bg-green-900/30 text-green-600"}`}
                    >
                      {account.useSandbox ? "Sandbox" : "Live"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {account.type === "paybill" ? "🏢 Paybill" : "🏪 Till"} ·{" "}
                    {account.number}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleEditAccount(account)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-sm"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 mt-3">
          You can add multiple Paybill or Till numbers. The default account will
          be used for POS transactions. Get your API credentials from the{" "}
          <a
            href="https://developer.safaricom.co.ke"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Safaricom Developer Portal
          </a>
          .
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-lg mb-4">Database</h2>
        <button
          onClick={handleBackup}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          📦 Backup Database
        </button>
      </div>

      {/* Auto-Updates Section */}
      {updater && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">🔄 Updates</h2>
            <span className="text-xs text-gray-500">v{appVersion}</span>
          </div>

          {/* Status display */}
          {updateStatus !== "idle" && (
            <div className="mb-4">
              {updateStatus === "checking" && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Checking for updates...</span>
                </div>
              )}
              {updateStatus === "uptodate" && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <span>✓</span>
                  <span>You're on the latest version!</span>
                </div>
              )}
              {updateStatus === "available" && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <span>📥</span>
                  <span>Downloading v{updateInfo?.version}...</span>
                </div>
              )}
              {updateStatus === "downloading" && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <span>⬇️</span>
                    <span>Downloading update... {Math.round(downloadProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {updateStatus === "downloaded" && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <span>✅</span>
                  <span>
                    Update v{updateInfo?.version} ready!{" "}
                    <button
                      onClick={() => updater.installUpdate()}
                      className="underline font-medium hover:text-green-700"
                    >
                      Restart now
                    </button>
                  </span>
                </div>
              )}
              {updateStatus === "error" && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <span>⚠️</span>
                  <span>
                    Update check failed:{" "}
                    {updateError || "Unknown error"}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleCheckUpdates}
            disabled={updateStatus === "checking" || updateStatus === "downloading"}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateStatus === "checking"
              ? "Checking..."
              : "Check for Updates"}
          </button>

          <p className="text-xs text-gray-500 mt-2">
            Updates are checked automatically on startup. You can also check
            manually here.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-lg mb-4">System Info</h2>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>Version: {appVersion}</p>
          <p>Database: SQLite</p>
          <p>Authentication: JWT + bcrypt</p>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
            <h3 className="font-medium text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-2">
              Network
            </h3>
            {networkInfoLoading ? (
              <p className="text-xs text-gray-400">Detecting network...</p>
            ) : networkInfo ? (
              <>
                <p className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="font-mono">{networkInfo.ipv4}</span>
                  <span className="text-xs text-gray-400">(IPv4)</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Hostname: {networkInfo.hostname}
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-500">
                Could not detect network address
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-lg mb-4">Developer Info</h2>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>BytheBuzz Tech</p>
          <p>contact: 0793682713</p>
          <p>Email: Bythebuzztech@gmail.com</p>
        </div>
      </div>
    </div>
  );
}
