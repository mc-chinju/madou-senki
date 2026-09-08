import { expect, test } from 'vitest';
import { followerArrangementCommand, followerDefenseCommand, initialFollowerCommand, type FollowerInputView } from '../src/game/follower-input.js';

function input(): FollowerInputView {
  return {
    self: { id: 'A', hand: ['a2-p20-r3c2', 'a2-p19-r1c3'], followers: [{ cardInstanceId: 'a2-p21-r2c1' }, { cardInstanceId: 'a2-p18-r3c1' }], stats: { followerLimit: 2 } },
    legalChoices: ['ARRANGE_FOLLOWERS'], activeWindow: null,
    followerPlacementOptions: { placeableCardInstanceIds: ['a2-p19-r1c3'], removableCardInstanceIds: ['a2-p18-r3c1'] },
    followerDefenseOptions: [],
  };
}
test('arrangement preserves a non-removable placed follower but permits reordering and explicit legal replacement', () => {
  const view = input();
  expect(followerArrangementCommand(view, ['a2-p18-r3c1'])).toBeNull();
  expect(followerArrangementCommand(view, ['a2-p18-r3c1', 'a2-p21-r2c1'])).toEqual({ type: 'ARRANGE_FOLLOWERS', cardInstanceIds: ['a2-p18-r3c1', 'a2-p21-r2c1'] });
  expect(followerArrangementCommand(view, ['a2-p21-r2c1', 'a2-p19-r1c3'])).toEqual({ type: 'ARRANGE_FOLLOWERS', cardInstanceIds: ['a2-p21-r2c1', 'a2-p19-r1c3'] });
});
test('arrangement rejects unoffered castle, nonowned IDs, duplicate sources, capacity overflow and stale phase', () => {
  const view = input();
  for (const ids of [['a2-p21-r2c1', 'a2-p20-r3c2'], ['a2-p21-r2c1', 'foreign'], ['a2-p21-r2c1', 'a2-p21-r2c1'], ['a2-p21-r2c1', 'a2-p18-r3c1', 'a2-p19-r1c3']]) expect(followerArrangementCommand(view, ids)).toBeNull();
  expect(followerArrangementCommand({ ...view, legalChoices: [] }, ['a2-p21-r2c1'])).toBeNull();
});
test('printed follower defense defaults to no dedication and accepts only exact own offered placed sources with priority', () => {
  const view: FollowerInputView = { ...input(), legalChoices: ['START_FOLLOWERS', 'PASS'], activeWindow: { kind: 'normal-defense', pendingActorId: 'A' }, self: { ...input().self, followers: [{ cardInstanceId: 'a2-p21-r1c2' }] }, followerDefenseOptions: [{ cardInstanceId: 'a2-p21-r1c2' }] };
  expect(followerDefenseCommand(view, [])).toEqual({ type: 'START_FOLLOWERS' });
  expect(followerDefenseCommand(view, ['a2-p21-r1c2'])).toEqual({ type: 'START_FOLLOWERS', dedicatedCardInstanceIds: ['a2-p21-r1c2'] });
  expect(followerDefenseCommand(view, ['a2-p21-r2c1'])).toBeNull();
  expect(followerDefenseCommand(view, ['a2-p21-r1c2', 'a2-p21-r1c2'])).toBeNull();
  expect(followerDefenseCommand({ ...view, activeWindow: { kind: 'normal-defense', pendingActorId: 'B' } }, [])).toBeNull();
  expect(followerDefenseCommand({ ...view, followerDefenseOptions: [] }, ['a2-p21-r1c2'])).toBeNull();
  expect(followerDefenseCommand({ ...view, self: { ...view.self, followers: [] } }, ['a2-p21-r1c2'])).toBeNull();
});

test('initial or revived setup uses the same private placement pool and current capacity', () => {
  const view = input(); view.legalChoices = ['PLACE_INITIAL_FOLLOWER']; view.self.stats.followerLimit = 3;
  expect(initialFollowerCommand(view, 'a2-p19-r1c3')).toEqual({ type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: 'a2-p19-r1c3' });
  expect(initialFollowerCommand(view, 'a2-p20-r3c2')).toBeNull();
  expect(initialFollowerCommand({ ...view, self: { ...view.self, stats: { followerLimit: 2 } } }, 'a2-p19-r1c3')).toBeNull();
  expect(initialFollowerCommand({ ...view, legalChoices: [] }, 'a2-p19-r1c3')).toBeNull();
});
