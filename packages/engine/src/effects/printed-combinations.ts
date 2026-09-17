import {recordCardPlayed} from '../public-record.js';
import {getAction} from '@madou/catalog';
import type {GameState} from '../state.js';
import type {ActionFrame,Technique} from '../reactions/continuations.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {openWindow,participants} from '../reactions/windows.js';
import {reclaimEventId} from '../reclaim.js';
import {techniqueFor} from './registry.js';
import {getCharacter} from '@madou/catalog';
export const COMBINATION_SPIRIT='a2-p05-r1c3',COMBINATION_HARP='a2-p05-r2c1';
export interface CombinationSpirit {actorId:string;lifeId:string;sourceActionId:string;componentActionId:string;rootEventId:string;turnSeat:number;turnNumber:number}
export function validPrintedComponents(s:GameState,actorId:string,ids:readonly string[],t:Technique,defense:boolean):boolean{
 return (!ids.length||!defense||t.defense==='counter')&&ids.every(id=>s.players[actorId]!.hand.includes(id)&&(id===COMBINATION_SPIRIT||id===COMBINATION_HARP&&t.attributes.includes('精')&&Number.isFinite(t.effectLevel)));
}
/** All components are paid at the original declaration, independently cancellable and disposed. */
export function beginPrintedComponents(s:GameState,parent:ActionFrame,ids:readonly string[]):void{
 if(!ids.length)return;
 parent.printedComponents=ids.map(cardInstanceId=>({cardInstanceId,childId:`a-${s.nextEventId++}`,status:'pending'}));
 for(const source of parent.printedComponents){const p=s.players[parent.actorId]!;p.hand.splice(p.hand.indexOf(source.cardInstanceId),1);s.resolution.push(source.cardInstanceId);recordCardPlayed(s,p.id,source.cardInstanceId,parent.kind==='defense'?'counter':'attack',parent.targetIds);
  if(source.cardInstanceId===COMBINATION_SPIRIT)(s.combinationSpirit??=[]).push({actorId:p.id,lifeId:lifeIdentity(p),sourceActionId:parent.id,componentActionId:source.childId,rootEventId:reclaimEventId(s,parent),turnSeat:s.turnSeat,turnNumber:s.turnNumber??0});
 }
 nextPrintedComponent(s,parent);
}
export function nextPrintedComponent(s:GameState,parent:ActionFrame):void{
 const source=parent.printedComponents?.find(c=>c.status==='pending');if(!source)return;
 const a:ActionFrame={id:source.childId,eventId:parent.eventId,parentWindowId:s.windows?.at(-1)?.id??null,actorId:parent.actorId,cardInstanceId:source.cardInstanceId,kind:'reaction',printedComponentParentId:parent.id,reclaimOwnerLifeId:parent.reclaimOwnerLifeId??lifeIdentity(s.players[parent.actorId]!),targetIds:[],technique:{...structuredClone(parent.technique),damage:null},groupId:null,stage:'declaration',checks:[],roll:null,canceled:false};
 delete a.technique.damageFormula;delete a.technique.selfCost;
 s.actions![a.id]=a;openWindow(s,'declaration',a.eventId,{kind:'action',id:a.id},participants(s));
}
export function resolvePrintedComponent(s:GameState,a:ActionFrame):void{
 const parent=s.actions?.[a.printedComponentParentId!],source=parent?.printedComponents?.find(c=>c.childId===a.id);if(!source)return;
 source.status=a.canceled||parent!.canceled?'canceled':'active';
 if(source.status==='canceled')s.combinationSpirit=(s.combinationSpirit??[]).filter(b=>b.componentActionId!==a.id);
}
export function printedHarpBonus(a:ActionFrame,kind:'effect'|'damage'):number{return a.printedComponents?.some(c=>c.cardInstanceId===COMBINATION_HARP&&c.status==='active')?(kind==='effect'?2:4):0;}
export function combinationSpiritBonus(s:GameState,actorId:string):number{return (s.combinationSpirit??[]).filter(b=>b.actorId===actorId&&b.lifeId===lifeIdentity(s.players[actorId]!)).length*2;}
export function cleanCombinationSpirit(s:GameState):void{
 if(!s.combinationSpirit)return;
 s.combinationSpirit=s.combinationSpirit.filter(b=>['combat','withdrawal'].includes(s.phase)&&s.turnSeat===b.turnSeat&&(s.turnNumber??0)===b.turnNumber&&(s.players[b.actorId]!.presence??'active')==='active'&&lifeIdentity(s.players[b.actorId]!)===b.lifeId&&!s.actions?.[b.sourceActionId]?.canceled);
}
export function printedCombinationCards(s:GameState,actorId:string){return s.players[actorId]!.hand.filter((id):id is typeof COMBINATION_SPIRIT|typeof COMBINATION_HARP=>id===COMBINATION_SPIRIT||id===COMBINATION_HARP).map(cardInstanceId=>({cardInstanceId,label:getAction(cardInstanceId)!.name}));}
export function printedCombinationOptions(s:GameState,actorId:string){
 const p=s.players[actorId]!,w=s.windows?.at(-1),defense=w?.kind==='normal-defense';
 if(w&&!(defense||w.kind==='ability-attack')||w&&w.participants[w.cursor]!==actorId||!w&&(s.phase!=='action'||s.seatOrder[s.turnSeat]!==actorId))return [];
 const components=printedCombinationCards(s,actorId);
 return [...new Set([...p.hand,...p.chants.map(c=>c.cardInstanceId),...p.followers.map(c=>c.cardInstanceId)])].flatMap(cardInstanceId=>[false,true].flatMap(dedicated=>{
  const t=techniqueFor(cardInstanceId,getCharacter(p.characterId)?.name,dedicated);if(!t||t.turnEffect)return [];
  const componentIds=components.filter(c=>validPrintedComponents(s,actorId,[c.cardInstanceId],t,defense)).map(c=>c.cardInstanceId);
  return componentIds.length?[{cardInstanceId,dedicated,componentIds}]:[];
 }));
}
