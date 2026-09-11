/**
 * NEXUS Landing Page
 *
 * Minimalist, restrained entry point.
 */

import React from 'react';
import { Shield, ArrowRight, ShieldCheck, Terminal } from 'lucide-react';

interface LandingPageProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onOpenSecurity: () => void;
  onOpenAbout: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onCreateRoom,
  onJoinRoom,
  onOpenSecurity,
  onOpenAbout,
}) => {
  return (
    <div
      id="landing-page"
      className="min-h-screen flex flex-col justify-between bg-[#08090B] text-[#EDEDED] px-4 py-8 select-none"
    >
      {/* Subtle top navigation bar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#0D0F12] border border-[#1F242D] flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <span className="font-mono text-sm font-bold tracking-widest text-[#EDEDED]">
            NEXUS
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-[#8A909E]">
          <button
            id="landing-security-link"
            onClick={onOpenSecurity}
            className="hover:text-[#EDEDED] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Security Model</span>
          </button>
          <span>·</span>
          <button
            id="landing-about-link"
            onClick={onOpenAbout}
            className="hover:text-[#EDEDED] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>made by abhishek</span>
          </button>
        </div>
      </header>

      {/* Hero Content */}
      <main className="max-w-md w-full mx-auto my-auto text-center space-y-8">
        {/* Title & Tagline */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-[#EDEDED]">
            NEXUS
          </h1>
          <p className="text-base sm:text-lg font-medium text-[#EDEDED]">
            Private conversations.
            <br />
            <span className="text-[#8A909E]">Nothing unnecessary.</span>
          </p>
        </div>

        <p className="text-sm text-[#8A909E] leading-relaxed max-w-sm mx-auto">
          Create a temporary private room,
          <br />
          share the code, and start talking.
        </p>

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          <button
            id="landing-create-room-btn"
            onClick={onCreateRoom}
            className="w-full py-3 px-4 rounded-xl bg-[#0D0F12] hover:bg-[#111318] border border-[#1F242D] hover:border-[#38BDF8]/50 text-sm font-medium text-[#EDEDED] transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-xs"
          >
            <span>Create private room</span>
            <ArrowRight className="w-4 h-4 text-[#38BDF8] group-hover:translate-x-0.5 transition-transform" />
          </button>

          <div className="text-xs font-mono text-[#8A909E]/70">or</div>

          <button
            id="landing-join-room-btn"
            onClick={onJoinRoom}
            className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-[#0D0F12] border border-[#1F242D]/70 hover:border-[#1F242D] text-xs font-mono text-[#8A909E] hover:text-[#EDEDED] transition-all cursor-pointer"
          >
            [ Join a room ]
          </button>
        </div>

        {/* Private by Design pill */}
        <div className="pt-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D0F12] border border-[#1F242D] text-[11px] font-mono text-[#8A909E]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]"></span>
            PRIVATE BY DESIGN
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-[#8A909E]/50">
        <span>Web Crypto API · ECDH P-256 · AES-256-GCM · Ephemeral Relay</span>
        <button
          id="landing-footer-author-btn"
          onClick={onOpenAbout}
          className="hover:text-[#EDEDED] transition-colors cursor-pointer text-[#8A909E]/70"
        >
          made by abhishek
        </button>
      </footer>
    </div>
  );
};
