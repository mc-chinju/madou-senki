import {printedTechniqueAllowed} from './printed-restrictions.js';
import {shadowJumpGrantLive} from '../abilities/shadow-jump.js';
import {conditionalSourcePreview,type ConditionalTargetValue} from '../abilities/conditional-preview.js';
import {conditionalTechniqueAdditions} from '../abilities/conditional-stats.js';
import {gameStats} from '../game-stats.js';
import {availableDeclarationEffects} from '../abilities/declaration-effects.js';
import {applyDeclarationEffects,type DeclarationEffects} from '../abilities/declaration-effects.js';
import {currentEffectiveTechnique} from '../abilities/follower-entry.js';
import {canSelectFollowerAttack} from '../effects/follower-attacks.js';
import { getCharacter } from '@madou/catalog';
import type { CoSourceChoice, TechniqueVariant } from '@madou/protocol';
import type { EngineErrorCode } from '../commands.js';
import type { GameState } from '../state.js';
import { hasStatus } from '../state.js';
import { isActive } from '../lifecycle/objectives.js';
import { techniqueFor } from '../effects/registry.js';
import { canSelectPrintedDedicated, canSelectPrintedVariant } from '../effects/techniques.js';
import type { ActionFrame, AttackGroup, Technique } from '../reactions/continuations.js';
import { advanceCards, coSourceFor, composeTechnique } from './combination.js';
import { defenseLegality } from './defense.js';
export interface AdditionalAttackOption {
    cardInstanceId: string;
    dedicated: boolean;
    declarationAbilityIds?: string[];
    techniqueVariant?: TechniqueVariant;
    coSource?: CoSourceChoice;
}
type SelectionContext = {
    kind: 'attack';
    targetIds: string[];
    advanceCardInstanceIds?: string[];
} | {
    kind: 'defense' | 'group-defense';
    group: AttackGroup;
} | {
    kind: 'selection' | 'turn-technique';
} | {
    kind:'candidate'; group?:AttackGroup;
};
type SelectionResult = {
    ok: true;
    technique: Technique;
    declarationBase?:Technique;
    declarationEffects?:DeclarationEffects[];
    coSource?: NonNullable<ActionFrame['coSource']>;
    fromHand: boolean;
    fromChant: boolean;
    fromFollowers:boolean;
} | {
    ok: false;
    code: EngineErrorCode;
};
/** Legacy supported printed packages share the same eligibility as the newer registry. */
export function canSelectDedicated(id: string, name: string | undefined): boolean {
    if (canSelectFollowerAttack(id,name)||canSelectPrintedDedicated(id, name))
        return true;
    if (id === 'a2-p10-r1c3')
        return name === '侍大将のシン';
    if (id === 'a2-p08-r2c3')
        return name === '忍びのイダ';
    if (id === 'a2-p10-r3c3')
        return name === '早駆けのランカスター';
    if (id === 'a2-p11-r1c3')
        return name === '聖騎士ランスロット' || name === '聖騎士ランスロット2';
    return false;
}
/** Pure shared source/target validation. No costs, rolls, events, or state mutations. */
export function resolveTechniqueSelection(state: GameState, actorId: string, choice: AdditionalAttackOption, context: SelectionContext): SelectionResult {
    const reject = (code: EngineErrorCode): SelectionResult => ({ ok: false, code });
    const player = state.players[actorId];
    if (!player)
        return reject('UNKNOWN_ACTOR');
    if (state.outcome)
        return reject('GAME_COMPLETE');
    if (!isActive(player))
        return reject('INACTIVE_ACTOR');
    if (hasStatus(player, 'stopped'))
        return reject('STOPPED');
    const fromHand = player.hand.includes(choice.cardInstanceId);
    const fromChant = player.chants.some(card => card.cardInstanceId === choice.cardInstanceId);
    const fromFollowers=player.followers.some(card=>card.cardInstanceId===choice.cardInstanceId);
    if (!fromHand && !fromChant && !fromFollowers)
        return reject('CARD_NOT_IN_HAND');
    const character = getCharacter(player.characterId);
    const name = character?.name;
    if (!canSelectPrintedVariant(choice.cardInstanceId, name, choice.dedicated, choice.techniqueVariant))
        return reject('UNSUPPORTED_CARD');
    if (choice.dedicated && !canSelectDedicated(choice.cardInstanceId, name))
        return reject('UNSUPPORTED_CARD');
    let technique = techniqueFor(choice.cardInstanceId, name, choice.dedicated, choice.techniqueVariant);
    if(fromFollowers&&(!canSelectFollowerAttack(choice.cardInstanceId,name)||!choice.dedicated)||fromChant&&canSelectFollowerAttack(choice.cardInstanceId,name))return reject('UNSUPPORTED_CARD');
    if (!technique)
        return reject('UNSUPPORTED_CARD');
    let coSource: ActionFrame['coSource'];
    if (choice.coSource) {
        coSource = coSourceFor(state, actorId, choice.coSource, !!choice.declarationAbilityIds?.length || context.kind==='candidate');
        if (!technique.combinable || !coSource || choice.coSource.cardInstanceId === choice.cardInstanceId)
            return reject('UNSUPPORTED_CARD');
        technique = composeTechnique(technique, coSource.technique);
    }
    if (context.kind === 'attack' && context.advanceCardInstanceIds !== undefined) {
        const advances = context.advanceCardInstanceIds;
        const pool = advanceCards(state, actorId);
        if (!technique.advanceEffectCost || new Set(advances).size !== advances.length || advances.some(id => id === choice.cardInstanceId || id === coSource?.cardInstanceId || !pool.includes(id)))
            return reject('UNSUPPORTED_CARD');
        technique.effectLevel += advances.length;
    }
    if(technique.useLevelSource==='own-warrior'){technique.useLevel=gameStats(state,player.id).warrior_level;technique.effectLevel=technique.useLevel;}
    if (technique.useLevelSource === 'own-spirit') {
        technique.useLevel = gameStats(state,player.id,{provenance:'group' in context&&context.group?{kind:'combat',attackerId:actorId,targetIds:[context.group.attackerId]}:context.kind==='attack'?{kind:'combat',attackerId:actorId,targetIds:context.targetIds}:{kind:'none'}}).spirit;
        technique.effectLevel = technique.useLevel;
    }
    if (!printedTechniqueAllowed(player,technique))
        return reject('UNSUPPORTED_CARD');
    if (technique.school === 'magic' && hasStatus(player, 'silenced'))
        return reject('SILENCED');
    if (technique.useLevelSource === 'incoming-effect') {
        if (!('group' in context) || !context.group)
            return reject('ILLEGAL_DEFENSE');
        if (technique.defense === 'parry' ? currentEffectiveTechnique(state,context.group,actorId).school !== 'warrior' : currentEffectiveTechnique(state,context.group,actorId).school !== 'magic')
            return reject('ILLEGAL_DEFENSE');
        technique.useLevel = currentEffectiveTechnique(state,context.group,actorId).effectLevel;
        technique.effectLevel = currentEffectiveTechnique(state,context.group,actorId).effectLevel;
    }
    const declarationBase=structuredClone(technique);
    const ids=choice.declarationAbilityIds??[];
    const options=availableDeclarationEffects(state,actorId,technique,context.kind==='selection'||context.kind==='candidate'?'attack':context.kind,coSource?.fromChant??fromChant);
    if(ids.length>13||new Set(ids).size!==ids.length||ids.some(id=>!options.some(o=>o.abilityId===id)))return reject('ABILITY_DISABLED');
    const effects=options.filter(o=>ids.includes(o.abilityId)).map(o=>o.effects);
    technique=applyDeclarationEffects(technique,effects,true);
    if(context.kind!=='candidate'&&technique.chant&&!(coSource?.fromChant??fromChant))return reject('CHANT_REQUIRED');
    if (context.kind !== 'turn-technique' && context.kind !== 'candidate' && technique.turnEffect)
        return reject('UNSUPPORTED_CARD');
    if (context.kind === 'attack') {
        const ids = context.targetIds;
        if (!ids.length || new Set(ids).size !== ids.length || ids.length > 10 ||
            technique.target === 'one' && technique.maxTargets === undefined && ids.length !== 1 ||
            technique.target === 'one' && technique.maxTargets !== undefined && ids.length > technique.maxTargets ||
            ids.some(id => !Object.hasOwn(state.players, id) || id === actorId || !isActive(state.players[id]!) || state.players[id]!.revealed && state.players[id]!.faction === player.faction))
            return reject('INVALID_TARGET');
        if(technique.mandatoryAll){const legal=legalAttackTargets(state,actorId,technique);if(ids.length!==legal.length||legal.some(id=>!ids.includes(id)))return reject('INVALID_TARGET');}
        if (technique.range === 'none' || ids.some(id => technique.range === 'near' && state.distances[actorId]![id] !== 'near'))
            return reject('OUT_OF_RANGE');
    }
    const conditionalEffect = context.kind==='defense'?conditionalTechniqueAdditions(state,{actorId,kind:'defense',technique,canceled:false},context.group.attackerId).effect:0;
    if(conditionalEffect)technique.effectLevel+=conditionalEffect;
    if (context.kind === 'defense') {
        const error = defenseLegality(state,technique, context.group, actorId, choice.cardInstanceId);
        if (error)
            return reject(error);
    }
    return { ok: true, technique, ...(ids.length||conditionalEffect?{declarationBase,declarationEffects:effects}:{}), fromHand, fromChant, fromFollowers, ...(coSource ? { coSource } : {}) };
}
/** An actual saved grant, not merely a matching window label. */
export function additionalAttackTarget(state: GameState, actorId: string): string | undefined {
    const window = state.windows?.at(-1);
    if (!window || window.kind !== 'ability-attack' || window.participants[window.cursor] !== actorId)
        return;
    if (window.continuation.kind === 'action') {
        const source = state.actions?.[window.continuation.id];
        if (source?.printedGrant?.actorId === actorId && source.printedGrant.stage === 'choice')
            return source.printedGrant.targetId;
    }
    if (window.continuation.kind === 'ability') {
        const source = state.abilities?.[window.continuation.id];
        if (source?.actorId === actorId && source.stage === 'attack-choice' && (!source.shadowJump||shadowJumpGrantLive(state,source)))
            return source.targetIds[0];
    }
}
const VARIANTS: TechniqueVariant[] = ['one-hit', 'two-hit', 'lancelot-1', 'lancelot-2'];
export function heldSelections(state: GameState, actorId: string): CoSourceChoice[] {
    const player = state.players[actorId]!;
    const name = getCharacter(player.characterId)?.name;
    const ids = [...player.hand, ...player.chants.map(card => card.cardInstanceId),...player.followers.map(card=>card.cardInstanceId)];
    return ids.flatMap(cardInstanceId => [false, true].flatMap(dedicated => {
        if (dedicated && !canSelectDedicated(cardInstanceId, name))
            return [];
        const choices: CoSourceChoice[] = [{ cardInstanceId, dedicated }];
        for (const variant of VARIANTS)
            if (canSelectPrintedVariant(cardInstanceId, name, dedicated, variant))
                choices.push({ cardInstanceId, dedicated, techniqueVariant: variant });
        return choices;
    }));
}
export function additionalAttackOptions(state: GameState, actorId: string): AdditionalAttackOption[] {
    const targetId = additionalAttackTarget(state, actorId);
    if (!targetId)
        return [];
    const selections = heldSelections(state, actorId);
    const context = { kind: 'attack' as const, targetIds: [targetId] };
    const result: AdditionalAttackOption[] = [];
    for (const selection of selections) {
        const resolved = resolveTechniqueSelection(state, actorId, selection, context);
        if (!resolved.ok)
            continue;
        result.push({ ...selection });
        if (!resolved.technique.combinable)
            continue;
        for (const coSource of selections) {
            const candidate = { ...selection, coSource: { ...coSource } };
            if (resolveTechniqueSelection(state, actorId, candidate, context).ok)
                result.push(candidate);
        }
    }
    return result;
}
/** Publicly known defense restrictions and private source validation use the command path. */
export function sourceChoices(state: GameState, actorId: string) {
    const player = state.players[actorId]!;
    const window = state.windows?.at(-1);
    const incoming = window?.kind === 'normal-defense' && window.continuation.kind === 'group' ? state.groups?.[window.continuation.id] : undefined;
    const grantTarget = additionalAttackTarget(state, actorId);
    const hasPriority = window?.participants[window.cursor] === actorId;
    const canAct = !hasStatus(player, 'stopped') && isActive(player) && !state.outcome && (!window && state.phase === 'action' && state.seatOrder[state.turnSeat] === actorId || hasPriority && (!!incoming || !!grantTarget));
    const ids = [...player.hand, ...player.chants.map(card => card.cardInstanceId),...player.followers.map(card=>card.cardInstanceId)];
    const combinationOptions: {
        cardInstanceId: string;
        coSources: CoSourceChoice[];
    }[] = [];
    if (canAct && getCharacter(player.characterId)?.name === '獣使いのウパニシャット' && ids.includes('a2-p09-r1c1')) {
        const context: SelectionContext = incoming ? { kind: 'defense', group: incoming } : grantTarget ? { kind: 'attack', targetIds: [grantTarget] } : { kind: 'selection' };
        const coSources = heldSelections(state, actorId).filter(coSource => resolveTechniqueSelection(state, actorId, { cardInstanceId: 'a2-p09-r1c1', dedicated: true, coSource }, context).ok);
        if (coSources.length)
            combinationOptions.push({ cardInstanceId: 'a2-p09-r1c1', coSources });
    }
    const advanceCostOptions = canAct && !incoming && getCharacter(player.characterId)?.name === '黒騎士ガーウィン' && ids.includes('a2-p09-r2c1')
        ? [{ cardInstanceId: 'a2-p09-r2c1', advanceCardInstanceIds: advanceCards(state, actorId) }] : [];
    return { combinationOptions, advanceCostOptions };
}

