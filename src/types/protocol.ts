/**
 * NEXUS Protocol & Message Types
 */

export interface Participant {
  id: string;
  displayName: string;
  joinedAt: number;
}

export type ClientMessage =
  | {
      type: 'join';
      roomCode: string;
      participantId: string;
      displayName: string;
    }
  | {
      type: 'key-exchange';
      roomCode: string;
      senderId: string;
      publicKey: JsonWebKey;
    }
  | {
      type: 'message';
      roomCode: string;
      senderId: string;
      messageId: string;
      iv: string;
      ciphertext: string;
      timestamp: number;
    }
  | {
      type: 'typing';
      roomCode: string;
      senderId: string;
      isTyping: boolean;
    }
  | {
      type: 'leave';
      roomCode: string;
      senderId: string;
    }
  | {
      type: 'ping';
    };

export type ServerMessage =
  | {
      type: 'room-state';
      roomCode: string;
      participantCount: number;
      participants: Participant[];
      createdAt: number;
      expiresAt: number;
    }
  | {
      type: 'peer-joined';
      participant: Participant;
      participantCount: number;
    }
  | {
      type: 'peer-left';
      participantId: string;
      displayName: string;
      participantCount: number;
    }
  | {
      type: 'key-exchange';
      senderId: string;
      publicKey: JsonWebKey;
    }
  | {
      type: 'message';
      senderId: string;
      messageId: string;
      iv: string;
      ciphertext: string;
      timestamp: number;
    }
  | {
      type: 'typing';
      senderId: string;
      isTyping: boolean;
    }
  | {
      type: 'error';
      code: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'ROOM_EXPIRED' | 'INVALID_PAYLOAD' | 'RATE_LIMITED' | 'UNAUTHORIZED' | 'SERVER_ERROR';
      message: string;
    }
  | {
      type: 'pong';
    }
  | {
      type: 'room-expired';
      message: string;
    };

export interface EncryptedFileAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  attachment?: EncryptedFileAttachment;
  messageType?: 'text' | 'file';
  timestamp: number;
  isOwn: boolean;
  status: 'delivered' | 'failed';
}

export interface SystemNotification {
  id: string;
  type: 'system';
  content: string;
  timestamp: number;
}

export type TimelineItem =
  | ({ kind: 'message' } & ChatMessage)
  | ({ kind: 'system' } & SystemNotification);

export interface RoomInfoResponse {
  roomCode: string;
  participantCount: number;
  maxParticipants: number;
  isFull: boolean;
  isExpired: boolean;
  createdAt: number;
  expiresAt: number;
}
