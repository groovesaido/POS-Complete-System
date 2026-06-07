const express = require('express');
const router = express.Router();

// In-memory scan buffer (FIFO, max 50 scans)
const MAX_SCANS = 50;
const scans = [];

// Track SSE clients for real-time push
const sseClients = new Set();

/**
 * POST /api/scanner/scan
 * Public endpoint - accepts barcode scans from the mobile scanner app.
 * Looks up product by barcode and stores the scan in memory.
 * Body: { barcode: string, label?: string, deviceId?: string }
 */
router.post('/scan', async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { barcode, label, deviceId } = req.body;

    if (!barcode || typeof barcode !== 'string' || barcode.trim().length === 0) {
      return res.status(400).json({ error: 'Barcode is required.' });
    }

    const cleanedBarcode = barcode.trim();

    // Look up product by barcode
    const product = await prisma.product.findFirst({
      where: { barcode: cleanedBarcode },
      include: { category: true },
    });

    const scan = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      barcode: cleanedBarcode,
      label: label || product?.name || 'Unknown item',
      product: product || null,
      deviceId: deviceId || 'unknown',
      scannedAt: new Date().toISOString(),
    };

    // Add to in-memory buffer
    scans.unshift(scan);
    if (scans.length > MAX_SCANS) scans.pop();

    // Push to SSE clients
    const payload = JSON.stringify({ type: 'scan', data: scan });
    for (const client of sseClients) {
      client.res.write(`data: ${payload}\n\n`);
    }

    res.json({
      success: true,
      scan,
      product,
    });
  } catch (error) {
    console.error('Scanner scan error:', error);
    res.status(500).json({ error: 'Failed to process scan.' });
  }
});

/**
 * GET /api/scanner/recent
 * Public endpoint - returns recent scans for POS polling.
 * Query: ?since=timestamp (ISO string) - only scans after this time
 *        ?limit=10 (max number of scans to return)
 */
router.get('/recent', (req, res) => {
  try {
    const { since, limit = 10 } = req.query;
    let filtered = scans;

    if (since) {
      const sinceTime = new Date(since).getTime();
      if (!isNaN(sinceTime)) {
        filtered = scans.filter(s => new Date(s.scannedAt).getTime() > sinceTime);
      }
    }

    filtered = filtered.slice(0, Math.min(parseInt(limit) || 10, 50));

    res.json({ scans: filtered });
  } catch (error) {
    console.error('Scanner recent error:', error);
    res.status(500).json({ error: 'Failed to fetch scans.' });
  }
});

/**
 * GET /api/scanner/stream
 * SSE endpoint for real-time scan events.
 * The POS web app connects to this to receive instant scan notifications.
 */
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Scanner stream connected' })}\n\n`);

  // Keep alive every 10 seconds
  const keepAlive = setInterval(() => {
    res.write(`:keepalive\n\n`);
  }, 10000);

  const client = { id: Date.now(), res };
  sseClients.add(client);

  // Remove client on disconnect
  req.on('close', () => {
    sseClients.delete(client);
    clearInterval(keepAlive);
  });
});

module.exports = router;
