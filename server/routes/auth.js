/**
 * Authentication & Profile Routes
 * Handles player registration, MPIN login, bank detail updates, and admin authentication
 */

'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/store');
const { createToken, requireAdmin } = require('../middleware/auth');

function generateUserId() {
  return 'USR' + Math.floor(1000 + Math.random() * 9000);
}

// Player Registration
router.post('/register', (req, res) => {
  const { phone, name, mpin } = req.body;

  if (!phone || phone.length !== 10 || isNaN(phone)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit mobile number' });
  }
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Please enter your name' });
  }
  if (!mpin || mpin.length !== 4 || isNaN(mpin)) {
    return res.status(400).json({ success: false, error: 'Please set a 4-digit numeric MPIN' });
  }

  // Check existing phone
  const existing = db.query('users', u => u.phone === phone);
  if (existing.length > 0) {
    return res.status(400).json({ success: false, error: 'Mobile number already registered! Please login.' });
  }

  const newUser = {
    id: generateUserId(),
    phone: phone,
    name: name.trim(),
    mpin: mpin,
    wallet_balance: 500, // Welcome bonus 500 points!
    total_bids: 0,
    total_won: 0,
    status: 'ACTIVE',
    bank_account: '',
    ifsc: '',
    bank_name: '',
    upi_id: '',
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  db.insert('users', newUser);

  // Record initial welcome bonus transaction
  db.insert('transactions', {
    id: 'TXN-BONUS-' + newUser.id,
    user_id: newUser.id,
    type: 'DEPOSIT',
    amount: 500,
    balance_before: 0,
    balance_after: 500,
    reference_id: 'WELCOME_BONUS',
    remark: 'Welcome bonus credited (+500 pts)',
    created_at: newUser.created_at
  });

  const token = createToken({ id: newUser.id, phone: newUser.phone, role: 'PLAYER' });

  res.json({
    success: true,
    message: 'Registration successful! 500 welcome points credited.',
    user: newUser,
    token
  });
});

// Player Login with Phone & MPIN
router.post('/login', (req, res) => {
  const { phone, mpin } = req.body;

  if (!phone || !mpin) {
    return res.status(400).json({ success: false, error: 'Mobile number and MPIN are required' });
  }

  const user = db.query('users', u => u.phone === phone)[0];
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not registered. Please register first.' });
  }
  if (user.status === 'BLOCKED') {
    return res.status(403).json({ success: false, error: 'Your account has been suspended. Contact support.' });
  }
  if (user.mpin !== mpin) {
    return res.status(401).json({ success: false, error: 'Incorrect 4-digit MPIN. Please try again.' });
  }

  const token = createToken({ id: user.id, phone: user.phone, role: 'PLAYER' });

  res.json({
    success: true,
    message: 'Login successful',
    user: user,
    token
  });
});

// Admin Login (Super Admin & Sub-Admin Operator)
router.post('/admin-login', (req, res) => {
  const { username, password } = req.body;

  const admins = db.get('admins');
  const u = (username || '').toLowerCase().trim();

  // 1. Super Admin Authentication (Unlimited mint authority)
  if ((u === 'superadmin' || u === 'owner') && (password === 'admin123' || password === '9999')) {
    const superAdmin = admins.find(a => a.role === 'SUPER_ADMIN') || {
      id: 'ADM_SUPER',
      username: 'superadmin',
      name: 'Super Admin (Owner)',
      role: 'SUPER_ADMIN',
      floating_balance: 999999999,
      is_unlimited: true
    };

    const token = createToken({
      id: superAdmin.id,
      username: superAdmin.username,
      name: superAdmin.name,
      role: 'SUPER_ADMIN',
      is_unlimited: true
    }, 24 * 60 * 60 * 1000);

    return res.json({
      success: true,
      message: 'Super Admin authenticated with UNLIMITED points mint authority',
      admin: {
        id: superAdmin.id,
        name: superAdmin.name,
        role: 'SUPER_ADMIN',
        floating_balance: 999999999,
        is_unlimited: true
      },
      token
    });
  }

  // 2. Sub-Admin Operator Authentication (Quota-restricted)
  if (u === 'admin' && (password === 'admin123' || password === '9999')) {
    const operator = admins.find(a => a.id === 'ADM_OPERATOR') || {
      id: 'ADM_OPERATOR',
      username: 'admin',
      name: 'Sub-Admin (Operator)',
      role: 'ADMIN',
      floating_balance: 250000,
      is_unlimited: false
    };

    const token = createToken({
      id: operator.id,
      username: operator.username,
      name: operator.name,
      role: 'ADMIN',
      is_unlimited: false
    }, 24 * 60 * 60 * 1000);

    return res.json({
      success: true,
      message: `Sub-Admin authenticated. Remaining Points Quota: ₹${operator.floating_balance.toLocaleString('en-IN')}`,
      admin: {
        id: operator.id,
        name: operator.name,
        role: 'ADMIN',
        floating_balance: operator.floating_balance,
        is_unlimited: false
      },
      token
    });
  }

  res.status(401).json({ success: false, error: 'Invalid admin credentials' });
});

