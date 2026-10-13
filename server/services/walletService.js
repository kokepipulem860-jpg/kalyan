/**
 * Atomic Wallet & Points Ledger Service
 * Manages player point balances, deposits, withdrawals and immutable transaction passbook
 */

'use strict';

const db = require('../db/store');

function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

class WalletService {
  getUser(userId) {
    return db.findById('users', userId);
  }

  // Deduct points when placing one or more bids
  deductPointsForBids(userId, totalPoints, bidsSummary) {
    const user = db.findById('users', userId);
    if (!user) return { success: false, error: 'User not found' };
    if (user.status !== 'ACTIVE') return { success: false, error: 'User account is suspended or blocked' };
    if (user.wallet_balance < totalPoints) {
      return { 
        success: false, 
        error: `Insufficient balance! You have ${user.wallet_balance} pts, but bids require ${totalPoints} pts.` 
      };
    }

    const balanceBefore = user.wallet_balance;
    const balanceAfter = balanceBefore - totalPoints;

    db.update('users', userId, {
      wallet_balance: balanceAfter,
      total_bids: (user.total_bids || 0) + 1
    });

    const txnId = generateId('TXN');
    const txn = {
      id: txnId,
      user_id: userId,
      type: 'BID_PLACED',
      amount: totalPoints,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_id: bidsSummary.batchId || bidsSummary.bidId || txnId,
      remark: bidsSummary.remark || `Placed bets (${totalPoints} points)`,
      created_at: getTimestamp()
    };
    db.insert('transactions', txn);

    return { success: true, balance: balanceAfter, transaction: txn };
  }

  // Credit winning points to user
  creditPointsForWin(userId, winPoints, remark, refId) {
    const user = db.findById('users', userId);
    if (!user) return { success: false, error: 'User not found' };

    const balanceBefore = user.wallet_balance;
    const balanceAfter = balanceBefore + winPoints;

    db.update('users', userId, {
      wallet_balance: balanceAfter,
      total_won: (user.total_won || 0) + winPoints
    });

    const txnId = generateId('TXN');
    const txn = {
      id: txnId,
      user_id: userId,
      type: 'WIN_CREDITED',
      amount: winPoints,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_id: refId || txnId,
      remark: remark || `Winnings credited (+${winPoints} pts)`,
      created_at: getTimestamp()
    };
    db.insert('transactions', txn);

    return { success: true, balance: balanceAfter, transaction: txn };
  }

  // Refund points (e.g. cancelled bid or cancelled market)
  refundPoints(userId, refundPoints, remark, refId) {
    const user = db.findById('users', userId);
    if (!user) return { success: false, error: 'User not found' };

    const balanceBefore = user.wallet_balance;
    const balanceAfter = balanceBefore + refundPoints;

    db.update('users', userId, {
      wallet_balance: balanceAfter
    });

    const txnId = generateId('TXN');
    const txn = {
      id: txnId,
      user_id: userId,
      type: 'BID_REFUND',
      amount: refundPoints,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_id: refId || txnId,
      remark: remark || `Bid points refunded (+${refundPoints} pts)`,
      created_at: getTimestamp()
    };
    db.insert('transactions', txn);

    return { success: true, balance: balanceAfter, transaction: txn };
  }

  // Player requests deposit (Add points)
  requestDeposit(userId, amount, method, utr) {
    const user = db.findById('users', userId);
    if (!user) return { success: false, error: 'User not found' };

    const pts = parseInt(amount, 10);
    const settings = db.get('settings');
    const minDep = settings.min_deposit || 100;
    if (isNaN(pts) || pts < minDep) {
      return { success: false, error: `Minimum deposit is ${minDep} points` };
    }
    if (!utr || utr.trim().length < 6) {
      return { success: false, error: 'Please enter a valid 12-digit UPI / UTR transaction reference number' };
    }

    // Check duplicate UTR
    const existing = db.query('deposits', d => d.utr === utr.trim());
    if (existing.length > 0) {
      return { success: false, error: 'This UTR / Transaction reference has already been submitted' };
    }

    const depId = generateId('DEP');
    const dep = {
      id: depId,
      user_id: userId,
      user_name: user.name,
      amount: pts,
      method: method || 'UPI Transfer',
      utr: utr.trim(),
      status: 'PENDING',
      requested_at: getTimestamp()
    };

    db.insert('deposits', dep);
    return { success: true, deposit: dep };
  }

