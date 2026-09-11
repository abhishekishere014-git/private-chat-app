/**
 * NEXUS Server-Side Validation Module
 *
 * Enforces zero-trust validation for all client inputs:
 * - Room codes
 * - User display names
 * - Encrypted message payloads
 * - Key exchange JWKs
 */

import { ROOM_CODE_REGEX } from '../src/utils/room-code.ts';
import { ClientMessage } from '../src/types/protocol.ts';

export const MAX_USERNAME_LENGTH = 32;
export const MIN_USERNAME_LENGTH = 1;
export const MAX_CIPHERTEXT_LENGTH = 6 * 1024 * 1024; // 6 MB max encrypted message/file
export const MAX_MESSAGE_ID_LENGTH = 64;

export interface ValidationResult<T = unknown> {
  valid: boolean;
  error?: string;
  sanitized?: T;
}

/**
 * Validates and normalizes room code.
 */
export function validateRoomCode(code: unknown): ValidationResult<string> {
  if (typeof code !== 'string') {
    return { valid: false, error: 'Room code must be a string' };
  }
  const cleanCode = code.trim().toUpperCase();
  if (!ROOM_CODE_REGEX.test(cleanCode)) {
    return {
      valid: false,
      error: 'Invalid room code format. Must be 6-8 characters without ambiguous characters.',
    };
  }
  return { valid: true, sanitized: cleanCode };
}

/**
 * Validates and sanitizes a user display name.
 * Disallows control characters and excessive length.
 */
export function validateUsername(name: unknown): ValidationResult<string> {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Display name must be a string' };
  }

  // Strip non-printable/control characters
  const cleaned = name.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();

  if (cleaned.length < MIN_USERNAME_LENGTH) {
    return { valid: false, error: 'Display name cannot be empty' };
  }
  if (cleaned.length > MAX_USERNAME_LENGTH) {
    return { valid: false, error: `Display name cannot exceed ${MAX_USERNAME_LENGTH} characters` };
  }

  return { valid: true, sanitized: cleaned };
}

/**
 * Validates a public key JWK object received during ephemeral key exchange.
 */
export function validatePublicKeyJwk(jwk: unknown): ValidationResult<JsonWebKey> {
  if (!jwk || typeof jwk !== 'object') {
    return { valid: false, error: 'Public key must be a valid object' };
  }

  const key = jwk as Record<string, unknown>;
  if (key.kty !== 'EC') {
    return { valid: false, error: 'Invalid key type: expected EC' };
  }
  if (key.crv !== 'P-256') {
    return { valid: false, error: 'Invalid curve: expected P-256' };
  }
  if (typeof key.x !== 'string' || !key.x || typeof key.y !== 'string' || !key.y) {
    return { valid: false, error: 'Invalid coordinate parameters in public key' };
  }

  return {
    valid: true,
    sanitized: {
      kty: 'EC',
      crv: 'P-256',
      x: key.x,
      y: key.y,
    },
  };
}

/**
 * Validates an encrypted message envelope sent over the WebSocket relay.
 */
export function validateMessagePayload(payload: unknown): ValidationResult<{
  messageId: string;
  iv: string;
  ciphertext: string;
  timestamp: number;
}> {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Message payload must be an object' };
  }

  const p = payload as Record<string, unknown>;

  // messageId
  if (typeof p.messageId !== 'string' || !p.messageId || p.messageId.length > MAX_MESSAGE_ID_LENGTH) {
    return { valid: false, error: 'Invalid messageId' };
  }

  // iv - 12 bytes encoded in Base64 is 16 characters
  if (typeof p.iv !== 'string' || p.iv.length < 12 || p.iv.length > 24) {
    return { valid: false, error: 'Invalid IV format or length' };
  }

  // ciphertext
  if (typeof p.ciphertext !== 'string' || !p.ciphertext) {
    return { valid: false, error: 'Missing ciphertext' };
  }
  if (p.ciphertext.length > MAX_CIPHERTEXT_LENGTH) {
    return { valid: false, error: `Ciphertext exceeds max size limit of ${MAX_CIPHERTEXT_LENGTH} bytes` };
  }

  // timestamp
  const now = Date.now();
  const ts = typeof p.timestamp === 'number' ? p.timestamp : now;
  // Allow small clock skew (within 10 minutes in past or future)
  if (Math.abs(now - ts) > 10 * 60 * 1000) {
    return { valid: false, error: 'Message timestamp skew too large' };
  }

  return {
    valid: true,
    sanitized: {
      messageId: p.messageId,
      iv: p.iv,
      ciphertext: p.ciphertext,
      timestamp: ts,
    },
  };
}

