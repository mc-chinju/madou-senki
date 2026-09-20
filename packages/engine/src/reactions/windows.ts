import type { GameState, PlayerId } from '../state.js';
import {hasStatus} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import type { Continuation, ReactionWindow, WindowKind } from './continuations.js';
export function activeWindowRef(state: GameState): { windowId: string; windowRevision: number } | null {
  const w = state.windows?.at(-1); return w ? { windowId: w.id, windowRevision: w.revision } : null;
}
/** What a client's command is based on. Commands sharing it are concurrent, not stale (design §6). */
export function commandBaseRef(state: GameState): { windowId: string; windowRevision: number } | null {
  const window = activeWindowRef(state);
  if (window) return window;
  return state.phase === 'setup' && state.pending ? { windowId: `setup-${state.pending.round}`, windowRevision: 0 } : null;
}
/** Public windows where any respondent may pass before priority reaches them (G03). */
const PASS_AHEAD_KINDS: readonly WindowKind[] = ['declaration', 'before-roll', 'after-roll', 'effect-level', 'damage', 'hit', 'attack-abilities', 'hit-abilities', 'follower-entry-abilities', 'reclaim'];
export function passAhead(w: ReactionWindow): boolean {
  return w.participants.length > 1 && PASS_AHEAD_KINDS.includes(w.kind);
}
/** Priority sits with the earliest respondent from the origin that has not passed this generation. */
export function syncPriority(w: ReactionWindow): void {
  const index = w.participants.findIndex(id => !w.passed.includes(id));
  w.cursor = index < 0 ? w.participants.length : index;
}
/** Climb parent windows to the event of the outermost action that owns this one. */
export function rootEventId(state: GameState, source: { eventId: string; parentWindowId: string | null }): string {
  let eventId = source.eventId, parentId = source.parentWindowId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId); const w = state.windows?.find(w => w.id === parentId); if (!w) break;
    const c = w.continuation;
    const a = c.kind === 'action' ? state.actions?.[c.id] : c.kind === 'group' ? state.actions?.[state.groups?.[c.id]?.actionId ?? ''] : undefined;
    const ability = c.kind === 'ability' ? state.abilities?.[c.id] : undefined;
    if (a) { eventId = a.eventId; parentId = a.parentWindowId; }
    else if (ability) { eventId = ability.eventId; parentId = ability.parentWindowId; }
    else { eventId = w.eventId; parentId = w.parentId; }
  }
  return eventId;
}
/** The action a window belongs to; the scope of a standing pass ("leave this action to the others").
 *  Follow the continuation: a window's own event id can be synthetic (`<group>-<seat>-follower-entry`). */
export function windowRootEventId(state: GameState, w: ReactionWindow): string {
  const c = w.continuation;
  const action = (id: string | undefined) => (id ? state.actions?.[id] : undefined);
  const groupAction = (id: string | undefined) => action(id ? state.groups?.[id]?.actionId : undefined);
  let source: { eventId: string; parentWindowId: string | null } | undefined;
  if (c.kind === 'action') source = action(c.id);
  else if (c.kind === 'group') source = groupAction(c.id);
  else if (c.kind === 'ability') source = state.abilities?.[c.id];
  else if (c.kind === 'reclaim') source = state.reclaimDecisions?.find(d => d.id === c.id);
  else if (c.kind === 'roll') {
    const resume = state.rolls?.find(frame => frame.id === c.id)?.resume;
    source = action(resume && 'actionId' in resume ? resume.actionId : undefined)
      ?? groupAction(resume && 'groupId' in resume ? resume.groupId : undefined);
  }
  return rootEventId(state, source ?? { eventId: w.eventId, parentWindowId: w.parentId });
}
/** Seats with a standing pass running right now, in the order they gave it. */
export function standingPassActors(state: GameState): PlayerId[] {
  return (state.standingPasses ?? []).flatMap(saved => saved.actorIds);
}
/** How far this seat's standing pass reaches, if it has one. */
export function standingPassScope(state: GameState, id: PlayerId): 'action' | 'turn' | undefined {
  return state.standingPasses?.find(saved => saved.actorIds.includes(id))?.scope;
}
/** Leave the rest of the action, or of the turn, to the others. A seat sits in one record at a time. */
export function addStandingPass(state: GameState, id: PlayerId, scope: 'action' | 'turn', rootEventId: string): void {
  dropStandingPass(state, id);
  const saved = (state.standingPasses ??= []).find(saved => scope === 'turn'
    ? saved.scope === 'turn' && saved.turnNumber === (state.turnNumber ?? 0)
    : saved.scope === 'action' && saved.rootEventId === rootEventId);
  if (saved) { saved.actorIds.push(id); return; }
  state.standingPasses.push(scope === 'turn'
    ? { scope, turnNumber: state.turnNumber ?? 0, actorIds: [id] }
    : { scope, rootEventId, actorIds: [id] });
}
/** Every seat is asked again once a character is revealed, whoever chose it and however it came about (G03).
 *  Called where the reveal is written rather than from the end of the step, so no window opened later in the
 *  same step can still be filled in from a hand-over the reveal has already ended.
 *
 *  `scope` narrows it to the hand-overs of one range. A hit that turns its target face up is the result of the
 *  very action a seat handed over, so an action-long hand-over stands; for a turn-long one the identity is new
 *  information about the actions still to come, and that seat is asked again. */
