/**
 * NEXUS Join Room Page
 *
 * Validates room code formatting, checks room availability,
 * and enters the encrypted session.
 */

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { normalizeRoomCode, isValidRoomCode, ROOM_CODE_CHARSET } from '../../utils/room-code.ts';
import { getRoomInfo } from '../../services/api.ts';

interface JoinRoomPageProps {
  onBack: () => void;
  onJoinRoom: (roomCode: string, displayName: string) => void;
}

export const JoinRoomPage: React.FC<JoinRoomPageProps> = ({
  onBack,
  onJoinRoom,
}) => {
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Normalize: uppercase, remove spaces/dashes
    const normalized = normalizeRoomCode(raw);
    // Filter only allowed characters
    const filtered = normalized
      .split('')
      .filter((char) => ROOM_CODE_CHARSET.includes(char))
      .join('')
      .slice(0, 8);

    setCode(filtered);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = normalizeRoomCode(code);
    const cleanName = displayName.trim() || 'Anonymous';

    if (!cleanCode) {
      setError('Please enter a room code');
      return;
    }

    if (!isValidRoomCode(cleanCode)) {
      setError('Invalid room code. Codes are 6-8 characters excluding 0, O, 1, I, L.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Check room availability
      const info = await getRoomInfo(cleanCode);

      if (info.isExpired) {
        setError('This room has expired due to inactivity.');
        setIsVerifying(false);
        return;
      }

      if (info.participantCount >= 2) {
        setError('This room already has two participants.');
        setIsVerifying(false);
        return;
      }

      // Room is joinable!
      setIsVerifying(false);
      onJoinRoom(cleanCode, cleanName);
    } catch (err: unknown) {
      setIsVerifying(false);
      if (err && typeof err === 'object' && 'status' in err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          setError('This room may have expired or the code may be incorrect.');
          return;
        }
        if (status === 429) {
          setError('Too many attempts. Please wait before trying again.');
          return;
        }
      }
      setError(err instanceof Error ? err.message : 'Could not verify room. Please check your connection.');
    }
  };

  return (
    <div
      id="join-room-page"
      className="min-h-screen flex flex-col justify-between bg-[#08090B] text-[#EDEDED] px-4 py-8 select-none"
    >
      {/* Top Bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <button
          id="join-room-back-btn"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-mono text-[#8A909E] hover:text-[#EDEDED] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs font-mono text-[#8A909E]">
          <Shield className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>JOIN SESSION</span>
        </div>
      </div>

      {/* Card */}
      <main className="max-w-md w-full mx-auto my-auto p-6 sm:p-8 rounded-2xl bg-[#0D0F12] border border-[#1F242D] space-y-6 shadow-xl">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-mono font-bold tracking-tight text-[#EDEDED]">
            Enter room
          </h2>
          <p className="text-xs text-[#8A909E]">
            Connect to an existing encrypted ephemeral session.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Room Code */}
          <div className="space-y-1.5">
            <label
              htmlFor="join-room-code-input"
              className="block text-xs font-mono text-[#8A909E]"
            >
              Room code
            </label>
            <input
              id="join-room-code-input"
              type="text"
              placeholder="e.g. K7M4PX"
              value={code}
              onChange={handleCodeChange}
              autoFocus
              className="w-full px-3.5 py-2.5 bg-[#111318] border border-[#1F242D] focus:border-[#38BDF8]/60 rounded-xl font-mono text-base font-semibold tracking-wider text-[#EDEDED] placeholder-[#8A909E]/40 focus:outline-none transition-colors uppercase"
            />
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="join-display-name-input"
              className="block text-xs font-mono text-[#8A909E]"
            >
              Display name
            </label>
            <input
              id="join-display-name-input"
              type="text"
              maxLength={32}
              placeholder="Your name (e.g. Robin)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#111318] border border-[#1F242D] focus:border-[#38BDF8]/60 rounded-xl text-sm text-[#EDEDED] placeholder-[#8A909E]/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              id="join-submit-btn"
              type="submit"
              disabled={isVerifying || !code}
              className="w-full py-3 px-4 rounded-xl bg-[#111318] hover:bg-[#1F242D] disabled:opacity-50 border border-[#1F242D] hover:border-[#38BDF8]/50 text-sm font-medium text-[#EDEDED] transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 text-[#38BDF8] animate-spin" />
                  <span className="font-mono text-xs">Verifying room...</span>
                </>
              ) : (
                <>
                  <span>Join private room</span>
                  <ArrowRight className="w-4 h-4 text-[#38BDF8] group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto flex items-center justify-between text-[11px] font-mono text-[#8A909E]/50">
        <span>Max 2 participants</span>
        <span>made by abhishek</span>
      </footer>
    </div>
  );
};
