import type { GameCommand } from '@madou/protocol';
import { validatedFollowerTargets, type FollowerAttackOption } from './follower-attack-input.js';

export type FollowerAbilityId = 'c2-p05-r1c2-ab02' | 'c2-p06-r1c2-ab04';
export interface FollowerBundleSource extends Omit<FollowerAttackOption, 'dedicated'> { dedicated: boolean }
export interface FollowerBundleOption { abilityId: FollowerAbilityId; name: string; targetEventId: string; sources: FollowerBundleSource[] }
export interface FollowerBundleChoice { cardInstanceId: string; dedicated: boolean; targetIds: string[] }
export interface FollowerBundleInputView {
  self: { id: string; hand: string[]; followers: { cardInstanceId: string }[] };
  legalChoices: string[]; activeWindow: { pendingActorId: string } | null; followerBundleOptions: FollowerBundleOption[];
}
export function followerBundleCommand(view: FollowerBundleInputView, abilityId: string, targetEventId: string, sources: FollowerBundleChoice[]): GameCommand | null {
  if (view.activeWindow || !view.legalChoices.includes('USE_FOLLOWER_ATTACK') || !sources.length || new Set(sources.map(source => source.cardInstanceId)).size !== sources.length) return null;
  const ability = view.followerBundleOptions.find(option => option.abilityId === abilityId && option.targetEventId === targetEventId);
  if (!ability) return null;
  const chosen: FollowerBundleChoice[] = [];
  for (const source of sources) {
    const option = ability.sources.find(candidate => candidate.cardInstanceId === source.cardInstanceId && candidate.dedicated === source.dedicated);
    if (!option) return null;
    const owned = option.sourceZone === 'hand' ? view.self.hand.includes(source.cardInstanceId) : view.self.followers.some(card => card.cardInstanceId === source.cardInstanceId);
    const targets = validatedFollowerTargets(option, view.self.id, source.targetIds);
    if (!owned || !targets) return null;
    chosen.push({ cardInstanceId: source.cardInstanceId, dedicated: source.dedicated, targetIds: targets });
  }
  return { type: 'USE_FOLLOWER_ATTACK', abilityId: ability.abilityId, targetEventId, sources: chosen };
}
