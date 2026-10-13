/**
 * Matka Admin Panel Mock Database & State Management
 * Features LocalStorage persistence with full initial seed data
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MatkaStore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'MATKA_ADMIN_DATA_V1';

  const SEED_DATA = {
    // Platform Summary Stats
    stats: {
      todayBidsTotal: 486500,
      todayWinningsTotal: 343650,
      todayNetProfit: 142850,
      activeUsersCount: 384,
      totalUsersCount: 1420,
      pendingDepositsCount: 6,
      pendingDepositsAmount: 34500,
      pendingWithdrawalsCount: 4,
      pendingWithdrawalsAmount: 28000
    },

    // Regular Bazaars / Markets
    markets: [
      {
        id: 'kalyan',
        name: 'KALYAN',
        hindiName: 'कल्याण',
        openTime: '16:15',
        closeTime: '18:15',
        openPana: '128',
        closePana: '',
        openAnk: '1',
        closeAnk: '',
        status: 'RUNNING', // OPEN, RUNNING, CLOSED, UPCOMING
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        active: true,
        todayBids: 184500
      },
      {
        id: 'milan_day',
        name: 'MILAN DAY',
        hindiName: 'मिलन डे',
        openTime: '15:00',
        closeTime: '17:00',
        openPana: '358',
        closePana: '390',
        openAnk: '6',
        closeAnk: '2',
        status: 'CLOSED',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        active: true,
        todayBids: 96200
      },
      {
        id: 'milan_night',
        name: 'MILAN NIGHT',
        hindiName: 'मिलन नाईट',
        openTime: '21:00',
        closeTime: '23:00',
        openPana: '',
        closePana: '',
        openAnk: '',
        closeAnk: '',
        status: 'UPCOMING',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        active: true,
        todayBids: 41200
      },
      {
        id: 'rajdhani_day',
        name: 'RAJDHANI DAY',
        hindiName: 'राजधानी डे',
        openTime: '15:25',
        closeTime: '17:25',
        openPana: '247',
        closePana: '',
        openAnk: '3',
        closeAnk: '',
        status: 'RUNNING',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        active: true,
        todayBids: 78900
      },
      {
        id: 'rajdhani_night',
        name: 'RAJDHANI NIGHT',
        hindiName: 'राजधानी नाईट',
        openTime: '21:35',
        closeTime: '23:35',
        openPana: '',
        closePana: '',
        openAnk: '',
        closeAnk: '',
        status: 'UPCOMING',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        active: true,
        todayBids: 31000
      },
      {
        id: 'time_bazar',
        name: 'TIME BAZAR',
        hindiName: 'टाइम बाजार',
        openTime: '13:00',
        closeTime: '14:00',
        openPana: '246',
        closePana: '189',
        openAnk: '2',
        closeAnk: '8',
        status: 'CLOSED',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        active: true,
        todayBids: 112000
      },
      {
        id: 'main_bazar',
        name: 'MAIN BAZAR',
        hindiName: 'मेन बाजार',
        openTime: '21:40',
        closeTime: '00:05',
        openPana: '',
        closePana: '',
        openAnk: '',
        closeAnk: '',
        status: 'UPCOMING',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        active: true,
        todayBids: 54000
      },
      {
        id: 'sridevi',
        name: 'SRIDEVI',
        hindiName: 'श्रीदेवी',
        openTime: '11:35',
        closeTime: '12:35',
        openPana: '137',
        closePana: '469',
        openAnk: '1',
        closeAnk: '9',
        status: 'CLOSED',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        active: true,
        todayBids: 65400
      },
      {
        id: 'sridevi_night',
        name: 'SRIDEVI NIGHT',
        hindiName: 'श्रीदेवी नाईट',
        openTime: '19:00',
        closeTime: '20:00',
        openPana: '',
        closePana: '',
        openAnk: '',
        closeAnk: '',
        status: 'UPCOMING',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        active: true,
        todayBids: 22800
      },
      {
        id: 'madhur_night',
        name: 'MADHUR NIGHT',
        hindiName: 'मधुर नाईट',
        openTime: '20:30',
        closeTime: '22:30',
        openPana: '',
        closePana: '',
        openAnk: '',
        closeAnk: '',
        status: 'UPCOMING',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        active: true,
        todayBids: 19400
      }
    ],

    // Starline Markets
    starlineMarkets: [
      { id: 'st_10am', name: '10:00 AM', openTime: '10:00', result: '148-3', status: 'CLOSED' },
      { id: 'st_11am', name: '11:00 AM', openTime: '11:00', result: '249-5', status: 'CLOSED' },
      { id: 'st_12pm', name: '12:00 PM', openTime: '12:00', result: '378-8', status: 'CLOSED' },
      { id: 'st_01pm', name: '01:00 PM', openTime: '13:00', result: '112-4', status: 'CLOSED' },
      { id: 'st_02pm', name: '02:00 PM', openTime: '14:00', result: '567-8', status: 'CLOSED' },
      { id: 'st_03pm', name: '03:00 PM', openTime: '15:00', result: '235-0', status: 'CLOSED' },
      { id: 'st_04pm', name: '04:00 PM', openTime: '16:00', result: '***-*', status: 'RUNNING' },
      { id: 'st_05pm', name: '05:00 PM', openTime: '17:00', result: '***-*', status: 'UPCOMING' },
      { id: 'st_06pm', name: '06:00 PM', openTime: '18:00', result: '***-*', status: 'UPCOMING' },
      { id: 'st_07pm', name: '07:00 PM', openTime: '19:00', result: '***-*', status: 'UPCOMING' },
      { id: 'st_08pm', name: '08:00 PM', openTime: '20:00', result: '***-*', status: 'UPCOMING' },
      { id: 'st_09pm', name: '09:00 PM', openTime: '21:00', result: '***-*', status: 'UPCOMING' }
    ],

    // King / Gali Disawar Markets
    kingMarkets: [
      { id: 'disawar', name: 'DISAWAR', openTime: '05:00', result: '74', status: 'CLOSED' },
      { id: 'faridabad', name: 'FARIDABAD', openTime: '18:15', result: '83', status: 'CLOSED' },
      { id: 'ghaziabad', name: 'GHAZIABAD', openTime: '20:30', result: '**', status: 'UPCOMING' },
      { id: 'gali', name: 'GALI', openTime: '23:05', result: '**', status: 'UPCOMING' }
    ],

    // Cutting Sheet Load Data for Active Kalyan Open
    cuttingSheet: {
      marketId: 'kalyan',
      session: 'OPEN',
      totalCollected: 184500,
      singleLoad: [
        { digit: '0', amount: 18400, bidsCount: 42, liability: 174800, netHouseProfit: 9700 },
        { digit: '1', amount: 34200, bidsCount: 68, liability: 324900, netHouseProfit: -140400 },
        { digit: '2', amount: 14500, bidsCount: 29, liability: 137750, netHouseProfit: 46750 },
        { digit: '3', amount: 48000, bidsCount: 94, liability: 456000, netHouseProfit: -271500 }, // High risk
        { digit: '4', amount: 12100, bidsCount: 24, liability: 114950, netHouseProfit: 69550 },
        { digit: '5', amount: 22800, bidsCount: 51, liability: 216600, netHouseProfit: -32100 },
        { digit: '6', amount: 16300, bidsCount: 33, liability: 154850, netHouseProfit: 29650 },
        { digit: '7', amount: 8500,  bidsCount: 18, liability: 80750,  netHouseProfit: 103750 }, // Safest
        { digit: '8', amount: 29400, bidsCount: 57, liability: 279300, netHouseProfit: -94800 },
        { digit: '9', amount: 31600, bidsCount: 61, liability: 300200, netHouseProfit: -115700 }
      ],
      // Top 10 high-exposure Jodis in Kalyan
      topJodis: [
        { jodi: '37', amount: 12500, liability: 1187500 },
        { jodi: '19', amount: 11000, liability: 1045000 },
        { jodi: '44', amount: 9800,  liability: 931000 },
        { jodi: '72', amount: 8400,  liability: 798000 },
        { jodi: '90', amount: 7500,  liability: 712500 },
        { jodi: '03', amount: 6900,  liability: 655500 },
        { jodi: '56', amount: 6200,  liability: 589000 },
        { jodi: '28', amount: 5900,  liability: 560500 },
        { jodi: '81', amount: 5300,  liability: 503500 },
        { jodi: '14', amount: 4800,  liability: 456000 }
      ]
    },

    // Registered Users
    users: [
      {
        id: 'USR101',
        name: 'Ramesh Patel',
        phone: '9820145890',
        balance: 14500,
        totalBids: 128,
        totalWon: 68400,
        status: 'ACTIVE',
        joinedAt: '2026-08-12',
        bankAccount: 'HDFC0001245 - 50100239481',
        upiId: 'ramesh.patel@okhdfcbank'
      },
      {
        id: 'USR102',
        name: 'Vijay Verma',
        phone: '9871234901',
        balance: 5200,
        totalBids: 74,
        totalWon: 29800,
        status: 'ACTIVE',
        joinedAt: '2026-09-01',
        bankAccount: 'SBIN0004510 - 32098412891',
        upiId: 'vijayverma@paytm'
      },
      {
        id: 'USR103',
        name: 'Deepak Sharma',
        phone: '9920884120',
        balance: 310,
        totalBids: 215,
        totalWon: 142000,
        status: 'ACTIVE',
        joinedAt: '2026-07-15',
        bankAccount: 'ICIC0009812 - 0891248102',
        upiId: 'deepak.sharma@apl'
      },
      {
        id: 'USR104',
        name: 'Amitabh Sen',
        phone: '9711823904',
        balance: 24800,
        totalBids: 88,
        totalWon: 91500,
        status: 'ACTIVE',
        joinedAt: '2026-08-20',
        bankAccount: 'PUNB0021400 - 18290012401',
        upiId: 'amitabhsen@ybl'
      },
      {
        id: 'USR105',
        name: 'Sonu Gupta',
        phone: '9819234812',
        balance: 0,
        totalBids: 45,
        totalWon: 8900,
        status: 'BLOCKED',
        joinedAt: '2026-09-10',
        bankAccount: 'AXIS0003102 - 9128001249',
        upiId: 'sonu.gupta@okaxis'
      },
      {
        id: 'USR106',
        name: 'Karan Malhotra',
        phone: '9867192834',
        balance: 8900,
        totalBids: 62,
        totalWon: 34100,
        status: 'ACTIVE',
        joinedAt: '2026-09-18',
        bankAccount: 'KKBK0001823 - 489120912',
        upiId: 'karanm@kotak'
      },
      {
        id: 'USR107',
        name: 'Mohammed Rizwan',
        phone: '9845102938',
        balance: 19400,
        totalBids: 194,
        totalWon: 110500,
        status: 'ACTIVE',
        joinedAt: '2026-07-28',
        bankAccount: 'BARB0MAHIM - 2891001248',
        upiId: 'rizwan@ibl'
      },
      {
        id: 'USR108',
        name: 'Sunil Jadhav',
        phone: '9823491024',
        balance: 1250,
        totalBids: 38,
        totalWon: 12000,
        status: 'ACTIVE',
        joinedAt: '2026-10-02',
        bankAccount: 'BKID0001290 - 012849102',
        upiId: 'suniljadhav@upi'
      }
    ],

    // Recent Live Bids
    bids: [
      {
        id: 'BID-9841',
        userId: 'USR101',
        userName: 'Ramesh Patel',
        marketId: 'kalyan',
        marketName: 'KALYAN',
        gameType: 'Single Digit',
        session: 'OPEN',
        number: '1',
        points: 500,
        potentialWin: 4750,
        status: 'WON', // PENDING, WON, LOST, CANCELLED
        payoutRate: '1:9.5',
        createdAt: '2026-10-09 15:45'
      },
      {
        id: 'BID-9842',
        userId: 'USR104',
        userName: 'Amitabh Sen',
        marketId: 'kalyan',
        marketName: 'KALYAN',
        gameType: 'Single Patti',
        session: 'OPEN',
        number: '128',
        points: 200,
        potentialWin: 28000,
        status: 'WON',
        payoutRate: '1:140',
        createdAt: '2026-10-09 15:50'
      },
      {
        id: 'BID-9843',
        userId: 'USR103',
        userName: 'Deepak Sharma',
        marketId: 'kalyan',
        marketName: 'KALYAN',
        gameType: 'Jodi',
        session: 'FULL',
        number: '14',
        points: 1000,
        potentialWin: 95000,
        status: 'PENDING',
        payoutRate: '1:95',
        createdAt: '2026-10-09 16:02'
      },
      {
        id: 'BID-9844',
        userId: 'USR102',
        userName: 'Vijay Verma',
        marketId: 'kalyan',
        marketName: 'KALYAN',
        gameType: 'Single Digit',
        session: 'CLOSE',
        number: '4',
        points: 800,
        potentialWin: 7600,
        status: 'PENDING',
        payoutRate: '1:9.5',
        createdAt: '2026-10-09 16:10'
      },
      {
        id: 'BID-9845',
        userId: 'USR107',
        userName: 'Mohammed Rizwan',
        marketId: 'kalyan',
        marketName: 'KALYAN',
        gameType: 'Double Patti',
        session: 'CLOSE',
        number: '118',
        points: 300,
        potentialWin: 84000,
        status: 'PENDING',
        payoutRate: '1:280',
        createdAt: '2026-10-09 16:12'
      },
      {
        id: 'BID-9846',
        userId: 'USR106',
        userName: 'Karan Malhotra',
        marketId: 'milan_day',
        marketName: 'MILAN DAY',
        gameType: 'Single Digit',
        session: 'OPEN',
        number: '6',
        points: 1500,
        potentialWin: 14250,
        status: 'WON',
        payoutRate: '1:9.5',
        createdAt: '2026-10-09 14:20'
      },
      {
        id: 'BID-9847',
        userId: 'USR108',
        userName: 'Sunil Jadhav',
        marketId: 'milan_day',
        marketName: 'MILAN DAY',
        gameType: 'Jodi',
        session: 'FULL',
        number: '62',
        points: 400,
        potentialWin: 38000,
        status: 'WON',
        payoutRate: '1:95',
        createdAt: '2026-10-09 14:35'
      },
      {
        id: 'BID-9848',
        userId: 'USR101',
        userName: 'Ramesh Patel',
        marketId: 'time_bazar',
        marketName: 'TIME BAZAR',
        gameType: 'Triple Patti',
        session: 'OPEN',
        number: '222',
        points: 100,
        potentialWin: 70000,
        status: 'LOST',
        payoutRate: '1:700',
        createdAt: '2026-10-09 12:40'
      },
      {
        id: 'BID-9849',
        userId: 'USR103',
        userName: 'Deepak Sharma',
        marketId: 'kalyan',
        marketName: 'KALYAN',
        gameType: 'Half Sangam',
        session: 'FULL',
        number: '128 x 4',
        points: 250,
        potentialWin: 250000,
        status: 'PENDING',
        payoutRate: '1:1000',
        createdAt: '2026-10-09 16:05'
      }
    ],

    // Deposit Requests (Add Fund)
    deposits: [
      {
        id: 'DEP-401',
        userId: 'USR104',
        userName: 'Amitabh Sen',
        amount: 10000,
        method: 'PhonePe UPI',
        utr: '428910294812',
        status: 'PENDING',
        requestedAt: '2026-10-09 12:15',
        screenshot: 'assets/slip_sample1.png'
      },
      {
        id: 'DEP-402',
        userId: 'USR106',
        userName: 'Karan Malhotra',
        amount: 5000,
        method: 'Google Pay',
        utr: '428909182341',
        status: 'PENDING',
        requestedAt: '2026-10-09 12:20',
        screenshot: 'assets/slip_sample2.png'
      },
      {
        id: 'DEP-403',
        userId: 'USR102',
        userName: 'Vijay Verma',
        amount: 2500,
        method: 'Paytm UPI',
        utr: '428904128901',
        status: 'APPROVED',
        requestedAt: '2026-10-09 11:40',
        approvedAt: '2026-10-09 11:42'
      },
      {
        id: 'DEP-404',
        userId: 'USR101',
        userName: 'Ramesh Patel',
        amount: 15000,
        method: 'IMPS Bank Transfer',
        utr: 'IMPS4019284192',
        status: 'APPROVED',
        requestedAt: '2026-10-09 10:15',
        approvedAt: '2026-10-09 10:18'
      },
      {
        id: 'DEP-405',
        userId: 'USR105',
        userName: 'Sonu Gupta',
        amount: 1000,
        method: 'UPI Auto',
        utr: 'INVALID_UTR_99',
        status: 'REJECTED',
        reason: 'Payment failed / UTR not found on bank statement',
        requestedAt: '2026-10-09 09:30',
        rejectedAt: '2026-10-09 09:35'
      }
    ],

    // Withdrawal Requests
    withdrawals: [
      {
        id: 'WIT-701',
        userId: 'USR107',
        userName: 'Mohammed Rizwan',
        amount: 12000,
        method: 'UPI',
        destination: 'rizwan@ibl',
        status: 'PENDING',
        requestedAt: '2026-10-09 12:22'
      },
      {
        id: 'WIT-702',
        userId: 'USR101',
        userName: 'Ramesh Patel',
        amount: 8000,
        method: 'Bank Transfer (IMPS)',
        destination: 'HDFC Bank - A/C 50100239481',
        status: 'PENDING',
        requestedAt: '2026-10-09 12:28'
      },
      {
        id: 'WIT-703',
        userId: 'USR103',
        userName: 'Deepak Sharma',
        amount: 50000,
        method: 'Bank Transfer (NEFT)',
        destination: 'ICICI Bank - A/C 0891248102',
        status: 'APPROVED',
        requestedAt: '2026-10-09 10:05',
        approvedAt: '2026-10-09 10:15',
        referenceNo: 'CMS-ICICI-81920'
      },
      {
        id: 'WIT-704',
        userId: 'USR102',
        userName: 'Vijay Verma',
        amount: 3500,
        method: 'UPI',
        destination: 'vijayverma@paytm',
        status: 'APPROVED',
        requestedAt: '2026-10-09 09:40',
        approvedAt: '2026-10-09 09:45',
        referenceNo: 'CMS-UPI-77123'
      }
    ],

    // Game Rates (Bhav Multipliers)
    gameRates: [
      { id: 'single_digit', name: 'Single Digit (Ank)', minBid: 10, maxBid: 25000, rate: 9.5, label: '10 ka 95' },
      { id: 'jodi_digit', name: 'Jodi Digit', minBid: 10, maxBid: 15000, rate: 95.0, label: '10 ka 950' },
      { id: 'single_panna', name: 'Single Panna (SP)', minBid: 10, maxBid: 10000, rate: 140.0, label: '10 ka 1400' },
      { id: 'double_panna', name: 'Double Panna (DP)', minBid: 10, maxBid: 5000, rate: 280.0, label: '10 ka 2800' },
      { id: 'triple_panna', name: 'Triple Panna (TP)', minBid: 10, maxBid: 2000, rate: 700.0, label: '10 ka 7000' },
      { id: 'half_sangam', name: 'Half Sangam', minBid: 10, maxBid: 2000, rate: 1000.0, label: '10 ka 10,000' },
      { id: 'full_sangam', name: 'Full Sangam', minBid: 10, maxBid: 1000, rate: 10000.0, label: '10 ka 1,00,000' },
      { id: 'starline_single', name: 'Starline Single', minBid: 10, maxBid: 25000, rate: 9.5, label: '10 ka 95' },
      { id: 'starline_patti', name: 'Starline Patti', minBid: 10, maxBid: 10000, rate: 140.0, label: '10 ka 1400' }
    ],

    // App & Platform Settings
    settings: {
      noticeMarquee: '⚡ Welcome to the Official Kalyan Pro Matka Admin. All bazaar settlements and auto-credits active. Please verify high-liability cutting limits before market close.',
      whatsappSupport: '+91 98765 43210',
      telegramChannel: 'https://t.me/kalyan_official_matka',
      adminUpiId: 'kalyanboss@upi',
      adminPhonePe: '9876543210',
      adminGooglePay: '9876543210',
      minDeposit: 100,
      maxDeposit: 100000,
      minWithdrawal: 500,
      maxWithdrawal: 200000,
      withdrawalsOpenTime: '08:00',
      withdrawalsCloseTime: '22:00',
      isBettingActive: true,
      maintenanceMode: false
    },

    // Result Declaration Audit Log
    resultLogs: [
      {
        id: 'LOG-301',
        marketName: 'KALYAN',
        session: 'OPEN',
        panna: '128',
        ank: '1',
        declaredBy: 'Super Admin (You)',
        time: '2026-10-09 16:16',
        winnersCount: 14,
        totalPayout: 46250
      },
      {
        id: 'LOG-302',
        marketName: 'MILAN DAY',
        session: 'CLOSE',
        panna: '390',
        ank: '2',
        declaredBy: 'Super Admin (You)',
        time: '2026-10-09 17:02',
        winnersCount: 19,
        totalPayout: 68100
      },
      {
        id: 'LOG-303',
        marketName: 'TIME BAZAR',
        session: 'CLOSE',
        panna: '189',
        ank: '8',
        declaredBy: 'Operator Rahul',
        time: '2026-10-09 14:02',
        winnersCount: 22,
        totalPayout: 84300
      }
    ]
  };

  class Store {
    constructor() {
      this.data = this.load();
    }

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return Object.assign({}, SEED_DATA, parsed);
        }
      } catch (e) {
        console.warn('Could not read from localStorage, using seed data.', e);
      }
      return JSON.parse(JSON.stringify(SEED_DATA));
    }

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (e) {
        console.warn('Could not save to localStorage.', e);
      }
    }

    reset() {
      this.data = JSON.parse(JSON.stringify(SEED_DATA));
      this.save();
      return this.data;
    }

    // Helper getters & actions
    getMarkets() { return this.data.markets; }
    getStarlineMarkets() { return this.data.starlineMarkets; }
    getKingMarkets() { return this.data.kingMarkets; }
    getUsers() { return this.data.users; }
    getBids() { return this.data.bids; }
    getDeposits() { return this.data.deposits; }
    getWithdrawals() { return this.data.withdrawals; }
    getGameRates() { return this.data.gameRates; }
    getSettings() { return this.data.settings; }
    getCuttingSheet() { return this.data.cuttingSheet; }
    getResultLogs() { return this.data.resultLogs; }
    getStats() { return this.data.stats; }

    updateMarket(marketId, updates) {
      const idx = this.data.markets.findIndex(m => m.id === marketId);
      if (idx !== -1) {
        this.data.markets[idx] = Object.assign({}, this.data.markets[idx], updates);
        this.save();
        return this.data.markets[idx];
      }
      return null;
    }

    addMarket(newMarket) {
      this.data.markets.push(newMarket);
      this.save();
      return newMarket;
    }

    declareResult(marketId, session, panna, ank, adminName = 'Super Admin') {
      const market = this.data.markets.find(m => m.id === marketId);
      if (!market) return { success: false, message: 'Market not found' };

      if (session === 'OPEN') {
        market.openPana = panna;
        market.openAnk = ank;
        if (market.closePana) {
          market.status = 'CLOSED';
        } else {
          market.status = 'RUNNING';
        }
      } else if (session === 'CLOSE') {
        market.closePana = panna;
        market.closeAnk = ank;
        market.status = 'CLOSED';
      }

      // Settle relevant bids
      let winnersCount = 0;
      let totalPayout = 0;

      this.data.bids.forEach(bid => {
        if (bid.marketId === marketId && bid.status === 'PENDING') {
          let won = false;
          if (session === 'OPEN') {
            if (bid.session === 'OPEN' && bid.gameType === 'Single Digit' && bid.number === ank) won = true;
            if (bid.session === 'OPEN' && (bid.gameType.includes('Patti') || bid.gameType.includes('Panna')) && bid.number === panna) won = true;
          } else if (session === 'CLOSE') {
            if (bid.session === 'CLOSE' && bid.gameType === 'Single Digit' && bid.number === ank) won = true;
            if (bid.session === 'CLOSE' && (bid.gameType.includes('Patti') || bid.gameType.includes('Panna')) && bid.number === panna) won = true;
            // Jodi settlement
            if (bid.session === 'FULL' && bid.gameType === 'Jodi') {
              const fullJodi = (market.openAnk || '0') + ank;
              if (bid.number === fullJodi) won = true;
            }
          }

          if (won) {
            bid.status = 'WON';
            winnersCount++;
            totalPayout += bid.potentialWin;
            // Credit user wallet
            const user = this.data.users.find(u => u.id === bid.userId);
            if (user) {
              user.balance += bid.potentialWin;
              user.totalWon += bid.potentialWin;
            }
          } else if ((session === 'CLOSE' && bid.session === 'FULL') || (bid.session === session)) {
            bid.status = 'LOST';
          }
        }
      });

      // Update daily stats
      this.data.stats.todayWinningsTotal += totalPayout;
      this.data.stats.todayNetProfit -= totalPayout;

      // Log result
      const logEntry = {
        id: 'LOG-' + Math.floor(100 + Math.random() * 900),
        marketName: market.name,
        session: session,
        panna: panna,
        ank: ank,
        declaredBy: adminName,
        time: new Date().toISOString().replace('T', ' ').substring(0, 16),
        winnersCount: winnersCount,
        totalPayout: totalPayout
      };
      this.data.resultLogs.unshift(logEntry);

      this.save();
      return { success: true, market, logEntry, winnersCount, totalPayout };
    }

    adjustUserPoints(userId, amount, type, remark) {
      const user = this.data.users.find(u => u.id === userId);
      if (!user) return { success: false, message: 'User not found' };
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) return { success: false, message: 'Invalid amount' };

      if (type === 'CREDIT') {
        user.balance += num;
      } else if (type === 'DEBIT') {
        if (user.balance < num) return { success: false, message: 'Insufficient user balance' };
        user.balance -= num;
      }
      this.save();
      return { success: true, user };
    }

    toggleUserStatus(userId) {
      const user = this.data.users.find(u => u.id === userId);
      if (!user) return null;
      user.status = user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
      this.save();
      return user;
    }

    approveDeposit(depId) {
      const dep = this.data.deposits.find(d => d.id === depId);
      if (!dep || dep.status !== 'PENDING') return false;
      dep.status = 'APPROVED';
      dep.approvedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
      
      const user = this.data.users.find(u => u.id === dep.userId);
      if (user) user.balance += dep.amount;

      this.data.stats.pendingDepositsCount = Math.max(0, this.data.stats.pendingDepositsCount - 1);
      this.data.stats.pendingDepositsAmount = Math.max(0, this.data.stats.pendingDepositsAmount - dep.amount);
      this.save();
      return true;
    }

    rejectDeposit(depId, reason) {
      const dep = this.data.deposits.find(d => d.id === depId);
      if (!dep || dep.status !== 'PENDING') return false;
      dep.status = 'REJECTED';
      dep.reason = reason || 'Admin rejected';
      dep.rejectedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

      this.data.stats.pendingDepositsCount = Math.max(0, this.data.stats.pendingDepositsCount - 1);
      this.data.stats.pendingDepositsAmount = Math.max(0, this.data.stats.pendingDepositsAmount - dep.amount);
      this.save();
      return true;
    }

    approveWithdrawal(witId, refNo) {
      const wit = this.data.withdrawals.find(w => w.id === witId);
      if (!wit || wit.status !== 'PENDING') return false;
      wit.status = 'APPROVED';
      wit.referenceNo = refNo || 'CMS-TXN-' + Math.floor(10000 + Math.random() * 90000);
      wit.approvedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

      this.data.stats.pendingWithdrawalsCount = Math.max(0, this.data.stats.pendingWithdrawalsCount - 1);
      this.data.stats.pendingWithdrawalsAmount = Math.max(0, this.data.stats.pendingWithdrawalsAmount - wit.amount);
      this.save();
      return true;
    }

    rejectWithdrawal(witId, reason) {
      const wit = this.data.withdrawals.find(w => w.id === witId);
      if (!wit || wit.status !== 'PENDING') return false;
      wit.status = 'REJECTED';
      wit.reason = reason || 'Admin rejected and points refunded';
      
      // Refund back to user
      const user = this.data.users.find(u => u.id === wit.userId);
      if (user) user.balance += wit.amount;

      this.data.stats.pendingWithdrawalsCount = Math.max(0, this.data.stats.pendingWithdrawalsCount - 1);
      this.data.stats.pendingWithdrawalsAmount = Math.max(0, this.data.stats.pendingWithdrawalsAmount - wit.amount);
      this.save();
      return true;
    }

    updateRates(ratesArray) {
      this.data.gameRates = ratesArray;
      this.save();
    }

    updateSettings(newSettings) {
      this.data.settings = Object.assign({}, this.data.settings, newSettings);
      this.save();
    }
  }

  return new Store();
}));
