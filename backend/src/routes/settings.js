const express = require('express');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all settings
router.get('/', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const settings = await prisma.setting.findMany();
    const settingsObj = {};
    settings.forEach(s => { settingsObj[s.key] = s.value; });
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

// Backup database
router.post('/backup', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.join(__dirname, '../../prisma/dev.db');
    const backupDir = path.join(__dirname, '../../backups');

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

module.exports = router;
