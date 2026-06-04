const express = require('express');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all products with search, filter, pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { search, categoryId, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }
    if (categoryId) {
      where.categoryId = parseInt(categoryId);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit),
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// Get single product
router.get('/:id', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { category: true },
    });
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
});

// Create product
router.post('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { name, sku, barcode, description, costPrice, sellingPrice, quantity, reorderLevel, categoryId } = req.body;

    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) return res.status(400).json({ error: 'Product with this SKU already exists.' });

    const product = await prisma.product.create({
      data: {
        name, sku, barcode, description,
        costPrice: parseFloat(costPrice) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        quantity: parseInt(quantity) || 0,
        reorderLevel: parseInt(reorderLevel) || 5,
        categoryId: parseInt(categoryId),
      },
      include: { category: true },
    });

    // Log activity
    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'CREATE_PRODUCT', details: `Created product ${name}` },
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product.' });
  }
});

// Update product
router.put('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id);
    const { name, sku, barcode, description, costPrice, sellingPrice, quantity, reorderLevel, categoryId } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        name, sku, barcode, description,
        costPrice: parseFloat(costPrice),
        sellingPrice: parseFloat(sellingPrice),
        quantity: parseInt(quantity),
        reorderLevel: parseInt(reorderLevel),
        categoryId: parseInt(categoryId),
      },
      include: { category: true },
    });

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'UPDATE_PRODUCT', details: `Updated product ${name}` },
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

// Delete product
router.delete('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    await prisma.product.delete({ where: { id } });

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'DELETE_PRODUCT', details: `Deleted product ${product.name}` },
    });

    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

// Get inventory logs
router.get('/:id/inventory-logs', authenticate, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const logs = await prisma.inventoryLog.findMany({
      where: { productId: parseInt(req.params.id) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory logs.' });
  }
});

module.exports = router;
