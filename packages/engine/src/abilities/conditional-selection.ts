import {recordAbility} from '../public-record.js';
import {cleanSadLove} from './sad-love-state.js';
import type {ConditionalAbilityId} from '@madou/protocol';
import type {GameState,PlayerState} from '../state.js';
import {canUseCharacterAbility,hasPendingFatal} from '../state.js';
import type {GameInput,TransitionResult} from '../commands.js';
import {isActive} from '../lifecycle/objectives.js';
import {ownsAbility} from './ownership.js';
import {openWindow,participants} from '../reactions/windows.js';
import type {AbilityFrame} from './frames.js';
import {CONDITIONAL_ABILITIES,LIA_AURA,isConditionalAbility,type ConditionalSelection} from './conditional-sources.js';
export interface ConditionalContext {kind:'conditional-stat';sourceCharacterId:string;opportunityId:string}
export interface ConditionalAbilitySetting {abilityId:ConditionalAbilityId;name:string;description:string;enabled:boolean;active:boolean;suppressed:boolean;selectedTargetIds:string[];eligibleTargetIds?:string[];targetEventId:string|null;canActivate:boolean;canDeactivate:boolean}
export function conditionalSelection(p:PlayerState,id:ConditionalAbilityId):ConditionalSelection|undefined{return ownsAbility(p,id)?p.conditionalSelections?.find(x=>x.abilityId===id):undefined;}
export function conditionalActive(p:PlayerState,id:ConditionalAbilityId,s:GameState):boolean{return isActive(p)&&!hasPendingFatal(s,p.id)&&!!conditionalSelection(p,id)&&canUseCharacterAbility(p,s);}
export function cleanConditionalSelections(s:GameState):void{cleanSadLove(s);for(const p of Object.values(s.players))if(p.conditionalSelections)p.conditionalSelections=p.conditionalSelections.filter(x=>!['pending-death','dead','exited'].includes(p.presence??'active')&&ownsAbility(p,x.abilityId));}
const PUBLIC_WINDOWS=new Set(['declaration','before-roll','after-roll','effect-level','damage','attack-abilities','hit-abilities','follower-entry-abilities','hit','follower-start','normal-defense','defense-advance','approach','withdrawal']);
/** Ancestor selection declarations and their reaction children share the original budget. */
export function publicAbilityOpportunity(s:GameState,actorId:string):string|null{
 const w=s.windows?.at(-1);if(s.outcome||s.pending||s.inspections?.length||s.phase==='setup'||s.phase==='draw'||s.lifecycle?.some(t=>['draw','re-setup','fusen','technique-revival','death-batch'].includes(t.kind)))return null;
 if(w){if(!PUBLIC_WINDOWS.has(w.kind)||w.participants[w.cursor]!==actorId)return null;}
 else if(s.lifecycle?.length||!['action','hand-adjustment','withdrawal'].includes(s.phase))return null;
 for(const parent of s.windows??[]){if(parent.continuation.kind==='ability'){const f=s.abilities?.[parent.continuation.id];if(f?.context.kind==='conditional-stat'||f?.context.kind==='suppression'||f?.context.kind==='sad-love'&&f.context.mode==='aura')return f.context.opportunityId;}}
 return w?`conditional-${w.id}`:`conditional-${s.turnNumber??0}-${s.seatOrder[s.turnSeat]}-${s.phase}`;
}
function targets(s:GameState,actorId:string):string[]{return s.seatOrder.filter(id=>id!==actorId&&s.players[id]!.revealed&&isActive(s.players[id]!));}
function key(event:string,actorId:string,id:ConditionalAbilityId):string{return `${event}:${actorId}:${id}`;}
export function conditionalAbilitySettings(s:GameState,actorId:string):ConditionalAbilitySetting[]{
 const p=s.players[actorId];if(!p)return [];
 const event=publicAbilityOpportunity(s,actorId);
 return (Object.keys(CONDITIONAL_ABILITIES) as ConditionalAbilityId[]).filter(id=>ownsAbility(p,id)).map(id=>{
  const selected=conditionalSelection(p,id),enabled=!!selected,active=conditionalActive(p,id,s),available=!!event&&isActive(p)&&!hasPendingFatal(s,actorId);
  return {abilityId:id,name:CONDITIONAL_ABILITIES[id].name,description:CONDITIONAL_ABILITIES[id].description,enabled,active,suppressed:enabled&&!active,selectedTargetIds:[...(selected?.targetIds??[])],...(id===LIA_AURA?{eligibleTargetIds:targets(s,actorId)}:{}),targetEventId:event,canActivate:available&&canUseCharacterAbility(p,s)&&!s.used?.includes(key(event!,actorId,id))&&(!enabled||id===LIA_AURA),canDeactivate:available&&enabled};
 });
}
export function transitionConditionalAbility(s:GameState,input:GameInput):TransitionResult|undefined{
 const c=input.command;if(c.type!=='SET_CONDITIONAL_ABILITY')return;
 const o=conditionalAbilitySettings(s,input.actorId).find(o=>o.abilityId===c.abilityId);
 if(!o||(c.enabled?!o.canActivate:!o.canDeactivate))return {ok:false,code:'ABILITY_DISABLED'};
 if(c.targetEventId!==o.targetEventId)return {ok:false,code:'INVALID_TARGET'};
 const chosen=c.targetIds??[];
 if(chosen.some(id=>!o.eligibleTargetIds?.includes(id)))return {ok:false,code:'INVALID_TARGET'};
 if(c.enabled&&o.enabled&&JSON.stringify([...chosen].sort())===JSON.stringify([...o.selectedTargetIds].sort()))return {ok:false,code:'INVALID_COMMAND'};
 const next=structuredClone(s),p=next.players[input.actorId]!;
 if(!c.enabled){p.conditionalSelections=p.conditionalSelections?.filter(x=>x.abilityId!==c.abilityId)??[];for(const pending of Object.values(next.abilities??{}))if(pending.actorId===p.id&&pending.abilityId===c.abilityId&&pending.context.kind==='conditional-stat'&&!pending.canceled){pending.canceled=true;}recordAbility(next,'ABILITY_CANCELED',p.id,c.abilityId,o.selectedTargetIds);}
 else {
  const w=next.windows?.at(-1);
  const f:AbilityFrame={source:'ability',id:`ability-${next.nextEventId++}`,abilityId:c.abilityId,actorId:p.id,targetIds:[...chosen].sort(),eventId:c.targetEventId,parentWindowId:w?.id??null,useOrdinal:1,costs:{ownAction:false},stage:'declaration',canceled:false,rollIds:[],context:{kind:'conditional-stat',sourceCharacterId:c.abilityId.split('-ab')[0]!,opportunityId:c.targetEventId}};
  (next.abilities??={})[f.id]=f;recordAbility(next,'ABILITY_DECLARED',f.actorId,f.abilityId,f.targetIds.filter(id=>id!==f.actorId));(next.used??=[]).push(key(c.targetEventId,p.id,c.abilityId));
  openWindow(next,'declaration',f.eventId,{kind:'ability',id:f.id},w?participants(next,(next.seatOrder.indexOf(p.id)+1)%next.seatOrder.length):participants(next));
 }
 next.revision++;return {ok:true,state:next,events:[]};
}
export function resolveConditionalAbility(s:GameState,f:AbilityFrame):void{
 if(!isConditionalAbility(f.abilityId)||f.context.kind!=='conditional-stat')return;
 const p=s.players[f.actorId]!;
 if(f.canceled||!isActive(p)||!canUseCharacterAbility(p,s)||hasPendingFatal(s,p.id)||!ownsAbility(p,f.abilityId)||f.targetIds.some(id=>!targets(s,p.id).includes(id)))return;
 p.conditionalSelections=(p.conditionalSelections??[]).filter(x=>x.abilityId!==f.abilityId);
 p.conditionalSelections.push({abilityId:f.abilityId,sourceCharacterId:f.context.sourceCharacterId,targetIds:[...f.targetIds]});
}
