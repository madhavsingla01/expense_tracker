const jwt = require('jsonwebtoken');
const { URL } = require('url');
const { WebSocketServer } = require('ws');
const User = require('../models/User');

const clientsByUserId = new Map();

function addClient(userId, ws) {
  const key = String(userId);
  if (!clientsByUserId.has(key)) {
    clientsByUserId.set(key, new Set());
  }
  clientsByUserId.get(key).add(ws);
}

function removeClient(userId, ws) {
  const key = String(userId);
  const clients = clientsByUserId.get(key);
  if (!clients) return;

  clients.delete(ws);
  if (clients.size === 0) {
    clientsByUserId.delete(key);
  }
}

function safeSend(ws, payload) {
  if (!ws || ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch (error) {
    console.warn('Payment socket send failed:', error.message);
  }
}

function initializePaymentSocketServer(server) {
  const wss = new WebSocketServer({ server, path: '/ws/payments' });

  wss.on('error', (error) => {
    console.error('Payment socket server error:', error.message);
  });

  wss.on('connection', async (ws, req) => {
    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const token = requestUrl.searchParams.get('token');

      if (!token) {
        ws.close(4401, 'Missing token');
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.sid) {
        const user = await User.findOne({
          _id: decoded.id,
          'auth.sessions': {
            $elemMatch: {
              sessionId: decoded.sid,
              revokedAt: { $exists: false },
              $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
            },
          },
        }).select('_id');

        if (!user) {
          ws.close(4401, 'Session expired');
          return;
        }
      }
      ws.userId = String(decoded.id);

      addClient(ws.userId, ws);
      safeSend(ws, { type: 'realtime.ready' });

      ws.on('close', () => removeClient(ws.userId, ws));
      ws.on('error', () => removeClient(ws.userId, ws));
      ws.on('message', () => {
        safeSend(ws, { type: 'realtime.pong', at: new Date().toISOString() });
      });
    } catch (error) {
      ws.close(4401, 'Invalid token');
    }
  });

  return wss;
}

function broadcastPaymentUpdate(userId, payment) {
  const clients = clientsByUserId.get(String(userId));
  if (!clients || clients.size === 0) return;

  for (const ws of clients) {
    safeSend(ws, {
      type: 'payment.updated',
      payment,
    });
  }
}

function broadcastTransactionChange(userId, change) {
  const clients = clientsByUserId.get(String(userId));
  if (!clients || clients.size === 0) return;

  for (const ws of clients) {
    safeSend(ws, {
      type: 'transactions.changed',
      change,
    });
  }
}

module.exports = {
  initializePaymentSocketServer,
  broadcastPaymentUpdate,
  broadcastTransactionChange,
};
