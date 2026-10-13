/**
 * Persistent File-Backed Database Engine with Atomic File Writes
 * Manages tables for Users, Transactions, Markets, Bids, Deposits, Withdrawals, Rates & Settings
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'database.json');

// Initial seed data if database is fresh
const INITIAL_SEED = {
  users: [
    {
      id: 'USR101',
      phone: '9820145890',
      name: 'Ramesh Patel',
      mpin: '1234',
      wallet_balance: 14500,
      total_bids: 128,
      total_won: 68400,
      status: 'ACTIVE',
      bank_account: '50100239481',
      ifsc: 'HDFC0001245',
      bank_name: 'HDFC Bank',
      upi_id: 'ramesh.patel@okhdfcbank',
      created_at: '2026-08-12 10:00:00'
    },
    {
      id: 'USR102',
      phone: '9871234901',
      name: 'Vijay Verma',
      mpin: '1234',
      wallet_balance: 5200,
      total_bids: 74,
      total_won: 29800,
      status: 'ACTIVE',
      bank_account: '32098412891',
      ifsc: 'SBIN0004510',
      bank_name: 'State Bank of India',
      upi_id: 'vijayverma@paytm',
      created_at: '2026-09-01 11:30:00'
    },
    {
      id: 'USR103',
      phone: '9920884120',
      name: 'Deepak Sharma',
      mpin: '1234',
      wallet_balance: 10000,
      total_bids: 215,
      total_won: 142000,
      status: 'ACTIVE',
      bank_account: '0891248102',
      ifsc: 'ICIC0009812',
      bank_name: 'ICICI Bank',
      upi_id: 'deepak.sharma@apl',
      created_at: '2026-07-15 09:15:00'
    }
  ],

  markets: [
    {
      id: 'kalyan',
      name: 'KALYAN',
      hindi_name: 'कल्याण',
      open_time: '16:15',
      close_time: '18:15',
      open_panna: '128',
      close_panna: '',
      open_ank: '1',
      close_ank: '',
      status: 'RUNNING',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      active: true
    },
    {
      id: 'milan_day',
      name: 'MILAN DAY',
      hindi_name: 'मिलन डे',
      open_time: '15:00',
      close_time: '17:00',
      open_panna: '358',
      close_panna: '390',
      open_ank: '6',
      close_ank: '2',
      status: 'CLOSED',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      active: true
    },
    {
      id: 'milan_night',
      name: 'MILAN NIGHT',
      hindi_name: 'मिलन नाईट',
      open_time: '21:00',
      close_time: '23:00',
      open_panna: '',
      close_panna: '',
      open_ank: '',
      close_ank: '',
      status: 'UPCOMING',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      active: true
    },
    {
      id: 'rajdhani_day',
      name: 'RAJDHANI DAY',
      hindi_name: 'राजधानी डे',
      open_time: '15:25',
      close_time: '17:25',
      open_panna: '247',
      close_panna: '',
      open_ank: '3',
      close_ank: '',
      status: 'RUNNING',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      active: true
    },
    {
      id: 'rajdhani_night',
      name: 'RAJDHANI NIGHT',
      hindi_name: 'राजधानी नाईट',
      open_time: '21:35',
      close_time: '23:35',
      open_panna: '',
      close_panna: '',
      open_ank: '',
      close_ank: '',
      status: 'UPCOMING',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      active: true
    },
    {
      id: 'time_bazar',
      name: 'TIME BAZAR',
      hindi_name: 'टाइम बाजार',
      open_time: '13:00',
      close_time: '14:00',
      open_panna: '246',
      close_panna: '189',
      open_ank: '2',
      close_ank: '8',
      status: 'CLOSED',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      active: true
    },
    {
      id: 'main_bazar',
      name: 'MAIN BAZAR',
      hindi_name: 'मेन बाजार',
      open_time: '21:40',
      close_time: '00:05',
      open_panna: '',
      close_panna: '',
      open_ank: '',
      close_ank: '',
      status: 'UPCOMING',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      active: true
    },
    {
      id: 'sridevi',
      name: 'SRIDEVI',
      hindi_name: 'श्रीदेवी',
      open_time: '11:35',
      close_time: '12:35',
      open_panna: '137',
      close_panna: '469',
      open_ank: '1',
      close_ank: '9',
      status: 'CLOSED',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      active: true
    }
  ],

  starlineMarkets: [
    { id: 'st_10am', name: '10:00 AM', open_time: '10:00', result: '148-3', status: 'CLOSED' },
    { id: 'st_11am', name: '11:00 AM', open_time: '11:00', result: '249-5', status: 'CLOSED' },
    { id: 'st_12pm', name: '12:00 PM', open_time: '12:00', result: '378-8', status: 'CLOSED' },
    { id: 'st_01pm', name: '01:00 PM', open_time: '13:00', result: '112-4', status: 'CLOSED' },
    { id: 'st_02pm', name: '02:00 PM', open_time: '14:00', result: '567-8', status: 'CLOSED' },
    { id: 'st_03pm', name: '03:00 PM', open_time: '15:00', result: '235-0', status: 'CLOSED' },
    { id: 'st_04pm', name: '04:00 PM', open_time: '16:00', result: '***-*', status: 'RUNNING' },
    { id: 'st_05pm', name: '05:00 PM', open_time: '17:00', result: '***-*', status: 'UPCOMING' }
  ],

  kingMarkets: [
    { id: 'disawar', name: 'DISAWAR', open_time: '05:00', result: '74', status: 'CLOSED' },
    { id: 'faridabad', name: 'FARIDABAD', open_time: '18:15', result: '83', status: 'CLOSED' },
    { id: 'ghaziabad', name: 'GHAZIABAD', open_time: '20:30', result: '**', status: 'UPCOMING' },
    { id: 'gali', name: 'GALI', open_time: '23:05', result: '**', status: 'UPCOMING' }
  ],

  bids: [
    {
      id: 'BID-9841',
      user_id: 'USR101',
      user_name: 'Ramesh Patel',
      market_id: 'kalyan',
      market_name: 'KALYAN',
      game_type: 'Single Digit',
      session: 'OPEN',
      number: '1',
      points: 500,
      potential_win: 4750,
      payout_rate: 9.5,
      status: 'WON',
      created_at: '2026-10-09 15:45:00'
    },
    {
      id: 'BID-9842',
      user_id: 'USR101',
      user_name: 'Ramesh Patel',
      market_id: 'kalyan',
      market_name: 'KALYAN',
      game_type: 'Single Patti',
      session: 'OPEN',
      number: '128',
      points: 200,
      potential_win: 28000,
      payout_rate: 140,
      status: 'WON',
      created_at: '2026-10-09 15:50:00'
    },
    {
      id: 'BID-9843',
      user_id: 'USR103',
      user_name: 'Deepak Sharma',
      market_id: 'kalyan',
      market_name: 'KALYAN',
      game_type: 'Jodi',
      session: 'FULL',
      number: '14',
      points: 1000,
      potential_win: 95000,
      payout_rate: 95,
      status: 'PENDING',
      created_at: '2026-10-09 16:02:00'
    },
    {
      id: 'BID-9844',
      user_id: 'USR102',
      user_name: 'Vijay Verma',
      market_id: 'kalyan',
      market_name: 'KALYAN',
      game_type: 'Single Digit',
      session: 'CLOSE',
      number: '4',
      points: 800,
      potential_win: 7600,
      payout_rate: 9.5,
      status: 'PENDING',
      created_at: '2026-10-09 16:10:00'
    }
  ],

  transactions: [
    {
      id: 'TXN-1001',
      user_id: 'USR101',
      type: 'DEPOSIT',
      amount: 10000,
      balance_before: 0,
      balance_after: 10000,
      reference_id: 'DEP-401',
      remark: 'UPI Deposit approved (UTR: 428910294812)',
      created_at: '2026-10-09 10:00:00'
    },
    {
      id: 'TXN-1002',
      user_id: 'USR101',
      type: 'BID_PLACED',
      amount: 700,
      balance_before: 10000,
      balance_after: 9300,
      reference_id: 'BID-9841',
      remark: 'Placed bets on Kalyan Open',
      created_at: '2026-10-09 15:45:00'
    },
    {
      id: 'TXN-1003',
      user_id: 'USR101',
      type: 'WIN_CREDITED',
      amount: 32750,
      balance_before: 9300,
      balance_after: 42050,
      reference_id: 'KALYAN-OPEN-128',
      remark: 'Winning credited for Kalyan Open (128-1)',
      created_at: '2026-10-09 16:16:00'
    }
  ],

  deposits: [
    {
      id: 'DEP-401',
      user_id: 'USR101',
      user_name: 'Ramesh Patel',
      amount: 10000,
      method: 'PhonePe UPI',
      utr: '428910294812',
      status: 'APPROVED',
      requested_at: '2026-10-09 09:50:00',
      approved_at: '2026-10-09 10:00:00'
    },
    {
      id: 'DEP-402',
      user_id: 'USR102',
      user_name: 'Vijay Verma',
      amount: 5000,
      method: 'Google Pay',
      utr: '428909182341',
      status: 'PENDING',
      requested_at: '2026-10-09 12:20:00'
    }
  ],

  withdrawals: [
    {
      id: 'WIT-701',
      user_id: 'USR101',
      user_name: 'Ramesh Patel',
      amount: 8000,
      method: 'Bank Transfer (IMPS)',
      destination: 'HDFC Bank - A/C 50100239481',
      status: 'PENDING',
      requested_at: '2026-10-09 12:28:00'
    }
  ],

  gameRates: [
    { id: 'single_digit', name: 'Single Digit (Ank)', min_bid: 10, max_bid: 25000, rate: 9.5, label: '10 ka 95' },
    { id: 'jodi_digit', name: 'Jodi Digit', min_bid: 10, max_bid: 15000, rate: 95.0, label: '10 ka 950' },
    { id: 'single_panna', name: 'Single Panna (SP)', min_bid: 10, max_bid: 10000, rate: 140.0, label: '10 ka 1400' },
    { id: 'double_panna', name: 'Double Panna (DP)', min_bid: 10, max_bid: 5000, rate: 280.0, label: '10 ka 2800' },
    { id: 'triple_panna', name: 'Triple Panna (TP)', min_bid: 10, max_bid: 2000, rate: 700.0, label: '10 ka 7000' },
    { id: 'half_sangam', name: 'Half Sangam', min_bid: 10, max_bid: 2000, rate: 1000.0, label: '10 ka 10,000' },
    { id: 'full_sangam', name: 'Full Sangam', min_bid: 10, max_bid: 1000, rate: 10000.0, label: '10 ka 1,00,000' }
  ],

  settings: {
    notice_marquee: '⚡ Welcome to Kalyan 777 Online! Play all official bazaars with fast automatic points settlement. Minimum deposit: 100 pts.',
    whatsapp_support: '+91 98765 43210',
    telegram_channel: 'https://t.me/kalyan_official_matka',
    admin_upi_id: 'kalyanboss@upi',
    admin_upi_name: 'Kalyan 777 Official Services',
    admin_phonepe: '9876543210',
    admin_googlepay: '9876543210',
    admin_paytm: '9876543210',
    admin_bank_name: 'HDFC Bank',
    admin_bank_account: '50100492819234',
    admin_bank_ifsc: 'HDFC0001245',
    admin_bank_holder: 'Kalyan Entertainment PVT LTD',
    admin_payment_notes: 'Pay on any UPI or Bank app and enter your 12-digit UTR number below for instant points credit.',
    min_deposit: 100,
    max_deposit: 100000,
    min_withdrawal: 500,
    max_withdrawal: 200000,
    withdrawals_open_time: '08:00',
    withdrawals_close_time: '22:00',
    is_betting_active: true,
    maintenance_mode: false
  },

  resultLogs: [
    {
      id: 'LOG-301',
      market_name: 'KALYAN',
      session: 'OPEN',
      panna: '128',
      ank: '1',
      declared_by: 'Super Admin',
      time: '2026-10-09 16:16:00',
      winners_count: 2,
      total_payout: 32750
    }
  ],

  agents: [
    {
      id: 'AGT101',
      name: 'Kishore Bhai (Khaiwal)',
      phone: '9876543210',
      mpin: '5566',
      role: 'AGENT',
      master_id: null,
      credit_limit: 50000,
      wallet_balance: 30000,
      commission_rate: 5.0,
      status: 'ACTIVE',
      created_at: '2026-10-10 10:00:00'
    },
    {
      id: 'AGT102',
      name: 'Raju Seth (Master Agent)',
      phone: '9811223344',
      mpin: '5566',
      role: 'MASTER_AGENT',
      master_id: null,
      credit_limit: 200000,
      wallet_balance: 125000,
      commission_rate: 7.0,
      status: 'ACTIVE',
      created_at: '2026-10-08 09:00:00'
    }
  ],

  agentTransactions: [
    {
      id: 'ATXN-501',
      agent_id: 'AGT101',
      type: 'CREDIT_ALLOCATION',
      amount: 30000,
      balance_before: 0,
      balance_after: 30000,
      target_user_id: null,
      remark: 'Initial floating points allocated by Super Admin',
      created_at: '2026-10-10 10:00:00'
    }
  ],

  admins: [
    {
      id: 'ADM_SUPER',
      username: 'superadmin',
      password: 'admin123',
      name: 'Super Admin (Owner)',
      role: 'SUPER_ADMIN',
      floating_balance: 999999999,
      is_unlimited: true,
      created_at: '2026-08-01 00:00:00'
    },
    {
      id: 'ADM_OPERATOR',
      username: 'admin',
      password: 'admin123',
      name: 'Sub-Admin (Operator)',
      role: 'ADMIN',
      floating_balance: 250000,
      is_unlimited: false,
      allocated_by: 'ADM_SUPER',
      created_at: '2026-09-01 00:00:00'
    }
  ],

  adminFundAllocations: [
    {
      id: 'AFA-101',
      admin_id: 'ADM_OPERATOR',
      allocated_by: 'ADM_SUPER',
      amount: 250000,
      balance_before: 0,
      balance_after: 250000,
      remark: 'Initial floating points allocation granted by Super Admin',
      created_at: '2026-09-01 00:00:00'
    }
  ]
};

class DatabaseStore {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    const dataDir = path.dirname(DB_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      this.data = JSON.parse(JSON.stringify(INITIAL_SEED));
      this.saveSync();
    } else {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        // Ensure new collections exist in existing database files
        if (!Array.isArray(this.data.agents) || this.data.agents.length === 0) {
          this.data.agents = JSON.parse(JSON.stringify(INITIAL_SEED.agents));
        }
        if (!Array.isArray(this.data.agentTransactions)) {
          this.data.agentTransactions = JSON.parse(JSON.stringify(INITIAL_SEED.agentTransactions));
        }
        if (!Array.isArray(this.data.admins) || this.data.admins.length === 0) {
          this.data.admins = JSON.parse(JSON.stringify(INITIAL_SEED.admins));
        }
        if (!Array.isArray(this.data.adminFundAllocations)) {
          this.data.adminFundAllocations = JSON.parse(JSON.stringify(INITIAL_SEED.adminFundAllocations));
        }
        if (this.data.settings) {
          if (!this.data.settings.admin_upi_name) this.data.settings.admin_upi_name = 'Kalyan 777 Official Services';
          if (!this.data.settings.admin_paytm) this.data.settings.admin_paytm = '9876543210';
          if (!this.data.settings.admin_bank_name) this.data.settings.admin_bank_name = 'HDFC Bank';
          if (!this.data.settings.admin_bank_account) this.data.settings.admin_bank_account = '50100492819234';
          if (!this.data.settings.admin_bank_ifsc) this.data.settings.admin_bank_ifsc = 'HDFC0001245';
          if (!this.data.settings.admin_bank_holder) this.data.settings.admin_bank_holder = 'Kalyan Entertainment PVT LTD';
          if (!this.data.settings.admin_payment_notes) this.data.settings.admin_payment_notes = 'Pay on any UPI or Bank app and enter your 12-digit UTR number below for instant points credit.';
        }
        this.saveSync();
      } catch (err) {
        console.error('Error reading database file, resetting to initial seed:', err);
        this.data = JSON.parse(JSON.stringify(INITIAL_SEED));
        this.saveSync();
      }
    }
  }

  saveSync() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  get(collection) {
    return this.data[collection] || [];
  }

  findById(collection, id) {
    const list = this.get(collection);
    return list.find(item => item.id === id) || null;
  }

  query(collection, predicate) {
    const list = this.get(collection);
    return list.filter(predicate);
  }

  insert(collection, item) {
    if (!this.data[collection]) {
      this.data[collection] = [];
    }
    this.data[collection].unshift(item);
    this.saveSync();
    return item;
  }

  update(collection, id, updates) {
    const list = this.get(collection);
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;
    list[index] = Object.assign({}, list[index], updates);
    this.saveSync();
    return list[index];
  }

  updateWhere(collection, predicate, updateFn) {
    const list = this.get(collection);
    let count = 0;
    list.forEach(item => {
      if (predicate(item)) {
        updateFn(item);
        count++;
      }
    });
    if (count > 0) this.saveSync();
    return count;
  }

  setSettings(newSettings) {
    this.data.settings = Object.assign({}, this.data.settings, newSettings);
    this.saveSync();
    return this.data.settings;
  }

  findMarketAnywhere(id) {
    let m = this.findById('markets', id);
    if (m) return { market: m, type: 'REGULAR' };
    m = this.findById('starlineMarkets', id);
    if (m) return { market: m, type: 'STARLINE' };
    m = this.findById('kingMarkets', id);
    if (m) return { market: m, type: 'KING' };
    return null;
  }
}

module.exports = new DatabaseStore();
