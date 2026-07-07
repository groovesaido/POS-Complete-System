const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// Configure multer storage
// Determine writable uploads directory (mirrors logic from index.js)
const fs = require('fs');
const uploadsDir = process.env.USER_DATA_DIR
  ? path.join(process.env.USER_DATA_DIR, 'uploads')
  : path.join(__dirname, '../../uploads');
// Ensure the directory exists
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn('[Upload] Could not create uploads directory:', err.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Upload a single image
router.post('/', authenticate, authorizeAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }
    res.json({
      url: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
    });
  });
});

module.exports = router;
