import { expect, test } from 'vitest';
import { followerBundleCommand, type FollowerBundleInputView } from '../src/game/follower-bundle-input.js';

const griffin = 'a2-p20-r3c1'; const fire = 'a2-p22-r2c2'; const abilityId = 'c2-p05-r1c2-ab02';
function input(): FollowerBundleInputView {
  const base = { range: 'far' as const, school: 'warrior' as const, attributes: ['遠', '戦'], useLevel: 5, effectLevel: 5, damage: 8, hitCount: 2, noChecks: false };
  return { self: { id: 'A', hand: [fire], followers: [{ cardInstanceId: griffin }] }, activeWindow: null, legalChoices: ['USE_FOLLOWER_ATTACK'],
    followerBundleOptions: [{ abilityId, name: '獣使い', targetEventId: 'event-1', sources: [
      { ...base, cardInstanceId: griffin, sourceZone: 'followers', dedicated: false, targetMode: 'one', legalTargetIds: ['B', 'C'] },
      { ...base, cardInstanceId: griffin, sourceZone: 'followers', dedicated: true, targetMode: 'selected-all', legalTargetIds: ['B', 'C'], noChecks: true },
      { ...base, cardInstanceId: fire, sourceZone: 'hand', dedicated: false, targetMode: 'mandatory-all', legalTargetIds: ['B', 'C'], school: 'magic', damage: 12, hitCount: 1 },
    ] }] };
}
const selected = () => [{ cardInstanceId: fire, dedicated: false, targetIds: ['C', 'B'] }, { cardInstanceId: griffin, dedicated: true, targetIds: ['C'] }];
test('one atomic command retains chosen source order, exact event and each source targets', () => {
  expect(followerBundleCommand(input(), abilityId, 'event-1', selected())).toEqual({ type: 'USE_FOLLOWER_ATTACK', abilityId, targetEventId: 'event-1', sources: [
    { cardInstanceId: fire, dedicated: false, targetIds: ['B', 'C'] }, { cardInstanceId: griffin, dedicated: true, targetIds: ['C'] },
  ] });
});
test('rejects empty, duplicate, unoffered, foreign-zone and stale source selections before constructing a command', () => {
  for (const sources of [[], [selected()[0]!, selected()[0]!], [{ ...selected()[0]!, cardInstanceId: 'foreign' }], [{ ...selected()[0]!, dedicated: true }]]) {
    expect(followerBundleCommand(input(), abilityId, 'event-1', sources)).toBeNull();
  }
  const moved = input(); moved.self.followers = []; moved.self.hand.push(griffin);
  expect(followerBundleCommand(moved, abilityId, 'event-1', selected())).toBeNull();
  expect(followerBundleCommand(input(), abilityId, 'old-event', selected())).toBeNull();
  expect(followerBundleCommand({ ...input(), activeWindow: { pendingActorId: 'A' } }, abilityId, 'event-1', selected())).toBeNull();
  expect(followerBundleCommand({ ...input(), legalChoices: [] }, abilityId, 'event-1', selected())).toBeNull();
});
test('mandatory targets cannot be reduced, normal Griffin stays single-target and dedication is explicit', () => {
  for (const targets of [[], ['B'], ['B', 'B'], ['A', 'B'], ['B', 'unknown']]) {
    expect(followerBundleCommand(input(), abilityId, 'event-1', [{ ...selected()[0]!, targetIds: targets }])).toBeNull();
  }
  expect(followerBundleCommand(input(), abilityId, 'event-1', [{ cardInstanceId: griffin, dedicated: false, targetIds: ['B', 'C'] }])).toBeNull();
  expect(followerBundleCommand(input(), abilityId, 'event-1', [{ cardInstanceId: griffin, dedicated: false, targetIds: ['B'] }])).toMatchObject({ sources: [{ dedicated: false }] });
});
