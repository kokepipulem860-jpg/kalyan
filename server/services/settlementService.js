/**
 * Automatic Settlement & Payout Engine
 * Resolves outcomes for Single, Jodi, Patti and Sangam games upon result declaration
 */

'use strict';

const db = require('../db/store');
const pattiEngine = require('./pattiEngine');
const walletService = require('./walletService');

class SettlementService {
  declareResult(marketId, session, rawPanna, declaredBy = 'Super Admin') {
    const market = db.findById('markets', marketId);
    if (!market) return { success: false, error: 'Market not found' };

    const panna = pattiEngine.normalizePatti(rawPanna);
    const ank = pattiEngine.calculateAnk(panna);

    if (!panna || panna.length !== 3 || ank === null) {
      return { success: false, error: 'Invalid 3-digit Patti' };
    }

    // Update Market Result
    if (session === 'OPEN') {
      market.open_panna = panna;
      market.open_ank = ank;
      market.status = market.close_panna ? 'CLOSED' : 'RUNNING';
    } else if (session === 'CLOSE') {
      market.close_panna = panna;
      market.close_ank = ank;
      market.status = 'CLOSED';
    } else {
      return { success: false, error: 'Invalid session (must be OPEN or CLOSE)' };
    }
    db.update('markets', marketId, market);

    const fullJodi = (market.open_ank || '0') + (market.close_ank || ank);

    // Fetch all pending bids for this market
    const pendingBids = db.query('bids', b => b.market_id === marketId && b.status === 'PENDING');
    let winnersCount = 0;
    let totalPayout = 0;
    const winnersList = [];

    pendingBids.forEach(bid => {
      let won = false;

      if (session === 'OPEN') {
        if (bid.session === 'OPEN') {
          if (bid.game_type === 'Single Digit' && bid.number === ank) won = true;
          if (['Single Patti', 'Double Patti', 'Triple Patti'].includes(bid.game_type) && bid.number === panna) won = true;
        }
      } else if (session === 'CLOSE') {
        if (bid.session === 'CLOSE') {
          if (bid.game_type === 'Single Digit' && bid.number === ank) won = true;
          if (['Single Patti', 'Double Patti', 'Triple Patti'].includes(bid.game_type) && bid.number === panna) won = true;
        }
        // Jodi settlement occurs on CLOSE
        if (bid.game_type === 'Jodi' && bid.session === 'FULL') {
          if (bid.number === fullJodi) won = true;
        }
        // Half Sangam
        if (bid.game_type === 'Half Sangam') {
          const opt1 = `${market.open_panna} x ${market.close_ank}`;
          const opt2 = `${market.open_ank} x ${market.close_panna}`;
          if (bid.number === opt1 || bid.number === opt2) won = true;
        }
        // Full Sangam
        if (bid.game_type === 'Full Sangam') {
          const fullCombo = `${market.open_panna} x ${market.close_panna}`;
          if (bid.number === fullCombo) won = true;
        }
      }

      if (won) {
        const payout = bid.potential_win || Math.round(bid.points * bid.payout_rate);
        bid.status = 'WON';
        db.update('bids', bid.id, { status: 'WON' });

        walletService.creditPointsForWin(
          bid.user_id,
          payout,
          `Won ${bid.game_type} on ${market.name} (${session}): ${bid.number}`,
          bid.id
        );

        winnersCount++;
        totalPayout += payout;
        winnersList.push({
          bidId: bid.id,
          userId: bid.user_id,
          userName: bid.user_name,
          gameType: bid.game_type,
          number: bid.number,
          points: bid.points,
          winPoints: payout
        });
      } else {
        // Mark as lost if this session was the final outcome
        if (session === 'OPEN' && bid.session === 'OPEN') {
          bid.status = 'LOST';
          db.update('bids', bid.id, { status: 'LOST' });
        } else if (session === 'CLOSE' && (bid.session === 'CLOSE' || bid.session === 'FULL')) {
          bid.status = 'LOST';
          db.update('bids', bid.id, { status: 'LOST' });
        }
      }
    });

    // Record Result Audit Log
    const logId = 'LOG-' + Math.floor(100 + Math.random() * 900);
    const logEntry = {
      id: logId,
      market_id: marketId,
      market_name: market.name,
      session: session,
      panna: panna,
      ank: ank,
      declared_by: declaredBy,
      time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      winners_count: winnersCount,
      total_payout: totalPayout
    };
    db.insert('resultLogs', logEntry);

    return {
      success: true,
      market,
      session,
      panna,
      ank,
      fullJodi,
      winnersCount,
      totalPayout,
      winnersList,
      logEntry
    };
  }

