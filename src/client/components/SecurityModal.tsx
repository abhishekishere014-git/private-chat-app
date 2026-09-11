/**
 * NEXUS Security Architecture Modal
 *
 * Honest, technically accurate explanation of the cryptographic model.
 */

import React from 'react';
import { Shield, Lock, Key, Server, Clock, AlertTriangle, X } from 'lucide-react';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="security-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        id="security-modal-content"
        className="relative w-full max-w-xl bg-[#0D0F12] border border-[#1F242D] rounded-xl shadow-2xl p-6 text-[#EDEDED] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="security-modal-title"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#1F242D]">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-[#38BDF8]" />
            <h2 id="security-modal-title" className="text-base font-semibold tracking-tight text-[#EDEDED]">
              Security & Cryptographic Architecture
            </h2>
          </div>
          <button
            id="security-modal-close-btn"
            onClick={onClose}
            className="p-1 rounded-md text-[#8A909E] hover:text-[#EDEDED] hover:bg-[#111318] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5 text-sm leading-relaxed text-[#8A909E]">
          {/* Key Agreement */}
          <div className="flex gap-3">
            <Key className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-[#EDEDED] text-xs uppercase tracking-wider mb-1">
                Ephemeral Key Agreement (ECDH P-256)
              </h3>
              <p>
                Each participant generates an ephemeral elliptic curve keypair in their local browser using the native
                Web Crypto API. Private keys stay in browser memory and are never transmitted or stored.
              </p>
            </div>
          </div>

          {/* Key Derivation */}
          <div className="flex gap-3">
            <Lock className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-[#EDEDED] text-xs uppercase tracking-wider mb-1">
                Authenticated Encryption (HKDF & AES-256-GCM)
              </h3>
              <p>
                The shared secret is derived using HKDF-SHA-256 with explicit domain separation. Messages are
                encrypted using AES-256-GCM with a freshly generated, cryptographically secure 96-bit (12-byte) IV for
                every single message. IVs are never reused.
              </p>
            </div>
          </div>

          {/* Zero-Knowledge Relay */}
          <div className="flex gap-3">
            <Server className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-[#EDEDED] text-xs uppercase tracking-wider mb-1">
                Zero-Knowledge Relay
              </h3>
              <p>
                The server (Cloudflare Durable Object / Edge Relay) operates purely as a blind router. It forwards
                ciphertext envelopes and never has access to private keys or plaintext message data.
              </p>
            </div>
          </div>

          {/* Expiration */}
          <div className="flex gap-3">
            <Clock className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-[#EDEDED] text-xs uppercase tracking-wider mb-1">
                Automatic Ephemeral Expiration
              </h3>
              <p>
                Rooms expire automatically after 15 minutes of inactivity. All server-side references are purged, and
                no conversation archives or logs are maintained.
              </p>
            </div>
          </div>

          {/* Honest Threat Model Notice */}
          <div className="p-3.5 bg-[#111318] border border-[#1F242D] rounded-lg">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#EDEDED] uppercase tracking-wider mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Honest Threat Model & Boundaries
            </div>
            <p className="text-xs text-[#8A909E] leading-normal">
              NEXUS protects <strong className="text-[#EDEDED]">message confidentiality and integrity</strong>. However,
              it does not claim complete network anonymity. Network operators and cloud edge nodes can observe metadata
              such as IP addresses, connection timestamps, and frame lengths. If network-level anonymity is required,
              use an anonymity network such as Tor.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[#1F242D] flex justify-end">
          <button
            id="security-modal-dismiss-btn"
            onClick={onClose}
            className="px-4 py-2 bg-[#111318] hover:bg-[#1F242D] text-[#EDEDED] text-xs font-medium rounded-lg border border-[#1F242D] transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
