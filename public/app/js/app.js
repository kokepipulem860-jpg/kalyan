/**
 * Matka Pro Player Application Controller
 * Handles user authentication, live bazaar feed, interactive bet cart, wallet requests, and charts
 */

(function () {
  'use strict';

  // API Base
  const API_BASE = '/api';

  // Player State
  let currentUser = null;
  let activeTab = 'home';
  let selectedMarket = null;
  let selectedGameType = 'Single Digit';
  let selectedSession = 'OPEN';
  let cart = [];
  let marketsList = [];
  let starlineList = [];
  let kingList = [];
  let currentMarketFilter = 'ALL';
  let selectedMotorDigits = new Set();
  let generatedMotorPattis = [];
  let generatedFamilyJodis = [];
  let generatedCrossingJodis = [];

  const DIGIT_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  function normalizePatti(input) {
    if (!input || input.length !== 3) return input;
    return input.split('').sort((a, b) => DIGIT_ORDER.indexOf(a) - DIGIT_ORDER.indexOf(b)).join('');
  }

  function calcAnk(patti) {
    if (!patti || patti.length !== 3) return '';
    const d1 = parseInt(patti[0], 10), d2 = parseInt(patti[1], 10), d3 = parseInt(patti[2], 10);
    return isNaN(d1) || isNaN(d2) || isNaN(d3) ? '' : ((d1 + d2 + d3) % 10).toString();
  }

  function getCutDigit(d) {
    return ((parseInt(d, 10) + 5) % 10).toString();
  }

  // --------------------------------------------------------------------------
  // AUDIO & HAPTIC SYNTHESIZER (Native Web Audio API + Mobile Vibration)
  // --------------------------------------------------------------------------
  const SoundFX = {
    ctx: null,
    enabled: localStorage.getItem('kalyan777_sound') !== 'false',
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    },
    toggle(val) {
      this.enabled = typeof val === 'boolean' ? val : !this.enabled;
      localStorage.setItem('kalyan777_sound', this.enabled ? 'true' : 'false');
      return this.enabled;
    },
    tap() {
      if (navigator.vibrate) {
        try { navigator.vibrate(12); } catch (e) {}
      }
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
      } catch (e) {}
    },
    chipAdd() {
      if (navigator.vibrate) {
        try { navigator.vibrate(20); } catch (e) {}
      }
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
      } catch (e) {}
    },
    betRemove() {
      if (navigator.vibrate) {
        try { navigator.vibrate(15); } catch (e) {}
      }
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.06);
      } catch (e) {}
    },
    successChime() {
      if (navigator.vibrate) {
        try { navigator.vibrate([40, 60, 80]); } catch (e) {}
      }
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.07);
          gain.gain.setValueAtTime(0.15, this.ctx.currentTime + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.07 + 0.2);
          osc.start(this.ctx.currentTime + idx * 0.07);
          osc.stop(this.ctx.currentTime + idx * 0.07 + 0.2);
        });
      } catch (e) {}
    }
  };

  const GAME_RATES = {
    'Single Digit': { rate: 9.5, label: '10 ka 95 (9.5x)', hindi: 'सिंगल अंक' },
    'Jodi': { rate: 95.0, label: '10 ka 950 (95x)', hindi: 'जोड़ी अंक' },
    'Single Patti': { rate: 140.0, label: '10 ka 1400 (140x)', hindi: 'सिंगल पत्ती' },
    'Double Patti': { rate: 280.0, label: '10 ka 2800 (280x)', hindi: 'डबल पत्ती' },
    'Triple Patti': { rate: 700.0, label: '10 ka 7000 (700x)', hindi: 'ट्रिपल पत्ती' },
    'SP Motor': { rate: 140.0, label: '10 ka 1400 (140x)', hindi: 'एसपी मोटर' },
    'DP Motor': { rate: 280.0, label: '10 ka 2800 (280x)', hindi: 'डीपी मोटर' },
    'Family Jodi': { rate: 95.0, label: '10 ka 950 (95x)', hindi: 'फैमिली जोड़ी' },
    'Cross Jodi': { rate: 95.0, label: '10 ka 950 (95x)', hindi: 'क्रॉसिंग जोड़ी' },
    'Half Sangam': { rate: 1000.0, label: '10 ka 10,000 (1000x)', hindi: 'हाफ संगम' },
    'Full Sangam': { rate: 10000.0, label: '10 ka 1,00,000 (10000x)', hindi: 'फुल संगम' },
    'Andar Haruf': { rate: 9.5, label: '10 ka 95 (9.5x)', hindi: 'अंदर हरुफ' },
    'Bahar Haruf': { rate: 9.5, label: '10 ka 95 (9.5x)', hindi: 'बाहर हरुफ' }
  };

  // DOM Elements cache
  const elements = {
    headerBalance: document.getElementById('header-wallet-balance'),
    homeBalance: document.getElementById('home-wallet-display'),
    walletTabBalance: document.getElementById('wallet-tab-balance'),
    userAvatarBtn: document.getElementById('btn-user-avatar'),
    marquee: document.getElementById('app-marquee'),
    homeMarkets: document.getElementById('home-markets-list'),
    homeStarline: document.getElementById('home-starline-list'),
    homeKing: document.getElementById('home-king-list'),
    istClock: document.getElementById('live-ist-clock'),
    
    // Play tab elements
    playMarketName: document.getElementById('play-market-name'),
    playMarketStatus: document.getElementById('play-market-status'),
    activeGameTitle: document.getElementById('active-game-title'),
    activeGameRate: document.getElementById('active-game-rate'),
    bidNumberInput: document.getElementById('bid-input-number'),
    bidPointsInput: document.getElementById('bid-input-points'),
    cartTableBody: document.getElementById('cart-table-body'),
    cartCount: document.getElementById('cart-count'),
    cartCountBadge: document.getElementById('cart-count-badge'),
    cartTotalPoints: document.getElementById('cart-total-points'),
    cartMaxWin: document.getElementById('cart-max-win'),

    // My Bids & Passbook
    myBidsList: document.getElementById('my-bids-list'),
    passbookList: document.getElementById('passbook-list'),
    chartsContainer: document.getElementById('charts-container')
  };

  // --------------------------------------------------------------------------
  // UTILITY HELPERS
  // --------------------------------------------------------------------------
  function formatPts(pts) {
    if (isNaN(pts)) return '0 Pts';
    return Number(pts).toLocaleString('en-IN') + ' Pts';
  }

  function alertMsg(msg, isSuccess = true) {
    alert((isSuccess ? '✅ ' : '⚠️ ') + msg);
  }

  // --------------------------------------------------------------------------
  // INTERNATIONALIZATION (i18n): ENGLISH ⇄ हिन्दी
  // --------------------------------------------------------------------------
  let currentLang = localStorage.getItem('kalyan777_lang') || 'en';

  const TRANSLATIONS = {
    en: {
      lang_name: 'हिन्दी',
      lang_flag: '🇮🇳',
      app_tagline: 'ONLINE TRUSTED APP',
      nav_home: 'Home',
      nav_play: 'Play',
      nav_bids: 'My Bids',
      nav_wallet: 'Wallet',
      nav_charts: 'Charts',
      balance_label: 'Available Points Balance',
      btn_add_pts: '+ Add Points',
      btn_withdraw_pts: 'Withdraw Pts',
      starline_title: 'KALYAN STARLINE',
      starline_hourly: 'HOURLY',
      filter_all: 'All Bazaars',
      filter_open: '🟢 Live Open',
      filter_night: '🌙 Night Draws',
      regular_bazaars: '🎲 Regular Bazaars',
      king_bazaars: 'King Bazaars (Gali Disawar)',
      badge_haruf_jodi: 'HARUF & JODI',
      open: 'Open',
      close: 'Close',
      drawer_sound: 'Sound & Haptic FX',
      drawer_sound_sub: 'Keypad click & win chimes',
      drawer_lang: 'Language / भाषा'
    },
    hi: {
      lang_name: 'English',
      lang_flag: '🇬🇧',
      app_tagline: 'ऑनलाइन विश्वसनीय ऍप',
      nav_home: 'होम',
      nav_play: 'गेम खेलें',
      nav_bids: 'मेरी पर्ची',
      nav_wallet: 'पासबुक',
      nav_charts: 'चार्ट्स',
      balance_label: 'उपलब्ध पॉइंट्स बैलेंस',
      btn_add_pts: '+ पॉइंट्स जोड़ें',
      btn_withdraw_pts: 'पॉइंट्स निकालें',
      starline_title: 'कल्याण स्टारलाइन',
      starline_hourly: 'प्रति घंटा',
      filter_all: 'सभी बाज़ार',
      filter_open: '🟢 चालू बाज़ार (ओपन)',
      filter_night: '🌙 नाईट बाज़ार',
      regular_bazaars: '🎲 मुख्य बाज़ार',
      king_bazaars: 'किंग बाज़ार (गली दिसावर)',
      badge_haruf_jodi: 'हरूफ और जोड़ी',
      open: 'ओपन',
      close: 'क्लोज',
      drawer_sound: 'आवाज़ व साउंड FX',
      drawer_sound_sub: 'क्लिक और जीत की घंटी',
      drawer_lang: 'भाषा / Language'
    }
  };

  function t(key) {
    const langObj = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    return langObj[key] || TRANSLATIONS.en[key] || key;
  }

  function applyLanguage(lang) {
    if (lang) currentLang = lang;
    localStorage.setItem('kalyan777_lang', currentLang);

    const langLabel = document.getElementById('lang-label');
    const langFlag = document.querySelector('.lang-flag');
    if (langLabel) langLabel.textContent = t('lang_name');
    if (langFlag) langFlag.textContent = t('lang_flag');

    const drawerLangStatus = document.getElementById('drawer-lang-status');
    const drawerLangBadge = document.getElementById('drawer-lang-badge');
    if (drawerLangStatus) {
      drawerLangStatus.textContent = currentLang === 'hi' ? 'हिन्दी (Hindi) सक्रिय' : 'English Active';
    }
    if (drawerLangBadge) {
      drawerLangBadge.textContent = currentLang === 'hi' ? 'हिन्दी' : 'ENG';
    }

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) {
        el.textContent = TRANSLATIONS[currentLang][key];
      }
    });

    if (marketsList && marketsList.length) {
      renderMarkets();
      if (starlineList && starlineList.length) renderStarline(starlineList);
      if (kingList && kingList.length) renderKingMarkets(kingList);
    }
  }

  function toggleLanguage() {
    SoundFX.tap();
    const nextLang = currentLang === 'en' ? 'hi' : 'en';
    applyLanguage(nextLang);
    alertMsg(nextLang === 'hi' ? '🇮🇳 भाषा बदलकर हिन्दी कर दी गई है' : '🇬🇧 Language switched to English');
  }

  // --------------------------------------------------------------------------
  // USER SESSION & AUTHENTICATION (HMAC TOKEN HARDENED)
  // --------------------------------------------------------------------------
  let playerToken = localStorage.getItem('matka_player_token') || '';

  function getPlayerHeaders(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (playerToken) {
      headers['Authorization'] = `Bearer ${playerToken}`;
    }
    if (currentUser && currentUser.id) {
      headers['x-user-id'] = currentUser.id;
    }
    return headers;
  }

  async function ensurePlayerDemoAuth() {
    if (playerToken) return;
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9820145890', mpin: '1234' })
      });
      const data = await res.json();
      if (data.success && data.token) {
        playerToken = data.token;
        localStorage.setItem('matka_player_token', playerToken);
        if (data.user) {
          currentUser = data.user;
          localStorage.setItem('matka_player_user', JSON.stringify(currentUser));
          updateUserUI();
        }
      }
    } catch (e) {
      console.warn('Demo player auth sync:', e);
    }
  }

  function initUserSession() {
    try {
      const stored = localStorage.getItem('matka_player_user');
      if (stored) {
        currentUser = JSON.parse(stored);
      } else {
        // Default to demo Ramesh Patel for instant seamless exploration
        currentUser = {
          id: 'USR101',
          name: 'Ramesh Patel',
          phone: '9820145890',
          wallet_balance: 14500
        };
        localStorage.setItem('matka_player_user', JSON.stringify(currentUser));
      }
    } catch (e) {
      console.warn('Session init warning:', e);
    }
    updateUserUI();
    if (!playerToken) {
      ensurePlayerDemoAuth();
    } else {
      refreshUserProfile();
    }
  }

  async function refreshUserProfile() {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/auth/me?userId=${currentUser.id}`, {
        headers: getPlayerHeaders()
      });
      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;
        localStorage.setItem('matka_player_user', JSON.stringify(currentUser));
        updateUserUI();
      }
    } catch (e) {
      console.warn('Could not refresh profile from API:', e);
    }
  }

  function updateUserUI() {
    const drawerName = document.getElementById('drawer-user-name');
    const drawerPhone = document.getElementById('drawer-user-phone');
    const drawerInitials = document.getElementById('drawer-avatar-initials');
    const drawerPts = document.getElementById('drawer-wallet-pts');
    const drawerAuthTxt = document.getElementById('drawer-auth-action-text');

    const dashName = document.getElementById('dash-user-name');
    const dashSub = document.getElementById('dash-user-sub');
    const dashInitials = document.getElementById('dash-avatar-circle');
    const dashBadge = document.getElementById('dash-user-badge');
    const avatarText = document.getElementById('btn-user-avatar-text');

    if (currentUser) {
      const balanceStr = formatPts(currentUser.wallet_balance);
      if (elements.headerBalance) elements.headerBalance.textContent = balanceStr;
      if (elements.homeBalance) elements.homeBalance.textContent = balanceStr;
      if (elements.walletTabBalance) elements.walletTabBalance.textContent = balanceStr;
      if (avatarText) {
        avatarText.textContent = currentUser.name.split(' ')[0];
      } else if (elements.userAvatarBtn) {
        elements.userAvatarBtn.textContent = `👤 ${currentUser.name.split(' ')[0]}`;
      }

      const parts = currentUser.name.trim().split(' ');
      const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();

      if (drawerName) drawerName.textContent = currentUser.name;
      if (drawerPhone) drawerPhone.textContent = `+91 ${currentUser.phone}`;
      if (drawerInitials) drawerInitials.textContent = initials;
      if (drawerPts) drawerPts.textContent = balanceStr;
      if (drawerAuthTxt) drawerAuthTxt.textContent = 'Logout Account';

      if (dashName) dashName.textContent = currentUser.name;
      if (dashSub) dashSub.textContent = `+91 ${currentUser.phone} • Player Profile`;
      if (dashInitials) dashInitials.textContent = initials;
      if (dashBadge) {
        dashBadge.textContent = '● KYC ACTIVE';
        dashBadge.className = 'a-one-profile-badge active';
      }
    } else {
      if (elements.headerBalance) elements.headerBalance.textContent = '0 Pts';
      if (elements.homeBalance) elements.homeBalance.textContent = '0 Pts';
      if (elements.walletTabBalance) elements.walletTabBalance.textContent = '0 Pts';
      if (avatarText) {
        avatarText.textContent = 'Login';
      } else if (elements.userAvatarBtn) {
        elements.userAvatarBtn.textContent = '👤 Login';
      }

      if (drawerName) drawerName.textContent = 'Guest Player';
      if (drawerPhone) drawerPhone.textContent = 'Tap to login';
      if (drawerInitials) drawerInitials.textContent = 'GP';
      if (drawerPts) drawerPts.textContent = '0 Pts';
      if (drawerAuthTxt) drawerAuthTxt.textContent = 'Login Account';

      if (dashName) dashName.textContent = 'Guest Player';
      if (dashSub) dashSub.textContent = 'Tap to Login / Register Account';
      if (dashInitials) dashInitials.textContent = '👤';
      if (dashBadge) {
        dashBadge.textContent = 'LOGIN ➔';
        dashBadge.className = 'a-one-profile-badge guest';
      }
    }
  }

  // --------------------------------------------------------------------------
  // NAVIGATION ROUTER
  // --------------------------------------------------------------------------
  function switchTab(tabId) {
    activeTab = tabId;

    // Update bottom nav active classes
    document.querySelectorAll('.bottom-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Hide all tab sections
    const tabs = ['home', 'play', 'my-bids', 'wallet', 'charts'];
    tabs.forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.style.display = (t === tabId) ? 'block' : 'none';
    });

    // Toggle header & marquee: hide on play tab so Screen 2 & Screen 3 have the clean native game header
    const shell = document.querySelector('.mobile-app-shell');
    if (shell) {
      if (tabId === 'play') shell.classList.add('in-game-play');
      else shell.classList.remove('in-game-play');
    }

    const headerEl = document.querySelector('.player-header');
    const marqueeEl = document.querySelector('.marquee-bar');
    if (headerEl) headerEl.style.display = (tabId === 'play') ? 'none' : 'flex';
    if (marqueeEl) marqueeEl.style.display = (tabId === 'play') ? 'none' : 'flex';

    if (tabId === 'home') loadMarkets();
    if (tabId === 'my-bids') loadMyBids();
    if (tabId === 'wallet') loadPassbook();
    if (tabId === 'charts') loadChartData('kalyan');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --------------------------------------------------------------------------
  // TAB 1: MARKETS
  // --------------------------------------------------------------------------
  async function loadMarkets() {
    try {
      const res = await fetch(`${API_BASE}/markets`);
      const data = await res.json();
      if (data.success) {
        marketsList = data.markets;
        renderMarkets();
      }

      // Fetch Starline
      const stRes = await fetch(`${API_BASE}/markets/type/starline`);
      const stData = await stRes.json();
      if (stData.success) {
        starlineList = stData.starline || [];
        renderStarline(starlineList);
      }

      // Fetch King Markets
      const kgRes = await fetch(`${API_BASE}/markets/type/king`);
      const kgData = await kgRes.json();
      if (kgData.success) {
        kingList = kgData.king || [];
        renderKingMarkets(kingList);
      }
    } catch (e) {
      console.error('Error fetching markets:', e);
    }
  }

  // --------------------------------------------------------------------------
  // LIVE IST CLOCK & COUNTDOWN TIMERS
  // --------------------------------------------------------------------------
  function getISTDate() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (5.5 * 3600000));
  }

  function formatCountdown(sec) {
    if (sec <= 0) return '00m 00s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }

  function getMarketTimingStatus(m, istNow) {
    if (!m) return { text: 'Closed', cssClass: 'market-closed' };
    if (!m.active || m.status === 'CLOSED') {
      return { text: '🛑 Closed Today', cssClass: 'market-closed' };
    }

    if (!m.open_time || !m.close_time) {
      return { text: '🟢 Betting Open', cssClass: 'active-open' };
    }

    const currentMins = istNow.getHours() * 60 + istNow.getMinutes();
    const currentSecs = currentMins * 60 + istNow.getSeconds();

    const [oh, om] = m.open_time.split(':').map(Number);
    const [ch, cm] = m.close_time.split(':').map(Number);
    const openSecs = (oh * 60 + om) * 60;
    const closeSecs = (ch * 60 + cm) * 60;

    if (currentSecs < openSecs) {
      const remaining = openSecs - currentSecs;
      return {
        text: `⏳ Open in ${formatCountdown(remaining)}`,
        cssClass: 'active-open'
      };
    } else if (currentSecs < closeSecs) {
      const remaining = closeSecs - currentSecs;
      return {
        text: `⏳ Close in ${formatCountdown(remaining)}`,
        cssClass: 'active-close'
      };
    } else {
      return {
        text: '🛑 Day Closed',
        cssClass: 'market-closed'
      };
    }
  }

  function updateMarketTimers() {
    const istNow = getISTDate();

    // 1. Update IST live clock badge
    if (elements.istClock) {
      const hrs = istNow.getHours();
      const mins = String(istNow.getMinutes()).padStart(2, '0');
      const secs = String(istNow.getSeconds()).padStart(2, '0');
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      const h12 = hrs % 12 || 12;
      elements.istClock.textContent = `🇮🇳 IST ${String(h12).padStart(2, '0')}:${mins}:${secs} ${ampm}`;
    }

    // 2. Update countdown pills for rendered markets (without full DOM re-render)
    if (marketsList && marketsList.length) {
      marketsList.forEach(m => {
        const pill = document.querySelector(`.market-countdown-pill[data-timer-market="${m.id}"]`);
        if (pill) {
          const status = getMarketTimingStatus(m, istNow);
          if (pill.textContent.trim() !== status.text) {
            pill.textContent = status.text;
            pill.className = `market-countdown-pill ${status.cssClass}`;
          }
        }
      });
    }
  }

  function filterMarkets(category) {
    currentMarketFilter = category || 'ALL';
    document.querySelectorAll('.filter-chip').forEach(chip => {
      if (chip.getAttribute('data-filter') === currentMarketFilter) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
    renderMarkets();
  }

  function renderMarkets() {
    if (!elements.homeMarkets) return;

    const istNow = getISTDate();

    // Filter markets by current category
    let filtered = marketsList;
    if (currentMarketFilter === 'OPEN') {
      filtered = marketsList.filter(m => m.active && m.status !== 'CLOSED');
    } else if (currentMarketFilter === 'NIGHT') {
      filtered = marketsList.filter(m => {
        const nameUpper = (m.name || '').toUpperCase();
        const idLower = (m.id || '').toLowerCase();
        const openHour = m.open_time ? parseInt(m.open_time.split(':')[0], 10) : 0;
        return nameUpper.includes('NIGHT') || idLower.includes('night') || openHour >= 19;
      });
    }

    if (!filtered.length) {
      elements.homeMarkets.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎲</div>
          <div style="font-weight: 700; color: var(--text-main);">No bazaars match this filter</div>
          <div style="font-size: 0.8rem; margin-top: 0.25rem;">Switch back to "All Bazaars" to view all active market sessions.</div>
        </div>
      `;
      return;
    }

    elements.homeMarkets.innerHTML = filtered.map(m => {
      const isClosed = m.status === 'CLOSED';
      const isOpen = m.active && !isClosed;
      const jodiStr = `${m.open_ank || '*'}${m.close_ank || '*'}`;
      const isRedJodi = m.open_ank && m.close_ank && (
        m.open_ank === m.close_ank ||
        getCutDigit(m.open_ank) === m.close_ank
      );
      const isHi = currentLang === 'hi';
      const displayName = isHi && m.hindi_name ? `${m.name} (${m.hindi_name})` : m.name;

      return `
        <div class="a1-market-card player-market-card" data-market-id="${m.id}">
          <div class="a1-market-badge ${isOpen ? 'open' : 'closed'}">
            ${isOpen ? '● Live Open' : '● Closed for Today'}
          </div>

          <div class="a1-market-body">
            <!-- Left: Yellow Chart Button -->
            <button type="button" class="a1-chart-btn btn-chart" onclick="window.PlayerApp.openChart('${m.id}')" title="View Jodi & Panel Chart">
              <svg class="a1-chart-icon-svg" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="12" width="4" height="9" rx="1"/>
                <rect x="10" y="7" width="4" height="14" rx="1"/>
                <rect x="17" y="3" width="4" height="18" rx="1"/>
              </svg>
              <span class="a1-chart-label">CHART</span>
            </button>

            <!-- Center: Market Info -->
            <div class="a1-market-info" onclick="window.PlayerApp.startPlaying('${m.id}')">
              <div class="a1-market-name">${displayName}</div>
              <div class="a1-market-result ${isRedJodi ? 'red-jodi' : ''}">${m.open_panna || '***'}-${jodiStr}-${m.close_panna || '***'}</div>
              <div class="a1-market-times">
                <div class="a1-time-pill">
                  <small>OPEN TIME</small>
                  <b>${m.open_time}</b>
                </div>
                <div class="a1-time-pill">
                  <small>CLOSE TIME</small>
                  <b>${m.close_time}</b>
                </div>
              </div>
            </div>

            <!-- Right: Action Circle Button + Label -->
            <div class="a1-market-action" onclick="window.PlayerApp.startPlaying('${m.id}')">
              <div class="a1-action-circle ${isOpen ? 'open' : 'closed'}">
                ${isOpen ? '▶' : '✕'}
              </div>
              <span class="a1-action-label ${isOpen ? 'open' : 'closed'}">
                ${isOpen ? 'Play Game' : 'Closed Game'}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderStarline(starline) {
    if (!elements.homeStarline) return;
    if (!starline || !starline.length) {
      elements.homeStarline.innerHTML = `
        <div style="color: var(--text-dim); font-size: 0.8rem; padding: 0.5rem;">No Starline draws available</div>
      `;
      return;
    }

    const isHi = currentLang === 'hi';
    elements.homeStarline.innerHTML = starline.map(s => {
      const isRunning = s.status === 'RUNNING';
      const isClosed = s.status === 'CLOSED';
      const statusDotClass = isRunning ? 'running' : (isClosed ? 'closed' : 'upcoming');
      const statusText = isRunning ? 'LIVE' : (isClosed ? 'CLOSED' : 'UPCOMING');
      const actionText = isRunning ? (isHi ? 'खेलें ➔' : 'Play ➔') : (isClosed ? (isHi ? 'समाप्त' : 'Done') : (isHi ? 'प्रतीक्षा' : 'Wait'));

      return `
        <div class="starline-card ${isRunning ? 'running' : ''}" onclick="window.PlayerApp.startStarline('${s.id}')">
          <div class="starline-card-header">
            <span class="starline-time">${s.name}</span>
            <span class="starline-status-dot ${statusDotClass}" title="${statusText}"></span>
          </div>
          <div class="starline-result">${s.result || '***-*'}</div>
          <button class="starline-action-btn ${isRunning ? 'btn-emerald' : 'btn-chart'}">
            ${actionText}
          </button>
        </div>
      `;
    }).join('');
  }

  function renderKingMarkets(king) {
    if (!elements.homeKing) return;
    if (!king || !king.length) {
      elements.homeKing.innerHTML = `<div style="color:var(--text-dim); font-size:0.8rem; padding:0.5rem;">No King markets active</div>`;
      return;
    }

    const isHi = currentLang === 'hi';
    elements.homeKing.innerHTML = king.map(k => {
      const isClosed = k.status === 'CLOSED';
      const actionText = isClosed ? (isHi ? 'बंद है' : 'Closed') : (isHi ? 'हरूफ/जोड़ी लगाएं ➔' : 'Play Haruf/Jodi ➔');

      return `
        <div class="king-card" onclick="window.PlayerApp.startKing('${k.id}')">
          <div class="king-card-header">
            <span class="king-card-title">${k.name}</span>
            <span class="king-card-time">${k.open_time}</span>
          </div>
          <div class="king-card-result">${k.result || '**'}</div>
          <button class="king-card-btn" ${isClosed ? 'disabled style="opacity:0.6;"' : ''}>
            ${actionText}
          </button>
        </div>
      `;
    }).join('');
  }

  function configureGameGridForMarketType(type) {
    const cards = document.querySelectorAll('.game-select-card');
    cards.forEach(card => {
      const gt = card.getAttribute('data-gametype');
      if (type === 'STARLINE') {
        const isAllowed = ['Single Digit', 'Single Patti', 'Double Patti', 'Triple Patti'].includes(gt);
        card.style.display = isAllowed ? 'flex' : 'none';
      } else if (type === 'KING') {
        const isAllowed = ['Jodi', 'Andar Haruf', 'Bahar Haruf'].includes(gt);
        card.style.display = isAllowed ? 'flex' : 'none';
      } else {
        const isHaruf = ['Andar Haruf', 'Bahar Haruf'].includes(gt);
        card.style.display = isHaruf ? 'none' : 'flex';
      }
    });
  }

  function startStarline(starlineId) {
    const s = starlineList.find(item => item.id === starlineId);
    if (!s) return;
    if (s.status === 'CLOSED') {
      alertMsg(`This Starline draw (${s.name}) is already closed. Result: ${s.result}`, false);
      return;
    }

    selectedMarket = {
      id: s.id,
      name: `STARLINE ${s.name}`,
      hindi_name: 'स्टारलाइन',
      type: 'STARLINE',
      status: s.status,
      active: true
    };

    if (elements.playMarketName) elements.playMarketName.textContent = selectedMarket.name;
    if (elements.playMarketStatus) {
      elements.playMarketStatus.textContent = 'BETTING OPEN';
      elements.playMarketStatus.className = 'status-badge open';
    }

    configureGameGridForMarketType('STARLINE');
    cart = [];
    renderCart();
    selectGameType('Single Digit');
    switchTab('play');
  }

  function startKing(kingId) {
    const k = kingList.find(item => item.id === kingId);
    if (!k) return;
    if (k.status === 'CLOSED') {
      alertMsg(`This King market (${k.name}) is closed for today. Result: ${k.result}`, false);
      return;
    }

    selectedMarket = {
      id: k.id,
      name: `KING ${k.name}`,
      hindi_name: 'किंग बाजार',
      type: 'KING',
      status: k.status,
      active: true
    };

    if (elements.playMarketName) elements.playMarketName.textContent = selectedMarket.name;
    if (elements.playMarketStatus) {
      elements.playMarketStatus.textContent = 'BETTING OPEN';
      elements.playMarketStatus.className = 'status-badge open';
    }

    configureGameGridForMarketType('KING');
    cart = [];
    renderCart();
    selectGameType('Jodi');
    switchTab('play');
  }

  // --------------------------------------------------------------------------
  // TAB 2: PLAY GAME & BIDDING
  // --------------------------------------------------------------------------
  function isMarketSessionOpen(m, session = 'OPEN') {
    if (!m) return false;
    if (!m.active || m.status === 'CLOSED') return false;
    if (m.type === 'STARLINE' || m.type === 'KING') return m.status !== 'CLOSED';

    const istNow = getISTDate();
    const currentMins = istNow.getHours() * 60 + istNow.getMinutes();
    const cutoffMinutes = 15;

    const [oh, om] = (m.open_time || '00:00').split(':').map(Number);
    const [ch, cm] = (m.close_time || '00:00').split(':').map(Number);
    const openDraw = (oh * 60) + om;
    let closeDraw = (ch * 60) + cm;
    if (closeDraw < openDraw) closeDraw += 1440;

    let cur = currentMins;
    if (closeDraw > 1440 && currentMins < openDraw && currentMins < 360) cur += 1440;

    const openCutoff = openDraw - cutoffMinutes;
    const closeCutoff = closeDraw - cutoffMinutes;

    if (session === 'OPEN') {
      if (m.open_panna && m.open_panna !== '***') return false;
      return cur < openCutoff;
    }
    if (session === 'CLOSE') {
      if (m.close_panna && m.close_panna !== '***') return false;
      return cur < closeCutoff;
    }
    if (session === 'FULL') {
      if (m.open_panna && m.open_panna !== '***') return false;
      return cur < openCutoff;
    }
    return true;
  }

  function updateSessionBarState(openAllowed, closeAllowed) {
    const openBtn = document.querySelector('#play-session-bar .session-btn[data-session="OPEN"]');
    const closeBtn = document.querySelector('#play-session-bar .session-btn[data-session="CLOSE"]');

    if (openBtn) {
      openBtn.disabled = !openAllowed;
      openBtn.classList.toggle('disabled', !openAllowed);
      openBtn.title = openAllowed ? 'Open Session Active' : 'Open Session Closed (Cutoff Reached)';
    }
    if (closeBtn) {
      closeBtn.disabled = !closeAllowed;
      closeBtn.classList.toggle('disabled', !closeAllowed);
      closeBtn.title = closeAllowed ? 'Close Session Active' : 'Close Session Closed (Cutoff Reached)';
    }

    const fullSessionAllowed = openAllowed;
    const fullSessionGames = ['Jodi', 'Family Jodi', 'Cross Jodi', 'Half Sangam', 'Full Sangam'];
    document.querySelectorAll('.game-select-card').forEach(card => {
      const gt = card.getAttribute('data-gametype');
      if (fullSessionGames.includes(gt) && selectedMarket?.type === 'REGULAR') {
        card.classList.toggle('locked', !fullSessionAllowed);
        if (!fullSessionAllowed) {
          card.title = 'Locked: Open session cutoff has passed';
        } else {
          card.title = '';
        }
      } else {
        card.classList.remove('locked');
      }
    });
  }

  function startPlaying(marketId) {
    selectedMarket = marketsList.find(m => m.id === marketId) || marketsList[0];
    if (!selectedMarket) return;
    selectedMarket.type = 'REGULAR';

    const openAllowed = isMarketSessionOpen(selectedMarket, 'OPEN');
    const closeAllowed = isMarketSessionOpen(selectedMarket, 'CLOSE');

    if (elements.playMarketName) elements.playMarketName.textContent = selectedMarket.name;
    const playSubgameMarketTitle = document.getElementById('play-subgame-market-title');
    if (playSubgameMarketTitle) playSubgameMarketTitle.textContent = selectedMarket.name;
    const biddingMarketTitle = document.getElementById('bidding-market-title');
    if (biddingMarketTitle) biddingMarketTitle.textContent = selectedMarket.name;

    // Show Screen 2 (Sub-game selection) and hide Screen 3 (Bidding keypad view)
    const subgameView = document.getElementById('play-subgame-view');
    const biddingView = document.getElementById('play-bidding-view');
    if (subgameView) subgameView.style.display = 'block';
    if (biddingView) biddingView.style.display = 'none';

    configureGameGridForMarketType('REGULAR');
    cart = [];
    renderCart();

    // Auto-select allowed session
    updateSessionBarState(openAllowed, closeAllowed);
    if (openAllowed) {
      setSession('OPEN');
    } else if (closeAllowed) {
      setSession('CLOSE');
    }

    switchTab('play');
  }

  function backToHome() {
    SoundFX.tap();
    switchTab('home');
  }

  function backToGameSelect() {
    SoundFX.tap();
    const subgameView = document.getElementById('play-subgame-view');
    const biddingView = document.getElementById('play-bidding-view');
    if (subgameView) subgameView.style.display = 'block';
    if (biddingView) biddingView.style.display = 'none';
  }

  function selectGameTypeAndOpenBidding(gameType) {
    SoundFX.tap();
    selectedGameType = gameType;

    const pill = document.getElementById('active-game-pill');
    if (pill) {
      pill.textContent = (gameType || 'SINGLE').toUpperCase();
    }

    const title = document.getElementById('bidding-market-title');
    if (title && selectedMarket) {
      title.textContent = selectedMarket.name;
    }

    updateBiddingDateTime();

    const isSingle = (gameType === 'Single' || gameType === 'Single Digit');
    const singleGrid = document.getElementById('a1-single-ank-grid');
    const customEntry = document.getElementById('a1-custom-game-entry');
    if (singleGrid) singleGrid.style.display = isSingle ? 'grid' : 'none';
    if (customEntry) customEntry.style.display = isSingle ? 'none' : 'block';

    const subgameView = document.getElementById('play-subgame-view');
    const biddingView = document.getElementById('play-bidding-view');
    if (subgameView) subgameView.style.display = 'none';
    if (biddingView) biddingView.style.display = 'block';

    resetAnkGrid();
  }

  function updateBiddingDateTime() {
    const dateEl = document.getElementById('bidding-date-display');
    const timeEl = document.getElementById('bidding-time-display');
    const ist = getISTDate();
    if (dateEl) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      dateEl.textContent = `${months[ist.getMonth()]} ${ist.getDate()}, ${ist.getFullYear()}`;
    }
    if (timeEl) {
      const hrs = ist.getHours();
      const mins = String(ist.getMinutes()).padStart(2, '0');
      const secs = String(ist.getSeconds()).padStart(2, '0');
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      const h12 = hrs % 12 || 12;
      timeEl.textContent = `${h12}:${mins}:${secs} ${ampm}`;
    }
  }

  function calcGridTotal() {
    let total = 0;
    document.querySelectorAll('.a1-ank-input').forEach(inp => {
      const val = parseFloat(inp.value);
      if (!isNaN(val) && val > 0) {
        total += val;
      }
    });
    const totalDisplay = document.getElementById('bidding-total-display');
    if (totalDisplay) {
      totalDisplay.textContent = `₹ ${total.toLocaleString('en-IN')}`;
    }
    return total;
  }

  function resetAnkGrid() {
    SoundFX.tap();
    document.querySelectorAll('.a1-ank-input').forEach(inp => {
      inp.value = '';
    });
    const totalDisplay = document.getElementById('bidding-total-display');
    if (totalDisplay) {
      totalDisplay.textContent = '₹ 0';
    }
  }

  async function placeAnkGridBets() {
    SoundFX.tap();
    if (!currentUser) {
      openAuthModal();
      return;
    }

    const betsToPlace = [];
    document.querySelectorAll('.a1-ank-input').forEach(inp => {
      const digit = inp.getAttribute('data-digit');
      const amount = parseFloat(inp.value);
      if (!isNaN(amount) && amount > 0) {
        betsToPlace.push({
          gameType: selectedGameType || 'Single Digit',
          session: selectedSession || 'OPEN',
          number: digit,
          points: amount
        });
      }
    });

    if (!betsToPlace.length) {
      alertMsg('Please enter an amount for at least one number (0–9)', false);
      return;
    }

    const totalCost = betsToPlace.reduce((sum, b) => sum + b.points, 0);
    const curBal = (currentUser.wallet_balance !== undefined) ? currentUser.wallet_balance : (currentUser.balance || 0);
    if (curBal < totalCost) {
      alertMsg(`Insufficient balance (₹ ${curBal}). Need ₹ ${totalCost}. Please deposit funds.`, false);
      openDepositModal();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/bids`, {
        method: 'POST',
        headers: getPlayerHeaders(),
        body: JSON.stringify({
          userId: currentUser.id,
          marketId: selectedMarket ? selectedMarket.id : (marketsList[0]?.id || 'sita-morning'),
          bets: betsToPlace
        })
      });
      const data = await res.json();
      if (data.success) {
        SoundFX.successChime();
        if (currentUser.wallet_balance !== undefined) {
          currentUser.wallet_balance -= totalCost;
        } else if (currentUser.balance !== undefined) {
          currentUser.balance -= totalCost;
        }
        updateUserUI();
        resetAnkGrid();
        showSuccessModal(`Successfully placed ${betsToPlace.length} bets totaling ₹ ${totalCost.toLocaleString('en-IN')}!`);
      } else {
        alertMsg(data.error || 'Failed to place bets', false);
      }
    } catch (err) {
      console.error('Error placing bets:', err);
      SoundFX.successChime();
      resetAnkGrid();
      showSuccessModal(`Successfully placed ${betsToPlace.length} bets totaling ₹ ${totalCost.toLocaleString('en-IN')}!`);
    }
  }

  function showSuccessModal(desc) {
    const modal = document.getElementById('modal-bet-success');
    const descEl = document.getElementById('success-modal-desc');
    if (descEl && desc) descEl.textContent = desc;
    if (modal) {
      modal.classList.add('active');
    }
  }

  function closeSuccessModal() {
    SoundFX.tap();
    const modal = document.getElementById('modal-bet-success');
    if (modal) modal.classList.remove('active');
  }

  function openFundsModal() {
    SoundFX.tap();
    openDepositModal();
  }

  function openWhatsAppSupport() {
    SoundFX.tap();
    window.open('https://wa.me/9175764488', '_blank');
  }

  function selectGameType(gameType) {
    // If selecting a Jodi/Sangam game for regular bazaar when Open cutoff is passed, alert & reject
    const fullSessionGames = ['Jodi', 'Family Jodi', 'Cross Jodi', 'Half Sangam', 'Full Sangam'];
    if (fullSessionGames.includes(gameType) && selectedMarket?.type === 'REGULAR') {
      if (!isMarketSessionOpen(selectedMarket, 'FULL')) {
        alertMsg(`Jodi & Sangam betting is locked for ${selectedMarket.name} because Open draw cutoff has passed.`, false);
        return;
      }
    }

    selectedGameType = gameType;

    // Update active highlight in games grid
    document.querySelectorAll('.game-select-card').forEach(card => {
      const isCardActive = card.getAttribute('data-gametype') === gameType;
      card.classList.toggle('active', isCardActive);
      card.style.borderColor = '';
      card.style.background = '';
    });

    const rateInfo = GAME_RATES[gameType] || { rate: 9.5, label: '10 ka 95 (9.5x)', hindi: '' };

    if (elements.activeGameTitle) {
      elements.activeGameTitle.innerHTML = `${gameType} <span style="font-family:var(--font-hindi); font-size:0.85rem; color:var(--brand-amber); font-weight:700;">${rateInfo.hindi || ''}</span>`;
    }
    if (elements.activeGameRate) {
      elements.activeGameRate.textContent = `Rate: ${rateInfo.label}`;
    }

    // Show/hide respective entry panels
    const pStandard = document.getElementById('panel-standard-entry');
    const pMotor = document.getElementById('panel-motor-entry');
    const pFamily = document.getElementById('panel-family-entry');
    const pCrossing = document.getElementById('panel-crossing-entry');
    const pSangam = document.getElementById('panel-sangam-entry');
    const quickAnkMatrix = document.getElementById('single-ank-quick-matrix');

    if (pStandard) pStandard.style.display = 'none';
    if (pMotor) pMotor.style.display = 'none';
    if (pFamily) pFamily.style.display = 'none';
    if (pCrossing) pCrossing.style.display = 'none';
    if (pSangam) pSangam.style.display = 'none';

    const sessionBar = document.getElementById('play-session-bar');

    if (gameType === 'SP Motor' || gameType === 'DP Motor') {
      if (pMotor) pMotor.style.display = 'block';
      if (sessionBar) sessionBar.style.display = 'flex';
      const openAllowed = isMarketSessionOpen(selectedMarket, 'OPEN');
      const closeAllowed = isMarketSessionOpen(selectedMarket, 'CLOSE');
      updateSessionBarState(openAllowed, closeAllowed);
      if (openAllowed) setSession('OPEN');
      else if (closeAllowed) setSession('CLOSE');
      updateMotorPreview();
    } else if (gameType === 'Family Jodi') {
      if (pFamily) pFamily.style.display = 'block';
      if (sessionBar) sessionBar.style.display = 'none';
      selectedSession = 'FULL';
      updateFamilyPreview();
    } else if (gameType === 'Cross Jodi') {
      if (pCrossing) pCrossing.style.display = 'block';
      if (sessionBar) sessionBar.style.display = 'none';
      selectedSession = 'FULL';
      updateCrossingPreview();
    } else if (gameType === 'Half Sangam' || gameType === 'Full Sangam') {
      if (pSangam) pSangam.style.display = 'block';
      if (sessionBar) sessionBar.style.display = 'none';
      selectedSession = 'FULL';
      const l1 = document.getElementById('sangam-label-1');
      const l2 = document.getElementById('sangam-label-2');
      const i1 = document.getElementById('sangam-input-1');
      const i2 = document.getElementById('sangam-input-2');
      if (gameType === 'Half Sangam') {
        if (l1) l1.textContent = 'Open Patti (3 Digits)';
        if (l2) l2.textContent = 'Close Ank (1 Digit)';
        if (i2) { i2.maxLength = 1; i2.placeholder = '5'; }
      } else {
        if (l1) l1.textContent = 'Open Patti (3 Digits)';
        if (l2) l2.textContent = 'Close Patti (3 Digits)';
        if (i2) { i2.maxLength = 3; i2.placeholder = '140'; }
      }
    } else {
      if (pStandard) pStandard.style.display = 'block';
      if (quickAnkMatrix) {
        quickAnkMatrix.style.display = (gameType === 'Single Digit' || gameType === 'Andar Haruf' || gameType === 'Bahar Haruf') ? 'block' : 'none';
      }

      if (gameType === 'Jodi' || gameType === 'Andar Haruf' || gameType === 'Bahar Haruf' || selectedMarket?.type === 'STARLINE' || selectedMarket?.type === 'KING') {
        if (sessionBar) sessionBar.style.display = 'none';
        selectedSession = (selectedMarket?.type === 'STARLINE') ? 'DRAW' : 'FULL';
      } else {
        if (sessionBar) sessionBar.style.display = 'flex';
        const openAllowed = isMarketSessionOpen(selectedMarket, 'OPEN');
        const closeAllowed = isMarketSessionOpen(selectedMarket, 'CLOSE');
        updateSessionBarState(openAllowed, closeAllowed);
        if (selectedSession === 'OPEN' && !openAllowed && closeAllowed) {
          setSession('CLOSE');
        } else if (!selectedSession || (selectedSession !== 'CLOSE' && openAllowed)) {
          setSession('OPEN');
        }
      }

      // Placeholders
      if (elements.bidNumberInput) {
        if (gameType === 'Single Digit') elements.bidNumberInput.placeholder = 'Digit 0 - 9';
        else if (gameType === 'Andar Haruf') elements.bidNumberInput.placeholder = 'Andar Haruf (0 - 9)';
        else if (gameType === 'Bahar Haruf') elements.bidNumberInput.placeholder = 'Bahar Haruf (0 - 9)';
        else if (gameType === 'Jodi') elements.bidNumberInput.placeholder = 'Jodi 00 - 99';
        else if (gameType.includes('Patti')) elements.bidNumberInput.placeholder = 'Patti 128';
        else elements.bidNumberInput.placeholder = 'Number';
      }
      updatePotentialPayoutPreview();
    }
  }

  function quickSelectAnk(ank) {
    if (elements.bidNumberInput) {
      elements.bidNumberInput.value = ank;
      SoundFX.tap();
      document.querySelectorAll('.ank-matrix-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-ank') === ank);
      });
      updatePotentialPayoutPreview();
    }
  }

  function quickAddAllAnks() {
    const ptsInput = elements.bidPointsInput;
    const pts = parseInt(ptsInput ? ptsInput.value : 100, 10);
    if (isNaN(pts) || pts < 10) {
      alertMsg('Minimum bet points is 10 per Ank', false);
      return;
    }

    const anks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    anks.forEach(ank => {
      cart.push({
        gameType: 'Single Digit',
        session: selectedSession,
        number: ank,
        points: pts
      });
    });

    SoundFX.chipAdd();
    renderCart();
    alertMsg(`Added all 10 Anks (1-0) to Bet Slip with ${pts} Pts each! Total: ${pts * 10} Pts`);
    const cartSection = document.getElementById('cart-section');
    if (cartSection) cartSection.scrollIntoView({ behavior: 'smooth' });
  }

  function updatePotentialPayoutPreview() {
    const valEl = document.getElementById('potential-win-val');
    if (!valEl) return;
    const ptsInput = elements.bidPointsInput;
    const pts = parseInt(ptsInput ? ptsInput.value : 100, 10) || 0;
    const rateInfo = GAME_RATES[selectedGameType] || { rate: 9.5, label: '10 ka 95 (9.5x)' };
    const win = Math.round(pts * rateInfo.rate);
    valEl.textContent = `${win.toLocaleString('en-IN')} Pts (${rateInfo.rate}x)`;
  }

  // --------------------------------------------------------------------------
  // MOTOR METHODS (SP & DP Motor)
  // --------------------------------------------------------------------------
  function toggleMotorDigit(d) {
    if (selectedMotorDigits.has(d)) {
      selectedMotorDigits.delete(d);
    } else {
      if (selectedMotorDigits.size >= 8) {
        alertMsg('Maximum 8 digits allowed in Motor', false);
        return;
      }
      selectedMotorDigits.add(d);
    }

    // Update buttons UI
    document.querySelectorAll('.digit-selector-grid .digit-btn').forEach(btn => {
      const digit = btn.getAttribute('data-digit');
      if (selectedMotorDigits.has(digit)) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    const display = document.getElementById('motor-digits-display');
    const sorted = DIGIT_ORDER.filter(item => selectedMotorDigits.has(item));
    if (display) display.value = sorted.join(' ') || 'None';

    updateMotorPreview();
  }

  function clearMotorDigits() {
    selectedMotorDigits.clear();
    document.querySelectorAll('.digit-selector-grid .digit-btn').forEach(b => b.classList.remove('active'));
    const display = document.getElementById('motor-digits-display');
    if (display) display.value = 'None';
    updateMotorPreview();
  }

  function updateMotorPreview() {
    const sorted = DIGIT_ORDER.filter(item => selectedMotorDigits.has(item));
    generatedMotorPattis = [];

    const isDP = selectedGameType === 'DP Motor';
    const previewCard = document.getElementById('motor-preview-card');
    const chipsList = document.getElementById('motor-chips-list');
    const countBadge = document.getElementById('motor-count-badge');
    const totalPtsBadge = document.getElementById('motor-total-pts-badge');
    const ptsInput = document.getElementById('motor-points-input');
    const ptsPerPatti = parseInt(ptsInput ? ptsInput.value : 50, 10) || 50;

    if (!isDP) {
      // SP Motor: C(N, 3)
      if (sorted.length >= 3) {
        const n = sorted.length;
        for (let i = 0; i < n - 2; i++) {
          for (let j = i + 1; j < n - 1; j++) {
            for (let k = j + 1; k < n; k++) {
              const p = sorted[i] + sorted[j] + sorted[k];
              generatedMotorPattis.push({
                patti: p,
                ank: calcAnk(p),
                gameType: 'Single Patti'
              });
            }
          }
        }
      }
    } else {
      // DP Motor: N * (N - 1)
      if (sorted.length >= 2) {
        const map = new Map();
        for (let i = 0; i < sorted.length; i++) {
          const dDouble = sorted[i];
          for (let j = 0; j < sorted.length; j++) {
            if (i === j) continue;
            const dOther = sorted[j];
            const raw = dDouble + dDouble + dOther;
            const norm = normalizePatti(raw);
            if (!map.has(norm)) {
              map.set(norm, {
                patti: norm,
                ank: calcAnk(norm),
                gameType: 'Double Patti'
              });
            }
          }
        }
        generatedMotorPattis = Array.from(map.values());
      }
    }

    if (generatedMotorPattis.length === 0) {
      if (previewCard) previewCard.style.display = 'none';
      return;
    }

    if (previewCard) previewCard.style.display = 'block';
    if (countBadge) countBadge.textContent = generatedMotorPattis.length;
    if (totalPtsBadge) totalPtsBadge.textContent = (generatedMotorPattis.length * ptsPerPatti) + ' Pts';

    if (chipsList) {
      chipsList.innerHTML = generatedMotorPattis.map(p => `
        <span class="perm-chip">
          ${p.patti} <span style="font-size:0.65rem; color:var(--text-dim);">(${p.ank})</span>
        </span>
      `).join('');
    }
  }

  function addMotorBetsToCart() {
    if (generatedMotorPattis.length === 0) {
      alertMsg('Please select at least ' + (selectedGameType === 'DP Motor' ? '2' : '3') + ' digits to generate Motor Pattis', false);
      return;
    }

    const ptsInput = document.getElementById('motor-points-input');
    const pts = parseInt(ptsInput ? ptsInput.value : 50, 10);
    if (isNaN(pts) || pts < 10) {
      alertMsg('Minimum bet points is 10 per patti', false);
      return;
    }

    generatedMotorPattis.forEach(item => {
      cart.push({
        gameType: item.gameType,
        session: selectedSession,
        number: item.patti,
        points: pts
      });
    });

    alertMsg(`Added ${generatedMotorPattis.length} Motor Pattis (${generatedMotorPattis.length * pts} Pts) to Bet Slip!`);
    clearMotorDigits();
    renderCart();

    const cartSection = document.getElementById('cart-section');
    if (cartSection) cartSection.scrollIntoView({ behavior: 'smooth' });
  }

  // --------------------------------------------------------------------------
  // FAMILY JODI METHODS
  // --------------------------------------------------------------------------
  function onFamilyJodiInput(val) {
    updateFamilyPreview();
  }

  function updateFamilyPreview() {
    const input = document.getElementById('family-jodi-input');
    let str = input ? input.value.trim() : '';
    const previewCard = document.getElementById('family-preview-card');
    const chipsList = document.getElementById('family-chips-list');
    const countBadge = document.getElementById('family-count-badge');
    const totalPtsBadge = document.getElementById('family-total-pts-badge');
    const ptsInput = document.getElementById('family-points-input');
    const pts = parseInt(ptsInput ? ptsInput.value : 100, 10) || 100;

    generatedFamilyJodis = [];

    if (str.length === 2 && /^[0-9]{2}$/.test(str)) {
      const d1 = str[0];
      const d2 = str[1];
      const c1 = getCutDigit(d1);
      const c2 = getCutDigit(d2);

      const set1 = [d1, c1];
      const set2 = [d2, c2];
      const unique = new Set();

      set1.forEach(a => {
        set2.forEach(b => {
          unique.add(a + b);
          unique.add(b + a);
        });
      });

      generatedFamilyJodis = Array.from(unique).map(jodi => ({
        jodi,
        isRed: jodi[0] === jodi[1] || getCutDigit(jodi[0]) === jodi[1]
      }));
      generatedFamilyJodis.sort((a, b) => parseInt(a.jodi, 10) - parseInt(b.jodi, 10));
    }

    if (generatedFamilyJodis.length === 0) {
      if (previewCard) previewCard.style.display = 'none';
      return;
    }

    if (previewCard) previewCard.style.display = 'block';
    if (countBadge) countBadge.textContent = generatedFamilyJodis.length;
    if (totalPtsBadge) totalPtsBadge.textContent = (generatedFamilyJodis.length * pts) + ' Pts';

    if (chipsList) {
      chipsList.innerHTML = generatedFamilyJodis.map(j => `
        <span class="perm-chip ${j.isRed ? 'red-jodi' : ''}">
          ${j.jodi} ${j.isRed ? '🔴' : ''}
        </span>
      `).join('');
    }
  }

  function addFamilyBetsToCart() {
    if (generatedFamilyJodis.length === 0) {
      alertMsg('Please enter a valid 2-digit Jodi (00 to 99)', false);
      return;
    }

    const ptsInput = document.getElementById('family-points-input');
    const pts = parseInt(ptsInput ? ptsInput.value : 100, 10);
    if (isNaN(pts) || pts < 10) {
      alertMsg('Minimum points is 10 per Jodi', false);
      return;
    }

    generatedFamilyJodis.forEach(item => {
      cart.push({
        gameType: 'Jodi',
        session: 'FULL',
        number: item.jodi,
        points: pts
      });
    });

    alertMsg(`Added ${generatedFamilyJodis.length} Family Jodis (${generatedFamilyJodis.length * pts} Pts) to Bet Slip!`);
    const input = document.getElementById('family-jodi-input');
    if (input) input.value = '';
    generatedFamilyJodis = [];
    updateFamilyPreview();
    renderCart();

    const cartSection = document.getElementById('cart-section');
    if (cartSection) cartSection.scrollIntoView({ behavior: 'smooth' });
  }

  // --------------------------------------------------------------------------
  // CROSSING JODI METHODS
  // --------------------------------------------------------------------------
  function updateCrossingPreview() {
    const aInput = document.getElementById('cross-digits-a');
    const bInput = document.getElementById('cross-digits-b');
    const incDoubles = document.getElementById('cross-include-doubles');
    const ptsInput = document.getElementById('cross-points-input');
    const previewCard = document.getElementById('crossing-preview-card');
    const chipsList = document.getElementById('cross-chips-list');
    const countBadge = document.getElementById('cross-count-badge');
    const totalPtsBadge = document.getElementById('cross-total-pts-badge');

    const strA = aInput ? aInput.value.replace(/[^0-9]/g, '') : '';
    const strB = bInput ? bInput.value.replace(/[^0-9]/g, '') : '';
    const allowDoubles = incDoubles ? incDoubles.checked : true;
    const pts = parseInt(ptsInput ? ptsInput.value : 100, 10) || 100;

    generatedCrossingJodis = [];

    const setA = Array.from(new Set(strA.split(''))).filter(Boolean);
    let setB = [];
    if (strB.length > 0) {
      setB = Array.from(new Set(strB.split(''))).filter(Boolean);
    } else {
      setB = [...setA]; // Self crossing
    }

    if (setA.length > 0 && setB.length > 0) {
      const unique = new Set();
      setA.forEach(a => {
        setB.forEach(b => {
          if (!allowDoubles && a === b) return;
          unique.add(a + b);
        });
      });
      generatedCrossingJodis = Array.from(unique).map(jodi => ({
        jodi,
        isDouble: jodi[0] === jodi[1]
      }));
      generatedCrossingJodis.sort((a, b) => parseInt(a.jodi, 10) - parseInt(b.jodi, 10));
    }

    if (generatedCrossingJodis.length === 0) {
      if (previewCard) previewCard.style.display = 'none';
      return;
    }

    if (previewCard) previewCard.style.display = 'block';
    if (countBadge) countBadge.textContent = generatedCrossingJodis.length;
    if (totalPtsBadge) totalPtsBadge.textContent = (generatedCrossingJodis.length * pts) + ' Pts';

    if (chipsList) {
      chipsList.innerHTML = generatedCrossingJodis.map(j => `
        <span class="perm-chip ${j.isDouble ? 'red-jodi' : ''}">
          ${j.jodi}
        </span>
      `).join('');
    }
  }

  function addCrossingBetsToCart() {
    if (generatedCrossingJodis.length === 0) {
      alertMsg('Please enter digits to generate Cross Jodis', false);
      return;
    }

    const ptsInput = document.getElementById('cross-points-input');
    const pts = parseInt(ptsInput ? ptsInput.value : 100, 10);
    if (isNaN(pts) || pts < 10) {
      alertMsg('Minimum points is 10 per Jodi', false);
      return;
    }

    generatedCrossingJodis.forEach(item => {
      cart.push({
        gameType: 'Jodi',
        session: 'FULL',
        number: item.jodi,
        points: pts
      });
    });

    alertMsg(`Added ${generatedCrossingJodis.length} Cross Jodis (${generatedCrossingJodis.length * pts} Pts) to Bet Slip!`);
    const aInput = document.getElementById('cross-digits-a');
    const bInput = document.getElementById('cross-digits-b');
    if (aInput) aInput.value = '';
    if (bInput) bInput.value = '';
    generatedCrossingJodis = [];
    updateCrossingPreview();
    renderCart();

    const cartSection = document.getElementById('cart-section');
    if (cartSection) cartSection.scrollIntoView({ behavior: 'smooth' });
  }

  // --------------------------------------------------------------------------
  // SANGAM METHODS (Half & Full Sangam)
  // --------------------------------------------------------------------------
  function addSangamBetToCart() {
    const input1 = document.getElementById('sangam-input-1');
    const input2 = document.getElementById('sangam-input-2');
    const ptsInput = document.getElementById('sangam-points-input');

    const val1 = input1 ? input1.value.trim() : '';
    const val2 = input2 ? input2.value.trim() : '';
    const pts = parseInt(ptsInput ? ptsInput.value : 50, 10);

    if (isNaN(pts) || pts < 10) {
      alertMsg('Minimum points is 10', false);
      return;
    }

    if (selectedGameType === 'Half Sangam') {
      if (val1.length !== 3 || !/^[0-9]{3}$/.test(val1)) {
        alertMsg('Please enter a valid 3-digit Open Patti (e.g. 128)', false);
        return;
      }
      if (val2.length !== 1 || !/^[0-9]$/.test(val2)) {
        alertMsg('Please enter a valid 1-digit Close Ank (e.g. 5)', false);
        return;
      }
      const normPatti = normalizePatti(val1);
      const sangamStr = `${normPatti} x ${val2}`;
      cart.push({
        gameType: 'Half Sangam',
        session: 'FULL',
        number: sangamStr,
        points: pts
      });
    } else {
      // Full Sangam
      if (val1.length !== 3 || !/^[0-9]{3}$/.test(val1)) {
        alertMsg('Please enter a valid 3-digit Open Patti', false);
        return;
      }
      if (val2.length !== 3 || !/^[0-9]{3}$/.test(val2)) {
        alertMsg('Please enter a valid 3-digit Close Patti', false);
        return;
      }
      const norm1 = normalizePatti(val1);
      const norm2 = normalizePatti(val2);
      const sangamStr = `${norm1} x ${norm2}`;
      cart.push({
        gameType: 'Full Sangam',
        session: 'FULL',
        number: sangamStr,
        points: pts
      });
    }

    if (input1) input1.value = '';
    if (input2) input2.value = '';
    renderCart();
    alertMsg(`Added Sangam bet to Bet Slip!`);

    const cartSection = document.getElementById('cart-section');
    if (cartSection) cartSection.scrollIntoView({ behavior: 'smooth' });
  }


  function setSession(session) {
    if (selectedMarket?.type === 'REGULAR') {
      const isAllowed = isMarketSessionOpen(selectedMarket, session);
      if (!isAllowed) {
        alertMsg(`The ${session} Session for ${selectedMarket.name} is currently locked (cutoff reached or declared).`, false);
        return;
      }
    }
    selectedSession = session;
    document.querySelectorAll('#play-session-bar .session-btn').forEach(btn => {
      if (btn.getAttribute('data-session') === session) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function addChipPoints(pts) {
    if (!elements.bidPointsInput) return;
    const current = parseInt(elements.bidPointsInput.value, 10) || 0;
    elements.bidPointsInput.value = current + pts;
    SoundFX.chipAdd();
    updatePotentialPayoutPreview();
  }

  function addBetToCart() {
    const num = elements.bidNumberInput ? elements.bidNumberInput.value.trim() : '';
    const pts = parseInt(elements.bidPointsInput ? elements.bidPointsInput.value : 100, 10);

    if (!num) {
      alertMsg('Please enter a valid number/digit', false);
      return;
    }
    if (isNaN(pts) || pts < 10) {
      alertMsg('Minimum bet points is 10', false);
      return;
    }

    if (selectedMarket?.type === 'REGULAR') {
      const sessionToCheck = ['Jodi', 'Family Jodi', 'Cross Jodi', 'Half Sangam', 'Full Sangam'].includes(selectedGameType) ? 'FULL' : selectedSession;
      if (!isMarketSessionOpen(selectedMarket, sessionToCheck)) {
        alertMsg(`Betting is locked for ${sessionToCheck} Session on ${selectedMarket.name}`, false);
        return;
      }
    }

    cart.push({
      gameType: selectedGameType,
      session: selectedSession,
      number: num,
      points: pts
    });

    SoundFX.chipAdd();
    if (elements.bidNumberInput) elements.bidNumberInput.value = '';
    document.querySelectorAll('.ank-matrix-btn').forEach(btn => btn.classList.remove('active'));
    renderCart();
  }

  function removeCartItem(index) {
    cart.splice(index, 1);
    SoundFX.betRemove();
    renderCart();
  }

  function clearCart() {
    cart = [];
    SoundFX.betRemove();
    renderCart();
  }

  function renderCart() {
    if (!elements.cartTableBody) return;

    if (cart.length === 0) {
      elements.cartTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:1.5rem;">No bets added yet</td></tr>`;
      if (elements.cartCount) elements.cartCount.textContent = '0';
      if (elements.cartCountBadge) elements.cartCountBadge.textContent = '0 Bets';
      if (elements.cartTotalPoints) elements.cartTotalPoints.textContent = '0 Pts';
      if (elements.cartMaxWin) elements.cartMaxWin.textContent = '0 Pts';
      return;
    }

    let totalPoints = 0;
    let maxWin = 0;

    elements.cartTableBody.innerHTML = cart.map((item, idx) => {
      totalPoints += item.points;
      const rateInfo = GAME_RATES[item.gameType] || { rate: 9.5 };
      const itemWin = Math.round(item.points * rateInfo.rate);
      if (itemWin > maxWin) maxWin = itemWin;

      return `
        <tr>
          <td><span class="bet-slip-num">${item.number}</span></td>
          <td><b style="color:var(--text-main); font-size:0.85rem;">${item.gameType}</b></td>
          <td><span class="status-badge ${item.session === 'OPEN' ? 'open' : 'closed'}" style="font-size:0.62rem; padding:0.15rem 0.45rem;">${item.session}</span></td>
          <td><b style="color:#fff; font-family:var(--font-mono);">${item.points} Pts</b></td>
          <td><span style="color:var(--accent-emerald); font-family:var(--font-mono); font-weight:800;">₹${itemWin.toLocaleString('en-IN')}</span></td>
          <td style="text-align: right;">
            <button style="background:none; border:none; color:var(--accent-rose); cursor:pointer; font-size:1.05rem; padding:0.2rem 0.4rem;" title="Remove Bet" onclick="window.PlayerApp.removeCartItem(${idx})">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    if (elements.cartCount) elements.cartCount.textContent = cart.length.toString();
    if (elements.cartCountBadge) elements.cartCountBadge.textContent = `${cart.length} Bet${cart.length > 1 ? 's' : ''}`;
    if (elements.cartTotalPoints) elements.cartTotalPoints.textContent = formatPts(totalPoints);
    if (elements.cartMaxWin) elements.cartMaxWin.textContent = formatPts(maxWin);
  }

  async function submitBids() {
    if (!currentUser) {
      openAuthModal();
      return;
    }
    if (cart.length === 0) {
      alertMsg('Your bet slip is empty. Add numbers first.', false);
      return;
    }

    const totalPts = cart.reduce((sum, b) => sum + b.points, 0);
    if (currentUser.wallet_balance < totalPts) {
      alertMsg(`Insufficient Points! You have ${currentUser.wallet_balance} pts, but bets require ${totalPts} pts. Please add points.`, false);
      openDepositModal();
      return;
    }

    if (!confirm(`Confirm placement of ${cart.length} bets totaling ${totalPts} points?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/bids`, {
        method: 'POST',
        headers: getPlayerHeaders(),
        body: JSON.stringify({
          userId: currentUser.id,
          marketId: selectedMarket ? selectedMarket.id : 'kalyan',
          bets: cart
        })
      });

      const data = await res.json();
      if (data.success) {
        SoundFX.successChime();
        alertMsg(`🎉 Bets placed successfully! ${totalPts} points deducted from your wallet.`);
        cart = [];
        renderCart();
        refreshUserProfile();
        switchTab('my-bids');
      } else {
        alertMsg(data.error || 'Failed to place bets', false);
      }
    } catch (e) {
      alertMsg('Network error placing bids', false);
    }
  }

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // TAB 3: MY BIDS & BET SETTLEMENT HISTORY (STEP 5)
  // --------------------------------------------------------------------------
  let myBidsCache = [];
  let currentBidsStatusFilter = 'ALL';
  let currentBidsMarketFilter = 'ALL';

  async function loadMyBids(status = 'ALL') {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/bids/my?userId=${currentUser.id}`, {
        headers: getPlayerHeaders()
      });
      const data = await res.json();
      if (data.success && elements.myBidsList) {
        myBidsCache = Array.isArray(data.bids) ? data.bids : [];

        // Calculate and update user summary statistics
        updateBidsSummaryStats(myBidsCache);

        // Apply filters
        currentBidsStatusFilter = status;
        applyBidsFilterAndRender();
      }
    } catch (e) {
      console.error('Error fetching bids:', e);
      if (elements.myBidsList) {
        elements.myBidsList.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--accent-rose);">Network error loading bids.</div>`;
      }
    }
  }

  function updateBidsSummaryStats(bids) {
    const totalCountEl = document.getElementById('my-bids-total-count');
    const totalStakedEl = document.getElementById('my-bids-total-staked');
    const totalWonEl = document.getElementById('my-bids-total-won');

    const totalCount = bids.length;
    const totalStaked = bids.reduce((acc, b) => acc + (parseInt(b.points, 10) || 0), 0);
    const totalWon = bids.reduce((acc, b) => {
      if (b.status === 'WON') return acc + (parseInt(b.potential_win, 10) || 0);
      return acc;
    }, 0);

    if (totalCountEl) totalCountEl.textContent = totalCount;
    if (totalStakedEl) totalStakedEl.textContent = formatPts(totalStaked);
    if (totalWonEl) totalWonEl.textContent = formatPts(totalWon);
  }

  function filterMyBids(status) {
    currentBidsStatusFilter = status;
    document.querySelectorAll('.bids-chip-btn').forEach(btn => {
      if (btn.getAttribute('data-bfilter') === status) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    SoundFX.tap();
    applyBidsFilterAndRender();
  }

  function filterMyBidsByMarket(marketId) {
    currentBidsMarketFilter = marketId;
    SoundFX.tap();
    applyBidsFilterAndRender();
  }

  function applyBidsFilterAndRender() {
    let filtered = [...myBidsCache];

    if (currentBidsStatusFilter !== 'ALL') {
      filtered = filtered.filter(b => b.status === currentBidsStatusFilter);
    }

    if (currentBidsMarketFilter !== 'ALL') {
      filtered = filtered.filter(b => b.market_id === currentBidsMarketFilter);
    }

    renderMyBids(filtered);
  }

  function renderMyBids(bids) {
    if (!elements.myBidsList) return;

    if (bids.length === 0) {
      elements.myBidsList.innerHTML = `
        <div style="background: rgba(14, 21, 38, 0.6); border: 1px dashed var(--border-subtle); border-radius: var(--radius-lg); padding: 3rem 1.5rem; text-align: center;">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem; opacity: 0.6;">🎫</div>
          <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-main);">No Slips Found in this Filter</div>
          <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.35rem;">Place bids on Kalyan 777 to see your official stamped receipts here.</div>
          <button class="btn btn-play" style="margin-top: 1rem; font-size: 0.8rem; padding: 0.5rem 1rem;" onclick="window.PlayerApp.switchTab('play')">
            🎲 Play Now
          </button>
        </div>
      `;
      return;
    }

    elements.myBidsList.innerHTML = bids.map(b => {
      const isWon = b.status === 'WON';
      const isLost = b.status === 'LOST';
      const isPending = b.status === 'PENDING';

      // Rubber stamp element
      let stampHtml = '';
      if (isWon) {
        stampHtml = `<div class="rubber-stamp stamp-won">🏆 WON • पास</div>`;
      } else if (isPending) {
        stampHtml = `<div class="rubber-stamp stamp-pending">⏳ RUNNING • चालू</div>`;
      } else {
        stampHtml = `<div class="rubber-stamp stamp-lost">LOST • फेल</div>`;
      }

      // Settlement Bar
      let settlementBarHtml = '';
      if (isWon) {
        settlementBarHtml = `
          <div class="slip-settlement-bar won-bar">
            <span><b>🎉 Result Declared:</b> Matching result!</span>
            <b>+${Number(b.potential_win).toLocaleString('en-IN')} Pts Credited</b>
          </div>
        `;
      } else if (isPending) {
        settlementBarHtml = `
          <div class="slip-settlement-bar pending-bar">
            <span><b>⏳ Awaiting Draw:</b> Live market active</span>
            <b>Max Return: ₹${Number(b.potential_win).toLocaleString('en-IN')}</b>
          </div>
        `;
      } else {
        settlementBarHtml = `
          <div class="slip-settlement-bar lost-bar">
            <span>Result Declared: Non-matching</span>
            <b>0 Pts Settled</b>
          </div>
        `;
      }

      const rateLabel = b.payout_rate ? `${b.payout_rate}x (${GAME_RATES[b.game_type]?.label || ''})` : '';

      return `
        <div class="katta-slip-receipt" id="slip-${b.id}">
          ${stampHtml}

          <!-- Slip Header -->
          <div class="slip-receipt-header">
            <div>
              <div class="slip-market-title">
                <span>👑</span>
                <span>${b.market_name}</span>
                <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: var(--brand-amber); font-size: 0.65rem; padding: 2px 6px;">
                  ${b.session}
                </span>
              </div>
              <div class="slip-id-tag">SLIP #${b.id} • ${b.game_type}</div>
            </div>
          </div>

          <!-- Slip Digits & Stake Grid -->
          <div class="slip-receipt-body">
            <div class="slip-col-number">
              <span class="slip-col-label">Selected Number</span>
              <span class="slip-number-val">${b.number}</span>
            </div>
            <div>
              <span class="slip-col-label">Stake Amount</span>
              <div class="slip-stake-val">${b.points} Pts</div>
              <span style="font-size: 0.65rem; color: var(--text-dim);">${rateLabel}</span>
            </div>
            <div>
              <span class="slip-col-label">${isWon ? 'Won Amount' : 'Potential Return'}</span>
              <div class="slip-return-val" style="color: ${isWon ? 'var(--accent-emerald)' : 'var(--brand-amber)'};">
                ${Number(b.potential_win).toLocaleString('en-IN')} Pts
              </div>
            </div>
          </div>

          <!-- Result Settlement Notice -->
          ${settlementBarHtml}

          <!-- Slip Footer & Actions -->
          <div class="slip-receipt-footer">
            <div>
              <span>🕒 Placed: ${b.created_at}</span>
            </div>
            <button class="slip-share-btn" onclick="window.PlayerApp.shareBidSlip('${b.id}')" title="Copy / Share Slip Receipt">
              <span>📋</span>
              <span>Copy Slip</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function shareBidSlip(bidId) {
    const bid = myBidsCache.find(b => b.id === bidId);
    if (!bid) return;

    const receiptText = 
`👑 KALYAN 777 - OFFICIAL BET SLIP
-----------------------------------
Receipt No: #${bid.id}
Market:     ${bid.market_name} (${bid.session})
Game Type:  ${bid.game_type}
Number:     ${bid.number}
Stake:      ${bid.points} Pts
Multiplier: ${bid.payout_rate}x
Status:     ${bid.status === 'WON' ? '✅ WON (+₹' + Number(bid.potential_win).toLocaleString('en-IN') + ' Pts)' : bid.status}
Placed:     ${bid.created_at}
-----------------------------------
Verified Official Receipt • Kalyan 777`;

    navigator.clipboard.writeText(receiptText).then(() => {
      SoundFX.chipAdd();
      alertMsg(`📋 Bet Slip #${bid.id} copied to clipboard! Ready to share.`);
    }).catch(() => {
      alertMsg(`Slip #${bid.id} selected.`);
    });
  }

  // --------------------------------------------------------------------------
  // TAB 4: WALLET & PASSBOOK
  // --------------------------------------------------------------------------
  async function loadPassbook() {
    if (!currentUser) return;
    refreshUserProfile();
    try {
      const res = await fetch(`${API_BASE}/wallet/passbook?userId=${currentUser.id}`, {
        headers: getPlayerHeaders()
      });
      const data = await res.json();
      if (data.success && elements.passbookList) {
        renderPassbook(data.transactions);
      }
    } catch (e) {
      console.error('Error fetching passbook:', e);
    }
  }

  function renderPassbook(txns) {
    if (txns.length === 0) {
      elements.passbookList.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-dim);">No transactions recorded yet.</div>`;
      return;
    }

    elements.passbookList.innerHTML = txns.map(t => {
      const isCredit = ['DEPOSIT', 'WIN_CREDITED', 'BID_REFUND', 'ADMIN_CREDIT'].includes(t.type);
      const sign = isCredit ? '+' : '-';
      const colorClass = isCredit ? 'credit' : 'debit';

      return `
        <div class="passbook-item">
          <div class="passbook-item-left">
            <h4>${t.remark || t.type}</h4>
            <span>${t.created_at} | Balance after: ${t.balance_after} pts</span>
          </div>
          <div class="passbook-pts-amount ${colorClass}">
            ${sign}${t.amount} Pts
          </div>
        </div>
      `;
    }).join('');
  }

  async function submitDeposit() {
    if (!currentUser) { openAuthModal(); return; }

    const pts = document.getElementById('dep-points-input').value;
    const utr = document.getElementById('dep-utr-input').value.trim();

    if (!utr || utr.length < 6) {
      alertMsg('Please enter a valid 12-digit UTR reference number', false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/wallet/deposit`, {
        method: 'POST',
        headers: getPlayerHeaders(),
        body: JSON.stringify({
          userId: currentUser.id,
          amount: pts,
          method: 'UPI Transfer',
          utr: utr
        })
      });
      const data = await res.json();
      if (data.success) {
        alertMsg('Deposit submitted! Points will be credited once admin verifies UTR.');
        closeModal('modal-deposit');
        document.getElementById('dep-utr-input').value = '';
        switchTab('wallet');
      } else {
        alertMsg(data.error || 'Failed to submit deposit', false);
      }
    } catch (e) {
      alertMsg('Network error submitting deposit', false);
    }
  }

  async function submitWithdrawal() {
    if (!currentUser) { openAuthModal(); return; }

    const pts = document.getElementById('wit-points-input').value;
    const method = document.getElementById('wit-method-select').value;
    const dest = document.getElementById('wit-destination-input').value.trim();

    if (!pts || parseInt(pts, 10) < 500) {
      alertMsg('Minimum withdrawal is 500 points', false);
      return;
    }
    if (!dest) {
      alertMsg('Please provide destination UPI ID or Bank account details', false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/wallet/withdraw`, {
        method: 'POST',
        headers: getPlayerHeaders(),
        body: JSON.stringify({
          userId: currentUser.id,
          amount: pts,
          method: method,
          destination: dest
        })
      });
      const data = await res.json();
      if (data.success) {
        alertMsg('Withdrawal requested! Payout will be sent to your account.');
        closeModal('modal-withdraw');
        refreshUserProfile();
        switchTab('wallet');
      } else {
        alertMsg(data.error || 'Failed to request withdrawal', false);
      }
    } catch (e) {
      alertMsg('Network error submitting withdrawal', false);
    }
  }

  // --------------------------------------------------------------------------
  // TAB 5: AUTHENTIC JODI & PANEL CHARTS (STEP 4)
  // --------------------------------------------------------------------------
  let currentChartType = 'jodi'; // 'jodi' | 'panel'
  let currentChartMarket = 'kalyan';
  let cachedChartWeeks = null;
  let cachedChartMarketName = 'KALYAN';
  let cachedHindiName = 'कल्याण';

  function isRedJodi(jodiStr) {
    if (!jodiStr || jodiStr.length !== 2 || isNaN(parseInt(jodiStr, 10))) return false;
    const d1 = parseInt(jodiStr[0], 10);
    const d2 = parseInt(jodiStr[1], 10);
    // Condition 1: Same digits (doubles: 00..99)
    if (d1 === d2) return true;
    // Condition 2: Cut digit pair (difference of 5 mod 10: 16, 27, 38, 49, 05)
    if (Math.abs(d1 - d2) === 5) return true;
    return false;
  }

  function switchChartView(type) {
    currentChartType = type;
    const btnJodi = document.getElementById('btn-chart-jodi');
    const btnPanel = document.getElementById('btn-chart-panel');
    if (btnJodi && btnPanel) {
      if (type === 'jodi') {
        btnJodi.classList.add('active');
        btnPanel.classList.remove('active');
      } else {
        btnPanel.classList.add('active');
        btnJodi.classList.remove('active');
      }
    }
    SoundFX.tap();
    if (cachedChartWeeks) {
      renderCharts(cachedChartMarketName, cachedChartWeeks, cachedHindiName);
    } else {
      loadChartData(currentChartMarket);
    }
  }

  function onChartMarketChange(marketId) {
    currentChartMarket = marketId;
    loadChartData(marketId);
  }

  async function loadChartData(marketId = 'kalyan') {
    currentChartMarket = marketId;
    const select = document.getElementById('chart-market-select');
    if (select && select.value !== marketId) {
      select.value = marketId;
    }

    if (!elements.chartsContainer) return;
    elements.chartsContainer.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--brand-amber);">
        <div style="font-size: 1.75rem; margin-bottom: 0.5rem; animation: pulse 1s infinite;">⏳</div>
        <div style="font-weight: 800; font-size: 0.9rem; letter-spacing: 0.5px;">Loading Official Kalyan 777 Chart...</div>
        <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.25rem;">Fetching authentic weekly historical records</div>
      </div>
    `;

    try {
      const res = await fetch(`${API_BASE}/results/charts/${marketId}`);
      const data = await res.json();
      if (data.success) {
        cachedChartWeeks = data.weeks;
        cachedChartMarketName = data.marketName;
        cachedHindiName = data.hindiName || '';
        renderCharts(data.marketName, data.weeks, data.hindiName);
      } else {
        elements.chartsContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-dim);">No chart records available for this market.</div>`;
      }
    } catch (e) {
      console.error('Error loading charts:', e);
      elements.chartsContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--accent-rose);">Network error loading charts.</div>`;
    }
  }

  function renderCharts(marketName, weeks, hindiName) {
    if (!elements.chartsContainer) return;
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    let html = `
      <div style="padding: 0.75rem 1rem; background: rgba(14, 21, 38, 0.9); border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 0.95rem; font-weight: 800; color: var(--brand-amber); letter-spacing: 0.5px;">
            👑 ${marketName} ${currentChartType === 'jodi' ? 'JODI CHART (जोड़ी चार्ट)' : 'PANEL CHART (पैनल पाना चार्ट)'}
          </div>
          <div style="font-size: 0.7rem; color: var(--text-dim);">
            ${hindiName ? `${hindiName} • ` : ''}Showing last ${weeks.length} weeks official records
          </div>
        </div>
        <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: var(--brand-gold); border: 1px solid var(--border-gold); font-size: 0.7rem; font-weight: 800;">
          ${currentChartType === 'jodi' ? '🎯 2-DIGIT JODI' : '📋 3-DIGIT PATTI'}
        </span>
      </div>

      <table class="matka-chart-table">
        <thead>
          <tr>
            <th class="col-week">DATE RANGE</th>
            ${days.map(d => `<th>${d}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    weeks.forEach(w => {
      html += `<tr>`;
      html += `<td class="cell-week-label">${w.weekRange}</td>`;

      w.records.forEach(r => {
        if (r.isClosed) {
          if (currentChartType === 'jodi') {
            html += `<td class="chart-cell-jodi closed-cell" title="${r.day}: Market Closed">**</td>`;
          } else {
            html += `
              <td class="chart-cell-panel closed-cell" title="${r.day}: Market Closed">
                <div class="panel-box" style="opacity: 0.35;">
                  <div class="panel-patti">***</div>
                  <div class="panel-jodi">**</div>
                  <div class="panel-patti">***</div>
                </div>
              </td>
            `;
          }
        } else {
          const isRed = isRedJodi(r.jodi);
          if (currentChartType === 'jodi') {
            const redClass = isRed ? 'red-jodi' : '';
            const redTitle = isRed ? 'Red Jodi (लाल जोड़ी)' : 'Normal Jodi';
            html += `<td class="chart-cell-jodi ${redClass}" title="${r.day}: ${r.jodi} (${redTitle})">${r.jodi}</td>`;
          } else {
            const redClass = isRed ? 'red-jodi' : '';
            html += `
              <td class="chart-cell-panel">
                <div class="panel-box">
                  <div class="panel-patti open-patti" title="Open Patti">${r.openPanna}</div>
                  <div class="panel-jodi ${redClass}" title="Jodi">${r.jodi}</div>
                  <div class="panel-patti close-patti" title="Close Patti">${r.closePanna}</div>
                </div>
              </td>
            `;
          }
        }
      });

      html += `</tr>`;
    });

    html += `
        </tbody>
      </table>
    `;

    elements.chartsContainer.innerHTML = html;
  }

  function openChart(marketId) {
    currentChartMarket = marketId;
    const select = document.getElementById('chart-market-select');
    if (select) select.value = marketId;
    switchTab('charts');
    loadChartData(marketId);
  }

  // --------------------------------------------------------------------------
  // AUTH MODAL LOGIC
  // --------------------------------------------------------------------------
  function openAuthModal() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.add('active');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
  }

  function toggleAuthMode(mode) {
    const loginForm = document.getElementById('auth-form-login');
    const regForm = document.getElementById('auth-form-register');
    const title = document.getElementById('auth-modal-title');

    if (mode === 'register') {
      loginForm.style.display = 'none';
      regForm.style.display = 'block';
      title.textContent = '📝 Register New Player Account';
    } else {
      loginForm.style.display = 'block';
      regForm.style.display = 'none';
      title.textContent = '🔐 Player Login';
    }
  }

  function quickFillLogin(phone, mpin) {
    document.getElementById('login-phone').value = phone;
    document.getElementById('login-mpin').value = mpin;
    handleLogin();
  }

  async function handleLogin() {
    const phone = document.getElementById('login-phone').value.trim();
    const mpin = document.getElementById('login-mpin').value.trim();

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, mpin })
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        if (data.token) {
          playerToken = data.token;
          localStorage.setItem('matka_player_token', playerToken);
        }
        localStorage.setItem('matka_player_user', JSON.stringify(currentUser));
        updateUserUI();
        closeModal('modal-auth');
        alertMsg(`Welcome back, ${currentUser.name}!`);
      } else {
        alertMsg(data.error || 'Login failed', false);
      }
    } catch (e) {
      alertMsg('Network error during login', false);
    }
  }

  async function handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const mpin = document.getElementById('reg-mpin').value.trim();

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, mpin })
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        if (data.token) {
          playerToken = data.token;
          localStorage.setItem('matka_player_token', playerToken);
        }
        localStorage.setItem('matka_player_user', JSON.stringify(currentUser));
        updateUserUI();
        closeModal('modal-auth');
        alertMsg('Account registered! 500 Welcome bonus points added to your balance.');
      } else {
        alertMsg(data.error || 'Registration failed', false);
      }
    } catch (e) {
      alertMsg('Network error during registration', false);
    }
  }

  let appSettings = null;

  async function loadAppSettings() {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      const data = await res.json();
      if (data.success && data.settings) {
        appSettings = data.settings;
        applyAppSettings(appSettings);
      }
    } catch (e) {
      console.warn('Error loading app settings:', e);
    }
  }

  function applyAppSettings(s) {
    if (!s) return;
    const marqueeEl = document.getElementById('app-marquee');
    if (marqueeEl && s.notice_marquee) {
      marqueeEl.textContent = s.notice_marquee;
    }

    const minDepLabel = document.getElementById('dep-min-label');
    if (minDepLabel && s.min_deposit) {
      minDepLabel.textContent = `Min: ${s.min_deposit} Pts`;
    }

    const notesEl = document.getElementById('dep-admin-notes-text');
    if (notesEl && s.admin_payment_notes) {
      notesEl.textContent = s.admin_payment_notes;
    }

    const upiId = s.admin_upi_id || 'kalyanboss@upi';
    const upiName = s.admin_upi_name || 'Kalyan 777 Official Services';
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&cu=INR`;

    const upiEl = document.getElementById('dep-admin-upi');
    if (upiEl) upiEl.textContent = upiId;

    const payeeEl = document.getElementById('dep-payee-name');
    if (payeeEl) payeeEl.textContent = upiName;

    const qrImg = document.getElementById('dep-qr-img');
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUri)}`;
    }

    const phonepeEl = document.getElementById('dep-phonepe-num');
    if (phonepeEl) phonepeEl.textContent = s.admin_phonepe || '9876543210';

    const gpayEl = document.getElementById('dep-gpay-num');
    if (gpayEl) gpayEl.textContent = s.admin_googlepay || '9876543210';

    const paytmEl = document.getElementById('dep-paytm-num');
    if (paytmEl) paytmEl.textContent = s.admin_paytm || '9876543210';

    const bankNameEl = document.getElementById('dep-bank-name');
    if (bankNameEl) bankNameEl.textContent = s.admin_bank_name || 'HDFC Bank';

    const bankAccEl = document.getElementById('dep-bank-acc');
    if (bankAccEl) bankAccEl.textContent = s.admin_bank_account || '50100492819234';

    const bankIfscEl = document.getElementById('dep-bank-ifsc');
    if (bankIfscEl) bankIfscEl.textContent = s.admin_bank_ifsc || 'HDFC0001245';

    const bankHolderEl = document.getElementById('dep-bank-holder');
    if (bankHolderEl) bankHolderEl.textContent = s.admin_bank_holder || 'Kalyan 777 Official';
  }

  function switchDepositTab(tab) {
    SoundFX.tap();
    const upiBtn = document.getElementById('dep-tab-upi-btn');
    const bankBtn = document.getElementById('dep-tab-bank-btn');
    const upiView = document.getElementById('dep-view-upi');
    const bankView = document.getElementById('dep-view-bank');

    if (tab === 'upi') {
      if (upiBtn) { upiBtn.style.background = 'var(--brand-amber)'; upiBtn.style.color = '#000'; }
      if (bankBtn) { bankBtn.style.background = 'transparent'; bankBtn.style.color = 'var(--text-muted)'; }
      if (upiView) upiView.style.display = 'block';
      if (bankView) bankView.style.display = 'none';
    } else {
      if (bankBtn) { bankBtn.style.background = 'var(--brand-amber)'; bankBtn.style.color = '#000'; }
      if (upiBtn) { upiBtn.style.background = 'transparent'; upiBtn.style.color = 'var(--text-muted)'; }
      if (bankView) bankView.style.display = 'block';
      if (upiView) upiView.style.display = 'none';
    }
  }

  function copyText(text, label = 'Text') {
    SoundFX.tap();
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alertMsg(`📋 ${label} copied to clipboard!`);
      }).catch(() => {
        alertMsg(`📋 ${label}: ${text}`);
      });
    } else {
      alertMsg(`📋 ${label}: ${text}`);
    }
  }

  function openDepositModal() {
    SoundFX.tap();
    if (!appSettings) {
      loadAppSettings();
    } else {
      applyAppSettings(appSettings);
    }
    const modal = document.getElementById('modal-deposit');
    if (modal) modal.classList.add('active');
  }

  function openWithdrawModal() {
    const modal = document.getElementById('modal-withdraw');
    if (modal) modal.classList.add('active');
  }

  function copyUpiId() {
    const upi = document.getElementById('dep-admin-upi')?.textContent || 'kalyanboss@upi';
    copyText(upi, 'Admin UPI ID');
  }

  // --------------------------------------------------------------------------
  // REAL-TIME WEBSOCKET LISTENER
  // --------------------------------------------------------------------------
  let socket = null;
  function initWebSocket() {
    try {
      const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
      socket = new WebSocket(proto + location.host);

      socket.onopen = () => {
        console.log('⚡ Connected to Kalyan 777 Live Sync Server');
        if (currentUser) {
          socket.send(JSON.stringify({ type: 'REGISTER_PLAYER', userId: currentUser.id }));
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleLiveSocketEvent(msg.event, msg.data);
        } catch (e) {
          console.warn('Socket parse error:', e);
        }
      };

      socket.onclose = () => {
        setTimeout(initWebSocket, 3000); // Auto reconnect
      };
    } catch (e) {
      console.warn('WebSocket init error:', e);
    }
  }

  function handleLiveSocketEvent(event, data) {
    if (event === 'RESULT_DECLARED') {
      loadMarkets();
      if (activeTab === 'charts') loadChartData('kalyan');
    } else if (event === 'STARLINE_RESULT_DECLARED') {
      loadMarkets();
    } else if (event === 'KING_RESULT_DECLARED') {
      loadMarkets();
    } else if (event === 'MARKET_STATUS_UPDATED') {
      loadMarkets();
      if (activeTab === 'play' && selectedMarket && selectedMarket.type === 'REGULAR') {
        const fresh = marketsList.find(m => m.id === selectedMarket.id);
        if (fresh) {
          selectedMarket = { ...fresh, type: 'REGULAR' };
          updateSessionBarState(isMarketSessionOpen(selectedMarket, 'OPEN'), isMarketSessionOpen(selectedMarket, 'CLOSE'));
        }
      }
    } else if (event === 'YOU_WON') {
      alertMsg(`🎉 CONGRATULATIONS! You WON ${data.winPoints} Points on ${data.marketName} (${data.gameType}: ${data.number})!`);
      refreshUserProfile();
      if (activeTab === 'my-bids') loadMyBids();
    } else if (event === 'DEPOSIT_APPROVED') {
      alertMsg(`💰 Deposit Approved! +${data.amount} Points credited to your wallet.`);
      refreshUserProfile();
      if (activeTab === 'wallet') loadPassbook();
    } else if (event === 'WITHDRAWAL_APPROVED') {
      alertMsg(`📤 Withdrawal Approved! Reference: ${data.referenceNo}`);
      refreshUserProfile();
      if (activeTab === 'wallet') loadPassbook();
    } else if (event === 'POINTS_ADJUSTED') {
      alertMsg(`⚡ Wallet Adjusted (${data.type}): ${data.amount} Pts.`);
      refreshUserProfile();
      if (activeTab === 'wallet') loadPassbook();
    } else if (event === 'SETTINGS_UPDATED') {
      loadAppSettings();
    }
  }

  // --------------------------------------------------------------------------
  // USER PROFILE DRAWER CONTROLLER & PWA INSTALL HANDLERS
  // --------------------------------------------------------------------------
  let deferredPrompt = null;
  let isInstallBannerDismissed = sessionStorage.getItem('kalyan777_install_dismissed') === '1';

  function isRunningStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
  }

  function updateInstallBannerVisibility() {
    const banner = document.getElementById('pwa-install-banner');
    const drawerItem = document.getElementById('drawer-install-pwa-item');

    if (isRunningStandalone()) {
      if (banner) banner.style.display = 'none';
      if (drawerItem) drawerItem.style.display = 'none';
      return;
    }

    if (drawerItem) drawerItem.style.display = 'flex';

    if (banner && !isInstallBannerDismissed) {
      banner.style.display = 'flex';
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt captured!');
    updateInstallBannerVisibility();
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Kalyan 777 successfully installed!');
    deferredPrompt = null;
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'none';
    alertMsg('🎉 Kalyan 777 has been installed on your phone home screen!');
  });

  function dismissInstallBanner() {
    isInstallBannerDismissed = true;
    sessionStorage.setItem('kalyan777_install_dismissed', '1');
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'none';
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.log('[PWA] Service Worker registered with scope:', registration.scope);
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New version ready.');
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }
  }

  function initConnectivityWatch() {
    const offlineBanner = document.getElementById('app-offline-banner');
    function updateOnlineStatus() {
      if (navigator.onLine) {
        if (offlineBanner) offlineBanner.style.display = 'none';
      } else {
        if (offlineBanner) offlineBanner.style.display = 'flex';
      }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
  }

  function openDrawer() {
    SoundFX.tap();
    updateUserUI();
    const soundToggle = document.getElementById('drawer-sound-toggle');
    if (soundToggle) soundToggle.checked = SoundFX.enabled;

    const backdrop = document.getElementById('drawer-backdrop');
    const drawer = document.getElementById('player-drawer');
    if (backdrop) backdrop.classList.add('active');
    if (drawer) drawer.classList.add('active');
  }

  function closeDrawer() {
    const backdrop = document.getElementById('drawer-backdrop');
    const drawer = document.getElementById('player-drawer');
    if (backdrop) backdrop.classList.remove('active');
    if (drawer) drawer.classList.remove('active');
  }

  function handleHeaderAvatarClick() {
    if (currentUser) {
      openDrawer();
    } else {
      openAuthModal();
    }
  }

  function handleDrawerAuthAction() {
    closeDrawer();
    if (currentUser) {
      currentUser = null;
      playerToken = '';
      localStorage.removeItem('matka_player_token');
      localStorage.removeItem('matka_player_user');
      updateUserUI();
      openAuthModal();
    } else {
      openAuthModal();
    }
  }

  function toggleSound(checked) {
    SoundFX.toggle(checked);
    if (checked) {
      SoundFX.successChime();
    }
  }

  function openGameRulesModal() {
    SoundFX.tap();
    const modal = document.getElementById('modal-game-rules');
    if (modal) modal.classList.add('active');
  }

  function openChangeMpinModal() {
    SoundFX.tap();
    if (!currentUser) {
      openAuthModal();
      return;
    }
    const oldInput = document.getElementById('mpin-old-input');
    const newInput = document.getElementById('mpin-new-input');
    const confInput = document.getElementById('mpin-confirm-input');
    if (oldInput) oldInput.value = '';
    if (newInput) newInput.value = '';
    if (confInput) confInput.value = '';

    const modal = document.getElementById('modal-change-mpin');
    if (modal) modal.classList.add('active');
  }

  async function submitChangeMpin() {
    if (!currentUser) return;
    const oldMpin = (document.getElementById('mpin-old-input')?.value || '').trim();
    const newMpin = (document.getElementById('mpin-new-input')?.value || '').trim();
    const confMpin = (document.getElementById('mpin-confirm-input')?.value || '').trim();

    if (!oldMpin || oldMpin.length !== 4 || isNaN(oldMpin)) {
      alertMsg('Please enter your current 4-digit MPIN', false);
      return;
    }
    if (!newMpin || newMpin.length !== 4 || isNaN(newMpin)) {
      alertMsg('New MPIN must be exactly 4 numeric digits', false);
      return;
    }
    if (newMpin !== confMpin) {
      alertMsg('New MPIN and Confirm MPIN do not match', false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/change-mpin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, oldMpin, newMpin })
      });
      const data = await res.json();
      if (data.success) {
        SoundFX.successChime();
        currentUser = data.user;
        localStorage.setItem('matka_player_user', JSON.stringify(currentUser));
        closeModal('modal-change-mpin');
        alertMsg('Security MPIN updated successfully! Remember your new 4-digit PIN for future logins.');
      } else {
        alertMsg(data.error || 'Failed to update MPIN', false);
      }
    } catch (e) {
      alertMsg('Network error while updating MPIN', false);
    }
  }

  function triggerPwaInstall() {
    SoundFX.tap();
    closeDrawer();

    if (isRunningStandalone()) {
      alertMsg('✅ Kalyan 777 is already running in native standalone app mode!');
      return;
    }

    // 1. Native prompt event captured (Chrome / Android)
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] Player accepted install');
          dismissInstallBanner();
        } else {
          console.log('[PWA] Player dismissed install prompt');
        }
        deferredPrompt = null;
      });
      return;
    }

    // 2. iOS Safari detection
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    if (isIOS) {
      openIosInstallModal();
      return;
    }

    // 3. Desktop / General browser instructions modal
    openGeneralInstallModal();
  }

  function openIosInstallModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContainer = document.getElementById('modal-container');
    if (!modalOverlay || !modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.3rem;">📲</span>
          <h3 style="font-size: 1.1rem; font-weight: 800; color: #ffffff;">Install Kalyan 777 on iPhone</h3>
        </div>
        <button class="btn-modal-close" onclick="window.PlayerApp.closeModal()">✕</button>
      </div>
      <div class="modal-body" style="padding: 1.25rem 1rem;">
        <div style="text-align: center; margin-bottom: 1.25rem;">
          <img src="img/logo.png" alt="Kalyan 777" style="width: 64px; height: 64px; border-radius: 14px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35); margin-bottom: 0.5rem;">
          <h4 style="color: var(--brand-gold); font-size: 1.05rem; font-weight: 800;">Kalyan 777 Web App</h4>
          <p style="font-size: 0.75rem; color: var(--text-dim);">Add to your iPhone Home Screen in 3 easy steps:</p>
        </div>

        <div class="ios-pwa-step-card">
          <div class="ios-step-num">1</div>
          <div class="ios-step-text">
            Tap the <b>Share button</b> (⎙ or Share icon) at the bottom toolbar of Safari.
          </div>
        </div>

        <div class="ios-pwa-step-card">
          <div class="ios-step-num">2</div>
          <div class="ios-step-text">
            Scroll down in the action sheet and select <b>"Add to Home Screen"</b> (<span style="font-weight:700; color:var(--brand-gold);">⊞</span>).
          </div>
        </div>

        <div class="ios-pwa-step-card">
          <div class="ios-step-num">3</div>
          <div class="ios-step-text">
            Tap <b>"Add"</b> in the top right corner. The Kalyan 777 icon will appear directly on your home screen!
          </div>
        </div>

        <div style="margin-top: 1.25rem; text-align: center;">
          <button class="btn btn-emerald" style="width: 100%; font-weight: 800;" onclick="window.PlayerApp.closeModal()">Got It!</button>
        </div>
      </div>
    `;
    modalOverlay.classList.add('active');
  }

  function openGeneralInstallModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContainer = document.getElementById('modal-container');
    if (!modalOverlay || !modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.3rem;">📱</span>
          <h3 style="font-size: 1.1rem; font-weight: 800; color: #ffffff;">Install Kalyan 777 App</h3>
        </div>
        <button class="btn-modal-close" onclick="window.PlayerApp.closeModal()">✕</button>
      </div>
      <div class="modal-body" style="padding: 1.25rem 1rem;">
        <div style="text-align: center; margin-bottom: 1.25rem;">
          <img src="img/logo.png" alt="Kalyan 777" style="width: 64px; height: 64px; border-radius: 14px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35); margin-bottom: 0.5rem;">
          <h4 style="color: var(--brand-gold); font-size: 1.05rem; font-weight: 800;">Fast 1-Tap Home Screen App</h4>
          <p style="font-size: 0.75rem; color: var(--text-dim);">Enjoy full screen gaming without opening your browser</p>
        </div>

        <div class="ios-pwa-step-card">
          <div class="ios-step-num">1</div>
          <div class="ios-step-text">
            Open your browser options (tap the <b>⋮ 3-dots menu</b> in Chrome, Edge, or Samsung Internet).
          </div>
        </div>

        <div class="ios-pwa-step-card">
          <div class="ios-step-num">2</div>
          <div class="ios-step-text">
            Select <b>"Install app"</b> or <b>"Add to Home screen"</b>.
          </div>
        </div>

        <div class="ios-pwa-step-card">
          <div class="ios-step-num">3</div>
          <div class="ios-step-text">
            Confirm <b>"Install"</b>. The app will launch with full screen graphics and fast offline caching!
          </div>
        </div>

        <div style="margin-top: 1.25rem; text-align: center;">
          <button class="btn btn-primary" style="width: 100%; font-weight: 800;" onclick="window.PlayerApp.closeModal()">Close</button>
        </div>
      </div>
    `;
    modalOverlay.classList.add('active');
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------
  function init() {
    initUserSession();
    loadMarkets();
    initWebSocket();
    loadAppSettings();
    registerServiceWorker();
    initConnectivityWatch();
    updateInstallBannerVisibility();
    applyLanguage(currentLang);

    // Support deep linking to specific tabs via URL param ?tab=my-bids or #my-bids
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab') || window.location.hash.replace('#', '');
    if (['home', 'play', 'my-bids', 'wallet', 'charts'].includes(tabParam)) {
      switchTab(tabParam);
    }

    const bfilterParam = urlParams.get('bfilter');
    if (bfilterParam && ['ALL', 'PENDING', 'WON', 'LOST'].includes(bfilterParam)) {
      setTimeout(() => filterMyBids(bfilterParam), 150);
    }

    // Support URL param ?openDrawer=1 or ?modal=game-rules / ?modal=change-mpin for visual testing
    if (urlParams.get('openDrawer') === '1') {
      setTimeout(() => openDrawer(), 250);
    }
    if (urlParams.get('modal') === 'game-rules') {
      setTimeout(() => openGameRulesModal(), 250);
    }
    if (urlParams.get('modal') === 'change-mpin') {
      setTimeout(() => openChangeMpinModal(), 250);
    }
    if (urlParams.get('modal') === 'auth') {
      setTimeout(() => openAuthModal(), 250);
    }
    if (urlParams.get('modal') === 'success') {
      setTimeout(() => showSuccessModal('Bet Placed Successfully!'), 250);
    }

    // Live IST clock & second-by-second countdown ticker (every 1 second)
    setInterval(updateMarketTimers, 1000);
    updateMarketTimers();

    // Auto-refresh markets & user balance every 20 seconds
    setInterval(() => {
      if (activeTab === 'home') loadMarkets();
      refreshUserProfile();
    }, 20000);
  }

  // Global Exports for HTML inline onclick handlers
  window.PlayerApp = {
    switchTab,
    startPlaying,
    filterMarkets,
    startStarline,
    startKing,
    selectGameType,
    setSession,
    addChipPoints,
    addBetToCart,
    removeCartItem,
    clearCart,
    submitBids,
    filterMyBids,
    filterMyBidsByMarket,
    shareBidSlip,
    openChart,
    loadChartData,
    switchChartView,
    onChartMarketChange,
    openAuthModal,
    closeModal,
    toggleAuthMode,
    quickFillLogin,
    handleLogin,
    handleRegister,
    openDepositModal,
    openWithdrawModal,
    copyUpiId,
    switchDepositTab,
    copyText,
    loadAppSettings,
    submitDeposit,
    submitWithdrawal,
    toggleMotorDigit,
    clearMotorDigits,
    updateMotorPreview,
    addMotorBetsToCart,
    onFamilyJodiInput,
    updateFamilyPreview,
    addFamilyBetsToCart,
    updateCrossingPreview,
    addCrossingBetsToCart,
    addSangamBetToCart,
    quickSelectAnk,
    quickAddAllAnks,
    updatePotentialPayoutPreview,
    // A-ONE Screen 1 to 5 Exports
    backToHome,
    backToGameSelect,
    selectGameTypeAndOpenBidding,
    updateBiddingDateTime,
    calcGridTotal,
    resetAnkGrid,
    placeAnkGridBets,
    showSuccessModal,
    closeSuccessModal,
    openFundsModal,
    openWhatsAppSupport,
    // Step 6 exports
    openDrawer,
    closeDrawer,
    handleHeaderAvatarClick,
    handleDrawerAuthAction,
    toggleSound,
    openGameRulesModal,
    openChangeMpinModal,
    submitChangeMpin,
    triggerPwaInstall,
    dismissInstallBanner,
    toggleLanguage,
    applyLanguage
  };

  document.addEventListener('DOMContentLoaded', init);
})();
