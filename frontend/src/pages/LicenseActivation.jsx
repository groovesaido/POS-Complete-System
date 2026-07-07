import { useState, useEffect, useRef } from "react";
import ContactDialog from "../components/ContactDialog";

const LICENSE_SERVER = import.meta.env.VITE_LICENSE_SERVER_URL || "https://licensing-server-three.vercel.app";

export default function LicenseActivation() {
  const [step, setStep] = useState("activate"); // activate | success
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [daysLeft, setDaysLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (step === "activate" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  async function getMachineId() {
    if (window.electronLicense?.getMachineId) {
      try {
        return await window.electronLicense.getMachineId();
      } catch {
        // Fall through
      }
    }
    let id = localStorage.getItem("_machineId");
    if (!id) {
      id = "dev-" + crypto.randomUUID().slice(0, 8);
      localStorage.setItem("_machineId", id);
    }
    return id;
  }

  async function handleActivate(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const key = licenseKey.trim().toUpperCase();
      const mid = await getMachineId();

      if (!/^BUZZ-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(key)) {
        setError("Invalid format. Use: BUZZ-XXXX-XXXX-XXXX");
        setLoading(false);
        return;
      }

      const resp = await fetch(`${LICENSE_SERVER}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, machineId: mid }),
      });

      const data = await resp.json();

      if (data.success) {
        setExpiresAt(data.expiresAt);
        setCustomerName(data.customerName || "");
        setStep("success");

        // Cache full license data for offline validation
        const cacheData = {
          key,
          machineId: mid,
          customerName: data.customerName || "",
          expiresAt: data.expiresAt,
          status: "active",
          plan: data.plan || "standard",
          lastValidated: new Date().toISOString(),
        };

        if (window.electronLicense?.setCachedLicense) {
          await window.electronLicense.setCachedLicense(cacheData);
        } else {
          localStorage.setItem("_licenseCache", JSON.stringify(cacheData));
        }

        // Also store just the key in localStorage for quick reference
        localStorage.setItem("_licenseKey", key);

        const now = new Date();
        const expiry = new Date(data.expiresAt);
        const remaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        setDaysLeft(remaining);
      } else {
        setError(data.reason || "Activation failed");
      }
    } catch (err) {
      setError("Could not reach license server. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyInput(e) {
    let val = e.target.value.toUpperCase();
    const cleaned = val.replace(/[^A-Z0-9]/g, "");
    let formatted = "";
    for (let i = 0; i < cleaned.length; i++) {
      if (i > 0 && i % 4 === 0 && formatted.length < 15) {
        formatted += "-";
      }
      formatted += cleaned[i];
    }
    setLicenseKey(formatted);
    setError("");
  }

  function handleRetry() {
    setError("");
    window.location.reload();
  }

  // ── Success state ──
  if (step === "success") {
    const showExpiryWarning = daysLeft <= 30;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            {/* Success icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 border-2 border-green-400/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">License Activated</h1>

            {customerName && (
              <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">
                Welcome, <span className="text-blue-600 dark:text-blue-400 font-semibold">{customerName}</span>
              </p>
            )}

            {/* License key display */}
            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider font-medium">Active License</div>
              <div className="text-blue-600 dark:text-blue-400 text-sm tracking-wider font-bold font-mono">{licenseKey}</div>
            </div>

            {/* Expiry info */}
            {expiresAt && (
              <div className={`bg-gray-50 dark:bg-gray-700/50 border rounded-lg p-4 mb-6 ${showExpiryWarning ? 'border-amber-300 dark:border-amber-600/50' : 'border-gray-200 dark:border-gray-600'}`}>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider font-medium">Subscription</div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-gray-300 text-sm">
                    {showExpiryWarning ? "Expires" : "Valid until"}
                  </span>
                  <span className={`text-sm font-semibold ${showExpiryWarning ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                    {new Date(expiresAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {showExpiryWarning && (
                  <div className="mt-2 text-xs text-amber-600 dark:text-amber-400/80 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Your subscription expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            )}

            {/* Launch button */}
            <button
              onClick={() => {
                if (window.electronLicense?.licenseValid) {
                  window.electronLicense.licenseValid();
                } else {
                  window.location.hash = "#/login";
                  window.location.reload();
                }
              }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
            >
              Launch POS
            </button>

            {/* Support */}
            <div className="mt-6 text-center">
              <p className="text-gray-400 dark:text-gray-500 text-xs">
                Need help?{" "}
                <button
                  onClick={() => setShowContactDialog(true)}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer inline"
                >
                  Contact us
                </button>
              </p>
            </div>
          </div>
        </div>

        <ContactDialog show={showContactDialog} onClose={() => setShowContactDialog(false)} />
      </div>
    );
  }

  // ── Activate state ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <img src="./icons/pos-icon.png" alt="" className="w-14 h-14 mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Bythebuzz POS
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              License Activation
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 dark:text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Info text */}
          <div className="text-gray-500 dark:text-gray-400 text-xs mb-6 leading-relaxed">
            Enter your license key to activate this installation. Each license is tied to one machine.
          </div>

          <form onSubmit={handleActivate}>
            {/* License input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                License Key
              </label>
              <input
                ref={inputRef}
                type="text"
                value={licenseKey}
                onChange={handleKeyInput}
                placeholder="BUZZ-XXXX-XXXX-XXXX"
                maxLength={19}
                disabled={loading}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50"
              />
            </div>

            {/* Activate button */}
            <button
              type="submit"
              disabled={loading || licenseKey.length < 19}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
              ) : null}
              {loading ? "Activating..." : "Activate"}
            </button>
          </form>

          {/* Retry link */}
          {error && (
            <div className="mt-3 text-center">
              <button
                onClick={handleRetry}
                className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
              >
                Retry connection
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="my-6 border-t border-gray-200 dark:border-gray-700" />

          {/* Support */}
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">
              Don't have a license key?
            </p>
            <button
              onClick={() => setShowContactDialog(true)}
              className="text-blue-600 dark:text-blue-400 hover:underline text-xs cursor-pointer"
            >
              Contact us to purchase
            </button>
          </div>
        </div>

        <ContactDialog show={showContactDialog} onClose={() => setShowContactDialog(false)} />
      </div>
    </div>
  );
}
