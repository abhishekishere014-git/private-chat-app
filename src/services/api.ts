/**
 * NEXUS Client API Service
 */

import { RoomInfoResponse } from '../types/protocol.ts';
import { normalizeRoomCode } from '../utils/room-code.ts';

export interface CreateRoomResponse {
  roomCode: string;
  createdAt: number;
  expiresInMinutes: number;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Calls POST /api/rooms to create a new private room.
 */
export async function createRoom(): Promise<CreateRoomResponse> {
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data.error || 'Failed to create room', res.status);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Network error while creating room. Check connection.');
  }
}

/**
 * Checks room metadata via GET /api/rooms/:code/info.
 */
export async function getRoomInfo(code: string): Promise<RoomInfoResponse> {
  const normalized = normalizeRoomCode(code);
  try {
    const res = await fetch(`/api/rooms/${normalized}/info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new ApiError('Room not found or may have expired', 404);
      }
      if (res.status === 429) {
        throw new ApiError('Too many attempts. Please wait a moment.', 429);
      }
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data.error || 'Could not verify room', res.status);
    }

    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Unable to connect to room server.');
  }
}

/**
 * Resolves the appropriate WebSocket URL based on current origin.
 */
export function getWebSocketUrl(code: string): string {
  const normalized = normalizeRoomCode(code);
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/rooms/${normalized}/ws`;
}
