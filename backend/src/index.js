const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { PrismaClient } = require("@prisma/client");

// Load .env file if present — allows setting JWT_SECRET, DATABASE_URL, etc.
try {
  require("dotenv").config();
} catch { /* dotenv not available in packaged builds */ }

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categories");
const userRoutes = require("./routes/users");
const transactionRoutes = require("./routes/transactions");
const reportRoutes = require("./routes/reports");
const dashboardRoutes = require("./routes/dashboard");
const settingsRoutes = require("./routes/settings");
const uploadRoutes = require("./routes/upload");
const mpesaRoutes = require("./routes/mpesa");
const scannerRoutes = require("./routes/scanner");

const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");

// ── JWT_SECRET fallback ──
// Always persist the generated secret to a file so tokens survive restarts,
// regardless of environment (dev, production/Electron, pkg).
// Users can also set JWT_SECRET in a .env file or environment variable.
if (!process.env.JWT_SECRET) {
  // Determine a writable directory to persist the JWT secret
  const secretDir = process.env.USER_DATA_DIR || path.join(__dirname, "..");
  const jwtSecretFile = path.join(secretDir, ".jwt_secret");

  if (fs.existsSync(jwtSecretFile)) {
    process.env.JWT_SECRET = fs.readFileSync(jwtSecretFile, "utf8").trim();
    console.log("[Backend] JWT_SECRET loaded from persisted file:", jwtSecretFile);
  } else {
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    try {
      fs.writeFileSync(jwtSecretFile, process.env.JWT_SECRET);
      console.log("[Backend] JWT_SECRET generated and persisted to:", jwtSecretFile);
    } catch (err) {
      console.warn("[Backend] Could not persist JWT_SECRET, using in-memory only:", err.message);
    }
  }
}
console.log("[Backend] JWT_SECRET is " + (process.env.JWT_SECRET ? "set" : "NOT SET — this should never happen"));

// Determine the database directory
// In production (Electron), use USER_DATA_DIR for writable storage
// Falls back to resources directory (pkg) or project prisma dir
const dbDir = (() => {
  if (process.env.USER_DATA_DIR) return process.env.USER_DATA_DIR;
  if (process.pkg) return path.dirname(process.execPath);
  return path.join(__dirname, "../prisma");
})();

const dbPath = path.join(dbDir, "dev.db");
// Normalize backslashes to forward slashes for valid file URL on Windows
const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});
const app = express();

// Auto-sync database schema on startup (production/Electron)
// This ensures the SQLite database has all required tables even on fresh installs.
// Relies on the seed dev.db (shipped in extraResources) having the correct schema,
// rather than running `prisma db push` which won't work inside a pkg binary.
if (process.env.NODE_ENV === "production") {
  try {
    const flagFile = path.join(dbDir, ".db_initialized");

    // Copy seed database from packaged resources to writable user data directory if needed
    if (!fs.existsSync(dbPath)) {
      // Try multiple locations for the seed database:
      // 1. pkg builds: next to the executable
      // 2. Electron: in process.resourcesPath (extraResources)
      // 3. Development: alongside the prisma directory
      let seedDbPath = null;

      if (process.pkg) {
        seedDbPath = path.join(path.dirname(process.execPath), "dev.db");
      } else if (process.resourcesPath) {
        seedDbPath = path.join(process.resourcesPath, "dev.db");
      } else {
        seedDbPath = path.join(__dirname, "../prisma/dev.db");
      }

      if (seedDbPath && fs.existsSync(seedDbPath)) {
        fs.copyFileSync(seedDbPath, dbPath);
        console.log("[Backend] Copied seed database from", seedDbPath, "to", dbPath);
      } else {
        console.log("[Backend] No seed database found at", seedDbPath, "— Prisma will create an empty database");
      }
    }

    if (!fs.existsSync(flagFile)) {
      console.log("[Backend] First run — database ready");
      fs.writeFileSync(flagFile, "1"); // mark as initialized
    } else {
      console.log("[Backend] Database already initialized, skipping sync");
    }
  } catch (err) {
    console.error("[Backend] Database initialization failed:", err.message);
  }
}
// Ensure uploads directory exists
// In production (Electron/pkg), use USER_DATA_DIR so the directory is writable.
// In development, fall back to the project's uploads folder.
const uploadsDir = process.env.USER_DATA_DIR
  ? path.join(process.env.USER_DATA_DIR, "uploads")
  : path.join(__dirname, "../uploads");
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn("[Backend] Could not create uploads directory:", err.message);
}

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve uploaded files
app.use("/uploads", express.static(uploadsDir));

