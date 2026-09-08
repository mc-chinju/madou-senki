import { expect, test } from 'vitest';
import { followerAttackCommand, type FollowerAttackInputView } from '../src/game/follower-attack-input.js';

const source = 'a2-p22-r3c3';
function view(mode: 'one' | 'selected-all' | 'mandatory-all'): FollowerAttackInputView {
  return {
    self: { id: 'A', hand: [], followers: [{ cardInstanceId: source }] },
    legalChoices: ['ATTACK'], activeWindow: null,
    followerAttackOptions: [{ cardInstanceId: source, dedicated: true, sourceZone: 'followers', targetMode: mode,
      legalTargetIds: ['B', 'C'], range: 'far', school: 'magic', attributes: ['魔', '白'], useLevel: 7, effectLevel: 7, damage: 10, hitCount: 1, noChecks: true }],
  };
}
test('mandatory-all requires the exact public legal set and an explicit dedicated choice', () => {
  const input = view('mandatory-all');
  expect(followerAttackCommand(input, source, ['C', 'B'], true)).toEqual({ type: 'ATTACK', cardInstanceId: source, targetIds: ['B', 'C'], dedicated: true });
  for (const targets of [[], ['B'], ['B', 'B'], ['B', 'C', 'D'], ['A', 'B']]) expect(followerAttackCommand(input, source, targets, true)).toBeNull();
  expect(followerAttackCommand(input, source, ['B', 'C'], false)).toBeNull();
});
test('single and optional multi-target modes keep their separate target limits', () => {
  expect(followerAttackCommand(view('one'), source, ['B', 'C'], true)).toBeNull();
  expect(followerAttackCommand(view('one'), source, ['B'], true)?.type).toBe('ATTACK');
  expect(followerAttackCommand(view('selected-all'), source, ['C'], true)).toMatchObject({ targetIds: ['C'] });
  expect(followerAttackCommand(view('selected-all'), source, ['C', 'B'], true)).toMatchObject({ targetIds: ['B', 'C'] });
});
test('source must remain owned in its offered zone and on the current own action', () => {
  const input = view('one');
  expect(followerAttackCommand({ ...input, self: { ...input.self, hand: [source], followers: [] } }, source, ['B'], true)).toBeNull();
  expect(followerAttackCommand({ ...input, followerAttackOptions: [] }, source, ['B'], true)).toBeNull();
  expect(followerAttackCommand({ ...input, legalChoices: [] }, source, ['B'], true)).toBeNull();
  expect(followerAttackCommand({ ...input, activeWindow: { pendingActorId: 'A' } }, source, ['B'], true)).toBeNull();
  const hand = { ...input, self: { ...input.self, hand: [source], followers: [] }, followerAttackOptions: input.followerAttackOptions.map(option => ({ ...option, sourceZone: 'hand' as const })) };
  expect(followerAttackCommand(hand, source, ['B'], true)?.type).toBe('ATTACK');
});
