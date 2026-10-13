/**
 * Bidding & Wager Management Routes
 * Handles bet placement, balance deduction, player history, and admin voiding
 */

'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/store');
const walletService = require('../services/walletService');
const pattiEngine = require('../services/pattiEngine');
const marketScheduler = require('../services/marketScheduler');

function getPayoutMultiplier(gameType) {
  const rates = db.get('gameRates');
  const typeMap = {
    'Single Digit': 'single_digit',
    'Jodi': 'jodi_digit',
    'Single Patti': 'single_panna',
    'Double Patti': 'double_panna',
    'Triple Patti': 'triple_panna',
    'Half Sangam': 'half_sangam',
    'Full Sangam': 'full_sangam',
    'Andar Haruf': 'single_digit',
    'Bahar Haruf': 'single_digit'
  };
  const rateObj = rates.find(r => r.id === typeMap[gameType]);
  return rateObj ? rateObj.rate : 9.5;
}

// Place One or Multiple Bids (Cart submission)
router.post('/', (req, res) => {
  const { userId, marketId, bets } = req.body;

  if (!userId || !marketId || !Array.isArray(bets) || bets.length === 0) {
    return res.status(400).json({ success: false, error: 'Invalid bet submission data' });
  }

  const user = db.findById('users', userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  if (user.status !== 'ACTIVE') return res.status(403).json({ success: false, error: 'User account is restricted' });

  const marketInfo = db.findMarketAnywhere(marketId);
  if (!marketInfo) return res.status(404).json({ success: false, error: 'Market not found' });
  const { market, type: marketCategory } = marketInfo;
  if (market.status === 'CLOSED' || market.active === false) {
    return res.status(400).json({ success: false, error: `Bidding is closed for ${market.name}` });
  }

  const globalSettings = db.get('settings');
  if (globalSettings.is_betting_active === false || globalSettings.maintenance_mode === true) {
    return res.status(403).json({ success: false, error: 'Betting is temporarily suspended by admin' });
  }

  // Calculate total points and validate each bet
  let totalPoints = 0;
  const validatedBids = [];
  const batchId = 'BATCH-' + Date.now().toString(36).toUpperCase();

  for (let i = 0; i < bets.length; i++) {
    const bet = bets[i];
    const points = parseInt(bet.points, 10);
    if (isNaN(points) || points < 10) {
      return res.status(400).json({ success: false, error: 'Minimum bet is 10 points per number' });
    }

    let num = bet.number.toString().trim();
    const gameType = bet.gameType;
    const session = bet.session || (gameType === 'Jodi' || gameType.includes('Sangam') ? 'FULL' : 'OPEN');

    // Check if session is currently open according to IST schedule & cutoff window
    const sessionCheck = marketScheduler.isSessionOpenForBetting(market, session);
    if (!sessionCheck.allowed) {
      return res.status(400).json({ success: false, error: sessionCheck.reason });
    }

    // Validation by game type
    if (gameType === 'Single Digit' || gameType === 'Andar Haruf' || gameType === 'Bahar Haruf') {
      if (!/^[0-9]$/.test(num)) return res.status(400).json({ success: false, error: `Invalid Single Digit/Haruf: ${num}` });
    } else if (gameType === 'Jodi') {
      if (num.length === 1) num = '0' + num;
      if (!/^[0-9]{2}$/.test(num)) return res.status(400).json({ success: false, error: `Invalid Jodi: ${num}` });
    } else if (['Single Patti', 'Double Patti', 'Triple Patti'].includes(gameType)) {
      if (!/^[0-9]{3}$/.test(num)) return res.status(400).json({ success: false, error: `Invalid 3-digit Patti: ${num}` });
      num = pattiEngine.normalizePatti(num);
    } else if (gameType === 'Half Sangam') {
      const parts = num.split(/[x\-\s]+/).filter(Boolean);
      if (parts.length !== 2) return res.status(400).json({ success: false, error: `Invalid Half Sangam format: ${num}` });
      const p1 = parts[0].length === 3 ? pattiEngine.normalizePatti(parts[0]) : parts[0];
      const p2 = parts[1].length === 3 ? pattiEngine.normalizePatti(parts[1]) : parts[1];
      num = `${p1} x ${p2}`;
    } else if (gameType === 'Full Sangam') {
      const parts = num.split(/[x\-\s]+/).filter(Boolean);
      if (parts.length !== 2 || parts[0].length !== 3 || parts[1].length !== 3) {
        return res.status(400).json({ success: false, error: `Invalid Full Sangam format: ${num}` });
      }
      num = `${pattiEngine.normalizePatti(parts[0])} x ${pattiEngine.normalizePatti(parts[1])}`;
    }

    const multiplier = getPayoutMultiplier(gameType);
    const potentialWin = Math.round(points * multiplier);
    totalPoints += points;

    validatedBids.push({
      id: 'BID-' + Math.floor(10000 + Math.random() * 90000),
      user_id: user.id,
      user_name: user.name,
      market_id: market.id,
      market_name: market.name,
      market_type: marketCategory,
      game_type: gameType,
      session: session,
      number: num,
      points: points,
      payout_rate: multiplier,
      potential_win: potentialWin,
      status: 'PENDING',
      batch_id: batchId,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });
  }

  // Atomic Points Deduction
  const deductRes = walletService.deductPointsForBids(user.id, totalPoints, {
    batchId,
    remark: `Placed ${validatedBids.length} bets on ${market.name} (-${totalPoints} pts)`
  });

  if (!deductRes.success) {
    return res.status(400).json({ success: false, error: deductRes.error });
  }

  // Insert Bids
  validatedBids.forEach(bid => db.insert('bids', bid));

  // Broadcast BID_PLACED event to all connected Admin Panels
  try {
    const socketService = require('../services/socketService');
    socketService.broadcastToAdmins('BID_PLACED', {
      bids: validatedBids,
      marketId: market.id,
      marketName: market.name,
      totalPoints: totalPoints
    });
  } catch (e) {
    console.warn('Socket broadcast error:', e.message);
  }

  res.json({
    success: true,
    message: `Successfully placed ${validatedBids.length} bets! Deducted ${totalPoints} points.`,
    bidsPlaced: validatedBids,
    newBalance: deductRes.balance
  });
});

// Player's Bid History
router.get('/my', (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) return res.status(400).json({ success: false, error: 'User ID required' });

  const status = req.query.status;
  let userBids = db.query('bids', b => b.user_id === userId);

  if (status && status !== 'ALL') {
    userBids = userBids.filter(b => b.status === status);
  }

  res.json({ success: true, bids: userBids });
});