// Rate limiting — generous limit for local POS use; exempt scanner polling to avoid lockouts
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skip: (req) => req.originalUrl.startsWith("/api/scanner") || req.originalUrl.startsWith("/api/events"),
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

// Make prisma accessible to routes
app.locals.prisma = prisma;

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/mpesa", mpesaRoutes);
app.use("/api/scanner", scannerRoutes);
// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── SSE event stream for real-time notifications ──
// Used to push auto-backup completion events to the frontend.
// Clients connect via EventSource and receive server-sent events.
const sseClients = new Set();

app.get("/api/events", (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Send an initial comment to establish the connection
  res.write(": connected\n\n");

  // Register this client
  sseClients.add(res);

  // Send a heartbeat every 30s to keep the connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 30000);

  // Clean up on disconnect
  req.on("close", () => {
    sseClients.delete(res);
    clearInterval(heartbeat);
  });
});

// Helper to broadcast an event to all connected SSE clients
function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Serve built frontend in production mode (for Electron)
if (process.env.SERVE_FRONTEND === "true") {
  const frontendDist =
    process.env.FRONTEND_DIST || path.join(__dirname, "../../frontend/dist");
  if (fs.existsSync(frontendDist)) {
    console.log(`[Backend] Serving frontend from: ${frontendDist}`);
    app.use(express.static(frontendDist));

    // SPA fallback - serve index.html for all non-API, non-upload routes
    app.get("*", (req, res) => {
      if (!req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
        res.sendFile(path.join(frontendDist, "index.html"));
      } else {
        res.status(404).json({ error: "Not found" });
      }
    });
  } else {
    console.warn(`[Backend] Frontend dist not found at ${frontendDist}`);
  }
}

const PORT = process.env.PORT || 5000;

// ── Self-healing database schema ──
// If the database file exists but tables are missing (e.g. after a reset,
// git clean, or dist build), auto-repair by running prisma db push.
async function ensureDatabaseSchema() {
  try {
    // Try a simple query to see if the User table exists
    await prisma.$queryRaw`SELECT count(*) FROM User`;
    console.log("[Backend] Database schema verified — tables exist");
    return true;
  } catch (err) {
    // Prisma error codes: P2021 = table not found, P2010 = raw query failed
    if (err?.code === "P2021" || err?.code === "P2010" || (err?.message && err.message.includes("no such table"))) {
      console.log("[Backend] Database tables missing — attempting to create schema...");

      if (process.env.NODE_ENV === "production" || process.pkg) {
        // Production build: try to copy seed database
        try {
          let seedDbPath = null;
          if (process.pkg) {
            seedDbPath = path.join(path.dirname(process.execPath), "dev.db");
          } else if (process.resourcesPath) {
            seedDbPath = path.join(process.resourcesPath, "dev.db");
          }
          if (seedDbPath && fs.existsSync(seedDbPath)) {
            fs.copyFileSync(seedDbPath, dbPath);
            console.log("[Backend] Copied seed database to", dbPath);
            return true;
          }
        } catch (copyErr) {
          console.warn("[Backend] Could not copy seed database:", copyErr.message);
        }
      }

      // Development (or fallback): run prisma db push to create tables
      try {
        const backendDir = path.join(__dirname, "..");
        console.log("[Backend] Running prisma db push from", backendDir);
        execSync("npx prisma db push", { cwd: backendDir, stdio: "pipe", timeout: 30000 });
        console.log("[Backend] Schema created successfully via prisma db push");
        return true;
      } catch (pushErr) {
        console.error("[Backend] prisma db push failed:", pushErr.message);
        // Don't throw — let the seed attempt fail gracefully below
        return false;
      }
    } else {
      // Some other database error (permissions, corrupt, etc.)
      console.warn("[Backend] Database check warning:", err.message);
      return false;
    }
  }
}

