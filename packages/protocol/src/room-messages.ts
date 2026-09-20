import type { CommandEnvelope, GameCommand, ParseResult, PublicServerErrorCode } from './messages.js';
import { parseCommandEnvelope } from './validation.js';

/** Shared UTF-8 transport cap for browser persistence/send and Worker reception. */
export const MAX_COMMAND_MESSAGE_BYTES = 16_384;

export type RoomCommand =
  | { type: 'READY'; ready: boolean }
  | { type: 'START' }
  | { type: 'LEAVE' }
  | { type: 'CLOSE_BY_AGREEMENT'; agree: boolean }
  | { type: 'UPDATE_SETTINGS'; title: string; capacity: number; visibility: 'public' | 'private' };
export interface ClientEnvelope extends Omit<CommandEnvelope, 'command'> { command: GameCommand | RoomCommand }
export type ClientErrorCode = PublicServerErrorCode | 'FORBIDDEN' | 'ROOM_FULL' | 'ROOM_NOT_OPEN' | 'NOT_READY' | 'RULESET_NOT_READY';
/** The most of the record one request may pull back, so a page always fits a single frame. */
export const MAX_LOG_PAGE = 200;
/** Reading further back in the record. It commits nothing, so it travels beside commands rather than as one. */
export interface LogPageRequest { type: 'LOG_PAGE'; requestId: string; beforeId: number; limit: number }
export type ClientServerMessage<View, Log = unknown> =
  | { type: 'snapshot'; revision: number; view: View }
  | { type: 'log-page'; requestId: string; beforeId: number; logStart: number; logs: Log[]; privateLogs: Log[] }
  | { type: 'ack'; commandId: string; revision: number }
  | { type: 'error'; commandId?: string; code: ClientErrorCode };

const roomTypes: readonly string[] = ['READY', 'START', 'LEAVE', 'CLOSE_BY_AGREEMENT', 'UPDATE_SETTINGS'];
export function isRoomCommand(command: GameCommand | RoomCommand): command is RoomCommand { return roomTypes.includes(command.type); }

function dataRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    if (![null, Object.prototype].includes(Object.getPrototypeOf(value))) return null;
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !keys.includes(key)) return null;
      const field = Object.getOwnPropertyDescriptor(value, key);
      if (!field?.enumerable || !('value' in field)) return null;
      result[key] = field.value;
    }
    return result;
  } catch { return null; }
}

/** Read requests carry no envelope: there is no revision to be stale against and nothing to replay.
 *  `null` says the payload never claimed to be one, so the caller may still read it as a command. */
export function parseLogPageRequest(value: unknown): ParseResult<LogPageRequest> | null {
  const request = dataRecord(value, ['type', 'requestId', 'beforeId', 'limit']);
  const invalid = { ok: false, code: 'INVALID_COMMAND' } as const;
  if (!request || request.type !== 'LOG_PAGE') return null;
  if (Object.keys(request).length !== 4) return invalid;
  if (typeof request.requestId !== 'string' || !request.requestId || request.requestId.length > 64) return invalid;
  if (typeof request.beforeId !== 'number' || !Number.isSafeInteger(request.beforeId) || request.beforeId < 0) return invalid;
  if (typeof request.limit !== 'number' || !Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > MAX_LOG_PAGE) return invalid;
  return { ok: true, value: { type: 'LOG_PAGE', requestId: request.requestId, beforeId: request.beforeId, limit: request.limit } };
}

export function parseClientEnvelope(value: unknown): ParseResult<ClientEnvelope> {
  const game = parseCommandEnvelope(value);
  if (game.ok) return game;
  const outer = dataRecord(value, ['protocolVersion', 'commandId', 'expectedRevision', 'command']);
  if (!outer) return { ok: false, code: 'INVALID_ENVELOPE' };
  // Reuse the established transport validator after safely reading the outer data.
  const envelope = parseCommandEnvelope({ ...outer, command: { type: 'PASS' } });
  if (!envelope.ok) return envelope;
  const c = dataRecord(outer.command, ['type', 'ready', 'agree', 'title', 'capacity', 'visibility']);
  const invalid = { ok: false, code: 'INVALID_COMMAND' } as const;
  if (!c) return invalid;
  const exact = (...keys: string[]) => Object.keys(c).length === keys.length && keys.every(key => Object.hasOwn(c, key));
  let command: RoomCommand;
  switch (c.type) {
    case 'START': case 'LEAVE':
      if (!exact('type')) return invalid;
      command = { type: c.type }; break;
    case 'READY':
      if (!exact('type', 'ready') || typeof c.ready !== 'boolean') return invalid;
      command = { type: c.type, ready: c.ready }; break;
    case 'CLOSE_BY_AGREEMENT':
      if (!exact('type', 'agree') || typeof c.agree !== 'boolean') return invalid;
      command = { type: c.type, agree: c.agree }; break;
    case 'UPDATE_SETTINGS': {
      if (!exact('type', 'title', 'capacity', 'visibility') || typeof c.title !== 'string' ||
        /[\p{Cc}\p{Cf}]/u.test(c.title) || typeof c.capacity !== 'number' || !Number.isInteger(c.capacity) || c.capacity < 4 || c.capacity > 10 ||
        (c.visibility !== 'public' && c.visibility !== 'private')) return invalid;
      const title = c.title.trim().normalize('NFC');
      if (!title || [...title].length > 60) return invalid;
      command = { type: c.type, title, capacity: c.capacity, visibility: c.visibility }; break;
    }
    default: return invalid;
  }
  return { ok: true, value: { ...envelope.value, command } };
}
