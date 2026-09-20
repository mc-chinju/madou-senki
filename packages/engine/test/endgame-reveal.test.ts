import {expect, it} from 'vitest';
import {moveToDiscard, viewFor, type GameState, type Outcome} from '../src/index.js';
import {handCard} from './fixtures.js';
import {ready} from './combat-helpers.js';

/** A table mid-game with something of every kind hidden: a hand, a face-down follower, a face-down chant. */
function hiddenTable(): GameState {
  const s = ready();
  const follower = handCard(s, 'B', '兵士'); s.players.B!.hand = s.players.B!.hand.filter(id => id !== follower);
  s.players.B!.followers.push({cardInstanceId: follower, revealed: false});
  const chant = handCard(s, 'B', '命運凶変'); s.players.B!.hand = s.players.B!.hand.filter(id => id !== chant);
  s.players.B!.chants.push({cardInstanceId: chant, revealed: false});
  moveToDiscard(s, s.players.C!.hand.shift()!, {faceUp: false});
  return s;
}
/** A settled game, the one condition the reveal waits on. */
function decided(): Outcome {
  return {kind: 'victory', reason: 'objectives', winnerIds: ['A'], results: {A: 'won', B: 'lost', C: 'lost', D: 'lost'}};
}

it('keeps every seat closed while the game is still being played', () => {
  const s = hiddenTable();
  const view = viewFor(s, 'A');
  expect(view.reveal).toBeNull();
  const serialized = JSON.stringify(view);
  for (const id of ['B', 'C', 'D']) {
    const p = s.players[id]!;
    for (const secret of [...p.hand, ...p.followers.map(c => c.cardInstanceId), ...p.chants.map(c => c.cardInstanceId)]) expect(serialized).not.toContain(secret);
  }
  for (const card of s.deck) expect(serialized).not.toContain(card);
});

it('opens every hand, person, face-down card, pile and deck once the game ends', () => {
  const s = hiddenTable();
  s.outcome = decided();
  for (const viewerId of s.seatOrder) {
    const reveal = viewFor(s, viewerId).reveal;
    expect(reveal).not.toBeNull();
    for (const id of s.seatOrder) {
      const p = s.players[id]!;
      expect(reveal!.players[id]).toEqual({characterId: p.characterId, hand: p.hand,
        followers: p.followers.map(c => c.cardInstanceId), chants: p.chants.map(c => c.cardInstanceId)});
    }
    expect(reveal!.deck).toEqual(s.deck);
    expect(reveal!.discard).toEqual(s.discard);
  }
});

it('adds the opening without moving anything else the view already said', () => {
  const s = hiddenTable();
  const playing = viewFor(s, 'A');
  s.outcome = decided();
  const finished = viewFor(s, 'A');
  // The outcome itself, and the choices it ends, were already the view's answer before this change; anything
  // else moving here would mean the opening leaked into a field the game also reads while it is played.
  expect({...finished, reveal: null, outcome: null, legalChoices: playing.legalChoices}).toEqual(playing);
});

it('hands out copies, so a reader cannot write back into the game', () => {
  const s = hiddenTable();
  s.outcome = decided();
  const before = JSON.stringify(s);
  const reveal = viewFor(s, 'A').reveal!;
  reveal.deck.length = 0; reveal.discard.length = 0; reveal.players.B!.hand.push('intruder'); reveal.players.B!.characterId = 'intruder';
  expect(JSON.stringify(s)).toBe(before);
});
