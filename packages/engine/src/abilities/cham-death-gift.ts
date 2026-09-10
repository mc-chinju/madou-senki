import type {GameState} from '../state.js';
import {canUseCharacterAbility} from '../state.js';
import type {GameInput,TransitionResult} from '../commands.js';
import {ownsAbility} from './ownership.js';
import {lifeIdentity} from './suppression-state.js';
import {eligibleGiftRecipients} from '../lifecycle/commands.js';
import {appendEvent} from '../setup.js';
import {openWindow,participants} from '../reactions/windows.js';
import type {AbilityFrame} from './frames.js';
export const CHAM_GIFT='c2-p01-r2c2-ab05';
export interface ChamGiftSelection {cardInstanceId:string;targetId:string;sourceLifeId:string;eligibleTargetIds:string[];moved?:boolean}
export interface ChamGiftContext {kind:'cham-gift';batchId:string}
export interface ChamGiftOption {decisionId:string;cardInstanceIds:string[];eligibleTargetIds:string[]}
export function chamGiftOption(s:GameState,actorId:string):ChamGiftOption|undefined {
 const w=s.windows?.at(-1),p=s.players[actorId];if(w?.kind!=='death-gift'||w.continuation.kind!=='lifecycle'||w.participants[w.cursor]!==actorId||!p||p.presence!=='pending-death'||!ownsAbility(p,CHAM_GIFT)||!canUseCharacterAbility(p,s))return;
 const task=s.lifecycle?.find(t=>t.id===w.continuation.id);if(task?.kind!=='death-batch'||task.chamGifts?.[actorId])return;
 const eligibleTargetIds=eligibleGiftRecipients(s,task.id,actorId);if(!p.hand.length||!eligibleTargetIds.length)return;
 return {decisionId:task.id,cardInstanceIds:[...p.hand],eligibleTargetIds};
}
export function transitionChamGift(state:GameState,input:GameInput):TransitionResult|undefined {
 const c=input.command;if(c.type!=='CHAM_DEATH_GIFT')return;
 const option=chamGiftOption(state,input.actorId);if(!option)return {ok:false,code:'ABILITY_DISABLED'};
 if(c.decisionId!==option.decisionId||!option.eligibleTargetIds.includes(c.targetId))return {ok:false,code:'INVALID_TARGET'};
 if(!option.cardInstanceIds.includes(c.cardInstanceId))return {ok:false,code:'CARD_NOT_IN_HAND'};
 const s=structuredClone(state),p=s.players[input.actorId]!,task=s.lifecycle!.find(t=>t.id===c.decisionId)!;
 if(task.kind!=='death-batch')throw Error('MISSING_DEATH_BATCH');
 (task.chamGifts??={})[p.id]={cardInstanceId:c.cardInstanceId,targetId:c.targetId,sourceLifeId:lifeIdentity(p),eligibleTargetIds:[...option.eligibleTargetIds]};
 const frame:AbilityFrame={id:`ability-${s.nextEventId++}`,source:'ability',abilityId:CHAM_GIFT,actorId:p.id,eventId:task.id,parentWindowId:s.windows!.at(-1)!.id,useOrdinal:1,targetIds:[c.targetId],costs:{ownAction:false},stage:'declaration',canceled:false,rollIds:[],context:{kind:'cham-gift',batchId:task.id}};
 (s.abilities??={})[frame.id]=frame;openWindow(s,'declaration',task.id,{kind:'ability',id:frame.id},participants(s,(s.seatOrder.indexOf(p.id)+1)%s.seatOrder.length));
 s.revision++;return {ok:true,state:s,events:[]};
}
export function resolveChamGift(s:GameState,f:AbilityFrame,now:number):void {
 if(f.context.kind!=='cham-gift'||f.canceled)return;
 const batchId=f.context.batchId,task=s.lifecycle?.find(t=>t.id===batchId);if(task?.kind!=='death-batch')return;
 const selected=task.chamGifts?.[f.actorId],p=s.players[f.actorId];if(!selected||selected.moved||!p||p.presence!=='pending-death'||lifeIdentity(p)!==selected.sourceLifeId||!ownsAbility(p,CHAM_GIFT)||!canUseCharacterAbility(p,s)||!p.hand.includes(selected.cardInstanceId)||!selected.eligibleTargetIds.includes(selected.targetId)||!eligibleGiftRecipients(s,batchId,p.id).includes(selected.targetId))return;
 p.hand.splice(p.hand.indexOf(selected.cardInstanceId),1);s.players[selected.targetId]!.hand.push(selected.cardInstanceId);selected.moved=true;
 appendEvent(s,now,{type:'CARD_GIFTED',actorId:p.id,targetId:selected.targetId,audience:'public'});
 for(const playerId of [p.id,selected.targetId])appendEvent(s,now,{type:'CARD_GIFTED',actorId:p.id,targetId:selected.targetId,audience:{playerId},cardInstanceId:selected.cardInstanceId});
}
