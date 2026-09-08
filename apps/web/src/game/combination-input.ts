import type { GameCommand, TechniqueVariant } from '@madou/protocol';

export interface CoSource { cardInstanceId: string; dedicated: boolean; techniqueVariant?: TechniqueVariant }
export interface CombinationInputView {
  self: { id: string; hand: string[]; chants: { cardInstanceId: string }[]; followers?: { cardInstanceId: string }[] };
  legalChoices: string[];
  activeWindow: { kind?: string; pendingActorId: string } | null;
  combinationOptions: { cardInstanceId: string; coSources: CoSource[] }[];
  advanceCostOptions: { cardInstanceId: string; advanceCardInstanceIds: string[] }[];
  techniqueDecision: null |
    { kind: 'damage-double'; actionId: string; actorId: string; sourceCardInstanceId: string } |
    { kind: 'hit-advance'; groupId: string; actorId: string; sourceCardInstanceId: string; cardInstanceIds: string[] };
  groupDefenseOptions: { cardInstanceId: string; groupId: string; targetIds: string[] }[];
}
export const combinationCommands = new Set(['CHOOSE_DAMAGE_DOUBLE', 'PAY_HIT_ADVANCES', 'PLAY_GROUP_DEFENSE']);
export function coSourceKey(source: CoSource): string {
  return `${source.cardInstanceId}:${source.dedicated}:${source.techniqueVariant ?? ''}`;
}
function owns(view: CombinationInputView, id: string): boolean {
  return view.self.hand.includes(id) || view.self.chants.some(card => card.cardInstanceId === id) || (view.self.followers ?? []).some(card => card.cardInstanceId === id);
}
function validBatch(view: CombinationInputView, selected: string[], pool: string[]): boolean {
  return new Set(selected).size === selected.length && selected.every(id => pool.includes(id) && view.self.hand.includes(id));
}
export function attackWithCosts(view: CombinationInputView, base: GameCommand | null, coSource: CoSource | undefined, advances: string[]): GameCommand | null {
  if (!base || base.type !== 'ATTACK' || !view.legalChoices.includes('ATTACK') || !owns(view, base.cardInstanceId)) return null;
  if (coSource) {
    const pool = view.combinationOptions.find(option => option.cardInstanceId === base.cardInstanceId)?.coSources ?? [];
    if (!base.dedicated || !owns(view, coSource.cardInstanceId) || coSource.cardInstanceId === base.cardInstanceId ||
      !pool.some(option => coSourceKey(option) === coSourceKey(coSource))) return null;
  }
  if (advances.length) {
    const pool = view.advanceCostOptions.find(option => option.cardInstanceId === base.cardInstanceId)?.advanceCardInstanceIds ?? [];
    if (!base.dedicated || !validBatch(view, advances, pool) || advances.includes(base.cardInstanceId) || coSource && advances.includes(coSource.cardInstanceId)) return null;
  }
  return { ...base, ...(coSource ? { coSource: { ...coSource } } : {}), ...(advances.length ? { advanceCardInstanceIds: [...advances] } : {}) };
}
export function techniqueDecisionCommand(view: CombinationInputView, advances: string[] = [], attempt = false): GameCommand | null {
  const decision = view.techniqueDecision;
  if (!decision || decision.actorId !== view.self.id || view.activeWindow?.pendingActorId !== view.self.id) return null;
  if (decision.kind === 'damage-double') return view.legalChoices.includes('CHOOSE_DAMAGE_DOUBLE')
    ? { type: 'CHOOSE_DAMAGE_DOUBLE', actionId: decision.actionId, attempt } : null;
  return view.legalChoices.includes('PAY_HIT_ADVANCES') && validBatch(view, advances, decision.cardInstanceIds)
    ? { type: 'PAY_HIT_ADVANCES', groupId: decision.groupId, cardInstanceIds: [...advances] } : null;
}
export function groupDefenseCommand(view: CombinationInputView, cardInstanceId: string, groupId: string): GameCommand | null {
  if (!view.legalChoices.includes('PLAY_GROUP_DEFENSE') || view.activeWindow?.pendingActorId !== view.self.id || !owns(view, cardInstanceId) ||
    !view.groupDefenseOptions.some(option => option.cardInstanceId === cardInstanceId && option.groupId === groupId)) return null;
  return { type: 'PLAY_GROUP_DEFENSE', cardInstanceId, groupId, dedicated: true };
}

export function combinationDefenseCommand(view: CombinationInputView, coSource: CoSource | undefined): GameCommand | null {
  if (!coSource || view.activeWindow?.kind !== 'normal-defense' || view.activeWindow.pendingActorId !== view.self.id || !view.legalChoices.includes('PLAY_DEFENSE')) return null;
  const primary = view.combinationOptions.find(option => option.cardInstanceId === 'a2-p09-r1c1');
  if (!primary || !owns(view, primary.cardInstanceId) || !owns(view, coSource.cardInstanceId) ||
    !primary.coSources.some(option => coSourceKey(option) === coSourceKey(coSource))) return null;
  return { type: 'PLAY_DEFENSE', cardInstanceId: primary.cardInstanceId, dedicated: true, coSource: { ...coSource } };
}
