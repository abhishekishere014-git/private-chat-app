import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
  bytesToBase64,
  base64ToBytes,
} from '../src/crypto/e2e.ts';

describe('Client-Side E2E Cryptographic Engine', () => {
  it('generates a valid ECDH P-256 keypair', async () => {
    const pair = await generateKeyPair();
    expect(pair).toBeDefined();
    expect(pair.publicKey).toBeDefined();
    expect(pair.privateKey).toBeDefined();
    expect(pair.publicKey.algorithm.name).toBe('ECDH');
    expect((pair.publicKey.algorithm as EcKeyGenParams).namedCurve).toBe('P-256');
  });

  it('exports and imports public key via JWK format', async () => {
    const pair = await generateKeyPair();
    const jwk = await exportPublicKey(pair.publicKey);

    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
    expect(jwk.x).toBeDefined();
    expect(jwk.y).toBeDefined();
    // Private attributes (d) must NOT be present in public key export
    expect((jwk as Record<string, unknown>).d).toBeUndefined();

    const imported = await importPublicKey(jwk);
    expect(imported).toBeDefined();
    expect(imported.algorithm.name).toBe('ECDH');
  });

  it('derives identical shared secrets for two communicating peers (Alice & Bob)', async () => {
    const alicePair = await generateKeyPair();
    const bobPair = await generateKeyPair();

    const alicePublicJwk = await exportPublicKey(alicePair.publicKey);
    const bobPublicJwk = await exportPublicKey(bobPair.publicKey);

    const aliceImportedBob = await importPublicKey(bobPublicJwk);
    const bobImportedAlice = await importPublicKey(alicePublicJwk);

    const aliceSecretKey = await deriveSharedSecret(alicePair.privateKey, aliceImportedBob);
    const bobSecretKey = await deriveSharedSecret(bobPair.privateKey, bobImportedAlice);

    expect(aliceSecretKey).toBeDefined();
    expect(bobSecretKey).toBeDefined();

    // Verify both keys can encrypt and decrypt each other's messages
    const plaintext = 'Classified message from Alice to Bob.';
    const encryptedByAlice = await encryptMessage(aliceSecretKey, plaintext);
    const decryptedByBob = await decryptMessage(bobSecretKey, encryptedByAlice.ciphertext, encryptedByAlice.iv);

    expect(decryptedByBob).toBe(plaintext);
  });

  it('generates fresh 96-bit IV for each message encryption', async () => {
    const pair = await generateKeyPair();
    const jwk = await exportPublicKey(pair.publicKey);
    const imported = await importPublicKey(jwk);
    const key = await deriveSharedSecret(pair.privateKey, imported);

    const msg = 'Test uniqueness of IV';
    const enc1 = await encryptMessage(key, msg);
    const enc2 = await encryptMessage(key, msg);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);

    // 12 bytes = 16 base64 characters
    const ivBytes1 = base64ToBytes(enc1.iv);
    const ivBytes2 = base64ToBytes(enc2.iv);
    expect(ivBytes1.byteLength).toBe(12);
    expect(ivBytes2.byteLength).toBe(12);
  });

  it('rejects tampered ciphertext during AES-GCM decryption', async () => {
    const pair = await generateKeyPair();
    const jwk = await exportPublicKey(pair.publicKey);
    const imported = await importPublicKey(jwk);
    const key = await deriveSharedSecret(pair.privateKey, imported);

    const plaintext = 'Authentic unmodified payload';
    const { ciphertext, iv } = await encryptMessage(key, plaintext);

    // Tamper with ciphertext by flipping a bit
    const cipherBytes = base64ToBytes(ciphertext);
    cipherBytes[0] ^= 0x01;
    const tamperedCiphertext = bytesToBase64(cipherBytes);

    await expect(decryptMessage(key, tamperedCiphertext, iv)).rejects.toThrow();
  });

  it('rejects decryption when using a different key (wrong-key rejection)', async () => {
    const alicePair = await generateKeyPair();
    const bobPair = await generateKeyPair();
    const evePair = await generateKeyPair();

    // Alice and Bob share a secret
    const bobJwk = await exportPublicKey(bobPair.publicKey);
    const aliceSecretKey = await deriveSharedSecret(alicePair.privateKey, await importPublicKey(bobJwk));

    // Eve tries to derive a key with Alice
    const eveSecretKey = await deriveSharedSecret(evePair.privateKey, await importPublicKey(bobJwk));

    const plaintext = 'Secret Alice transmission';
    const { ciphertext, iv } = await encryptMessage(aliceSecretKey, plaintext);

    // Eve attempts decryption with her key
    await expect(decryptMessage(eveSecretKey, ciphertext, iv)).rejects.toThrow();
  });
});
