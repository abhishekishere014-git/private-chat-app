/**
 * Standalone Production Server for NEXUS
 *
 * Runs on Port 3000, serving static assets from dist/ and
 * mounting the zero-knowledge WebSocket relay.
 */

import http from 'http';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { NexusRelayServer } from './server/relay.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
const server = http.createServer(app);
const relay = new NexusRelayServer();

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// REST API
app.use((req, res, next) => {
  if (req.url && req.url.startsWith('/api/')) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const handled = relay.handleHttpRequest(req, clientIp, (statusCode, headers, body) => {
      res.writeHead(statusCode, headers);
      res.end(body);
    });

    if (handled) return;
  }
  next();
});

// Serve frontend build
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// WebSocket Upgrade
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  if (url.includes('/api/rooms/') && url.endsWith('/ws')) {
    relay.wss.handleUpgrade(req, socket, head, (ws) => {
      relay.wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`NEXUS server running on http://0.0.0.0:${PORT}`);
});