  // Admin approves deposit
  approveDeposit(depositId) {
    const dep = db.findById('deposits', depositId);
    if (!dep) return { success: false, error: 'Deposit request not found' };
    if (dep.status !== 'PENDING') return { success: false, error: `Deposit is already ${dep.status}` };

    const user = db.findById('users', dep.user_id);
    if (!user) return { success: false, error: 'User not found' };

    const balanceBefore = user.wallet_balance;
    const balanceAfter = balanceBefore + dep.amount;

    db.update('users', dep.user_id, {
      wallet_balance: balanceAfter
    });

    db.update('deposits', depositId, {
      status: 'APPROVED',
      approved_at: getTimestamp()
    });

    const txnId = generateId('TXN');
    const txn = {
      id: txnId,
      user_id: dep.user_id,
      type: 'DEPOSIT',
      amount: dep.amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_id: depositId,
      remark: `Deposit approved via ${dep.method} (UTR: ${dep.utr})`,
      created_at: getTimestamp()
    };
    db.insert('transactions', txn);

    return { success: true, deposit: dep, balance: balanceAfter };
  }

  // Admin rejects deposit
  rejectDeposit(depositId, reason) {
    const dep = db.findById('deposits', depositId);
    if (!dep) return { success: false, error: 'Deposit request not found' };
    if (dep.status !== 'PENDING') return { success: false, error: `Deposit is already ${dep.status}` };

    db.update('deposits', depositId, {
      status: 'REJECTED',
      reason: reason || 'UTR verification failed with bank statement',
      rejected_at: getTimestamp()
    });

    return { success: true, deposit: dep };
  }

  // Player requests withdrawal
  requestWithdrawal(userId, amount, method, destination) {
    const user = db.findById('users', userId);
    if (!user) return { success: false, error: 'User not found' };

    const pts = parseInt(amount, 10);
    const settings = db.get('settings');
    const minWit = settings.min_withdrawal || 500;
    if (isNaN(pts) || pts < minWit) {
      return { success: false, error: `Minimum withdrawal is ${minWit} points` };
    }
    if (user.wallet_balance < pts) {
      return { success: false, error: `Insufficient balance! You have ${user.wallet_balance} pts.` };
    }

    // Immediately hold/deduct points from wallet
    const balanceBefore = user.wallet_balance;
    const balanceAfter = balanceBefore - pts;

    db.update('users', userId, {
      wallet_balance: balanceAfter
    });

    const witId = generateId('WIT');
    const wit = {
      id: witId,
      user_id: userId,
      user_name: user.name,
      amount: pts,
      method: method || 'UPI',
      destination: destination || user.upi_id || 'Primary Bank Account',
      status: 'PENDING',
      requested_at: getTimestamp()
    };
    db.insert('withdrawals', wit);

    const txnId = generateId('TXN');
    const txn = {
      id: txnId,
      user_id: userId,
      type: 'WITHDRAWAL',
      amount: pts,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_id: witId,
      remark: `Withdrawal requested to ${wit.destination}`,
      created_at: getTimestamp()
    };
    db.insert('transactions', txn);

    return { success: true, withdrawal: wit, balance: balanceAfter };
  }

  // Admin approves withdrawal (payout completed)
  approveWithdrawal(withdrawalId, refNo) {
    const wit = db.findById('withdrawals', withdrawalId);
    if (!wit) return { success: false, error: 'Withdrawal not found' };
    if (wit.status !== 'PENDING') return { success: false, error: `Withdrawal is already ${wit.status}` };

    db.update('withdrawals', withdrawalId, {
      status: 'APPROVED',
      reference_no: refNo || 'CMS-' + Math.floor(100000 + Math.random() * 900000),
      approved_at: getTimestamp()
    });

    return { success: true, withdrawal: wit };
  }

