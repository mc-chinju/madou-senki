import {conditionalTechniqueAdditions} from './conditional-stats.js';
import type { CoSourceChoice } from '@madou/protocol';
import type { Technique } from '../reactions/continuations.js';
import type { GameState } from '../state.js';
import { canUseCharacterAbility } from '../state.js';
import { isActive } from '../lifecycle/objectives.js';
import { ownsAbility } from './ownership.js';
import { currentEffectiveTechnique } from './follower-entry.js';
import { additionalAttackTarget, heldSelections, resolveTechniqueSelection } from '../combat/legality.js';
import { groupDefenseOptions } from '../combat/combination.js';
import { availableDeclarationEffects, applyDeclarationEffects, DECLARATION_ABILITIES, type DeclarationAbilityId, type DeclarationEffects, type DeclarationKind } from './declaration-effects.js';
export interface DeclarationCandidate {
    kind: DeclarationKind;
    choice: CoSourceChoice & {
        coSource?: CoSourceChoice;
    };
    groupId?: string;
    sourceZone: 'hand' | 'chant' | 'followers';
    fromChant: boolean;
    technique: Technique;
    abilities: {
        abilityId: string;
        name: string;
        effects: DeclarationEffects;
    }[];
    targetIds: string[];
    nearTargetIds: string[];
    grantTargetId?: string;
    incomingTechnique?: Technique;
    blocked?: boolean;
    conditionalEffectAddition?:number;
}
/** This projection contains no hidden state. Random effect dice are explicit possible maxima. */
export function previewDeclarationCandidate(candidate: DeclarationCandidate, selectedIds: readonly string[]) {
    const selected = candidate.abilities.filter(a => selectedIds.includes(a.abilityId));
    const effects = selected.map(a => a.effects);
    const technique = applyDeclarationEffects(candidate.technique, effects, true);
    if(technique.defense==='counter')technique.effectLevel+=candidate.conditionalEffectAddition??0;
    const legalTargetIds = candidate.targetIds.filter(id => (!candidate.grantTargetId || candidate.grantTargetId === id) && (technique.range === 'far' || technique.range === 'near' && candidate.nearTargetIds.includes(id)));
    let canDeclare = !candidate.blocked && selected.length === selectedIds.length && new Set(selectedIds).size === selectedIds.length && (!technique.chant || candidate.fromChant);
    const incoming = candidate.incomingTechnique;
    if (candidate.kind === 'attack')
        canDeclare &&= legalTargetIds.length > 0;
    if (candidate.kind === 'defense' && incoming) {
        canDeclare &&= technique.defense !== 'none'
            && !(technique.defense === 'evade' && (incoming.attributes.includes('精') || incoming.evadeProhibited))
            && !(technique.defense === 'counter' && !technique.counterIgnoresLevel && technique.effectLevel < incoming.effectLevel)
            && !(incoming.counterProhibited && (technique.counter || technique.attributes.includes('反')))
            && !(technique.defense === 'parry' && incoming.school !== 'warrior')
            && !(technique.defense === 'negate' && incoming.school !== 'magic')
            && !(technique.defense === 'reflect' && incoming.effectLevel > (incoming.school === 'magic' ? technique.reflectMagicLimit ?? -1 : technique.blockWarriorLimit ?? -1))
            && !technique.fixedNegate?.forbiddenAttributes?.some(a => incoming.attributes.includes(a))
            && !(incoming.limitedDefenses && !incoming.limitedDefenses.includes(technique.defense as 'teleport' | 'counter'));
    }
    return { technique, legalTargetIds, canDeclare: !!canDeclare, pendingEffectDie: effects.some(e => e.effectDie), spiritChecks: effects.filter(e => e.spiritCheck).length };
}
export function declarationCandidates(s: GameState, actorId: string): DeclarationCandidate[] {
    const p = s.players[actorId], w = s.windows?.at(-1);
    if (!p || s.outcome || !isActive(p) || !canUseCharacterAbility(p,s))
        return [];
    if (!(Object.keys(DECLARATION_ABILITIES) as DeclarationAbilityId[]).some(id => ownsAbility(p, id)))
        return [];
    const grant = additionalAttackTarget(s, actorId);
    const incoming = w?.kind === 'normal-defense' && w.continuation.kind === 'group' && w.participants[w.cursor] === actorId ? s.groups?.[w.continuation.id] : undefined;
    const groupOptions = groupDefenseOptions(s, actorId);
    const ownTurn = !w && s.phase === 'action' && s.seatOrder[s.turnSeat] === actorId;
    if (!ownTurn && !grant && !incoming && !groupOptions.length)
        return [];
    const result: DeclarationCandidate[] = [];
    const choices = heldSelections(s, actorId);
    for (const choice of choices) {
        const source = resolveTechniqueSelection(s, actorId, choice, { kind: 'candidate', ...(incoming ? { group: incoming } : {}) });
        if (!source.ok)
            continue;
        const selections = [choice, ...(source.technique.combinable ? choices.filter(co => co.cardInstanceId !== choice.cardInstanceId).map(coSource => ({ ...choice, coSource })) : [])];
        for (const selection of selections) {
            const resolved = resolveTechniqueSelection(s, actorId, selection, { kind: 'candidate', ...(incoming ? { group: incoming } : {}) });
            if (!resolved.ok)
                continue;
            const t = resolved.technique;
            const groupOption = groupOptions.find(o => o.cardInstanceId === choice.cardInstanceId && choice.dedicated);
            const kind: DeclarationKind = incoming ? 'defense' : grant ? 'attack' : ownTurn ? (t.turnEffect ? 'turn-technique' : 'attack') : 'group-defense';
            if (kind === 'group-defense' && !groupOption || kind !== 'turn-technique' && t.turnEffect)
                continue;
            const fromChant = resolved.coSource?.fromChant ?? resolved.fromChant;
            const abilities = availableDeclarationEffects(s, actorId, t, kind, fromChant);
            if (!abilities.length)
                continue;
            const group = incoming ?? (groupOption ? s.groups?.[groupOption.groupId] : undefined);
            const target = group?.targets.find(t => t.actorId === actorId);
            const candidate: DeclarationCandidate = { kind,
                ...(incoming?{conditionalEffectAddition:conditionalTechniqueAdditions(s,{actorId,kind:'defense',technique:{...t,defense:'counter'},canceled:false},incoming.attackerId).effect}:{}), choice: structuredClone(selection), sourceZone: resolved.fromFollowers ? 'followers' : resolved.fromHand ? 'hand' : 'chant', fromChant, technique: t, abilities,
                targetIds: s.seatOrder.filter(id => id !== actorId && isActive(s.players[id]!) && !(s.players[id]!.revealed && s.players[id]!.faction === p.faction)),
                nearTargetIds: s.seatOrder.filter(id => s.distances[actorId]?.[id] === 'near'),
                ...(grant ? { grantTargetId: grant } : {}), ...(group ? { groupId: group.id, incomingTechnique: structuredClone(currentEffectiveTechnique(s, group, actorId)) } : {}),
                ...(incoming ? { blocked: !target || target.followerStarted || target.normalDefenseClosed || t.defense === 'reflect' && target.hits.some(h => h.index === group!.hitCursor && h.lineage.includes(choice.cardInstanceId)) } : {}) };
            // Keep contextual sources even when no selection can currently legalize them.
            // Consumers need their shared preview to explain unmet chant/defense requirements.
            result.push(candidate);
        }
    }
    return result;
}
