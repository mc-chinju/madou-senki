import {recordAbility} from '../public-record.js';
import type {GameState} from '../state.js';
import {canUseCharacterAbility, hasPendingFatal} from '../state.js';
import type {GameInput, TransitionResult} from '../commands.js';
import {isActive} from '../lifecycle/objectives.js';
import {openWindow, participants} from '../reactions/windows.js';
import {beginRoll} from '../rolls/advance.js';
import type {AbilityFrame, AbilityOption} from './frames.js';
import {ownsAbility} from './ownership.js';
import {publicAbilityOpportunity} from './conditional-selection.js';
import {VANMIL_BAN, LIA_BLESSING, SUPPRESSION_ABILITIES, isSuppressionAbility, lifeIdentity, publicSuppressionTargets} from './suppression-state.js';

function usable(s:GameState, actorId:string, abilityId:string):boolean {
  const p=s.players[actorId];
  return !!p && !s.outcome && isActive(p) && !hasPendingFatal(s,actorId)
    && canUseCharacterAbility(p,s) && ownsAbility(p,abilityId);
}
function attempt(s:GameState, actorId:string, id:string, opportunity:string):string {
  return id===LIA_BLESSING?`own-turn-${s.turnNumber??0}:${actorId}:${id}`:`${opportunity}:${actorId}:${id}`;
}
export function suppressionOptions(s:GameState, actorId:string):AbilityOption[] {
  const opportunity=publicAbilityOpportunity(s,actorId);
  if(!opportunity || !s.windows?.length && s.seatOrder[s.turnSeat]!==actorId) return [];
  return ([VANMIL_BAN,LIA_BLESSING] as const).flatMap(abilityId=>{
    if(!usable(s,actorId,abilityId) || s.used?.includes(attempt(s,actorId,abilityId,opportunity)))return [];
    if(abilityId===LIA_BLESSING && s.seatOrder[s.turnSeat]!==actorId)return [];
    const targetIds=publicSuppressionTargets(s).filter(id=>abilityId===VANMIL_BAN
      || s.suppressionDesignations?.some(d=>d.targetId===id));
    if(!targetIds.length)return [];
    if(abilityId===VANMIL_BAN && targetIds.every(id=>s.suppressionDesignations?.some(d=>d.sourceActorId===actorId && d.targetId===id)))return [];
    return [{abilityId, name:SUPPRESSION_ABILITIES[abilityId].name, targetEventId:opportunity, targetIds,
      ...(abilityId===LIA_BLESSING?{actionCost:'extra' as const}:{}),
      description:abilityId===VANMIL_BAN?'公開の回答順か、自分の手番の安定した場面で一度だけ試せます。通常行動は使いません。':'精神力−5の判定に成功すると、選んだ相手へのヴァンミール由来の禁止を解除します。'}];
  });
}
export function transitionSuppression(s:GameState, input:GameInput):TransitionResult|undefined {
  const c=input.command;
  if(c.type!=='USE_ABILITY' || !isSuppressionAbility(c.abilityId))return;
  const option=suppressionOptions(s,input.actorId).find(o=>o.abilityId===c.abilityId);
  if(!option)return {ok:false,code:'ABILITY_DISABLED'};
  if(c.targetEventId!==option.targetEventId)return {ok:false,code:'INVALID_TARGET'};
  const chosen=c.abilityId===VANMIL_BAN?c.targetIds!:[c.targetId!];
  if(chosen.some(id=>!option.targetIds?.includes(id)))return {ok:false,code:'INVALID_TARGET'};
  if(c.abilityId===VANMIL_BAN && chosen.every(id=>s.suppressionDesignations?.some(d=>d.sourceActorId===input.actorId && d.targetId===id)))return {ok:false,code:'INVALID_COMMAND'};
  const next=structuredClone(s), p=next.players[input.actorId]!, w=next.windows?.at(-1);
  const frame:AbilityFrame={source:'ability', id:`ability-${next.nextEventId++}`, abilityId:c.abilityId,
    actorId:p.id, targetIds:[...chosen].sort(), eventId:option.targetEventId, parentWindowId:w?.id??null,
    useOrdinal:1, costs:{ownAction:false}, stage:'declaration', canceled:false, rollIds:[],
    context:{kind:'suppression',sourceCharacterId:p.characterId,sourceLifeId:lifeIdentity(p),opportunityId:option.targetEventId}};
  (next.abilities??={})[frame.id]=frame;recordAbility(next,'ABILITY_DECLARED',frame.actorId,frame.abilityId,frame.targetIds.filter(id=>id!==frame.actorId));
  (next.used??=[]).push(attempt(next,p.id,c.abilityId,option.targetEventId));
  openWindow(next,'declaration',frame.eventId,{kind:'ability',id:frame.id},w?participants(next,(next.seatOrder.indexOf(p.id)+1)%next.seatOrder.length):participants(next));
  next.revision++;return {ok:true,state:next,events:[]};
}
export function resolveSuppression(s:GameState, frame:AbilityFrame, dice:()=>number):boolean {
  if(frame.context.kind!=='suppression')throw Error('INVALID_SUPPRESSION_CONTEXT');
  const p=s.players[frame.actorId]!;
  if(frame.canceled || !usable(s,p.id,frame.abilityId) || p.characterId!==frame.context.sourceCharacterId
    || lifeIdentity(p)!==frame.context.sourceLifeId)return true;
  if(frame.abilityId===VANMIL_BAN){
    for(const targetId of frame.targetIds){
      if(!s.suppressionDesignations?.some(d=>d.sourceActorId===p.id && d.targetId===targetId))
        (s.suppressionDesignations??=[]).push({id:`${frame.id}:${targetId}`,sourceActorId:p.id,
          sourceCharacterId:p.characterId,sourceAbilityId:VANMIL_BAN,targetId,eventId:frame.eventId});
    }
    return true;
  }
  if(frame.stage==='declaration'){
    frame.stage='self-check';
    const roll=beginRoll(s,{eventId:frame.eventId,rollerId:p.id,purpose:'ability-check',formula:'2d6',
      check:{modifier:-5},resume:{kind:'ability',abilityId:frame.id}},dice);
    frame.rollIds.push(roll.id);return false;
  }
  if(s.rolls?.find(r=>r.id===frame.rollIds.at(-1))?.success)
    (s.blessingLeases??=[]).push({id:frame.id,sourceActorId:p.id,sourceCharacterId:'c2-p03-r1c2',
      sourceLifeId:frame.context.sourceLifeId,targetId:frame.targetIds[0]!,eventId:frame.eventId});
  return true;
}
