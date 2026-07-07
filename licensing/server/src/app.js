const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ADMIN_SECRET = process.env.ADMIN_SECRET || "dev-secret-change-me";

/**
 * Create and configure the Express app with all license routes.
 * Does NOT call app.listen() — that's up to the caller (traditional server or Vercel).
 */
function createApp() {
  const app = express();

  // ── Middleware ──
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Allow inline scripts in admin dashboard
  }));
  app.use(cors());
  app.use(express.json());

  // ── Serve admin frontend (built/inline HTML dashboard) ──
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  // ── Admin authentication middleware ──
  function requireAdmin(req, res, next) {
    const secret = req.headers["x-admin-secret"];
    if (!secret || secret !== ADMIN_SECRET) {
      return res.status(403).json({ error: "Forbidden: invalid or missing admin secret" });
    }
    next();
  }

  // ── Helpers ──

  function generateLicenseKey() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const segment = () => Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join("");
    return `BUZZ-${segment()}-${segment()}-${segment()}`;
  }

  function isValidKeyFormat(key) {
    return /^BUZZ-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(key);
  }

  async function generateUniqueKey() {
    let key;
    let attempts = 0;
    do {
      key = generateLicenseKey();
      const existing = await prisma.license.findUnique({ where: { key } });
      if (!existing) return key;
      attempts++;
    } while (attempts < 10);
    throw new Error("Could not generate a unique license key after 10 attempts");
  }

  // ── Routes ──

  // POST /validate — validate a license key
  app.post("/validate", async (req, res) => {
    try {
      const { key, machineId } = req.body;

      if (!key || !machineId) {
        return res.status(400).json({ valid: false, reason: "License key and machineId are required" });
      }

      if (!isValidKeyFormat(key)) {
        return res.status(400).json({ valid: false, reason: "Invalid license key format" });
      }

      const license = await prisma.license.findUnique({ where: { key: key.toUpperCase() } });

      if (!license) {
        return res.json({ valid: false, reason: "License key not found" });
      }

      if (license.status === "suspended") {
        return res.json({ valid: false, reason: "License has been suspended" });
      }

      if (license.status === "expired" || new Date(license.expiresAt) < new Date()) {
        if (license.status !== "expired") {
          await prisma.license.update({ where: { id: license.id }, data: { status: "expired" } });
        }
        return res.json({ valid: false, reason: "License has expired", expiresAt: license.expiresAt });
      }

      if (!license.machineId) {
        await prisma.license.update({ where: { id: license.id }, data: { machineId } });
        return res.json({
          valid: true,
          reason: "License activated and bound to this machine",
          expiresAt: license.expiresAt,
          machineId,
          customerName: license.customerName,
          plan: license.plan,
        });
      }

      if (license.machineId !== machineId) {
        return res.json({
          valid: false,
          reason: "License key is already bound to another machine",
          expiresAt: license.expiresAt,
        });
      }

      return res.json({
        valid: true,
        reason: "License is valid",
        expiresAt: license.expiresAt,
        machineId: license.machineId,
        customerName: license.customerName,
        plan: license.plan,
      });
    } catch (err) {
      console.error("[License] /validate error:", err.message);
      return res.status(500).json({ valid: false, reason: "Internal server error" });
    }
  });

  // POST /activate — activate a license key with machine binding
  app.post("/activate", async (req, res) => {
    try {
      const { key, machineId, customerName, customerEmail, customerPhone } = req.body;

      if (!key) {
        return res.status(400).json({ success: false, reason: "License key is required" });
      }

      if (!isValidKeyFormat(key)) {
        return res.status(400).json({ success: false, reason: "Invalid license key format" });
      }

      const license = await prisma.license.findUnique({ where: { key: key.toUpperCase() } });

      if (!license) {
        return res.json({ success: false, reason: "License key not found" });
      }

      if (license.status === "suspended") {
        return res.json({ success: false, reason: "License has been suspended" });
      }

      if (license.status === "expired" || new Date(license.expiresAt) < new Date()) {
        if (license.status !== "expired") {
          await prisma.license.update({ where: { id: license.id }, data: { status: "expired" } });
        }
        return res.json({ success: false, reason: "License has expired", expiresAt: license.expiresAt });
      }

      if (license.machineId && license.machineId !== machineId) {
        return res.json({ success: false, reason: "License key is already bound to another machine" });
      }

      await prisma.license.update({
        where: { id: license.id },
        data: {
          machineId: machineId || license.machineId,
          customerName: customerName || license.customerName,
          customerEmail: customerEmail || license.customerEmail,
          customerPhone: customerPhone || license.customerPhone,
        },
      });

      const updated = await prisma.license.findUnique({ where: { id: license.id } });

      return res.json({
        success: true,
        reason: "License activated successfully",
        expiresAt: updated.expiresAt,
        machineId: updated.machineId,
        customerName: updated.customerName,
        plan: updated.plan,
      });
    } catch (err) {
      console.error("[License] /activate error:", err.message);
      return res.status(500).json({ success: false, reason: "Internal server error" });
    }
  });

  // POST /generate — admin: generate a new license key
  app.post("/generate", requireAdmin, async (req, res) => {
    try {
      const { customerName, customerEmail, customerPhone, plan, validityDays, validityMinutes } = req.body;

      if (!customerName || !customerEmail) {
        return res.status(400).json({ error: "customerName and customerEmail are required" });
      }

      if (plan && !['standard', 'premium'].includes(plan)) {
        return res.status(400).json({ error: "plan must be 'standard' or 'premium'" });
      }

      const key = await generateUniqueKey();
      const expiresAt = new Date();

      // Support minute-based validity (for testing) and day-based validity
      if (validityMinutes) {
        const mins = parseInt(validityMinutes, 10);
        expiresAt.setTime(expiresAt.getTime() + mins * 60 * 1000);
      } else {
        const days = parseInt(validityDays, 10) || 365;
        expiresAt.setTime(expiresAt.getTime() + days * 24 * 60 * 60 * 1000);
      }

      const license = await prisma.license.create({
        data: {
          key,
          customerName,
          customerEmail,
          customerPhone: customerPhone || null,
          plan: plan || 'standard',
          expiresAt,
          status: "active",
        },
      });

      return res.json({
        success: true,
        license: {
          key: license.key,
          customerName: license.customerName,
          customerEmail: license.customerEmail,
          customerPhone: license.customerPhone,
          plan: license.plan,
          expiresAt: license.expiresAt,
          status: license.status,
          createdAt: license.createdAt,
        },
      });
    } catch (err) {
      console.error("[License] /generate error:", err.message);
      return res.status(500).json({ error: "Failed to generate license key" });
    }
  });

  // POST /renew — admin: renew (extend) a license (and optionally change plan)
  app.post("/renew", requireAdmin, async (req, res) => {
    try {
      const { key, days, validityMinutes, plan } = req.body;

      if (!key) {
        return res.status(400).json({ error: "License key is required" });
      }

      if (plan && !['standard', 'premium'].includes(plan)) {
        return res.status(400).json({ error: "plan must be 'standard' or 'premium'" });
      }

      const license = await prisma.license.findUnique({ where: { key: key.toUpperCase() } });

      if (!license) {
        return res.status(404).json({ error: "License key not found" });
      }

      const newExpiresAt = new Date();
      const baseDate = license.expiresAt > new Date() ? license.expiresAt : new Date();

      if (validityMinutes) {
        const mins = parseInt(validityMinutes, 10);
        newExpiresAt.setTime(baseDate.getTime() + mins * 60 * 1000);
      } else {
        const extendDays = parseInt(days, 10) || 365;
        newExpiresAt.setTime(baseDate.getTime() + extendDays * 24 * 60 * 60 * 1000);
      }

      const updateData = {
        expiresAt: newExpiresAt,
        status: "active",
      };
      if (plan) {
        updateData.plan = plan;
      }

      const updated = await prisma.license.update({
        where: { id: license.id },
        data: updateData,
      });

      return res.json({
        success: true,
        message: `License renewed until ${updated.expiresAt.toISOString().slice(0, 10)}`,
        license: {
          key: updated.key,
          customerName: updated.customerName,
          expiresAt: updated.expiresAt,
          status: updated.status,
          plan: updated.plan,
        },
      });
    } catch (err) {
      console.error("[License] /renew error:", err.message);
      return res.status(500).json({ error: "Failed to renew license" });
    }
  });

  // POST /suspend — admin: suspend a license
  app.post("/suspend", requireAdmin, async (req, res) => {
    try {
      const { key } = req.body;

      if (!key) {
        return res.status(400).json({ error: "License key is required" });
      }

      const license = await prisma.license.findUnique({ where: { key: key.toUpperCase() } });

      if (!license) {
        return res.status(404).json({ error: "License key not found" });
      }

      await prisma.license.update({
        where: { id: license.id },
        data: { status: "suspended" },
      });

      return res.json({
        success: true,
        message: `License ${key} has been suspended`,
      });
    } catch (err) {
      console.error("[License] /suspend error:", err.message);
      return res.status(500).json({ error: "Failed to suspend license" });
    }
  });

  // POST /unsuspend — admin: reactivate a suspended license
  app.post("/unsuspend", requireAdmin, async (req, res) => {
    try {
      const { key } = req.body;

      if (!key) {
        return res.status(400).json({ error: "License key is required" });
      }

      const license = await prisma.license.findUnique({ where: { key: key.toUpperCase() } });

      if (!license) {
        return res.status(404).json({ error: "License key not found" });
      }

      await prisma.license.update({
        where: { id: license.id },
        data: { status: "active" },
      });

      return res.json({
        success: true,
        message: `License ${key} has been reactivated`,
      });
    } catch (err) {
      console.error("[License] /unsuspend error:", err.message);
      return res.status(500).json({ error: "Failed to unsuspend license" });
    }
  });

  // GET /licenses — admin: list all licenses
  // Returns raw database values — no transformation.
  // The admin dashboard should reflect exactly what's stored.
  app.get("/licenses", requireAdmin, async (req, res) => {
    try {
      const licenses = await prisma.license.findMany({
        orderBy: { createdAt: "desc" },
      });

      return res.json({ licenses });
    } catch (err) {
      console.error("[License] /licenses error:", err.message);
      return res.status(500).json({ error: "Failed to list licenses" });
    }
  });

  // GET /health
  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "license-server", timestamp: new Date().toISOString() });
  });

  // ── Admin dashboard SPA catch-all ──
  // Serve index.html for all non-API routes so the admin dashboard handles routing
  app.get("*", (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith("/validate") ||
        req.path.startsWith("/activate") ||
        req.path.startsWith("/generate") ||
        req.path.startsWith("/renew") ||
        req.path.startsWith("/suspend") ||
        req.path.startsWith("/unsuspend") ||
        req.path.startsWith("/licenses") ||
        req.path.startsWith("/health")) {
      return next();
    }
    res.sendFile(path.join(publicDir, "index.html"));
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error("[License] Unhandled error:", err.stack);
    res.status(500).json({ error: "Internal server error" });
  });

  // Make prisma available to consumer
  app.set("prisma", prisma);

  return app;
}

module.exports = { createApp, prisma };
