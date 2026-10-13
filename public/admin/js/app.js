/**
 * Matka Pro Admin Panel - Backend-Connected Controller
 * Directly integrated with Express REST API and persistent database
 */

(function () {
  'use strict';

  const API_BASE = '/api';
  const pattiEngine = window.PattiEngine;

  // Active Tab State
  let currentTab = 'dashboard';
  let activeCuttingMarket = 'kalyan';
  let activeCuttingSession = 'OPEN';
  let activeLayoffAnkLimit = 5000;
  let activeLayoffJodiLimit = 2000;
  let currentLayoffData = null;
  let activeWalletTab = 'deposits';

  // Cached API Data
  let statsData = null;
  let marketsData = [];
  let bidsData = [];
  let usersData = [];
  let depositsData = [];
  let withdrawalsData = [];
  let ratesData = [];
  let settingsData = null;
  let agentsData = [];

  // DOM Elements cache
  const elements = {
    serverClock: document.getElementById('server-clock'),
    sidebar: document.getElementById('app-sidebar'),
    sidebarBackdrop: document.getElementById('sidebar-backdrop'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
    pageTitle: document.getElementById('page-title'),
    pageSubtitle: document.getElementById('page-subtitle'),
    toastContainer: document.getElementById('toast-container'),

    // Modals
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalCloseBtn: document.getElementById('modal-close-btn')
  };

  // --------------------------------------------------------------------------
  // UTILITY HELPERS
  // --------------------------------------------------------------------------
  function formatCurrency(amount) {
    if (isNaN(amount)) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    let icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-content">${message}</div>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function openModal(title, htmlContent) {
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = htmlContent;
    elements.modalOverlay.classList.add('active');
  }

  function closeModal() {
    elements.modalOverlay.classList.remove('active');
  }

  function initClock() {
    function update() {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour12: false });
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      if (elements.serverClock) {
        elements.serverClock.textContent = `${dateStr} | ${timeStr} IST`;
      }
    }
    update();
    setInterval(update, 1000);
  }

  // --------------------------------------------------------------------------
  let adminToken = localStorage.getItem('kalyan777_admin_token') || '';

  async function ensureAdminAuth() {
    if (adminToken) return adminToken;
    try {
      const res = await fetch(`${API_BASE}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      });
      const data = await res.json();
      if (data.success && data.token) {
        adminToken = data.token;
        localStorage.setItem('kalyan777_admin_token', adminToken);
        return adminToken;
      }
    } catch (e) {
      console.warn('Auto admin login failed:', e);
    }
    return '';
  }

  let currentAdminProfile = null;

  async function fetchAdminProfile() {
    try {
      const res = await apiGet('/auth/admin-me');
      if (res && res.success && res.admin) {
        currentAdminProfile = res.admin;
        const nameEl = document.getElementById('operator-name');
        const roleBadge = document.getElementById('operator-role-badge');
        const quotaText = document.getElementById('admin-quota-text');
        const btnAlloc = document.getElementById('btn-allocate-quota');

        if (nameEl) nameEl.textContent = res.admin.name || res.admin.username;
        if (roleBadge) {
          if (res.admin.role === 'SUPER_ADMIN') {
            roleBadge.textContent = '👑 SUPER ADMIN';
            roleBadge.style.background = 'rgba(245, 158, 11, 0.2)';
            roleBadge.style.color = '#f59e0b';
            roleBadge.style.border = '1px solid rgba(245, 158, 11, 0.4)';
          } else {
            roleBadge.textContent = '🛡️ SUB ADMIN';
            roleBadge.style.background = 'rgba(59, 130, 246, 0.2)';
            roleBadge.style.color = '#60a5fa';
            roleBadge.style.border = '1px solid rgba(59, 130, 246, 0.4)';
          }
        }
        if (quotaText) {
          if (res.admin.is_unlimited) {
            quotaText.innerHTML = '🪙 Mint Quota: <b style="color: #10b981;">♾️ UNLIMITED</b>';
          } else {
            quotaText.innerHTML = `🪙 Mint Quota: <b style="color: #f59e0b;">${formatCurrency(res.admin.floating_balance)}</b>`;
          }
        }
        if (btnAlloc) {
          btnAlloc.style.display = res.admin.role === 'SUPER_ADMIN' ? 'inline-flex' : 'none';
        }
      }
    } catch (e) {
      console.warn('Error fetching admin profile:', e);
    }
  }

  function getAdminHeaders(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    return headers;
  }

  async function apiGet(endpoint) {
    try {
      if (!adminToken) await ensureAdminAuth();
      let res = await fetch(`${API_BASE}${endpoint}`, { headers: getAdminHeaders() });
      if (res.status === 401) {
        adminToken = '';
        await ensureAdminAuth();
        res = await fetch(`${API_BASE}${endpoint}`, { headers: getAdminHeaders() });
      }
      return await res.json();
    } catch (e) {
      console.error(`API GET ${endpoint} error:`, e);
      return { success: false, error: 'Network error' };
    }
  }

  async function apiPost(endpoint, data) {
    try {
      if (!adminToken) await ensureAdminAuth();
      let res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      });
      if (res.status === 401) {
        adminToken = '';
        await ensureAdminAuth();
        res = await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify(data)
        });
      }
      return await res.json();
    } catch (e) {
      console.error(`API POST ${endpoint} error:`, e);
      return { success: false, error: 'Network error' };
    }
  }

  async function apiPut(endpoint, data) {
    try {
      if (!adminToken) await ensureAdminAuth();
      let res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      });
      if (res.status === 401) {
        adminToken = '';
        await ensureAdminAuth();
        res = await fetch(`${API_BASE}${endpoint}`, {
          method: 'PUT',
          headers: getAdminHeaders(),
          body: JSON.stringify(data)
        });
      }
      return await res.json();
    } catch (e) {
      console.error(`API PUT ${endpoint} error:`, e);
      return { success: false, error: 'Network error' };
    }
  }

  // --------------------------------------------------------------------------
  // TAB NAVIGATION
  // --------------------------------------------------------------------------
  function switchTab(tabId) {
    currentTab = tabId;

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.bottom-nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
    });

    if (elements.sidebar.classList.contains('open')) {
      elements.sidebar.classList.remove('open');
      elements.sidebarBackdrop.classList.remove('active');
    }

    const tabs = ['dashboard', 'markets', 'declare', 'cutting', 'bids', 'agents', 'users', 'wallet', 'rates', 'settings', 'logs'];
    tabs.forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.style.display = (t === tabId) ? 'block' : 'none';
    });

    const titles = {
      dashboard: { title: 'Admin Mission Control', sub: 'Real-time overview of markets, bids and live operations' },
      markets: { title: 'Market & Bazaar Management', sub: 'Control regular, starline and king market timings and states' },
      declare: { title: 'Declare Results & Settlement', sub: 'Declare Open/Close results with smart Patti calculation and auto-settlement' },
      cutting: { title: 'Live Cutting Sheet & Risk Analysis', sub: 'Monitor real-time liabilities, digit load and high-risk bookie exposure' },
      bids: { title: 'Bid & Bet History', sub: 'Comprehensive audit trail of all placed, won and lost user bets' },
      agents: { title: 'Agents & Khaiwals Hierarchy Network', sub: 'Master agents, sub-bookie credit limits, downstream player tracking & commission sheets' },
      users: { title: 'User & Player Management', sub: 'View player balances, adjust wallet points and manage account access' },
      wallet: { title: 'Wallet & Fund Requests', sub: 'Review pending UPI deposits and process player withdrawals' },
      rates: { title: 'Game Rates & Bhav Settings', sub: 'Configure payout multipliers and betting limits for all games' },
      settings: { title: 'Notice Board & System Settings', sub: 'Manage app marquee notice, support contacts and global toggles' },
      logs: { title: 'Result Audit & Activity Logs', sub: 'Historical records of all declared bazaar results and payouts' }
    };

    if (titles[tabId]) {
      elements.pageTitle.textContent = titles[tabId].title;
      elements.pageSubtitle.textContent = titles[tabId].sub;
    }

    renderTabContent(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderTabContent(tabId) {
    switch (tabId) {
      case 'dashboard': renderDashboard(); break;
      case 'markets': renderMarkets(); break;
      case 'declare': renderDeclareResult(); break;
      case 'cutting': renderCuttingSheet(); break;
      case 'bids': renderBids(); break;
      case 'agents': renderAgents(); break;
      case 'users': renderUsers(); break;
      case 'wallet': renderWallet(); break;
      case 'rates': renderRates(); break;
      case 'settings': renderSettings(); break;
      case 'logs': renderLogs(); break;
    }
  }

  // --------------------------------------------------------------------------
  // TAB 1: DASHBOARD
  // --------------------------------------------------------------------------
  async function renderDashboard() {
    const statsRes = await apiGet('/stats');
    if (statsRes.success) statsData = statsRes.stats;

    const marketsRes = await apiGet('/markets');
    if (marketsRes.success) marketsData = marketsRes.markets;

    const bidsRes = await apiGet('/bids/all');
    if (bidsRes.success) bidsData = bidsRes.bids;

    const stats = statsData || {
      todayBidsTotal: 0,
      todayWinningsTotal: 0,
      todayNetProfit: 0,
      activeUsersCount: 0,
      totalUsersCount: 0,
      pendingDepositsCount: 0,
      pendingDepositsAmount: 0,
      pendingWithdrawalsCount: 0,
      pendingWithdrawalsAmount: 0
    };

    const statsContainer = document.getElementById('dash-stats-grid');
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-title">Today's Bet Turnover</span>
            <div class="stat-card-icon gold">💰</div>
          </div>
          <div class="stat-card-value">${formatCurrency(stats.todayBidsTotal)}</div>
          <div class="stat-card-footer">
            <span class="text-emerald">Live Active Turnover</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-title">Winnings Paid Out</span>
            <div class="stat-card-icon rose">🏆</div>
          </div>
          <div class="stat-card-value text-rose">${formatCurrency(stats.todayWinningsTotal)}</div>
          <div class="stat-card-footer">
            <span class="text-muted">Auto-credited to player wallets</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-title">Net House Profit (GGR)</span>
            <div class="stat-card-icon emerald">📈</div>
          </div>
          <div class="stat-card-value text-emerald">${formatCurrency(stats.todayNetProfit)}</div>
          <div class="stat-card-footer">
            <span class="text-emerald font-bold">House Surplus</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-title">Active Players</span>
            <div class="stat-card-icon cyan">👥</div>
          </div>
          <div class="stat-card-value">${stats.activeUsersCount} <small style="font-size: 0.9rem; color: var(--text-dim);">/ ${stats.totalUsersCount}</small></div>
          <div class="stat-card-footer">
            <span class="live-indicator" style="display:inline-block; vertical-align:middle; margin-right:4px;"></span> Currently Registered
          </div>
        </div>
      `;
    }

    const alertsContainer = document.getElementById('dash-alerts-strip');
    if (alertsContainer) {
      alertsContainer.innerHTML = `
        <div class="flex-between" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-md); padding: 0.85rem 1.25rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.25rem;">⚠️</span>
            <div>
              <b style="color: var(--brand-amber);">Action Required:</b>
              <span style="color: var(--text-secondary); font-size: 0.85rem;">
                ${stats.pendingDepositsCount} Deposits (${formatCurrency(stats.pendingDepositsAmount)}) and 
                ${stats.pendingWithdrawalsCount} Withdrawals (${formatCurrency(stats.pendingWithdrawalsAmount)}) waiting for approval.
              </span>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="window.App.switchTab('wallet')">Manage Funds →</button>
        </div>
      `;
    }

    const activeMarketsContainer = document.getElementById('dash-active-markets');
    if (activeMarketsContainer) {
      const runningMarkets = marketsData.filter(m => m.status === 'RUNNING' || m.status === 'OPEN').slice(0, 4);
      activeMarketsContainer.innerHTML = runningMarkets.map(m => `
        <div class="market-card running">
          <div class="market-card-top">
            <div class="market-name-group">
              <h4>${m.name}</h4>
              <span>${m.hindi_name || ''}</span>
            </div>
            <span class="badge badge-running">LIVE BETTING</span>
          </div>
          <div class="market-scoreboard">
            <div class="scoreboard-label">Current Result</div>
            <div class="scoreboard-result">
              <span class="panna">${m.open_panna || '***'}</span>
              <span class="jodi">${m.open_ank || '*'}${m.close_ank || '*'}</span>
              <span class="panna">${m.close_panna || '***'}</span>
            </div>
          </div>
          <div class="market-timings">
            <span>Open: <b>${m.open_time}</b></span>
            <span>Close: <b>${m.close_time}</b></span>
          </div>
          <div class="market-actions">
            <button class="btn btn-sm btn-primary" onclick="window.App.quickDeclare('${m.id}')">⚡ Declare</button>
            <button class="btn btn-sm btn-outline" onclick="window.App.viewCutting('${m.id}')">📊 Cutting Sheet</button>
          </div>
        </div>
      `).join('');
    }

    const bidsTableBody = document.getElementById('dash-recent-bids-tbody');
    if (bidsTableBody) {
      bidsTableBody.innerHTML = bidsData.slice(0, 7).map(b => `
        <tr>
          <td><b class="text-mono">${b.id}</b></td>
          <td>${b.user_name}</td>
          <td><span class="badge badge-neutral">${b.market_name}</span></td>
          <td><span style="font-weight: 600; color: var(--accent-cyan);">${b.game_type}</span></td>
          <td><b class="text-mono text-gold">${b.number}</b></td>
          <td><b class="text-mono">${formatCurrency(b.points)}</b></td>
          <td>
            <span class="badge ${b.status === 'WON' ? 'badge-won' : b.status === 'LOST' ? 'badge-lost' : 'badge-neutral'}">
              ${b.status}
            </span>
          </td>
          <td style="font-size: 0.78rem; color: var(--text-dim);">${(b.created_at || '').split(' ')[1] || b.created_at}</td>
        </tr>
      `).join('');
    }
  }

  // --------------------------------------------------------------------------
  // TAB 2: MARKETS
  // --------------------------------------------------------------------------
  async function renderMarkets() {
    const marketsRes = await apiGet('/markets');
    if (marketsRes.success) marketsData = marketsRes.markets;

    const container = document.getElementById('markets-list-grid');
    if (container) {
      container.innerHTML = marketsData.map(m => {
        const isRunning = m.status === 'RUNNING';
        const isClosed = m.status === 'CLOSED';
        return `
          <div class="market-card ${isRunning ? 'running' : isClosed ? 'closed' : 'upcoming'}">
            <div class="market-card-top">
              <div class="market-name-group">
                <h4>${m.name}</h4>
                <span>${m.hindi_name || ''}</span>
              </div>
              <span class="badge ${isRunning ? 'badge-running' : isClosed ? 'badge-closed' : 'badge-upcoming'}">
                ${m.status}
              </span>
            </div>

            <div class="market-scoreboard">
              <div class="scoreboard-label">Today's Result</div>
              <div class="scoreboard-result">
                <span class="panna">${m.open_panna || '***'}</span>
                <span class="jodi">${m.open_ank || '*'}${m.close_ank || '*'}</span>
                <span class="panna">${m.close_panna || '***'}</span>
              </div>
            </div>

            <div class="market-timings">
              <span>Open: <b>${m.open_time}</b></span>
              <span>Close: <b>${m.close_time}</b></span>
            </div>

            <div class="market-actions">
              <button class="btn btn-sm btn-primary" onclick="window.App.quickDeclare('${m.id}')">⚡ Result</button>
              <button class="btn btn-sm btn-outline" onclick="window.App.viewCutting('${m.id}')">📊 Load</button>
              <button class="btn btn-sm btn-ghost" onclick="window.App.editMarketTimings('${m.id}')">⚙️ Timings</button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Starline & King
    const stRes = await apiGet('/markets/type/starline');
    const starlineTable = document.getElementById('starline-table-body');
    if (stRes.success && starlineTable) {
      starlineTable.innerHTML = stRes.starline.map(s => `
        <tr>
          <td><b>${s.name}</b></td>
          <td><span class="text-mono">${s.open_time}</span></td>
          <td><b class="text-mono text-gold" style="font-size: 1.1rem;">${s.result}</b></td>
          <td><span class="badge ${s.status === 'RUNNING' ? 'badge-running' : 'badge-neutral'}">${s.status}</span></td>
          <td><button class="btn btn-sm btn-outline" onclick="window.App.declareStarlineResult('${s.id}')">Declare</button></td>
        </tr>
      `).join('');
    }

    const kgRes = await apiGet('/markets/type/king');
    const kingTable = document.getElementById('king-table-body');
    if (kgRes.success && kingTable) {
      kingTable.innerHTML = kgRes.king.map(k => `
        <tr>
          <td><b>${k.name}</b></td>
          <td><span class="text-mono">${k.open_time}</span></td>
          <td><b class="text-mono text-gold" style="font-size: 1.2rem;">${k.result}</b></td>
          <td><span class="badge ${k.status === 'CLOSED' ? 'badge-closed' : 'badge-upcoming'}">${k.status}</span></td>
          <td><button class="btn btn-sm btn-outline" onclick="window.App.declareKingResult('${k.id}')">Declare</button></td>
        </tr>
      `).join('');
    }
  }

  // --------------------------------------------------------------------------
  // TAB 3: DECLARE RESULTS
  // --------------------------------------------------------------------------
  async function renderDeclareResult(selectedMarketId = null) {
    const marketsRes = await apiGet('/markets');
    if (marketsRes.success) marketsData = marketsRes.markets;

    const marketSelect = document.getElementById('declare-market-select');
    if (marketSelect) {
      marketSelect.innerHTML = marketsData.map(m => `
        <option value="${m.id}" ${m.id === selectedMarketId ? 'selected' : ''}>
          ${m.name} (${m.hindi_name || ''}) - Open: ${m.open_time} | Close: ${m.close_time}
        </option>
      `).join('');
    }

    updateDeclarePreview();
    renderResultLogsTable();
  }

  function updateDeclarePreview() {
    const marketSelect = document.getElementById('declare-market-select');
    const sessionSelect = document.getElementById('declare-session-select');
    const pannaInput = document.getElementById('declare-panna-input');
    if (!marketSelect || !sessionSelect || !pannaInput) return;

    const marketId = marketSelect.value;
    const session = sessionSelect.value;
    const rawPanna = pannaInput.value.trim();
    const market = marketsData.find(m => m.id === marketId);

    const normPanna = pattiEngine.normalizePatti(rawPanna);
    const calculatedAnk = pattiEngine.calculateAnk(rawPanna);
    const pattiType = pattiEngine.getPattiType(normPanna);

    const previewOpenPanna = document.getElementById('preview-open-panna');
    const previewJodi = document.getElementById('preview-jodi');
    const previewClosePanna = document.getElementById('preview-close-panna');
    const ankCalculationBadge = document.getElementById('ank-calc-badge');

    if (calculatedAnk !== null) {
      const d1 = rawPanna[0], d2 = rawPanna[1], d3 = rawPanna[2];
      const sum = parseInt(d1) + parseInt(d2) + parseInt(d3);
      ankCalculationBadge.textContent = `${normPanna} (${pattiType}): ${d1}+${d2}+${d3}=${sum} → Single Ank [ ${calculatedAnk} ]`;
      ankCalculationBadge.style.display = 'inline-block';
    } else {
      ankCalculationBadge.style.display = 'none';
    }

    if (market) {
      if (session === 'OPEN') {
        previewOpenPanna.textContent = rawPanna.length === 3 ? normPanna : '***';
        const openA = calculatedAnk !== null ? calculatedAnk : (market.open_ank || '*');
        const closeA = market.close_ank || '*';
        previewJodi.textContent = `${openA}${closeA}`;
        previewClosePanna.textContent = market.close_panna || '***';
      } else {
        previewOpenPanna.textContent = market.open_panna || '***';
        const openA = market.open_ank || '*';
        const closeA = calculatedAnk !== null ? calculatedAnk : (market.close_ank || '*');
        previewJodi.textContent = `${openA}${closeA}`;
        previewClosePanna.textContent = rawPanna.length === 3 ? normPanna : '***';
      }
    }
  }

  async function handleDeclareSubmit() {
    const marketSelect = document.getElementById('declare-market-select');
    const sessionSelect = document.getElementById('declare-session-select');
    const pannaInput = document.getElementById('declare-panna-input');

    const marketId = marketSelect.value;
    const session = sessionSelect.value;
    const panna = pannaInput.value.trim();

    if (panna.length !== 3) {
      showToast('Please enter a valid 3-digit Patti (e.g. 128, 234)', 'error');
      return;
    }

    const market = marketsData.find(m => m.id === marketId);
    if (!confirm(`Are you sure you want to declare ${market ? market.name : marketId} ${session} with Patti ${panna}?\nMatching bets will be settled immediately!`)) {
      return;
    }

    const res = await apiPost('/results/declare', {
      marketId,
      session,
      panna,
      declaredBy: 'Super Admin'
    });

    if (res.success) {
      showToast(res.message, 'success');
      pannaInput.value = '';
      updateDeclarePreview();
      renderResultLogsTable();
      renderDashboard();
    } else {
      showToast(res.error || 'Failed to declare result', 'error');
    }
  }

  async function renderResultLogsTable() {
    const res = await apiGet('/results/logs');
    if (!res.success) return;

    const rowsHtml = res.logs.map(l => `
      <tr>
        <td><b class="text-mono">${l.id}</b></td>
        <td><span class="badge badge-gold">${l.market_name}</span></td>
        <td><span class="badge badge-neutral">${l.session}</span></td>
        <td><b class="text-mono text-gold" style="font-size:1.05rem;">${l.panna} - ${l.ank}</b></td>
        <td><b class="text-emerald">${l.winners_count} winners</b></td>
        <td><b class="text-mono text-rose">${formatCurrency(l.total_payout)}</b></td>
        <td>${l.declared_by}</td>
        <td style="font-size: 0.78rem; color: var(--text-dim);">${l.time}</td>
      </tr>
    `).join('');

    const tableBody = document.getElementById('result-logs-tbody');
    const logsTbody = document.getElementById('logs-tbody');
    if (tableBody) tableBody.innerHTML = rowsHtml;
    if (logsTbody) logsTbody.innerHTML = rowsHtml;
  }

  // --------------------------------------------------------------------------
  // TAB 4: CUTTING SHEET (RISK ANALYSIS)
  // --------------------------------------------------------------------------
  async function renderCuttingSheet() {
    const marketsRes = await apiGet('/markets');
    if (marketsRes.success) marketsData = marketsRes.markets;

    const select = document.getElementById('cutting-market-select');
    if (select) {
      select.innerHTML = marketsData.map(m => `
        <option value="${m.id}" ${m.id === activeCuttingMarket ? 'selected' : ''}>${m.name}</option>
      `).join('');
    }

    const expRes = await apiGet(`/cutting?marketId=${activeCuttingMarket}&session=${activeCuttingSession}`);
    if (!expRes.success) return;

    // Fetch Layoff Analysis
    const layoffRes = await apiGet(`/cutting/layoff?marketId=${activeCuttingMarket}&session=${activeCuttingSession}&ankLimit=${activeLayoffAnkLimit}&jodiLimit=${activeLayoffJodiLimit}`);
    if (layoffRes.success) {
      currentLayoffData = layoffRes.layoff;
      updateLayoffUI(currentLayoffData);
    }

    const cutting = expRes.exposure;
    const totalCollectedEl = document.getElementById('cutting-total-collected');
    if (totalCollectedEl) totalCollectedEl.textContent = formatCurrency(cutting.totalCollected);

    const gridContainer = document.getElementById('digit-load-container');
    if (gridContainer) {
      gridContainer.innerHTML = cutting.singleLoad.map(item => {
        const isDanger = item.netHouseProfit < 0;
        const isSafe = item.digit === cutting.safestDigit;
        const riskClass = isDanger ? 'risk-high' : isSafe ? 'risk-safe' : '';

        // Check if exceeds bookie retention limit
        const isExceedingLayoff = item.amount > activeLayoffAnkLimit;
        const layoffExcess = isExceedingLayoff ? (item.amount - activeLayoffAnkLimit) : 0;

        return `
          <div class="digit-load-card ${riskClass}">
            <div class="digit-load-card-top">
              <span class="digit-number-badge ${isDanger ? 'text-rose' : isSafe ? 'text-emerald' : 'text-gold'}">${item.digit}</span>
              <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.25rem;">
                <span class="badge ${isDanger ? 'badge-rose' : isSafe ? 'badge-emerald' : 'badge-neutral'}">
                  ${isDanger ? 'HIGH LOSS' : isSafe ? 'HOUSE SAFE' : 'MODERATE'}
                </span>
                ${isExceedingLayoff ? `<span class="badge badge-rose" style="font-size:0.65rem; font-weight:800;" title="Layoff Excess Amount">✂️ Cut ${formatCurrency(layoffExcess)}</span>` : ''}
              </div>
            </div>
            <div class="digit-load-details">
              <div class="digit-load-row">
                <span>Total Bet Collection:</span>
                <b>${formatCurrency(item.amount)}</b>
              </div>
              <div class="digit-load-row">
                <span>Total Bids Count:</span>
                <b>${item.bidsCount} bets</b>
              </div>
              <div class="digit-load-row">
                <span>Potential Payout (1:9.5):</span>
                <b class="text-rose">${formatCurrency(item.liability)}</b>
              </div>
              <div class="digit-load-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed var(--border-subtle);">
                <span>House Margin / P&L:</span>
                <b class="${isDanger ? 'text-rose' : 'text-emerald'}">
                  ${item.netHouseProfit >= 0 ? '+' : ''}${formatCurrency(item.netHouseProfit)}
                </b>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    const topJodisContainer = document.getElementById('top-jodis-list');
    if (topJodisContainer) {
      topJodisContainer.innerHTML = cutting.topJodis.map(j => {
        const isExceeding = j.amount > activeLayoffJodiLimit;
        const excess = isExceeding ? (j.amount - activeLayoffJodiLimit) : 0;
        return `
          <div class="flex-between" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle); font-size: 0.82rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span class="badge badge-rose text-mono" style="font-size: 0.95rem; font-weight: 800;">${j.jodi}</span>
              <span>Total Bet: <b>${formatCurrency(j.amount)}</b></span>
              ${isExceeding ? `<span class="badge badge-rose" style="font-size:0.65rem; font-weight:800;">✂️ Cut ${formatCurrency(excess)}</span>` : ''}
            </div>
            <div>
              <span style="color: var(--text-dim);">Max Payout:</span>
              <b class="text-rose text-mono">${formatCurrency(j.liability)}</b>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function updateLayoffUI(layoff) {
    if (!layoff) return;
    const digitsBadge = document.getElementById('layoff-excess-digits-badge');
    const stakeBadge = document.getElementById('layoff-total-stake-badge');
    const protectBadge = document.getElementById('layoff-protection-badge');

    const excessCount = (layoff.ankLayoffs?.length || 0) + (layoff.jodiLayoffs?.length || 0);
    if (digitsBadge) {
      digitsBadge.textContent = `${excessCount} Over Limit (${layoff.ankLayoffs?.length || 0} Ank, ${layoff.jodiLayoffs?.length || 0} Jodi)`;
      digitsBadge.className = `badge ${excessCount > 0 ? 'badge-rose' : 'badge-neutral'}`;
    }
    if (stakeBadge) {
      stakeBadge.textContent = `Layoff Stake: ${formatCurrency(layoff.totalLayoffStake || 0)}`;
      stakeBadge.className = `badge ${(layoff.totalLayoffStake || 0) > 0 ? 'badge-gold' : 'badge-neutral'}`;
    }
    if (protectBadge) {
      protectBadge.textContent = `🛡️ Risk Protected: ${formatCurrency(layoff.totalProtectedLiability || 0)}`;
    }
  }

  function onLayoffLimitChange() {
    const ankInput = document.getElementById('cutting-ank-limit');
    const jodiInput = document.getElementById('cutting-jodi-limit');
    if (ankInput) activeLayoffAnkLimit = parseInt(ankInput.value, 10) || 5000;
    if (jodiInput) activeLayoffJodiLimit = parseInt(jodiInput.value, 10) || 2000;
    renderCuttingSheet();
  }

  function copyWhatsAppLayoff() {
    if (!currentLayoffData || !currentLayoffData.whatsappText) {
      showToast('No layoff data available to export', 'error');
      return;
    }
    navigator.clipboard.writeText(currentLayoffData.whatsappText).then(() => {
      showToast('📋 WhatsApp Lay-Off Slip copied to clipboard! Ready to paste into syndicate chat.', 'success');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = currentLayoffData.whatsappText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('📋 WhatsApp Lay-Off Slip copied to clipboard!', 'success');
    });
  }

  function downloadLayoffCSV() {
    const url = `${API_BASE}/cutting/export-csv?marketId=${activeCuttingMarket}&session=${activeCuttingSession}&ankLimit=${activeLayoffAnkLimit}&jodiLimit=${activeLayoffJodiLimit}`;
    window.location.href = url;
    showToast('📥 Downloading Syndicate Lay-Off CSV...', 'info');
  }

  // --------------------------------------------------------------------------
  // TAB 5: BIDS HISTORY
  // --------------------------------------------------------------------------
  async function renderBids() {
    const res = await apiGet('/bids/all');
    if (!res.success) return;
    bidsData = res.bids;

    const tbody = document.getElementById('bids-table-body');
    if (!tbody) return;

    tbody.innerHTML = bidsData.map(b => `
      <tr>
        <td><b class="text-mono">${b.id}</b></td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${b.user_name}</div>
          <small style="color: var(--text-dim);">${b.user_id}</small>
        </td>
        <td><span class="badge badge-gold">${b.market_name}</span></td>
        <td><span style="color: var(--accent-cyan); font-weight: 600;">${b.game_type}</span></td>
        <td><span class="badge badge-neutral">${b.session}</span></td>
        <td><b class="text-mono text-gold" style="font-size: 1.1rem;">${b.number}</b></td>
        <td><b class="text-mono">${formatCurrency(b.points)}</b></td>
        <td><span class="text-mono text-emerald">${formatCurrency(b.potential_win)}</span></td>
        <td>
          <span class="badge ${b.status === 'WON' ? 'badge-won' : b.status === 'LOST' ? 'badge-lost' : 'badge-neutral'}">
            ${b.status}
          </span>
        </td>
        <td style="font-size: 0.78rem; color: var(--text-dim);">${b.created_at}</td>
        <td>
          ${b.status === 'PENDING' ? `
            <button class="btn btn-sm btn-rose" onclick="window.App.cancelBid('${b.id}')">Void</button>
          ` : '<span style="color:var(--text-dim);">-</span>'}
        </td>
      </tr>
    `).join('');
  }

  // --------------------------------------------------------------------------
  // TAB 6: USERS MANAGEMENT (LIVE DATABASE CONNECTED)
  // --------------------------------------------------------------------------
  async function renderUsers() {
    const res = await apiGet('/auth/users');
    if (res.success && res.users) {
      usersData = res.users;
    } else {
      usersData = [];
    }

    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    const searchInput = document.getElementById('user-search-input');
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const filtered = usersData.filter(u => {
      if (!query) return true;
      return (u.name || '').toLowerCase().includes(query) ||
             (u.phone || '').includes(query) ||
             (u.id || '').toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-dim);">No players found matching "${query}".</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(u => `
      <tr>
        <td><b class="text-mono">${u.id}</b></td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${u.name}</div>
          <small style="color: var(--text-dim); font-family: var(--font-mono);">${u.phone}</small>
        </td>
        <td><b class="text-mono text-gold" style="font-size: 1.05rem;">${formatCurrency(u.wallet_balance)}</b></td>
        <td>${u.total_bids || 0} bets</td>
        <td><span class="text-mono text-emerald">${formatCurrency(u.total_won || 0)}</span></td>
        <td>
          <span class="badge ${u.status === 'ACTIVE' ? 'badge-emerald' : 'badge-rose'}">
            ${u.status}
          </span>
        </td>
        <td style="font-size: 0.78rem; color: var(--text-dim);">${u.created_at}</td>
        <td>
          <div style="display:flex; gap:0.35rem;">
            <button class="btn btn-sm btn-primary" onclick="window.App.openAdjustPoints('${u.id}', '${u.name.replace(/'/g, "\\'")}')" title="Adjust Points">Points ±</button>
            <button class="btn btn-sm ${u.status === 'ACTIVE' ? 'btn-outline' : 'btn-emerald'}" onclick="window.App.toggleUserStatus('${u.id}', '${u.status}')" title="${u.status === 'ACTIVE' ? 'Block Player' : 'Activate Player'}">
              ${u.status === 'ACTIVE' ? '🔒 Block' : '✅ Unlock'}
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // --------------------------------------------------------------------------
  // TAB: AGENTS & KHAIWALS NETWORK
  // --------------------------------------------------------------------------
  async function renderAgents() {
    const res = await apiGet('/agents');
    if (!res.success) {
      showToast(res.error || 'Failed to load agents list', 'error');
      return;
    }
    agentsData = res.agents || [];

    const activeCount = agentsData.filter(a => a.status === 'ACTIVE').length;
    const totalDownstream = agentsData.reduce((sum, a) => sum + (a.downstreamCount || 0), 0);
    const totalFloating = agentsData.reduce((sum, a) => sum + (a.floating_balance || 0), 0);
    const totalCredit = agentsData.reduce((sum, a) => sum + (a.credit_limit || 0), 0);

    const countStat = document.getElementById('agents-count-stat');
    const playersStat = document.getElementById('agents-players-stat');
    const balanceStat = document.getElementById('agents-balance-stat');
    const creditStat = document.getElementById('agents-credit-stat');

    if (countStat) countStat.textContent = activeCount;
    if (playersStat) playersStat.textContent = totalDownstream;
    if (balanceStat) balanceStat.textContent = formatCurrency(totalFloating);
    if (creditStat) creditStat.textContent = formatCurrency(totalCredit);

    const tbody = document.getElementById('agents-tbody');
    if (!tbody) return;

    if (agentsData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-dim);">No Khaiwals or Agents onboarded yet. Click "Onboard New Khaiwal" above.</td></tr>`;
      return;
    }

    tbody.innerHTML = agentsData.map(a => `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${a.name}</div>
          <small class="text-mono" style="color: var(--brand-gold);">${a.id}</small>
        </td>
        <td>
          <span class="badge ${a.role === 'MASTER_AGENT' ? 'badge-gold' : 'badge-neutral'}">
            ${a.role === 'MASTER_AGENT' ? '👑 Master Agent' : '🤝 Khaiwal'}
          </span>
        </td>
        <td><span class="text-mono" style="color: var(--text-secondary); font-size: 0.9rem;">${a.phone}</span></td>
        <td><b class="text-mono">${formatCurrency(a.credit_limit || 0)}</b></td>
        <td><b class="text-mono text-gold" style="font-size: 1.05rem;">${formatCurrency(a.floating_balance || 0)}</b></td>
        <td>
          <button class="btn btn-sm btn-outline-cyan" onclick="window.App.openViewPlayersModal('${a.id}', '${a.name.replace(/'/g, "\\'")}')" title="View linked downstream players">
            👥 ${a.downstreamCount || 0} Players (${formatCurrency(a.downstreamTotalBalance || 0)})
          </button>
        </td>
        <td><span class="badge badge-emerald" style="font-weight: 700;">${a.commission_rate}%</span></td>
        <td>
          <span class="badge ${a.status === 'ACTIVE' ? 'badge-approved' : 'badge-rose'}">
            ${a.status}
          </span>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 0.35rem; justify-content: flex-end;">
            <button class="btn btn-sm btn-primary" onclick="window.App.openAdjustAgentModal('${a.id}', '${a.name.replace(/'/g, "\\'")}')" title="Credit / Debit Floating Points">
              ± Points
            </button>
            <button class="btn btn-sm btn-outline-gold" onclick="window.App.copyAgentKhata('${a.id}', '${a.name.replace(/'/g, "\\'")}')" title="Daily WhatsApp Khata Statement">
              📋 Khata
            </button>
            <button class="btn btn-sm btn-outline" onclick="window.App.openEditAgentModal('${a.id}')" title="Edit Khaiwal Settings">
              ⚙️
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // --------------------------------------------------------------------------
  // TAB 7: WALLET (DEPOSITS & WITHDRAWALS QUEUES)
  // --------------------------------------------------------------------------
  async function renderWallet() {
    const depRes = await apiGet('/wallet/deposits');
    if (depRes.success) depositsData = depRes.deposits;

    const witRes = await apiGet('/wallet/withdrawals');
    if (witRes.success) withdrawalsData = witRes.withdrawals;

    const depTable = document.getElementById('deposits-queue-wrap');
    const witTable = document.getElementById('withdrawals-queue-wrap');
    const btnDepTab = document.getElementById('btn-tab-deposits');
    const btnWitTab = document.getElementById('btn-tab-withdrawals');

    if (activeWalletTab === 'deposits') {
      if (depTable) depTable.style.display = 'block';
      if (witTable) witTable.style.display = 'none';
      if (btnDepTab) btnDepTab.classList.add('active');
      if (btnWitTab) btnWitTab.classList.remove('active');
    } else {
      if (depTable) depTable.style.display = 'none';
      if (witTable) witTable.style.display = 'block';
      if (btnDepTab) btnDepTab.classList.remove('active');
      if (btnWitTab) btnWitTab.classList.add('active');
    }

    const depTbody = document.getElementById('deposits-tbody');
    if (depTbody) {
      depTbody.innerHTML = depositsData.map(d => `
        <tr>
          <td><b class="text-mono">${d.id}</b></td>
          <td>
            <div style="font-weight: 600;">${d.user_name}</div>
            <small style="color: var(--text-dim);">${d.user_id}</small>
          </td>
          <td><b class="text-mono text-emerald" style="font-size: 1.05rem;">${formatCurrency(d.amount)}</b></td>
          <td><span class="badge badge-neutral">${d.method}</span></td>
          <td><code class="text-mono text-gold">${d.utr}</code></td>
          <td>
            <span class="badge ${d.status === 'APPROVED' ? 'badge-approved' : d.status === 'REJECTED' ? 'badge-rose' : 'badge-gold'}">
              ${d.status}
            </span>
          </td>
          <td style="font-size: 0.78rem; color: var(--text-dim);">${d.requested_at}</td>
          <td>
            ${d.status === 'PENDING' ? `
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn btn-sm btn-emerald" onclick="window.App.approveDeposit('${d.id}')">Approve</button>
                <button class="btn btn-sm btn-rose" onclick="window.App.rejectDeposit('${d.id}')">Reject</button>
              </div>
            ` : `<span style="font-size: 0.75rem; color: var(--text-dim);">${d.status}</span>`}
          </td>
        </tr>
      `).join('');
    }

    const witTbody = document.getElementById('withdrawals-tbody');
    if (witTbody) {
      witTbody.innerHTML = withdrawalsData.map(w => `
        <tr>
          <td><b class="text-mono">${w.id}</b></td>
          <td>
            <div style="font-weight: 600;">${w.user_name}</div>
            <small style="color: var(--text-dim);">${w.user_id}</small>
          </td>
          <td><b class="text-mono text-rose" style="font-size: 1.05rem;">${formatCurrency(w.amount)}</b></td>
          <td><span class="badge badge-neutral">${w.method}</span></td>
          <td style="font-size: 0.82rem; color: var(--text-secondary);">${w.destination}</td>
          <td>
            <span class="badge ${w.status === 'APPROVED' ? 'badge-approved' : w.status === 'REJECTED' ? 'badge-rose' : 'badge-gold'}">
              ${w.status}
            </span>
          </td>
          <td style="font-size: 0.78rem; color: var(--text-dim);">${w.requested_at}</td>
          <td>
            ${w.status === 'PENDING' ? `
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn btn-sm btn-emerald" onclick="window.App.approveWithdrawal('${w.id}')">Pay & Approve</button>
                <button class="btn btn-sm btn-rose" onclick="window.App.rejectWithdrawal('${w.id}')">Reject</button>
              </div>
            ` : `<span style="font-size: 0.75rem; color: var(--text-dim);">${w.reference_no || w.status}</span>`}
          </td>
        </tr>
      `).join('');
    }
  }

  // --------------------------------------------------------------------------
  // TAB 8: GAME RATES (BHAV)
  // --------------------------------------------------------------------------
  async function renderRates() {
    const res = await apiGet('/settings/rates');
    if (!res.success) return;
    ratesData = res.rates;

    const container = document.getElementById('rates-cards-grid');
    if (!container) return;

    container.innerHTML = ratesData.map((r, idx) => `
      <div class="rate-card">
        <div class="rate-card-title">
          <span>${r.name}</span>
          <span class="badge badge-gold">${r.label}</span>
        </div>
        <div class="rate-multiplier-input">
          <span>Rate: 1 : </span>
          <input type="number" step="0.5" class="form-control text-mono font-bold" id="rate-input-${idx}" value="${r.rate}">
        </div>
        <div style="display: flex; gap: 0.5rem; font-size: 0.78rem; color: var(--text-muted);">
          <span>Min: <b>₹${r.min_bid}</b></span>
          <span>Max: <b>₹${r.max_bid}</b></span>
        </div>
        <button class="btn btn-sm btn-outline" onclick="window.App.saveSingleRate(${idx})">Save Bhav</button>
      </div>
    `).join('');
  }

  // --------------------------------------------------------------------------
  // TAB 9: SETTINGS
  // --------------------------------------------------------------------------
  async function renderSettings() {
    const res = await apiGet('/settings');
    if (!res.success) return;
    settingsData = res.settings;

    const marqueeInput = document.getElementById('setting-marquee');
    const waInput = document.getElementById('setting-whatsapp');
    const tgInput = document.getElementById('setting-telegram');
    const minDepInput = document.getElementById('setting-min-dep');
    const minWitInput = document.getElementById('setting-min-wit');
    const bettingToggle = document.getElementById('setting-betting-active');
    const maintToggle = document.getElementById('setting-maintenance');

    if (marqueeInput) marqueeInput.value = settingsData.notice_marquee || '';
    if (waInput) waInput.value = settingsData.whatsapp_support || '';
    if (tgInput) tgInput.value = settingsData.telegram_channel || '';
    if (minDepInput) minDepInput.value = settingsData.min_deposit || 100;
    if (minWitInput) minWitInput.value = settingsData.min_withdrawal || 500;
    if (bettingToggle) bettingToggle.checked = settingsData.is_betting_active !== false;
    if (maintToggle) maintToggle.checked = settingsData.maintenance_mode === true;

    // Banking & Payment Gateway Details (Visible to Players)
    const upiIdInput = document.getElementById('setting-upi-id');
    const upiNameInput = document.getElementById('setting-upi-name');
    const phonepeInput = document.getElementById('setting-phonepe');
    const gpayInput = document.getElementById('setting-gpay');
    const paytmInput = document.getElementById('setting-paytm');
    const bankNameInput = document.getElementById('setting-bank-name');
    const bankAccInput = document.getElementById('setting-bank-acc');
    const bankIfscInput = document.getElementById('setting-bank-ifsc');
    const bankHolderInput = document.getElementById('setting-bank-holder');
    const paymentNotesInput = document.getElementById('setting-payment-notes');

    if (upiIdInput) upiIdInput.value = settingsData.admin_upi_id || '';
    if (upiNameInput) upiNameInput.value = settingsData.admin_upi_name || '';
    if (phonepeInput) phonepeInput.value = settingsData.admin_phonepe || '';
    if (gpayInput) gpayInput.value = settingsData.admin_googlepay || '';
    if (paytmInput) paytmInput.value = settingsData.admin_paytm || '';
    if (bankNameInput) bankNameInput.value = settingsData.admin_bank_name || '';
    if (bankAccInput) bankAccInput.value = settingsData.admin_bank_account || '';
    if (bankIfscInput) bankIfscInput.value = settingsData.admin_bank_ifsc || '';
    if (bankHolderInput) bankHolderInput.value = settingsData.admin_bank_holder || '';
    if (paymentNotesInput) paymentNotesInput.value = settingsData.admin_payment_notes || '';
  }

  function renderLogs() {
    renderResultLogsTable();
  }

  // --------------------------------------------------------------------------
  // GLOBAL ADMIN ACTION HANDLERS
  // --------------------------------------------------------------------------
  window.App = {
    switchTab,

    quickDeclare: function (marketId) {
      switchTab('declare');
      const select = document.getElementById('declare-market-select');
      if (select) {
        select.value = marketId;
        updateDeclarePreview();
      }
    },

    viewCutting: function (marketId) {
      activeCuttingMarket = marketId;
      switchTab('cutting');
    },

    setCuttingSession: function (session) {
      activeCuttingSession = session;
      document.querySelectorAll('#cutting-session-control .segmented-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-session') === session);
      });
      renderCuttingSheet();
    },

    setWalletTab: function (tab) {
      activeWalletTab = tab;
      renderWallet();
    },

    openAddNewMarketModal: function () {
      openModal('Add New Bazaar / Market', `
        <div class="form-group">
          <label class="form-label">Market Name (English)</label>
          <input type="text" class="form-control" id="new-m-name" placeholder="e.g. DUBAI DAY">
        </div>
        <div class="form-group">
          <label class="form-label">Hindi Name</label>
          <input type="text" class="form-control" id="new-m-hindi" placeholder="e.g. दुबई डे">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label class="form-label">Open Time</label>
            <input type="time" class="form-control" id="new-m-open" value="14:00">
          </div>
          <div class="form-group">
            <label class="form-label">Close Time</label>
            <input type="time" class="form-control" id="new-m-close" value="16:00">
          </div>
        </div>
        <div class="modal-footer" style="padding: 1rem 0 0; border-top: none;">
          <button class="btn btn-outline" onclick="window.App.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="window.App.saveNewMarket()">Create Market</button>
        </div>
      `);
    },

    saveNewMarket: async function () {
      const name = document.getElementById('new-m-name').value.trim();
      const hindiName = document.getElementById('new-m-hindi').value.trim();
      const openTime = document.getElementById('new-m-open').value;
      const closeTime = document.getElementById('new-m-close').value;

      const res = await apiPost('/markets', { name, hindiName, openTime, closeTime });
      if (res.success) {
        closeModal();
        showToast(res.message, 'success');
        renderMarkets();
      } else {
        showToast(res.error || 'Error creating market', 'error');
      }
    },

    editMarketTimings: function (marketId) {
      const market = marketsData.find(m => m.id === marketId);
      if (!market) return;

      openModal(`Edit Timings: ${market.name}`, `
        <div class="form-group">
          <label class="form-label">Market Open Time (HH:MM)</label>
          <input type="time" class="form-control" id="edit-open-time" value="${market.open_time}">
        </div>
        <div class="form-group">
          <label class="form-label">Market Close Time (HH:MM)</label>
          <input type="time" class="form-control" id="edit-close-time" value="${market.close_time}">
        </div>
        <div class="modal-footer" style="padding: 1rem 0 0; border-top:none;">
          <button class="btn btn-outline" onclick="window.App.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="window.App.saveMarketTimings('${market.id}')">Save Changes</button>
        </div>
      `);
    },

    saveMarketTimings: async function (marketId) {
      const openTime = document.getElementById('edit-open-time').value;
      const closeTime = document.getElementById('edit-close-time').value;

      const res = await apiPut(`/markets/${marketId}`, { openTime, closeTime });
      if (res.success) {
        closeModal();
        showToast('Timings updated successfully', 'success');
        renderMarkets();
      } else {
        showToast(res.error || 'Error updating timings', 'error');
      }
    },

    cancelBid: async function (bidId) {
      if (!confirm(`Are you sure you want to cancel and refund Bid ${bidId}?`)) return;
      const res = await apiPost(`/bids/${bidId}/cancel`, {});
      if (res.success) {
        showToast(res.message, 'success');
        renderBids();
      } else {
        showToast(res.error || 'Error voiding bid', 'error');
      }
    },

    openAdjustPoints: function (userId, userName) {
      openModal(`Adjust Points for ${userName}`, `
        <div class="form-group">
          <label class="form-label">Transaction Type</label>
          <select class="form-control" id="adj-type">
            <option value="CREDIT">➕ Credit Points (Add to Balance)</option>
            <option value="DEBIT">➖ Debit Points (Deduct from Balance)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Points Amount (₹)</label>
          <input type="number" class="form-control" id="adj-amount" placeholder="e.g. 5000">
        </div>
        <div class="form-group">
          <label class="form-label">Remark / Reason</label>
          <input type="text" class="form-control" id="adj-remark" placeholder="e.g. Offline cash or Bonus">
        </div>
        <div class="modal-footer" style="padding: 1rem 0 0; border-top: none;">
          <button class="btn btn-outline" onclick="window.App.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="window.App.saveAdjustPoints('${userId}')">Execute Adjustment</button>
        </div>
      `);
    },

    saveAdjustPoints: async function (userId) {
      const type = document.getElementById('adj-type').value;
      const amount = document.getElementById('adj-amount').value;
      const remark = document.getElementById('adj-remark').value;

      const res = await apiPost('/wallet/adjust', {
        userId,
        amount,
        type,
        remark,
        adminName: currentAdminProfile ? (currentAdminProfile.name || currentAdminProfile.username) : 'Admin'
      });

      if (res.success) {
        closeModal();
        showToast(res.message, 'success');
        fetchAdminProfile();
        renderUsers();
      } else {
        showToast(res.error || 'Adjustment failed', 'error');
      }
    },

    approveDeposit: async function (depId) {
      if (!confirm('Verify and approve this deposit payment?')) return;
      const res = await apiPost(`/wallet/deposits/${depId}/approve`, {});
      if (res.success) {
        showToast(res.message, 'success');
        renderWallet();
        renderDashboard();
      } else {
        showToast(res.error || 'Failed to approve', 'error');
      }
    },

    rejectDeposit: async function (depId) {
      const reason = prompt('Enter rejection reason:');
      if (reason !== null) {
        const res = await apiPost(`/wallet/deposits/${depId}/reject`, { reason });
        if (res.success) {
          showToast(res.message, 'info');
          renderWallet();
          renderDashboard();
        }
      }
    },

    approveWithdrawal: async function (witId) {
      const ref = prompt('Enter bank transaction reference number / UTR:');
      if (ref) {
        const res = await apiPost(`/wallet/withdrawals/${witId}/approve`, { referenceNo: ref });
        if (res.success) {
          showToast(res.message, 'success');
          renderWallet();
          renderDashboard();
        }
      }
    },

    rejectWithdrawal: async function (witId) {
      const reason = prompt('Enter rejection reason (points will be refunded to player):');
      if (reason !== null) {
        const res = await apiPost(`/wallet/withdrawals/${witId}/reject`, { reason });
        if (res.success) {
          showToast(res.message, 'info');
          renderWallet();
          renderDashboard();
        }
      }
    },

    saveSingleRate: async function (idx) {
      const input = document.getElementById(`rate-input-${idx}`);
      if (!input || !ratesData[idx]) return;
      ratesData[idx].rate = parseFloat(input.value);

      const res = await apiPut('/settings/rates', { rates: ratesData });
      if (res.success) {
        showToast(res.message, 'success');
      }
    },

    saveSettings: async function () {
      const notice_marquee = document.getElementById('setting-marquee').value;
      const whatsapp_support = document.getElementById('setting-whatsapp').value;
      const telegram_channel = document.getElementById('setting-telegram').value;
      const min_deposit = parseFloat(document.getElementById('setting-min-dep').value);
      const min_withdrawal = parseFloat(document.getElementById('setting-min-wit').value);
      const is_betting_active = document.getElementById('setting-betting-active').checked;
      const maintenance_mode = document.getElementById('setting-maintenance').checked;

      // Banking & Payment Gateway Details (Visible to Players)
      const admin_upi_id = document.getElementById('setting-upi-id')?.value?.trim() || '';
      const admin_upi_name = document.getElementById('setting-upi-name')?.value?.trim() || '';
      const admin_phonepe = document.getElementById('setting-phonepe')?.value?.trim() || '';
      const admin_googlepay = document.getElementById('setting-gpay')?.value?.trim() || '';
      const admin_paytm = document.getElementById('setting-paytm')?.value?.trim() || '';
      const admin_bank_name = document.getElementById('setting-bank-name')?.value?.trim() || '';
      const admin_bank_account = document.getElementById('setting-bank-acc')?.value?.trim() || '';
      const admin_bank_ifsc = document.getElementById('setting-bank-ifsc')?.value?.trim() || '';
      const admin_bank_holder = document.getElementById('setting-bank-holder')?.value?.trim() || '';
      const admin_payment_notes = document.getElementById('setting-payment-notes')?.value?.trim() || '';

      const res = await apiPut('/settings', {
        notice_marquee,
        whatsapp_support,
        telegram_channel,
        min_deposit,
        min_withdrawal,
        is_betting_active,
        maintenance_mode,
        admin_upi_id,
        admin_upi_name,
        admin_phonepe,
        admin_googlepay,
        admin_paytm,
        admin_bank_name,
        admin_bank_account,
        admin_bank_ifsc,
        admin_bank_holder,
        admin_payment_notes
      });

      if (res.success) {
        showToast('✅ Payment details & settings saved successfully! Live broadcasted to players.', 'success');
      } else {
        showToast(res.error || 'Failed to save settings', 'error');
      }
    },

    testPaymentQRPreview: function () {
      const upiId = document.getElementById('setting-upi-id')?.value?.trim() || settingsData?.admin_upi_id || 'kalyanboss@upi';
      const upiName = document.getElementById('setting-upi-name')?.value?.trim() || settingsData?.admin_upi_name || 'Kalyan 777 Official Services';
      const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&cu=INR`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}`;

      openModal('🔍 Live Payment QR Preview (Player View)', `
        <div style="text-align: center; padding: 1rem 0;">
          <div style="background: #fff; padding: 12px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.4); margin-bottom: 1rem;">
            <img src="${qrUrl}" alt="UPI QR Code" style="width: 200px; height: 200px; display: block;">
          </div>
          <div style="font-size: 1rem; font-weight: 700; color: var(--brand-gold);">${upiName}</div>
          <div class="text-mono" style="font-size: 1.15rem; color: #fff; font-weight: 800; margin: 0.25rem 0 1rem;">${upiId}</div>
          <div style="background: rgba(255,255,255,0.03); border: 1px dashed var(--border-subtle); border-radius: 8px; padding: 0.85rem; text-align: left; font-size: 0.8rem; color: var(--text-dim); margin-bottom: 1rem;">
            <div>📱 <b>UPI Intent Payload:</b> <code class="text-mono" style="color: var(--accent-cyan); word-break: break-all;">${upiUri}</code></div>
            <div style="margin-top: 0.4rem; color: var(--text-muted);">⚡ Any player scanning this QR in Google Pay, PhonePe, Paytm, or BHIM will send instant payments directly to this VPA.</div>
          </div>
          <button class="btn btn-outline" onclick="window.App.closeModal()">Close Preview</button>
        </div>
      `);
    },

    openAllocateQuotaModal: async function () {
      const res = await apiGet('/wallet/admins');
      if (!res.success) {
        showToast(res.error || 'Failed to fetch admin list', 'error');
        return;
      }
      const adminList = res.admins || [];
      const subAdmins = adminList.filter(a => a.role !== 'SUPER_ADMIN');

      if (subAdmins.length === 0) {
        showToast('No Sub-Admins registered to allocate quota', 'info');
        return;
      }

      openModal('👑 Super Admin Treasury: Allocate Sub-Admin Quotas', `
        <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 0.85rem; margin-bottom: 1.25rem;">
          <div style="font-size: 0.82rem; color: var(--brand-gold); font-weight: 700; margin-bottom: 0.25rem;">MASTER TREASURY MINT</div>
          <div style="font-size: 0.78rem; color: var(--text-dim); line-height: 1.4;">
            As <b>Super Admin</b>, you hold unlimited point minting power. Sub-Admins cannot give points beyond the floating quota granted by you.
          </div>
        </div>

        <div class="table-responsive" style="margin-bottom: 1.25rem;">
          <table class="data-table" style="font-size: 0.82rem;">
            <thead>
              <tr>
                <th>Admin ID</th>
                <th>Username</th>
                <th>Role</th>
                <th>Current Quota</th>
                <th>Total Granted</th>
              </tr>
            </thead>
            <tbody>
              ${adminList.map(a => `
                <tr>
                  <td><code class="text-mono">${a.id}</code></td>
                  <td><b>${a.username}</b> (${a.name})</td>
                  <td><span class="badge ${a.role === 'SUPER_ADMIN' ? 'badge-gold' : 'badge-neutral'}">${a.role}</span></td>
                  <td><b class="text-mono ${a.is_unlimited ? 'text-emerald' : 'text-gold'}">${a.is_unlimited ? '♾️ Unlimited' : formatCurrency(a.floating_balance)}</b></td>
                  <td><span class="text-mono">${a.is_unlimited ? 'Master Mint' : formatCurrency(a.total_allocated || a.floating_balance)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="form-group">
          <label class="form-label">Select Sub-Admin to Top-Up</label>
          <select class="form-control" id="alloc-admin-id">
            ${subAdmins.map(a => `<option value="${a.id}">${a.name} (@${a.username}) — Current Quota: ${formatCurrency(a.floating_balance)}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Quota Points to Add (₹)</label>
          <input type="number" class="form-control text-mono font-bold" id="alloc-amount" placeholder="e.g. 500000" min="1000" step="10000">
        </div>

        <div class="form-group">
          <label class="form-label">Allocation Remark / Audit Note</label>
          <input type="text" class="form-control" id="alloc-remark" placeholder="e.g. Weekly operational quota grant">
        </div>

        <div class="modal-footer" style="padding: 1rem 0 0; border-top: none;">
          <button class="btn btn-outline" onclick="window.App.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="window.App.saveAllocateQuota()">👑 Grant Quota Points</button>
        </div>
      `);
    },

    saveAllocateQuota: async function () {
      const adminId = document.getElementById('alloc-admin-id')?.value;
      const amount = parseInt(document.getElementById('alloc-amount')?.value, 10);
      const remark = document.getElementById('alloc-remark')?.value?.trim();

      if (!adminId || !amount || amount <= 0) {
        showToast('Please enter a valid quota amount to allocate', 'error');
        return;
      }

      const res = await apiPost('/wallet/admins/allocate-quota', {
        adminId,
        amount,
        remark: remark || 'Super Admin treasury grant'
      });

      if (res.success) {
        closeModal();
        showToast(`✅ ${res.message}`, 'success');
        fetchAdminProfile();
        renderUsers();
      } else {
        showToast(res.error || 'Quota allocation failed', 'error');
      }
    },

    fetchAdminProfile: fetchAdminProfile,

    toggleUserStatus: async function (userId, currentStatus) {
      const nextStatus = currentStatus === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
      if (!confirm(`Are you sure you want to change this player account status to ${nextStatus}?`)) return;
      const res = await apiPost(`/auth/users/${userId}/status`, { status: nextStatus });
      if (res.success) {
        showToast(res.message, 'success');
        renderUsers();
      } else {
        showToast(res.error || 'Failed to update user status', 'error');
      }
    },

    declareStarlineResult: function (starlineId) {
      openModal('Declare Starline Result', `
        <div class="form-group">
          <label class="form-label">Starline Slot: <b class="text-gold">${starlineId}</b></label>
        </div>
        <div class="form-group">
          <label class="form-label">Winning 3-Digit Patti (Pana)</label>
          <input type="text" class="form-control text-mono" id="sl-declare-patti" maxlength="3" placeholder="e.g. 124" style="font-size: 1.4rem; letter-spacing: 4px;" oninput="
            const v = this.value.replace(/\\D/g, '');
            this.value = v;
            if (v.length === 3) {
              const d1 = parseInt(v[0], 10), d2 = parseInt(v[1], 10), d3 = parseInt(v[2], 10);
              const ank = (d1 + d2 + d3) % 10;
              document.getElementById('sl-preview-ank').textContent = ank;
              document.getElementById('sl-preview-full').textContent = v + ' - ' + ank;
            } else {
              document.getElementById('sl-preview-ank').textContent = '*';
              document.getElementById('sl-preview-full').textContent = '*** - *';
            }
          ">
        </div>
        <div style="background: rgba(245, 158, 11, 0.08); border: 1px dashed var(--brand-gold); border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; text-align: center;">
          <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Starline Result Preview</div>
          <div id="sl-preview-full" class="text-mono text-gold" style="font-size: 1.8rem; font-weight: 800; margin: 0.25rem 0;">*** - *</div>
          <div style="font-size: 0.8rem; color: var(--text-dim);">Single Ank: <b id="sl-preview-ank" class="text-gold">*</b></div>
        </div>
        <div class="modal-footer" style="padding: 1rem 0 0; border-top: none;">
          <button class="btn btn-outline" onclick="window.App.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="window.App.submitStarlineDeclare('${starlineId}')">Declare & Settle</button>
        </div>
      `);
    },

    submitStarlineDeclare: async function (starlineId) {
      const patti = document.getElementById('sl-declare-patti').value.trim();
      if (!patti || patti.length !== 3) {
        showToast('Please enter a valid 3-digit Patti', 'error');
        return;
      }
      const res = await apiPost('/results/starline', { starlineId, panna: patti });
      if (res.success) {
        closeModal();
        showToast(res.message, 'success');
        renderMarkets();
        renderDashboard();
      } else {
        showToast(res.error || 'Declaration failed', 'error');
      }
    },

    declareKingResult: function (kingId) {
      openModal('Declare King Market Result (Gali Disawar)', `
        <div class="form-group">
          <label class="form-label">King Market ID: <b class="text-gold">${kingId}</b></label>
        </div>
        <div class="form-group">
          <label class="form-label">Winning 2-Digit Jodi (00–99)</label>
          <input type="text" class="form-control text-mono" id="kg-declare-jodi" maxlength="2" placeholder="e.g. 74" style="font-size: 1.4rem; letter-spacing: 4px;" oninput="
            const v = this.value.replace(/\\D/g, '');
            this.value = v;
            if (v.length === 2) {
              document.getElementById('kg-preview-jodi').textContent = v;
              document.getElementById('kg-preview-andar').textContent = v[0];
              document.getElementById('kg-preview-bahar').textContent = v[1];
            } else {
              document.getElementById('kg-preview-jodi').textContent = '**';
              document.getElementById('kg-preview-andar').textContent = '*';
              document.getElementById('kg-preview-bahar').textContent = '*';
            }
          ">
        </div>
        <div style="background: rgba(245, 158, 11, 0.08); border: 1px dashed var(--brand-gold); border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; text-align: center;">
          <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">King Result Preview</div>
          <div id="kg-preview-jodi" class="text-mono text-gold" style="font-size: 2rem; font-weight: 800; margin: 0.25rem 0;">**</div>
          <div style="font-size: 0.85rem; color: var(--text-dim); display: flex; justify-content: center; gap: 1.5rem; margin-top: 0.5rem;">
            <span>Andar Haruf: <b id="kg-preview-andar" class="text-gold">*</b></span>
            <span>Bahar Haruf: <b id="kg-preview-bahar" class="text-gold">*</b></span>
          </div>
        </div>
        <div class="modal-footer" style="padding: 1rem 0 0; border-top: none;">
          <button class="btn btn-outline" onclick="window.App.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="window.App.submitKingDeclare('${kingId}')">Declare & Settle</button>
        </div>
      `);
    },

    submitKingDeclare: async function (kingId) {
      const jodi = document.getElementById('kg-declare-jodi').value.trim();
      if (!jodi || jodi.length !== 2) {
        showToast('Please enter a valid 2-digit Jodi (00-99)', 'error');
        return;
      }
      const res = await apiPost('/results/king', { kingId, jodi });
      if (res.success) {
        closeModal();
        showToast(res.message, 'success');
        renderMarkets();
        renderDashboard();
      } else {
        showToast(res.error || 'Declaration failed', 'error');
      }
    },

    // Syndicate Lay-Off Exports
    onLayoffLimitChange: onLayoffLimitChange,
    copyWhatsAppLayoff: copyWhatsAppLayoff,
    downloadLayoffCSV: downloadLayoffCSV,

    // AGENT & KHAIWAL METHODS
    openAddNewAgentModal: function () {
      openModal('Onboard New Khaiwal / Agent', `
        <div class="form-group">
          <label class="form-label">Khaiwal / Agent Full Name</label>
          <input type="text" class="form-control" id="new-agent-name" placeholder="e.g. Kishore Bhai Khaiwal">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label class="form-label">Mobile Number (10 Digits)</label>
            <input type="tel" class="form-control text-mono" id="new-agent-phone" placeholder="98XXXXXXXX" maxlength="10">
          </div>
          <div class="form-group">
            <label class="form-label">Login MPIN (4-6 Digits)</label>
            <input type="password" class="form-control text-mono" id="new-agent-mpin" placeholder="••••" maxlength="6">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label class="form-label">Role Tier</label>
            <select class="form-control" id="new-agent-role">
              <option value="KHAIWAL">🤝 Khaiwal (Direct Bookie)</option>
              <option value="MASTER_AGENT">👑 Master Agent (Super Khaiwal)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Commission Rate (%)</label>
            <input type="number" step="0.5" class="form-control text-mono font-bold" id="new-agent-commission" value="5.0" min="0" max="25">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label class="form-label">Credit Limit (₹)</label>
            <input type="number" class="form-control text-mono font-bold" id="new-agent-credit" value="50000" step="5000">
          </div>
          <div class="form-group">
            <label class="form-label">Initial Floating Points (₹)</label>
            <input type="number" class="form-control text-mono font-bold" id="new-agent-balance" value="10000" step="1000">
          </div>
        </div>
        <div class="modal-footer" style="padding: 1rem 0 0; border-top: none;">
          <button class="btn btn-outline" onclick="window.App.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="window.App.saveNewAgent()">Onboard Khaiwal</button>
        </div>
      `);
    },

    saveNewAgent: async function () {
      const name = document.getElementById('new-agent-name').value.trim();
      const phone = document.getElementById('new-agent-phone').value.trim();
      const mpin = document.getElementById('new-agent-mpin').value.trim();
      const role = document.getElementById('new-agent-role').value;
      const commissionRate = parseFloat(document.getElementById('new-agent-commission').value) || 0;
      const creditLimit = parseInt(document.getElementById('new-agent-credit').value, 10) || 0;
      const floatingBalance = parseInt(document.getElementById('new-agent-balance').value, 10) || 0;

      if (!name || !phone || !mpin) {
        showToast('Please fill all required agent fields', 'error');
        return;
      }

      const res = await apiPost('/agents', {
        name,
        phone,
        mpin,
        role,
        commissionRate,
        creditLimit,
        floatingBalance
      });

      if (res.success) {
        closeModal();
        showToast(res.message || 'Khaiwal onboarded successfully!', 'success');
        renderAgents();
      } else {
        showToast(res.error || 'Failed to onboard agent', 'error');
      }
    },

    openAdjustAgentModal: function (agentId, agentName) {
      openModal(`Adjust Floating Points: ${agentName}`, `
        <div class="form-group">
          <label class="form-label">Transaction Type</label>
          <select class="form-control" id="adj-agent-type">
            <option value="CREDIT">➕ Credit Points (Send floating cash to Khaiwal)</option>
            <option value="DEBIT">➖ Debit Points (Withdraw points from Khaiwal)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Points Amount (₹)</label>
          <input type="number" class="form-control text-mono font-bold" id="adj-agent-amount" placeholder="e.g. 10000" min="1" step="500">
        </div>
        <div class="form-group">
          <label class="form-label">Remark / Note</label>
          <input type="text" class="form-control" id="adj-agent-remark" placeholder="e.g. Cash collected / Floating refill">
        </div>
        <div class="modal-footer" style="padding: 1rem 0 0; border-top: none;">
          <button class="btn btn-outline" onclick="window.App.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="window.App.saveAdjustAgent('${agentId}')">Apply Adjustment</button>
        </div>
      `);
    },

    saveAdjustAgent: async function (agentId) {
      const type = document.getElementById('adj-agent-type').value;
      const amount = parseInt(document.getElementById('adj-agent-amount').value, 10);
      const remark = document.getElementById('adj-agent-remark').value.trim();

      if (!amount || amount <= 0) {
        showToast('Please enter a valid points amount', 'error');
        return;
      }

      const res = await apiPost(`/agents/${agentId}/adjust`, {
        amount,
        type,
        remark: remark || 'Admin balance adjustment'
      });

      if (res.success) {
        closeModal();
        showToast(res.message, 'success');
        fetchAdminProfile();
        renderAgents();
      } else {
        showToast(res.error || 'Adjustment failed', 'error');
      }
    },

    openViewPlayersModal: async function (agentId, agentName) {
      const res = await apiGet(`/agents/${agentId}/players`);
      const players = res.success ? (res.players || []) : [];

      let playersHtml = '';
      if (players.length === 0) {
        playersHtml = `<p style="color: var(--text-dim); text-align: center; padding: 1.5rem;">No downstream players currently linked to ${agentName}.</p>`;
      } else {
        playersHtml = `
          <div class="table-responsive" style="max-height: 280px; overflow-y: auto; margin-bottom: 1rem;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Player ID</th>
                  <th>Name & Mobile</th>
                  <th>Wallet Balance</th>
                  <th>Total Turnover</th>
                  <th>Net Result</th>
                </tr>
              </thead>
              <tbody>
                ${players.map(p => `
                  <tr>
                    <td><b class="text-mono">${p.id}</b></td>
                    <td>
                      <div style="font-weight: 600;">${p.name}</div>
                      <small class="text-mono" style="color: var(--text-dim);">${p.phone}</small>
                    </td>
                    <td><b class="text-mono text-gold">${formatCurrency(p.wallet_balance || 0)}</b></td>
                    <td><span class="text-mono">${formatCurrency(p.totalWagered || 0)}</span></td>
                    <td>
                      <span class="text-mono ${(p.totalWon || 0) > (p.totalWagered || 0) ? 'text-emerald' : 'text-rose'}">
                        ${formatCurrency(p.totalWon || 0)}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      openModal(`Downstream Players: ${agentName}`, `
        <div style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.85rem; color: var(--text-muted);">Active Linked Players (${players.length})</span>
          </div>
          ${playersHtml}
        </div>
        <div style="background: rgba(255,255,255,0.03); border: 1px dashed var(--border-subtle); border-radius: 8px; padding: 0.85rem; margin-top: 1rem;">
          <label class="form-label" style="font-size: 0.8rem; margin-bottom: 0.4rem;">🔗 Link Player by ID to this Khaiwal</label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" class="form-control text-mono" id="link-player-input" placeholder="e.g. USR103" style="text-transform: uppercase;">
            <button class="btn btn-sm btn-outline-cyan" onclick="window.App.linkPlayerToAgent('${agentId}', '${agentName.replace(/'/g, "\\'")}')">Link Player</button>
          </div>
        </div>
        <div class="modal-footer" style="padding: 1rem 0 0; border-top: none;">
          <button class="btn btn-outline" onclick="window.App.closeModal()">Close</button>
        </div>
      `);
    },

    linkPlayerToAgent: async function (agentId, agentName) {
      const input = document.getElementById('link-player-input');
      const playerId = input ? input.value.trim().toUpperCase() : '';
      if (!playerId) {
        showToast('Please enter a valid Player ID (e.g. USR103)', 'error');
        return;
      }

      const res = await apiPost('/agents/link-player', { playerId, agentId });
      if (res.success) {
        showToast(res.message, 'success');
        window.App.openViewPlayersModal(agentId, agentName);
        renderAgents();
      } else {
        showToast(res.error || 'Failed to link player', 'error');
      }
    },

    copyAgentKhata: async function (agentId, agentName) {
      const res = await apiGet(`/agents/${agentId}/commission-sheet`);
      if (!res.success || !res.sheet) {
        showToast(res.error || 'Failed to generate commission sheet', 'error');
        return;
      }

      const sheet = res.sheet;
      const text = sheet.whatsappText;

      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(text);
          showToast(`📋 Daily Khata for ${agentName} copied to clipboard!`, 'success');
        } catch (e) {
          console.warn('Clipboard write failed:', e);
        }
      }

      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

      openModal(`Daily Khata Slip: ${agentName}`, `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid var(--accent-emerald); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.8rem; color: var(--accent-emerald); font-weight: 700;">NET KHAIWAL MARGIN</div>
            <div class="text-mono" style="font-size: 1.4rem; font-weight: 800; color: ${sheet.netKhaiwalMargin >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
              ${formatCurrency(sheet.netKhaiwalMargin)}
            </div>
          </div>
          <div style="text-align: right; font-size: 0.8rem; color: var(--text-dim);">
            Commission: <b>${sheet.commissionRate}%</b> (${formatCurrency(sheet.commissionEarned)})<br>
            Turnover: <b>${formatCurrency(sheet.totalTurnover)}</b>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">WhatsApp Khata Slip Format</label>
          <textarea class="form-control text-mono" id="khata-text-box" rows="10" readonly style="font-size: 0.82rem; line-height: 1.4; background: #0a0e17;">${text}</textarea>
        </div>

        <div class="modal-footer" style="padding: 1rem 0 0; border-top: none; display: flex; justify-content: space-between;">
          <a href="${waUrl}" target="_blank" class="btn btn-emerald" style="text-decoration: none;">
            💬 Open in WhatsApp
          </a>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline" onclick="window.App.closeModal()">Close</button>
            <button class="btn btn-primary" onclick="
              const box = document.getElementById('khata-text-box');
              box.select();
              document.execCommand('copy');
              window.App.showToast('📋 Copied to clipboard!', 'success');
            ">Copy Text</button>
          </div>
        </div>
      `);
    },

    openEditAgentModal: function (agentId) {
      const agent = agentsData.find(a => a.id === agentId);
      if (!agent) return;

      openModal(`Edit Agent: ${agent.name}`, `
        <div class="form-group">
          <label class="form-label">Agent Full Name</label>
          <input type="text" class="form-control" id="edit-agent-name" value="${agent.name}">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label class="form-label">Commission Rate (%)</label>
            <input type="number" step="0.5" class="form-control text-mono font-bold" id="edit-agent-commission" value="${agent.commission_rate}" min="0" max="30">
          </div>
          <div class="form-group">
            <label class="form-label">Credit Limit (₹)</label>
            <input type="number" class="form-control text-mono font-bold" id="edit-agent-credit" value="${agent.credit_limit}" step="1000">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Account Status</label>
          <select class="form-control" id="edit-agent-status">
            <option value="ACTIVE" ${agent.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE (Enabled)</option>
            <option value="SUSPENDED" ${agent.status === 'SUSPENDED' ? 'selected' : ''}>SUSPENDED (Locked)</option>
          </select>
        </div>
        <div class="modal-footer" style="padding: 1rem 0 0; border-top: none;">
          <button class="btn btn-outline" onclick="window.App.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="window.App.saveEditAgent('${agentId}')">Save Changes</button>
        </div>
      `);
    },

    saveEditAgent: async function (agentId) {
      const name = document.getElementById('edit-agent-name').value.trim();
      const commissionRate = parseFloat(document.getElementById('edit-agent-commission').value) || 0;
      const creditLimit = parseInt(document.getElementById('edit-agent-credit').value, 10) || 0;
      const status = document.getElementById('edit-agent-status').value;

      const res = await apiPut(`/agents/${agentId}`, {
        name,
        commissionRate,
        creditLimit,
        status
      });

      if (res.success) {
        closeModal();
        showToast(res.message || 'Agent updated successfully', 'success');
        renderAgents();
      } else {
        showToast(res.error || 'Update failed', 'error');
      }
    },

    showToast: showToast,
    closeModal: closeModal
  };

  // --------------------------------------------------------------------------
  // REAL-TIME WEBSOCKET FOR ADMIN PANEL
  // --------------------------------------------------------------------------
  let adminSocket = null;
  function initAdminWebSocket() {
    try {
      const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
      adminSocket = new WebSocket(proto + location.host);

      adminSocket.onopen = () => {
        console.log('⚡ Admin connected to Live WebSocket stream');
        adminSocket.send(JSON.stringify({ type: 'REGISTER_ADMIN' }));
      };

      adminSocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleAdminSocketEvent(msg.event, msg.data);
        } catch (e) {
          console.warn('Admin socket parse error:', e);
        }
      };

      adminSocket.onclose = () => {
        setTimeout(initAdminWebSocket, 3000);
      };
    } catch (e) {
      console.warn('Admin socket error:', e);
    }
  }

  function handleAdminSocketEvent(event, data) {
    if (event === 'BID_PLACED') {
      showToast(`⚡ New bet placed on ${data.marketName}! Total: ₹${data.totalPoints}`, 'info');
      if (currentTab === 'dashboard') renderDashboard();
      if (currentTab === 'bids') renderBids();
      if (currentTab === 'cutting') renderCuttingSheet();
    } else if (event === 'DEPOSIT_REQUESTED') {
      showToast(`📥 New deposit request received: ₹${data.amount} (UTR: ${data.utr})`, 'info');
      if (currentTab === 'dashboard') renderDashboard();
      if (currentTab === 'wallet') renderWallet();
    } else if (event === 'WITHDRAWAL_REQUESTED') {
      showToast(`📤 New withdrawal request received: ₹${data.amount}`, 'info');
      if (currentTab === 'dashboard') renderDashboard();
      if (currentTab === 'wallet') renderWallet();
    } else if (event === 'STARLINE_RESULT_DECLARED') {
      showToast(`🏆 Starline Result declared for ${data.marketName}: ${data.result}`, 'success');
      if (currentTab === 'markets') renderMarkets();
      if (currentTab === 'dashboard') renderDashboard();
    } else if (event === 'KING_RESULT_DECLARED') {
      showToast(`👑 King Market Result declared for ${data.marketName}: ${data.jodi}`, 'success');
      if (currentTab === 'markets') renderMarkets();
      if (currentTab === 'dashboard') renderDashboard();
    } else if (event === 'MARKET_STATUS_UPDATED') {
      if (currentTab === 'markets') renderMarkets();
      if (currentTab === 'dashboard') renderDashboard();
    }
  }

  // --------------------------------------------------------------------------
  // INITIALIZE LISTENERS
  // --------------------------------------------------------------------------
  function initEvents() {
    initClock();
    initAdminWebSocket();
    fetchAdminProfile();

    if (elements.mobileMenuBtn) {
      elements.mobileMenuBtn.addEventListener('click', () => {
        elements.sidebar.classList.add('open');
        elements.sidebarBackdrop.classList.add('active');
      });
    }
    if (elements.sidebarCloseBtn) {
      elements.sidebarCloseBtn.addEventListener('click', () => {
        elements.sidebar.classList.remove('open');
        elements.sidebarBackdrop.classList.remove('active');
      });
    }
    if (elements.sidebarBackdrop) {
      elements.sidebarBackdrop.addEventListener('click', () => {
        elements.sidebar.classList.remove('open');
        elements.sidebarBackdrop.classList.remove('active');
      });
    }

    if (elements.modalCloseBtn) {
      elements.modalCloseBtn.addEventListener('click', closeModal);
    }
    if (elements.modalOverlay) {
      elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) closeModal();
      });
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        if (tab) switchTab(tab);
      });
    });

    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        if (tab) switchTab(tab);
      });
    });

    const pannaInput = document.getElementById('declare-panna-input');
    if (pannaInput) pannaInput.addEventListener('input', updateDeclarePreview);
    const marketSelect = document.getElementById('declare-market-select');
    if (marketSelect) marketSelect.addEventListener('change', updateDeclarePreview);
    const sessionSelect = document.getElementById('declare-session-select');
    if (sessionSelect) sessionSelect.addEventListener('change', updateDeclarePreview);
    const btnSubmitDeclare = document.getElementById('btn-submit-declare');
    if (btnSubmitDeclare) btnSubmitDeclare.addEventListener('click', handleDeclareSubmit);

    const cuttingSelect = document.getElementById('cutting-market-select');
    if (cuttingSelect) {
      cuttingSelect.addEventListener('change', (e) => {
        activeCuttingMarket = e.target.value;
        renderCuttingSheet();
      });
    }

    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) btnSaveSettings.addEventListener('click', window.App.saveSettings);

    const btnRefreshAgents = document.getElementById('btn-refresh-agents');
    if (btnRefreshAgents) btnRefreshAgents.addEventListener('click', renderAgents);

    const btnAddAgent = document.getElementById('btn-add-agent');
    if (btnAddAgent) btnAddAgent.addEventListener('click', window.App.openAddNewAgentModal);

    const userSearchInput = document.getElementById('user-search-input');
    if (userSearchInput) {
      userSearchInput.addEventListener('input', () => {
        renderUsers();
      });
    }

    switchTab('dashboard');
  }

  document.addEventListener('DOMContentLoaded', initEvents);
})();
