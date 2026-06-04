const express = require('express');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all categories
router.get('/', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// Create category
router.post('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { name, description } = req.body;

    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) return res.status(400).json({ error: 'Category already exists.' });

    const category = await prisma.category.create({ data: { name, description } });

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'CREATE_CATEGORY', details: `Created category ${name}` },
    });

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

// Update category
router.put('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id);
    const { name, description } = req.body;

    const category = await prisma.category.update({
      where: { id },
      data: { name, description },
    });

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'UPDATE_CATEGORY', details: `Updated category ${name}` },
    });

    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

// Delete category
router.delete('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id);

    const productsCount = await prisma.product.count({ where: { categoryId: id } });
    if (productsCount > 0) {
      return res.status(400).json({ error: 'Cannot delete category with associated products.' });
    }

    await prisma.category.delete({ where: { id } });

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'DELETE_CATEGORY', details: `Deleted category ID ${id}` },
    });

    res.json({ message: 'Category deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});

module.exports = router;
