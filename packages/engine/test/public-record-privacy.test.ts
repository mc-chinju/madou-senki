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

/** The seat holding each card right now, by zone. A card the table shares has no holder. */
function holders(state: GameState): Map<string, string> {
  const held = new Map<string, string>();
  for (const id of state.seatOrder) {
    const p = state.players[id]!;
    for (const card of [...p.hand, ...p.open, ...p.attachments, ...[...p.followers, ...p.chants].map(c => c.cardInstanceId)]) held.set(card, id);
  }
  return held;
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

describe('public record privacy over full bot games', () => {
  it.each([4, 6])('%i seats: public logs name only cards that were face up or played face up', seats => {
    const seed = seats + 11;
    const entropy = seededEntropy(seed);
    let state = createGame(Array.from({length: seats}, (_, i) => ({id: `P${i}`, name: `P${i}`})), entropy);
    // The last seat each card belonged to, so a pile entry can be checked against its real origin.
    const lastHeld = new Map<string, string>();
    let steps = 0;
    for (; !state.outcome && steps < 5000; steps++) {
      for (const [card, seat] of holders(state)) lastHeld.set(card, seat);
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
      // A pile entry names the seat the card came from, not whoever's action swept it away. Cards that
      // never belonged to a seat (straight off the deck) have no owner to check.
      const alreadyInPile = new Set(prev.discard.map(entry => entry.cardInstanceId));
      for (const entry of next.discard) {
        if (alreadyInPile.has(entry.cardInstanceId)) continue;
        const owner = lastHeld.get(entry.cardInstanceId);
        if (owner) expect(entry.ownerId, `step=${steps} discarded=${entry.cardInstanceId} command=${JSON.stringify(command)}`).toBe(owner);
      }
      for (const viewerId of next.seatOrder) {
        const view = viewFor(next, viewerId);
        const fresh = view.logs.filter(log => log.id > lastEventId);
        const secret = hiddenFrom(next, viewerId);
        // A seat reviews only what it let go itself, and only while the card is still in the pile.
        const pile = new Set(next.discard.map(card => card.cardInstanceId));
        for (const id of view.self.discardedCardInstanceIds) {
          const context = `step=${steps} viewer=${viewerId} discarded=${id}`;
          expect(pile.has(id), context).toBe(true);
          expect(secret.has(id), context).toBe(false);
        }
        // Seats the table has seen open at least once; re-hiding afterwards does not unsay it.
        const opened = new Set(next.events.filter(event => event.type === 'CHARACTER_REVEALED' && event.audience === 'public').map(event => event.actorId));
        for (const log of fresh) {
          for (const id of cardIds(log)) {
            const context = `step=${steps} viewer=${viewerId} log=${JSON.stringify(log)} command=${JSON.stringify(command)}`;
            expect(allowed.has(id), context).toBe(true);
            // A card still hidden after the step cannot have been shown, unless this step's command played it.
            if (!playedByCommand(command).has(id)) expect(secret.has(id), context).toBe(false);
          }
          const context = `step=${steps} viewer=${viewerId} log=${JSON.stringify(log)}`;
          // 隠行 and ALSEIL_SHADOW put a seat back face down, so "it is open right now" is not what the
          // record promised. Both lines below read the durable fact the projection was built from instead.
          if (log.characterId && log.actorId !== viewerId) {
            expect(log.characterId, context).toBe(next.players[log.actorId]!.characterId);
            expect(opened.has(log.actorId), context).toBe(true);
          }
          // The threshold is the roller's modified spirit (G03 判定の公開範囲). A bot game does reach this:
          // at 6 seats a hidden seat throws excess-level checks, so removing view.ts's gate breaks this line.
          if (log.roll?.threshold !== undefined && log.actorId !== viewerId) {
            expect(next.rolls!.find(roll => roll.id === log.roll!.rollId)?.rollerRevealed, context).toBe(true);
          }
          // Only the ability-name reading is out of reach here: the bot declares none at 4 or 6 seats.
          // public-record-events.test.ts's allowlist pins that one instead.
        }
      }
      state = next;
    }
    expect(state.outcome).toBeDefined();
  }, 60_000);
});
