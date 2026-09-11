import { describe, it, expect } from 'vitest';
import {
  generateRoomCode,
  normalizeRoomCode,
  isValidRoomCode,
  ROOM_CODE_CHARSET,
  ROOM_CODE_LENGTH,
} from '../src/utils/room-code.ts';

describe('Room Code Generator & Validator', () => {
  it('generates a code with the expected default length (6)', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect(typeof code).toBe('string');
  });

  it('supports custom lengths between 6 and 8', () => {
    expect(generateRoomCode(6)).toHaveLength(6);
    expect(generateRoomCode(7)).toHaveLength(7);
    expect(generateRoomCode(8)).toHaveLength(8);
    expect(() => generateRoomCode(5)).toThrow();
    expect(() => generateRoomCode(9)).toThrow();
  });

  it('contains ONLY allowed characters from the unambiguous 32-character set', () => {
    const code = generateRoomCode();
    for (const char of code) {
      expect(ROOM_CODE_CHARSET).toContain(char);
    }
  });

  it('strictly excludes ambiguous characters (0, O, 1, I, L)', () => {
    expect(ROOM_CODE_CHARSET).not.toContain('0');
    expect(ROOM_CODE_CHARSET).not.toContain('O');
    expect(ROOM_CODE_CHARSET).not.toContain('1');
    expect(ROOM_CODE_CHARSET).not.toContain('I');
    expect(ROOM_CODE_CHARSET).not.toContain('L');

    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it('generates unique codes with high entropy over multiple generations', () => {
    const set = new Set<string>();
    const count = 500;
    for (let i = 0; i < count; i++) {
      set.add(generateRoomCode());
    }
    // Collisions should not occur across 500 items in a 1.07-billion keyspace
    expect(set.size).toBe(count);
  });

  it('normalizes user input correctly', () => {
    expect(normalizeRoomCode(' k7m 4px ')).toBe('K7M4PX');
    expect(normalizeRoomCode('k7-m4_px')).toBe('K7M4PX');
    expect(normalizeRoomCode('abc-def')).toBe('ABCDEF');
  });

  it('validates conforming and non-conforming room codes', () => {
    expect(isValidRoomCode('K7M4PX')).toBe(true);
    expect(isValidRoomCode('234567')).toBe(true);
    expect(isValidRoomCode('2345678')).toBe(true);
    expect(isValidRoomCode('23456789')).toBe(true);

    // Invalid length
    expect(isValidRoomCode('K7M4P')).toBe(false);
    expect(isValidRoomCode('K7M4PX999')).toBe(false);

    // Contains ambiguous characters
    expect(isValidRoomCode('K7M4P0')).toBe(false); // 0
    expect(isValidRoomCode('K7M4PO')).toBe(false); // O
    expect(isValidRoomCode('K7M4P1')).toBe(false); // 1
    expect(isValidRoomCode('K7M4PI')).toBe(false); // I
    expect(isValidRoomCode('K7M4PL')).toBe(false); // L

    // Lowercase without normalization is invalid
    expect(isValidRoomCode('k7m4px')).toBe(false);
  });
});
