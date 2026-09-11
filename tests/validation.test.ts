import { describe, it, expect } from 'vitest';
import {
  validateRoomCode,
  validateUsername,
  validateMessagePayload,
  validateClientMessage,
  validatePublicKeyJwk,
} from '../worker/validation.ts';

describe('Server-Side Protocol & Input Validation', () => {
  describe('validateRoomCode', () => {
    it('accepts valid 6-8 character codes', () => {
      expect(validateRoomCode('K7M4PX').valid).toBe(true);
      expect(validateRoomCode(' 234567 ').valid).toBe(true);
      expect(validateRoomCode('23456789').valid).toBe(true);
    });

    it('rejects invalid room codes', () => {
      expect(validateRoomCode('').valid).toBe(false);
      expect(validateRoomCode('12345').valid).toBe(false); // too short
      expect(validateRoomCode('K7M4P0').valid).toBe(false); // contains '0'
      expect(validateRoomCode(null).valid).toBe(false);
      expect(validateRoomCode(123456).valid).toBe(false);
    });
  });

  describe('validateUsername', () => {
    it('accepts valid display names', () => {
      const res = validateUsername('Alex');
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe('Alex');
    });

    it('strips non-printable control characters', () => {
      const res = validateUsername('Alex\u0000\u0007');
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe('Alex');
    });

    it('rejects empty or whitespace-only names', () => {
      expect(validateUsername('').valid).toBe(false);
      expect(validateUsername('   ').valid).toBe(false);
      expect(validateUsername(undefined).valid).toBe(false);
    });

    it('rejects names exceeding max length', () => {
      const longName = 'A'.repeat(33);
      expect(validateUsername(longName).valid).toBe(false);
    });
  });

  describe('validateMessagePayload', () => {
    it('accepts well-formed encrypted message payloads', () => {
      const validPayload = {
        messageId: 'msg-12345',
        iv: 'A'.repeat(16), // 16-char base64 for 12 bytes
        ciphertext: 'base64ciphertextstring==',
        timestamp: Date.now(),
      };
      const res = validateMessagePayload(validPayload);
      expect(res.valid).toBe(true);
      expect(res.sanitized?.messageId).toBe('msg-12345');
    });

    it('rejects payloads with missing or malformed attributes', () => {
      expect(validateMessagePayload({}).valid).toBe(false);
      expect(validateMessagePayload({ messageId: '' }).valid).toBe(false);
      expect(validateMessagePayload({ messageId: '1', iv: 'short' }).valid).toBe(false);
      expect(
        validateMessagePayload({
          messageId: '1',
          iv: 'A'.repeat(16),
          ciphertext: '',
        }).valid
      ).toBe(false);
    });

    it('rejects timestamps with excessive clock drift', () => {
      const res = validateMessagePayload({
        messageId: 'msg-1',
        iv: 'A'.repeat(16),
        ciphertext: 'cipher',
        timestamp: Date.now() - 20 * 60 * 1000, // 20 mins ago
      });
      expect(res.valid).toBe(false);
    });
  });

  describe('validatePublicKeyJwk', () => {
    it('accepts valid EC P-256 public JWKs', () => {
      const jwk = {
        kty: 'EC',
        crv: 'P-256',
        x: 'f83OJ3D2xFmT4vGLKD_EEN09',
        y: 'x_da7W5PBEV5174bE_G-35b9',
      };
      const res = validatePublicKeyJwk(jwk);
      expect(res.valid).toBe(true);
      expect(res.sanitized?.kty).toBe('EC');
    });

    it('rejects non-EC or non-P-256 keys', () => {
      expect(validatePublicKeyJwk({ kty: 'RSA' }).valid).toBe(false);
      expect(validatePublicKeyJwk({ kty: 'EC', crv: 'P-384' }).valid).toBe(false);
      expect(validatePublicKeyJwk(null).valid).toBe(false);
    });
  });

  describe('validateClientMessage', () => {
    it('validates join message', () => {
      const res = validateClientMessage({
        type: 'join',
        roomCode: 'K7M4PX',
        participantId: 'user-1',
        displayName: 'Sam',
      });
      expect(res.valid).toBe(true);
      expect(res.sanitized?.type).toBe('join');
    });

    it('validates ping message', () => {
      const res = validateClientMessage({ type: 'ping' });
      expect(res.valid).toBe(true);
      expect(res.sanitized?.type).toBe('ping');
    });

    it('rejects unknown message type', () => {
      const res = validateClientMessage({ type: 'hack' });
      expect(res.valid).toBe(false);
    });
  });
});
