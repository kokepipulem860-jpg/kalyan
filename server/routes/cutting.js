/**
 * Cutting Sheet & Exposure API Route
 * Provides real-time bookie liability calculations
 */

'use strict';

const express = require('express');
const router = express.Router();
const cuttingService = require('../services/cuttingService');
const { requireAdmin } = require('../middleware/auth');

router.get('/', requireAdmin, (req, res) => {
  const marketId = req.query.marketId || 'kalyan';
  const session = req.query.session || 'OPEN';

  const exposure = cuttingService.getMarketExposure(marketId, session);
  if (!exposure) {
    return res.status(404).json({ success: false, error: 'Market not found' });
  }

  res.json({ success: true, exposure });
});

// Get Syndicate Layoff Analysis & WhatsApp Slip
router.get('/layoff', requireAdmin, (req, res) => {
  const marketId = req.query.marketId || 'kalyan';
  const session = req.query.session || 'OPEN';
  const ankLimit = parseInt(req.query.ankLimit, 10) || 5000;
  const jodiLimit = parseInt(req.query.jodiLimit, 10) || 2000;

  const layoff = cuttingService.calculateLayoff(marketId, session, ankLimit, jodiLimit);
  if (!layoff) {
    return res.status(404).json({ success: false, error: 'Market not found' });
  }

  res.json({ success: true, layoff });
});

// Download Layoff CSV
router.get('/export-csv', requireAdmin, (req, res) => {
  const marketId = req.query.marketId || 'kalyan';
  const session = req.query.session || 'OPEN';
  const ankLimit = parseInt(req.query.ankLimit, 10) || 5000;
  const jodiLimit = parseInt(req.query.jodiLimit, 10) || 2000;

  const layoff = cuttingService.calculateLayoff(marketId, session, ankLimit, jodiLimit);
  if (!layoff) {
    return res.status(404).send('Market not found');
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="layoff-${marketId}-${session}.csv"`);
  res.send(layoff.csvContent);
});

module.exports = router;
