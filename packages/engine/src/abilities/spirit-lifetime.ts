import type {GameState,PlayerState} from '../state.js';
import {canUseCharacterAbility} from '../state.js';
import {ownsAbility} from './ownership.js';
import {TRUE_POWER} from './turn-packages.js';
/** Typed base replacements keep G08 additions independent of source-specific exclusions. */
export interface SpiritReplacement {id:string;sourceAbilityId?:string;sourceCharacterId?:string;sourceCardInstanceId?:string;expiresAfterEventId?:string;awaitingOwnAction?:boolean;base:number;expiresOnActorId:string;timing:'turn-end'|'action-end'}
export function replacementActive(p:PlayerState,r:SpiritReplacement,abilityAllowed:boolean):boolean{return (!p.presence||p.presence==='active')&&(!r.sourceCharacterId||p.characterId===r.sourceCharacterId)&&(!r.sourceAbilityId||abilityAllowed&&ownsAbility(p,r.sourceAbilityId));}
export function spiritBase(p:PlayerState,printed:number,abilityAllowed:boolean,excludeSourceAbilityId?:string):number{
 const live=(p.spiritReplacements??[]).filter(r=>(!excludeSourceAbilityId||r.sourceAbilityId!==excludeSourceAbilityId)&&replacementActive(p,r,abilityAllowed));
 return live.at(-1)?.base??printed;
}
export function expireTurnEnd(s:GameState,actorId:string):void{for(const p of Object.values(s.players))if(p.spiritReplacements)p.spiritReplacements=p.spiritReplacements.filter(r=>r.expiresOnActorId!==actorId||r.timing==='action-end'&&!r.awaitingOwnAction);}
export function cleanSpiritLifetimes(s:GameState):void{for(const p of Object.values(s.players))if(p.spiritReplacements)p.spiritReplacements=p.spiritReplacements.filter(r=>(!p.presence||p.presence==='active')&&(!r.sourceCharacterId||p.characterId===r.sourceCharacterId));}
export interface SpiritExpiryView {abilityId:typeof TRUE_POWER;expiresOnActorId:string;timing:'turn-end';active:boolean}
export function spiritExpiryView(p:PlayerState,s:GameState):SpiritExpiryView|null{const r=p.spiritReplacements?.find(r=>r.sourceAbilityId===TRUE_POWER);return r?{abilityId:TRUE_POWER,expiresOnActorId:r.expiresOnActorId,timing:'turn-end',active:replacementActive(p,r,canUseCharacterAbility(p,s))}:null;}
/** Resolve saved work before enclosing windows: a returned attack window may already be popped. */
export function revealExpiryActor(s:GameState):string{
 const seen=new Set<string>();
 function resolve(kind:'window'|'group'|'action'|'roll'|'ability',id:string|undefined):string|undefined{
  if(!id||seen.has(`${kind}:${id}`))return;
  seen.add(`${kind}:${id}`);
  if(kind==='group')return s.groups?.[id]?.attackerId;
  if(kind==='roll'){
   const resume=s.rolls?.find(r=>r.id===id)?.resume;
   if(!resume)return;
   if('groupId' in resume)return resolve('group',resume.groupId);
   if('actionId' in resume)return resolve('action',resume.actionId);
   if(resume.kind==='ability')return resolve('ability',resume.abilityId);
   return;
  }
  if(kind==='action'){
   const action=s.actions?.[id];if(!action)return;
   if(action.kind==='attack')return action.actorId;
   return resolve('group',action.groupId??undefined)
    ??resolve('roll',action.targetRollId)
    ??resolve('ability',action.targetAbilityId)
    ??resolve('action',action.targetActionId);
  }
  if(kind==='ability'){
   const ability=s.abilities?.[id];if(!ability)return;
   const context=ability.context;
   const actor='groupId' in context?resolve('group',context.groupId)
    :'actionId' in context?resolve('action',context.actionId)
    :context.kind==='mental-guard'?resolve('roll',context.rollId)??resolve('ability',context.sourceAbilityId)
    :context.kind==='ability-response'?resolve('ability',context.sourceAbilityId):undefined;
   return actor??resolve('window',ability.parentWindowId??undefined);
  }
  const w=s.windows?.find(w=>w.id===id);if(!w)return;
  const c=w.continuation;
  const actor=c.kind==='group'||c.kind==='action'||c.kind==='roll'||c.kind==='ability'?resolve(c.kind,c.id):undefined;
  return actor??resolve('window',w.parentId??undefined);
 }
 return resolve('window',s.windows?.at(-1)?.id)??s.seatOrder[s.turnSeat]!;
}
