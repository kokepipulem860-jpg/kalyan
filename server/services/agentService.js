/**
 * Multi-Tier Agent & Khaiwal Service for Kalyan 777
 * Manages Master Distributors, Local Khaiwals, sub-credit allocations,
 * downstream player transactions, and automated commission calculations.
 */

'use strict';

const db = require('../db/store');

class AgentService {
  /**
   * Get all registered agents
   */
  getAllAgents() {
    return db.get('agents');
  }

  /**
   * Find agent by ID
   */
  getAgentById(id) {
    return db.findById('agents', id);
  }

  /**
   * Find agent by phone
   */
  getAgentByPhone(phone) {
    const list = db.get('agents');
    return list.find(a => a.phone === phone) || null;
  }

  /**
   * Create a new agent (Super Admin or Master Agent)
   */
  createAgent({ name, phone, mpin, role = 'AGENT', masterId = null, creditLimit = 50000, commissionRate = 5.0, initialPoints = 0 }) {
    if (!name || !phone || !mpin) {
      return { success: false, error: 'Agent Name, Mobile Number and MPIN are required' };
    }

    const cleanPhone = phone.toString().trim();
    if (cleanPhone.length !== 10 || isNaN(cleanPhone)) {
      return { success: false, error: 'Mobile number must be a valid 10-digit number' };
    }

    const existing = this.getAgentByPhone(cleanPhone);
    if (existing) {
      return { success: false, error: 'An agent with this mobile number already exists' };
    }

    const id = 'AGT' + Math.floor(100 + Math.random() * 900);
    const initialBal = Math.max(0, parseInt(initialPoints, 10) || 0);

    const newAgent = {
      id,
      name: name.trim(),
      phone: cleanPhone,
      mpin: mpin.toString().trim(),
      role: role === 'MASTER_AGENT' ? 'MASTER_AGENT' : 'AGENT',
      master_id: masterId || null,
      credit_limit: parseInt(creditLimit, 10) || 50000,
      wallet_balance: initialBal,
      commission_rate: parseFloat(commissionRate) || 5.0,
      status: 'ACTIVE',
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    db.insert('agents', newAgent);

    if (initialBal > 0) {
      db.insert('agentTransactions', {
        id: 'ATXN-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        agent_id: id,
        type: 'CREDIT_ALLOCATION',
        amount: initialBal,
        balance_before: 0,
        balance_after: initialBal,
        target_user_id: null,
        remark: 'Initial points allocation on agent onboarding',
        created_at: newAgent.created_at
      });
    }

    return { success: true, message: 'Agent created successfully', agent: newAgent };
  }

  /**
   * Update agent settings / limits
   */
  updateAgent(id, updates = {}) {
    const agent = this.getAgentById(id);
    if (!agent) return { success: false, error: 'Agent not found' };

    const allowed = {};
    if (updates.name) allowed.name = updates.name.trim();
    if (updates.mpin) allowed.mpin = updates.mpin.toString().trim();
    if (updates.credit_limit !== undefined) allowed.credit_limit = parseInt(updates.credit_limit, 10) || 0;
    if (updates.commission_rate !== undefined) allowed.commission_rate = parseFloat(updates.commission_rate) || 0;
    if (updates.status) allowed.status = updates.status;
    if (updates.role) allowed.role = updates.role;

    const updated = db.update('agents', id, allowed);
    return { success: true, message: 'Agent updated successfully', agent: updated };
  }

  /**
   * Get downstream players linked to this agent
   */
  getDownstreamPlayers(agentId) {
    const players = db.query('users', u => u.agent_id === agentId);
    const allBids = db.get('bids');

    return players.map(p => {
      const playerBids = allBids.filter(b => b.user_id === p.id);
      const totalWagered = playerBids.reduce((sum, b) => sum + (b.points || 0), 0);
      const totalWon = playerBids
        .filter(b => b.status === 'WON')
        .reduce((sum, b) => sum + (b.potential_win || 0), 0);

      return {
        id: p.id,
        name: p.name,
        phone: p.phone,
        wallet_balance: p.wallet_balance || 0,
        status: p.status,
        total_bids_count: playerBids.length,
        total_wagered: totalWagered,
        total_won: totalWon,
        created_at: p.created_at
      };
    });
  }

  /**
   * Link an existing player to an agent
   */
  linkPlayerToAgent(playerId, agentId) {
    const player = db.findById('users', playerId);
    if (!player) return { success: false, error: 'Player not found' };

    const agent = this.getAgentById(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    const updated = db.update('users', playerId, { agent_id: agentId });
    return { success: true, message: `Player ${player.name} linked to Agent ${agent.name}`, player: updated };
  }

  /**
   * Cash-in-Hand Point Top-Up: Transfer points from Agent to Player
   */
  transferPointsToPlayer(agentId, playerId, points, remark = '') {
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts <= 0) {
      return { success: false, error: 'Points must be a positive integer' };
    }

    const agent = this.getAgentById(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.status !== 'ACTIVE') return { success: false, error: 'Agent account is suspended' };

    if (agent.wallet_balance < pts) {
      return {
        success: false,
        error: `Insufficient Agent Balance! Agent has ${agent.wallet_balance} pts, cannot transfer ${pts} pts.`
      };
    }

    const player = db.findById('users', playerId);
    if (!player) return { success: false, error: 'Player not found' };
    if (player.status !== 'ACTIVE') return { success: false, error: 'Player account is inactive' };

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const txnId = 'ATXN-' + Math.random().toString(36).substring(2, 9).toUpperCase();

    // 1. Deduct from Agent
    const agentBefore = agent.wallet_balance;
    const agentAfter = agentBefore - pts;
    db.update('agents', agentId, { wallet_balance: agentAfter });

    // 2. Credit to Player
    const playerBefore = player.wallet_balance;
    const playerAfter = playerBefore + pts;
    db.update('users', playerId, { wallet_balance: playerAfter });

    // 3. Record in Agent Ledger
    const agentTxn = {
      id: txnId,
      agent_id: agentId,
      type: 'TRANSFER_TO_PLAYER',
      amount: pts,
      balance_before: agentBefore,
      balance_after: agentAfter,
      target_user_id: playerId,
      remark: remark || `Cash recharge to player ${player.name} (${player.phone})`,
      created_at: now
    };
    db.insert('agentTransactions', agentTxn);

    // 4. Record in Player Passbook
    db.insert('transactions', {
      id: 'TXN-' + txnId,
      user_id: playerId,
      type: 'DEPOSIT',
      amount: pts,
      balance_before: playerBefore,
      balance_after: playerAfter,
      reference_id: txnId,
      remark: `Agent Cash Top-Up (+${pts} pts from ${agent.name})`,
      created_at: now
    });

    return {
      success: true,
      message: `Successfully transferred ${pts} points to ${player.name}!`,
      agentBalance: agentAfter,
      playerBalance: playerAfter,
      transaction: agentTxn
    };
  }

  /**
   * Cash-Out Payout: Retrieve points from Player back to Agent wallet
   */
  withdrawPointsFromPlayer(agentId, playerId, points, remark = '') {
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts <= 0) {
      return { success: false, error: 'Points must be a positive integer' };
    }

    const agent = this.getAgentById(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.status !== 'ACTIVE') return { success: false, error: 'Agent account is suspended' };

    const player = db.findById('users', playerId);
    if (!player) return { success: false, error: 'Player not found' };
    if (player.status !== 'ACTIVE') return { success: false, error: 'Player account is inactive' };

    if (player.wallet_balance < pts) {
      return {
        success: false,
        error: `Insufficient Player Balance! Player has ${player.wallet_balance} pts, cannot retrieve ${pts} pts.`
      };
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const txnId = 'ATXN-' + Math.random().toString(36).substring(2, 9).toUpperCase();

    // 1. Deduct from Player
    const playerBefore = player.wallet_balance;
    const playerAfter = playerBefore - pts;
    db.update('users', playerId, { wallet_balance: playerAfter });

    // 2. Credit to Agent
    const agentBefore = agent.wallet_balance;
    const agentAfter = agentBefore + pts;
    db.update('agents', agentId, { wallet_balance: agentAfter });

    // 3. Record in Agent Ledger
    const agentTxn = {
      id: txnId,
      agent_id: agentId,
      type: 'WITHDRAW_FROM_PLAYER',
      amount: pts,
      balance_before: agentBefore,
      balance_after: agentAfter,
      target_user_id: playerId,
      remark: remark || `Cash payout collected from player ${player.name}`,
      created_at: now
    };
    db.insert('agentTransactions', agentTxn);

    // 4. Record in Player Passbook
    db.insert('transactions', {
      id: 'TXN-' + txnId,
      user_id: playerId,
      type: 'WITHDRAWAL',
      amount: pts,
      balance_before: playerBefore,
      balance_after: playerAfter,
      reference_id: txnId,
      remark: `Agent Cash Payout (-${pts} pts collected by ${agent.name})`,
      created_at: now
    });

    return {
      success: true,
      message: `Successfully collected ${pts} points payout from ${player.name}!`,
      agentBalance: agentAfter,
      playerBalance: playerAfter,
      transaction: agentTxn
    };
  }

  /**
   * Super Admin Adjusts Agent Floating Balance (with Sub-Admin Quota Guardrail)
   */
  adjustAgentBalance(agentId, amount, type = 'CREDIT', remark = '', adminName = 'Super Admin', callerAdmin = null) {
    const pts = parseInt(amount, 10);
    if (isNaN(pts) || pts <= 0) {
      return { success: false, error: 'Amount must be a positive integer' };
    }

    const agent = this.getAgentById(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

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
            error: `Insufficient Admin Quota! You only have ₹${availableQuota.toLocaleString('en-IN')} allocated by Super Admin. Cannot transfer ₹${pts.toLocaleString('en-IN')} to agent.`
          };
        }
      }
    }

    const before = agent.wallet_balance;
    let after = before;

    if (type === 'CREDIT') {
      after = before + pts;
      if (!isSuperAdmin && subAdminRecord) {
        const newQuota = (subAdminRecord.floating_balance || 0) - pts;
        db.update('admins', subAdminRecord.id, { floating_balance: newQuota });
      }
    } else if (type === 'DEBIT') {
      if (before < pts) {
        return { success: false, error: `Cannot debit ${pts} pts: agent balance is only ${before} pts` };
      }
      after = before - pts;
      if (!isSuperAdmin && subAdminRecord) {
        const newQuota = (subAdminRecord.floating_balance || 0) + pts;
        db.update('admins', subAdminRecord.id, { floating_balance: newQuota });
      }
    } else {
      return { success: false, error: 'Invalid adjustment type: must be CREDIT or DEBIT' };
    }

    db.update('agents', agentId, { wallet_balance: after });

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const txn = {
      id: 'ATXN-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      agent_id: agentId,
      type: type === 'CREDIT' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      amount: pts,
      balance_before: before,
      balance_after: after,
      target_user_id: null,
      remark: remark || `Manual balance adjustment by ${adminName}`,
      created_at: now
    };
    db.insert('agentTransactions', txn);

    return {
      success: true,
      message: `Agent balance successfully ${type === 'CREDIT' ? 'credited' : 'debited'}!`,
      balance: after,
      transaction: txn,
      adminRemainingQuota: !isSuperAdmin && subAdminRecord ? subAdminRecord.floating_balance : 'UNLIMITED'
    };
  }

  /**
   * Real-Time Commission Calculation & Daily Khata Sheet
   */
  calculateCommissionSheet(agentId, options = {}) {
    const agent = this.getAgentById(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    const downstream = this.getDownstreamPlayers(agentId);
    const downstreamIds = new Set(downstream.map(p => p.id));

    const allBids = db.get('bids');
    const agentBids = allBids.filter(b => downstreamIds.has(b.user_id));

    let totalTurnover = 0;
    let totalPayouts = 0;
    let pendingBids = 0;
    let wonBids = 0;
    let lostBids = 0;

    agentBids.forEach(b => {
      totalTurnover += (b.points || 0);
      if (b.status === 'WON') {
        wonBids++;
        totalPayouts += (b.potential_win || 0);
      } else if (b.status === 'LOST') {
        lostBids++;
      } else {
        pendingBids++;
      }
    });

    const commRate = agent.commission_rate || 5.0;
    const commissionEarned = Math.round((totalTurnover * commRate) / 100);
    const netHouseMargin = totalTurnover - totalPayouts;
    const netPayableToHouse = netHouseMargin - commissionEarned;

    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // Format WhatsApp Daily Khata Slip
    const khataText = [
      `════════════════════════════`,
      `👑 KALYAN 777 - DAILY KHATA SLIP`,
      `════════════════════════════`,
      `Khaiwal: ${agent.name} (${agent.id})`,
      `Date: ${dateStr} | IST`,
      `Downstream Players: ${downstream.length} Active`,
      `Total Bids Handled: ${agentBids.length} wagers`,
      `────────────────────────────`,
      `📊 Gross Turnover: ₹${totalTurnover.toLocaleString('en-IN')}`,
      `🏆 Total Winning Payout: ₹${totalPayouts.toLocaleString('en-IN')}`,
      `📈 Net Round Margin: ₹${netHouseMargin.toLocaleString('en-IN')}`,
      `💵 Khaiwal Commission (${commRate}%): ₹${commissionEarned.toLocaleString('en-IN')}`,
      `────────────────────────────`,
      `🏦 Net Settlement to House: ₹${netPayableToHouse.toLocaleString('en-IN')}`,
      `Current Agent Floating Pts: ${agent.wallet_balance.toLocaleString('en-IN')} pts`,
      `════════════════════════════`,
      `Generated by Kalyan 777 Syndicate Network`
    ].join('\n');

    const sheetData = {
      playersCount: downstream.length,
      totalBids: agentBids.length,
      pendingBids,
      wonBids,
      lostBids,
      totalTurnover,
      totalPayouts,
      netHouseMargin,
      commissionEarned,
      netPayableToHouse,
      netKhaiwalMargin: commissionEarned,
      commissionRate: commRate,
      whatsappText: khataText
    };

    return {
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        commission_rate: commRate,
        wallet_balance: agent.wallet_balance,
        credit_limit: agent.credit_limit
      },
      summary: sheetData,
      sheet: sheetData,
      downstreamPlayers: downstream,
      khataText
    };
  }

  /**
   * Get audit transactions for this agent
   */
  getAgentTransactions(agentId) {
    const list = db.get('agentTransactions');
    return list.filter(t => t.agent_id === agentId);
  }
}

module.exports = new AgentService();
