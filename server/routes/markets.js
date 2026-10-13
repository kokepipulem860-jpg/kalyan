/**
 * Market & Bazaar Management Routes
 * Controls regular, starline, and king markets
 */

'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/store');
const { requireAdmin } = require('../middleware/auth');

// List all regular markets
router.get('/', (req, res) => {
  const markets = db.get('markets');
  res.json({ success: true, markets });
});

// Get single market
router.get('/:id', (req, res) => {
  const market = db.findById('markets', req.params.id);
  if (!market) return res.status(404).json({ success: false, error: 'Market not found' });
  res.json({ success: true, market });
});

// Admin: Add new market
router.post('/', requireAdmin, (req, res) => {
  const { name, hindiName, openTime, closeTime, days } = req.body;
  if (!name || !openTime || !closeTime) {
    return res.status(400).json({ success: false, error: 'Name, Open Time and Close Time are required' });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const existing = db.findById('markets', id);
  if (existing) {
    return res.status(400).json({ success: false, error: 'Market with similar name already exists' });
  }

  const newMarket = {
    id,
    name: name.toUpperCase().trim(),
    hindi_name: hindiName || name,
    open_time: openTime,
    close_time: closeTime,
    open_panna: '',
    close_panna: '',
    open_ank: '',
    close_ank: '',
    status: 'UPCOMING',
    days: days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    active: true
  };

  db.insert('markets', newMarket);
  res.json({ success: true, message: 'Market created successfully', market: newMarket });
});

// Admin: Update market (timings, active toggle)
router.put('/:id', requireAdmin, (req, res) => {
  const market = db.findById('markets', req.params.id);
  if (!market) return res.status(404).json({ success: false, error: 'Market not found' });

  const updates = {};
  if (req.body.openTime) updates.open_time = req.body.openTime;
  if (req.body.closeTime) updates.close_time = req.body.closeTime;
  if (typeof req.body.active === 'boolean') updates.active = req.body.active;
  if (req.body.status) updates.status = req.body.status;
  if (req.body.open_panna !== undefined) updates.open_panna = req.body.open_panna;
  if (req.body.close_panna !== undefined) updates.close_panna = req.body.close_panna;
  if (req.body.open_ank !== undefined) updates.open_ank = req.body.open_ank;
  if (req.body.close_ank !== undefined) updates.close_ank = req.body.close_ank;

  const updated = db.update('markets', req.params.id, updates);
  res.json({ success: true, message: 'Market updated successfully', market: updated });
});

// Starline markets
router.get('/type/starline', (req, res) => {
  const starline = db.get('starlineMarkets');
  res.json({ success: true, starline });
});

// Admin: Update starline market
router.put('/starline/:id', requireAdmin, (req, res) => {
  const market = db.findById('starlineMarkets', req.params.id);
  if (!market) return res.status(404).json({ success: false, error: 'Starline market not found' });
  const updated = db.update('starlineMarkets', req.params.id, req.body);
  res.json({ success: true, message: 'Starline market updated', market: updated });
});

// King markets (Gali Disawar)
router.get('/type/king', (req, res) => {
  const king = db.get('kingMarkets');
  res.json({ success: true, king });
});

// Admin: Update king market
router.put('/king/:id', requireAdmin, (req, res) => {
  const market = db.findById('kingMarkets', req.params.id);
  if (!market) return res.status(404).json({ success: false, error: 'King market not found' });
  const updated = db.update('kingMarkets', req.params.id, req.body);
  res.json({ success: true, message: 'King market updated', market: updated });
});

// Live Market Schedule with IST cutoffs and session locks
router.get('/schedule/live', (req, res) => {
  const marketScheduler = require('../services/marketScheduler');
  const istNow = marketScheduler.getISTDate();
  const markets = db.get('markets');
  const starline = db.get('starlineMarkets');
  const king = db.get('kingMarkets');

  const regularSchedule = markets.map(m => ({
    id: m.id,
    name: m.name,
    hindi_name: m.hindi_name,
    open_time: m.open_time,
    close_time: m.close_time,
    status: m.status,
    active: m.active,
    open_panna: m.open_panna,
    close_panna: m.close_panna,
    open_ank: m.open_ank,
    close_ank: m.close_ank,
    openSession: marketScheduler.isSessionOpenForBetting(m, 'OPEN'),
    closeSession: marketScheduler.isSessionOpenForBetting(m, 'CLOSE'),
    fullSession: marketScheduler.isSessionOpenForBetting(m, 'FULL')
  }));

  const starlineSchedule = starline.map(s => ({
    id: s.id,
    name: s.name,
    open_time: s.open_time,
    status: s.status,
    result: s.result,
    session: marketScheduler.isSessionOpenForBetting(s, 'DRAW')
  }));

  const kingSchedule = king.map(k => ({
    id: k.id,
    name: k.name,
    open_time: k.open_time,
    status: k.status,
    result: k.result,
    session: marketScheduler.isSessionOpenForBetting(k, 'FULL')
  }));

  res.json({
    success: true,
    istTime: istNow.toISOString(),
    istFormatted: istNow.toLocaleTimeString('en-IN', { hour12: false }),
    cutoffMinutes: marketScheduler.getCutoffMinutes(),
    regular: regularSchedule,
    starline: starlineSchedule,
    king: kingSchedule
  });
});

// Admin: Trigger manual scheduler sync
router.post('/sync-scheduler', requireAdmin, (req, res) => {
  const marketScheduler = require('../services/marketScheduler');
  const result = marketScheduler.syncAllMarketStatuses(true);
  res.json({ success: true, message: 'Market scheduler synchronized', updatedCount: result.updatedCount, changes: result.changes, istTime: result.istTime, result });
});

module.exports = router;
