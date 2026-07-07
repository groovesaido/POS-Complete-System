const express = require('express');
const os = require('os');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Get local network IPv4 address
router.get('/network-info', authenticate, (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal/loopback and non-IPv4
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp !== '127.0.0.1') break;
    }

    res.json({ ipv4: localIp, hostname: os.hostname() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get network info.' });
  }
});

// Get all settings
router.get('/', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const settings = await prisma.setting.findMany();
    const settingsObj = {};
    settings.forEach(s => { settingsObj[s.key] = s.value; });

    // Mask sensitive credentials
    delete settingsObj.smtp_pass; // Don't expose SMTP password

    if (req.user.role !== 'admin' && settingsObj.mpesa_accounts) {
      try {
        const accounts = JSON.parse(settingsObj.mpesa_accounts);
        const masked = accounts.map(a => ({
          ...a,
          consumerKey: a.consumerKey ? `${a.consumerKey.slice(0, 4)}...${a.consumerKey.slice(-4)}` : '',
          consumerSecret: '••••••••',
          passKey: '••••••••',
        }));
        settingsObj.mpesa_accounts = JSON.stringify(masked);
      } catch {
        // If parsing fails, leave as-is
      }
    }
    res.json(settingsObj);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

// Update settings
router.put('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const settings = req.body;

    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'UPDATE_SETTINGS', details: 'Updated store settings' },
    });

    const updatedSettings = await prisma.setting.findMany();
    const settingsObj = {};
    updatedSettings.forEach(s => { settingsObj[s.key] = s.value; });

    res.json(settingsObj);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Helper: determine writable database and backup directories (mirrors index.js)
function getStoragePaths() {
  const fs = require('fs');
  const path = require('path');

  const dbDir = process.env.USER_DATA_DIR
    ? process.env.USER_DATA_DIR
    : path.join(__dirname, '../../prisma');
  const dbPath = path.join(dbDir, 'dev.db');
  const backupDir = process.env.USER_DATA_DIR
    ? path.join(process.env.USER_DATA_DIR, 'backups')
    : path.join(__dirname, '../../backups');

  return { dbDir, dbPath, backupDir };
}

// Backup database
router.post('/backup', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const { dbPath, backupDir } = getStoragePaths();

    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found at: ' + dbPath });
    }

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

    fs.copyFileSync(dbPath, backupPath);

    res.json({ message: 'Backup created successfully.', path: backupPath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create backup.' });
  }
});

// List available backup files
router.get('/backups', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { backupDir } = getStoragePaths();

    if (!fs.existsSync(backupDir)) {
      return res.json({ backups: [] });
    }

    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db'));

    const backups = files.map((filename) => {
      const filePath = path.join(backupDir, filename);
      const stat = fs.statSync(filePath);
      return {
        filename,
        size: stat.size,
        createdAt: stat.birthtime || stat.mtime,
        modifiedAt: stat.mtime,
      };
    });

    // Sort newest first
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ backups });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list backups.' });
  }
});

// Restore database from a backup file
router.post('/restore', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { PrismaClient } = require('@prisma/client');

    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Backup filename is required.' });
    }

    // Prevent path traversal — only allow filenames in the backupDir
    const { dbPath, backupDir } = getStoragePaths();
    const backupPath = path.resolve(path.join(backupDir, path.basename(filename)));

    // Normalize both paths for cross-platform comparison (Windows uses backslashes)
    const normalizedBackup = backupPath.replace(/\\/g, '/');
    const normalizedDir = backupDir.replace(/\\/g, '/');
    if (!normalizedBackup.startsWith(normalizedDir)) {
      return res.status(400).json({ error: 'Invalid backup filename.' });
    }

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found: ' + filename });
    }

    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found. Cannot restore.' });
    }

    // Disconnect Prisma to release file locks
    const prisma = req.app.locals.prisma;
    await prisma.$disconnect();

    // Copy backup over the current database
    fs.copyFileSync(backupPath, dbPath);

    // Create a fresh Prisma client connected to the restored database
    const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;
    const newPrisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    });

    // Verify the restored database is valid by running a basic query
    try {
      await newPrisma.$queryRaw`SELECT 1`;
    } catch {
      // If verification fails, attempt to reconnect the old client
      await newPrisma.$disconnect();
      const fallbackPrisma = new PrismaClient({
        datasources: { db: { url: dbUrl } },
      });
      req.app.locals.prisma = fallbackPrisma;
      return res.status(500).json({
        error: 'Backup file appears corrupted or incompatible. Database was NOT restored.',
        needsRestart: true,
      });
    }

    // Swap the Prisma client instance
    req.app.locals.prisma = newPrisma;

    // Log the restore activity
    await newPrisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'RESTORE_DATABASE',
        details: `Restored database from backup: ${filename}`,
      },
    }).catch(() => {}); // Non-critical

    res.json({
      message: `Database restored from "${filename}".`, // Shortened — no crash on Windows console
      filename,
      size: fs.statSync(backupPath).size,
      needsRestart: false,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore database: ' + error.message });
  }
});

module.exports = router;
