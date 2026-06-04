const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all users
router.get('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const users = await prisma.user.findMany({
      select: { id: true, name: true, username: true, email: true, role: true, status: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// Create user
router.post('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { name, username, email, password, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.status(400).json({ error: 'Username already exists.' });

    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) return res.status(400).json({ error: 'Email already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, username, email, password: hashedPassword, role: role || 'cashier' },
      select: { id: true, name: true, username: true, email: true, role: true, status: true, createdAt: true },
    });

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'CREATE_USER', details: `Created user ${username}` },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// Update user
router.put('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id);
    const { name, email, role, status, password } = req.body;

    const data = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = role;
    if (status) data.status = status;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, username: true, email: true, role: true, status: true, createdAt: true },
    });

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'UPDATE_USER', details: `Updated user ${user.username}` },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// Delete user (deactivate)
router.delete('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id);

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself.' });
    }

    await prisma.user.update({
      where: { id },
      data: { status: 'inactive' },
    });

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'DEACTIVATE_USER', details: `Deactivated user ID ${id}` },
    });

    res.json({ message: 'User deactivated successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate user.' });
  }
});

// Get activity logs
router.get('/activity-logs', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        include: { user: { select: { name: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.activityLog.count(),
    ]);

    res.json({
      logs,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
});

module.exports = router;
