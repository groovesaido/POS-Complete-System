const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const http = require("http");
const fs = require("fs");

let backendProcess = null;
const isDev = !app.isPackaged;

function createLoadingWindow() {
  const win = new BrowserWindow({ width: 400, height: 300, frame: false });
  win.loadURL(
    `data:text/html,<body style="background:#1a1a2e;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:white"><div style="text-align:center"><h2>BytheBuzz POS</h2><p>Starting...</p></div></body>`,
  );
  return win;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    // In development, load from Vite dev server for hot reload
    win.loadURL("http://localhost:3000");
  } else {
    // In production, load from built frontend files
    win.loadFile(path.join(__dirname, "frontend/dist/index.html"));
  }

  //win.webContents.openDevTools();
}

function waitForBackend(loader, retries = 30) {
  http
    .get("http://localhost:5000/api/health", (res) => {
      if (res.statusCode === 200) {
        console.log("Backend is ready!");
        createWindow();
        loader.close();
      } else {
        retry(loader, retries);
      }
    })
    .on("error", () => {
      retry(loader, retries);
    });
}

function retry(loader, retries) {
  if (retries <= 0) {
    console.error("Backend failed to start after max retries");
    createWindow();
    loader.close();
    return;
  }
  setTimeout(() => waitForBackend(loader, retries - 1), 1000);
}

function startBackend(loader) {
  if (isDev) {
    // In development, backend is already started by `npm run backend` / nodemon
    // No need to spawn backend.exe - just wait for it to be ready
    console.log("[Dev] Waiting for backend on localhost:5000...");
    waitForBackend(loader);
    return;
  }

  // Production mode - spawn backend.exe from resources
  const backendPath = path.join(process.resourcesPath, "backend.exe");

  const logFile = path.join(app.getPath("userData"), "backend.log");
  const out = fs.openSync(logFile, "a");
  const err = fs.openSync(logFile, "a");

  console.log(`[Prod] Starting backend from: ${backendPath}`);

  backendProcess = spawn(backendPath, [], {
    detached: false,
    stdio: ["ignore", out, err],
    env: {
      ...process.env,
      NODE_ENV: "production",
      USER_DATA_DIR: app.getPath("userData"),
    },
  });

  backendProcess.on("error", (err) => {
    console.error("Backend failed to start:", err);
  });

  setTimeout(() => waitForBackend(loader), 10000);
}

// ── Backend process cleanup ──
function killBackend() {
  if (!backendProcess) return;
  try {
    console.log("[Main] Shutting down backend process...");
    const pid = backendProcess.pid;

    // On Windows, use taskkill to force-kill the entire process tree
    if (process.platform === "win32") {
      try {
        execSync(`taskkill /f /t /pid ${pid} 2>nul`, { stdio: "ignore" });
      } catch (killErr) {
        console.error("[Main] taskkill failed, falling back to process.kill():", killErr.message);
        backendProcess.kill();
      }
    } else {
      // Send SIGTERM first, then SIGKILL after a timeout if still alive
      backendProcess.kill("SIGTERM");
    }
  } catch (err) {
    console.error("[Main] Error killing backend:", err.message);
  } finally {
    backendProcess = null;
  }
}

// Reliable backend cleanup — will-quit fires in all quit scenarios
app.on("will-quit", () => {
  killBackend();
});

// Emergency fallback if the main process exits abruptly (crash, SIGTERM, etc.)
process.on("exit", () => {
  if (backendProcess) {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /f /t /pid ${backendProcess.pid} 2>nul`, { stdio: "ignore" });
      } else {
        backendProcess.kill("SIGKILL");
      }
    } catch { /* process is already exiting, best-effort only */ }
  }
});

// Handle Ctrl+C / SIGTERM in dev mode (terminal)
process.on("SIGINT", () => {
  killBackend();
  app.quit();
});
process.on("SIGTERM", () => {
  killBackend();
  app.quit();
});

app.whenReady().then(() => {
  const loader = createLoadingWindow();
  startBackend(loader);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Clear stale process reference, then restart backend
    backendProcess = null;
    const loader = createLoadingWindow();
    startBackend(loader);
  }
});
