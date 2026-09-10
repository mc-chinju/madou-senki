import {discardPlayerCards} from '../discard.js';
import {getCharacter} from '@madou/catalog';
import {canUseCharacterAbility,hasStatus,type GameState} from '../state.js';
import type {GameInput,TransitionResult,EngineErrorCode} from '../commands.js';
import {appendEvent} from '../setup.js';
import {openWindow,participants,resetParent} from '../reactions/windows.js';
import type {ActionFrame} from '../reactions/continuations.js';
import {techniqueFor} from '../effects/registry.js';
import {clearDistances,scheduleBoundary} from './advance.js';
import {isActive,factionObjective,initialProtection,replaceAllegiance} from './objectives.js';
import type {LifecycleAbility} from './types.js';
/** A17/A18 exclude the entire owning death batch, even after nested revival. */
export function eligibleGiftRecipients(s:GameState,batchId:string,actorId:string):string[]{
 const batch=s.lifecycle?.find(task=>task.id===batchId&&task.kind==='death-batch');
 if(!batch||batch.kind!=='death-batch')return [];
 return s.seatOrder.filter(id=>id!==actorId&&!batch.actorIds.includes(id)&&isActive(s.players[id]!));
}
export function availableLifecycleAbilities(s:GameState,actorId:string):LifecycleAbility[]{
 const p=s.players[actorId]!;const w=s.windows?.at(-1);if(s.outcome||!isActive(p)||!canUseCharacterAbility(p,s)||w&&w.participants[w.cursor]!==actorId)return [];
 const task=w?.continuation.kind==='lifecycle'?s.lifecycle?.find(task=>task.id===w.continuation.id):undefined;
 const result:LifecycleAbility[]=[];
 if(p.characterId==='c2-p02-r2c2'&&Object.values(s.players).some(other=>other.characterId==='c2-p03-r1c2'&&other.revealed)&&!s.used?.includes(`${actorId}:lancelot-transform`))result.push('lancelot-transform');
 if(task?.kind==='boundary'&&task.trigger==='vanmil-awakened'){
  if(p.characterId==='c2-p07-r1c2'&&!s.used?.includes(`${task.id}:${actorId}:vanmil-subordinates`))result.push('vanmil-subordinates');
  if(p.characterId==='c2-p04-r2c1'&&!s.used?.includes(`${task.id}:${actorId}:arseil-conspiracy`))result.push('arseil-conspiracy');
 }
 return result;
}
function transform(s:GameState,actorId:string,characterId:string,now:number):void{
 const p=s.players[actorId]!;const c=getCharacter(characterId)!;const former=p.characterId;
 p.characterId=c.id;p.faction=c.initial_faction;p.objective=c.objective;p.currentObjective=factionObjective(c.initial_faction);p.protection=initialProtection(c.id);p.revealed=true;
 p.abilityCharacterIds=c.id==='c2-p07-r1c1'?[former,c.id]:[c.id];
 if(c.id==='c2-p07-r1c2'){p.damage=0;scheduleBoundary(s,'vanmil-awakened');}
 appendEvent(s,now,{type:'CHARACTER_TRANSFORMED',actorId,audience:'public',characterId:c.id});
}
/** The selected hand card is never copied into a public action projection. */
export function resolveLifecycleAction(s:GameState,action:ActionFrame,now:number):void{
 const effect=action.lifecycleEffect;if(!effect||action.canceled)return;
 if(effect.kind==='ritual'){transform(s,action.actorId,'c2-p07-r1c2',now);return;}
 const p=s.players[action.actorId]!;const target=s.players[effect.targetId]!;
 if(p.presence!=='pending-death'||!eligibleGiftRecipients(s,action.eventId,p.id).includes(effect.targetId)||!p.hand.includes(effect.giftCardInstanceId))return;
 p.hand.splice(p.hand.indexOf(effect.giftCardInstanceId),1);target.hand.push(effect.giftCardInstanceId);
 appendEvent(s,now,{type:'CARD_GIFTED',actorId:p.id,targetId:target.id,audience:'public'});
 for(const id of [p.id,target.id])appendEvent(s,now,{type:'CARD_GIFTED',actorId:p.id,targetId:target.id,audience:{playerId:id},cardInstanceId:effect.giftCardInstanceId});
}
export function transitionLifecycleCommand(state:GameState,input:GameInput,now:number):TransitionResult|undefined{
 const c=input.command;if(!['PLAY_DEATH_GIFT','USE_REVIVAL_RITUAL','TRANSFER_RITUAL'].includes(c.type))return;
 const fail=(code:EngineErrorCode):TransitionResult=>({ok:false,code});
 const p=state.players[input.actorId]!;const w=state.windows?.at(-1);
 if(c.type==='PLAY_DEATH_GIFT'){
  if(w?.kind!=='death-gift'||w.continuation.kind!=='lifecycle'||w.participants[w.cursor]!==p.id)return fail('NOT_PRIORITY');
  if(c.cardInstanceId!==(p.faction==='EVIL'?'a2-p02-r3c2':p.faction==='GOOD'?'a2-p02-r3c3':''))return fail('UNSUPPORTED_CARD');
  if(c.cardInstanceId===c.giftCardInstanceId||!p.hand.includes(c.cardInstanceId)||!p.hand.includes(c.giftCardInstanceId))return fail('CARD_NOT_IN_HAND');
  if(!eligibleGiftRecipients(state,w.continuation.id,p.id).includes(c.targetId))return fail('INVALID_TARGET');
 }else if(c.type==='USE_REVIVAL_RITUAL'){
  if(w||state.phase!=='action')return fail('WRONG_PHASE');if(state.seatOrder[state.turnSeat]!==p.id)return fail('NOT_YOUR_TURN');
  if(hasStatus(p,'stopped'))return fail('STOPPED');if(p.characterId!=='c2-p05-r1c1')return fail('UNSUPPORTED_CARD');if(!p.hand.includes('a2-p05-r1c1'))return fail('CARD_NOT_IN_HAND');
 }else if(c.type==='TRANSFER_RITUAL'){
  if(state.phase==='setup')return fail('WRONG_PHASE');if(w&&w.participants[w.cursor]!==p.id)return fail('NOT_PRIORITY');if(hasStatus(p,'stopped'))return fail('STOPPED');
  if(p.characterId!=='c2-p06-r1c2')return fail('UNSUPPORTED_CARD');if(!p.hand.includes('a2-p05-r1c1'))return fail('CARD_NOT_IN_HAND');
  const target=state.players[c.targetId];if(!target||!isActive(target)||!target.revealed||target.characterId!=='c2-p05-r1c1')return fail('INVALID_TARGET');
  if(state.used?.includes(`${w?.eventId??`turn-${state.turnNumber??0}`}:${p.id}:ritual-transfer`))return fail('ALREADY_USED');
 }
 const s=structuredClone(state);const actor=s.players[p.id]!;const current=s.windows?.at(-1);
 if(c.type==='PLAY_DEATH_GIFT'||c.type==='USE_REVIVAL_RITUAL'){
  const card=c.type==='PLAY_DEATH_GIFT'?c.cardInstanceId:'a2-p05-r1c1';actor.hand.splice(actor.hand.indexOf(card),1);s.resolution.push(card);
  const id=`a-${s.nextEventId++}`;const eventId=current?.eventId??id;
  const action:ActionFrame={id,eventId,parentWindowId:current?.id??null,actorId:p.id,cardInstanceId:card,kind:'lifecycle',targetIds:c.type==='PLAY_DEATH_GIFT'?[c.targetId]:[p.id],technique:techniqueFor('a2-p05-r3c1')!,groupId:null,stage:'declaration',checks:[],roll:null,canceled:false,lifecycleEffect:c.type==='PLAY_DEATH_GIFT'?{kind:'gift',giftCardInstanceId:c.giftCardInstanceId,targetId:c.targetId}:{kind:'ritual'}};
  (s.actions??={})[id]=action;if(c.type==='USE_REVIVAL_RITUAL')s.phase='hand-adjustment';
  openWindow(s,'declaration',eventId,{kind:'action',id},current?participants(s,(s.seatOrder.indexOf(p.id)+1)%s.seatOrder.length):participants(s));
 }else if(c.type==='TRANSFER_RITUAL'){
  actor.hand.splice(actor.hand.indexOf('a2-p05-r1c1'),1);s.players[c.targetId]!.hand.push('a2-p05-r1c1');
  (s.used??=[]).push(`${current?.eventId??`turn-${s.turnNumber??0}`}:${p.id}:ritual-transfer`);
  appendEvent(s,now,{type:'CARD_GIFTED',actorId:p.id,targetId:c.targetId,audience:'public'});
  for(const id of [p.id,c.targetId])appendEvent(s,now,{type:'CARD_GIFTED',actorId:p.id,targetId:c.targetId,audience:{playerId:id},cardInstanceId:'a2-p05-r1c1'});
  if(current)resetParent(s,current.id);
 }
 s.revision++;return {ok:true,state:s,events:structuredClone(s.events.slice(state.events.length))};
}

/** Accepted optional character effects revalidate their live trigger before reaching here. */
export function resolveLifecycleAbility(s:GameState,actorId:string,ability:LifecycleAbility,now:number):void{
 const actor=s.players[actorId]!;
 if(ability==='lancelot-transform'){transform(s,actorId,'c2-p07-r1c1',now);return;}
 if(ability==='vanmil-subordinates'){
  for(const target of Object.values(s.players))if(['c2-p06-r1c2','c2-p06-r2c2'].includes(target.characterId)){
   replaceAllegiance(target,'ヴァンミール',factionObjective('ヴァンミール'),{characterIds:['c2-p07-r1c2']});
   appendEvent(s,now,{type:'FACTION_CHANGED',actorId:target.id,audience:'public'});
  }
  return;
 }
 actor.presence='exited';(s.individualResults??={})[actor.id]='won';clearDistances(s,actor.id);
 discardPlayerCards(s,actor.id,actor.id,s.windows?.at(-1)?.eventId??`exit-${actor.id}-${s.revision}`);
 appendEvent(s,now,{type:'PLAYER_EXITED',actorId:actor.id,audience:'public'});
}
