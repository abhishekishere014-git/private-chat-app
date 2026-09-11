/**
 * NEXUS Client-Side End-to-End Encryption Engine
 *
 * Implements browser-side Web Crypto API:
 * - ECDH P-256 for ephemeral key agreement
 * - HKDF-SHA-256 for symmetric key derivation with domain separation
 * - AES-256-GCM for authenticated message encryption & integrity verification
 * - Fresh 96-bit (12-byte) cryptographically secure IV per message
 * - Zero-knowledge relay: keys and plaintexts never leave the browser client
 */

import { CryptoError, EncryptedPayload } from './types.ts';

const PROTOCOL_CONTEXT = 'NEXUS-E2E-v1-AES-GCM-256';
const AES_KEY_LENGTH = 256;
const IV_LENGTH_BYTES = 12; // 96 bits recommended for AES-GCM

/**
 * Encodes a Uint8Array into a standard Base64 string.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string into a Uint8Array.
 */
export function base64ToBytes(base64: string): Uint8Array {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    throw new CryptoError('Failed to decode Base64 payload', err);
  }
}

/**
 * Generates an ephemeral ECDH keypair using P-256 curve.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  try {
    const subtle = globalThis.crypto.subtle;
    return await subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true, // extractable so public key can be exported
      ['deriveKey', 'deriveBits']
    );
  } catch (err) {
    throw new CryptoError('Failed to generate ECDH keypair', err);
  }
}

/**
 * Exports the public key to a standard JsonWebKey (JWK) representation for relay.
 */
export async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  try {
    const subtle = globalThis.crypto.subtle;
    const jwk = await subtle.exportKey('jwk', key);
    // Sanitize JWK to only include public attributes
    return {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
    };
  } catch (err) {
    throw new CryptoError('Failed to export public key to JWK', err);
  }
}

/**
 * Imports a peer's public key from JWK format.
 */
export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  try {
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y) {
      throw new Error('Invalid JWK format: expected EC P-256 key');
    }

    const subtle = globalThis.crypto.subtle;
    return await subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        x: jwk.x,
        y: jwk.y,
        ext: true,
      },
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
  } catch (err) {
    throw new CryptoError('Failed to import peer public key', err);
  }
}

/**
 * Derives a shared symmetric AES-GCM 256-bit encryption key using ECDH + HKDF-SHA-256.
 *
 * @param privateKey - Local participant's ECDH private key
 * @param peerPublicKey - Remote participant's imported ECDH public key
 * @param contextInfo - Domain separation string (defaults to protocol version)
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  contextInfo: string = PROTOCOL_CONTEXT
): Promise<CryptoKey> {
  try {
    const subtle = globalThis.crypto.subtle;

    // Step 1: Compute ECDH shared secret bits
    const sharedBits = await subtle.deriveBits(
      {
        name: 'ECDH',
        public: peerPublicKey,
      },
      privateKey,
      256
    );

    // Step 2: Import raw shared bits as HKDF key material
    const hkdfKey = await subtle.importKey(
      'raw',
      sharedBits,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    );

    // Step 3: Derive AES-GCM 256 key with HKDF-SHA-256
    const info = new TextEncoder().encode(contextInfo);
    // Protocol salt: fixed 16-byte zero salt per RFC 5869 when salt is omitted/static
    const salt = new Uint8Array(16);

    return await subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info,
      },
      hkdfKey,
      {
        name: 'AES-GCM',
        length: AES_KEY_LENGTH,
      },
      false, // non-extractable derived key
      ['encrypt', 'decrypt']
    );
  } catch (err) {
    throw new CryptoError('Failed to derive shared encryption key via ECDH/HKDF', err);
  }
}

/**
 * Encrypts a plaintext string with AES-256-GCM using a freshly generated 96-bit IV.
 */
export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<EncryptedPayload> {
  try {
    const subtle = globalThis.crypto.subtle;

    // Generate fresh, cryptographically secure 96-bit (12-byte) IV
    const iv = new Uint8Array(IV_LENGTH_BYTES);
    globalThis.crypto.getRandomValues(iv);

    const encoded = new TextEncoder().encode(plaintext);

    const ciphertextBuffer = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encoded
    );

    return {
      ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
      iv: bytesToBase64(iv),
    };
  } catch (err) {
    throw new CryptoError('Failed to encrypt message with AES-GCM', err);
  }
}

/**
 * Decrypts an AES-256-GCM ciphertext payload. Fails safely if authentication fails.
 */
export async function decryptMessage(
  key: CryptoKey,
  ciphertextBase64: string,
  ivBase64: string
): Promise<string> {
  try {
    const subtle = globalThis.crypto.subtle;

    const iv = base64ToBytes(ivBase64);
    if (iv.byteLength !== IV_LENGTH_BYTES) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH_BYTES} bytes, got ${iv.byteLength}`);
    }

    const ciphertext = base64ToBytes(ciphertextBase64);

    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    throw new CryptoError('Decryption failed: integrity authentication mismatch or invalid key', err);
  }
}
