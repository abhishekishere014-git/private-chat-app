/**
 * Vite Dev & Preview Server Plugin for NEXUS
 *
 * Mounts the zero-knowledge WebSocket relay and REST API directly to Vite's HTTP server.
 */

import { Plugin } from 'vite';
import { NexusRelayServer } from './relay.ts';

export function nexusRelayPlugin(): Plugin {
  const relay = new NexusRelayServer();

  return {
    name: 'vite-plugin-nexus-relay',
    configureServer(server) {
      // Handle API REST requests
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
            req.socket.remoteAddress ||
            '127.0.0.1';

          const handled = relay.handleHttpRequest(req, clientIp, (statusCode, headers, body) => {
            res.writeHead(statusCode, {
              ...headers,
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'SAMEORIGIN',
            });
            res.end(body);
          });

          if (handled) return;
        }
        next();
      });

      // Handle WebSocket upgrade
      if (server.httpServer) {
        server.httpServer.on('upgrade', (req, socket, head) => {
          const url = req.url || '';
          if (url.includes('/api/rooms/') && url.endsWith('/ws')) {
            relay.wss.handleUpgrade(req, socket, head, (ws) => {
              relay.wss.emit('connection', ws, req);
            });
          }
        });
      }
    },
  };
}