// Admin: List all bids
router.get('/all', (req, res) => {
  const bids = db.get('bids');
  res.json({ success: true, bids });
});

// Admin: Void / Cancel bid
router.post('/:id/cancel', (req, res) => {
  const bid = db.findById('bids', req.params.id);
  if (!bid) return res.status(404).json({ success: false, error: 'Bid not found' });
  if (bid.status !== 'PENDING') {
    return res.status(400).json({ success: false, error: `Cannot cancel bid that is already ${bid.status}` });
  }

  db.update('bids', bid.id, { status: 'CANCELLED' });

  // Refund points
  walletService.refundPoints(
    bid.user_id,
    bid.points,
    `Admin voided bid #${bid.id} on ${bid.market_name}`,
    bid.id
  );

  res.json({ success: true, message: `Bid #${bid.id} cancelled and ${bid.points} points refunded.` });
});

// Permutation & Motor Generator Engine
router.post('/permutations', (req, res) => {
  const { type, digits, jodi, digitsA, digitsB, includeDoubles } = req.body;

  let result = [];
  if (type === 'SP_MOTOR') {
    result = pattiEngine.generateSPMotor(digits);
  } else if (type === 'DP_MOTOR') {
    result = pattiEngine.generateDPMotor(digits);
  } else if (type === 'FAMILY_JODI') {
    result = pattiEngine.generateFamilyJodi(jodi);
  } else if (type === 'CROSSING') {
    result = pattiEngine.generateCrossing(digitsA, digitsB, includeDoubles !== false);
  } else {
    return res.status(400).json({ success: false, error: 'Unknown permutation type' });
  }

  res.json({
    success: true,
    type,
    count: result.length,
    items: result
  });
});

module.exports = router;