  declareStarlineResult(starlineId, rawPanna, declaredBy = 'Super Admin') {
    const market = db.findById('starlineMarkets', starlineId);
    if (!market) return { success: false, error: 'Starline market not found' };

    const panna = pattiEngine.normalizePatti(rawPanna);
    const ank = pattiEngine.calculateAnk(panna);

    if (!panna || panna.length !== 3 || ank === null) {
      return { success: false, error: 'Invalid 3-digit Patti for Starline' };
    }

    const fullResult = `${panna}-${ank}`;
    market.result = fullResult;
    market.status = 'CLOSED';
    db.update('starlineMarkets', starlineId, market);

    // Fetch pending bids for this starline market
    const pendingBids = db.query('bids', b => b.market_id === starlineId && b.status === 'PENDING');
    let winnersCount = 0;
    let totalPayout = 0;
    const winnersList = [];

    pendingBids.forEach(bid => {
      let won = false;
      if (bid.game_type === 'Single Digit' && bid.number === ank) won = true;
      if (['Single Patti', 'Double Patti', 'Triple Patti'].includes(bid.game_type) && bid.number === panna) won = true;

      if (won) {
        const payout = bid.potential_win || Math.round(bid.points * (bid.payout_rate || 9.5));
        bid.status = 'WON';
        db.update('bids', bid.id, { status: 'WON' });

        walletService.creditPointsForWin(
          bid.user_id,
          payout,
          `Won Starline ${bid.game_type} on ${market.name}: ${bid.number}`,
          bid.id
        );

        winnersCount++;
        totalPayout += payout;
        winnersList.push({
          bidId: bid.id,
          userId: bid.user_id,
          userName: bid.user_name,
          gameType: bid.game_type,
          number: bid.number,
          points: bid.points,
          winPoints: payout
        });
      } else {
        bid.status = 'LOST';
        db.update('bids', bid.id, { status: 'LOST' });
      }
    });

    // Record Result Audit Log
    const logId = 'LOG-SL-' + Math.floor(100 + Math.random() * 900);
    const logEntry = {
      id: logId,
      market_id: starlineId,
      market_name: `STARLINE ${market.name}`,
      session: 'DRAW',
      panna: panna,
      ank: ank,
      declared_by: declaredBy,
      time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      winners_count: winnersCount,
      total_payout: totalPayout
    };
    db.insert('resultLogs', logEntry);

    return {
      success: true,
      market,
      panna,
      ank,
      fullResult,
      winnersCount,
      totalPayout,
      winnersList,
      logEntry
    };
  }

  declareKingResult(kingId, rawJodi, declaredBy = 'Super Admin') {
    const market = db.findById('kingMarkets', kingId);
    if (!market) return { success: false, error: 'King market not found' };

    let jodi = rawJodi.toString().trim();
    if (jodi.length === 1) jodi = '0' + jodi;
    if (!/^[0-9]{2}$/.test(jodi)) {
      return { success: false, error: 'Invalid 2-digit Jodi (must be 00-99)' };
    }

    const andarDigit = jodi[0];
    const baharDigit = jodi[1];

    market.result = jodi;
    market.status = 'CLOSED';
    db.update('kingMarkets', kingId, market);

    // Fetch pending bids for this king market
    const pendingBids = db.query('bids', b => b.market_id === kingId && b.status === 'PENDING');
    let winnersCount = 0;
    let totalPayout = 0;
    const winnersList = [];

    pendingBids.forEach(bid => {
      let won = false;
      const bNum = bid.number.toString().padStart(2, '0');
      if (bid.game_type === 'Jodi' && bNum === jodi) won = true;
      if (bid.game_type === 'Andar Haruf' && bid.number.toString() === andarDigit) won = true;
      if (bid.game_type === 'Bahar Haruf' && bid.number.toString() === baharDigit) won = true;

      if (won) {
        const payout = bid.potential_win || Math.round(bid.points * (bid.payout_rate || 95));
        bid.status = 'WON';
        db.update('bids', bid.id, { status: 'WON' });

        walletService.creditPointsForWin(
          bid.user_id,
          payout,
          `Won King Market ${bid.game_type} on ${market.name}: ${bid.number}`,
          bid.id
        );

        winnersCount++;
        totalPayout += payout;
        winnersList.push({
          bidId: bid.id,
          userId: bid.user_id,
          userName: bid.user_name,
          gameType: bid.game_type,
          number: bid.number,
          points: bid.points,
          winPoints: payout
        });
      } else {
        bid.status = 'LOST';
        db.update('bids', bid.id, { status: 'LOST' });
      }
    });

    // Record Result Audit Log
    const logId = 'LOG-KG-' + Math.floor(100 + Math.random() * 900);
    const logEntry = {
      id: logId,
      market_id: kingId,
      market_name: `KING ${market.name}`,
      session: 'DRAW',
      panna: jodi,
      ank: `${andarDigit}/${baharDigit}`,
      declared_by: declaredBy,
      time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      winners_count: winnersCount,
      total_payout: totalPayout
    };
    db.insert('resultLogs', logEntry);

    return {
      success: true,
      market,
      jodi,
      andarDigit,
      baharDigit,
      winnersCount,
      totalPayout,
      winnersList,
      logEntry
    };
  }
}

module.exports = new SettlementService();
