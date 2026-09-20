import {expect, it} from 'vitest';
import {gameStats, moveToDiscard, viewFor, type GameState, type LogView} from '../src/index.js';
import {act, finish, pass, ready, until} from './combat-helpers.js';
import {character, handCard} from './fixtures.js';
import {makeShurikenPhysical, shurikenCard} from './fixtures/shuriken-physical-scenarios.js';
import {assignCharacter, takeCard} from './fixtures/scenario-tools.js';
const FAIRY_SWORD = 'a2-p04-r2c1';

const ofType = (s: GameState, viewer: string, type: LogView['type']) => viewFor(s, viewer).logs.filter(log => log.type === type);
const ownOfType = (s: GameState, viewer: string, type: LogView['type']) => viewFor(s, viewer).privateLogs.filter(log => log.type === type);
/** Nothing in the shared record may spell out a card that never turned face up. */
function namesNothing(s: GameState, viewer: string, cardInstanceIds: string[]): void {
  const shared = JSON.stringify(viewFor(s, viewer).logs);
  for (const id of cardInstanceIds) expect(shared, `viewer=${viewer} card=${id}`).not.toContain(id);
}

it('counts the cards a hand adjustment let go for the table and names them for their owner', () => {
  let s = ready();
  s = act(s, 'A', {type: 'PASS_ACTION'});
  const extra = [handCard(s, 'A', '烈火'), handCard(s, 'A', '白輪')];
  const since = s.nextEventId;
  s = act(s, 'A', {type: 'END_TURN', discardIds: extra});
  const shared = ofType(s, 'C', 'CARDS_DISCARDED').filter(log => log.id >= since);
  expect(shared.map(log => [log.actorId, log.count])).toEqual([['A', 1], ['A', 1]]);
  expect(shared.every(log => !('cardInstanceId' in log))).toBe(true);
  namesNothing(s, 'C', extra);
  expect(ownOfType(s, 'A', 'CARDS_DISCARDED').filter(log => log.id >= since).map(log => log.cardInstanceId)).toEqual(extra);
});

it('sweeps a dead seat\'s unseen hand into the same counted record', () => {
  let s = ready();
  s.players.B!.damage = gameStats(s, 'B').endurance - 1;
  const attack = handCard(s, 'A', '踏み込み／弓');
  const hand = [...s.players.B!.hand];
  s = finish(act(s, 'A', {type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false}));
  expect(s.players.B!.presence).toBe('dead');
  expect(ofType(s, 'C', 'CARDS_DISCARDED').filter(log => log.actorId === 'B')).toHaveLength(hand.length);
  namesNothing(s, 'C', hand);
  expect(ownOfType(s, 'B', 'CARDS_DISCARDED').map(log => log.cardInstanceId).sort()).toEqual([...hand].sort());
});

it('gives the table the fact of a chant and an arrangement and the seat the cards it put down', () => {
  let s = ready();
  const chant = handCard(s, 'A', '天地百撃斬');
  s = act(s, 'A', {type: 'CHANT', cardInstanceId: chant, dedicated: true});
  expect(ofType(s, 'C', 'CHANTED')).toEqual([expect.objectContaining({actorId: 'A'})]);
  expect(ofType(s, 'C', 'CHANTED').every(log => !('cardInstanceId' in log))).toBe(true);
  namesNothing(s, 'C', [chant]);
  namesNothing(s, 'A', [chant]);
  expect(ownOfType(s, 'A', 'CHANTED').map(log => log.cardInstanceId)).toEqual([chant]);

  let t = ready();
  const follower = handCard(t, 'A', '兵士');
  t = act(t, 'A', {type: 'ARRANGE_FOLLOWERS', cardInstanceIds: [follower]});
  expect(ofType(t, 'C', 'FOLLOWERS_ARRANGED')).toEqual([expect.objectContaining({actorId: 'A', count: 1})]);
  expect(ofType(t, 'C', 'FOLLOWERS_ARRANGED').every(log => !('cardInstanceIds' in log))).toBe(true);
  namesNothing(t, 'C', [follower]);
  namesNothing(t, 'A', [follower]);
  expect(ownOfType(t, 'A', 'FOLLOWERS_ARRANGED').map(log => log.cardInstanceIds)).toEqual([[follower]]);
});

/** A chant swept off the table by a hit was never turned over, so it leaves the same counted trace. */
it('counts the chants a hit swept away for the table and names them for their owner', () => {
  let s = makeShurikenPhysical('shuriken-mixed', ['A', 'B', 'C', 'D'].map(id => ({id, name: id})));
  const chants = s.players.B!.chants.map(c => c.cardInstanceId);
  expect(chants).toHaveLength(2);
  const since = s.nextEventId;
  s = until(act(s, 'A', {type: 'ATTACK', cardInstanceId: shurikenCard, targetIds: ['B', 'C'], dedicated: true}), 'on-hit-choice');
  s = act(s, 'A', {type: 'DISCARD_HIT_CHANTS', discard: true});
  expect(s.players.B!.chants).toEqual([]);
  const shared = ofType(s, 'D', 'CARDS_DISCARDED').filter(log => log.id >= since && log.actorId === 'B');
  expect(shared.map(log => log.count)).toEqual([1, 1]);
  expect(shared.every(log => !('cardInstanceId' in log))).toBe(true);
  namesNothing(s, 'D', chants);
  namesNothing(s, 'B', chants);
  expect(ownOfType(s, 'B', 'CARDS_DISCARDED').filter(log => log.id >= since).map(log => log.cardInstanceId)).toEqual(chants);
});

