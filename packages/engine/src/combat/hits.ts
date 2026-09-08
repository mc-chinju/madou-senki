import {commitMentalStopPrevention} from '../abilities/mental-protection.js';
import {hasPendingFatal} from '../state.js';
import {MAGIC_HALF} from '../abilities/received-defense.js';
import {activeAbilitySource} from '../abilities/follower-entry.js';
import {openWindow} from '../reactions/windows.js';
import {prepareHitAbilityWindow} from '../abilities/advance.js';
import {prepareLifetimeHit} from './lifetime.js';
import { beginRoll } from '../rolls/advance.js';
import type { GameState } from '../state.js';
import type { AttackTarget } from '../reactions/continuations.js';
import type { Technique } from '../reactions/continuations.js';
import { appendEvent } from '../setup.js';
import { getCharacter } from '@madou/catalog';
export function applyHits(state:GameState,target:AttackTarget,technique:Technique,sourceId:string,now:number,roll:()=>number):boolean{
  if(target.hitsApplied)return true;
  const player=state.players[target.actorId]!;
  const personallyImmune=technique.personalImmunityCharacterNames?.includes(getCharacter(player.characterId)?.name??'')??false;
  const reached=target.hits.some(hit=>!hit.defended);
  if(personallyImmune||!reached){target.hitsApplied=true;return true;}
  if(!player.revealed){player.revealed=true;appendEvent(state,now,{type:'CHARACTER_REVEALED',actorId:player.id,audience:'public',characterId:player.characterId});}
  const group=state.groups![sourceId]!;
  if(technique.postHitAdvances&&!group.postHitAdvancePaid&&hasPendingFatal(state,group.attackerId)){group.postHitAdvancePaid=true;group.postHitAdvanceAmount=0;}
  if(technique.postHitAdvances&&!group.postHitAdvancePaid){openWindow(state,'hit-advance-choice',group.actionId,{kind:'group',id:sourceId,targetId:target.actorId},[group.attackerId]);return false;}
  if(!prepareHitAbilityWindow(state,sourceId,target))return false;
  const resistance=technique.onHitResistance??(technique.onHitStatus?{modifiers:technique.onHitStatus.modifiers,statusKind:technique.onHitStatus.kind}:undefined);
  if(resistance){
    const targetName=getCharacter(player.characterId)?.name??'';
    const modifiers=resistance.targetOverrides?.find(entry=>entry.characterNames.includes(targetName))?.modifiers??resistance.modifiers;
    const frame=state.rolls?.find(frame=>frame.id===target.resistanceRollId);
    if(!frame){target.resistanceRollId=beginRoll(state,{eventId:state.actions![state.groups![sourceId]!.actionId]!.eventId,rollerId:player.id,purpose:'status-resistance',formula:'2d6',check:{modifier:modifiers[0]!},resume:{kind:'hit',groupId:sourceId,targetId:player.id}},roll).id;return false;}
    if(frame.stage!=='applied')return false;
    if(!frame.success){
      target.resistanceDamage=resistance.failureDamage??0;
      if(resistance.statusKind&&!(resistance.statusKind==='stopped'&&commitMentalStopPrevention(state,group,target))){
        const action=state.actions![state.groups![sourceId]!.actionId]!;
        const id=`${sourceId}:${target.actorId}:${resistance.statusKind}`;
        if(!player.statuses?.some(status=>status.id===id))(player.statuses??=[]).push({id,kind:resistance.statusKind,modifiers:[...modifiers],nextCheck:1,sourceActorId:action.actorId,sourceCardInstanceId:action.effectSourceCardInstanceId??action.cardInstanceId,targetId:player.id});
      }
    }
  }
  if(!target.techniqueHitApplied){
    const sourceAction=state.actions![group.actionId]!;
    if(technique.dragonKingHit){
      let saved=state.rolls?.find(r=>r.id===target.dragonResistanceRollId);
      if(!saved){saved=beginRoll(state,{eventId:sourceAction.eventId,rollerId:player.id,purpose:'hit-resistance',formula:'2d6',check:{modifier:0,base:'fixed',threshold:6},resume:{kind:'hit',groupId:sourceId,targetId:player.id}},roll);target.dragonResistanceRollId=saved.id;return false;}
      if(saved.stage!=='applied')return false;
      player.skipTurns=1;
      if(!saved.success)for(const hit of target.hits)if(!hit.defended&&hit.damage!==null){hit.damage*=3;hit.damageMultiplier=(hit.damageMultiplier??1)*3;}
    }
    if(technique.deathSongResistance&&getCharacter(player.characterId)?.name==='不死王ガドューラ'){
      let saved=state.rolls?.find(r=>r.id===target.deathSongRollId);
      if(!saved){saved=beginRoll(state,{eventId:sourceAction.eventId,rollerId:player.id,purpose:'hit-resistance',formula:'2d6',check:{modifier:0},resume:{kind:'hit',groupId:sourceId,targetId:player.id}},roll);target.deathSongRollId=saved.id;return false;}
      if(saved.stage!=='applied')return false;
      if(saved.success)for(const hit of target.hits)if(!hit.defended&&hit.damage!==null)hit.damage=0;
    }
    target.techniqueHitApplied=true;
  }
  if(!prepareLifetimeHit(state,state.groups![sourceId]!,target,roll))return false;
  // The existing resistance runs once per source/target. Attribute its independent
  // damage to a reached hit of that source, never an unrelated mixed warrior hit.
  const resistanceHit=target.hits.find(hit=>!hit.defended&&(!hit.sourceActionId||hit.sourceActionId===group.actionId));
  target.pendingDamage=0;
  for(const hit of target.hits)if(!hit.defended){
    hit.hit=true;
    const extra=hit===resistanceHit?(target.resistanceDamage??0):0;
    const half=(hit.technique??technique).school==='magic'&&hit.receivedDefense?.reserved.includes(MAGIC_HALF)&&activeAbilitySource(state,target.actorId,MAGIC_HALF);
    const total=half?Math.floor(((hit.damage??0)+extra)/2):(hit.damage??0)+extra;
    const directDamage=hit.damage===null?null:half?Math.floor(hit.damage/2):hit.damage;
    hit.bodyDamage={directDamage,resistanceDamage:total-(directDamage??0),total};
    target.pendingDamage+=total;
  }
  target.hitsApplied=true;return true;
}
