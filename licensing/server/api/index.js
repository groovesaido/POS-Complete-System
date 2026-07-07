/**
 * Vercel serverless entry point for the license server.
 * 
 * Deploys the Express app as a Vercel serverless function.
 * 
 * Usage:
 *   1. Upload the licensing/server directory to Vercel
 *   2. Set environment variables:
 *      - DATABASE_URL: Neon PostgreSQL connection string
 *      - ADMIN_SECRET: Strong random string for admin endpoints
 *   3. Deploy
 * 
 * Note: The `routes` in vercel.json route all traffic to this function.
 */

// Load .env only for local dev — Vercel provides env vars natively
try {
  require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
} catch { /* not available on Vercel */ }

// Reuse the same app creation logic from the main server
const { createApp } = require("../src/app");

const app = createApp();

module.exports = async (req, res) => {
  // Vercel serverless function handler
  app(req, res);
};
