import type { GameCommand } from '@madou/protocol';
export interface ConditionalAbilitySetting {
  abilityId: string; name: string; description: string; enabled: boolean; active: boolean; suppressed: boolean;
  selectedTargetIds: string[]; eligibleTargetIds?: string[]; targetEventId: string | null; canActivate: boolean; canDeactivate: boolean;
}
export interface ConditionalAbilityInputView { legalChoices: string[]; conditionalAbilities?: ConditionalAbilitySetting[] }
const supportedIds = ['c2-p02-r1c1-ab04', 'c2-p03-r1c2-ab03', 'c2-p03-r2c2-ab04', 'c2-p04-r1c2-ab03', 'c2-p04-r1c2-ab05', 'c2-p05-r1c2-ab01', 'c2-p05-r2c1-ab05', 'c2-p06-r1c2-ab02'] as const;
type SupportedId = typeof supportedIds[number];
function supported(id: string): id is SupportedId { return (supportedIds as readonly string[]).includes(id); }
export function conditionalAbilityCommand(view: ConditionalAbilityInputView, abilityId: string, enabled: boolean, targetIds?: string[]): GameCommand | null {
  if (!supported(abilityId) || !view.legalChoices.includes('SET_CONDITIONAL_ABILITY')) return null;
  const setting = view.conditionalAbilities?.find(option => option.abilityId === abilityId);
  if (!setting?.targetEventId) return null;
  if (!enabled) {
    if (!setting.enabled || !setting.canDeactivate || targetIds !== undefined) return null;
    return { type: 'SET_CONDITIONAL_ABILITY', abilityId, enabled: false, targetEventId: setting.targetEventId };
  }
  if (!setting.canActivate) return null;
  if (abilityId === 'c2-p03-r1c2-ab03') {
    if (!targetIds || new Set(targetIds).size !== targetIds.length || targetIds.some(id => !setting.eligibleTargetIds?.includes(id))) return null;
    if (setting.enabled && targetIds.length === setting.selectedTargetIds.length && targetIds.every(id => setting.selectedTargetIds.includes(id))) return null;
    return { type: 'SET_CONDITIONAL_ABILITY', abilityId, enabled: true, targetEventId: setting.targetEventId, targetIds: [...targetIds] };
  }
  if (targetIds !== undefined || setting.enabled) return null;
  return { type: 'SET_CONDITIONAL_ABILITY', abilityId, enabled: true, targetEventId: setting.targetEventId };
}
