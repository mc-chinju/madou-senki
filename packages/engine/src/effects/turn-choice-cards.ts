import {requirePhysicalAction} from '../combat/action-source.js';
import {getAction} from '@madou/catalog';
import type {GameCommand} from '@madou/protocol';
import {hasPendingFatal,hasStatus,type GameState} from '../state.js';
import type {TransitionResult} from '../commands.js';
import type {ActionFrame} from '../reactions/continuations.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {beginInspection} from '../abilities/private-inspection.js';
import {isActive,replaceAllegiance,factionObjective} from '../lifecycle/objectives.js';
import {enqueueLifecycle} from '../lifecycle/events.js';
import {beginRoll} from '../rolls/advance.js';
import {payTurnCardBatch} from './remaining-turn-cards.js';
import {discardPhysical} from '../discard.js';
type Command=Extract<GameCommand,{type:'PLAY_TURN_CARD';targetId:string}>;
const effects:Record<Command['cardInstanceId'],NonNullable<ActionFrame['printedTurnEffect']>>={
 'a2-p04-r1c1':'conversion-good','a2-p04-r1c2':'conversion-evil','a2-p04-r1c3':'hand-exchange','a2-p04-r2c2':'farseeing','a2-p05-r1c2':'mother-truth'
};
export function turnChoiceCardOptions(s:GameState,actorId:string){
 const p=s.players[actorId];
 if(!p||s.windows?.length||s.phase!=='action'||s.seatOrder[s.turnSeat]!==actorId||!isActive(p)||hasStatus(p,'stopped')||hasPendingFatal(s,actorId))return [];
 return (Object.keys(effects) as Command['cardInstanceId'][]).filter(id=>p.hand.includes(id)).map(id=>({cardInstanceId:id,label:getAction(id)!.name,canUseAstrology:id==='a2-p04-r2c2'&&p.characterId==='c2-p04-r2c1',targetIds:s.seatOrder.filter(targetId=>{
  const t=s.players[targetId]!;if(!isActive(t)||hasPendingFatal(s,targetId))return false;
  if(id==='a2-p04-r1c1'||id==='a2-p04-r1c2')return targetId!==actorId&&t.revealed;
  if(id==='a2-p05-r1c2')return p.characterId!=='c2-p04-r1c2'&&t.revealed&&t.characterId==='c2-p04-r1c2';
  return true;
 })})).filter(o=>o.targetIds.length);
}
export function playTurnChoiceCard(state:GameState,actorId:string,c:Command):TransitionResult {
 const option=turnChoiceCardOptions(state,actorId).find(o=>o.cardInstanceId===c.cardInstanceId);
 if(!option||!option.targetIds.includes(c.targetId)||c.mode==='astrology'&&!option.canUseAstrology)return {ok:false,code:'INVALID_TARGET'};
 const s=structuredClone(state);payTurnCardBatch(s,actorId,[c.cardInstanceId],effects[c.cardInstanceId],[c.targetId]);const a=s.actions![s.windows!.at(-1)!.continuation.id]!;
 a.targetIds=[c.targetId];a.turnCardTargetLifeId=lifeIdentity(s.players[c.targetId]!);a.turnCardAstrology=c.mode==='astrology';s.revision++;return {ok:true,state:s,events:[]};
}
export function resolveTurnChoiceCard(s:GameState,a:ActionFrame,dice:()=>number):boolean {
 requirePhysicalAction(a);
 const p=s.players[a.actorId]!,t=s.players[a.targetIds[0]!]!,effect=a.printedTurnEffect;
 if(!t||!isActive(t)||hasPendingFatal(s,t.id)||lifeIdentity(t)!==a.turnCardTargetLifeId)return true;
 if(effect==='hand-exchange'){[p.hand,t.hand]=[t.hand,p.hand];return true;}
 if(effect==='farseeing'&&!a.turnCardAstrology||effect==='conversion-good'||effect==='conversion-evil'){
  if(!a.turnCardRollId){
   const conversion=effect!=='farseeing',named=effect==='conversion-good'?'c2-p03-r1c2':'c2-p05-r1c1';a.stage='resolve';
   a.turnCardRollId=beginRoll(s,{eventId:a.eventId,rollerId:conversion?t.id:p.id,purpose:conversion?'faction-change':'card-inspection',formula:'2d6',check:{modifier:conversion?(p.characterId===named?-2:-1):0},resume:{kind:'turn-card',actionId:a.id}},dice).id;return false;
  }
  const roll=s.rolls!.find(r=>r.id===a.turnCardRollId)!;if(roll.stage!=='applied')return false;
  if(effect==='farseeing'?!roll.success:roll.success)return true;
 }
 if(effect==='farseeing'){
  if(!a.turnCardInspectionStarted){a.turnCardInspectionStarted=true;beginInspection(s,{eventId:a.eventId,actorId:p.id,targetIds:[t.id],parentWindowId:null,cardActionId:a.id},a.turnCardAstrology?'hand':'character',a.turnCardAstrology?'one':'none');}
  return false;
 }
 const faction=effect==='conversion-evil'?'EVIL':'GOOD';
 if(!replaceAllegiance(t,faction,factionObjective(faction),{characterIds:[faction==='GOOD'?'c2-p03-r1c2':'c2-p05-r2c2']}))return true;
 s.events.push({id:s.nextEventId++,at:0,type:'FACTION_CHANGED',actorId:t.id,audience:'public'});
 if(effect==='mother-truth'){s.resolution.splice(s.resolution.indexOf(a.cardInstanceId),1);t.attachments.push(a.cardInstanceId);}
 enqueueLifecycle(s,{kind:'protection',id:`${a.id}-protection`,includeNewDefeats:true,rootEventIds:[a.eventId]});return true;
}
/** The printed attachment expires on faction change; its removal never undoes allegiance. */
export function cleanMotherTruth(s:GameState):void {
 for(const p of Object.values(s.players))if(p.faction!=='GOOD'&&p.attachments.includes('a2-p05-r1c2'))discardPhysical(s,'a2-p05-r1c2',{zone:'attachments',ownerId:p.id},p.id,s.windows?.at(-1)?.eventId??`mother-expiry-${s.nextEventId++}`);
}
