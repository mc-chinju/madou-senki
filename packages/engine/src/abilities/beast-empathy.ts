import {getAction} from '@madou/catalog';
import {canUseCharacterAbility,hasStatus,type GameState} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import {ownsAbility} from './ownership.js';
import type {AbilityFrame,AbilityId,AbilityOption} from './frames.js';
import type {AttackGroup,AttackTarget,FollowerDefenseSnapshot,Technique} from '../reactions/continuations.js';
import type {GameInput,TransitionResult} from '../commands.js';
import {appendEvent} from '../setup.js';
export const BEAST_EMPATHY='c2-p05-r1c2-ab03';
export interface SelectedBeastEmpathy {abilityId:typeof BEAST_EMPATHY;actorId:string}
export interface IgnoredBeast {cardInstanceId:string;targetId:string;position:number;hits:{index:number;sourceActionId:string;sourceCardInstanceId:string;lineage:string[]}[]}
export interface BeastCaptureTask {kind:'beast-capture';id:string;groupId:string;actorId:string;selected:SelectedBeastEmpathy;candidates:IgnoredBeast[];waiting?:boolean}
export interface BeastCaptureView {groupId:string;windowId:string;actorId:string;candidates:{cardInstanceId:string;name:string;targetId:string;position:number}[]}
export function activeBeastOwner(s:GameState,actorId:string):boolean {const p=s.players[actorId];return !!p&&isActive(p)&&canUseCharacterAbility(p)&&ownsAbility(p,BEAST_EMPATHY);}
function qualifies(s:GameState,g:AttackGroup,h:AttackTarget['hits'][number],base:Technique):boolean {
 const a=s.actions?.[h.sourceActionId??g.actionId];
 return !!a&&!a.canceled&&a.actorId===g.attackerId&&!a.fixedReceivedEffect&&!a.followerOrigin&&(a.kind==='attack'||a.kind==='defense'&&a.technique.defense==='counter')&&base.school==='warrior';
}
export function beastAbilityOptions(s:GameState,actorId:string,add:(id:AbilityId,extra?:Partial<AbilityOption>)=>void):void {
 const w=s.windows?.at(-1);if(w?.kind!=='attack-abilities'||w.continuation.kind!=='group')return;
 const g=s.groups?.[w.continuation.id];if(g&&g.attackerId===actorId&&ownsAbility(s.players[actorId]!,BEAST_EMPATHY)&&g.targets.some(t=>t.hits.some(h=>qualifies(s,g,h,h.technique??g.technique))))add(BEAST_EMPATHY);
}
export function validBeastAbility(s:GameState,f:AbilityFrame):boolean {
 if(f.context.kind!=='group')return false;const g=s.groups?.[f.context.groupId];
 return !!g&&g.attackerId===f.actorId&&g.stage==='defense'&&!g.targets.some(t=>t.followerStarted)&&g.targets.some(t=>t.hits.some(h=>qualifies(s,g,h,h.technique??g.technique)));
}
export function resolveBeastAbility(s:GameState,f:AbilityFrame):void {if(f.context.kind==='group')s.groups![f.context.groupId]!.beastEmpathy={abilityId:BEAST_EMPATHY,actorId:f.actorId};}
export function liveBeastSelection(s:GameState,g:AttackGroup,h:AttackTarget['hits'][number],base:Technique):SelectedBeastEmpathy|undefined {
 const m=g.beastEmpathy;return m&&m.actorId===g.attackerId&&activeBeastOwner(s,m.actorId)&&qualifies(s,g,h,base)?m:undefined;
}
/** Live composition adds a predicate; selected provenance remains outside Technique. */
export function beastTechnique(s:GameState,g:AttackGroup,t:AttackTarget,h:AttackTarget['hits'][number],base:Technique):Technique {
 if(t.followerDefense||!liveBeastSelection(s,g,h,base))return base;
 return {...base,ignoreFollowerAttributes:[...new Set([...(base.ignoreFollowerAttributes??[]),'獣'])]};
}
/** Called only on the actual ignore branch, after ineffective and morale-failed checks. */
export function recordIgnoredBeast(s:GameState,g:AttackGroup,t:AttackTarget,h:AttackTarget['hits'][number],d:FollowerDefenseSnapshot):void {
 if(!h.frozenBeastEmpathy||d.source!=='physical'||!d.descriptor.attributes.includes('獣'))return;
 const a=s.actions?.[h.sourceActionId??g.actionId];if(!a)return;
 const source={index:h.index,sourceActionId:a.id,sourceCardInstanceId:h.sourceCardInstanceId??a.effectSourceCardInstanceId??a.cardInstanceId,lineage:[...h.lineage]};
 const previous=t.ignoredBeasts?.find(x=>x.cardInstanceId===d.cardInstanceId);
 if(previous){if(!previous.hits.some(x=>x.index===h.index))previous.hits.push(source);}
 else (t.ignoredBeasts??=[]).push({cardInstanceId:d.cardInstanceId,targetId:t.actorId,position:d.position,hits:[source]});
}
function stillOwned(s:GameState,c:IgnoredBeast):boolean {const p=s.players[c.targetId];return !!p&&(isActive(p)||p.presence==='pending-death')&&p.followers.some(f=>f.cardInstanceId===c.cardInstanceId);}
/** Save earned work only after simultaneous damage/pending death, before source deletion. */
export function saveBeastCapture(s:GameState,g:AttackGroup):void {
 if(!g.beastEmpathy||!activeBeastOwner(s,g.beastEmpathy.actorId))return;
 const candidates:IgnoredBeast[]=[];
 for(const t of g.targets)for(const ignored of t.ignoredBeasts??[]){
  const hits=ignored.hits.filter(e=>t.hits.some(h=>h.index===e.index&&h.hit&&!h.defended&&(h.damage??0)>0&&h.frozenBeastEmpathy?.actorId===g.beastEmpathy!.actorId));
  if(!hits.length||!stillOwned(s,ignored)||candidates.some(c=>c.cardInstanceId===ignored.cardInstanceId))continue;
  candidates.push(structuredClone({...ignored,hits}));
 }
 if(candidates.length)(s.lifecycle??=[]).push({kind:'beast-capture',id:`capture-${g.id}`,groupId:g.id,actorId:g.beastEmpathy.actorId,selected:{...g.beastEmpathy},candidates});
}
export function beastCaptureView(s:GameState,viewerId:string):BeastCaptureView|null {
 const w=s.windows?.at(-1);if(w?.kind!=='beast-capture'||w.continuation.kind!=='lifecycle'||w.participants[w.cursor]!==viewerId)return null;
 const task=s.lifecycle?.find(t=>t.id===w.continuation.id);if(task?.kind!=='beast-capture'||task.actorId!==viewerId||!activeBeastOwner(s,viewerId))return null;
 return {groupId:task.groupId,windowId:w.id,actorId:task.actorId,candidates:task.candidates.filter(c=>stillOwned(s,c)).map(c=>({cardInstanceId:c.cardInstanceId,name:getAction(c.cardInstanceId)!.name,targetId:c.targetId,position:c.position}))};
}
export function transitionBeastCapture(state:GameState,input:GameInput,now:number):TransitionResult|undefined {
 const c=input.command;if(c.type!=='CHOOSE_BEAST_CAPTURE')return;
 const fail=(code:import('../commands.js').EngineErrorCode):TransitionResult=>({ok:false,code});const w=state.windows?.at(-1);
 if(w?.kind!=='beast-capture'||w.continuation.kind!=='lifecycle')return fail('WRONG_PHASE');
 if(w.participants[w.cursor]!==input.actorId)return fail('NOT_PRIORITY');
 const task=state.lifecycle?.find(t=>t.id===w.continuation.id);
 if(task?.kind!=='beast-capture'||task.actorId!==input.actorId||c.windowId!==w.id||c.groupId!==task.groupId)return fail('INVALID_TARGET');
 const p=state.players[input.actorId]!;if(hasStatus(p,'stopped'))return fail('STOPPED');if(!activeBeastOwner(state,input.actorId))return fail('ABILITY_DISABLED');
 if(new Set(c.cardInstanceIds).size!==c.cardInstanceIds.length||c.cardInstanceIds.some(id=>!task.candidates.some(candidate=>candidate.cardInstanceId===id&&stillOwned(state,candidate))))return fail('INVALID_TARGET');
 const s=structuredClone(state);const selected=task.candidates.filter(candidate=>c.cardInstanceIds.includes(candidate.cardInstanceId));
 // Revalidate the whole atomic subset against the actual resolution state.
 if(!activeBeastOwner(s,task.actorId)||selected.some(candidate=>!stillOwned(s,candidate)))return fail('INVALID_TARGET');
 for(const candidate of selected){const target=s.players[candidate.targetId]!;const at=target.followers.findIndex(f=>f.cardInstanceId===candidate.cardInstanceId);target.followers.splice(at,1);s.players[task.actorId]!.hand.push(candidate.cardInstanceId);}
 for(const targetId of new Set(selected.map(c=>c.targetId))){appendEvent(s,now,{type:'BEAST_CAPTURED',actorId:task.actorId,targetId,audience:'public',count:selected.filter(c=>c.targetId===targetId).length});}
 for(const candidate of selected)for(const playerId of [task.actorId,candidate.targetId])appendEvent(s,now,{type:'BEAST_CAPTURED',actorId:task.actorId,targetId:candidate.targetId,audience:{playerId},cardInstanceId:candidate.cardInstanceId});
 s.windows!.pop();s.lifecycle=s.lifecycle!.filter(t=>t.id!==task.id);s.revision++;return {ok:true,state:s,events:structuredClone(s.events.slice(state.events.length))};
}
export function hasBeastIgnore(t:Technique):boolean {return t.followerIgnore||!!t.ignoreFollowerAttributes?.includes('獣');}