/**
 * Synchronize the database schema with the latest migrations using raw SQL.
 * This is necessary because `prisma db push` does not work inside pkg binaries.
 * In desktop distribution mode, the seed database might be outdated.
 * Instead, we check for missing columns and add them via ALTER TABLE.
 */
async function ensureSchemaUpToDate(prisma) {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TransactionItem" ADD COLUMN "pricingType" TEXT;`);
    console.log('[Backend] Applied migration: added pricingType column to TransactionItem');
  } catch (err) {
    // Column already exists or table doesn't exist yet — both are fine
    if (!err.message || (
      !err.message.includes("duplicate column") &&
      !err.message.includes("already exists") &&
      !err.message.includes("no such table")
    )) {
      console.warn('[Backend] Schema sync note (non-critical):', err.message);
    }
  }
}

// Seed default data before starting the server (prevents race condition on first run)
// NOTE: Keep this inline seed in sync with prisma/seed.js
async function seedDatabase() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log("[Backend] No users found — first-time setup required via signup page.");

      // Seed categories (static starter data)
      const categoryCount = await prisma.category.count();
      if (categoryCount === 0) {
        await prisma.category.createMany({
          data: [
            { name: "Beverages", description: "Drinks and beverages" },
            { name: "Food", description: "Food items and snacks" },
            { name: "Electronics", description: "Electronic devices and accessories" },
            { name: "Clothing", description: "Apparel and accessories" },
            { name: "Stationery", description: "Office and school supplies" },
          ],
        });

        // Create sample products
        const beverages = await prisma.category.findUnique({ where: { name: "Beverages" } });
        const food = await prisma.category.findUnique({ where: { name: "Food" } });
        const electronics = await prisma.category.findUnique({ where: { name: "Electronics" } });
        const clothing = await prisma.category.findUnique({ where: { name: "Clothing" } });
        const stationery = await prisma.category.findUnique({ where: { name: "Stationery" } });

        await prisma.product.createMany({
          data: [
            { name: "Coca Cola 500ml", sku: "BEV001", barcode: "1000001", costPrice: 0.80, retailPrice: 1.50, wholesalePrice: 1.20, quantity: 100, reorderLevel: 20, categoryId: beverages.id },
            { name: "Water Bottle 1L", sku: "BEV002", barcode: "1000002", costPrice: 0.30, retailPrice: 1.00, wholesalePrice: 0.80, quantity: 150, reorderLevel: 30, categoryId: beverages.id },
            { name: "Orange Juice", sku: "BEV003", barcode: "1000003", costPrice: 1.20, retailPrice: 2.50, wholesalePrice: 2.00, quantity: 60, reorderLevel: 15, categoryId: beverages.id },
            { name: "Coffee Latte", sku: "BEV004", barcode: "1000004", costPrice: 1.00, retailPrice: 3.50, wholesalePrice: 2.80, quantity: 40, reorderLevel: 10, categoryId: beverages.id },
            { name: "Iced Tea", sku: "BEV005", barcode: "1000005", costPrice: 0.60, retailPrice: 1.80, wholesalePrice: 1.40, quantity: 80, reorderLevel: 20, categoryId: beverages.id },
            { name: "Potato Chips", sku: "FOOD001", barcode: "2000001", costPrice: 0.50, retailPrice: 1.20, wholesalePrice: 0.90, quantity: 200, reorderLevel: 40, categoryId: food.id },
            { name: "Chocolate Bar", sku: "FOOD002", barcode: "2000002", costPrice: 0.70, retailPrice: 1.50, wholesalePrice: 1.20, quantity: 120, reorderLevel: 30, categoryId: food.id },
            { name: "Sandwich", sku: "FOOD003", barcode: "2000003", costPrice: 2.00, retailPrice: 4.50, wholesalePrice: 3.60, quantity: 30, reorderLevel: 10, categoryId: food.id },
            { name: "Cookies Pack", sku: "FOOD004", barcode: "2000004", costPrice: 1.00, retailPrice: 2.00, wholesalePrice: 1.60, quantity: 90, reorderLevel: 20, categoryId: food.id },
            { name: "Energy Bar", sku: "FOOD005", barcode: "2000005", costPrice: 0.80, retailPrice: 1.80, wholesalePrice: 1.40, quantity: 75, reorderLevel: 15, categoryId: food.id },
            { name: "USB Cable", sku: "ELEC001", barcode: "3000001", costPrice: 2.00, retailPrice: 5.00, wholesalePrice: 4.00, quantity: 50, reorderLevel: 10, categoryId: electronics.id },
            { name: "Phone Case", sku: "ELEC002", barcode: "3000002", costPrice: 3.00, retailPrice: 8.00, wholesalePrice: 6.50, quantity: 35, reorderLevel: 10, categoryId: electronics.id },
            { name: "Mouse Pad", sku: "ELEC003", barcode: "3000003", costPrice: 1.50, retailPrice: 4.00, wholesalePrice: 3.20, quantity: 45, reorderLevel: 15, categoryId: electronics.id },
            { name: "T-Shirt", sku: "CLTH001", barcode: "4000001", costPrice: 5.00, retailPrice: 12.00, wholesalePrice: 9.00, quantity: 60, reorderLevel: 15, categoryId: clothing.id },
            { name: "Cap", sku: "CLTH002", barcode: "4000002", costPrice: 3.00, retailPrice: 8.00, wholesalePrice: 6.00, quantity: 40, reorderLevel: 10, categoryId: clothing.id },
            { name: "Notebook A5", sku: "STAT001", barcode: "5000001", costPrice: 1.00, retailPrice: 2.50, wholesalePrice: 2.00, quantity: 100, reorderLevel: 25, categoryId: stationery.id },
            { name: "Pen Pack", sku: "STAT002", barcode: "5000002", costPrice: 1.50, retailPrice: 3.00, wholesalePrice: 2.40, quantity: 80, reorderLevel: 20, categoryId: stationery.id },
            { name: "Marker Set", sku: "STAT003", barcode: "5000003", costPrice: 2.00, retailPrice: 4.50, wholesalePrice: 3.60, quantity: 50, reorderLevel: 15, categoryId: stationery.id },
          ],
        });
        console.log("[Backend] Sample categories and products seeded");
      }

      // Seed default settings (store name/phone will be set via signup)
      const settingCount = await prisma.setting.count();
      if (settingCount === 0) {
        await prisma.setting.createMany({
          data: [
            { key: "store_email", value: "info@mystore.com" },
            { key: "store_address", value: "123 Main Street, Nairobi" },
            { key: "tax_rate", value: "16" },
            { key: "currency", value: "KES" },
            { key: "sound_enabled", value: "true" },
            { key: "auto_backup_enabled", value: "true" },
            { key: "auto_backup_retention_days", value: "30" },
          ],
        });
        console.log("[Backend] Default settings seeded");
      }
    }
  } catch (err) {
    console.error("[Backend] Seeding failed:", err.message);
  }
}