/**
 * Validates any incoming raw client message against the NEXUS WebSocket protocol.
 */
export function validateClientMessage(raw: unknown): ValidationResult<ClientMessage> {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Message must be a valid JSON object' };
  }

  const msg = raw as Record<string, unknown>;
  if (typeof msg.type !== 'string') {
    return { valid: false, error: 'Message type must be specified' };
  }

  switch (msg.type) {
    case 'ping':
      return { valid: true, sanitized: { type: 'ping' } };

    case 'join': {
      const roomCheck = validateRoomCode(msg.roomCode);
      if (!roomCheck.valid) return { valid: false, error: roomCheck.error };

      const nameCheck = validateUsername(msg.displayName);
      if (!nameCheck.valid) return { valid: false, error: nameCheck.error };

      if (typeof msg.participantId !== 'string' || !msg.participantId) {
        return { valid: false, error: 'Missing participantId' };
      }

      return {
        valid: true,
        sanitized: {
          type: 'join',
          roomCode: roomCheck.sanitized!,
          participantId: msg.participantId.slice(0, 64),
          displayName: nameCheck.sanitized!,
        },
      };
    }

    case 'key-exchange': {
      const roomCheck = validateRoomCode(msg.roomCode);
      if (!roomCheck.valid) return { valid: false, error: roomCheck.error };

      const keyCheck = validatePublicKeyJwk(msg.publicKey);
      if (!keyCheck.valid) return { valid: false, error: keyCheck.error };

      if (typeof msg.senderId !== 'string' || !msg.senderId) {
        return { valid: false, error: 'Missing senderId' };
      }

      return {
        valid: true,
        sanitized: {
          type: 'key-exchange',
          roomCode: roomCheck.sanitized!,
          senderId: msg.senderId,
          publicKey: keyCheck.sanitized!,
        },
      };
    }

    case 'message': {
      const roomCheck = validateRoomCode(msg.roomCode);
      if (!roomCheck.valid) return { valid: false, error: roomCheck.error };

      const payloadCheck = validateMessagePayload(msg);
      if (!payloadCheck.valid) return { valid: false, error: payloadCheck.error };

      if (typeof msg.senderId !== 'string' || !msg.senderId) {
        return { valid: false, error: 'Missing senderId' };
      }

      return {
        valid: true,
        sanitized: {
          type: 'message',
          roomCode: roomCheck.sanitized!,
          senderId: msg.senderId,
          messageId: payloadCheck.sanitized!.messageId,
          iv: payloadCheck.sanitized!.iv,
          ciphertext: payloadCheck.sanitized!.ciphertext,
          timestamp: payloadCheck.sanitized!.timestamp,
        },
      };
    }

    case 'typing': {
      const roomCheck = validateRoomCode(msg.roomCode);
      if (!roomCheck.valid) return { valid: false, error: roomCheck.error };

      if (typeof msg.senderId !== 'string' || !msg.senderId) {
        return { valid: false, error: 'Missing senderId' };
      }

      return {
        valid: true,
        sanitized: {
          type: 'typing',
          roomCode: roomCheck.sanitized!,
          senderId: msg.senderId,
          isTyping: Boolean(msg.isTyping),
        },
      };
    }

    case 'leave': {
      const roomCheck = validateRoomCode(msg.roomCode);
      if (!roomCheck.valid) return { valid: false, error: roomCheck.error };

      if (typeof msg.senderId !== 'string' || !msg.senderId) {
        return { valid: false, error: 'Missing senderId' };
      }

      return {
        valid: true,
        sanitized: {
          type: 'leave',
          roomCode: roomCheck.sanitized!,
          senderId: msg.senderId,
        },
      };
    }

    default:
      return { valid: false, error: `Unknown message type: ${String(msg.type)}` };
  }
}
