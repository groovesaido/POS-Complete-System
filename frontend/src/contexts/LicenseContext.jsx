import { createContext, useContext, useState, useEffect } from "react";
import LicenseActivation from "../pages/LicenseActivation";
import LicenseExpired from "../pages/LicenseExpired";

const LicenseContext = createContext(null);

const LICENSE_SERVER = import.meta.env.VITE_LICENSE_SERVER_URL || "https://licensing-server-three.vercel.app";

export function LicenseProvider({ children }) {
  const [licenseState, setLicenseState] = useState("loading"); // loading | valid | invalid | expired | offline
  const [isLicenseReady, setIsLicenseReady] = useState(false);
  const [licenseDetails, setLicenseDetails] = useState(null); // { key, customerName, expiresAt, status, daysLeft }

  useEffect(() => {
    checkLicense();
  }, []);

  async function getMachineId() {
    // In Electron, use the exposed IPC method
    if (window.electronLicense?.getMachineId) {
      try {
        return await window.electronLicense.getMachineId();
      } catch {
        // Fall through
      }
    }
    // Fallback for dev/browser
    let id = localStorage.getItem("_machineId");
    if (!id) {
      id = "dev-" + crypto.randomUUID().slice(0, 8);
      localStorage.setItem("_machineId", id);
    }
    return id;
  }

  /**
   * Read the full cached license data from encrypted local storage.
   * Falls back to old-format storage for migration.
   * Returns { key, machineId, customerName, expiresAt, status, lastValidated } or null.
   */
  async function getCachedLicense() {
    // In Electron, read from encrypted file via IPC (includes migration from old store)
    if (window.electronLicense?.getCachedLicense) {
      try {
        return await window.electronLicense.getCachedLicense();
      } catch {
        // IPC failed — fall through to localStorage below
      }
    }

    // Fallback for dev/browser (less secure, stored in localStorage)
    // Step 1: Try the new cache format
    const raw = localStorage.getItem("_licenseCache");
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // Corrupted — ignore
      }
    }

    // Step 2: Migration — check for old-format _licenseKey
    const oldKey = localStorage.getItem("_licenseKey");
    if (oldKey) {
      console.log("[License] Migrating license from old localStorage format");
      // Return just the key so the server validation path can proceed
      // The server call will write the new full-format cache
      return { key: oldKey };
    }

    return null;
  }

  /**
   * Save the full license data to encrypted local storage for offline validation.
   */
  async function setCachedLicense(data) {
    // In Electron, write to encrypted file via IPC
    if (window.electronLicense?.setCachedLicense) {
      try {
        await window.electronLicense.setCachedLicense(data);
        return;
      } catch {
        // Fall through
      }
    }
    // Fallback for dev/browser
    localStorage.setItem("_licenseCache", JSON.stringify(data));
  }

  /**
   * Validate the cached license data locally (offline check).
   * Checks:
   *   1. Cache has key, machineId, expiresAt, status
   *   2. Machine ID matches (license is bound to this device)
   *   3. Status is "active"
   *   4. Not expired
   */
  async function validateOffline(cached) {
    if (!cached || !cached.key || !cached.expiresAt || !cached.machineId) {
      return { valid: false, reason: "Incomplete cached license data" };
    }

    // Verify machine binding
    const mid = await getMachineId();
    if (cached.machineId !== mid) {
      return { valid: false, reason: "License is bound to a different machine" };
    }

    // Check status
    if (cached.status === "suspended") {
      return { valid: false, reason: "License has been suspended" };
    }

    // Check expiry
    const now = new Date();
    const expiry = new Date(cached.expiresAt);
    if (expiry <= now || cached.status === "expired") {
      return { valid: false, reason: "License has expired", expiresAt: cached.expiresAt };
    }

    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    return {
      valid: true,
      key: cached.key,
      customerName: cached.customerName || "",
      expiresAt: cached.expiresAt,
      daysLeft,
    };
  }

  async function checkLicense() {
    try {
      // Step 1: Try to get the cached license (may be null if never activated)
      const cached = await getCachedLicense();

      // Step 2: Try to validate with the license server
      // If the server is reachable, use that as the source of truth
      let serverReachable = true;
      let serverData = null;

      if (cached && cached.key) {
        const mid = await getMachineId();

        try {
          const resp = await fetch(`${LICENSE_SERVER}/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: cached.key, machineId: mid }),
            signal: AbortSignal.timeout(5000), // 5s timeout
          });

          serverData = await resp.json();
        } catch {
          // Server unreachable — fall back to offline check
          serverReachable = false;
        }
      } else {
        // No cached key — server is irrelevant at this point
        serverReachable = false;
      }

      if (serverReachable && serverData) {
        // Server validation succeeded — use server data
        if (serverData.valid) {
          const now = new Date();
          const expiry = new Date(serverData.expiresAt);
          const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

          // Cache the full license data locally for offline use
          await setCachedLicense({
            key: cached.key,
            machineId: await getMachineId(),
            customerName: serverData.customerName || "",
            expiresAt: serverData.expiresAt,
            status: "active",
            plan: serverData.plan || "standard",
            lastValidated: new Date().toISOString(),
          });

          setLicenseDetails({
            key: cached.key,
            customerName: serverData.customerName || "",
            expiresAt: serverData.expiresAt,
            daysLeft,
            plan: serverData.plan || "standard",
          });

          if (daysLeft <= 0) {
            setLicenseState("expired");
          } else {
            setLicenseState("valid");
          }
        } else {
          if (serverData.reason?.toLowerCase().includes("expired")) {
            setLicenseState("expired");
          setLicenseDetails({
            key: cached.key,
            customerName: "",
            expiresAt: serverData.expiresAt,
            daysLeft: 0,
            plan: serverData.plan || "standard",
          });
          } else {
            setLicenseState("invalid");
          }
        }
      } else {
        // Server unreachable (or no cached key) — try offline validation
        if (cached) {
          const offlineResult = await validateOffline(cached);

          if (offlineResult.valid) {
            console.log("[License] Server unreachable — using cached license (valid offline)");
            setLicenseDetails({
              key: offlineResult.key,
              customerName: offlineResult.customerName,
              expiresAt: offlineResult.expiresAt,
              daysLeft: offlineResult.daysLeft,
              plan: cached.plan || "standard",
              offline: true,
            });
            setLicenseState("valid");
          } else if (offlineResult.reason?.toLowerCase().includes("expired")) {
            console.warn("[License] Cached license has expired — requires internet to renew");
            setLicenseDetails({
              key: cached.key,
              customerName: cached.customerName || "",
              expiresAt: offlineResult.expiresAt || cached.expiresAt,
              daysLeft: 0,
              plan: cached.plan || "standard",
              offline: true,
            });
            setLicenseState("expired");
          } else {
            // Other reason (suspended, wrong machine) — invalid
            console.warn("[License] Cached license invalid:", offlineResult.reason);
            setLicenseState("invalid");
          }
        } else {
          // No cached license at all — first-time setup
          setLicenseState("invalid");
        }
      }
    } catch (err) {
      console.error("[License] Check error:", err.message);
      setLicenseState("invalid");
    } finally {
      setIsLicenseReady(true);
    }
  }

  // While checking, render nothing (or a loading screen)
  if (licenseState === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center" style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
        <div className="text-center">
          <div className="animate-pulse text-amber-500 text-lg">Checking license...</div>
          <div className="mt-4 flex justify-center gap-1">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  // Invalid/unactivated — show activation screen
  if (licenseState === "invalid") {
    return (
      <LicenseContext.Provider value={{ licenseState, isLicenseReady, licenseDetails }}>
        <LicenseActivation />
      </LicenseContext.Provider>
    );
  }

  // Expired — show expired screen
  if (licenseState === "expired") {
    return (
      <LicenseContext.Provider value={{ licenseState, isLicenseReady, licenseDetails }}>
        <LicenseExpired />
      </LicenseContext.Provider>
    );
  }

  // Valid — render the app
  return (
    <LicenseContext.Provider value={{ licenseState, isLicenseReady, licenseDetails }}>
      {children}
    </LicenseContext.Provider>
  );
}

export const useLicense = () => {
  const ctx = useContext(LicenseContext);
  if (!ctx) {
    return { isLicenseReady: true, licenseState: "valid", licenseDetails: null };
  }
  return ctx;
};
