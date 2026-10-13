/**
 * Market Scheduler & Real-Time IST Auto-Lock Service
 * Manages India Standard Time (IST) clock, bidding cutoff windows,
 * automated market status transitions, and real-time WebSocket tick broadcasts.
 */

'use strict';

const db = require('../db/store');

class MarketScheduler {
  constructor() {
    this.intervalHandle = null;
    this.defaultCutoffMinutes = 15;
    this.starlineCutoffMinutes = 5;
    this.socketService = null;
  }

  init(socketService, intervalMs = 30000) {
    this.socketService = socketService;
    // Initial sync
    this.syncAllMarketStatuses(false);

    // Periodic sweep
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    this.intervalHandle = setInterval(() => {
      this.syncAllMarketStatuses(true);
    }, intervalMs);

    console.log(`⏱️ Market Scheduler initialized (IST 30s interval sweeps, 15m auto-lock)`);
  }

  /**
   * Get reliable current Date adjusted to India Standard Time (UTC+5:30)
   */
  getISTDate(customDate = null) {
    const d = customDate ? new Date(customDate) : new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (5.5 * 3600000));
  }

  /**
   * Parse "HH:mm" 24-hr string to minutes from midnight
   */
  timeStringToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return (h * 60) + m;
  }

  /**
   * Format total minutes from midnight back to "HH:mm"
   */
  minutesToTimeString(totalMinutes) {
    let normalized = (totalMinutes % 1440 + 1440) % 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Get active cutoff minutes from global settings
   */
  getCutoffMinutes() {
    const settings = db.get('settings');
    return (settings && settings.bidding_cutoff_minutes) ? parseInt(settings.bidding_cutoff_minutes, 10) : this.defaultCutoffMinutes;
  }

  /**
   * Check whether a specific session for a market is currently open for player betting
   */
  isSessionOpenForBetting(market, session = 'OPEN', simulatedDate = null) {
    const istNow = this.getISTDate(simulatedDate);
    const currentMins = istNow.getHours() * 60 + istNow.getMinutes();
    const currentSecs = currentMins * 60 + istNow.getSeconds();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayName = dayNames[istNow.getDay()];

    if (!market) {
      return { allowed: false, reason: 'Market not found' };
    }

    if (market.active === false) {
      return { allowed: false, reason: `Market ${market.name} is currently inactive` };
    }

    // Holiday / day-of-week check for regular markets
    if (Array.isArray(market.days) && !market.days.includes(todayName)) {
      return { allowed: false, reason: `${market.name} is closed today (${todayName} Holiday)` };
    }

    // 1. STARLINE MARKET VALIDATION
    if (market.id && market.id.startsWith('st_')) {
      if (market.status === 'CLOSED') {
        return { allowed: false, reason: `Starline draw ${market.name} is closed for today` };
      }
      const drawMins = this.timeStringToMinutes(market.open_time);
      const cutoffMins = drawMins - this.starlineCutoffMinutes;
      const cutoffTimeStr = this.minutesToTimeString(cutoffMins);

      if (currentMins >= drawMins) {
        return { allowed: false, reason: `Starline draw ${market.name} has concluded (${market.open_time})` };
      }
      if (currentMins >= cutoffMins) {
        return { allowed: false, reason: `Starline bidding locked at ${cutoffTimeStr} (5 mins before draw)` };
      }
      return { allowed: true, cutoffTime: cutoffTimeStr };
    }

    // 2. KING MARKET VALIDATION
    if (['disawar', 'faridabad', 'ghaziabad', 'gali'].includes(market.id)) {
      if (market.status === 'CLOSED') {
        return { allowed: false, reason: `King market ${market.name} is closed for today` };
      }
      const drawMins = this.timeStringToMinutes(market.open_time);
      const cutoffMins = drawMins - this.getCutoffMinutes();
      const cutoffTimeStr = this.minutesToTimeString(cutoffMins);

      // Handle overnight draw times (e.g. Disawar at 05:00 AM)
      let adjustedDraw = drawMins;
      let adjustedCurrent = currentMins;
      if (drawMins < 360 && currentMins > 720) {
        adjustedDraw += 1440; // Next morning
      }

      if (adjustedCurrent >= adjustedDraw) {
        return { allowed: false, reason: `King market draw time has passed (${market.open_time})` };
      }
      if (adjustedCurrent >= (adjustedDraw - this.getCutoffMinutes())) {
        return { allowed: false, reason: `King market bidding locked at ${cutoffTimeStr} (${this.getCutoffMinutes()}m before draw)` };
      }
      return { allowed: true, cutoffTime: cutoffTimeStr };
    }

    // 3. REGULAR BAZAAR VALIDATION
    const openDrawMins = this.timeStringToMinutes(market.open_time);
    let closeDrawMins = this.timeStringToMinutes(market.close_time);
    const cutoffMinutes = this.getCutoffMinutes();

    // Handle midnight rollover (e.g., Main Bazar closes 00:05 next day)
    if (closeDrawMins < openDrawMins) {
      closeDrawMins += 1440;
    }

    let normalizedCurrent = currentMins;
    if (closeDrawMins > 1440 && currentMins < openDrawMins && currentMins < 360) {
      normalizedCurrent += 1440;
    }

    const openCutoffMins = openDrawMins - cutoffMinutes;
    const closeCutoffMins = closeDrawMins - cutoffMinutes;
    const openCutoffTimeStr = this.minutesToTimeString(openCutoffMins);
    const closeCutoffTimeStr = this.minutesToTimeString(closeCutoffMins);

    // OPEN SESSION CHECK
    if (session === 'OPEN') {
      if (market.open_panna && market.open_panna !== '***') {
        return { allowed: false, reason: `Open result is already declared for ${market.name}` };
      }
      if (normalizedCurrent >= openCutoffMins) {
        return {
          allowed: false,
          reason: `Bidding closed for ${market.name} Open Session (locked at ${openCutoffTimeStr}, ${cutoffMinutes}m before draw)`
        };
      }
      return { allowed: true, cutoffTime: openCutoffTimeStr };
    }

    // CLOSE SESSION CHECK
    if (session === 'CLOSE') {
      if (market.close_panna && market.close_panna !== '***') {
        return { allowed: false, reason: `Close result is already declared for ${market.name}` };
      }
      if (normalizedCurrent >= closeCutoffMins) {
        return {
          allowed: false,
          reason: `Bidding closed for ${market.name} Close Session (locked at ${closeCutoffTimeStr}, ${cutoffMinutes}m before draw)`
        };
      }
      return { allowed: true, cutoffTime: closeCutoffTimeStr };
    }

    // FULL SESSION CHECK (Jodi, Family Jodi, Cross Jodi, Sangam)
    if (session === 'FULL') {
      // Once Open Session locks or Open result declares, Jodi and Sangam are strictly locked
      if (market.open_panna && market.open_panna !== '***') {
        return { allowed: false, reason: `Jodi & Sangam betting closed after Open result was declared` };
      }
      if (normalizedCurrent >= openCutoffMins) {
        return {
          allowed: false,
          reason: `Jodi & Sangam betting for ${market.name} locked at ${openCutoffTimeStr} when Open Session closed`
        };
      }
      return { allowed: true, cutoffTime: openCutoffTimeStr };
    }

    return { allowed: true };
  }

  /**
   * Synchronize all markets against current IST time and transition statuses
   */
  syncAllMarketStatuses(broadcast = true, customDate = null) {
    const istNow = this.getISTDate(customDate);
    const currentMins = istNow.getHours() * 60 + istNow.getMinutes();
    const cutoffMinutes = this.getCutoffMinutes();
    let updatedCount = 0;
    const changes = [];

    // 1. Regular Markets
    const regularMarkets = db.get('markets');
    regularMarkets.forEach(m => {
      if (!m.active) return;
      const oldStatus = m.status;
      let newStatus = oldStatus;

      // If fully settled, keep CLOSED
      if (m.open_panna && m.close_panna && m.open_panna !== '***' && m.close_panna !== '***') {
        newStatus = 'CLOSED';
      } else {
        const openDraw = this.timeStringToMinutes(m.open_time);
        let closeDraw = this.timeStringToMinutes(m.close_time);
        if (closeDraw < openDraw) closeDraw += 1440;

        let cur = currentMins;
        if (closeDraw > 1440 && currentMins < openDraw && currentMins < 360) cur += 1440;

        const openCutoff = openDraw - cutoffMinutes;
        const closeCutoff = closeDraw - cutoffMinutes;

        if (cur < openCutoff) {
          newStatus = 'UPCOMING';
        } else if (cur >= openCutoff && cur < closeDraw) {
          newStatus = 'RUNNING';
        } else if (cur >= closeDraw) {
          newStatus = 'CLOSED';
        }
      }

      if (newStatus !== oldStatus) {
        db.update('markets', m.id, { status: newStatus });
        updatedCount++;
        changes.push({ id: m.id, name: m.name, oldStatus, newStatus, type: 'REGULAR' });
      }
    });

    // 2. Starline Markets
    const starlineMarkets = db.get('starlineMarkets');
    starlineMarkets.forEach(s => {
      const oldStatus = s.status;
      let newStatus = oldStatus;

      if (s.result && s.result !== '***-*') {
        newStatus = 'CLOSED';
      } else {
        const drawMins = this.timeStringToMinutes(s.open_time);
        const cutoffMins = drawMins - this.starlineCutoffMinutes;

        if (currentMins < cutoffMins - 60) {
          newStatus = 'UPCOMING';
        } else if (currentMins >= cutoffMins - 60 && currentMins < cutoffMins) {
          newStatus = 'RUNNING';
        } else if (currentMins >= drawMins) {
          newStatus = 'CLOSED';
        }
      }

      if (newStatus !== oldStatus) {
        db.update('starlineMarkets', s.id, { status: newStatus });
        updatedCount++;
        changes.push({ id: s.id, name: s.name, oldStatus, newStatus, type: 'STARLINE' });
      }
    });

    // 3. King Markets
    const kingMarkets = db.get('kingMarkets');
    kingMarkets.forEach(k => {
      const oldStatus = k.status;
      let newStatus = oldStatus;

      if (k.result && k.result !== '**') {
        newStatus = 'CLOSED';
      } else {
        const drawMins = this.timeStringToMinutes(k.open_time);
        const cutoffMins = drawMins - cutoffMinutes;

        let adjustedDraw = drawMins;
        let adjustedCurrent = currentMins;
        if (drawMins < 360 && currentMins > 720) adjustedDraw += 1440;

        if (adjustedCurrent < (adjustedDraw - cutoffMinutes - 300)) {
          newStatus = 'UPCOMING';
        } else if (adjustedCurrent >= (adjustedDraw - cutoffMinutes - 300) && adjustedCurrent < (adjustedDraw - cutoffMinutes)) {
          newStatus = 'RUNNING';
        } else if (adjustedCurrent >= adjustedDraw) {
          newStatus = 'CLOSED';
        }
      }

      if (newStatus !== oldStatus) {
        db.update('kingMarkets', k.id, { status: newStatus });
        updatedCount++;
        changes.push({ id: k.id, name: k.name, oldStatus, newStatus, type: 'KING' });
      }
    });

    // Broadcast WebSocket updates if changes occurred or periodic tick
    if (broadcast && this.socketService) {
      if (updatedCount > 0) {
        this.socketService.broadcastAll('MARKET_STATUS_UPDATED', {
          changes,
          istTime: istNow.toISOString(),
          timestamp: new Date().toISOString()
        });
      }
    }

    return { updatedCount, changes, istTime: istNow.toISOString() };
  }
}

module.exports = new MarketScheduler();
