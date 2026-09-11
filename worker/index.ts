/**
 * NEXUS Cloudflare Worker
 *
 * Edge router routing HTTP and WebSocket connections to isolated Room Durable Objects.
 */

import { Env } from './types.ts';
import { RoomDurableObject } from './room-do.ts';
import { generateRoomCode, normalizeRoomCode, isValidRoomCode } from '../src/utils/room-code.ts';
import { roomCreationLimiter, joinAttemptLimiter } from './rate-limit.ts';

export { RoomDurableObject };

function getClientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1';
}

function applySecurityHeaders(headers: Headers): void {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; connect-src 'self' ws: wss:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:;"
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const clientIp = getClientIp(request);

    // Handle preflight CORS if needed
    if (request.method === 'OPTIONS') {
      const headers = new Headers({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Upgrade',
      });
      return new Response(null, { headers });
    }

    // 1. POST /api/rooms - Create a new ephemeral room
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const rateCheck = roomCreationLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Too many rooms created from this IP. Please wait before trying again.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil(rateCheck.retryAfterMs / 1000).toString(),
            },
          }
        );
      }

      // Generate cryptographically secure room code
      const roomCode = generateRoomCode();
      const doId = env.ROOMS.idFromName(roomCode);
      const roomStub = env.ROOMS.get(doId);

      // Initialize the Durable Object
      await roomStub.fetch(new Request('https://do/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode }),
      }));

      const responsePayload = {
        roomCode,
        createdAt: Date.now(),
        expiresInMinutes: 15,
      };

      const response = new Response(JSON.stringify(responsePayload), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      applySecurityHeaders(response.headers);
      return response;
    }

    // Match /api/rooms/:code/ws or /api/rooms/:code/info
    const match = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9_-]+)\/(ws|info)$/);
    if (match) {
      const rawCode = match[1];
      const action = match[2];
      const roomCode = normalizeRoomCode(rawCode);

      if (!isValidRoomCode(roomCode)) {
        return new Response(
          JSON.stringify({ error: 'Invalid room code format' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Probing rate limit check
      const rateCheck = joinAttemptLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        return new Response(
          JSON.stringify({ error: 'Too many attempts. Please wait a moment.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const doId = env.ROOMS.idFromName(roomCode);
      const roomStub = env.ROOMS.get(doId);

      if (action === 'info') {
        const doResponse = await roomStub.fetch(new Request(`https://do/info?code=${roomCode}`));
        const headers = new Headers(doResponse.headers);
        applySecurityHeaders(headers);
        return new Response(doResponse.body, {
          status: doResponse.status,
          headers,
        });
      }

      if (action === 'ws') {
        // Forward WebSocket upgrade request to the Durable Object
        return roomStub.fetch(request);
      }
    }

    // Default 404 for unknown API endpoints
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('NEXUS API Gateway', { status: 200 });
  },
};
