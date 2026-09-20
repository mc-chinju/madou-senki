import {discardPhysical} from '../discard.js';
import {reclaimEventId} from '../reclaim.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {gameStats} from '../game-stats.js';
import {recordIgnoredBeast} from '../abilities/beast-empathy.js';
import {freezeEntryModifiers,virtualGuardWillEnter} from '../abilities/follower-entry.js';
import { beginRoll } from '../rolls/advance.js';
import type { GameState } from '../state.js';
import type { AttackGroup, AttackTarget, FollowerDefenseSnapshot, FollowerOutcome, Technique } from '../reactions/continuations.js';
import { followerFor, followerLevel } from '../effects/follower-descriptors.js';
/** Freeze actual numbers and effect choices at entry, before any child can change them. */
export function freezeFollowerSnapshot(state: GameState, group: AttackGroup, target: AttackTarget): void {
    if (target.followerDefense)
        return;
    freezeEntryModifiers(state,group,target);
    const player = state.players[target.actorId]!;
    const bonus = gameStats(state,player.id).followerLevelBonus;
    target.followerSnapshot = player.followers.map(f => f.cardInstanceId);
    target.followerResults = [];
    target.followerCursor = 0;
    target.followerDestroyed = [];
    target.followerGuardCursor = 0;
    target.followerDefense = player.followers.map((f, position) => { const descriptor = followerFor(f.cardInstanceId)!; const dedicated = target.dedicatedCardInstanceIds?.includes(f.cardInstanceId) ?? false; return { ineffective:!!target.physicalHumansInvalid&&descriptor.attributes.includes('人'), source: 'physical', cardInstanceId: f.cardInstanceId, position, identityPublic:f.revealed, descriptor, dedicated, levels: target.hits.map(h => followerLevel(descriptor, h.technique ?? group.technique, bonus, dedicated)), hitCursor: 0, hits: [], defeated: false, revivalForbidden: false }; });
    if(virtualGuardWillEnter(state,group,target))target.followerDefense.unshift({
        source:'virtual',sourceId:`${group.id}-${target.actorId}-virtual-guard`,position:-1,
        descriptor:{level:4,hp:1,attributes:['人','女'],moraleRequired:false,moraleModifier:0,cancelIgnore:true,contract:{conditions:[],costs:[],timing:['follower-start'],targets:'self',lifetime:'attack-group'}},
        dedicated:false,levels:target.hits.map(()=>4+bonus),morale:null,hitCursor:0,hits:[],defeated:false,revivalForbidden:true,
    });
}
function ignored(t: AttackTarget, source: FollowerDefenseSnapshot, technique: Technique, index: number): boolean {
    return !!(technique.ignoreDarkSaint&&source.source==='physical'&&source.cardInstanceId==='a2-p21-r2c1' || technique.followerIgnore || t.frozenAbilityIgnore || t.followerBypassChoice && source.levels[index]! <= technique.effectLevel || technique.ignoreFollowerAttributes?.some(a => source.descriptor.attributes.includes(a)));
}
function destruction(d: FollowerDefenseSnapshot, t: Technique, level: number): FollowerOutcome | undefined {
    const attributes = d.descriptor.attributes;
    const exempt = t.destroyFollowerExemptAttributes?.some(a => attributes.includes(a));
    if (t.destroyFollowerAttributes?.some(a => attributes.includes(a)) || t.destroyFollowerAttributesAtOrBelowEffectLevel?.some(a => attributes.includes(a)) && level <= t.effectLevel)
        return 'attribute-destroyed';
    if (t.destroyAllFollowers || t.destroyAllFollowersExceptAttributes && !t.destroyAllFollowersExceptAttributes.some(a => attributes.includes(a)) || !exempt && (t.destroyFollowersAtOrBelowEffectLevel && level <= t.effectLevel || t.destroyFollowersAtOrBelow !== undefined && level <= t.destroyFollowersAtOrBelow))
        return 'level-destroyed';
}
function morale(s: GameState, g: AttackGroup, t: AttackTarget, d: FollowerDefenseSnapshot, roll: () => number): boolean {
    if (d.morale !== undefined)
        return true;
    if(d.source==='virtual'){d.morale=null;return true;}
    const placed = s.players[t.actorId]!.followers.find(f => f.cardInstanceId === d.cardInstanceId);
    if (placed) {placed.revealed = true;if(d.source==='physical')d.identityPublic=true;}
    if (!d.descriptor.moraleRequired || d.dedicated && d.descriptor.dedicated?.waiveMorale) {
        d.morale = null;
        return true;
    }
    const frame = s.rolls?.find(f => f.id === t.moraleRollId);
    if (!frame) {
        t.moraleRollId = beginRoll(s, { eventId: s.actions![g.actionId]!.eventId, rollerId: t.actorId, purpose: 'follower-morale', formula: '2d6', check: { modifier: d.descriptor.moraleModifier, base: 'morale' }, resume: { kind: 'follower', groupId: g.id, targetId: t.actorId, cardInstanceId: d.cardInstanceId } }, roll).id;
        return false;
    }
    if (frame.stage !== 'applied')
        return false;
    d.morale = { dice: [...frame.faces], threshold: frame.threshold!, success: frame.success! };
    delete t.moraleRollId;
    if (!d.morale.success) {
        d.defeated = true;
        d.revivalForbidden = true;
    }
    return true;
}
function moraleFailed(d: FollowerDefenseSnapshot): boolean { return d.morale?.success === false; }
function summarize(t: AttackTarget, d: FollowerDefenseSnapshot): void {
    if(d.source==='virtual')return;
    const outcome = d.morale?.success === false ? 'morale-failed' : d.hits.at(-1)?.outcome ?? 'passed-through';
    // Compatibility summary; per-hit outcomes remain authoritative in the frozen source.
    const compatible = outcome === 'earth-nullified' || outcome === 'reflected' ? 'blocked' : outcome;
    t.followerResults!.push({ cardInstanceId: d.cardInstanceId, morale: d.morale ?? null, outcome: compatible, hpReduction: Math.max(0, ...d.hits.map(h => h.hpReduction)) });
}
export function resolveFollowerSnapshot(state: GameState, group: AttackGroup, target: AttackTarget, roll: () => number): boolean {
    freezeFollowerSnapshot(state, group, target);
    if (target.followersSettled)
        return true;
    const sources = target.followerDefense!;
    // Ignore cancellation is a column-wide printed effect and may reveal a rear source.
    const hasIgnore = target.hits.some((h, i) => !h.defended && sources.some(d => !d.ineffective&&ignored(target, d, h.technique ?? group.technique, i)));
    if (hasIgnore && !target.followerIgnoreCancelled) {
        for (; target.followerGuardCursor! < sources.length; target.followerGuardCursor!++) {
            const d = sources[target.followerGuardCursor!]!;
            if(d.ineffective)continue;
            if (!d.descriptor.cancelIgnore && !(d.dedicated && d.descriptor.dedicated?.cancelIgnore))
                continue;
            if (!morale(state, group, target, d, roll))
                return false;
            if (d.morale?.success !== false) {
                target.followerIgnoreCancelled = true;
                break;
            }
        }
    }
    for (; target.followerCursor! < sources.length; target.followerCursor!++) {
        const d = sources[target.followerCursor!]!;
        if (target.hits.every(h => h.defended))
            break;
        for (; d.hitCursor < target.hits.length; d.hitCursor++) {
            const index = d.hitCursor;
            const hit = target.hits[index]!;
            if (hit.defended)
                continue;
            const technique = hit.technique ?? group.technique;
            const level = d.levels[index]!;
            let outcome: FollowerOutcome;
            let hpReduction = 0;
            if(d.ineffective)
                outcome='passed-through';
            else if (moraleFailed(d))
                outcome = 'morale-failed';
            else if (!target.followerIgnoreCancelled && ignored(target, d, technique, index)) {
                outcome = 'passed-through';
                recordIgnoredBeast(state,group,target,hit,d);
            }
            else {
                const destroy = destruction(d, technique, level);
                if (destroy) {
                    const placed = d.source==='physical'?state.players[target.actorId]!.followers.find(f => f.cardInstanceId === d.cardInstanceId):undefined;
                    if (placed) {placed.revealed = true;if(d.source==='physical')d.identityPublic=true;}
                    outcome = destroy;
                    d.defeated = true;
                    d.revivalForbidden = true;
                }
                else if (d.descriptor.spiritPass && technique.attributes.includes('精'))
                    outcome = 'passed-through';
                else {
                    if (!morale(state, group, target, d, roll))
                        return false;
                    if (moraleFailed(d))
                        outcome = 'morale-failed';
                    else if (d.descriptor.earthMagicNullify && technique.school === 'magic' && technique.attributes.includes('地')) {
                        hit.defended = true;
                        outcome = 'earth-nullified';
                    }
                    else if (d.source==='physical' && d.descriptor.reflectionLimit !== undefined && technique.effectLevel <= d.descriptor.reflectionLimit && !hit.lineage.includes(d.cardInstanceId)) {
                        hit.defended = true;
                        d.hits.push({ hitIndex: index, outcome: 'reflected', hpReduction: 0 });
                        d.hitCursor++;
                        target.pendingFollowerReflection = { cardInstanceId: d.cardInstanceId, hitIndex: index };
                        return false;
                    }
                    else if (level > technique.effectLevel) {
                        hit.defended = true;
                        outcome = 'blocked';
                    }
                    else {
                        d.defeated = true;
                        if (d.descriptor.revivalLimit === undefined || technique.effectLevel > d.descriptor.revivalLimit)
                            d.revivalForbidden = true;
                        if (level === technique.effectLevel) {
                            hit.defended = true;
                            outcome = 'equal-destroyed';
                        }
                        else {
                            outcome = 'lower-destroyed';
                            if (!technique.followerHpIgnore) {
                                hpReduction = d.descriptor.hp;
                                if (hit.damage !== null)
                                    hit.damage = Math.max(0, hit.damage - hpReduction);
                            }
                        }
                    }
                }
            }
            d.hits.push({ hitIndex: index, outcome, hpReduction });
        }
        summarize(target, d);
    }
    // Never move a source that an interruption already moved elsewhere, or recreate it.
    const player = state.players[target.actorId]!;
    target.followerDestroyed = sources.flatMap(d => d.source==='physical'&&d.defeated&&!moraleFailed(d)?[d.cardInstanceId]:[]);
    for (const d of sources) {
        if (d.source!=='physical'||!d.defeated || d.descriptor.revivalLimit !== undefined && !d.revivalForbidden)
            continue;
        const at = player.followers.findIndex(f => f.cardInstanceId === d.cardInstanceId);
        if (at >= 0) {
            // Failed morale is a discard, not a follower death (G11).
            if (moraleFailed(d)) {
                discardPhysical(state,d.cardInstanceId,{zone:'followers',ownerId:player.id},player.id,reclaimEventId(state,state.actions![group.actionId]!));
                continue;
            }
            const [placed]=player.followers.splice(at,1);
            state.resolution.push(d.cardInstanceId);
            const sourceActorId=placed!.placedById??player.id;
            (target.followerReclaimSources??=[]).push({kind:'ordinary-disposition',fromZone:'resolution',
              sourceId:`${group.id}-${target.actorId}-${d.cardInstanceId}`,eventId:reclaimEventId(state,state.actions![group.actionId]!),
              sourceActorId,heldById:player.id,sourceLifeId:placed!.placedLifeId??lifeIdentity(state.players[sourceActorId]!),
              cardInstanceId:d.cardInstanceId,trigger:'follower-died'});
        }
    }
    target.followersSettled = true;
    return true;
}
