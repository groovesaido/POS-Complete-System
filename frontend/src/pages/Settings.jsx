import { useState, useEffect, useCallback, useRef } from "react";
import { settingsAPI } from "../services/api";
import toast from "react-hot-toast";
import MpesaAccountForm from "../components/MpesaAccountForm";
import ConfirmDialog from "../components/ConfirmDialog";
import { useLicense } from "../contexts/LicenseContext";

// ── Preload API type guard ──
const updater = window.electronUpdater;

export default function Settings() {
  const { licenseDetails } = useLicense();
  const licensePlan = licenseDetails?.plan || "standard";

  const [settings, setSettings] = useState({
    store_name: "",
    store_phone: "",
    store_email: "",
    store_address: "",
    tax_rate: "16",
    currency: "KES",
    mpesa_callback_url: "",
    sound_enabled: "true",
    auto_backup_enabled: "true",
    auto_backup_retention_days: "30",
    auto_backup_last_run: "",
  });

  const [mpesaAccounts, setMpesaAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMpesaForm, setShowMpesaForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [networkInfoLoading, setNetworkInfoLoading] = useState(true);

  // ── Database Backup & Restore State ──
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState({ open: false, filename: null });

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

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true);
    try {
      const { data } = await settingsAPI.listBackups();
      setBackups(data.backups || []);
    } catch {
      toast.error("Failed to load backups");
    } finally {
      setBackupsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadNetworkInfo();
    loadBackups();
  }, [loadBackups]);

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
    setBackingUp(true);
    try {
      const { data } = await settingsAPI.backup();
      toast.success(`Backup created`);
      await loadBackups();
    } catch {
      toast.error("Backup failed");
    } finally {
      setBackingUp(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  const handleRestoreClick = (filename) => {
    setRestoreConfirm({ open: true, filename });
  };

  const handleRestoreConfirm = async () => {
    const filename = restoreConfirm.filename;
    if (!filename) return;
    setRestoreConfirm({ open: false, filename: null });
    setRestoring(filename);
    try {
      const { data } = await settingsAPI.restore(filename);
      if (data.needsRestart) {
        toast.error(data.error || "Restore failed — database may be incompatible.");
      } else {
        toast.success(`Restored from "${filename}"`, { duration: 5000 });
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Restore failed";
      toast.error(msg);
    } finally {
      setRestoring(null);
    }
  };

  const handleRestoreCancel = () => {
    setRestoreConfirm({ open: false, filename: null });
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

  const saveMpesaAccountsToBackend = async (accounts) => {
    try {
      await settingsAPI.update({
        ...settings,
        mpesa_accounts: JSON.stringify(accounts),
      });
    } catch {
      toast.error("Failed to save M-Pesa accounts");
    }
  };

  const handleSaveMpesaAccount = async (e) => {
    e.preventDefault();

    if (!mpesaForm.name.trim() || !mpesaForm.number.trim()) {
      toast.error("Account name and number are required.");
      return;
    }

    let updatedAccounts;
    let newId;
    if (editingAccount) {
      updatedAccounts = mpesaAccounts.map((a) =>
        a.id === editingAccount.id
          ? { ...mpesaForm, id: editingAccount.id }
          : a,
      );
    } else {
      newId = Date.now().toString();
      const newAccount = {
        ...mpesaForm,
        id: newId,
      };
      updatedAccounts = [...mpesaAccounts, newAccount];
    }

    // If this account is set as default, unset others
    if (mpesaForm.isDefault) {
      updatedAccounts = updatedAccounts.map((a) => ({
        ...a,
        isDefault: a.id === (editingAccount?.id || newId),
      }));
    }

    setMpesaAccounts(updatedAccounts);
    resetForm();
    await saveMpesaAccountsToBackend(updatedAccounts);
    toast.success(editingAccount ? "Account updated" : "Account added");
  };

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm("Delete this M-Pesa account?")) return;
    const updated = mpesaAccounts.filter((a) => a.id !== accountId);
    setMpesaAccounts(updated);
    await saveMpesaAccountsToBackend(updated);
    toast.success("Account removed");
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">Loading settings...</div>
    );
  }

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
            <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
              <img src="./icons/notification-icon.png" alt="" className="w-4 h-4" /> Sound &amp; Notifications
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

          {licensePlan === "premium" && (
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
          )}

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

      {/* M-Pesa Accounts Section - only shown for premium plan */}
      {licensePlan === "premium" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2"><img src="./icons/phone-icon.png" alt="" className="w-5 h-5" /> M-Pesa Accounts</h2>
            <button
              onClick={() => setShowMpesaForm(true)}
              disabled={showMpesaForm}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              + Add Account
            </button>
          </div>

          {showMpesaForm && (
            <MpesaAccountForm
              form={mpesaForm}
              editingAccount={editingAccount}
              onChange={setMpesaForm}
              onSubmit={handleSaveMpesaAccount}
              onCancel={resetForm}
            />
          )}

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
                      {account.type === "paybill" ? "Paybill" : "Till"} ·{" "}
                      {account.number}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEditAccount(account)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-sm"
                    >
                      <img src="./icons/edit-icon.png" alt="Edit" className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(account.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-sm"
                    >
                      <img src="./icons/delete-icon.png" alt="Delete" className="w-5 h-5" />
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
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><img src="./icons/database-icon.png" alt="" className="w-5 h-5" /> Database</h2>

        {/* Auto-backup toggle & retention */}
        <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.auto_backup_enabled !== "false"}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  auto_backup_enabled: e.target.checked ? "true" : "false",
                }))
              }
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium">
                Auto-backup once daily
              </span>
              {settings.auto_backup_last_run && (
                <p className="text-xs text-gray-500">
                  Last auto-backup:{" "}
                  {new Date(
                    settings.auto_backup_last_run,
                  ).toLocaleString()}
                </p>
              )}
            </div>
          </label>

          <div className="flex items-center gap-3 pl-8">
            <label className="text-xs text-gray-500 whitespace-nowrap">
              Keep auto-backups for
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={settings.auto_backup_retention_days || "30"}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  auto_backup_retention_days: e.target.value,
                }))
              }
              className="w-20 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-center"
            />
            <span className="text-xs text-gray-500">days</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-5">
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {backingUp ? "Creating backup..." : <><img src="./icons/database-icon.png" alt="" className="w-4 h-4" /> Backup Database</>}
          </button>
          <button
            onClick={loadBackups}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <img src="./icons/refresh-icon.png" alt="" className="w-4 h-4" /> Refresh Backups
          </button>
        </div>

        {backups.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Available Backups
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    backup.filename.startsWith("auto-backup-")
                      ? "border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium truncate">
                      {backup.filename.startsWith("auto-backup-") && (
                        <img src="./icons/update-icon.png" alt="Auto-backup" className="w-3.5 h-3.5 mr-1.5 inline" />
                      )}
                      {backup.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(backup.size)} ·{" "}
                      {new Date(backup.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestoreClick(backup.filename)}
                    disabled={restoring === backup.filename}
                    className="shrink-0 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {restoring === backup.filename
                      ? "Restoring..."
                      : "Restore"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {backups.length === 0 && !backupsLoading && (
          <p className="text-sm text-gray-400 text-center py-4">
            No backups found. Create one with the button above.
          </p>
        )}

        {backupsLoading && (
          <p className="text-sm text-gray-400 text-center py-4">
            Loading backups...
          </p>
        )}
      </div>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        open={restoreConfirm.open}
        title="Restore Database Backup"
        icon="⚠️"
        confirmText="Restore"
        message={`Restore from "${restoreConfirm.filename}"? This will replace the current database with the backup.`}
        onConfirm={handleRestoreConfirm}
        onCancel={handleRestoreCancel}
      />

      {/* Auto-Updates Section */}
      {updater && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2"><img src="./icons/update-icon.png" alt="" className="w-5 h-5" /> Updates</h2>
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
                  <img src="./icons/update-icon.png" alt="" className="w-4 h-4" />
                  <span>Downloading v{updateInfo?.version}...</span>
                </div>
              )}
              {updateStatus === "downloading" && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <img src="./icons/update-icon.png" alt="" className="w-4 h-4" />
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
