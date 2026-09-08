import { getAction } from '@madou/catalog';
import { applyDeclarationSelection, candidateFor, type DeclarationInputView } from './declaration-input.js';
import type { GameCommand } from '@madou/protocol';

export interface FollowerAttackOption {
  cardInstanceId: string; dedicated: true; sourceZone: 'hand' | 'followers';
  targetMode: 'one' | 'selected-all' | 'mandatory-all'; legalTargetIds: string[];
  range: 'near' | 'far'; school: 'warrior' | 'magic'; attributes: string[];
  useLevel: number | string; effectLevel: number | string; damage: number | string; hitCount: number | string; noChecks: boolean;
}
export interface FollowerAttackInputView extends DeclarationInputView {
  self: { id: string; hand: string[]; followers: { cardInstanceId: string }[] };
  legalChoices: string[]; activeWindow: { pendingActorId: string } | null;
  followerAttackOptions: FollowerAttackOption[];
}
export function validatedFollowerTargets(option: Pick<FollowerAttackOption, 'targetMode' | 'legalTargetIds'>, actorId: string, targetIds: string[]): string[] | null {
  if (!targetIds.length || new Set(targetIds).size !== targetIds.length || targetIds.some(id => id === actorId || !option.legalTargetIds.includes(id))) return null;
  if (option.targetMode === 'one' && targetIds.length !== 1 || option.targetMode === 'mandatory-all' && targetIds.length !== option.legalTargetIds.length) return null;
  return option.legalTargetIds.filter(id => targetIds.includes(id));
}
export function followerAttackCommand(view: FollowerAttackInputView, cardInstanceId: string, targetIds: string[], dedicated: boolean, declarationAbilityIds: string[] = []): GameCommand | null {
  if (!dedicated || view.activeWindow || !view.legalChoices.includes('ATTACK')) return null;
  const base = { type: 'ATTACK' as const, cardInstanceId, dedicated: true as const, targetIds };
  const candidate = candidateFor(view, base);
  if (candidate && getAction(cardInstanceId)?.category === 'follower') {
    if (!view.self.hand.includes(cardInstanceId) && !view.self.followers.some(card => card.cardInstanceId === cardInstanceId)) return null;
    return applyDeclarationSelection(view, base, declarationAbilityIds);
  }
  if (declarationAbilityIds.length) return null;
  const option = view.followerAttackOptions.find(candidate => candidate.cardInstanceId === cardInstanceId);
  if (!option) return null;
  const owned = option.sourceZone === 'hand' ? view.self.hand.includes(cardInstanceId) : view.self.followers.some(card => card.cardInstanceId === cardInstanceId);
  const targets = validatedFollowerTargets(option, view.self.id, targetIds);
  if (!owned || !targets) return null;
  return { type: 'ATTACK', cardInstanceId, dedicated: true, targetIds: targets };
}

/** Adds held follower techniques whose range needs an explicit ability selection. */
export function followerAttackChoices(view: FollowerAttackInputView): FollowerAttackOption[] {
  const choices = [...view.followerAttackOptions];
  for (const candidate of view.declarationCandidates ?? []) {
    const id = candidate.choice.cardInstanceId;
    if (candidate.kind !== 'attack' || !candidate.choice.dedicated || candidate.choice.coSource || getAction(id)?.category !== 'follower' || choices.some(option => option.cardInstanceId === id)) continue;
    if (candidate.sourceZone === 'chant' || candidate.technique.range === 'none') continue;
    const technique = candidate.technique;
    choices.push({ cardInstanceId: id, dedicated: true, sourceZone: candidate.sourceZone,
      targetMode: technique.mandatoryAll ? 'mandatory-all' : technique.target === 'all' ? 'selected-all' : 'one',
      legalTargetIds: candidate.targetIds.filter(target => technique.range === 'far' || candidate.nearTargetIds.includes(target)),
      range: technique.range as 'near' | 'far', school: technique.school, attributes: technique.attributes,
      useLevel: technique.useLevel, effectLevel: technique.effectLevelFormula ? '判定で確定' : technique.effectLevel,
      damage: technique.damageFormula ? '判定で確定' : technique.damage === null ? '−' : technique.damage * (technique.damageMultiplier ?? 1),
      hitCount: technique.hitCount, noChecks: technique.noChecks });
  }
  return choices;
}
