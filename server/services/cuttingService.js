/**
 * Cutting Sheet & Bookie Risk Analysis Service
 * Calculates real-time liability, digit load, and exposure heatmaps
 */

'use strict';

const db = require('../db/store');

class CuttingService {
  getMarketExposure(marketId, session = 'OPEN') {
    const market = db.findById('markets', marketId);
    if (!market) return null;

    // Filter active bids for this market
    const bids = db.query('bids', b => b.market_id === marketId && b.status === 'PENDING');

    let totalCollected = 0;
    const digitMap = {};
    for (let i = 0; i <= 9; i++) {
      digitMap[i.toString()] = { amount: 0, count: 0 };
    }

    const jodiMap = {};

    bids.forEach(b => {
      totalCollected += b.points;

      // Single Digit tally
      if (b.game_type === 'Single Digit' && (b.session === session || session === 'ALL')) {
        const d = b.number.toString();
        if (digitMap[d]) {
          digitMap[d].amount += b.points;
          digitMap[d].count += 1;
        }
      }

      // Jodi tally
      if (b.game_type === 'Jodi') {
        const j = b.number.toString().padStart(2, '0');
        jodiMap[j] = (jodiMap[j] || 0) + b.points;
      }
    });

    // Single Digit Load (0-9)
    const singleLoad = [];
    let safestDigit = '0';
    let maxProfit = -Infinity;
    let highestRiskDigit = '0';
    let maxLiability = -1;

    for (let i = 0; i <= 9; i++) {
      const d = i.toString();
      const amount = digitMap[d].amount;
      const count = digitMap[d].count;
      const liability = Math.round(amount * 9.5);
      const netHouseProfit = totalCollected - liability;

      if (netHouseProfit > maxProfit) {
        maxProfit = netHouseProfit;
        safestDigit = d;
      }
      if (liability > maxLiability) {
        maxLiability = liability;
        highestRiskDigit = d;
      }

      singleLoad.push({
        digit: d,
        amount: amount,
        bidsCount: count,
        liability: liability,
        netHouseProfit: netHouseProfit
      });
    }

    // Top 10 Jodis
    const topJodis = Object.keys(jodiMap)
      .map(j => ({
        jodi: j,
        amount: jodiMap[j],
        liability: Math.round(jodiMap[j] * 95)
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return {
      marketId: market.id,
      marketName: market.name,
      session: session,
      totalCollected: totalCollected,
      singleLoad: singleLoad,
      topJodis: topJodis,
      safestDigit: safestDigit,
      highestRiskDigit: highestRiskDigit
    };
  }

  calculateLayoff(marketId, session = 'OPEN', ankRetention = 5000, jodiRetention = 2000) {
    const exposure = this.getMarketExposure(marketId, session);
    if (!exposure) return null;

    const ankLimit = parseInt(ankRetention, 10) || 5000;
    const jodiLimit = parseInt(jodiRetention, 10) || 2000;

    const ankLayoffs = [];
    let totalAnkLayoffStake = 0;
    let totalAnkLayoffLiability = 0;

    exposure.singleLoad.forEach(item => {
      if (item.amount > ankLimit) {
        const layoffStake = item.amount - ankLimit;
        const layoffLiability = Math.round(layoffStake * 9.5);
        totalAnkLayoffStake += layoffStake;
        totalAnkLayoffLiability += layoffLiability;
        ankLayoffs.push({
          digit: item.digit,
          grossAmount: item.amount,
          retentionLimit: ankLimit,
          layoffStake: layoffStake,
          layoffLiability: layoffLiability
        });
      }
    });

    // Jodi Layoffs (from all active pending jodis)
    const bids = db.query('bids', b => b.market_id === marketId && b.status === 'PENDING' && b.game_type === 'Jodi');
    const jodiMap = {};
    bids.forEach(b => {
      const j = b.number.toString().padStart(2, '0');
      jodiMap[j] = (jodiMap[j] || 0) + b.points;
    });

    const jodiLayoffs = [];
    let totalJodiLayoffStake = 0;
    let totalJodiLayoffLiability = 0;

    Object.keys(jodiMap).sort().forEach(j => {
      const gross = jodiMap[j];
      if (gross > jodiLimit) {
        const layoffStake = gross - jodiLimit;
        const layoffLiability = Math.round(layoffStake * 95);
        totalJodiLayoffStake += layoffStake;
        totalJodiLayoffLiability += layoffLiability;
        jodiLayoffs.push({
          jodi: j,
          grossAmount: gross,
          retentionLimit: jodiLimit,
          layoffStake: layoffStake,
          layoffLiability: layoffLiability
        });
      }
    });

    const totalLayoffStake = totalAnkLayoffStake + totalJodiLayoffStake;
    const totalProtectedLiability = totalAnkLayoffLiability + totalJodiLayoffLiability;

    // Generate Formatted WhatsApp Text
    const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let waText = `👑 *KALYAN 777 - SYNDICATE LAY-OFF (कटिंग पर्ची)*\n`;
    waText += `📅 Date: ${todayStr} | 🎲 Bazaar: ${exposure.marketName} (${session})\n`;
    waText += `💰 Total Bazaar Collection: ₹${exposure.totalCollected.toLocaleString('en-IN')}\n`;
    waText += `⚡ Retention Ceiling: ₹${ankLimit.toLocaleString('en-IN')}/Ank | ₹${jodiLimit.toLocaleString('en-IN')}/Jodi\n`;
    waText += `--------------------------------------------------\n`;

    if (ankLayoffs.length > 0) {
      waText += `🚨 *EXCESS ANK TO LAY OFF (काटने का अंक):*\n`;
      ankLayoffs.forEach(a => {
        waText += `• Ank ${a.digit}: *₹${a.layoffStake.toLocaleString('en-IN')}* (Gross ₹${a.grossAmount.toLocaleString('en-IN')} - Held ₹${ankLimit.toLocaleString('en-IN')})\n`;
      });
    } else {
      waText += `🟢 All Single Anks within ₹${ankLimit.toLocaleString('en-IN')} limit.\n`;
    }

    waText += `--------------------------------------------------\n`;
    if (jodiLayoffs.length > 0) {
      waText += `🚨 *EXCESS JODI TO LAY OFF (काटने की जोड़ी):*\n`;
      jodiLayoffs.forEach(j => {
        waText += `• Jodi ${j.jodi}: *₹${j.layoffStake.toLocaleString('en-IN')}* (Gross ₹${j.grossAmount.toLocaleString('en-IN')} - Held ₹${jodiLimit.toLocaleString('en-IN')})\n`;
      });
    } else {
      waText += `🟢 All Jodis within ₹${jodiLimit.toLocaleString('en-IN')} limit.\n`;
    }

    waText += `--------------------------------------------------\n`;
    waText += `💼 *TOTAL LAY-OFF STAKE REQUIRED: ₹${totalLayoffStake.toLocaleString('en-IN')}*\n`;
    waText += `🛡️ *NET LIABILITY OFFLOADED: ₹${totalProtectedLiability.toLocaleString('en-IN')}*\n`;
    waText += `--------------------------------------------------\n`;
    waText += `_Kalyan 777 Executive Risk & Syndicate Management_`;

    // Generate CSV string
    let csv = `Category,Number,Gross_Stake,Retention_Limit,Layoff_Stake,Layoff_Liability\n`;
    ankLayoffs.forEach(a => {
      csv += `Single Ank,${a.digit},${a.grossAmount},${a.retentionLimit},${a.layoffStake},${a.layoffLiability}\n`;
    });
    jodiLayoffs.forEach(j => {
      csv += `Jodi,${j.jodi},${j.grossAmount},${j.retentionLimit},${j.layoffStake},${j.layoffLiability}\n`;
    });

    return {
      exposure,
      ankLimit,
      jodiLimit,
      ankLayoffs,
      jodiLayoffs,
      totalAnkLayoffStake,
      totalJodiLayoffStake,
      totalLayoffStake,
      totalProtectedLiability,
      whatsappText: waText,
      csvContent: csv
    };
  }
}

module.exports = new CuttingService();
