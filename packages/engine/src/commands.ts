import type { GameCommand } from '@madou/protocol';
import type { GameEvent, GameState, PlayerId } from './state.js';
export type { GameCommand } from '@madou/protocol';
export interface GameInput { actorId: PlayerId; command: GameCommand }
export type EngineErrorCode = 'GAME_COMPLETE' | 'INACTIVE_ACTOR' | 'INVALID_COMMAND' | 'UNKNOWN_ACTOR' | 'WRONG_PHASE' | 'NOT_YOUR_TURN' | 'CARD_NOT_IN_HAND' | 'NOT_FOLLOWER' | 'FOLLOWER_CAPACITY' | 'FOLLOWER_RESTRICTED' | 'ALREADY_REVEALED' | 'INVALID_ENTROPY' | 'UNSUPPORTED_CARD' | 'CHANT_CAPACITY' | 'INVALID_DISCARD' | 'STOPPED' | 'SILENCED' | 'ABILITY_DISABLED' | 'INVALID_TARGET' | 'OUT_OF_RANGE' | 'DEFENSE_WINDOW_CLOSED' | 'ILLEGAL_DEFENSE' | 'NOT_PRIORITY' | 'CHANT_REQUIRED' | 'ALREADY_USED';
export type TransitionResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; code: EngineErrorCode };
