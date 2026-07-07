const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const prisma = req.app.locals.prisma;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        details: `User ${user.username} logged in`,
      },
    });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, username: true, email: true, role: true, status: true, lastLogin: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// Change password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const prisma = req.app.locals.prisma;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// ── First-time setup ──

/**
 * Check if the app has any users yet (i.e., needs first-time setup).
 */
router.get('/needs-setup', async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const userCount = await prisma.user.count();
    res.json({ needsSetup: userCount === 0 });
  } catch (error) {
    console.error('Setup check error:', error);
    res.status(500).json({ error: 'Failed to check setup status.' });
  }
});

/**
 * First-time setup: create the initial admin user and store settings.
 * Only works when no users exist in the database.
 * Body: { name, username, password, storeName, storePhone, storeEmail }
 */
router.post('/setup', async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    // Ensure this can only be used during first-time setup
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(400).json({ error: 'Setup has already been completed.' });
    }

    const { name, username, password, storeName, storePhone, storeEmail } = req.body;

    if (!name || !username || !password || !storeName || !storePhone || !storeEmail) {
      return res.status(400).json({ error: 'All fields are required: name, username, password, storeName, storePhone, storeEmail.' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check username uniqueness
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    // Check email uniqueness
    const existingEmail = await prisma.user.findUnique({ where: { email: storeEmail } });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already in use.' });
    }

    // Create the admin user
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        name,
        username,
        email: storeEmail,
        password: hashedPassword,
        role: 'admin',
        status: 'active',
      },
    });

    // Save store name, phone, and email to settings
    await prisma.setting.upsert({
      where: { key: 'store_name' },
      update: { value: storeName },
      create: { key: 'store_name', value: storeName },
    });

    await prisma.setting.upsert({
      where: { key: 'store_phone' },
      update: { value: storePhone },
      create: { key: 'store_phone', value: storePhone },
    });

    await prisma.setting.upsert({
      where: { key: 'store_email' },
      update: { value: storeEmail },
      create: { key: 'store_email', value: storeEmail },
    });

    console.log(`[Backend] First-time setup complete: admin user "${username}", store "${storeName}"`);

    res.json({ message: 'Setup complete. You can now log in.' });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Setup failed: ' + error.message });
  }
});

module.exports = router;