export function dropStandingPasses(state: GameState, scope?: 'action' | 'turn'): void {
  if (!scope) { delete state.standingPasses; return; }
  const kept = (state.standingPasses ?? []).filter(saved => saved.scope !== scope);
  if (kept.length) state.standingPasses = kept; else delete state.standingPasses;
}
/** Take the standing pass back; the passes it already filled in stay where they were recorded (G03). */
export function dropStandingPass(state: GameState, id: PlayerId): void {
  for (const saved of state.standingPasses ?? []) saved.actorIds = saved.actorIds.filter(actorId => actorId !== id);
  pruneStandingPasses(state);
}
/** A standing pass ends with what it was given for: the last window of its action, or its own turn (G03). */
export function pruneStandingPasses(state: GameState): void {
  // A seat that left the table is not leaving its answers to anyone; its hand-over goes out with it, so the
  // others stop being told that a dead seat is passing through the rest of the turn.
  for (const saved of state.standingPasses ?? []) saved.actorIds = saved.actorIds.filter(id => isActive(state.players[id]!));
  const kept = (state.standingPasses ?? []).filter(saved => saved.actorIds.length
    && (saved.scope === 'turn' ? saved.turnNumber === (state.turnNumber ?? 0) : !!state.windows?.length));
  if (kept.length) state.standingPasses = kept; else delete state.standingPasses;
}
/** Record the standing passes of a freshly opened window, dropping the ones the action moved past. */
export function applyStandingPasses(state: GameState, w: ReactionWindow): void {
  if (!state.standingPasses?.length || !passAhead(w)) return;
  const root = windowRootEventId(state, w);
  state.standingPasses = state.standingPasses.filter(saved => saved.scope === 'turn' || saved.rootEventId === root);
  pruneStandingPasses(state);
  for (const id of standingPassActors(state)) if (w.participants.includes(id) && !w.passed.includes(id)) w.passed.push(id);
  syncPriority(w);
}
export function participants(state: GameState, seat = state.turnSeat): string[] {
  return [...state.seatOrder.slice(seat), ...state.seatOrder.slice(0, seat)].filter(id => !state.players[id]!.presence || state.players[id]!.presence === 'active');
}
export function openWindow(state: GameState, kind: WindowKind, eventId: string, continuation: Continuation, order = participants(state)): ReactionWindow {
  const present = order.filter(id=>['death-gift','revival'].includes(kind)||!state.players[id]!.presence||state.players[id]!.presence==='active');
  // A stopped seat can use neither hand nor ability (11.2); reclaim rights survive stopping, so that window keeps them.
  const respondents = PASS_AHEAD_KINDS.includes(kind) && kind !== 'reclaim' && present.length > 1
    ? present.filter(id => !hasStatus(state.players[id]!, 'stopped')) : present;
  const w: ReactionWindow = { id: `w-${state.nextEventId++}`, revision: 0, kind, parentId: state.windows?.at(-1)?.id ?? null, participants: respondents, cursor: 0, passed: [], eventId, continuation };
  (state.windows ??= []).push(w); return w;
}
export function resetParent(state: GameState, parentId: string | null): void {
  const w = state.windows?.find(w => w.id === parentId); if (!w) return;
  w.passed = []; w.revision++;
  // Preserve the interrupted respondent for local defense windows (G03).
  if (w.participants.length > 1) w.cursor = 0;
}