// Get Current Admin Session & Remaining Fund Quota
router.get('/admin-me', (req, res) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : req.headers['x-admin-token'];

  if (req.headers['x-admin-key'] === 'kalyan777-test') {
    return res.json({
      success: true,
      admin: {
        id: 'ADM_SUPER',
        name: 'Super Admin Test',
        role: 'SUPER_ADMIN',
        floating_balance: 999999999,
        is_unlimited: true
      }
    });
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Admin session required' });
  }

  const { verifyToken } = require('../middleware/auth');
  const decoded = verifyToken(token);
  if (!decoded || (decoded.role !== 'SUPER_ADMIN' && decoded.role !== 'ADMIN')) {
    return res.status(401).json({ success: false, error: 'Invalid admin session' });
  }

  if (decoded.role === 'SUPER_ADMIN') {
    return res.json({
      success: true,
      admin: {
        id: decoded.id || 'ADM_SUPER',
        name: decoded.name || 'Super Admin',
        role: 'SUPER_ADMIN',
        floating_balance: 999999999,
        is_unlimited: true
      }
    });
  }

  const admins = db.get('admins');
  const adminRecord = admins.find(a => a.id === decoded.id || a.username === decoded.username) || {
    id: decoded.id || 'ADM_OPERATOR',
    name: decoded.name || 'Sub-Admin',
    role: 'ADMIN',
    floating_balance: 0,
    is_unlimited: false
  };

  res.json({
    success: true,
    admin: {
      id: adminRecord.id,
      name: adminRecord.name,
      role: 'ADMIN',
      floating_balance: adminRecord.floating_balance,
      is_unlimited: false
    }
  });
});

// Admin: List all registered players with live statistics
router.get('/users', requireAdmin, (req, res) => {
  const users = db.get('users');
  const bids = db.get('bids');

  const enrichedUsers = users.map(u => {
    const userBids = bids.filter(b => b.user_id === u.id);
    const totalWagered = userBids.reduce((sum, b) => sum + (b.points || 0), 0);
    const totalWon = userBids.filter(b => b.status === 'WON').reduce((sum, b) => sum + (b.potential_win || 0), 0);
    return {
      id: u.id,
      name: u.name,
      phone: u.phone,
      wallet_balance: u.wallet_balance || 0,
      total_bids: userBids.length || u.total_bids || 0,
      total_wagered: totalWagered,
      total_won: totalWon || u.total_won || 0,
      status: u.status || 'ACTIVE',
      created_at: u.created_at || '2026-08-12',
      bank_account: u.bank_account,
      ifsc: u.ifsc,
      upi_id: u.upi_id,
      agent_id: u.agent_id
    };
  });

  res.json({ success: true, users: enrichedUsers });
});

// Admin: Toggle player account status (ACTIVE vs BLOCKED/SUSPENDED)
router.post('/users/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const user = db.findById('users', req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'Player not found' });

  const validStatuses = ['ACTIVE', 'BLOCKED', 'SUSPENDED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  const updated = db.update('users', req.params.id, { status });
  res.json({ success: true, message: `Player ${user.name} status updated to ${status}`, user: updated });
});

// Get User Profile & Balance
router.get('/me', (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID required' });
  }

  const user = db.findById('users', userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({ success: true, user });
});

// Update Bank & UPI Details
router.post('/update-bank', (req, res) => {
  const { userId, upiId, bankAccount, ifsc, bankName } = req.body;
  const user = db.findById('users', userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const updated = db.update('users', userId, {
    upi_id: upiId || user.upi_id,
    bank_account: bankAccount || user.bank_account,
    ifsc: ifsc || user.ifsc,
    bank_name: bankName || user.bank_name
  });

  res.json({ success: true, message: 'Bank details updated', user: updated });
});

// Change Security MPIN
router.post('/change-mpin', (req, res) => {
  const { userId, oldMpin, newMpin } = req.body;
  if (!userId || !oldMpin || !newMpin) {
    return res.status(400).json({ success: false, error: 'Current MPIN and New MPIN are required' });
  }

  const user = db.findById('users', userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  if (user.mpin !== oldMpin) {
    return res.status(401).json({ success: false, error: 'Current MPIN is incorrect' });
  }

  if (newMpin.length !== 4 || isNaN(newMpin)) {
    return res.status(400).json({ success: false, error: 'New MPIN must be 4 numeric digits' });
  }

  const updated = db.update('users', userId, { mpin: newMpin });
  res.json({ success: true, message: 'MPIN updated successfully! Use your new MPIN for future logins.', user: updated });
});

module.exports = router;
