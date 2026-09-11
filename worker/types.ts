/**
 * Cloudflare Worker & Durable Object Environment Types
 */

import { Participant } from '../src/types/protocol.ts';

export interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteAll(): Promise<void>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  getAlarm(): Promise<number | null>;
  deleteAlarm(): Promise<void>;
}

export interface DurableObjectState {
  id: { toString(): string };
  storage: DurableObjectStorage;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

export interface DurableObjectId {
  toString(): string;
}

export interface DurableObjectStub {
  fetch(request: Request | string, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

export interface Env {
  ROOMS: DurableObjectNamespace;
  ENVIRONMENT?: string;
  INACTIVITY_TIMEOUT_MS?: string;
  CORS_ALLOW_ORIGIN?: string;
}

export interface StoredRoomState {
  roomCode: string;
  createdAt: number;
  lastActiveAt: number;
  participants: Participant[];
}
