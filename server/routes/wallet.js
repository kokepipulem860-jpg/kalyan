/**
 * Wallet, Banking & Financial Ledger Routes with Real-Time WebSocket Notifications
 * Manages deposits, withdrawals, manual point adjustments, and passbook transactions
 */

'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/store');
const walletService = require('../services/walletService');
const socketService = require('../services/socketService');
const { requireAdmin, requirePlayer } = require('../middleware/auth');

// Player: Submit deposit request (Add Points)
router.post('/deposit', requirePlayer, (req, res) => {
  const { userId, amount, method, utr } = req.body;
  const targetUserId = req.user?.id || userId;
  const result = walletService.requestDeposit(targetUserId, amount, method, utr);
  if (!result.success) {
    return res.status(400).json(result);
  }

  // Notify Admins in real-time of new deposit request
  try {
    socketService.broadcastToAdmins('DEPOSIT_REQUESTED', result.deposit);
  } catch (e) {
    console.warn('Socket error:', e.message);
  }

  res.json({ success: true, message: 'Deposit request submitted. Points will be credited upon UTR verification.', deposit: result.deposit });
});

// Player: Submit withdrawal request
router.post('/withdraw', requirePlayer, (req, res) => {
  const { userId, amount, method, destination } = req.body;
  const targetUserId = req.user?.id || userId;
  const result = walletService.requestWithdrawal(targetUserId, amount, method, destination);
  if (!result.success) {
    return res.status(400).json(result);
  }

  // Notify Admins in real-time of new withdrawal request
  try {
    socketService.broadcastToAdmins('WITHDRAWAL_REQUESTED', result.withdrawal);
  } catch (e) {
    console.warn('Socket error:', e.message);
  }

  res.json({ success: true, message: 'Withdrawal requested successfully. Payout is being processed.', withdrawal: result.withdrawal, newBalance: result.balance });
});

// Player: Get Passbook Statement
router.get('/passbook', requirePlayer, (req, res) => {
  const userId = req.user?.id || req.headers['x-user-id'] || req.query.userId;
  if (!userId) return res.status(400).json({ success: false, error: 'User ID required' });

  const list = walletService.getPassbook(userId);
  res.json({ success: true, transactions: list });
});

// Admin: List all deposits
router.get('/deposits', requireAdmin, (req, res) => {
  const deposits = db.get('deposits');
  res.json({ success: true, deposits });
});

// Admin: Approve deposit
router.post('/deposits/:id/approve', requireAdmin, (req, res) => {
  const result = walletService.approveDeposit(req.params.id);
  if (!result.success) return res.status(400).json(result);

  // Notify Player in real-time that their deposit is approved!
  try {
    socketService.broadcastToUser(result.deposit.user_id, 'DEPOSIT_APPROVED', {
      amount: result.deposit.amount,
      balance: result.balance,
      depositId: result.deposit.id
    });
  } catch (e) {
    console.warn('Socket error:', e.message);
  }

  res.json({ success: true, message: 'Deposit approved and player wallet credited!', deposit: result.deposit, balance: result.balance });
});

// Admin: Reject deposit
router.post('/deposits/:id/reject', requireAdmin, (req, res) => {
  const { reason } = req.body;
  const result = walletService.rejectDeposit(req.params.id, reason);
  if (!result.success) return res.status(400).json(result);

  try {
    socketService.broadcastToUser(result.deposit.user_id, 'DEPOSIT_REJECTED', {
      depositId: result.deposit.id,
      reason: result.deposit.reason
    });
  } catch (e) {
    console.warn('Socket error:', e.message);
  }

  res.json({ success: true, message: 'Deposit request rejected.', deposit: result.deposit });
});

// Admin: List all withdrawals
router.get('/withdrawals', requireAdmin, (req, res) => {
  const withdrawals = db.get('withdrawals');
  res.json({ success: true, withdrawals });
});