// Start server after schema check + seeding completes
ensureDatabaseSchema().then(async () => {
  await ensureSchemaUpToDate(prisma); // Non-fatal — sync latest schema
  return seedDatabase();
}).then(() => {
  const server = app.listen(PORT, () => {
    console.log(`POS Backend running on port ${PORT}`);
    // Notify parent process (Electron) that the server is ready
    if (process.send) {
      process.send("ready");
    }
  });

  // Start the auto-backup scheduler after the server is ready
  startAutoBackupScheduler();
}).catch((err) => {
  console.error("[Backend] Startup failed:", err.message);
  // Still try to start the server so health check can report status
  const server = app.listen(PORT, () => {
    console.log(`POS Backend running on port ${PORT} (degraded state)`);
  });
});

// ── Auto-backup scheduler ──
// Checks once per hour whether a daily auto-backup should be taken.
// The user can enable/disable this via the auto_backup_enabled setting.
//
// How it works:
//   1. Read the auto_backup_enabled setting from the database
//   2. If enabled, check if today's backup file (auto-backup-YYYY-MM-DD.db) exists
//   3. If it doesn't, create it by copying the current database
//
// We use a 1-hour tick instead of setInterval(24h) so that a restart mid-day
// doesn't skip a day — the next tick will pick it up.
function startAutoBackupScheduler() {
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // every hour

  async function tryAutoBackup() {
    try {
      // Read the auto_backup_enabled setting
      const setting = await prisma.setting.findUnique({
        where: { key: "auto_backup_enabled" },
      });

      if (!setting || setting.value !== "true") {
        return; // auto-backup is disabled
      }

      // Determine database and backup directories (mirrors getStoragePaths in settings.js)
      const backupDir = process.env.USER_DATA_DIR
        ? path.join(process.env.USER_DATA_DIR, "backups")
        : path.join(__dirname, "../backups");

      // Ensure the backup directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Today's date as a string for the filename
      const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
      const backupFilename = `auto-backup-${today}.db`;
      const backupPath = path.join(backupDir, backupFilename);

      // Skip if today's auto-backup already exists
      if (fs.existsSync(backupPath)) {
        // Still run retention cleanup on every tick so a setting change
        // takes effect immediately, not just when a new backup is created.
        await cleanupOldAutoBackups();
        return;
      }

      // Check the database file exists
      if (!fs.existsSync(dbPath)) {
        console.warn("[AutoBackup] Database file not found, skipping:", dbPath);
        return;
      }

      // Create the backup
      fs.copyFileSync(dbPath, backupPath);
      const now = new Date().toISOString();
      console.log(`[AutoBackup] Created daily backup: ${backupFilename}`);

      // Persist the last-run timestamp as a setting so the UI can display it
      await prisma.setting.upsert({
        where: { key: "auto_backup_last_run" },
        update: { value: now },
        create: { key: "auto_backup_last_run", value: now },
      }).catch(() => {}); // Non-critical

      // Notify all connected frontend clients via SSE
      broadcastSSE("auto-backup-completed", {
        filename: backupFilename,
        timestamp: now,
        size: fs.statSync(backupPath).size,
      });

      // ── Retention: delete old auto-backups ──
      await cleanupOldAutoBackups();
    } catch (err) {
      console.error("[AutoBackup] Scheduler error:", err.message);
    }
  }

  /**
   * Delete auto-backup files older than the configured retention period.
   * Only targets files matching the "auto-backup-YYYY-MM-DD.db" pattern so
   * manual backups are never touched.
   *
   * Retention days is read from the auto_backup_retention_days setting
   * (defaults to 30 if not set).
   */
  async function cleanupOldAutoBackups() {
    try {
      // Read the retention setting
      const retentionSetting = await prisma.setting.findUnique({
        where: { key: "auto_backup_retention_days" },
      });
      const retentionDays = parseInt(retentionSetting?.value || "30", 10);
      if (retentionDays < 1) return; // never delete if set to 0 or negative

      // Determine the backup directory (same logic as above)
      const backupDir = process.env.USER_DATA_DIR
        ? path.join(process.env.USER_DATA_DIR, "backups")
        : path.join(__dirname, "../backups");

      if (!fs.existsSync(backupDir)) return;

      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const files = fs.readdirSync(backupDir);
      let deletedCount = 0;

      for (const filename of files) {
        // Only clean up auto-backup files (never touch manual backups)
        if (!filename.startsWith("auto-backup-") || !filename.endsWith(".db")) {
          continue;
        }

        const filePath = path.join(backupDir, filename);
        const stat = fs.statSync(filePath);

        if (stat.mtime.getTime() < cutoff) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`[AutoBackup] Retention cleanup: deleted ${deletedCount} old backup(s) (retention: ${retentionDays} days)`);
      }
    } catch (err) {
      console.warn("[AutoBackup] Retention cleanup error:", err.message);
    }
  }

  // Run immediately on startup (in case the app was offline for a while)
  // then every hour thereafter
  tryAutoBackup();
  setInterval(tryAutoBackup, CHECK_INTERVAL_MS);

  console.log("[AutoBackup] Scheduler started — checks every hour for daily backup");
}

module.exports = app;
