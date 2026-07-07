/**
 * License Server — Entry Point (Traditional Node.js deployment)
 *
 * Loads .env, connects to PostgreSQL, and starts Express.
 * 
 * For Vercel deployment, use api/index.js instead.
 */
const path = require("path");

// Load .env
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch { /* dotenv not available */ }

const { createApp, prisma } = require("./app");

const PORT = process.env.PORT || 4000;

async function main() {
  // Verify database connection
  try {
    await prisma.$connect();
    console.log("[License Server] Connected to PostgreSQL database");
  } catch (err) {
    console.error("[License Server] Failed to connect to database:", err.message);
    process.exit(1);
  }

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`[License Server] Running on port ${PORT}`);
    console.log(`[License Server] Admin: POST /generate, POST /renew, POST /suspend, GET /licenses`);
    console.log(`[License Server] Public: POST /validate, POST /activate, GET /health`);
  });
}

main().catch((err) => {
  console.error("[License Server] Startup failed:", err.message);
  process.exit(1);
});
