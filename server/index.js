/**
 * Matka Pro - Central Express Application Server with Real-Time WebSockets
 * Serves Unified REST API, Admin Control Center (/admin) and Player Mobile Web App (/)
 */

'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const db = require('./db/store');
const socketService = require('./services/socketService');
const marketScheduler = require('./services/marketScheduler');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4173;

// Initialize WebSockets and Market Scheduler on shared HTTP server
socketService.init(server);
marketScheduler.init(socketService);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    console.log(`[API] ${req.method} ${req.url}`);
  }
  next();
});

// Mount REST API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/markets', require('./routes/markets'));
app.use('/api/bids', require('./routes/bids'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/results', require('./routes/results'));
app.use('/api/cutting', require('./routes/cutting'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/agents', require('./routes/agents'));

// Summary KPI Stats Endpoint (for Admin Dashboard)
app.get('/api/stats', (req, res) => {
  const bids = db.get('bids');
  const users = db.get('users');
  const deposits = db.get('deposits');
  const withdrawals = db.get('withdrawals');

  let todayBidsTotal = 0;
  let todayWinningsTotal = 0;

  bids.forEach(b => {
    todayBidsTotal += (b.points || 0);
    if (b.status === 'WON') {
      todayWinningsTotal += (b.potential_win || 0);
    }
  });

  const todayNetProfit = todayBidsTotal - todayWinningsTotal;

  const pendingDeposits = deposits.filter(d => d.status === 'PENDING');
  const pendingDepositsAmount = pendingDeposits.reduce((sum, d) => sum + d.amount, 0);

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'PENDING');
  const pendingWithdrawalsAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

  res.json({
    success: true,
    stats: {
      todayBidsTotal,
      todayWinningsTotal,
      todayNetProfit,
      activeUsersCount: users.filter(u => u.status === 'ACTIVE').length,
      totalUsersCount: users.length,
      pendingDepositsCount: pendingDeposits.length,
      pendingDepositsAmount,
      pendingWithdrawalsCount: pendingWithdrawals.length,
      pendingWithdrawalsAmount
    }
  });
});

// Static File Delivery
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));
app.use('/agent', express.static(path.join(__dirname, '..', 'public', 'agent')));
app.use('/app', express.static(path.join(__dirname, '..', 'public', 'app')));
app.use('/', express.static(path.join(__dirname, '..', 'public', 'app')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', system: 'Kalyan 777 Server with WebSockets', timestamp: new Date().toISOString() });
});

// Start Server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`⚡ KALYAN 777 FULL-STACK SERVER WITH WEBSOCKETS RUNNING`);
  console.log(`📱 Player Mobile App:  http://localhost:${PORT}/`);
  console.log(`💻 Admin Control Panel: http://localhost:${PORT}/admin/`);
  console.log(`🚀 REST API Service:    http://localhost:${PORT}/api/`);
  console.log(`=======================================================`);
});

module.exports = server;
