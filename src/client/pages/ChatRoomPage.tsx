/**
 * NEXUS Chat Room Page
 *
 * Primary active conversation view coordinating Header, ChatArea,
 * MessageInput, RoomInspector drawer, and Security/About modals.
 */

import React, { useState } from 'react';
import { Header } from '../components/Header.tsx';
import { ChatArea } from '../components/ChatArea.tsx';
import { MessageInput } from '../components/MessageInput.tsx';
import { RoomInspector } from '../components/RoomInspector.tsx';
import { SecurityModal } from '../components/SecurityModal.tsx';
import { AboutModal } from '../components/AboutModal.tsx';
import { useRoomSocket } from '../../hooks/useRoomSocket.ts';
import { AlertCircle, RefreshCw, Lock } from 'lucide-react';

interface ChatRoomPageProps {
  roomCode: string;
  participantId: string;
  displayName: string;
  onLeave: () => void;
}

export const ChatRoomPage: React.FC<ChatRoomPageProps> = ({
  roomCode,
  participantId,
  displayName,
  onLeave,
}) => {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const {
    status,
    participants,
    timeline,
    peerTyping,
    errorBanner,
    expiresAt,
    crypto,
    sendMessage,
    sendTyping,
    leaveRoom,
    retryConnection,
  } = useRoomSocket({
    roomCode,
    participantId,
    displayName,
    onExpired: () => {
      // Room expired
    },
  });

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  const isInputDisabled = status !== 'connected' || !crypto.isEncrypted;
  let disabledReason: string | undefined;
  if (status === 'connecting') {
    disabledReason = 'Connecting to room relay...';
  } else if (status === 'reconnecting') {
    disabledReason = 'Reconnecting...';
  } else if (status === 'disconnected') {
    disabledReason = 'Disconnected from room';
  } else if (!crypto.isEncrypted) {
    disabledReason = 'Waiting for peer key agreement (AES-256-GCM / ECDH)...';
  }

  return (
    <div
      id="chat-room-container"
      className="flex flex-col h-screen w-full bg-[#08090B] text-[#EDEDED] overflow-hidden"
    >
      {/* Header */}
      <Header
        roomCode={roomCode}
        connectionStatus={status}
        participantCount={participants.length}
        isEncrypted={crypto.isEncrypted}
        onOpenInspector={() => setIsInspectorOpen(true)}
        onOpenSecurity={() => setIsSecurityOpen(true)}
        onLeave={handleLeave}
      />

      {/* Disconnect / Error Banner */}
      {errorBanner && (
        <div className="bg-rose-950/40 border-b border-rose-800/40 px-4 py-2 flex items-center justify-between text-xs text-rose-300 font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          {status === 'disconnected' && (
            <button
              onClick={retryConnection}
              className="flex items-center gap-1 text-[#38BDF8] hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry connection</span>
            </button>
          )}
        </div>
      )}

      {/* Main Chat Flow */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        <ChatArea
          timeline={timeline}
          currentUserId={participantId}
          isEncrypted={crypto.isEncrypted}
          peerTyping={peerTyping}
        />

        <MessageInput
          onSendMessage={sendMessage}
          onTyping={sendTyping}
          disabled={isInputDisabled}
          disabledReason={disabledReason}
        />
      </main>

      {/* Modals & Drawers */}
      <RoomInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        roomCode={roomCode}
        participants={participants}
        expiresAt={expiresAt}
        isEncrypted={crypto.isEncrypted}
        fingerprint={crypto.fingerprint}
        connectionStatus={status}
      />

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
};
