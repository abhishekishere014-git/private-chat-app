/**
 * NEXUS Server Relay (Zero-Knowledge Room Relay Engine)
 *
 * Implements the server-side room management and WebSocket relay for
 * Node/Vite environments. Behaves identically to the Cloudflare RoomDurableObject:
 * - Maximum 2 participants per room
 * - Zero-knowledge message relay (only forwards encrypted payloads)
 * - Inactivity expiration (15 minutes default)
 * - Validates all frames server-side
 * - Disconnect / reconnect resilience
 */

import { IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  ClientMessage,
  Participant,
  ServerMessage,
  RoomInfoResponse,
} from '../src/types/protocol.ts';
import { generateRoomCode, normalizeRoomCode, isValidRoomCode } from '../src/utils/room-code.ts';
import { validateClientMessage } from '../worker/validation.ts';
import { SlidingWindowRateLimiter, roomCreationLimiter, joinAttemptLimiter } from '../worker/rate-limit.ts';

const DEFAULT_INACTIVITY_MS = 15 * 60 * 1000; // 15 mins

interface ParticipantSession {
  participant: Participant;
  ws: WebSocket;
  rateLimiter: SlidingWindowRateLimiter;
  lastTypingBroadcast: number;
}

interface RoomRecord {
  code: string;
  createdAt: number;
  lastActiveAt: number;
  sessions: Map<WebSocket, ParticipantSession>;
  timer: NodeJS.Timeout | null;
}

