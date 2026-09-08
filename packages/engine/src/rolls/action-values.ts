import {gameStats} from '../game-stats.js';
import {acceptActionModifiers} from '../abilities/action-modifiers.js';
import type { GameState } from '../state.js';
import type { ActionFrame } from '../reactions/continuations.js';
import { beginRoll } from './advance.js';
import type { RollFormula, RollFrame } from './frames.js';
/** Values are shared by the attack group, and cannot affect any target until finalized. */
export function prepareActionValues(s: GameState, a: ActionFrame, dice: () => number): boolean {
    if(a.valuesPrepared)return true;
    if (a.technique.hitCount === 'd6') {
        a.hitCountRollId = beginRoll(s, { eventId: a.eventId, rollerId: a.actorId, purpose: 'attack-hit-count', formula: 'd6', resume: { kind: 'action-value', actionId: a.id, value: 'hit-count' } }, dice).id;
        return false;
    }
    const formula = a.technique.damageFormula;
    if (formula && ['d6', 'd6x2', 'd6x4', 'd6x5', '2d6x2', '2d6', '3d6', '4d6+1','d6-product-min10'].includes(formula) && !a.damageRollId) {
        a.damageRollId = beginRoll(s, { eventId: a.eventId, rollerId: a.actorId, purpose: 'attack-damage', formula: formula as RollFormula, resume: { kind: 'action-value', actionId: a.id, value: 'damage' } }, dice).id;
        return false;
    }
    if (formula === 'attacker-spirit')
        a.technique.damage = gameStats(s,a.actorId,{provenance:{kind:'action',id:a.id}}).spirit;
    if (formula === 'attacker-spirit-x2')
        a.technique.damage = gameStats(s,a.actorId,{provenance:{kind:'action',id:a.id}}).spirit * 2;
    if (formula === 'attacker-magic-x2')
        a.technique.damage = gameStats(s,a.actorId,{provenance:{kind:'action',id:a.id}}).magic_level * 2;
    if(formula==='attacker-magic-x3')a.technique.damage=gameStats(s,a.actorId,{provenance:{kind:'action',id:a.id}}).magic_level*3;
    if(a.coSource&&formula)a.technique.damage=(a.technique.damage??0)+10;
    acceptActionModifiers(s,a).damageBase=a.technique.damage;
    a.valuesPrepared=true;
    return true;
}
export function applyActionValue(s: GameState, frame: RollFrame): void {
    if (frame.resume.kind !== 'action-value')
        throw Error('INVALID_CONTINUATION');
    const a = s.actions![frame.resume.actionId]!;
    if(frame.resume.value==='ability-damage'||frame.resume.value==='declaration-effect')return;
    if(frame.resume.value==='effect-level'){const m=acceptActionModifiers(s,a);m.effectBase+=frame.total!;a.technique.effectLevel=m.effectBase+m.prayerAddition;a.technique.useLevel+=frame.total!;m.usageRequirement=a.technique.useLevel;return;}
    if (frame.resume.value === 'hit-count')
        a.technique.hitCount = frame.total!;
    else {
        a.technique.damage = frame.total!;
        (a.sourceDamageRollIds??=[]).push(frame.id);
        (s.randomRolls ??= []).push({ id: frame.id, eventId: frame.eventId, actionId: a.id, kind: 'damage', formula: frame.formula as NonNullable<GameState['randomRolls']>[number]['formula'], faces: [...frame.faces], modifier: frame.modifier, total: frame.total! });
    }
}
