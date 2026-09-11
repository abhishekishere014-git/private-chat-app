/**
 * NEXUS Room Durable Object
 *
 * Implements an isolated, temporary, zero-knowledge real-time relay for a single room.
 *
 * Key Guarantees:
 * - Exactly 2 participants maximum
 * - Zero-knowledge relay: receives and forwards ciphertext only; never decrypts
 * - Automated inactivity expiration (default 15 minutes) via Durable Object Alarms
 * - Server-side validation of every frame
 * - Per-participant rate limiting against message flooding
 */

import {
  ClientMessage,
  Participant,
  ServerMessage,
  RoomInfoResponse,
} from '../src/types/protocol.ts';
import { validateClientMessage } from './validation.ts';
import { SlidingWindowRateLimiter } from './rate-limit.ts';
import { DurableObjectState } from './types.ts';

// Cloudflare Workers WebSocket extensions
interface CFWebSocket extends WebSocket {
  accept(): void;
}

declare class WebSocketPair {
  0: CFWebSocket;
  1: CFWebSocket;
  [key: number]: CFWebSocket;
}

const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

interface ParticipantSession {
  participant: Participant;
  ws: CFWebSocket | WebSocket;
  rateLimiter: SlidingWindowRateLimiter;
  lastTypingBroadcast: number;
}

export class RoomDurableObject {
  private state: DurableObjectState;
  private env: Record<string, unknown>;
  private roomCode: string = '';
  private createdAt: number = 0;
  private lastActiveAt: number = 0;
  private sessions: Map<CFWebSocket | WebSocket, ParticipantSession> = new Map();
  private inactivityTimeoutMs: number = DEFAULT_INACTIVITY_TIMEOUT_MS;

