/**
 * NEXUS Create Room Page
 *
 * Generates room code, connects immediately to wait for peer,
 * and allows entering display name.
 */

import React, { useState, useEffect } from 'react';
import { Shield, Copy, Check, ArrowLeft, ArrowRight, Loader2, Users } from 'lucide-react';
import { copyToClipboard } from '../../utils/format.ts';
import { createRoom } from '../../services/api.ts';
import { Participant } from '../../types/protocol.ts';

interface CreateRoomPageProps {
  onBack: () => void;
  onEnterRoom: (roomCode: string, displayName: string) => void;
}

export const CreateRoomPage: React.FC<CreateRoomPageProps> = ({
  onBack,
  onEnterRoom,
}) => {
  const [roomCode, setRoomCode] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Participant presence simulation / check while in waiting room
  const [participantCount, setParticipantCount] = useState(1);
  const [isCheckingPresence, setIsCheckingPresence] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initRoom() {
      setIsCreating(true);
      setError(null);
      try {
        const data = await createRoom();
        if (isMounted) {
          setRoomCode(data.roomCode);
          setIsCreating(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize room');
          setIsCreating(false);
        }
      }
    }

    initRoom();

    return () => {
      isMounted = false;
    };
  }, []);

  // Poll room info while waiting so we know when second participant connects
  useEffect(() => {
    if (!roomCode || isCreating) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}/info`);
        if (res.ok) {
          const info = await res.json();
          if (info.participantCount >= 2) {
            setParticipantCount(2);
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [roomCode, isCreating]);

  const handleCopy = async () => {
    if (!roomCode) return;
    const ok = await copyToClipboard(roomCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEnter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = displayName.trim() || 'Anonymous';
    if (!roomCode) return;
    onEnterRoom(roomCode, cleanName);
  };

  return (
    <div
      id="create-room-page"
      className="min-h-screen flex flex-col justify-between bg-[#08090B] text-[#EDEDED] px-4 py-8 select-none"
    >
      {/* Top Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <button
          id="create-room-back-btn"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-mono text-[#8A909E] hover:text-[#EDEDED] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs font-mono text-[#8A909E]">
          <Shield className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>EPHEMERAL ROOM</span>
        </div>
      </div>

      {/* Main Card */}
      <main className="max-w-md w-full mx-auto my-auto p-6 sm:p-8 rounded-2xl bg-[#0D0F12] border border-[#1F242D] space-y-6 shadow-xl">
        {isCreating ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 text-[#38BDF8] animate-spin" />
            <p className="text-xs font-mono text-[#8A909E]">Generating cryptographic room...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center space-y-4">
            <p className="text-sm text-rose-400 font-mono">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#111318] border border-[#1F242D] rounded-lg text-xs font-mono text-[#EDEDED]"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center space-y-1">
              <span className="text-[11px] font-mono text-[#8A909E] uppercase tracking-widest">
                PRIVATE ROOM
              </span>
              <div className="flex items-center justify-center gap-3 pt-2">
                <div className="px-4 py-2 bg-[#111318] border border-[#1F242D] rounded-xl font-mono text-2xl font-bold tracking-widest text-[#EDEDED] select-all">
                  {roomCode}
                </div>
                <button
                  id="create-room-copy-btn"
                  onClick={handleCopy}
                  className="p-3 rounded-xl bg-[#111318] hover:bg-[#1F242D] border border-[#1F242D] text-xs font-mono text-[#EDEDED] transition-colors cursor-pointer"
                  title="Copy room code"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#38BDF8]" />
                  )}
                </button>
              </div>
              <p className="text-xs text-[#8A909E] pt-3 leading-normal">
                Share this code with the person you want to chat with.
              </p>
            </div>

            {/* Display Name Input */}
            <form onSubmit={handleEnter} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="create-display-name-input"
                  className="block text-xs font-mono text-[#8A909E]"
                >
                  Your name
                </label>
                <input
                  id="create-display-name-input"
                  type="text"
                  maxLength={32}
                  placeholder="e.g. Alex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#111318] border border-[#1F242D] focus:border-[#38BDF8]/60 rounded-xl text-sm text-[#EDEDED] placeholder-[#8A909E]/50 focus:outline-none transition-colors"
                />
              </div>

              {/* Status Indicator */}
              <div className="py-2 flex items-center justify-center">
                {participantCount >= 2 ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-xs font-mono text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    2 PARTICIPANTS CONNECTED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111318] border border-[#1F242D] text-xs font-mono text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                    WAITING FOR CONNECTION
                  </span>
                )}
              </div>

              {/* Enter Button */}
              <button
                id="create-room-enter-btn"
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-[#111318] hover:bg-[#1F242D] border border-[#1F242D] hover:border-[#38BDF8]/50 text-sm font-medium text-[#EDEDED] transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-xs"
              >
                <span>Enter conversation</span>
                <ArrowRight className="w-4 h-4 text-[#38BDF8] group-hover:translate-x-0.5 transition-transform" />
              </button>
            </form>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto flex items-center justify-between text-[11px] font-mono text-[#8A909E]/50">
        <span>Inactivity timeout: 15m</span>
        <span>made by abhishek</span>
      </footer>
    </div>
  );
};
