/**
 * Real-Time WebSocket Service for Matka Pro
 * Powers instantaneous synchronization between Players and Admin Panel
 */

'use strict';

const { WebSocketServer, WebSocket } = require('ws');

class SocketService {
  constructor() {
    this.wss = null;
    this.playerSockets = new Map(); // userId -> Set of WebSockets
    this.adminSockets = new Set();  // Set of WebSockets
  }

  init(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on('connection', (ws) => {
      ws.isAlive = true;
      ws.userId = null;
      ws.isAdmin = false;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(ws, data);
        } catch (e) {
          console.warn('Invalid WebSocket message received:', e.message);
        }
      });

      ws.on('close', () => {
        this.handleClientDisconnect(ws);
      });
    });

    // Heartbeat ping every 30 seconds
    setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    console.log('⚡ WebSocket Server initialized on shared HTTP port');
  }

  handleClientMessage(ws, data) {
    if (data.type === 'REGISTER_PLAYER') {
      const userId = data.userId;
      if (userId) {
        ws.userId = userId;
        if (!this.playerSockets.has(userId)) {
          this.playerSockets.set(userId, new Set());
        }
        this.playerSockets.get(userId).add(ws);
        this.send(ws, 'REGISTERED', { role: 'PLAYER', userId });
      }
    } else if (data.type === 'REGISTER_ADMIN') {
      ws.isAdmin = true;
      this.adminSockets.add(ws);
      this.send(ws, 'REGISTERED', { role: 'ADMIN' });
    }
  }

  handleClientDisconnect(ws) {
    if (ws.isAdmin) {
      this.adminSockets.delete(ws);
    }
    if (ws.userId && this.playerSockets.has(ws.userId)) {
      const set = this.playerSockets.get(ws.userId);
      set.delete(ws);
      if (set.size === 0) {
        this.playerSockets.delete(ws.userId);
      }
    }
  }

  send(ws, event, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
    }
  }

  // Broadcast to all active admin panels
  broadcastToAdmins(event, data) {
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    this.adminSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }

  // Broadcast to a specific player's devices
  broadcastToUser(userId, event, data) {
    const userSockets = this.playerSockets.get(userId);
    if (!userSockets) return;
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    userSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }

  // Broadcast to all connected clients (players + admins)
  broadcastAll(event, data) {
    if (!this.wss) return;
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    this.wss.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }
}

module.exports = new SocketService();
