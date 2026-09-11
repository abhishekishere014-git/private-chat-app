/**
 * NEXUS Room Inspector Drawer
 *
 * Slide-over drawer displaying technical, transparent room and cryptographic specifications.
 */

import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Cpu, Activity, Clock, Wifi, Lock, Users, Copy, Check } from 'lucide-react';
import { Participant } from '../../types/protocol.ts';
import { formatTimeRemaining, copyToClipboard } from '../../utils/format.ts';

interface RoomInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  participants: Participant[];
  expiresAt: number;
  isEncrypted: boolean;
  fingerprint: string | null;
  connectionStatus: string;
}

export const RoomInspector: React.FC<RoomInspectorProps> = ({
  isOpen,
  onClose,
  roomCode,
  participants,
  expiresAt,
  isEncrypted,
  fingerprint,
  connectionStatus,
}) => {
  const [timeLeft, setTimeLeft] = useState(formatTimeRemaining(expiresAt));
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(formatTimeRemaining(expiresAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const handleCopyFingerprint = async () => {
    if (!fingerprint) return;
    const ok = await copyToClipboard(fingerprint);
    if (ok) {
      setCopiedFingerprint(true);
      setTimeout(() => setCopiedFingerprint(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="room-inspector-backdrop"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="room-inspector-panel"
        className="relative w-full max-w-sm h-full bg-[#0D0F12] border-l border-[#1F242D] shadow-2xl flex flex-col text-[#EDEDED] p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1F242D]">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#38BDF8]" />
            <h2 id="inspector-title" className="text-xs font-mono font-semibold tracking-wider text-[#EDEDED] uppercase">
              ROOM INSPECTOR
            </h2>
          </div>
          <button
            id="inspector-close-btn"
            onClick={onClose}
            className="p-1 rounded-md text-[#8A909E] hover:text-[#EDEDED] hover:bg-[#111318] transition-colors"
            aria-label="Close inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Technical Specification Matrix */}
        <div className="mt-6 space-y-5 text-xs font-mono">
          {/* Room Code */}
          <div className="p-3 bg-[#111318] border border-[#1F242D] rounded-lg">
            <span className="text-[#8A909E] text-[10px] tracking-widest block uppercase mb-1">
              ROOM
            </span>
            <div className="text-base font-bold text-[#EDEDED] tracking-wider">
              {roomCode}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between py-2 border-b border-[#1F242D]/60">
            <span className="text-[#8A909E] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#38BDF8]" />
              STATUS
            </span>
            <span className="text-[#38BDF8] font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse"></span>
              ACTIVE
            </span>
          </div>

          {/* Participants */}
          <div className="flex items-center justify-between py-2 border-b border-[#1F242D]/60">
            <span className="text-[#8A909E] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              PARTICIPANTS
            </span>
            <span className="text-[#EDEDED] font-semibold">
              {participants.length} / 2
            </span>
          </div>

          {/* Encryption */}
          <div className="flex items-center justify-between py-2 border-b border-[#1F242D]/60">
            <span className="text-[#8A909E] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#38BDF8]" />
              ENCRYPTION
            </span>
            <span className={isEncrypted ? 'text-[#38BDF8] font-semibold' : 'text-amber-400 font-semibold'}>
              {isEncrypted ? 'END-TO-END' : 'PENDING PEER'}
            </span>
          </div>

          {/* Cipher Suite */}
          <div className="flex items-center justify-between py-2 border-b border-[#1F242D]/60">
            <span className="text-[#8A909E] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              CIPHER SUITE
            </span>
            <span className="text-[#EDEDED]">AES-256-GCM</span>
          </div>

          {/* Key Agreement */}
          <div className="flex items-center justify-between py-2 border-b border-[#1F242D]/60">
            <span className="text-[#8A909E]">KEY AGREEMENT</span>
            <span className="text-[#EDEDED]">ECDH P-256</span>
          </div>

          {/* Relay */}
          <div className="flex items-center justify-between py-2 border-b border-[#1F242D]/60">
            <span className="text-[#8A909E]">RELAY</span>
            <span className="text-[#EDEDED]">ZERO-KNOWLEDGE</span>
          </div>

          {/* Lifetime */}
          <div className="flex items-center justify-between py-2 border-b border-[#1F242D]/60">
            <span className="text-[#8A909E] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              LIFETIME
            </span>
            <span className="text-[#EDEDED]">INACTIVITY BASED</span>
          </div>

          {/* Inactivity Countdown */}
          <div className="flex items-center justify-between py-2 border-b border-[#1F242D]/60">
            <span className="text-[#8A909E]">INACTIVITY EXPIRES IN</span>
            <span className="text-[#EDEDED] font-semibold text-[#38BDF8]">{timeLeft}</span>
          </div>

          {/* Connection */}
          <div className="flex items-center justify-between py-2 border-b border-[#1F242D]/60">
            <span className="text-[#8A909E] flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5" />
              CONNECTION
            </span>
            <span className="text-[#EDEDED] uppercase">
              {connectionStatus === 'connected' ? 'WEBSOCKET / WSS' : connectionStatus}
            </span>
          </div>

          {/* Cryptographic Session Fingerprint */}
          {fingerprint && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1 text-[10px] text-[#8A909E] uppercase tracking-wider">
                <span>SESSION FINGERPRINT</span>
                <button
                  onClick={handleCopyFingerprint}
                  className="flex items-center gap-1 text-[#38BDF8] hover:underline"
                >
                  {copiedFingerprint ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-2.5 bg-[#111318] border border-[#1F242D] rounded-md font-mono text-[11px] text-[#EDEDED] text-center tracking-widest select-all">
                {fingerprint}
              </div>
              <p className="mt-1.5 text-[10px] text-[#8A909E] leading-normal font-sans">
                Both participants will see the exact same fingerprint if their ephemeral key agreement is authentic.
              </p>
            </div>
          )}

          {/* Active Members */}
          <div className="pt-2">
            <div className="text-[10px] text-[#8A909E] uppercase tracking-wider mb-2">
              CONNECTED PEERS
            </div>
            <div className="space-y-1.5">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded bg-[#111318] border border-[#1F242D]"
                >
                  <span className="font-sans font-medium text-xs text-[#EDEDED] truncate">
                    {p.displayName}
                  </span>
                  <span className="text-[10px] text-[#8A909E]">
                    {new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 border-t border-[#1F242D] text-[11px] text-[#8A909E] font-sans">
          No logs or keys are saved. Sessions vanish on room closure.
        </div>
      </div>
    </div>
  );
};