export class NexusRelayServer {
  private rooms: Map<string, RoomRecord> = new Map();
  public wss: WebSocketServer;

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupWss();
  }

  /**
   * HTTP handler for REST endpoints:
   * - POST /api/rooms
   * - GET /api/rooms/:code/info
   */
  public handleHttpRequest(
    req: IncomingMessage,
    clientIp: string,
    onResponse: (statusCode: number, headers: Record<string, string>, body: string) => void
  ): boolean {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      const rateCheck = roomCreationLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        onResponse(
          429,
          { 'Content-Type': 'application/json', 'Retry-After': Math.ceil(rateCheck.retryAfterMs / 1000).toString() },
          JSON.stringify({ error: 'Too many rooms created. Please wait.' })
        );
        return true;
      }

      const room = this.createRoom();
      onResponse(
        201,
        { 'Content-Type': 'application/json' },
        JSON.stringify({
          roomCode: room.code,
          createdAt: room.createdAt,
          expiresInMinutes: 15,
        })
      );
      return true;
    }

    const infoMatch = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9_-]+)\/info$/);
    if (infoMatch && req.method === 'GET') {
      const roomCode = normalizeRoomCode(infoMatch[1]);
      if (!isValidRoomCode(roomCode)) {
        onResponse(400, { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'Invalid room code format' }));
        return true;
      }

      const rateCheck = joinAttemptLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        onResponse(429, { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'Too many attempts. Please wait.' }));
        return true;
      }

      const room = this.rooms.get(roomCode);
      if (!room) {
        onResponse(404, { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'Room not found or expired' }));
        return true;
      }

      const info: RoomInfoResponse = {
        roomCode: room.code,
        participantCount: room.sessions.size,
        maxParticipants: 2,
        isFull: room.sessions.size >= 2,
        isExpired: false,
        createdAt: room.createdAt,
        expiresAt: room.lastActiveAt + DEFAULT_INACTIVITY_MS,
      };

      onResponse(200, { 'Content-Type': 'application/json' }, JSON.stringify(info));
      return true;
    }

    return false;
  }

  /**
   * Creates an active ephemeral room.
   */
  public createRoom(specifiedCode?: string): RoomRecord {
    const code = specifiedCode || generateRoomCode();
    const existing = this.rooms.get(code);
    if (existing) {
      if (existing.timer) clearTimeout(existing.timer);
    }

    const now = Date.now();
    const room: RoomRecord = {
      code,
      createdAt: now,
      lastActiveAt: now,
      sessions: new Map(),
      timer: null,
    };

    this.scheduleExpiration(room);
    this.rooms.set(code, room);
    return room;
  }

  public getRoom(code: string): RoomRecord | undefined {
    return this.rooms.get(normalizeRoomCode(code));
  }

  private scheduleExpiration(room: RoomRecord): void {
    if (room.timer) {
      clearTimeout(room.timer);
    }

    room.timer = setTimeout(() => {
      this.expireRoom(room.code);
    }, DEFAULT_INACTIVITY_MS);
  }

  private expireRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const expiredMsg: ServerMessage = {
      type: 'room-expired',
      message: 'This room has expired due to 15 minutes of inactivity.',
    };

    for (const [ws] of room.sessions.entries()) {
      try {
        ws.send(JSON.stringify(expiredMsg));
        ws.close(4000, 'Room expired');
      } catch {
        // ignore
      }
    }

    room.sessions.clear();
    this.rooms.delete(roomCode);
  }

  private setupWss(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const match = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9_-]+)\/ws$/);

      if (!match) {
        ws.close(4004, 'Invalid endpoint');
        return;
      }

      const roomCode = normalizeRoomCode(match[1]);
      if (!isValidRoomCode(roomCode)) {
        ws.close(4000, 'Invalid room code');
        return;
      }

      let room = this.rooms.get(roomCode);
      if (!room) {
        // Allow room to be joined if created via POST or create on the fly if valid
        room = this.createRoom(roomCode);
      }

      if (room.sessions.size >= 2) {
        try {
          const err: ServerMessage = {
            type: 'error',
            code: 'ROOM_FULL',
            message: 'This room already has two participants.',
          };
          ws.send(JSON.stringify(err));
        } catch {
          // ignore
        }
        ws.close(4003, 'Room full');
        return;
      }

      ws.on('message', (raw: Buffer | string) => {
        try {
          const rawStr = raw.toString();
          let parsed: unknown;
          try {
            parsed = JSON.parse(rawStr);
          } catch {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'INVALID_PAYLOAD',
              message: 'Malformed JSON payload',
            }));
            return;
          }

          const validation = validateClientMessage(parsed);
          if (!validation.valid || !validation.sanitized) {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'INVALID_PAYLOAD',
              message: validation.error || 'Invalid message payload',
            }));
            return;
          }

          const currentRoom = this.rooms.get(roomCode);
          if (!currentRoom) {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'ROOM_EXPIRED',
              message: 'Room has expired',
            }));
            ws.close(4000, 'Room expired');
            return;
          }

          // Reset inactivity timer on any activity
          currentRoom.lastActiveAt = Date.now();
          this.scheduleExpiration(currentRoom);

          this.handleClientMessage(currentRoom, ws, validation.sanitized);
        } catch (err) {
          try {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'SERVER_ERROR',
              message: 'Failed to process message',
            }));
          } catch {
            // ignore
          }
        }
      });

      const handleClose = () => {
        const currentRoom = this.rooms.get(roomCode);
        if (!currentRoom) return;

        const session = currentRoom.sessions.get(ws);
        if (session) {
          currentRoom.sessions.delete(ws);
          this.broadcast(currentRoom, {
            type: 'peer-left',
            participantId: session.participant.id,
            displayName: session.participant.displayName,
            participantCount: currentRoom.sessions.size,
          });
        }
      };

      ws.on('close', handleClose);
      ws.on('error', handleClose);
    });
  }

  private handleClientMessage(room: RoomRecord, ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case 'ping':
        try {
          ws.send(JSON.stringify({ type: 'pong' }));
        } catch {
          // ignore
        }
        break;

      case 'join': {
        if (room.sessions.size >= 2 && !room.sessions.has(ws)) {
          const err: ServerMessage = {
            type: 'error',
            code: 'ROOM_FULL',
            message: 'This room already has two participants.',
          };
          ws.send(JSON.stringify(err));
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
            maxRequests: 30,
          }),
          lastTypingBroadcast: 0,
        };

        room.sessions.set(ws, session);

        // 1. Send current room state to joining participant
        const participants = Array.from(room.sessions.values()).map((s) => s.participant);
        const stateMsg: ServerMessage = {
          type: 'room-state',
          roomCode: room.code,
          participantCount: room.sessions.size,
          participants,
          createdAt: room.createdAt,
          expiresAt: room.lastActiveAt + DEFAULT_INACTIVITY_MS,
        };
        ws.send(JSON.stringify(stateMsg));

        // 2. Notify existing peer about the new participant
        this.broadcastExcept(room, ws, {
          type: 'peer-joined',
          participant,
          participantCount: room.sessions.size,
        });
        break;
      }

      case 'key-exchange': {
        const session = room.sessions.get(ws);
        if (!session) {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'UNAUTHORIZED',
            message: 'Must join room before key exchange',
          }));
          return;
        }

        // Forward public key to peer without inspecting or touching private data
        this.broadcastExcept(room, ws, {
          type: 'key-exchange',
          senderId: session.participant.id,
          publicKey: msg.publicKey,
        });
        break;
      }

      case 'message': {
        const session = room.sessions.get(ws);
        if (!session) {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'UNAUTHORIZED',
            message: 'Must join room before messaging',
          }));
          return;
        }

        const rateCheck = session.rateLimiter.check(session.participant.id);
        if (!rateCheck.allowed) {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'RATE_LIMITED',
            message: 'Message rate limit exceeded. Please wait a moment.',
          }));
          return;
        }

        // Forward encrypted ciphertext payload to peer verbatim
        this.broadcastExcept(room, ws, {
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
        const session = room.sessions.get(ws);
        if (!session) return;

        const now = Date.now();
        if (now - session.lastTypingBroadcast < 1000) return;
        session.lastTypingBroadcast = now;

        this.broadcastExcept(room, ws, {
          type: 'typing',
          senderId: session.participant.id,
          isTyping: msg.isTyping,
        });
        break;
      }

      case 'leave': {
        const session = room.sessions.get(ws);
        if (session) {
          room.sessions.delete(ws);
          this.broadcast(room, {
            type: 'peer-left',
            participantId: session.participant.id,
            displayName: session.participant.displayName,
            participantCount: room.sessions.size,
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

  private broadcast(room: RoomRecord, message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const [ws] of room.sessions.entries()) {
      try {
        ws.send(payload);
      } catch {
        // ignore
      }
    }
  }

  private broadcastExcept(room: RoomRecord, excludedWs: WebSocket, message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const [ws] of room.sessions.entries()) {
      if (ws !== excludedWs) {
        try {
          ws.send(payload);
        } catch {
          // ignore
        }
      }
    }
  }
}
