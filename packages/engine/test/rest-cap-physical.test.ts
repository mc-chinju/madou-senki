import {expect, it} from 'vitest';
import {getAction} from '@madou/catalog';
import {gameStats} from '../src/game-stats.js';
import {settleDamage} from '../src/lifecycle/advance.js';
import {act, finish, ready} from './combat-helpers.js';
import {assignCharacter, takeCard, trimHand} from '../../../apps/worker/test/fixtures/scenario-tools.js';

it.each(['a2-p07-r1c1','a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1','a2-p07-r2c2','a2-p07-r2c3','a2-p07-r3c1','a2-p07-r3c2'])('Physical %s rest caps recovery and consumes every paid copy beyond the cap', card => {
  let state = ready();
  assignCharacter(state, 'A', '侍大将のシン');
  assignCharacter(state, 'B', '黒騎士ガーウィン');
  assignCharacter(state, 'C', '魔聖母ディア');
  assignCharacter(state, 'D', '魔導王ガイナス');
  for (const player of Object.values(state.players)) player.permanent = {endurance: 100, spirit: 20, warrior_level: 20};
  state.players.A!.damage = 1;
  state.players.B!.damage = 3;
  const second = card === 'a2-p07-r1c1' ? 'a2-p07-r1c2' : 'a2-p07-r1c1';
  for (const id of [card, second]) takeCard(state, 'A', id);
  trimHand(state, 'A', card, second);
  state.deck = [...state.deck.filter(id => getAction(id)!.category !== 'open'), ...state.deck.filter(id => getAction(id)!.category === 'open')];
  state = act(state, 'A', {type: 'REST', cardInstanceIds: [card, second]});
  expect(state.players.A!.damage).toBe(1);
  expect(state.resolution).toEqual(expect.arrayContaining([card, second]));
  state = finish(state);
  expect(state.players.A!.damage).toBe(0);
  expect(state.players.B!.damage).toBe(3);
  expect(state.phase).toBe('hand-adjustment');
  for (const id of [card, second]) {
    expect(state.discard.filter(value => value === id)).toHaveLength(1);
    expect(state.players.A!.hand).not.toContain(id);
    expect(state.resolution).not.toContain(id);
  }
});

it.each([5, -5])('Rest resolves against the live maximum after a structural endurance change of %s', change => {
  let state = ready();
  assignCharacter(state, 'A', '侍大将のシン');
  state.players.A!.permanent = {endurance: 100};
  state.players.A!.damage = 1;
  const cards = ['a2-p07-r1c1', 'a2-p07-r1c2'];
  for (const card of cards) takeCard(state, 'A', card);
  trimHand(state, 'A', ...cards);
  state.deck = [...state.deck.filter(id => getAction(id)!.category !== 'open'), ...state.deck.filter(id => getAction(id)!.category === 'open')];
  const originalMaximum = gameStats(state, 'A').endurance;
  state = act(state, 'A', {type: 'REST', cardInstanceIds: cards});
  // A resolver boundary input, not a claim that a particular ability changed the maximum.
  state.players.A!.permanent!.endurance! += change;
  expect(state.players.A!.damage).toBe(1);
  expect(gameStats(state, 'A').endurance - state.players.A!.damage).toBe(originalMaximum + change - 1);
  state = finish(JSON.parse(JSON.stringify(state)));
  expect(state.players.A!.damage).toBe(0);
  expect(gameStats(state, 'A').endurance).toBe(originalMaximum + change);
  for (const card of cards) expect(state.discard.filter(id => id === card)).toHaveLength(1);
});

it.each([0, -1])('A structural maximum reduction to remaining endurance %s schedules death with paid rest still unresolved', remaining => {
  let state = ready();
  assignCharacter(state, 'A', '侍大将のシン');
  state.players.A!.damage = 5;
  const card = 'a2-p07-r1c1';
  takeCard(state, 'A', card);
  trimHand(state, 'A', card);
  state = act(state, 'A', {type: 'REST', cardInstanceIds: [card]});
  const maximum = gameStats(state, 'A').endurance;
  // Exercise the maximum-endurance resolver boundary without fabricating an ability producer.
  state.players.A!.permanent = {endurance: 5 + remaining - maximum};
  expect(gameStats(state, 'A').endurance - state.players.A!.damage).toBe(remaining);
  settleDamage(state, [], 1234);
  expect(state.players.A!.presence).toBe('pending-death');
  expect(state.players.A!.damage).toBe(5);
  expect(state.resolution).toContain(card);
  expect(state.players.A!.hand).not.toContain(card);
  expect(state.lifecycle).toEqual(expect.arrayContaining([expect.objectContaining({kind: 'death-batch', actorIds: ['A']})]));
});
