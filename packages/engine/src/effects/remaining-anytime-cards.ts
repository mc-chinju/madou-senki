import {recordCardPlayed} from '../public-record.js';
import {attackScopeGroups,substituteRestricted} from './substitute.js';
import {getAction} from '@madou/catalog';
import type {GameCommand} from '@madou/protocol';
import {hasStatus,hasPendingFatal,type GameState} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import type {EngineErrorCode} from '../commands.js';
import type {ActionFrame} from '../reactions/continuations.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {enqueueLifecycle} from '../lifecycle/events.js';
import {refillHand} from '../setup.js';
import {techniqueFor} from './registry.js';
export const TRAGEDY='a2-p01-r2c3',KEIL='a2-p01-r3c1',AMULET='a2-p01-r3c2',HOSTAGE='a2-p02-r2c2';
export interface AnytimeCardOption {cardInstanceId:string;targetEventId:string;targetId?:string;groupId?:string;hitIndex?:number;label:string}
const namedProtected=['c2-p02-r2c2','c2-p07-r1c1','c2-p03-r1c2'];
/** Only a surviving paid attack declaration owns this cancellation scope, including its remaining hits. */
function pendingTargets(s:GameState,a:ActionFrame):string[]{
 if(a.kind!=='attack'||a.canceled||a.disposition||a.preAttackPending||a.allArmyParentId&&s.actions?.[a.allArmyParentId]?.stage==='declaration')return [];
 const groups=attackScopeGroups(s,a);
 return groups.length?[...new Set(groups.flatMap(g=>g.targets.filter(t=>t.hits.some(h=>!h.hit&&!h.defended)).map(t=>t.actorId)))]:a.targetIds.filter(id=>!a.protectedTargetIds?.includes(id));
}
function responseAllowed(s:GameState,actorId:string):boolean {
 const p=s.players[actorId],w=s.windows?.at(-1);return !!p&&!!w&&isActive(p)&&!hasStatus(p,'stopped')&&!hasPendingFatal(s,actorId)&&w.participants[w.cursor]===actorId&&['declaration','before-roll','after-roll','effect-level','damage','attack-abilities','normal-defense','follower-entry-abilities','hit','hit-abilities','follower-start'].includes(w.kind);
}
function actorCanFailAttack(s:GameState,actorId:string,a:ActionFrame):boolean {
 const g=Object.values(s.groups??{}).find(g=>g.actionId===a.id),t=g?.targets.find(t=>t.actorId===actorId);
 return !t?.followerStarted;
}
export function namedAnytimeOptions(s:GameState,actorId:string):AnytimeCardOption[]{
 if(!responseAllowed(s,actorId)||substituteRestricted(s,actorId))return [];
 const p=s.players[actorId]!,w=s.windows!.at(-1)!,result:AnytimeCardOption[]=[];
 const add=(id:string,eventId:string,targetId?:string)=>{if(p.hand.includes(id)&&!s.used?.includes(`${eventId}:${actorId}:${id}`))result.push({cardInstanceId:id,targetEventId:eventId,...(targetId?{targetId}:{}),label:`${getAction(id)!.name}を使う${targetId?`（${s.players[targetId]!.name}を守る）`:''}`});};
 const f=w.continuation.kind==='ability'?s.abilities?.[w.continuation.id]:undefined;
 if(w.kind==='declaration'&&f?.stage==='declaration'&&!f.canceled&&['c2-p03-r2c1-ab01','c2-p06-r1c1-ab01','c2-p06-r1c2-ab01'].includes(f.abilityId))add(AMULET,f.id);
 for(const a of Object.values(s.actions??{})){
  const targets=pendingTargets(s,a);if(!targets.length||!actorCanFailAttack(s,actorId,a))continue;const attacker=s.players[a.actorId]!;
  if(attacker.revealed&&['c2-p05-r2c2','c2-p06-r1c2'].includes(attacker.characterId))add(TRAGEDY,a.id);
  if(p.faction==='EVIL'&&attacker.faction==='GOOD')add(HOSTAGE,a.id);
  for(const targetId of targets){const target=s.players[targetId]!;if(isActive(target)&&target.revealed&&namedProtected.includes(target.characterId))add(KEIL,a.id,targetId);}
 }
 return result;
}
export function acceptNamedAnytimeCard(s:GameState,actorId:string,c:Extract<GameCommand,{type:'PLAY_ANYTIME_CARD'}>,random:()=>number,now:number):EngineErrorCode|undefined {
 const option=namedAnytimeOptions(s,actorId).find(o=>o.cardInstanceId===c.cardInstanceId&&o.targetEventId===c.targetEventId&&o.targetId===c.targetId&&o.groupId===c.groupId&&o.hitIndex===c.hitIndex);
 if(!option)return 'INVALID_TARGET';
 const p=s.players[actorId]!,w=s.windows!.at(-1)!,source=s.actions?.[c.targetEventId]??s.abilities?.[c.targetEventId];if(!source)return 'INVALID_TARGET';
 (s.used??=[]).push(`${c.targetEventId}:${actorId}:${c.cardInstanceId}`);p.hand.splice(p.hand.indexOf(c.cardInstanceId),1);s.resolution.push(c.cardInstanceId);recordCardPlayed(s,actorId,c.cardInstanceId,'anytime');
 const id=`a-${s.nextEventId++}`;
 (s.actions??={})[id]={id,eventId:source.eventId,parentWindowId:w.id,actorId,cardInstanceId:c.cardInstanceId,kind:'reaction',reclaimOwnerLifeId:lifeIdentity(p),
  targetIds:c.targetId?[c.targetId]:[],...(c.targetId?{turnCardTargetLifeId:lifeIdentity(s.players[c.targetId]!)}:{}),technique:techniqueFor('a2-p05-r3c1')!,groupId:null,stage:'declaration',checks:[],roll:null,canceled:false,
  ...(c.cardInstanceId===AMULET?{reactionMode:'cancel-ability',targetAbilityId:source.id}:{anytimeEffect:c.cardInstanceId===KEIL?'protect-target':'fail-attack',targetActionId:source.id})};
 enqueueLifecycle(s,{kind:'declaration',id:`declare-${id}`,actionId:id,rootEventIds:[source.eventId]});refillHand(s,p,p.hand.length+1,random,now);
}
export function resolveNamedAnytimeCard(s:GameState,a:ActionFrame):void {
 const source=s.actions?.[a.targetActionId!],p=s.players[a.actorId]!;if(!source||!isActive(p)||lifeIdentity(p)!==a.reclaimOwnerLifeId)return;
 const targets=pendingTargets(s,source),attacker=s.players[source.actorId]!;
 if(!targets.length)return;
 if(a.cardInstanceId===TRAGEDY&&(!attacker.revealed||!['c2-p05-r2c2','c2-p06-r1c2'].includes(attacker.characterId)))return;
 if(a.cardInstanceId===HOSTAGE&&(p.faction!=='EVIL'||attacker.faction!=='GOOD'))return;
 let selected=targets;
 if(a.anytimeEffect==='protect-target'){
  const targetId=a.targetIds[0]!,target=s.players[targetId]!;
  if(!targets.includes(targetId)||!isActive(target)||!target.revealed||!namedProtected.includes(target.characterId)||lifeIdentity(target)!==a.turnCardTargetLifeId)return;
  selected=[targetId];(source.protectedTargetIds??=[]).push(targetId);
  if(target.characterId!=='c2-p03-r1c2'){(target.permanent??={}).spirit=(target.permanent?.spirit??0)+1;}
 }
 const groups=attackScopeGroups(s,source);
 if(groups.length){for(const g of groups)for(const t of g.targets)if(selected.includes(t.actorId))for(const h of t.hits)if(!h.hit)h.defended=true;}
 else if(a.anytimeEffect==='fail-attack')source.canceled=true;
}
