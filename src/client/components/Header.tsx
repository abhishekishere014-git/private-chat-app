/**
 * NEXUS Header Component
 */

import React, { useState } from 'react';
import { Shield, Copy, Check, LogOut, Sliders, ShieldCheck } from 'lucide-react';
import { copyToClipboard } from '../../utils/format.ts';
import { ConnectionStatus } from '../../hooks/useRoomSocket.ts';

interface HeaderProps {
  roomCode: string;
  connectionStatus: ConnectionStatus;
  participantCount: number;
  isEncrypted: boolean;
  onOpenInspector: () => void;
  onOpenSecurity: () => void;
  onLeave: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomCode,
  connectionStatus,
  participantCount,
  isEncrypted,
  onOpenInspector,
  onOpenSecurity,
  onLeave,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(roomCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusDisplay = () => {
    if (connectionStatus === 'connected') {
      if (isEncrypted) {
        return (
          <button
            onClick={onOpenSecurity}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111318] border border-[#1F242D] text-xs font-mono text-[#38BDF8] hover:border-[#38BDF8]/40 transition-colors"
            title="Click for security details"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse"></span>
            SECURE CONNECTION
          </button>
        );
      }
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111318] border border-[#1F242D] text-xs font-mono text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          WAITING FOR PEER
        </span>
      );
    }

    if (connectionStatus === 'reconnecting') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111318] border border-[#1F242D] text-xs font-mono text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
          RECONNECTING
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111318] border border-[#1F242D] text-xs font-mono text-rose-400">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
        DISCONNECTED
      </span>
    );
  };

  return (
    <header
      id="nexus-header"
      className="h-14 border-b border-[#1F242D] bg-[#08090B]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none"
    >
      {/* Brand & Room Info */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#111318] border border-[#1F242D] flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-[#38BDF8]" />
          </div>
          <span className="font-mono text-sm font-bold tracking-wider text-[#EDEDED]">
            NEXUS
          </span>
        </div>

        <div className="h-4 w-[1px] bg-[#1F242D] hidden sm:block"></div>

        {/* Room Code Badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#111318] border border-[#1F242D]">
          <span className="text-[10px] font-mono text-[#8A909E] uppercase tracking-wider">ROOM /</span>
          <span className="text-xs font-mono font-semibold text-[#EDEDED] tracking-wider">{roomCode}</span>
        </div>

        {/* Online Count */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-[#8A909E] font-mono">
          <span className={`w-1.5 h-1.5 rounded-full ${participantCount === 2 ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
          <span>{participantCount} ONLINE</span>
        </div>
      </div>

      {/* Center Status (Desktop) */}
      <div className="hidden lg:flex items-center justify-center">
        {getStatusDisplay()}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <div className="lg:hidden">
          {getStatusDisplay()}
        </div>

        <button
          id="header-copy-code-btn"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#111318] hover:bg-[#1F242D] border border-[#1F242D] text-xs text-[#EDEDED] font-mono transition-colors"
          title="Copy room code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 hidden sm:inline">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-[#8A909E]" />
              <span className="hidden sm:inline">Copy code</span>
            </>
          )}
        </button>

        <button
          id="header-room-inspector-btn"
          onClick={onOpenInspector}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#111318] hover:bg-[#1F242D] border border-[#1F242D] text-xs text-[#EDEDED] font-mono transition-colors"
          title="Inspect room & cryptographic parameters"
        >
          <Sliders className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span className="hidden md:inline">Room Inspector</span>
        </button>

        <button
          id="header-leave-btn"
          onClick={onLeave}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#111318] hover:bg-rose-950/40 hover:border-rose-800/50 border border-[#1F242D] text-xs text-rose-300 font-mono transition-colors"
          title="Leave room and destroy keys"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </header>
  );
};
