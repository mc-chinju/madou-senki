import {recordCardPlayed} from '../public-record.js';
import {getAction} from '@madou/catalog';
import type {GameCommand} from '@madou/protocol';
import type {EngineErrorCode} from '../commands.js';
import {canUseCharacterAbility,hasStatus,type GameState} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import {currentHit} from '../reactions/continuations.js';
import {openWindow} from '../reactions/windows.js';
import {beginRoll} from '../rolls/advance.js';
import {ownsAbility} from './ownership.js';
import {lifeIdentity} from './suppression-state.js';
import type {AbilityFrame,AbilityId,AbilityOption} from './frames.js';
import {offerReclaim} from '../reclaim.js';
export const SHADOW_JUMP='c2-p06-r2c2-ab01';
export interface ShadowJump {parentGroupId:string;targetId:string;hitIndex:number;originalAttackerId:string;sourceLifeId:string;stage:'self-check'|'cost-choice'|'attack-choice'|'child';rollId?:string;paidAdvanceId?:string;childActionId?:string}
export function shadowJumpOptions(s:GameState,actorId:string,add:(id:AbilityId,extra?:Partial<AbilityOption>)=>void):void{
 const w=s.windows?.at(-1),p=s.players[actorId];if(!p||!ownsAbility(p,SHADOW_JUMP)||!canUseCharacterAbility(p,s)||hasStatus(p,'stopped')||w?.kind!=='normal-defense'||w.continuation.kind!=='group'||w.continuation.targetId!==actorId)return;
 const g=s.groups?.[w.continuation.id],t=g?.targets.find(t=>t.actorId===actorId),h=g&&currentHit(g,actorId);if(g&&t&&h&&g.attackerId!==actorId&&isActive(s.players[g.attackerId]!)&&!t.normalDefenseClosed&&!t.followerStarted&&!h.defended&&!h.passedDefense)add(SHADOW_JUMP);
}
export function initializeShadowJump(s:GameState,f:AbilityFrame):void{if(f.abilityId!==SHADOW_JUMP||f.context.kind!=='group')return;const c=f.context,g=s.groups![c.groupId]!;f.shadowJump={parentGroupId:g.id,targetId:f.actorId,hitIndex:c.hitIndex,originalAttackerId:g.attackerId,sourceLifeId:lifeIdentity(s.players[f.actorId]!),stage:'self-check'};}
/** True means the ability has finished; earned defense is never undone by declining a later choice. */
export function resolveShadowJump(s:GameState,f:AbilityFrame,dice:()=>number):boolean{
 const j=f.shadowJump!;if(lifeIdentity(s.players[f.actorId]!)!==j.sourceLifeId)return true;
 if(f.stage==='declaration'){f.stage='self-check';const r=beginRoll(s,{eventId:f.eventId,rollerId:f.actorId,purpose:'ability-check',formula:'2d6',check:{modifier:-2},resume:{kind:'ability',abilityId:f.id}},dice);j.rollId=r.id;f.rollIds.push(r.id);return false;}
 const r=s.rolls?.find(r=>r.id===j.rollId);if(!r||r.stage!=='applied'||!r.success)return true;
 const g=s.groups?.[j.parentGroupId],h=g?.targets.find(t=>t.actorId===j.targetId)?.hits.find(h=>h.index===j.hitIndex);if(!g||!h||g.hitCursor!==j.hitIndex)return true;h.defended=true;j.stage='cost-choice';f.stage='cost-choice';openWindow(s,'shadow-jump-cost',f.eventId,{kind:'ability',id:f.id},[f.actorId]);return false;
}
export function shadowJumpGrantLive(s:GameState,f:AbilityFrame):boolean{const j=f.shadowJump,p=s.players[f.actorId];return !!j&&!!p&&isActive(p)&&lifeIdentity(p)===j.sourceLifeId&&isActive(s.players[j.originalAttackerId]!);}
export function shadowJumpCostView(s:GameState,actorId:string){const w=s.windows?.at(-1),f=w?.continuation.kind==='ability'?s.abilities?.[w.continuation.id]:undefined;if(w?.kind!=='shadow-jump-cost'||w.participants[w.cursor]!==actorId||f?.actorId!==actorId||f.shadowJump?.stage!=='cost-choice')return null;return {abilityEventId:f.id,targetId:f.shadowJump.originalAttackerId,cardInstanceIds:shadowJumpGrantLive(s,f)&&!hasStatus(s.players[actorId]!,'stopped')?s.players[actorId]!.hand.filter(id=>getAction(id)?.modes?.some(m=>m.playMode==='advance')):[]};}
export function payShadowJump(s:GameState,actorId:string,c:Extract<GameCommand,{type:'PAY_SHADOW_JUMP'}>):EngineErrorCode|undefined{
 const choice=shadowJumpCostView(s,actorId);if(!choice||choice.abilityEventId!==c.abilityEventId)return 'NOT_PRIORITY';if(!choice.cardInstanceIds.includes(c.advanceCardInstanceId))return 'CARD_NOT_IN_HAND';
 const f=s.abilities![c.abilityEventId]!,p=s.players[actorId]!,j=f.shadowJump!;p.hand.splice(p.hand.indexOf(c.advanceCardInstanceId),1);s.resolution.push(c.advanceCardInstanceId);recordCardPlayed(s,actorId,c.advanceCardInstanceId,'advance');j.paidAdvanceId=c.advanceCardInstanceId;j.stage='attack-choice';f.stage='attack-choice';s.windows!.pop();openWindow(s,'ability-attack',f.eventId,{kind:'ability',id:f.id},[actorId]);
 offerReclaim(s,{kind:'ordinary-disposition',fromZone:'resolution',sourceId:`${f.id}-advance`,eventId:f.eventId,sourceActorId:actorId,sourceLifeId:j.sourceLifeId,cardInstanceId:c.advanceCardInstanceId,trigger:'technique-resolved',usedModeName:'advance'});
}
