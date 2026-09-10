import {substituteOptions,acceptSubstitute,substituteRestricted,SUBSTITUTE} from './substitute.js';
import {informationAnytimeOptions,acceptInformationAnytime,PEACE,REVELATION} from './anytime-information.js';
import {namedAnytimeOptions,acceptNamedAnytimeCard,type AnytimeCardOption} from './remaining-anytime-cards.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import type {GameState} from '../state.js';
import {hasStatus,hasPendingFatal} from '../state.js';
import type {GameCommand} from '@madou/protocol';
import type {EngineErrorCode} from '../commands.js';
import {enqueueLifecycle} from '../lifecycle/events.js';
import {refillHand} from '../setup.js';
import {techniqueFor} from './registry.js';
export const COURAGE='a2-p01-r3c3';
function courageCardOptions(s:GameState,actorId:string) {
  const p=s.players[actorId],w=s.windows?.at(-1);
  const f=w?.continuation.kind==='ability'?s.abilities?.[w.continuation.id]:undefined;
  if(!p||!w||w.kind!=='declaration'||w.participants[w.cursor]!==actorId||p.faction!=='GOOD'||hasStatus(p,'stopped')||hasPendingFatal(s,actorId)
    ||!p.hand.includes(COURAGE)||!f||f.stage!=='declaration'||f.canceled||!['c2-p06-r1c2-ab01','c2-p06-r1c1-ab01'].includes(f.abilityId))return [];
  return [{cardInstanceId:COURAGE,targetEventId:f.id,label:'勇気を使う'}];
}
export function anytimeCardOptions(s:GameState,actorId:string):AnytimeCardOption[]{if(substituteRestricted(s,actorId))return [];return [...substituteOptions(s,actorId),...courageCardOptions(s,actorId),...namedAnytimeOptions(s,actorId),...informationAnytimeOptions(s,actorId)];}
export function acceptAnytimeCard(s:GameState,actorId:string,c:Extract<GameCommand,{type:'PLAY_ANYTIME_CARD'}>,random:()=>number,now:number):EngineErrorCode|undefined {
  if(substituteRestricted(s,actorId))return 'ILLEGAL_DEFENSE';
  if(c.cardInstanceId===SUBSTITUTE)return acceptSubstitute(s,actorId,c,random,now);
  if(c.cardInstanceId===PEACE||c.cardInstanceId===REVELATION)return acceptInformationAnytime(s,actorId,c,random,now);
  if(c.cardInstanceId!==COURAGE)return acceptNamedAnytimeCard(s,actorId,c,random,now);
  if(c.targetId!==undefined||c.groupId!==undefined||c.hitIndex!==undefined||!anytimeCardOptions(s,actorId).some(o=>o.cardInstanceId===c.cardInstanceId&&o.targetEventId===c.targetEventId))return 'INVALID_TARGET';
  const p=s.players[actorId]!,w=s.windows!.at(-1)!,f=s.abilities![c.targetEventId]!;
  const key=`${f.eventId}:${actorId}:${COURAGE}`;if(s.used?.includes(key))return 'ALREADY_USED';
  (s.used??=[]).push(key);p.hand.splice(p.hand.indexOf(COURAGE),1);s.resolution.push(COURAGE);
  const id=`a-${s.nextEventId++}`;
  (s.actions??={})[id]={id,eventId:f.eventId,parentWindowId:w.id,actorId,cardInstanceId:COURAGE,kind:'reaction',reclaimOwnerLifeId:lifeIdentity(p),
    targetIds:[],technique:techniqueFor('a2-p05-r3c1')!,groupId:null,stage:'declaration',checks:[],roll:null,canceled:false,reactionMode:'cancel-ability',targetAbilityId:f.id};
  enqueueLifecycle(s,{kind:'declaration',id:`declare-${id}`,actionId:id,rootEventIds:[f.eventId]});refillHand(s,p,p.hand.length+1,random,now);
}
