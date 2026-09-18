import {printedTechniqueAllowed} from '../combat/printed-restrictions.js';
import {recordAbility} from '../public-record.js';
import {gameStats} from '../game-stats.js';
import { getCharacter } from '@madou/catalog';
import type { GameState } from '../state.js';
import { canUseCharacterAbility, hasStatus } from '../state.js';
import { isActive } from '../lifecycle/objectives.js';
import { validTurnTechniqueTargets } from '../lifecycle/turn-techniques.js';
import type { ActionFrame, Technique } from '../reactions/continuations.js';
import type { AbilityFrame } from './frames.js';
import { ownsAbility } from './ownership.js';
import { openWindow, participants } from '../reactions/windows.js';
import { beginRoll } from '../rolls/advance.js';
import { defenseLegality } from '../combat/defense.js';
import { applyDeclarationEffects, declarationEffects, DECLARATION_ABILITIES, type DeclarationAbilityId, type DeclarationKind, type DeclarationEffects } from './declaration-effects.js';
export interface SavedDeclaration {
    base: Technique;
    kind: DeclarationKind;
    committed: boolean;
    queue: {
        abilityId: DeclarationAbilityId;
        status: 'pending' | 'resolving' | 'accepted' | 'failed';
        frameId?: string;
    }[];
    effectRollId?: string;
    damageRollId?: string;
    effectSkipped?: boolean;
    damageSkipped?: boolean;
}
export interface DeclarationSelectionView {
    actionId: string;
    abilities: {
        abilityId: string;
        name: string;
        status: 'pending' | 'resolving' | 'accepted' | 'failed';
    }[];
    committed: boolean;
}
export function declarationSelection(s: GameState, viewer: string): DeclarationSelectionView | null {
    const a = Object.values(s.actions ?? {}).reverse().find(a => a.actorId === viewer && a.declaration);
    return a?.declaration ? { actionId: a.id, abilities: a.declaration.queue.map(q => ({ abilityId: q.abilityId, name: DECLARATION_ABILITIES[q.abilityId].name, status: q.status })), committed: a.declaration.committed } : null;
}
export function liveDeclarationEffects(s: GameState, a: ActionFrame): DeclarationEffects[] {
    const d = a.declaration, p = s.players[a.actorId];
    if (!d || a.fixedReceivedEffect || !p || !isActive(p) || !canUseCharacterAbility(p,s))
        return [];
    return d.queue.flatMap(q => {
        if (q.status !== 'accepted' || !ownsAbility(p, q.abilityId))
            return [];
        const effect = declarationEffects(q.abilityId, d.base, d.kind, !!a.fromChant, p.revealed);
        return effect ? [effect] : [];
    });
}
export function validDeclarationAbility(s: GameState, f: AbilityFrame): boolean {
    if (f.context.kind !== 'action')
        return false;
    const a = s.actions?.[f.context.actionId], p = s.players[f.actorId];
    const d = a?.declaration;
    return !!a && !!d && !d.committed && !a.canceled && !!p && isActive(p) && canUseCharacterAbility(p,s) && ownsAbility(p, f.abilityId)
        && d.queue.some(q => q.frameId === f.id && q.status === 'resolving')
        && !!declarationEffects(f.abilityId as DeclarationAbilityId, d.base, d.kind, !!a.fromChant, p.revealed);
}
/** A failed check is a spent optional attempt, never a command rejection. */
export function resolveDeclarationAbility(s: GameState, f: AbilityFrame, dice: () => number): boolean {
    if (f.context.kind !== 'action')
        return true;
    const a = s.actions![f.context.actionId]!, d = a.declaration!;
    const entry = d.queue.find(q => q.frameId === f.id)!;
    const valid = !f.canceled && validDeclarationAbility(s, f);
    const effect = valid ? declarationEffects(entry.abilityId, d.base, d.kind, !!a.fromChant, s.players[a.actorId]!.revealed) : undefined;
    if (effect?.spiritCheck && f.stage === 'declaration') {
        f.stage = 'self-check';
        f.rollIds.push(beginRoll(s, { eventId: f.eventId, rollerId: f.actorId, purpose: 'ability-check', formula: '2d6', check: { modifier: 0 }, resume: { kind: 'ability', abilityId: f.id } }, dice).id);
        return false;
    }
    const success = valid && (!effect?.spiritCheck || s.rolls?.find(r => r.id === f.rollIds.at(-1))?.success === true);
    entry.status = success ? 'accepted' : 'failed';
    return true;
}
function finalUsageLegal(s: GameState, a: ActionFrame, t: Technique): boolean {
    const p = s.players[a.actorId]!, d = a.declaration!;
    if (!isActive(p) || hasStatus(p, 'stopped') || t.school === 'magic' && hasStatus(p, 'silenced') || t.chant && !a.fromChant)
        return false;
    if (!printedTechniqueAllowed(p,t))
        return false;
    if (d.kind === 'defense') {
        const group = s.groups?.[a.groupId!];
        return !!group && !!a.cardInstanceId && !defenseLegality(s, t, group, a.actorId, a.cardInstanceId);
    }
    if (d.kind === 'turn-technique')
        return validTurnTechniqueTargets(s, a.actorId, t, a.targetIds, a.convertTargetIds ?? []);
    if (d.kind === 'group-defense')
        return !!s.groups?.[a.groupId!];
    const eligible = s.seatOrder.filter(id => id !== a.actorId && isActive(s.players[id]!) && !(s.players[id]!.revealed && s.players[id]!.faction === p.faction));
    if (a.targetIds.some(id => !eligible.includes(id) || t.range === 'none' || t.range === 'near' && s.distances[a.actorId]?.[id] !== 'near'))
        return false;
    if (t.target === 'one' && a.targetIds.length > (t.maxTargets ?? 1))
        return false;
    if (t.mandatoryAll) {
        const required = eligible.filter(id => t.range === 'far' || t.range === 'near' && s.distances[a.actorId]?.[id] === 'near');
        if (required.length !== a.targetIds.length || required.some(id => !a.targetIds.includes(id)))
            return false;
    }
    return true;
}
export function usageChecks(s: GameState, a: ActionFrame): NonNullable<ActionFrame['checkSpecs']> {
    const t = a.technique, stats = gameStats(s,a.actorId,{provenance:{kind:'action',id:a.id}});
    const explicitNoChecks = liveDeclarationEffects(s, a).some(e => e.noChecks);
    const waived = t.noChecks || a.kind === 'defense' && t.counterNoChecks;
    const checks: NonNullable<ActionFrame['checkSpecs']> = waived ? [] : Array.from({ length: Math.max(0, t.useLevel - (t.school === 'warrior' ? stats.warrior_level : stats.magic_level)) }, () => ({ purpose: 'excess-level', modifier: 0 }));
    if ((!waived || !!a.coSource && !explicitNoChecks) && t.activationCheckModifier !== undefined)
        checks.unshift({ purpose: 'activation', modifier: t.activationCheckModifier });
    if (!waived && t.defense === 'teleport')
        checks.push({ purpose: 'teleport', modifier: t.teleportCheckModifier ?? 0 });
    if (a.kind === 'defense' && t.counterCheck && !t.counterNoChecks && !explicitNoChecks)
        checks.push({ purpose: 'counter', modifier: 0 });
    return checks;
}
/** Return pending until each selected ability has its ordinary independent cancellation window. */
export function advanceDeclaration(s: GameState, a: ActionFrame): 'pending' | 'failed' | 'ready' {
    const d = a.declaration;
    if (!d || d.committed)
        return 'ready';
    const entry = d.queue.find(q => q.status === 'pending');
    if (entry) {
        const frame: AbilityFrame = { source: 'ability', id: `ability-${s.nextEventId++}`, abilityId: entry.abilityId, actorId: a.actorId, eventId: a.eventId, parentWindowId: a.parentWindowId, useOrdinal: 1, targetIds: [...a.targetIds], costs: { ownAction: false }, stage: 'declaration', canceled: false, rollIds: [], context: { kind: 'action', actionId: a.id } };
        entry.status = 'resolving';
        entry.frameId = frame.id;
        (s.abilities ??= {})[frame.id] = frame;
        (s.used ??= []).push(`${a.eventId}:${a.actorId}:${entry.abilityId}`);
        recordAbility(s, 'ABILITY_DECLARED', frame.actorId, frame.abilityId, frame.targetIds.filter(id => id !== frame.actorId));
        openWindow(s, 'declaration', a.eventId, { kind: 'ability', id: frame.id }, participants(s, (s.seatOrder.indexOf(a.actorId) + 1) % s.seatOrder.length));
        return 'pending';
    }
    const effects = liveDeclarationEffects(s, a);
    if (!finalUsageLegal(s, a, applyDeclarationEffects(d.base, effects, true)))
        return 'failed';
    a.technique = applyDeclarationEffects(d.base, effects);
    d.committed = true;
    a.checkSpecs = usageChecks(s, a);
    a.checks = a.checkSpecs.map(c => c.modifier);
    return 'ready';
}
export function prepareDeclarationValue(s: GameState, a: ActionFrame, kind: 'effect' | 'damage', dice: () => number): boolean {
    const d = a.declaration;
    if (!d)
        return true;
    const key = kind === 'effect' ? 'effectRollId' : 'damageRollId';
    const skip = kind === 'effect' ? 'effectSkipped' : 'damageSkipped';
    if (d[skip])
        return true;
    if (!d[key]) {
        if (!liveDeclarationEffects(s, a).some(e => kind === 'effect' ? e.effectDie : e.damageDie) || kind === 'damage' && a.technique.damage === null) {
            d[skip] = true;
            return true;
        }
        d[key] = beginRoll(s, { eventId: a.eventId, rollerId: a.actorId, purpose: 'ability-value', formula: 'd6', resume: { kind: 'action-value', actionId: a.id, value: kind === 'effect' ? 'declaration-effect' : 'ability-damage' } }, dice).id;
        return false;
    }
    return s.rolls?.find(r => r.id === d[key])?.stage === 'applied';
}
export function declarationNumbers(s: GameState, a: ActionFrame) {
    const effects = liveDeclarationEffects(s, a);
    const roll = (id: string | undefined) => { const r = s.rolls?.find(r => r.id === id); return r?.stage === 'applied' ? r.total ?? 0 : 0; };
    return { replacement: effects.find(e => e.effectReplacement !== undefined)?.effectReplacement,
        effectAddition: effects.reduce((n, e) => n + (e.effectAddition ?? 0), 0) + (effects.some(e => e.effectDie) ? roll(a.declaration?.effectRollId) : 0),
        damageAddition: effects.reduce((n, e) => n + (e.damageAddition ?? 0), 0) + (effects.some(e => e.damageDie) ? roll(a.declaration?.damageRollId) : 0),
        damageMultiplier: effects.some(e => e.damageDouble) ? 2 : 1 };
}
