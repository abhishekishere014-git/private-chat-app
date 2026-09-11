/**
 * Hook: useCryptoSession
 *
 * Manages client-side Web Crypto API keypair, key exchange,
 * and AES-256-GCM encryption/decryption.
 *
 * Safety:
 * - Private keys are never exported or sent anywhere.
 * - Derived AES key is non-extractable.
 * - Fresh 96-bit IV generated for each message.
 * - isEncrypted is strictly false until shared secret is successfully derived.
 */

import { useState, useRef, useCallback } from 'react';
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
} from '../crypto/e2e.ts';
import { EncryptedPayload } from '../crypto/types.ts';

export interface CryptoSessionState {
  isKeyReady: boolean;
  isEncrypted: boolean;
  fingerprint: string | null;
  publicKeyJwk: JsonWebKey | null;
}

export function useCryptoSession() {
  const [state, setState] = useState<CryptoSessionState>({
    isKeyReady: false,
    isEncrypted: false,
    fingerprint: null,
    publicKeyJwk: null,
  });

  const keyPairRef = useRef<CryptoKeyPair | null>(null);
  const sharedKeyRef = useRef<CryptoKey | null>(null);
  const peerKeyRef = useRef<CryptoKey | null>(null);

  /**
   * Initializes local ephemeral ECDH keypair and prepares public key for exchange.
   */
  const initializeSession = useCallback(async (): Promise<JsonWebKey> => {
    const keyPair = await generateKeyPair();
    keyPairRef.current = keyPair;

    const jwk = await exportPublicKey(keyPair.publicKey);

    setState((prev) => ({
      ...prev,
      isKeyReady: true,
      publicKeyJwk: jwk,
    }));

    return jwk;
  }, []);

  /**
   * Derives shared secret when peer's public key is received via relay.
   */
  const handlePeerPublicKey = useCallback(async (peerJwk: JsonWebKey): Promise<void> => {
    if (!keyPairRef.current) {
      throw new Error('Local keypair not yet generated');
    }

    const peerKey = await importPublicKey(peerJwk);
    peerKeyRef.current = peerKey;

    const sharedKey = await deriveSharedSecret(
      keyPairRef.current.privateKey,
      peerKey
    );
    sharedKeyRef.current = sharedKey;

    // Calculate a deterministic session fingerprint from both public keys for the inspector
    let fingerprint = 'E2E-ACTIVE';
    try {
      const myJwk = state.publicKeyJwk;
      const combined = `${myJwk?.x || ''}:${myJwk?.y || ''}:${peerJwk.x || ''}:${peerJwk.y || ''}`;
      const hashBuffer = await globalThis.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(combined)
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      fingerprint = hashHex.slice(0, 12).toUpperCase().match(/.{1,4}/g)?.join('-') || 'SECURE';
    } catch {
      // fallback
    }

    setState((prev) => ({
      ...prev,
      isEncrypted: true,
      fingerprint,
    }));
  }, [state.publicKeyJwk]);

  /**
   * Encrypts plaintext message with the derived AES-256-GCM key.
   */
  const encrypt = useCallback(async (plaintext: string): Promise<EncryptedPayload> => {
    if (!sharedKeyRef.current) {
      throw new Error('E2E session not established yet');
    }
    return await encryptMessage(sharedKeyRef.current, plaintext);
  }, []);

  /**
   * Decrypts incoming ciphertext message with the derived AES-256-GCM key.
   */
  const decrypt = useCallback(async (ciphertext: string, iv: string): Promise<string> => {
    if (!sharedKeyRef.current) {
      throw new Error('E2E session not established yet');
    }
    return await decryptMessage(sharedKeyRef.current, ciphertext, iv);
  }, []);

  /**
   * Cleans up keys from memory upon leaving or disconnecting.
   */
  const resetCrypto = useCallback(() => {
    keyPairRef.current = null;
    sharedKeyRef.current = null;
    peerKeyRef.current = null;
    setState({
      isKeyReady: false,
      isEncrypted: false,
      fingerprint: null,
      publicKeyJwk: null,
    });
  }, []);

  return {
    isKeyReady: state.isKeyReady,
    isEncrypted: state.isEncrypted,
    fingerprint: state.fingerprint,
    publicKeyJwk: state.publicKeyJwk,
    initializeSession,
    handlePeerPublicKey,
    encrypt,
    decrypt,
    resetCrypto,
  };
}