/** A follower is turned face up to answer an attack, so its check and what it did are both public and in order. */
it('names the follower in its morale check and then in what it did to the attack', () => {
  let s = ready();
  const attack = handCard(s, 'A', '踏み込み／弓');
  const follower = handCard(s, 'B', '妖精族');
  s.players.B!.hand = s.players.B!.hand.filter(id => id !== follower);
  s.players.B!.followers = [{cardInstanceId: follower, revealed: false}];
  s = until(act(s, 'A', {type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false}), 'normal-defense');
  s = finish(act(s, 'B', {type: 'START_FOLLOWERS'}));
  const logs = viewFor(s, 'C').logs;
  const morale = logs.findIndex(log => log.type === 'MORALE_CHECKED');
  const defended = logs.findIndex(log => log.type === 'FOLLOWER_DEFENDED');
  expect(logs[morale]).toMatchObject({actorId: 'B', cardInstanceId: follower, success: true});
  expect(logs[defended]).toMatchObject({actorId: 'B', cardInstanceId: follower});
  expect(logs[defended]!.followerOutcome).toBeDefined();
  expect(morale).toBeLessThan(defended);
});

it('names a card taken back off the table, to everyone', () => {
  let s = ready();
  character(s, 'A', '大神官ジル');
  s.players.A!.damage = 1;
  const card = handCard(s, 'A', '封傷');
  s = until(act(s, 'A', {type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: card, targetIds: ['A'], dedicated: false}), 'reclaim');
  const reclaim = viewFor(s, 'A').reclaim!;
  s = act(s, 'A', {type: 'CHOOSE_RECLAIM', decisionId: reclaim.decisionId, claimId: reclaim.claims[0]!.claimId, choice: 'take'});
  expect(s.players.A!.hand.concat(s.reclaimReservations)).toContain(card);
  expect(ofType(s, 'C', 'CARD_RECLAIMED')).toEqual([expect.objectContaining({actorId: 'A', cardInstanceId: card})]);
});

/** The pile is not on the table (G11), so a card taken out of it is named to its taker and nobody else. */
it('keeps a card taken back out of the pile to the seat that took it', () => {
  let s = ready();
  assignCharacter(s, 'A', '大神官ジル');
  assignCharacter(s, 'C', '小妖精のチャム');
  takeCard(s, 'A', FAIRY_SWORD);
  s = act(s, 'C', {type: 'REVEAL_CHARACTER'});
  for (const name of ['神性介入', '封傷', '転移', '衝破']) if (s.players.A!.hand.length <= gameStats(s, 'A').handLimit) handCard(s, 'A', name);
  s = act(s, 'A', {type: 'PASS_ACTION'});
  const excess = s.players.A!.hand.length - gameStats(s, 'A').handLimit;
  expect(excess).toBeGreaterThan(0);
  s = act(s, 'A', {type: 'END_TURN', discardIds: [FAIRY_SWORD, ...s.players.A!.hand.filter(id => id !== FAIRY_SWORD)].slice(0, excess)});
  while (viewFor(s, 'C').reclaim?.pendingActorId !== 'C') s = pass(s);
  const decision = viewFor(s, 'C').reclaim!;
  s = act(s, 'C', {type: 'CHOOSE_RECLAIM', decisionId: decision.decisionId, claimId: decision.claims[0]!.claimId, choice: 'take'});
  const taken = ofType(s, 'B', 'CARD_RECLAIMED');
  expect(taken).toEqual([expect.objectContaining({actorId: 'C'})]);
  expect(taken.every(log => !('cardInstanceId' in log))).toBe(true);
  namesNothing(s, 'B', [FAIRY_SWORD]);
  namesNothing(s, 'C', [FAIRY_SWORD]);
  expect(ownOfType(s, 'C', 'CARD_RECLAIMED').map(log => log.cardInstanceId)).toEqual([FAIRY_SWORD]);
});

it('records the pile going back under the deck, when it runs out and when Dawn calls it back', () => {
  const emptied = (dawn?: string, behind = 0) => {
    let s = ready();
    s = act(s, 'A', {type: 'PASS_ACTION'});
    // Only the pile is left to draw from, so the refill below has to rebuild the deck first.
    for (const id of [...s.deck]) moveToDiscard(s, id, {faceUp: true});
    s.deck = dawn ? [dawn] : [];
    if (dawn) s.discard = s.discard.filter(entry => entry.cardInstanceId !== dawn);
    // Cards sitting behind Dawn are still in the deck when the pile comes back, so they are not returned.
    for (let n = 0; n < behind; n++) s.deck.push(s.discard.pop()!.cardInstanceId);
    moveToDiscard(s, s.players.A!.hand.pop()!, {faceUp: true});
    const pile = s.discard.length;
    return {s: act(s, 'A', {type: 'END_TURN', discardIds: []}), pile};
  };

  const {s: drained, pile} = emptied();
  expect(ofType(drained, 'C', 'DECK_RESHUFFLED')).toEqual([expect.objectContaining({actorId: 'A', count: pile})]);

  const dawn = 'a2-p01-r1c2';
  // Dawn calls the pile back while cards are still in the deck, so the line counts what came back, not the deck.
  const {s: called, pile: returned} = emptied(dawn, 3);
  expect(called.players.A!.open).toContain(dawn);
  expect(called.deck.length).toBeGreaterThan(returned);
  expect(ofType(called, 'C', 'DECK_RESHUFFLED')).toEqual([expect.objectContaining({actorId: 'A', count: returned})]);
  expect(called.discard).toEqual([]);
});
