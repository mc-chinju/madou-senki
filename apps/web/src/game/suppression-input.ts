import type { PlayerView } from '@madou/engine';
import type { GameCommand } from '@madou/protocol';
import type { AbilityOption } from './ability-input.js';

export const BAN_ABILITY = 'c2-p07-r1c2-ab03';
export const BLESSING_ABILITY = 'c2-p03-r1c2-ab04';
export const suppressionAbilityIds = new Set([BAN_ABILITY, BLESSING_ABILITY]);
export interface SuppressionInputView {
  legalChoices: string[];
  abilityOptions: AbilityOption[];
  players: Record<string, { name?: string }>;
  suppressionTargets: PlayerView['suppressionTargets'];
}
export function suppressionOptions(view: SuppressionInputView): AbilityOption[] {
  return view.legalChoices.includes('USE_ABILITY')
    ? view.abilityOptions.filter(option => suppressionAbilityIds.has(option.abilityId)) : [];
}
export function suppressionCommand(view: SuppressionInputView, abilityId: string, targetEventId: string, targetIds: string[]): GameCommand | null {
  const option = suppressionOptions(view).find(candidate => candidate.abilityId === abilityId && candidate.targetEventId === targetEventId);
  if (!option || !targetIds.length || new Set(targetIds).size !== targetIds.length ||
    targetIds.some(id => !option.targetIds?.includes(id) || !view.players[id])) return null;
  if (abilityId === BAN_ABILITY) return { type: 'USE_ABILITY', abilityId, targetEventId, targetIds: [...targetIds] };
  if (targetIds.length !== 1) return null;
  return { type: 'USE_ABILITY', abilityId, targetEventId, targetId: targetIds[0]! };
}
