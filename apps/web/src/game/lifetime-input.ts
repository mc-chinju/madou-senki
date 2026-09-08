import { applyDeclarationSelection, candidateFor } from './declaration-input.js';
import type { PlayerView } from '@madou/engine';
import type { GameCommand } from '@madou/protocol';

export type LifetimeInputView = Pick<PlayerView, 'self' | 'players' | 'distances' | 'legalChoices' | 'seatOrder'> & { declarationCandidates?: PlayerView['declarationCandidates'] };
export const lifetimeCommands = new Set(['PLAY_TURN_TECHNIQUE', 'CHOOSE_LIFETIME_EFFECT']);
export const turnTechniqueIds = new Set(['a2-p12-r2c1', 'a2-p13-r3c1', 'a2-p14-r3c1', 'a2-p14-r3c2']);
const flexibleCharacters = new Set(['c2-p01-r1c2', 'c2-p01-r2c2', 'c2-p02-r1c1', 'c2-p02-r2c1',
  'c2-p03-r1c1', 'c2-p03-r2c1', 'c2-p03-r2c2', 'c2-p04-r1c1', 'c2-p04-r1c2', 'c2-p04-r2c1',
  'c2-p04-r2c2', 'c2-p05-r1c1', 'c2-p05-r1c2', 'c2-p05-r2c1', 'c2-p06-r2c1']);
export function turnTechniqueCards(view: LifetimeInputView): string[] {
  const silenced = view.players[view.self.id]!.statuses?.some(status => status.kind === 'silenced');
  return [...view.self.hand, ...view.self.chants.map(card => card.cardInstanceId)]
    .filter(id => turnTechniqueIds.has(id) && (!silenced || id === 'a2-p12-r2c1'));
}
export function hasTurnTechniqueDedicated(view: LifetimeInputView, cardId: string): boolean {
  return cardId === 'a2-p13-r3c1' ? view.self.characterId === 'c2-p05-r1c1'
    : ['a2-p14-r3c1', 'a2-p14-r3c2'].includes(cardId) && view.self.characterId === 'c2-p01-r1c2';
}
export function turnTechniqueTargets(view: LifetimeInputView, cardId: string, dedicated: boolean): string[] {
  if (!turnTechniqueIds.has(cardId) || dedicated && !hasTurnTechniqueDedicated(view, cardId)) return [];
  if (cardId === 'a2-p13-r3c1') return view.seatOrder.filter(id => view.players[id]!.presence === 'dead');
  if (!dedicated) return view.players[view.self.id]!.presence === 'active' ? [view.self.id] : [];
  return view.seatOrder.filter(id => id !== view.self.id && view.players[id]!.presence === 'active' && view.distances[view.self.id]?.[id] === 'near');
}
export function canConvertRevived(view: LifetimeInputView, targetId: string): boolean {
  const target = view.players[targetId]; const id = target?.characterId;
  if (!id || target.presence !== 'dead') return false;
  return flexibleCharacters.has(id) || ['c2-p06-r1c2', 'c2-p06-r2c2'].includes(id) && ['EVIL', 'ヴァンミール'].includes(view.self.faction);
}
export function turnTechniqueCommand(view: LifetimeInputView, cardId: string, dedicated: boolean, targetIds: string[], convertTargetIds: string[] = [], declarationAbilityIds: string[] = []): GameCommand | null {
  if (!view.legalChoices.includes('PLAY_TURN_TECHNIQUE') || !turnTechniqueCards(view).includes(cardId)) return null;
  const eligible = turnTechniqueTargets(view, cardId, dedicated);
  const multiple = cardId === 'a2-p13-r3c1' && dedicated;
  if (!targetIds.length || new Set(targetIds).size !== targetIds.length || !multiple && targetIds.length !== 1 || targetIds.some(id => !eligible.includes(id))) return null;
  const base = { type: 'PLAY_TURN_TECHNIQUE' as const, cardInstanceId: cardId, targetIds, dedicated, ...(convertTargetIds.length ? { convertTargetIds } : {}) };
  if (cardId === 'a2-p13-r3c1' && !dedicated && !view.self.chants.some(card => card.cardInstanceId === cardId) && !candidateFor(view, base)) return null;
  if (convertTargetIds.length && (!multiple || new Set(convertTargetIds).size !== convertTargetIds.length || convertTargetIds.some(id => !targetIds.includes(id) || !canConvertRevived(view, id)))) return null;
  return applyDeclarationSelection(view, base, declarationAbilityIds);
}
