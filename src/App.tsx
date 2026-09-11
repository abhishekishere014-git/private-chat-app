/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LandingPage } from './client/pages/LandingPage.tsx';
import { CreateRoomPage } from './client/pages/CreateRoomPage.tsx';
import { JoinRoomPage } from './client/pages/JoinRoomPage.tsx';
import { ChatRoomPage } from './client/pages/ChatRoomPage.tsx';
import { SecurityModal } from './client/components/SecurityModal.tsx';
import { AboutModal } from './client/components/AboutModal.tsx';
import { normalizeRoomCode, isValidRoomCode } from './utils/room-code.ts';

type AppView = 'landing' | 'create' | 'join' | 'chat';

export default function App() {
  const [view, setView] = useState<AppView>('landing');
  const [roomCode, setRoomCode] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [participantId, setParticipantId] = useState<string>('');
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Generate ephemeral participant ID for this browser tab
  useEffect(() => {
    let id = '';
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      id = crypto.randomUUID();
    } else {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      id = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    setParticipantId(id);

    // Check URL parameters for direct room code joining (e.g., /?room=K7M4PX or #K7M4PX)
    const searchParams = new URLSearchParams(window.location.search);
    const urlRoom = searchParams.get('room') || window.location.hash.replace(/^#/, '');
    if (urlRoom) {
      const normalized = normalizeRoomCode(urlRoom);
      if (isValidRoomCode(normalized)) {
        setRoomCode(normalized);
        setView('join');
      }
    }
  }, []);

  const handleEnterRoom = (code: string, name: string) => {
    setRoomCode(code);
    setDisplayName(name);
    setView('chat');
  };

  const handleLeaveRoom = () => {
    setView('landing');
    setRoomCode('');
    // Clear room from URL hash/query
    if (window.location.search || window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090B] text-[#EDEDED] font-sans antialiased">
      {view === 'landing' && (
        <LandingPage
          onCreateRoom={() => setView('create')}
          onJoinRoom={() => setView('join')}
          onOpenSecurity={() => setIsSecurityOpen(true)}
          onOpenAbout={() => setIsAboutOpen(true)}
        />
      )}

      {view === 'create' && (
        <CreateRoomPage
          onBack={() => setView('landing')}
          onEnterRoom={handleEnterRoom}
        />
      )}

      {view === 'join' && (
        <JoinRoomPage
          onBack={() => setView('landing')}
          onJoinRoom={handleEnterRoom}
        />
      )}

      {view === 'chat' && roomCode && (
        <ChatRoomPage
          roomCode={roomCode}
          participantId={participantId}
          displayName={displayName || 'Anonymous'}
          onLeave={handleLeaveRoom}
        />
      )}

      <SecurityModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
}
