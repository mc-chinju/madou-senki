import type { GameCommand } from '@madou/protocol';

export interface OptionalTurnInputView {
  legalChoices: string[];
  drawAbilityOptions?: { abilityId: string; name: string }[];
  revealAbilityOptions?: { abilityId: string; name: string }[];
}
export type InspectionChoice = 'finish' | 'discard-one' | 'discard-all';
export interface InspectionDecision {
  decisionId: string; actorId: string; targetId: string; zone: 'hand' | 'followers' | 'chants' | 'character';
  cards: { position: number; cardInstanceId: string }[]; characterId?: string;
  discardMode: 'none' | 'one' | 'all'; choices: InspectionChoice[];
}
export interface InspectionInputView {
  self: { id: string }; legalChoices: string[];
  inspection?: InspectionDecision | null;
  activeWindow: { kind: string; pendingActorId: string } | null;
}
export function drawCommand(view: OptionalTurnInputView, draw: boolean, abilityId?: string): GameCommand | null {
  if (!view.legalChoices.includes('CHOOSE_DRAW')) return null;
  if (abilityId !== undefined && (!draw || !['c2-p01-r2c2-ab02', 'c2-p07-r1c1-ab03'].includes(abilityId) || !view.drawAbilityOptions?.some(option => option.abilityId === abilityId))) return null;
  return { type: 'CHOOSE_DRAW', draw, ...(abilityId ? { abilityId } : {}) };
}
export function revealCommand(view: OptionalTurnInputView, abilityId?: string): GameCommand | null {
  if (!view.legalChoices.includes('REVEAL_CHARACTER')) return null;
  if (abilityId !== undefined) {
    if (abilityId !== 'c2-p04-r2c1-ab03' || !view.revealAbilityOptions?.some(option => option.abilityId === abilityId)) return null;
    return { type: 'REVEAL_CHARACTER', abilityId };
  }
  return { type: 'REVEAL_CHARACTER' };
}
export function inspectionCommand(view: InspectionInputView, choice: InspectionChoice, cardInstanceId?: string): GameCommand | null {
  const decision = view.inspection;
  if (!decision || decision.actorId !== view.self.id || view.activeWindow?.kind !== 'private-inspection' ||
    view.activeWindow.pendingActorId !== view.self.id || !view.legalChoices.includes('CHOOSE_INSPECTION') || !decision.choices.includes(choice)) return null;
  if (choice === 'discard-one') {
    if (decision.discardMode !== 'one' || !cardInstanceId || !decision.cards.some(card => card.cardInstanceId === cardInstanceId)) return null;
    return { type: 'CHOOSE_INSPECTION', decisionId: decision.decisionId, choice, cardInstanceId };
  }
  if (cardInstanceId !== undefined || choice === 'discard-all' && decision.discardMode !== 'all') return null;
  return { type: 'CHOOSE_INSPECTION', decisionId: decision.decisionId, choice };
}
