/**
 * Hook: useRoomSocket
 *
 * Manages WebSocket lifecycle, auto-reconnect, message queuing,
 * key exchange negotiation, and encrypted message dispatch.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClientMessage,
  ServerMessage,
  Participant,
  TimelineItem,
  EncryptedFileAttachment,
} from '../types/protocol.ts';
import { getWebSocketUrl } from '../services/api.ts';
import { useCryptoSession } from './useCryptoSession.ts';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface UseRoomSocketOptions {
  roomCode: string;
  participantId: string;
  displayName: string;
  onExpired?: () => void;
  onError?: (error: string) => void;
}

export function useRoomSocket({
  roomCode,
  participantId,
  displayName,
  onExpired,
  onError,
}: UseRoomSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [peerTyping, setPeerTyping] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(Date.now() + 15 * 60 * 1000);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyLeftRef = useRef(false);

  // E2E Cryptographic engine
  const crypto = useCryptoSession();
  const cryptoRef = useRef(crypto);
  cryptoRef.current = crypto;

  /**
   * Dispatches a typed client frame through the WebSocket connection
   */
  const send = useCallback((msg: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  /**
   * Connects to the WebSocket room endpoint
   */
  const connect = useCallback(async () => {
    if (isManuallyLeftRef.current) return;

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // ignore
      }
    }

    setStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');
    setErrorBanner(null);

    // Initialize local crypto keys if not yet prepared
    let localPublicKeyJwk = cryptoRef.current.publicKeyJwk;
    if (!localPublicKeyJwk) {
      try {
        localPublicKeyJwk = await cryptoRef.current.initializeSession();
      } catch (err) {
        setErrorBanner('Failed to generate local cryptographic keys in Web Crypto API');
        setStatus('disconnected');
        return;
      }
    }

    const wsUrl = getWebSocketUrl(roomCode);
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;
    } catch (err) {
      setStatus('disconnected');
      setErrorBanner('Failed to initiate WebSocket connection');
      return;
    }

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttemptsRef.current = 0;

      // 1. Join room
      send({
        type: 'join',
        roomCode,
        participantId,
        displayName,
      });

      // 2. Announce public key for E2E agreement
      if (localPublicKeyJwk) {
        send({
          type: 'key-exchange',
          roomCode,
          senderId: participantId,
          publicKey: localPublicKeyJwk,
        });
      }

      // 3. Keepalive ping every 25s
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        send({ type: 'ping' });
      }, 25000);
    };

    ws.onmessage = async (event) => {
      try {
        const data: ServerMessage = JSON.parse(event.data);

        switch (data.type) {
          case 'pong':
            // keepalive acknowledgement
            break;

          case 'room-state': {
            setParticipants(data.participants);
            setExpiresAt(data.expiresAt);

            // If a peer is already present, trigger key exchange immediately
            const otherPeer = data.participants.find((p) => p.id !== participantId);
            if (otherPeer && localPublicKeyJwk) {
              send({
                type: 'key-exchange',
                roomCode,
                senderId: participantId,
                publicKey: localPublicKeyJwk,
              });
            }
            break;
          }

          case 'peer-joined': {
            setParticipants((prev) => {
              const exists = prev.some((p) => p.id === data.participant.id);
              if (exists) return prev;
              return [...prev, data.participant];
            });

            setTimeline((prev) => [
              ...prev,
              {
                kind: 'system',
                id: `join-${Date.now()}-${data.participant.id}`,
                type: 'system',
                content: `${data.participant.displayName} connected. Establishing E2E session...`,
                timestamp: Date.now(),
              },
            ]);

            // Peer joined: send them our public key so they can derive the shared secret
            if (localPublicKeyJwk) {
              send({
                type: 'key-exchange',
                roomCode,
                senderId: participantId,
                publicKey: localPublicKeyJwk,
              });
            }
            break;
          }

          case 'peer-left': {
            setParticipants((prev) => prev.filter((p) => p.id !== data.participantId));
            setPeerTyping(null);

            setTimeline((prev) => [
              ...prev,
              {
                kind: 'system',
                id: `leave-${Date.now()}-${data.participantId}`,
                type: 'system',
                content: `${data.displayName} left the room.`,
                timestamp: Date.now(),
              },
            ]);
            break;
          }

          case 'key-exchange': {
            if (data.senderId !== participantId) {
              try {
                await cryptoRef.current.handlePeerPublicKey(data.publicKey);

                setTimeline((prev) => [
                  ...prev,
                  {
                    kind: 'system',
                    id: `crypto-${Date.now()}`,
                    type: 'system',
                    content: 'End-to-end encrypted session established (AES-256-GCM / ECDH P-256).',
                    timestamp: Date.now(),
                  },
                ]);
              } catch (err) {
                setErrorBanner('Cryptographic key agreement failed.');
              }
            }
            break;
          }

          case 'message': {
            if (data.senderId !== participantId) {
              try {
                const plaintext = await cryptoRef.current.decrypt(data.ciphertext, data.iv);
                const senderName =
                  participants.find((p) => p.id === data.senderId)?.displayName || 'Participant';

                let messageType: 'text' | 'file' = 'text';
                let messageText = plaintext;
                let fileAttachment = undefined;

                try {
                  const parsed = JSON.parse(plaintext);
                  if (parsed && typeof parsed === 'object') {
                    if (parsed.type === 'file' && parsed.attachment) {
                      messageType = 'file';
                      fileAttachment = parsed.attachment;
                      messageText = parsed.text || '';
                    } else if (parsed.type === 'text' && typeof parsed.text === 'string') {
                      messageText = parsed.text;
                    }
                  }
                } catch {
                  // Legacy raw string plaintext fallback
                }

                setTimeline((prev) => [
                  ...prev,
                  {
                    kind: 'message',
                    id: data.messageId,
                    senderId: data.senderId,
                    senderName,
                    text: messageText,
                    attachment: fileAttachment,
                    messageType,
                    timestamp: data.timestamp,
                    isOwn: false,
                    status: 'delivered',
                  },
                ]);
              } catch (err) {
                setTimeline((prev) => [
                  ...prev,
                  {
                    kind: 'system',
                    id: `decrypt-err-${data.messageId}`,
                    type: 'system',
                    content: 'Decryption error: message ciphertext could not be verified.',
                    timestamp: Date.now(),
                  },
                ]);
              }
            }
            break;
          }

          case 'typing': {
            if (data.senderId !== participantId) {
              if (data.isTyping) {
                const peerName =
                  participants.find((p) => p.id === data.senderId)?.displayName || 'Peer';
                setPeerTyping(peerName);

                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                  setPeerTyping(null);
                }, 3000);
              } else {
                setPeerTyping(null);
              }
            }
            break;
          }

          case 'room-expired': {
            setErrorBanner(data.message || 'Room has expired due to inactivity.');
            setStatus('disconnected');
            if (onExpired) onExpired();
            break;
          }

          case 'error': {
            setErrorBanner(data.message);
            if (data.code === 'ROOM_FULL' || data.code === 'ROOM_EXPIRED') {
              setStatus('disconnected');
              isManuallyLeftRef.current = true;
            }
            if (onError) onError(data.message);
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message frame', err);
      }
    };

    ws.onclose = (event) => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

      if (isManuallyLeftRef.current || event.code === 1000 || event.code === 4000 || event.code === 4003) {
        setStatus('disconnected');
        return;
      }

      // Attempt automatic reconnection with backoff
      if (reconnectAttemptsRef.current < 5) {
        setStatus('reconnecting');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setStatus('disconnected');
        setErrorBanner('Connection lost. Please retry connection.');
      }
    };

    ws.onerror = () => {
      // ws.onclose handles state
    };
  }, [roomCode, participantId, displayName, send, participants, onExpired, onError]);

  // Connect on mount
  useEffect(() => {
    isManuallyLeftRef.current = false;
    connect();

    return () => {
      isManuallyLeftRef.current = true;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.close(1000, 'Component unmounted');
        } catch {
          // ignore
        }
      }
      cryptoRef.current.resetCrypto();
    };
  }, [connect]);

  /**
   * Encrypts and transmits a chat message or encrypted file attachment
   */
  const sendMessage = useCallback(
    async (text: string, file?: EncryptedFileAttachment) => {
      const trimmed = text.trim();
      if (!trimmed && !file) return;

      if (!crypto.isEncrypted) {
        setErrorBanner('Cannot send: waiting for second participant to establish E2E session.');
        return;
      }

      const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const timestamp = Date.now();

      try {
        const payloadObject = file
          ? { type: 'file', text: trimmed, attachment: file }
          : { type: 'text', text: trimmed };

        const payloadString = JSON.stringify(payloadObject);
        const { ciphertext, iv } = await crypto.encrypt(payloadString);

        // Optimistically add to timeline
        setTimeline((prev) => [
          ...prev,
          {
            kind: 'message',
            id: messageId,
            senderId: participantId,
            senderName: displayName,
            text: trimmed,
            attachment: file,
            messageType: file ? 'file' : 'text',
            timestamp,
            isOwn: true,
            status: 'delivered',
          },
        ]);

        send({
          type: 'message',
          roomCode,
          senderId: participantId,
          messageId,
          iv,
          ciphertext,
          timestamp,
        });
      } catch (err) {
        setErrorBanner('Failed to encrypt message before transmission.');
      }
    },
    [crypto, participantId, displayName, roomCode, send]
  );

  /**
   * Broadcasts typing status
   */
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      send({
        type: 'typing',
        roomCode,
        senderId: participantId,
        isTyping,
      });
    },
    [roomCode, participantId, send]
  );

  /**
   * Leaves the room voluntarily
   */
  const leaveRoom = useCallback(() => {
    isManuallyLeftRef.current = true;
    send({
      type: 'leave',
      roomCode,
      senderId: participantId,
    });
    if (socketRef.current) {
      try {
        socketRef.current.close(1000, 'User departed');
      } catch {
        // ignore
      }
    }
    setStatus('disconnected');
    crypto.resetCrypto();
  }, [roomCode, participantId, send, crypto]);

  /**
   * Manual reconnect trigger
   */
  const retryConnection = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    isManuallyLeftRef.current = false;
    connect();
  }, [connect]);

  return {
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
  };
}
