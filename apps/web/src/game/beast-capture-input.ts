import type { PlayerView } from '@madou/engine';
import type { GameCommand } from '@madou/protocol';

export type BeastCaptureInputView = Pick<PlayerView, 'beastCapture' | 'activeWindow' | 'legalChoices'> & { self: { id: string } };
export function beastCaptureCommand(view: BeastCaptureInputView, cardInstanceIds: string[]): GameCommand | null {
  const choice = view.beastCapture; const window = view.activeWindow;
  if (!choice || !window || window.kind !== 'beast-capture' || window.windowId !== choice.windowId ||
    window.pendingActorId !== view.self.id || choice.actorId !== view.self.id || !view.legalChoices.includes('CHOOSE_BEAST_CAPTURE')) return null;
  if (new Set(cardInstanceIds).size !== cardInstanceIds.length || cardInstanceIds.some(id => !choice.candidates.some(candidate => candidate.cardInstanceId === id))) return null;
  return { type: 'CHOOSE_BEAST_CAPTURE', groupId: choice.groupId, windowId: choice.windowId, cardInstanceIds: [...cardInstanceIds] };
}
