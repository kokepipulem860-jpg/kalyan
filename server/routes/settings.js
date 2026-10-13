/**
 * Settings & Game Rates Routes
 * Manages notice board marquee, WhatsApp/Telegram helpline, and payout multipliers
 */

'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/store');
const { requireAdmin } = require('../middleware/auth');
const socketService = require('../services/socketService');

// Get all platform settings
router.get('/', (req, res) => {
  const settings = db.get('settings');
  const rates = db.get('gameRates');
  res.json({ success: true, settings, rates });
});

// Update settings (Admin)
router.put('/', requireAdmin, (req, res) => {
  const updated = db.setSettings(req.body);

  // Broadcast live update to all connected players & clients
  try {
    socketService.broadcastAll('SETTINGS_UPDATED', { settings: updated });
  } catch (e) {
    console.warn('Socket broadcast error:', e.message);
  }

  res.json({ success: true, message: 'Settings & Payment details updated successfully', settings: updated });
});

// Get game rates (Bhav)
router.get('/rates', (req, res) => {
  const rates = db.get('gameRates');
  res.json({ success: true, rates });
});

// Update game rates
router.put('/rates', (req, res) => {
  const newRates = req.body.rates;
  if (!Array.isArray(newRates)) {
    return res.status(400).json({ success: false, error: 'Rates array required' });
  }

  db.data.gameRates = newRates;
  db.saveSync();
  res.json({ success: true, message: 'Rates updated successfully', rates: newRates });
});

module.exports = router;
