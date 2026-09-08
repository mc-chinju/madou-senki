import {gameStats} from '../game-stats.js';
import {canSelectFollowerAttack} from '../effects/follower-attacks.js';
import { getAction, getCharacter } from '@madou/catalog';
import type { GameCommand } from '@madou/protocol';
import type { GameState } from '../state.js';
import { hasStatus } from '../state.js';
import { techniqueFor } from '../effects/registry.js';
import { canSelectPrintedDedicated, canSelectPrintedVariant } from '../effects/techniques.js';
import {currentEffectiveTechnique} from '../abilities/follower-entry.js';
import type { ActionFrame, AttackGroup, Technique } from '../reactions/continuations.js';
import { isActive } from '../lifecycle/objectives.js';
import {freezeRelativeDefenseLimits} from './defense.js';
export function advanceCards(s: GameState, actorId: string): string[] {
    return s.players[actorId]!.hand.filter(id => getAction(id)?.modes?.some(mode => mode.playMode === 'advance'));
}
export function coSourceFor(s: GameState, actorId: string, choice: NonNullable<Extract<GameCommand, {
    type: 'ATTACK';
}>['coSource']>, allowUnchanted=false): ActionFrame['coSource'] {
    const p = s.players[actorId]!;
    const name = getCharacter(p.characterId)?.name;
    const chant = p.chants.some(c => c.cardInstanceId === choice.cardInstanceId);
    const fromFollowers=p.followers.some(f=>f.cardInstanceId===choice.cardInstanceId);
    if (!p.hand.includes(choice.cardInstanceId) && !chant && !fromFollowers)
        return;
    if (choice.cardInstanceId === 'a2-p09-r1c1' || !canSelectPrintedVariant(choice.cardInstanceId, name, choice.dedicated, choice.techniqueVariant))
        return;
    if (choice.dedicated && !canSelectPrintedDedicated(choice.cardInstanceId, name)&&!canSelectFollowerAttack(choice.cardInstanceId,name))
        return;
    const card = getAction(choice.cardInstanceId);
    const stats = card?.stats;
    const followerBottom=card?.category==='follower'&&choice.dedicated&&canSelectFollowerAttack(choice.cardInstanceId,name)?stats?.attack as {attributes:string[];level:number|string}|undefined:undefined;
    if(fromFollowers&&!followerBottom||chant&&followerBottom)return;
    const attackMode = card?.modes?.find(mode => mode.playMode === 'attack' && Array.isArray(mode.attributes) && mode.attributes.includes('戦') && typeof mode.warrior_level === 'number');
    const printedWarrior = stats?.school === '戦' && Array.isArray(stats.attributes) && stats.attributes.includes('戦');
    if (!printedWarrior && !attackMode && !followerBottom?.attributes.includes('戦')) return;
    const printedUseLevel = followerBottom?followerBottom.level:printedWarrior ? stats!.printed_use_level : attackMode!.warrior_level;
    const ordinary = techniqueFor(choice.cardInstanceId, name, !!followerBottom);
    const technique = techniqueFor(choice.cardInstanceId, name, choice.dedicated, choice.techniqueVariant);
    if (!ordinary || !technique || technique.school !== 'warrior' || technique.turnEffect)
        return;
    if (typeof printedUseLevel === 'number') ordinary.useLevel = printedUseLevel;
    else if (ordinary.useLevelSource !== 'incoming-effect') return;
    if (ordinary.useLevelSource === 'incoming-effect') {
        const window = s.windows?.at(-1);
        const group = window?.kind === 'normal-defense' && window.continuation.kind === 'group'
            ? s.groups?.[window.continuation.id] : undefined;
        const incoming = group ? currentEffectiveTechnique(s,group, actorId) : undefined;
        if (!incoming || incoming.school !== 'warrior')
            return;
        ordinary.useLevel = incoming.effectLevel;
        technique.useLevel = incoming.effectLevel;
        technique.effectLevel = incoming.effectLevel;
    }
    if (ordinary.useLevel > gameStats(s,p.id).warrior_level)
        return;
    if (technique.chant && !chant && !allowUnchanted || technique.prohibitedFactions?.includes(p.faction))
        return;
    if (technique.attributes.includes('白') && getCharacter(p.characterId)?.restrictions.includes('白技使用不可'))
        return;
    return { cardInstanceId: choice.cardInstanceId, dedicated: choice.dedicated, technique, fromChant: chant, ...(fromFollowers?{fromFollowers:true}:{}) };
}
/** Evaluate the component once, then add the Beast's ten to the same attack. */
export function composeTechnique(base: Technique, component: Technique): Technique {
    const t: Technique = { ...structuredClone(component), school: 'warrior', useLevel: 6, effectLevel: 6, noChecks: true,
        range: component.range === 'near' ? 'near' : 'far', damage: component.damage === null ? 10 : 10 + component.damage,
        attributes: [...new Set([...base.attributes, ...component.attributes])],
        destroyFollowerAttributes: [...new Set([...(base.destroyFollowerAttributes ?? []), ...(component.destroyFollowerAttributes ?? [])])],
        contract: base.contract };
    delete t.useLevelSource;
    freezeRelativeDefenseLimits(t);
    return t;
}
export function substitutionHits(g: AttackGroup, actorId: string): {
    targetId: string;
    hitIndex: number;
}[] {
    return g.targets.filter(t => t.actorId !== actorId && !t.followerStarted && !t.normalDefenseClosed && !t.hitsApplied)
        .flatMap(t => t.hits.filter(h => !h.defended).map(h => ({ targetId: t.actorId, hitIndex: h.index })));
}
export function groupDefenseOptions(s: GameState, actorId: string): {
    cardInstanceId: string;
    groupId: string;
    targetIds: string[];
}[] {
    const p = s.players[actorId]!;
    const w = s.windows?.at(-1);
    if (s.outcome || !isActive(p) || hasStatus(p, 'stopped') || hasStatus(p, 'silenced') || p.characterId !== 'c2-p03-r1c2' || p.faction !== 'GOOD' || !w || w.participants[w.cursor] !== actorId || w.continuation.kind !== 'group')
        return [];
    if (!['attack-abilities', 'normal-defense', 'hit', 'hit-abilities'].includes(w.kind))
        return [];
    const g = s.groups![w.continuation.id]!;
    const cardInstanceId = 'a2-p16-r3c3';
    if (g.attackerId === actorId || g.technique.counterProhibited || !p.hand.includes(cardInstanceId) && !p.chants.some(c => c.cardInstanceId === cardInstanceId))
        return [];
    const hits = substitutionHits(g, actorId);
    if (!hits.length || hits.some(ref => g.targets.find(t => t.actorId === ref.targetId)!.hits.find(h=>h.index===ref.hitIndex)!.lineage.includes(cardInstanceId)))
        return [];
    return [{ cardInstanceId, groupId: g.id, targetIds: [...new Set(hits.map(h => h.targetId))] }];
}