export interface FollowerAttackOption {
 targetValues?:ConditionalTargetValue[];
 cardInstanceId:string;dedicated:true;sourceZone:'hand'|'followers';targetMode:'one'|'selected-all'|'mandatory-all';legalTargetIds:string[];
 range:'near'|'far';school:'warrior'|'magic';attributes:string[];useLevel:number|string;effectLevel:number|string;damage:number|string;hitCount:number;noChecks:boolean;
}
export function legalAttackTargets(state:GameState,actorId:string,t:Technique):string[]{
 const p=state.players[actorId]!;
 return state.seatOrder.filter(id=>id!==actorId&&isActive(state.players[id]!)&&!(state.players[id]!.revealed&&state.players[id]!.faction===p.faction)&&t.range!=='none'&&(t.range==='far'||state.distances[actorId]?.[id]==='near'));
}
export function followerAttackOptions(state:GameState,actorId:string):FollowerAttackOption[]{
 const p=state.players[actorId]!;const grant=additionalAttackTarget(state,actorId);
 if(!grant&&(state.windows?.length||state.phase!=='action'||state.seatOrder[state.turnSeat]!==actorId))return [];
 const result:FollowerAttackOption[]=[];
 for(const id of [...p.hand,...p.followers.map(f=>f.cardInstanceId)]){
  if(!canSelectFollowerAttack(id,getCharacter(p.characterId)?.name))continue;
  const choice={cardInstanceId:id,dedicated:true};const selected=resolveTechniqueSelection(state,actorId,choice,{kind:'selection'});if(!selected.ok)continue;
  const t=selected.technique;const normal=legalAttackTargets(state,actorId,t);const ids=grant?[grant]:normal;
  if(!ids.length||!resolveTechniqueSelection(state,actorId,choice,{kind:'attack',targetIds:t.mandatoryAll?ids:t.target==='one'?[ids[0]!]:ids}).ok)continue;
  result.push({cardInstanceId:id,dedicated:true,sourceZone:selected.fromFollowers?'followers':'hand',targetMode:t.mandatoryAll?'mandatory-all':t.target==='all'?'selected-all':'one',legalTargetIds:ids,range:t.range as 'near'|'far',school:t.school,attributes:[...t.attributes],useLevel:t.effectLevelFormula?'3+1d6':t.useLevel,...conditionalSourcePreview(state,actorId,t,ids),hitCount:t.hitCount as number,noChecks:t.noChecks});
 }
 return result;
}
