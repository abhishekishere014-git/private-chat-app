/**
 * NEXUS About Modal
 */

import React from 'react';
import { X, Terminal, Cpu } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="about-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        id="about-modal-content"
        className="relative w-full max-w-md bg-[#0D0F12] border border-[#1F242D] rounded-xl shadow-2xl p-6 text-[#EDEDED]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#1F242D]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#38BDF8]" />
            <h2 id="about-modal-title" className="text-sm font-semibold tracking-wider text-[#EDEDED] uppercase font-mono">
              NEXUS
            </h2>
          </div>
          <button
            id="about-modal-close-btn"
            onClick={onClose}
            className="p-1 rounded-md text-[#8A909E] hover:text-[#EDEDED] hover:bg-[#111318] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-[#8A909E]">
          <p className="text-[#EDEDED] font-medium text-base">
            Temporary private communication.
          </p>
          <p className="text-xs leading-relaxed">
            NEXUS is designed around a single guiding principle: eliminate all unnecessary state, accounts, and server
            persistence. Two participants establish an ephemeral room, complete a client-side ECDH key exchange, and
            chat over an authenticated encrypted stream.
          </p>

          <div className="pt-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#8A909E] mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#38BDF8]" />
              Core Technologies
            </div>
            <ul className="space-y-1.5 font-mono text-xs text-[#EDEDED]">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]"></span>
                Cloudflare Workers & Edge Routing
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]"></span>
                Cloudflare Durable Objects
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]"></span>
                WebSockets (Zero-Knowledge Relay)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]"></span>
                Web Crypto API (ECDH + HKDF + AES-256-GCM)
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[#1F242D] flex items-center justify-between text-xs text-[#8A909E]">
          <span className="font-mono">v1.0.0 · Made by Abhishek</span>
          <button
            id="about-modal-close-action-btn"
            onClick={onClose}
            className="px-3 py-1.5 bg-[#111318] hover:bg-[#1F242D] text-[#EDEDED] rounded-md border border-[#1F242D] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