  // Admin rejects withdrawal (refund points back to wallet)
  rejectWithdrawal(withdrawalId, reason) {
    const wit = db.findById('withdrawals', withdrawalId);
    if (!wit) return { success: false, error: 'Withdrawal not found' };
    if (wit.status !== 'PENDING') return { success: false, error: `Withdrawal is already ${wit.status}` };

    const user = db.findById('users', wit.user_id);
    if (user) {
      const balanceBefore = user.wallet_balance;
      const balanceAfter = balanceBefore + wit.amount;
      db.update('users', wit.user_id, {
        wallet_balance: balanceAfter
      });

      const txnId = generateId('TXN');
      db.insert('transactions', {
        id: txnId,
        user_id: wit.user_id,
        type: 'BID_REFUND',
        amount: wit.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_id: withdrawalId,
        remark: `Withdrawal rejected & points refunded: ${reason || 'Details incorrect'}`,
        created_at: getTimestamp()
      });
    }

    db.update('withdrawals', withdrawalId, {
      status: 'REJECTED',
      reason: reason || 'Incorrect payout details',
      rejected_at: getTimestamp()
    });

    return { success: true, withdrawal: wit };
  }

  // Admin manual point adjustments with Super Admin vs Sub-Admin Quota Enforcement
  adjustPoints(userId, amount, type, remark, adminName, callerAdmin = null) {
    const user = db.findById('users', userId);
    if (!user) return { success: false, error: 'User not found' };

    const pts = parseInt(amount, 10);
    if (isNaN(pts) || pts <= 0) return { success: false, error: 'Invalid amount' };

    const isSuperAdmin = !callerAdmin || callerAdmin.role === 'SUPER_ADMIN' || callerAdmin.is_unlimited === true;
    let subAdminRecord = null;

    if (!isSuperAdmin) {
      const admins = db.get('admins');
      subAdminRecord = admins.find(a => a.id === callerAdmin.id || a.username === callerAdmin.username) || admins.find(a => a.id === 'ADM_OPERATOR');
      if (!subAdminRecord) {
        return { success: false, error: 'Sub-Admin account not found in system records' };
      }

      if (type === 'CREDIT') {
        const availableQuota = subAdminRecord.floating_balance || 0;
        if (availableQuota < pts) {
          return {
            success: false,
            error: `Insufficient Admin Quota! You have only ₹${availableQuota.toLocaleString('en-IN')} allocated by Super Admin. Cannot credit ₹${pts.toLocaleString('en-IN')}. Please contact Super Admin.`
          };
        }
      }
    }

    const balanceBefore = user.wallet_balance;
    let balanceAfter = balanceBefore;

    if (type === 'CREDIT') {
      balanceAfter += pts;
      // Deduct from Sub-Admin quota if caller is not Super Admin
      if (!isSuperAdmin && subAdminRecord) {
        const newQuota = (subAdminRecord.floating_balance || 0) - pts;
        db.update('admins', subAdminRecord.id, { floating_balance: newQuota });
      }
    } else if (type === 'DEBIT') {
      if (balanceBefore < pts) return { success: false, error: 'Insufficient user balance' };
      balanceAfter -= pts;
      // Return points to Sub-Admin quota if caller is not Super Admin
      if (!isSuperAdmin && subAdminRecord) {
        const newQuota = (subAdminRecord.floating_balance || 0) + pts;
        db.update('admins', subAdminRecord.id, { floating_balance: newQuota });
      }
    } else {
      return { success: false, error: 'Invalid adjustment type (CREDIT or DEBIT required)' };
    }

    db.update('users', userId, {
      wallet_balance: balanceAfter
    });

    const txnId = generateId('TXN');
    const txn = {
      id: txnId,
      user_id: userId,
      type: type === 'CREDIT' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      amount: pts,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      reference_id: txnId,
      remark: `Manual ${type} by ${adminName || 'Admin'}: ${remark || 'Balance adjustment'}`,
      created_at: getTimestamp()
    };
    db.insert('transactions', txn);

    return {
      success: true,
      balance: balanceAfter,
      transaction: txn,
      adminRemainingQuota: !isSuperAdmin && subAdminRecord ? subAdminRecord.floating_balance : 'UNLIMITED'
    };
  }

  // Fetch transactions for user passbook
  getPassbook(userId) {
    return db.query('transactions', t => t.user_id === userId);
  }
}

module.exports = new WalletService();
