/**
 * Agent & Khaiwal Network API Routes
 * Handles Khaiwal authentication, downstream player cash management,
 * point transfers, and daily Khata commission statements.
 */

'use strict';

const express = require('express');
const router = express.Router();
const agentService = require('../services/agentService');
const { createToken, requireAdmin, requireAgent } = require('../middleware/auth');
const socketService = require('../services/socketService');

// Agent Login with Mobile & MPIN
router.post('/login', (req, res) => {
  const { phone, mpin } = req.body;
  if (!phone || !mpin) {
    return res.status(400).json({ success: false, error: 'Mobile number and MPIN are required' });
  }

  const agent = agentService.getAgentByPhone(phone.toString().trim());
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found with this mobile number' });
  }

  if (agent.status !== 'ACTIVE') {
    return res.status(403).json({ success: false, error: 'Agent account is suspended' });
  }

  if (agent.mpin !== mpin.toString().trim()) {
    return res.status(401).json({ success: false, error: 'Incorrect MPIN' });
  }

  const token = createToken({
    id: agent.id,
    phone: agent.phone,
    name: agent.name,
    role: agent.role || 'AGENT'
  });

  res.json({
    success: true,
    message: `Welcome back, ${agent.name}!`,
    agent,
    token
  });
});

// Get Current Agent Profile
router.get('/me', requireAgent, (req, res) => {
  const agent = agentService.getAgentById(req.agent.id);
  if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
  res.json({ success: true, agent });
});

// Get Downstream Players for this Agent
router.get('/players', requireAgent, (req, res) => {
  const players = agentService.getDownstreamPlayers(req.agent.id);
  res.json({ success: true, players, count: players.length });
});

// Cash Recharge: Agent transfers points to Downstream Player
router.post('/transfer-points', requireAgent, (req, res) => {
  const { playerId, points, remark } = req.body;
  if (!playerId || !points) {
    return res.status(400).json({ success: false, error: 'Player ID and Points are required' });
  }

  const result = agentService.transferPointsToPlayer(req.agent.id, playerId, points, remark);
  if (!result.success) {
    return res.status(400).json(result);
  }

  // Real-Time Notification to Player
  try {
    socketService.broadcastToUser(playerId, 'POINTS_ADJUSTED', {
      amount: parseInt(points, 10),
      type: 'AGENT_TOPUP',
      balance: result.playerBalance,
      remark: result.transaction.remark
    });
  } catch (e) {
    console.warn('Socket notify error:', e.message);
  }

  res.json(result);
});

// Cash Payout: Agent retrieves points from Player
router.post('/withdraw-points', requireAgent, (req, res) => {
  const { playerId, points, remark } = req.body;
  if (!playerId || !points) {
    return res.status(400).json({ success: false, error: 'Player ID and Points are required' });
  }

  const result = agentService.withdrawPointsFromPlayer(req.agent.id, playerId, points, remark);
  if (!result.success) {
    return res.status(400).json(result);
  }

  // Real-Time Notification to Player
  try {
    socketService.broadcastToUser(playerId, 'POINTS_ADJUSTED', {
      amount: parseInt(points, 10),
      type: 'AGENT_WITHDRAWAL',
      balance: result.playerBalance,
      remark: result.transaction.remark
    });
  } catch (e) {
    console.warn('Socket notify error:', e.message);
  }

  res.json(result);
});

// Real-Time Commission & Daily Khata Sheet
router.get('/commission-sheet', requireAgent, (req, res) => {
  const sheet = agentService.calculateCommissionSheet(req.agent.id, req.query);
  res.json(sheet);
});

// Agent Transaction History
router.get('/transactions', requireAgent, (req, res) => {
  const txns = agentService.getAgentTransactions(req.agent.id);
  res.json({ success: true, transactions: txns });
});

// ----------------------------------------------------------------------------
// SUPER ADMIN ENDPOINTS (requireAdmin)
// ----------------------------------------------------------------------------

// List All Agents in Hierarchy
router.get('/', requireAdmin, (req, res) => {
  const agents = agentService.getAllAgents();
  const enriched = agents.map(a => {
    const downstream = agentService.getDownstreamPlayers(a.id);
    return {
      ...a,
      downstreamCount: downstream.length,
      downstreamTotalBalance: downstream.reduce((sum, p) => sum + (p.wallet_balance || 0), 0)
    };
  });
  res.json({ success: true, agents: enriched });
});

// Super Admin Gets Downstream Players for an Agent
router.get('/:id/players', requireAdmin, (req, res) => {
  const players = agentService.getDownstreamPlayers(req.params.id);
  res.json({ success: true, players, count: players.length });
});

// Super Admin Gets Commission Sheet for an Agent
router.get('/:id/commission-sheet', requireAdmin, (req, res) => {
  const sheet = agentService.calculateCommissionSheet(req.params.id, req.query);
  res.json(sheet);
});

// Super Admin Creates a New Agent
router.post('/', requireAdmin, (req, res) => {
  const result = agentService.createAgent(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Super Admin Updates Agent Limits / Status
router.put('/:id', requireAdmin, (req, res) => {
  const result = agentService.updateAgent(req.params.id, req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Super Admin Adjusts Agent Floating Balance
router.post('/:id/adjust', requireAdmin, (req, res) => {
  const { amount, type, remark } = req.body;
  const adminName = req.admin?.name || 'Super Admin';
  const result = agentService.adjustAgentBalance(req.params.id, amount, type, remark, adminName, req.admin);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Super Admin Links a Player to an Agent
router.post('/link-player', requireAdmin, (req, res) => {
  const { playerId, agentId } = req.body;
  if (!playerId || !agentId) {
    return res.status(400).json({ success: false, error: 'Player ID and Agent ID are required' });
  }
  const result = agentService.linkPlayerToAgent(playerId, agentId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

module.exports = router;