// Admin: Approve withdrawal
router.post('/withdrawals/:id/approve', requireAdmin, (req, res) => {
  const { referenceNo } = req.body;
  const result = walletService.approveWithdrawal(req.params.id, referenceNo);
  if (!result.success) return res.status(400).json(result);

  // Notify Player in real-time that their payout was processed
  try {
    socketService.broadcastToUser(result.withdrawal.user_id, 'WITHDRAWAL_APPROVED', {
      amount: result.withdrawal.amount,
      referenceNo: result.withdrawal.reference_no
    });
  } catch (e) {
    console.warn('Socket error:', e.message);
  }

  res.json({ success: true, message: 'Withdrawal marked as approved & paid.', withdrawal: result.withdrawal });
});

// Admin: Reject withdrawal
router.post('/withdrawals/:id/reject', requireAdmin, (req, res) => {
  const { reason } = req.body;
  const result = walletService.rejectWithdrawal(req.params.id, reason);
  if (!result.success) return res.status(400).json(result);

  try {
    socketService.broadcastToUser(result.withdrawal.user_id, 'WITHDRAWAL_REJECTED', {
      amount: result.withdrawal.amount,
      reason: result.withdrawal.reason
    });
  } catch (e) {
    console.warn('Socket error:', e.message);
  }

  res.json({ success: true, message: 'Withdrawal rejected and points refunded to player wallet.', withdrawal: result.withdrawal });
});

// Admin: Manual point adjustments (Credit / Debit with Quota Enforcement)
router.post('/adjust', requireAdmin, (req, res) => {
  const { userId, amount, type, remark, adminName } = req.body;
  const result = walletService.adjustPoints(userId, amount, type, remark, adminName, req.admin);
  if (!result.success) return res.status(400).json(result);

  // Notify Player in real-time of balance adjustment
  try {
    socketService.broadcastToUser(userId, 'POINTS_ADJUSTED', {
      amount,
      type,
      balance: result.balance,
      remark: result.transaction.remark
    });
  } catch (e) {
    console.warn('Socket error:', e.message);
  }

  res.json({
    success: true,
    message: `Points successfully ${type === 'CREDIT' ? 'credited' : 'debited'}!`,
    balance: result.balance,
    transaction: result.transaction,
    adminRemainingQuota: result.adminRemainingQuota
  });
});

// Admin: List all Sub-Admins and their allocated quotas
router.get('/admins', requireAdmin, (req, res) => {
  const admins = db.get('admins');
  res.json({
    success: true,
    callerRole: req.admin?.role,
    admins: admins.map(a => ({
      id: a.id,
      username: a.username,
      name: a.name,
      role: a.role,
      floating_balance: a.floating_balance,
      is_unlimited: a.is_unlimited,
      allocated_by: a.allocated_by,
      created_at: a.created_at
    }))
  });
});

// Super Admin: Allocate / Refill floating points quota to a Sub-Admin
router.post('/admins/allocate-quota', requireAdmin, (req, res) => {
  if (req.admin?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Permission Denied: Only Super Admin can allocate or grant floating points to Sub-Admins.'
    });
  }

  const { adminId, amount, remark } = req.body;
  const pts = parseInt(amount, 10);
  if (isNaN(pts) || pts <= 0) {
    return res.status(400).json({ success: false, error: 'Points amount must be a positive integer' });
  }

  const targetAdmin = db.findById('admins', adminId);
  if (!targetAdmin) {
    return res.status(404).json({ success: false, error: 'Target Admin not found' });
  }

  const before = targetAdmin.floating_balance || 0;
  const after = before + pts;
  db.update('admins', adminId, { floating_balance: after });

  const allocLog = {
    id: 'AFA-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    admin_id: adminId,
    allocated_by: req.admin?.name || 'Super Admin',
    amount: pts,
    balance_before: before,
    balance_after: after,
    remark: remark || 'Quota top-up granted by Super Admin',
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };
  db.insert('adminFundAllocations', allocLog);

  res.json({
    success: true,
    message: `Successfully granted ₹${pts.toLocaleString('en-IN')} points quota to ${targetAdmin.name}! New Quota: ₹${after.toLocaleString('en-IN')}`,
    admin: targetAdmin,
    allocation: allocLog
  });
});

module.exports = router;
