import {gameStats} from '../game-stats.js';
import type { GameState } from '../state.js';
import { EntropyError } from '../setup.js';
import { openWindow } from '../reactions/windows.js';
import type { PublicRollView, RollFrame, RollFormula, RollPurpose, RollResume } from './frames.js';

interface RollOptions {
  eventId: string;
  rollerId: string;
  purpose: RollPurpose;
  formula: RollFormula;
  resume: RollResume;
  check?: { excludeSourceAbilityId?:string; modifier: number; base?: 'spirit' | 'morale' | 'fixed'; threshold?:number };
}

const FORMULAS: Record<RollFormula, { count: number; modifier: number; multiply: boolean }> = {
  'd6-product-min10': {count:2,modifier:0,multiply:false},
  d6: { count: 1, modifier: 0, multiply: false },
  '2d6': { count: 2, modifier: 0, multiply: false },
  '3d6': { count: 3, modifier: 0, multiply: false },
  '4d6+1': { count: 4, modifier: 1, multiply: false },
  d6x2: { count: 1, modifier: 2, multiply: true },
  d6x4: { count: 1, modifier: 4, multiply: true },
  d6x5: { count: 1, modifier: 5, multiply: true },
  '2d6x2': { count: 2, modifier: 2, multiply: true },
};

export function beginRoll(state: GameState, options: RollOptions, dice: () => number): RollFrame {
  const frame: RollFrame = {
    // Preserve the existing shared damage-record identity.
    id: options.purpose === 'attack-damage' && 'actionId' in options.resume
      ? `roll-${options.resume.actionId}-damage` : `roll-${state.nextEventId++}`,
    eventId: options.eventId, rollerId: options.rollerId, purpose: options.purpose,
    kind: options.check ? 'check' : 'numeric', formula: options.formula,
    stage: options.check ? 'before-roll' : 'after-roll', generation: 0,
    faces: [], modifier: options.check?.modifier ?? FORMULAS[options.formula].modifier,
    total: null, forcedFailure: false, attempts: [], resume: options.resume,
    ...(options.check?.excludeSourceAbilityId?{excludeSourceAbilityId:options.check.excludeSourceAbilityId}:{}),
    ...(options.check ? { checkBase: options.check.base ?? 'spirit', ...(options.check.threshold!==undefined?{threshold:options.check.threshold}:{}) } : {}),
  };
  (state.rolls ??= []).push(frame);
  if (!options.check) throwRoll(frame, dice);
  openWindow(state, frame.stage === 'before-roll' ? 'before-roll' : 'after-roll', frame.eventId, { kind: 'roll', id: frame.id });
  return frame;
}

/** Called once initially, and again only when an accepted reroll child resolves. */
export function throwRoll(frame: RollFrame, dice: () => number): void {
  const formula = FORMULAS[frame.formula];
  const faces = Array.from({ length: formula.count }, () => {
    const face = dice();
    if (!Number.isInteger(face) || face < 1 || face > 6) throw new EntropyError('INVALID_DIE');
    return face;
  });
  const sum = faces.reduce((a, b) => a + b, 0);
  const total = frame.formula==='d6-product-min10'?Math.max(10,faces[0]!*faces[1]!):formula.multiply ? sum * frame.modifier : sum + (frame.kind === 'numeric' ? frame.modifier : 0);
  frame.faces = faces;
  frame.total = total;
  if (frame.kind === 'check') frame.success = !frame.forcedFailure && total <= frame.threshold!;
  frame.attempts.push({
    generation: frame.generation, faces: [...faces], total,
    ...(frame.kind === 'check' ? { success: frame.success! } : {}),
  });
}

export function closeBeforeRoll(state: GameState, frame: RollFrame, dice: () => number): void {
  const stats = gameStats(state,frame.rollerId,{excludeSourceAbilityId:frame.excludeSourceAbilityId,provenance:{kind:'roll',id:frame.id}});
  if(frame.checkBase!=='fixed')frame.threshold = stats.spirit + frame.modifier + (frame.checkBase === 'morale' ? stats.moraleBonus : 0);
  throwRoll(frame, dice);
  frame.stage = 'after-roll';
  if (frame.resume.kind === 'action-check') {
    const action = state.actions![frame.resume.actionId]!;
    action.stage = 'check-result';
    action.roll = { dice: [...frame.faces], threshold: frame.threshold!, success: frame.success! };
  }
  openWindow(state, 'after-roll', frame.eventId, { kind: 'roll', id: frame.id });
}

/** A parent result under a child declaration is visible, but cannot be targeted. */
export function unresolvedRoll(state: GameState): RollFrame | undefined {
  const window = state.windows?.at(-1);
  if (!window || !['before-roll','after-roll'].includes(window.kind) || window.continuation.kind !== 'roll') return undefined;
  return state.rolls?.find(frame => frame.id === window.continuation.id && frame.stage !== 'applied');
}

export function visibleRoll(state: GameState): RollFrame | undefined {
  for (const window of [...(state.windows ?? [])].reverse()) {
    if (window.continuation.kind !== 'roll') continue;
    const frame = state.rolls?.find(frame => frame.id === window.continuation.id);
    if (frame) return frame;
  }
  return undefined;
}

/** Use the same explicit privacy allowlist for the active frame and durable history. */
export function projectRoll(state: GameState, frame: RollFrame, viewerId: string): PublicRollView {
  const seeCheck = frame.rollerId === viewerId || state.players[frame.rollerId]!.revealed;
  return {
    rollId: frame.id, eventId: frame.eventId, purpose: frame.purpose, rollerId: frame.rollerId,
    kind: frame.kind, formula: frame.formula, stage: frame.stage, generation: frame.generation,
    faces: [...frame.faces], modifier: frame.modifier, total: frame.total, forcedFailure: frame.forcedFailure,
    ...(seeCheck && frame.threshold !== undefined ? { threshold: frame.threshold } : {}),
    ...(seeCheck && frame.success !== undefined ? { success: frame.success } : {}),
    attempts: frame.attempts.map(attempt => ({
      generation: attempt.generation, faces: [...attempt.faces], total: attempt.total,
      ...(seeCheck && attempt.success !== undefined ? { success: attempt.success } : {}),
    })),
  };
}
