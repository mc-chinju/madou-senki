import type { GameState } from '../state.js';
import type { Continuation, ReactionWindow, WindowKind } from './continuations.js';
export function activeWindowRef(state: GameState): { windowId: string; windowRevision: number } | null {
  const w = state.windows?.at(-1); return w ? { windowId: w.id, windowRevision: w.revision } : null;
}
export function participants(state: GameState, seat = state.turnSeat): string[] {
  return [...state.seatOrder.slice(seat), ...state.seatOrder.slice(0, seat)].filter(id => !state.players[id]!.presence || state.players[id]!.presence === 'active');
}
export function openWindow(state: GameState, kind: WindowKind, eventId: string, continuation: Continuation, order = participants(state)): ReactionWindow {
  const w: ReactionWindow = { id: `w-${state.nextEventId++}`, revision: 0, kind, parentId: state.windows?.at(-1)?.id ?? null, participants: order.filter(id=>['death-gift','revival'].includes(kind)||!state.players[id]!.presence||state.players[id]!.presence==='active'), cursor: 0, passed: [], eventId, continuation };
  (state.windows ??= []).push(w); return w;
}
export function resetParent(state: GameState, parentId: string | null): void {
  const w = state.windows?.find(w => w.id === parentId); if (!w) return;
  w.passed = []; w.revision++;
  // Preserve the interrupted respondent for local defense windows (G03).
  if (w.participants.length > 1) w.cursor = 0;
}