  constructor(state: DurableObjectState, env: Record<string, unknown>) {
    this.state = state;
    this.env = env;

    const timeoutEnv = Number(env.INACTIVITY_TIMEOUT_MS);
    if (!isNaN(timeoutEnv) && timeoutEnv > 0) {
      this.inactivityTimeoutMs = timeoutEnv;
    }

    // Restore persistent metadata if available
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<{
        roomCode: string;
        createdAt: number;
        lastActiveAt: number;
      }>('meta');

      if (stored) {
        this.roomCode = stored.roomCode;
        this.createdAt = stored.createdAt;
        this.lastActiveAt = stored.lastActiveAt;
      }
    });
  }

  /**
   * HTTP Entry point for the Durable Object:
   * Handles:
   * - GET /ws (WebSocket upgrade)
   * - GET /info (Room metadata for join check)
   * - POST /init (Room initialization on creation)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/init' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { roomCode?: string };
      this.roomCode = body.roomCode || url.searchParams.get('code') || '';
      this.createdAt = Date.now();
      this.lastActiveAt = this.createdAt;

      await this.state.storage.put('meta', {
        roomCode: this.roomCode,
        createdAt: this.createdAt,
        lastActiveAt: this.lastActiveAt,
      });

      await this.resetInactivityAlarm();
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/info') {
      const isExpired = this.isExpired();
      const info: RoomInfoResponse = {
        roomCode: this.roomCode,
        participantCount: this.sessions.size,
        maxParticipants: 2,
        isFull: this.sessions.size >= 2,
        isExpired,
        createdAt: this.createdAt,
        expiresAt: this.lastActiveAt + this.inactivityTimeoutMs,
      };
      return new Response(JSON.stringify(info), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      if (this.isExpired()) {
        return new Response('Room expired', { status: 410 });
      }

      if (this.sessions.size >= 2) {
        return new Response('Room is full', { status: 403 });
      }

      // Create WebSocket pair
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      // Handle server-side WebSocket
      this.handleWebSocket(server);

      return new Response(null, {
        status: 101,
        // @ts-expect-error Cloudflare Workers ResponseInit supports webSocket
        webSocket: client,
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Durable Object Alarm triggered when room inactivity timeout elapses.
   */
  async alarm(): Promise<void> {
    const now = Date.now();
    if (now - this.lastActiveAt >= this.inactivityTimeoutMs || this.sessions.size === 0) {
      this.broadcast({
        type: 'room-expired',
        message: 'This room has expired due to inactivity.',
      });

      for (const [ws] of this.sessions.entries()) {
        try {
          ws.close(4000, 'Room expired');
        } catch {
          // ignore close error
        }
      }

      this.sessions.clear();
      await this.state.storage.deleteAll();
    } else {
      await this.resetInactivityAlarm();
    }
  }

  private isExpired(): boolean {
    if (!this.createdAt) return false;
    return Date.now() - this.lastActiveAt >= this.inactivityTimeoutMs;
  }

  private async resetInactivityAlarm(): Promise<void> {
    this.lastActiveAt = Date.now();
    await this.state.storage.setAlarm(this.lastActiveAt + this.inactivityTimeoutMs);
  }

  private handleWebSocket(ws: CFWebSocket | WebSocket): void {
    if ('accept' in ws && typeof (ws as CFWebSocket).accept === 'function') {
      (ws as CFWebSocket).accept();
    }

    ws.addEventListener('message', async (event: MessageEvent) => {
      try {
        await this.resetInactivityAlarm();

        const rawData = typeof event.data === 'string' ? event.data : '';
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawData);
        } catch {
          this.sendTo(ws, {
            type: 'error',
            code: 'INVALID_PAYLOAD',
            message: 'Malformed JSON frame',
          });
          return;
        }

        const validation = validateClientMessage(parsed);
        if (!validation.valid || !validation.sanitized) {
          this.sendTo(ws, {
            type: 'error',
            code: 'INVALID_PAYLOAD',
            message: validation.error || 'Invalid message structure',
          });
          return;
        }

        const msg: ClientMessage = validation.sanitized;
        await this.processMessage(ws, msg);
      } catch (err) {
        this.sendTo(ws, {
          type: 'error',
          code: 'SERVER_ERROR',
          message: 'Failed to process message',
        });
      }
    });

    const handleCloseOrError = () => {
      const session = this.sessions.get(ws);
      if (session) {
        this.sessions.delete(ws);
        this.broadcast({
          type: 'peer-left',
          participantId: session.participant.id,
          displayName: session.participant.displayName,
          participantCount: this.sessions.size,
        });
      }
    };

    ws.addEventListener('close', handleCloseOrError);
    ws.addEventListener('error', handleCloseOrError);
  }

  private async processMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case 'ping':
        this.sendTo(ws, { type: 'pong' });
        break;

      case 'join': {
        // Enforce maximum 2 participants
        if (this.sessions.size >= 2 && !this.sessions.has(ws)) {
          this.sendTo(ws, {
            type: 'error',
            code: 'ROOM_FULL',
            message: 'This room already has two participants.',
          });
          ws.close(4003, 'Room full');
          return;
        }

        const participant: Participant = {
          id: msg.participantId,
          displayName: msg.displayName,
          joinedAt: Date.now(),
        };

        const session: ParticipantSession = {
          participant,
          ws,
          rateLimiter: new SlidingWindowRateLimiter({
            windowMs: 10 * 1000,
            maxRequests: 30, // 30 messages per 10 seconds
          }),
          lastTypingBroadcast: 0,
        };

        this.sessions.set(ws, session);

        // Send current room state to newly joined participant
        const participants = Array.from(this.sessions.values()).map((s) => s.participant);
        this.sendTo(ws, {
          type: 'room-state',
          roomCode: this.roomCode,
          participantCount: this.sessions.size,
          participants,
          createdAt: this.createdAt,
          expiresAt: this.lastActiveAt + this.inactivityTimeoutMs,
        });

        // Notify peer about the new participant
        this.broadcastExcept(ws, {
          type: 'peer-joined',
          participant,
          participantCount: this.sessions.size,
        });
        break;
      }

      case 'key-exchange': {
        const session = this.sessions.get(ws);
        if (!session) {
          this.sendTo(ws, {
            type: 'error',
            code: 'UNAUTHORIZED',
            message: 'You must join before exchanging keys',
          });
          return;
        }

        // Relay the public key to the peer (never decrypts or touches private key)
        this.broadcastExcept(ws, {
          type: 'key-exchange',
          senderId: session.participant.id,
          publicKey: msg.publicKey,
        });
        break;
      }

      case 'message': {
        const session = this.sessions.get(ws);
        if (!session) {
          this.sendTo(ws, {
            type: 'error',
            code: 'UNAUTHORIZED',
            message: 'You must join before sending messages',
          });
          return;
        }

        // Rate limit check
        const rateCheck = session.rateLimiter.check(session.participant.id);
        if (!rateCheck.allowed) {
          this.sendTo(ws, {
            type: 'error',
            code: 'RATE_LIMITED',
            message: 'Message rate limit exceeded. Please wait a moment.',
          });
          return;
        }

        // Relay encrypted ciphertext verbatim to the peer
        this.broadcastExcept(ws, {
          type: 'message',
          senderId: session.participant.id,
          messageId: msg.messageId,
          iv: msg.iv,
          ciphertext: msg.ciphertext,
          timestamp: msg.timestamp,
        });
        break;
      }

      case 'typing': {
        const session = this.sessions.get(ws);
        if (!session) return;

        const now = Date.now();
        // Throttle typing broadcasts to once per 1 second
        if (now - session.lastTypingBroadcast < 1000) {
          return;
        }
        session.lastTypingBroadcast = now;

        this.broadcastExcept(ws, {
          type: 'typing',
          senderId: session.participant.id,
          isTyping: msg.isTyping,
        });
        break;
      }

      case 'leave': {
        const session = this.sessions.get(ws);
        if (session) {
          this.sessions.delete(ws);
          this.broadcast({
            type: 'peer-left',
            participantId: session.participant.id,
            displayName: session.participant.displayName,
            participantCount: this.sessions.size,
          });
          try {
            ws.close(1000, 'User left');
          } catch {
            // ignore
          }
        }
        break;
      }
    }
  }

  private sendTo(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // connection might be closing
    }
  }

  private broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const [ws] of this.sessions.entries()) {
      try {
        ws.send(payload);
      } catch {
        // ignore closed sockets
      }
    }
  }

  private broadcastExcept(excludedWs: WebSocket, message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const [ws] of this.sessions.entries()) {
      if (ws !== excludedWs) {
        try {
          ws.send(payload);
        } catch {
          // ignore closed sockets
        }
      }
    }
  }
}
