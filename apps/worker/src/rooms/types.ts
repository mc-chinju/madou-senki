import type { GameEvent, GameState, PlayerView } from '@madou/engine';

export interface RoomMember { id: string; name: string; ready: boolean; joinedAt: number }
export interface RoomData {
  schemaVersion: 1;
  roomId: string;
  title: string;
  ownerId: string;
  rulesetId: string;
  capacity: number;
  visibility: 'public' | 'private';
  status: 'lobby' | 'playing' | 'finished' | 'closed';
  createdAt: number;
  members: Record<string, RoomMember>;
  inviteHash: string | null;
  game: GameState | null;
  closeVotes?: string[];
}
export interface RoomSettings { title: string; capacity: number; visibility: 'public' | 'private'; rulesetId: string }
export type RoomMutationResult = { ok: true; roomId: string; revision: number } |
  { ok: false; code: 'FORBIDDEN' | 'ROOM_FULL' | 'ROOM_NOT_OPEN' | 'STALE_REVISION' | 'INTERNAL_ERROR' };
export type RoomEvent =
  | { kind: 'game'; event: GameEvent }
  | { kind: 'lobby'; type: 'CREATED' | 'JOINED' | 'LEFT' | 'READY_CHANGED' | 'SETTINGS_CHANGED' | 'STARTED' | 'INVITE_CHANGED' | 'CLOSURE_VOTED' | 'CLOSED'; actorId: string; at: number };
export interface ListedRoom { title: string; capacity: number; occupied: number; rulesetId: string }
/** Null listing is a revision tombstone: it contains no private-room metadata. */
export interface RoomProjection { roomId: string; listing: ListedRoom | null }
export interface RoomView {
  roomId: string;
  title: string;
  ownerId: string;
  rulesetId: string;
  capacity: number;
  visibility: RoomData['visibility'];
  status: RoomData['status'];
  revision: number;
  members: { id: string; name: string; ready: boolean; connected: boolean }[];
  readOnly: boolean;
  closeVotes: string[];
  game: PlayerView | null;
}

export function projectDirectory(room: RoomData): RoomProjection {
  return { roomId: room.roomId, listing: room.visibility === 'public' && room.status === 'lobby'
    ? { title: room.title, capacity: room.capacity, occupied: Object.keys(room.members).length, rulesetId: room.rulesetId }
    : null };
}
