import {getAction,type ActionCard} from '@madou/catalog';
import type {GameState} from '../state.js';
import {canUseCharacterAbility,hasPendingFatal} from '../state.js';
import type {GameInput,TransitionResult} from '../commands.js';
import {isActive} from '../lifecycle/objectives.js';
import {revealCharacter} from './character-visibility.js';
import {openWindow,participants} from '../reactions/windows.js';
import {beginRoll} from '../rolls/advance.js';
import type {AbilityFrame,AbilityOption} from './frames.js';
import {ownsAbility} from './ownership.js';
import {beginInspection} from './private-inspection.js';
import {revealExpiryActor} from './spirit-lifetime.js';
import {TURN_PACKAGES,isTurnPackage,mainTurnPackage,CHAM_INSPECT,LIA_INSPECT,LESTER_INSPECT,STAR_INSPECT,ALSEIL_SHADOW,TRUE_POWER,UONOS_REVEAL,LANCASTER_DISCARD,type TurnPackageId} from './turn-packages.js';
export interface TurnAbilityContext {kind:'turn-information';turnNumber:number;sourceCharacterId:string;phase:GameState['phase'];drawOpportunity?:boolean;expiresOnActorId?:string}
export function isPrintedMagicTechnique(card:ActionCard|undefined):boolean{
 if(card?.category!=='technique')return false;
 const stats=card.stats;
 return stats?.school==='魔'||stats?.school===undefined&&Array.isArray(stats?.attributes)&&stats.attributes.includes('魔');
}
const PUBLIC_WINDOWS=new Set(['declaration','before-roll','after-roll','effect-level','damage','attack-abilities','hit-abilities','follower-entry-abilities','hit','follower-start']);
function usable(s:GameState,actorId:string,id:string):boolean{const p=s.players[actorId];return !!p&&!s.outcome&&isActive(p)&&canUseCharacterAbility(p)&&!hasPendingFatal(s,actorId)&&ownsAbility(p,id);}
function turnKey(s:GameState,actorId:string,id:string):string{return `own-turn-${s.turnNumber??0}:${actorId}:${id}`;}
export function turnTargets(s:GameState,actorId:string,id:string):string[]|undefined{
 if(id===LANCASTER_DISCARD||id===ALSEIL_SHADOW)return;
 return s.seatOrder.filter(targetId=>{const p=s.players[targetId]!;if(!isActive(p))return false;
  if(id===LIA_INSPECT)return s.distances[actorId]?.[targetId]==='near';
  if(id===LESTER_INSPECT||id===UONOS_REVEAL)return !p.revealed;
  if(id==='c2-p04-r1c1-ab04'||id==='c2-p06-r2c1-ab04')return p.revealed&&p.characterId===(id==='c2-p04-r1c1-ab04'?'c2-p06-r2c1':'c2-p04-r1c1');
  return true;
 });
}
export function turnAbilityOptions(s:GameState,actorId:string):AbilityOption[]{
 const w=s.windows?.at(-1);if(s.seatOrder[s.turnSeat]!==actorId||s.phase==='setup'||s.phase==='turn-start'||s.inspections?.length||w&&(!PUBLIC_WINDOWS.has(w.kind)||w.participants[w.cursor]!==actorId)||s.lifecycle?.some(t=>'waiting' in t&&t.waiting))return [];
 const eventId=w?.eventId??`turn-${s.turnNumber??0}-${actorId}-${s.phase}`;
 return (Object.keys(TURN_PACKAGES) as TurnPackageId[]).flatMap(id=>{
  if(TURN_PACKAGES[id].kind!=='turn-information'||!usable(s,actorId,id)||s.used?.includes(turnKey(s,actorId,id)))return [];
  if(mainTurnPackage(id)&&(w||s.phase!=='action'))return [];
  if(id===ALSEIL_SHADOW&&!s.players[actorId]!.revealed)return [];
  if(id===LIA_INSPECT&&(s.phase==='combat'||Object.keys(s.groups??{}).length>0))return [];
  const targets=turnTargets(s,actorId,id);if(targets&&!targets.length)return [];
  return [{abilityId:id,name:TURN_PACKAGES[id].name,targetEventId:eventId,actionCost:mainTurnPackage(id)?'main' as const:'extra' as const,...(targets?{targetIds:targets}:{})}];
 });
}
export function drawAbilityOptions(s:GameState,actorId:string):{abilityId:string;name:string}[]{
 if(s.phase!=='draw'||s.seatOrder[s.turnSeat]!==actorId||s.windows?.length||s.lifecycle?.length)return [];
 return (['c2-p01-r2c2-ab02','c2-p07-r1c1-ab03'] as const).filter(id=>usable(s,actorId,id)).map(id=>({abilityId:id,name:TURN_PACKAGES[id].name}));
}
export function revealAbilityOptions(s:GameState,actorId:string):{abilityId:typeof TRUE_POWER;name:string}[]{return usable(s,actorId,TRUE_POWER)&&!s.players[actorId]!.revealed?[{abilityId:TRUE_POWER,name:TURN_PACKAGES[TRUE_POWER].name}]:[];}
/** Called only after an accepted actual voluntary hidden→public transition. */
export function beginTurnPackage(s:GameState,actorId:string,id:TurnPackageId,eventId:string,targetIds:string[],extra:Partial<TurnAbilityContext>={}):void{
 const w=s.windows?.at(-1);const f:AbilityFrame={source:'ability',id:`ability-${s.nextEventId++}`,abilityId:id,actorId,targetIds,eventId,parentWindowId:w?.id??null,useOrdinal:1,costs:{ownAction:mainTurnPackage(id)},stage:'declaration',canceled:false,rollIds:[],context:{kind:'turn-information',sourceCharacterId:s.players[actorId]!.characterId,turnNumber:s.turnNumber??0,phase:s.phase,...extra}};
 (s.abilities??={})[f.id]=f;(s.used??=[]).push(turnKey(s,actorId,id));
 if(mainTurnPackage(id))s.phase='hand-adjustment';
 openWindow(s,'declaration',f.eventId,{kind:'ability',id:f.id},w?participants(s,(s.seatOrder.indexOf(actorId)+1)%s.seatOrder.length):participants(s));
}
export function transitionTurnPackage(s:GameState,input:GameInput):TransitionResult|undefined{
 const c=input.command;
 if(c.type==='CHOOSE_DRAW'&&c.abilityId){
  if(!c.draw||!drawAbilityOptions(s,input.actorId).some(o=>o.abilityId===c.abilityId))return {ok:false,code:'ABILITY_DISABLED'};
  const next=structuredClone(s);beginTurnPackage(next,input.actorId,c.abilityId as TurnPackageId,`draw-${next.nextEventId++}`,[input.actorId],{drawOpportunity:true});next.revision++;return {ok:true,state:next,events:[]};
 }
 if(c.type!=='USE_ABILITY'||!isTurnPackage(c.abilityId))return;
 const o=turnAbilityOptions(s,input.actorId).find(o=>o.abilityId===c.abilityId);if(!o)return {ok:false,code:'ABILITY_DISABLED'};
 if(c.targetEventId!==o.targetEventId)return {ok:false,code:'INVALID_TARGET'};
 if(c.costCardInstanceId!==undefined||c.conceal!==undefined||c.abilityEffectIds!==undefined)return {ok:false,code:'INVALID_COMMAND'};
 if(o.targetIds?!c.targetId||!o.targetIds.includes(c.targetId):c.targetId!==undefined)return {ok:false,code:'INVALID_TARGET'};
 const next=structuredClone(s);beginTurnPackage(next,input.actorId,c.abilityId,o.targetEventId,[c.targetId??input.actorId]);next.revision++;return {ok:true,state:next,events:[]};
}
function valid(s:GameState,f:AbilityFrame):boolean{
 if(f.context.kind!=='turn-information'||!usable(s,f.actorId,f.abilityId)||f.context.sourceCharacterId!==s.players[f.actorId]!.characterId)return false;
 if(f.abilityId===TRUE_POWER)return true;
 if(f.abilityId===ALSEIL_SHADOW)return s.players[f.actorId]!.revealed;
 const targets=turnTargets(s,f.actorId,f.abilityId);return !targets||targets.includes(f.targetIds[0]!);
}
/** Return true once effect (or its failure) is committed. Caller closes the original ability. */
export function resolveTurnPackage(s:GameState,f:AbilityFrame,dice:()=>number,now:number):boolean{
 if(f.context.kind!=='turn-information')throw Error('INVALID_TURN_CONTEXT');
 const id=f.abilityId,live=!f.canceled&&valid(s,f);
 if(f.context.drawOpportunity){
  (s.lifecycle??=[]).push({kind:'resume-phase',id:`resume-${f.id}`,phase:'action'},{kind:'draw',id:`draw-${f.id}`,actorId:f.actorId,target:s.players[f.actorId]!.hand.length+(live?2:1)});return true;
 }
 if(!live)return true;
 const modifier=id===LESTER_INSPECT?-3:id===ALSEIL_SHADOW||id===UONOS_REVEAL?-1:id===STAR_INSPECT?0:undefined;
 if(modifier!==undefined){
  if(f.stage==='declaration'){f.stage='self-check';const roll=beginRoll(s,{eventId:f.eventId,rollerId:f.actorId,purpose:'ability-check',formula:'2d6',check:{modifier,...(id===ALSEIL_SHADOW?{excludeSourceAbilityId:TRUE_POWER}:{})},resume:{kind:'ability',abilityId:f.id}},dice);f.rollIds.push(roll.id);return false;}
  const r=s.rolls?.find(r=>r.id===f.rollIds.at(-1));if(!r?.success)return true;
 }
 const p=s.players[f.actorId]!,target=s.players[f.targetIds[0]!]!;
 if(id===CHAM_INSPECT)beginInspection(s,f,'followers','none');
 else if(id===LIA_INSPECT)beginInspection(s,f,'chants','all');
 else if(id===LESTER_INSPECT)beginInspection(s,f,'character','none');
 else if(id===STAR_INSPECT)beginInspection(s,f,'hand','one');
 else if(id===LANCASTER_DISCARD){const ids=p.hand.filter(id=>isPrintedMagicTechnique(getAction(id)));p.hand=p.hand.filter(id=>!ids.includes(id));s.discard.push(...ids);}
 else if(id==='c2-p04-r1c1-ab04'||id==='c2-p06-r2c1-ab04'){[p.hand,target.hand]=[target.hand,p.hand];}
 else if(id===ALSEIL_SHADOW)p.revealed=false;
 else if(id===TRUE_POWER){p.spiritReplacements=(p.spiritReplacements??[]).filter(r=>r.sourceAbilityId!==TRUE_POWER);p.spiritReplacements.push({id:f.id,sourceAbilityId:TRUE_POWER,sourceCharacterId:p.characterId,base:12,expiresOnActorId:f.context.expiresOnActorId!,timing:'turn-end'});}
 else if(id===UONOS_REVEAL)revealCharacter(s,target.id,now);
 return true;
}
export function startVoluntaryBenefit(s:GameState,actorId:string,expiresOnActorId:string):void{beginTurnPackage(s,actorId,TRUE_POWER,`reveal-${s.nextEventId++}`,[actorId],{expiresOnActorId});}
export {revealExpiryActor};
