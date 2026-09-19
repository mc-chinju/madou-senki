import {describe, expect, it} from 'vitest';
import {createGame, pendingSetupSeats, transition, viewFor, type GameState, type LogView} from '../src/index.js';
import {choose, legalCommands, type Command} from '../src/bot/index.js';
import {seededEntropy} from './fixtures.js';

/** Same seat choice as the bot driver, but keeps the command so the step can be audited. */
function actingActor(state: GameState): string | undefined {
  const withCommands = state.seatOrder.filter(id => legalCommands(viewFor(state, id)).length);
  const window = state.windows?.at(-1);
  const candidates = [window?.participants[window.cursor], state.seatOrder[state.turnSeat], ...pendingSetupSeats(state)];
  return candidates.find(id => id && withCommands.includes(id)) ?? withCommands[0];
}

/** Cards everyone can see on the table right now. */
function faceUp(state: GameState): Set<string> {
  return new Set([
    ...state.resolution,
    ...Object.values(state.distanceMarkers ?? {}).map(marker => marker.cardInstanceId),
    ...state.seatOrder.flatMap(id => {
      const p = state.players[id]!;
      return [...p.open, ...p.attachments, ...[...p.followers, ...p.chants].filter(card => card.revealed).map(card => card.cardInstanceId)];
    }),
  ]);
}

/** Cards only their holder may know: hand, face-down chants and face-down followers. */
function hiddenFrom(state: GameState, viewerId: string): Set<string> {
  return new Set(state.seatOrder.filter(id => id !== viewerId).flatMap(id => {
    const p = state.players[id]!;
    return [...p.hand, ...[...p.followers, ...p.chants].filter(card => !card.revealed).map(card => card.cardInstanceId)];
  }));
}

/** Cards a command puts face up by naming them; discards, chants and placements stay face down. */
function playedByCommand(command: Command): Set<string> {
  if (['END_TURN', 'CHANT', 'ARRANGE_FOLLOWERS', 'PLACE_INITIAL_FOLLOWER'].includes(command.type)) return new Set();
  const ids = new Set<string>();
  JSON.stringify(command, (_, value) => { if (typeof value === 'string') ids.add(value); return value; });
  return ids;
}

function cardIds(log: LogView): string[] {
  return [log.cardInstanceId, log.death?.sourceCardInstanceId].filter((id): id is string => typeof id === 'string');
}

/** An ability name belongs to its owner's character sheet, so a hidden seat must not be named by one. */
function abilityOwner(abilityId: string): string {
  return abilityId.replace(/-ab\d+$/, '');
}

describe('public record privacy over full bot games', () => {
  it.each([4, 6])('%i seats: public logs name only cards that were face up or played face up', seats => {
    const seed = seats + 11;
    const entropy = seededEntropy(seed);
    let state = createGame(Array.from({length: seats}, (_, i) => ({id: `P${i}`, name: `P${i}`})), entropy);
    let steps = 0;
    const seen = {abilityId: 0, threshold: 0};
    for (; !state.outcome && steps < 5000; steps++) {
      const actorId = actingActor(state);
      if (!actorId) throw Error('NO_ACTING_SEAT');
      const command = choose(viewFor(state, actorId), seed);
      const result = transition(state, {actorId, command}, entropy);
      if (!result.ok) throw Error(`${result.code} ${JSON.stringify(command)}`);
      const prev = state, next = result.state;
      const lastEventId = prev.events.at(-1)?.id ?? 0;
      const allowed = new Set([...faceUp(prev), ...faceUp(next), ...playedByCommand(command)]);
      const played = new Set(next.events.filter(event => event.id > lastEventId && event.type === 'CARD_PLAYED').map(event => event.cardInstanceId));
      // Destroyed followers also pass through resolution; their record belongs to the later stage.
      const destroyed = new Set(prev.seatOrder.flatMap(id => prev.players[id]!.followers.map(card => card.cardInstanceId)));
      for (const id of next.resolution) if (!prev.resolution.includes(id) && !destroyed.has(id)) expect(played.has(id), `step=${steps} resolution=${id} command=${JSON.stringify(command)}`).toBe(true);
      for (const viewerId of next.seatOrder) {
        const fresh = viewFor(next, viewerId).logs.filter(log => log.id > lastEventId);
        const secret = hiddenFrom(next, viewerId);
        for (const log of fresh) {
          for (const id of cardIds(log)) {
            const context = `step=${steps} viewer=${viewerId} log=${JSON.stringify(log)} command=${JSON.stringify(command)}`;
            expect(allowed.has(id), context).toBe(true);
            // A card still hidden after the step cannot have been shown, unless this step's command played it.
            if (!playedByCommand(command).has(id)) expect(secret.has(id), context).toBe(false);
          }
          const context = `step=${steps} viewer=${viewerId} log=${JSON.stringify(log)}`;
          if (log.characterId && log.actorId !== viewerId) expect(next.players[log.actorId]!.revealed, context).toBe(true);
          // An ability names the character behind it, so only a seat that is already open may be named by one.
          if (log.abilityId) seen.abilityId++;
          if (log.roll?.threshold !== undefined) seen.threshold++;
          if (log.abilityId && log.actorId !== viewerId) {
            expect(next.players[log.actorId]!.revealed, context).toBe(true);
            expect(abilityOwner(log.abilityId), context).toBe(next.players[log.actorId]!.characterId);
          }
          // The threshold is the roller's modified spirit; a hidden seat keeps it (G03 判定の公開範囲).
          if (log.roll?.threshold !== undefined && log.actorId !== viewerId) expect(next.players[log.actorId]!.revealed, context).toBe(true);
        }
      }
      state = next;
    }
    expect(state.outcome).toBeDefined();
    // A check is worth nothing if the game never produced the field it guards. Thresholds always appear;
    // ability records depend on what the bot chooses, so that count is reported rather than required.
    expect(seen.threshold, `no roll threshold reached the record: ${JSON.stringify(seen)}`).toBeGreaterThan(0);
  }, 60_000);
});
