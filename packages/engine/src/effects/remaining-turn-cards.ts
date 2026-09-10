import {requirePhysicalAction} from '../combat/action-source.js';
import {beginWish} from './wish.js';
import {resolveTurnChoiceCard} from './turn-choice-cards.js';
import {FAIRY_SWORD} from '../discard.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {hasStatus,hasPendingFatal,type GameState} from '../state.js';
import type {TransitionResult} from '../commands.js';
import {openWindow,participants} from '../reactions/windows.js';
import {techniqueFor} from './registry.js';
import type {ActionFrame} from '../reactions/continuations.js';
import {beginRoll} from '../rolls/advance.js';
import {getAction} from '@madou/catalog';
import {enqueueLifecycle} from '../lifecycle/events.js';
import type {GameCommand} from '@madou/protocol';
type SingleTurnCommand=Exclude<Extract<GameCommand,{type:'PLAY_TURN_CARD';cardInstanceId:string}>,{targetId:string}|{mode:'wish'}>;
type TurnCardId=SingleTurnCommand['cardInstanceId'];
const effects:Record<TurnCardId,TurnEffect>={'a2-p03-r1c1':'secret-book','a2-p03-r1c2':'attachment','a2-p03-r1c3':'attachment','a2-p03-r2c2':'training-warrior','a2-p03-r2c3':'training-magic','a2-p04-r2c1':'fairy-sword'};
type TurnEffect=NonNullable<ActionFrame['printedTurnEffect']>;
function beginTurnCard(s:GameState,actorId:string,ids:string[],effect:TurnEffect,eventId?:string,lifeId=lifeIdentity(s.players[actorId]!)):void {
  const id=`a-${s.nextEventId++}`,cardInstanceId=ids[0]!;
  (s.actions??={})[id]={id,eventId:eventId??id,parentWindowId:null,actorId,cardInstanceId,kind:'turn-card',printedTurnEffect:effect,
    turnCardRemainingIds:ids.slice(1),reclaimOwnerLifeId:lifeId,targetIds:[],technique:techniqueFor('a2-p05-r3c1')!,
    groupId:null,stage:'declaration',checks:[],roll:null,canceled:false};
  s.phase='combat';openWindow(s,'declaration',eventId??id,{kind:'action',id},participants(s));
}
/** The accepted whole batch is paid once; each physical source has its own declaration. */
export function payTurnCardBatch(s:GameState,actorId:string,ids:string[],effect:TurnEffect):void {
  const p=s.players[actorId]!;
  for(const id of ids){p.hand.splice(p.hand.indexOf(id),1);s.resolution.push(id);}
  beginTurnCard(s,actorId,ids,effect);
}
export function finishTurnCardBatch(s:GameState,a:ActionFrame):void {
  if(a.turnCardRemainingIds?.length)beginTurnCard(s,a.actorId,a.turnCardRemainingIds,a.printedTurnEffect!,a.eventId,a.reclaimOwnerLifeId);
  else s.phase=a.printedTurnEffect==='secret-book'?'action':'hand-adjustment';
}
/** Returns only after this source's effect or cancellation has settled. */
export function resolveTurnCard(s:GameState,a:ActionFrame,dice:()=>number):boolean {
 requirePhysicalAction(a);
  const p=s.players[a.actorId]!,at=s.resolution.indexOf(a.cardInstanceId),effect=a.printedTurnEffect;
  if(a.canceled||(p.presence??'active')!=='active'||hasPendingFatal(s,p.id)||lifeIdentity(p)!==a.reclaimOwnerLifeId||at<0)return true;
  if(effect==='wish'){beginWish(s,a);return false;}
  if(effect==='conversion-good'||effect==='conversion-evil'||effect==='hand-exchange'||effect==='farseeing'||effect==='mother-truth')return resolveTurnChoiceCard(s,a,dice);
  if(effect==='secret-book'){
    if(!a.turnCardRollId){a.stage='resolve';a.turnCardRollId=beginRoll(s,{eventId:a.eventId,rollerId:p.id,purpose:'extra-draw',formula:'d6',resume:{kind:'turn-card',actionId:a.id}},dice).id;return false;}
    const roll=s.rolls!.find(r=>r.id===a.turnCardRollId)!;if(roll.stage!=='applied')return false;
    if(!a.turnCardDrawStarted){a.turnCardDrawStarted=true;enqueueLifecycle(s,
      {kind:'turn-card-resume',id:`${a.id}-draw-end`,actionId:a.id,rootEventIds:[a.eventId]},
      {kind:'draw',id:`${a.id}-draw`,actorId:p.id,target:p.hand.length+roll.total!,rootEventIds:[a.eventId]});}
    return false;
  }else if(effect==='training-warrior'||effect==='training-magic'){
    if(!a.turnCardDedicated){
      if(!a.turnCardRollId){a.stage='resolve';a.turnCardRollId=beginRoll(s,{eventId:a.eventId,rollerId:p.id,purpose:'training',formula:'2d6',check:{modifier:0,base:effect==='training-warrior'?'warrior':'magic',comparison:'greater-than'},resume:{kind:'turn-card',actionId:a.id}},dice).id;return false;}
      const roll=s.rolls!.find(r=>r.id===a.turnCardRollId)!;if(roll.stage!=='applied')return false;if(!roll.success)return true;
    }
    s.resolution.splice(at,1);p.attachments.push(a.cardInstanceId);
  }else if(effect==='potion'){
    if(!a.turnCardRollId){a.stage='resolve';const roll=beginRoll(s,{eventId:a.eventId,rollerId:p.id,purpose:'potion-recovery',formula:'d6',resume:{kind:'turn-card',actionId:a.id}},dice);a.turnCardRollId=roll.id;return false;}
    const roll=s.rolls!.find(r=>r.id===a.turnCardRollId)!;if(roll.stage!=='applied')return false;
    p.damage=Math.max(0,p.damage-roll.total!);
  }else if(effect==='rest')p.damage=Math.max(0,p.damage-1);
  else if(effect==='fairy-sword'||effect==='attachment'){
    const name=getAction(a.cardInstanceId)?.name;
    if(effect==='fairy-sword'&&p.characterId!=='c2-p01-r2c2'||name==='悪の魅力'&&p.faction!=='EVIL'||name==='聖光'&&p.faction!=='GOOD')return true;
    s.resolution.splice(at,1);p.attachments.push(a.cardInstanceId);
  }
  return true;
}
export function turnCardOptions(s:GameState,actorId:string){
  const p=s.players[actorId];
  if(!p||s.windows?.length||s.phase!=='action'||s.seatOrder[s.turnSeat]!==actorId||(p.presence??'active')!=='active'||hasStatus(p,'stopped')||hasPendingFatal(s,actorId))return [];
  return (Object.keys(effects) as TurnCardId[]).filter(id=>p.hand.includes(id)&&(id!==FAIRY_SWORD||p.characterId==='c2-p01-r2c2')&&(id!=='a2-p03-r1c1'||s.earlyTurnBook?.actorId===actorId&&!s.earlyTurnBook.closed)).map(id=>({cardInstanceId:id,label:`${getAction(id)!.name}${id===FAIRY_SWORD?'を設置する':'を使う'}`,canUseDedicated:(id==='a2-p03-r2c2'||id==='a2-p03-r2c3')&&['c2-p02-r2c2','c2-p07-r1c1'].includes(p.characterId)}));
}
export function playRemainingTurnCard(state:GameState,actorId:string,cardInstanceId:TurnCardId,mode:SingleTurnCommand['mode']='ordinary'):TransitionResult {
  const option=turnCardOptions(state,actorId).find(o=>o.cardInstanceId===cardInstanceId);
  if(!option||mode==='dedicated'&&!option.canUseDedicated)return {ok:false,code:'UNSUPPORTED_CARD'};
  const s=structuredClone(state);payTurnCardBatch(s,actorId,[cardInstanceId],effects[cardInstanceId]);
  const a=s.actions![s.windows!.at(-1)!.continuation.id]!;a.turnCardDedicated=mode==='dedicated';s.revision++;
  return {ok:true,state:s,events:[]};
}
