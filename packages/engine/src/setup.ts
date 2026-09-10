import {enqueueLifecycle} from './lifecycle/events.js';
import {spiritBase} from './abilities/spirit-lifetime.js';
import {hasStatus} from './state.js';
import {factionObjective,initialProtection} from './lifecycle/objectives.js';
import {advanceLifecycle} from './lifecycle/advance.js';
import { deck, getAction, getCharacter, initialCharacterPool, ruleset } from '@madou/catalog';
import type { DerivedStats, Entropy, GameEvent, GameState, PlayerState, SetupOptions } from './state.js';
export class EntropyError extends Error {}
export function randomSource(entropy: Entropy): () => number {
  if (!entropy || !Number.isFinite(entropy.now) || !Array.isArray(entropy.dice) || entropy.dice.some(x => !Number.isInteger(x) || x < 1 || x > 6) ||
      (entropy.random !== undefined && (!Array.isArray(entropy.random) || entropy.random.some(x => !Number.isFinite(x) || x < 0 || x >= 1)))) throw new EntropyError('INVALID_ENTROPY');
  let index = 0;
  return () => { const n = entropy.random?.[index++]; if (n === undefined) throw new EntropyError('ENTROPY_EXHAUSTED'); return n; };
}
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j]!, result[i]!]; }
  return result;
}
export function appendEvent(state: GameState, at: number, event: Omit<GameEvent, 'id' | 'at'>): void {
  state.events.push({ ...event, id: state.nextEventId++, at });
}
/** Player-local arithmetic; live game callers must supply the state-aware ability gate via gameStats. */
export function derivedStats(player: PlayerState, options:{excludeSourceAbilityId?:string|undefined;spiritAddition?:number;magicAddition?:number;abilityAllowed?:boolean}={}): DerivedStats {
  const c = getCharacter(player.characterId); if (!c) throw new Error('UNKNOWN_CHARACTER');
  const names = (player.presence==='wandering'?[]:player.open).map(id => getAction(id)?.name);
  const blood = names.filter(n => n === '神々の血').length;
  const blessing = names.filter(n => n === '祝福').length;
  const haja = names.filter(n => n === '賢者ハジャ').length;
  const attachments=(player.presence==='wandering'?[]:player.attachments).map(id=>getAction(id)?.name);const warrior=attachments.filter(name=>name==='香具羅'||name==='修行（戦士技）').length;const magic=attachments.filter(name=>name==='魔導書'||name==='修行（魔法技）').length;const spirit=attachments.filter(name=>name==='悪の魅力'||name==='聖光').length;
  const drain=(player.statuses??[]).reduce((sum,status)=>sum+(status.timing==='until-death'?status.amount:0),0);
  return { warrior_level: Math.max(0,c.base_stats.warrior_level + (player.permanent?.warrior_level??0) + blood+warrior-drain), magic_level: Math.max(0,c.base_stats.magic_level + (player.permanent?.magic_level??0) + blood+magic-drain+(options.magicAddition??0)),
    spirit: Math.max(0,spiritBase(player,c.base_stats.spirit,options.abilityAllowed??(!hasStatus(player,'stopped')&&!hasStatus(player,'ability-disabled')),options.excludeSourceAbilityId) + (player.permanent?.spirit??0) + blood+spirit-drain+(options.spiritAddition??0)), endurance: c.base_stats.endurance+(player.permanent?.endurance??0),
    handLimit: 5 + haja, followerLimit: 2 + blessing, chantLimit: 1 + haja, followerLevelBonus: blessing, moraleBonus: blessing };
}
/** Setup refills to five, even when Haja raises the eventual hand limit. OPEN is resolved before the next draw. */
export function refillInitialHand(state: GameState, player: PlayerState, random: () => number, now: number): void {
  refillHand(state, player, 5, random, now);
}
export function refillHand(state: GameState, player: PlayerState, target: number, random: () => number, now: number): void {
  enqueueLifecycle(state,{kind:'draw',id:`draw-${state.revision}-${player.id}-${state.nextEventId}`,actorId:player.id,target});
}

export function createGame(players: { id: string; name: string }[], entropy: Entropy, options: SetupOptions = {}): GameState {
  if (!Array.isArray(players) || players.length < 4 || players.length > 10 || players.some(p => !p || typeof p.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(p.id) || ['__proto__', 'prototype', 'constructor'].includes(p.id) || typeof p.name !== 'string' || !p.name.trim()) || new Set(players.map(p => p.id)).size !== players.length) throw new Error('INVALID_PLAYERS');
  if (!options || (options.distribution !== undefined && !['balanced', 'random'].includes(options.distribution)) || (options.startingSeat !== undefined && (!Number.isInteger(options.startingSeat) || options.startingSeat < 0 || options.startingSeat >= players.length))) throw new Error('INVALID_OPTIONS');
  const random = randomSource(entropy);
  let selected;
  if (options.distribution === 'random') selected = shuffle(initialCharacterPool, random).slice(0, players.length);
  else {
    const good = shuffle(initialCharacterPool.filter(c => c.initial_faction === 'GOOD'), random);
    const evil = shuffle(initialCharacterPool.filter(c => c.initial_faction === 'EVIL'), random);
    const half = Math.floor(players.length / 2);
    selected = [...good.slice(0, half), ...evil.slice(0, half)];
    if (players.length % 2) { const remaining = [...good.slice(half), ...evil.slice(half)]; selected.push(remaining[Math.floor(random() * remaining.length)]!); }
    selected = shuffle(selected, random);
  }
  const turnSeat = options.startingSeat ?? Math.floor(random() * players.length);
  const state: GameState = { rulesetVersion: ruleset.id, revision: 0, phase: 'setup', seatOrder: players.map(p => p.id), players: {}, turnSeat,
    initialFactions:selected.map(c=>c.initial_faction), setupCursor: 0, pending: { kind: 'initial-followers', actorId: players[0]!.id, seat: 0 }, distances: {},
    deck: shuffle(deck.flatMap(c => Array.from({ length: c.copies }, () => c.id)), random), discard: [], resolution: [], reclaimReservations: [], nextEventId: 1, events: [] };
  players.forEach((p, i) => {
    const c = selected[i]!;
    state.players[p.id] = { id: p.id, name: p.name, characterId: c.id, revealed: false, faction: c.initial_faction, objective: c.objective, currentObjective:factionObjective(c.initial_faction), protection:initialProtection(c.id), presence:'active', damage: 0, hand: [], followers: [], chants: [], open: [], attachments: [] };
    state.distances[p.id] = Object.fromEntries(players.filter(other => other.id !== p.id).map(other => [other.id, 'far' as const]));
    appendEvent(state, entropy.now, { type: 'CHARACTER_ASSIGNED', actorId: p.id, audience: { playerId: p.id }, characterId: c.id });
  });
  for (const id of state.seatOrder) {refillInitialHand(state, state.players[id]!, random, entropy.now);advanceLifecycle(state,random,entropy.now);}
  return state;
}
