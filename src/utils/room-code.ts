/**
 * Cryptographically Secure Room Code Generator & Validator
 *
 * Rules:
 * - 6 characters by default (configurable 6-8)
 * - Uppercase alphanumeric
 * - Avoid ambiguous characters: 0 (zero), O (letter O), 1 (one), I (letter I), L (letter L)
 * - Character set size: 32 (5 bits of entropy per character => 30 bits for 6 chars = ~1.07 billion space)
 * - Source of randomness: crypto.getRandomValues()
 */

export const ROOM_CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_REGEX = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6,8}$/;

/**
 * Generates a cryptographically secure room code.
 * Uses crypto.getRandomValues to eliminate bias.
 */
export function generateRoomCode(length: number = ROOM_CODE_LENGTH): string {
  if (length < 6 || length > 8) {
    throw new Error('Room code length must be between 6 and 8 characters');
  }

  const charsetLength = ROOM_CODE_CHARSET.length; // 31

  // Use globalThis.crypto for cross-environment compatibility (Browser, Worker, Node)
  const cryptoObj = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : null;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographically secure randomness is not available in this environment');
  }

  // 31 * 8 = 248. Discarding bytes >= 248 eliminates all modulo bias completely.
  const limit = Math.floor(256 / charsetLength) * charsetLength;
  const buffer = new Uint8Array(32);
  let bufferIndex = 32;

  let code = '';
  while (code.length < length) {
    if (bufferIndex >= buffer.length) {
      cryptoObj.getRandomValues(buffer);
      bufferIndex = 0;
    }
    const byte = buffer[bufferIndex++];
    if (byte < limit) {
      code += ROOM_CODE_CHARSET[byte % charsetLength];
    }
  }

  return code;
}

/**
 * Normalizes a user-input room code (removes whitespace and dashes, converts to uppercase).
 */
export function normalizeRoomCode(input: string): string {
  return input.replace(/[\s\-_]/g, '').toUpperCase();
}

/**
 * Validates whether a room code adheres to the security and character set rules.
 */
export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code);
}
