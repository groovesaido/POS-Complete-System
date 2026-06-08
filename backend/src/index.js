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
const bcrypt = require("bcryptjs");

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
  skip: (req) => req.originalUrl.startsWith("/api/scanner"),
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

// Seed default data before starting the server (prevents race condition on first run)
// NOTE: Keep this inline seed in sync with prisma/seed.js
async function seedDatabase() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log("[Backend] No users found, seeding default data...");

      const adminPassword = await bcrypt.hash("admin123", 10);
      const cashierPassword = await bcrypt.hash("cashier123", 10);

      // Create default users
      await prisma.user.createMany({
        data: [
          { name: "System Admin", username: "admin", email: "admin@pos.com", password: adminPassword, role: "admin", status: "active" },
          { name: "John Cashier", username: "cashier", email: "cashier@pos.com", password: cashierPassword, role: "cashier", status: "active" },
        ],
      });

      // Create default categories
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

      // Create default settings
      await prisma.setting.createMany({
        data: [
          { key: "store_name", value: "My POS Store" },
          { key: "store_phone", value: "+254700000000" },
          { key: "store_email", value: "info@mystore.com" },
          { key: "store_address", value: "123 Main Street, Nairobi" },
          { key: "tax_rate", value: "16" },
          { key: "currency", value: "KES" },
          { key: "sound_enabled", value: "true" },
        ],
      });

      console.log("[Backend] Default data seeded successfully");
      console.log("[Backend] Admin: username=admin, password=admin123");
      console.log("[Backend] Cashier: username=cashier, password=cashier123");
    }
  } catch (err) {
    console.error("[Backend] Seeding failed:", err.message);
  }
}

// Start server after schema check + seeding completes
ensureDatabaseSchema().then(() => {
  return seedDatabase();
}).then(() => {
  const server = app.listen(PORT, () => {
    console.log(`POS Backend running on port ${PORT}`);
    // Notify parent process (Electron) that the server is ready
    if (process.send) {
      process.send("ready");
    }
  });
}).catch((err) => {
  console.error("[Backend] Startup failed:", err.message);
  // Still try to start the server so health check can report status
  const server = app.listen(PORT, () => {
    console.log(`POS Backend running on port ${PORT} (degraded state)`);
  });
});

module.exports = app;
