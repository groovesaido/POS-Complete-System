const { contextBridge, ipcRenderer } = require("electron");

// ── License management API ──
contextBridge.exposeInMainWorld("electronLicense", {
  /** Get full cached license data from encrypted local storage */
  getCachedLicense: () => ipcRenderer.invoke("license:get-cached"),
  /** Save full license data to encrypted local storage */
  setCachedLicense: (data) => ipcRenderer.invoke("license:set-cached", data),
  /** Get stable machine identifier */
  getMachineId: () => ipcRenderer.invoke("license:get-machine-id"),
  /** Notify main process that license is valid (reload to app) */
  licenseValid: () => ipcRenderer.invoke("license:valid"),
});

// ── Auto-updater API ──
contextBridge.exposeInMainWorld("electronUpdater", {
  // Check for updates manually
  checkForUpdates: () => ipcRenderer.send("check-for-updates"),

  // Install downloaded update (quit and install)
  installUpdate: () => ipcRenderer.send("install-update"),

  // Get current app version
  getVersion: () => ipcRenderer.invoke("get-app-version"),

  // Listen for update available
  onUpdateAvailable: (callback) => {
    const listener = (_event, info) => callback(info);
    ipcRenderer.on("update-available", listener);
    return () => ipcRenderer.removeListener("update-available", listener);
  },

  // Listen for update not available (already up to date)
  onUpToDate: (callback) => {
    const listener = (_event, info) => callback(info);
    ipcRenderer.on("up-to-date", listener);
    return () => ipcRenderer.removeListener("up-to-date", listener);
  },

  // Listen for download progress
  onDownloadProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("download-progress", listener);
    return () => ipcRenderer.removeListener("download-progress", listener);
  },

  // Listen for update downloaded (ready to install)
  onUpdateDownloaded: (callback) => {
    const listener = (_event, info) => callback(info);
    ipcRenderer.on("update-downloaded", listener);
    return () => ipcRenderer.removeListener("update-downloaded", listener);
  },

  // Listen for update errors
  onUpdateError: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("update-error", listener);
    return () => ipcRenderer.removeListener("update-error", listener);
  },
});

