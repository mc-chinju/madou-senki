import { applyDeclarationSelection, candidateFor, type DeclarationInputView } from './declaration-input.js';
import type { GameCommand, TechniqueVariant } from '@madou/protocol';

export interface AbilityEffectOption { id: 'spirit-conversion' | 'human-invalidation' | 'arnes-suppression'; name: string }
export interface AbilityOption { abilityId: string; name: string; targetEventId: string; description?: string; targetIds?: string[]; actionCost?: 'main' | 'extra'; costCardInstanceIds?: string[]; canConceal?: boolean; effectOptions?: AbilityEffectOption[] }
export interface GrantedAttackCoSource { cardInstanceId: string; dedicated: boolean; techniqueVariant?: TechniqueVariant }
export interface GrantedAttackOption { cardInstanceId: string; dedicated: boolean; techniqueVariant?: TechniqueVariant; coSource?: GrantedAttackCoSource }
export interface AbilityInputView extends DeclarationInputView {
  self: { id: string; hand: string[]; chants: { cardInstanceId: string }[]; followers?: { cardInstanceId: string }[] };
  abilityOptions: AbilityOption[]; legalChoices: string[];
  activeWindow: { kind: string; pendingActorId: string } | null;
  currentAction: { source: 'card' | 'ability' | 'follower'; actorId: string; targetIds: string[] } | null;
  additionalAttack: null | { source: 'card' | 'ability'; actorId: string; targetId: string; sourceCardInstanceId?: string };
  additionalAttackOptions: GrantedAttackOption[];
  advanceCostOptions: { cardInstanceId: string; advanceCardInstanceIds: string[] }[];
  players: Record<string, { presence: string; name?: string }>;
}
export const abilityCommands = new Set(['USE_ABILITY', 'USE_FOLLOWER_ATTACK']);
const lifecycleAbilityIds = new Set(['c2-p02-r2c2-ab05', 'c2-p07-r1c2-ab04', 'c2-p04-r2c1-ab04']);
export function selectableAbilities(view: Pick<AbilityInputView, 'abilityOptions' | 'legalChoices'>): AbilityOption[] {
  if (!view.legalChoices.includes('USE_ABILITY')) return [];
  return view.abilityOptions.filter(option => !view.legalChoices.includes('USE_LIFECYCLE_ABILITY') || !lifecycleAbilityIds.has(option.abilityId));
}
export function abilityCommand(view: AbilityInputView, abilityId: string, costCardInstanceId?: string, conceal = false, selectedEffects: string[] = [], targetId?: string): GameCommand | null {
  const option = selectableAbilities(view).find(item => item.abilityId === abilityId);
  if (!option) return null;
  if (option.targetIds ? !targetId || !option.targetIds.includes(targetId) : targetId !== undefined) return null;
  const offeredEffects = option.effectOptions;
  if (offeredEffects ? !selectedEffects.length || new Set(selectedEffects).size !== selectedEffects.length || selectedEffects.some(id => !offeredEffects.some(effect => effect.id === id)) : selectedEffects.length) return null;
  const effects = offeredEffects?.filter(effect => selectedEffects.includes(effect.id)).map(effect => effect.id);
  if (option.costCardInstanceIds) {
    if (!costCardInstanceId || !option.costCardInstanceIds.includes(costCardInstanceId) || !view.self.hand.includes(costCardInstanceId)) return null;
    return { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId, costCardInstanceId, ...(option.canConceal ? { conceal } : {}), ...(targetId ? { targetId } : {}) };
  }
  return { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId, ...(effects ? { abilityEffectIds: effects } : {}), ...(targetId ? { targetId } : {}) };
}
function owns(view: Pick<AbilityInputView, 'self'>, id: string): boolean {
  return view.self.hand.includes(id) || view.self.chants.some(card => card.cardInstanceId === id) || (view.self.followers ?? []).some(card => card.cardInstanceId === id);
}
function sameCoSource(left: GrantedAttackCoSource | undefined, right: GrantedAttackCoSource | undefined): boolean {
  return left === undefined ? right === undefined : right !== undefined && left.cardInstanceId === right.cardInstanceId &&
    left.dedicated === right.dedicated && left.techniqueVariant === right.techniqueVariant;
}
export function grantedAttackSources(view: Pick<AbilityInputView, 'self' | 'additionalAttackOptions' | 'declarationCandidates'>): string[] {
  return [...new Set([...view.additionalAttackOptions, ...(view.declarationCandidates ?? []).filter(option => option.kind === 'attack').map(option => option.choice)].map(option => option.cardInstanceId).filter(id => owns(view, id)))];
}
export function grantedAttackCommand(view: AbilityInputView, cardInstanceId: string, dedicated: boolean, techniqueVariant?: TechniqueVariant,
  coSource?: GrantedAttackCoSource, advanceCardInstanceIds: string[] = [], declarationAbilityIds: string[] = []): GameCommand | null {
  const grant = view.additionalAttack;
  const base = { type: 'ATTACK' as const, cardInstanceId, targetIds: grant ? [grant.targetId] : [], dedicated, ...(techniqueVariant ? { techniqueVariant } : {}), ...(coSource ? { coSource: { ...coSource } } : {}), ...(advanceCardInstanceIds.length ? { advanceCardInstanceIds: [...advanceCardInstanceIds] } : {}) };
  if (view.activeWindow?.kind !== 'ability-attack' || view.activeWindow.pendingActorId !== view.self.id ||
    !view.legalChoices.includes('ATTACK') || !grant || grant.actorId !== view.self.id ||
    view.players[grant.targetId]?.presence !== 'active' || !owns(view, cardInstanceId) || coSource && !owns(view, coSource.cardInstanceId) ||
    !candidateFor(view, base) && !view.additionalAttackOptions.some(option => option.cardInstanceId === cardInstanceId && option.dedicated === dedicated &&
      option.techniqueVariant === techniqueVariant && sameCoSource(option.coSource, coSource))) return null;
  if (advanceCardInstanceIds.length) {
    const pool = view.advanceCostOptions.find(option => option.cardInstanceId === cardInstanceId)?.advanceCardInstanceIds ?? [];
    if (!dedicated || new Set(advanceCardInstanceIds).size !== advanceCardInstanceIds.length ||
      advanceCardInstanceIds.some(id => id === cardInstanceId || id === coSource?.cardInstanceId || !pool.includes(id) || !view.self.hand.includes(id))) return null;
  }
  return applyDeclarationSelection(view, base, declarationAbilityIds);
}
