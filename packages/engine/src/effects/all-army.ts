import {requirePhysicalAction} from '../combat/action-source.js';
import {getAction,getCharacter} from '@madou/catalog';
import {followerBottomFor} from './follower-attacks.js';
import {followerFor} from './follower-descriptors.js';
import {gameStats} from '../game-stats.js';
import {hasStatus,hasPendingFatal,type GameState} from '../state.js';
import type {GameInput,TransitionResult} from '../commands.js';
import type {ActionFrame} from '../reactions/continuations.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {acceptActionModifiers} from '../abilities/action-modifiers.js';
import {legalAttackTargets} from '../combat/legality.js';
import {openWindow} from '../reactions/windows.js';
import {beginRoll} from '../rolls/advance.js';
import {techniqueFor} from './registry.js';
export const ALL_ARMY='a2-p05-r2c2';
/** No default school, distance, level or damage for incomplete printed input. */
export function completeArmyProfile(bottom:unknown):boolean{
 if(!bottom||typeof bottom!=='object')return false;
 const b=bottom as {attributes?:unknown;level?:unknown;damage?:unknown;additional?:unknown},attrs=b.attributes;
 return Array.isArray(attrs)&&attrs.every(a=>typeof a==='string')&&attrs.filter(a=>a==='戦'||a==='魔').length===1&&attrs.filter(a=>a==='近'||a==='遠').length===1&&
  (typeof b.level==='number'&&Number.isFinite(b.level)&&b.level>=0||b.level==='戦士Lv'||b.level==='3+1d6')&&
  (typeof b.damage==='number'&&Number.isFinite(b.damage)&&b.damage>=0||['2d6','10+2d6','4+1d6'].includes(b.damage as string))&&typeof b.additional==='string';
}
export function armyBottomFor(id:string){
 const card=getAction(id);if(card?.category!=='follower'||!completeArmyProfile(card.stats?.attack))return;
 const t=followerBottomFor(id);if(!t)return;
 const extra=(card.stats!.attack as {additional:string}).additional;
 t.followerIgnore=extra.includes('従者無視');if(extra.includes('追加1枚の間合い'))t.maaiRequired=2;if(extra.includes('間合い不可'))t.maaiProhibited=true;
 return t;
}
function eligible(s:GameState,actorId:string){const p=s.players[actorId];return !!p&&!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]===actorId&&(p.presence??'active')==='active'&&!hasStatus(p,'stopped')&&!hasPendingFatal(s,actorId)&&p.hand.includes(ALL_ARMY);}
export function allArmyOptions(s:GameState,actorId:string){
 if(!eligible(s,actorId))return [];const p=s.players[actorId]!,restrictions=getCharacter(p.characterId)!.restrictions;
 return p.hand.flatMap(followerCardInstanceId=>{
  const t=armyBottomFor(followerCardInstanceId);if(!t||t.school==='magic'&&hasStatus(p,'silenced')||t.attributes.includes('白')&&restrictions.includes('白技使用不可')||t.attributes.includes('黒')&&restrictions.includes('黒技使用不可'))return [];
  const targetIds=legalAttackTargets(s,actorId,t);if(!targetIds.length)return [];
  return [{followerCardInstanceId,legalTargetIds:targetIds,targetMode:t.mandatoryAll?'mandatory-all' as const:t.target==='all'?'selected-all' as const:'one' as const,range:t.range,attributes:[...t.attributes],effectLevel:t.useLevelSource==='own-warrior'?gameStats(s,actorId).warrior_level:t.effectLevelFormula?'3+1d6':t.effectLevel,moraleRequired:followerFor(followerCardInstanceId)!.moraleRequired}];
 });
}
export function transitionAllArmy(state:GameState,input:GameInput):TransitionResult|undefined{
 const c=input.command;if(c.type!=='PLAY_ALL_ARMY')return;
 const o=allArmyOptions(state,input.actorId).find(o=>o.followerCardInstanceId===c.followerCardInstanceId);
 if(!o)return {ok:false,code:'UNSUPPORTED_CARD'};
 if(!c.targetIds.length||c.targetIds.some(id=>!o.legalTargetIds.includes(id))||o.targetMode==='one'&&c.targetIds.length!==1||o.targetMode==='mandatory-all'&&c.targetIds.length!==o.legalTargetIds.length)return {ok:false,code:'INVALID_TARGET'};
 const s=structuredClone(state),p=s.players[input.actorId]!,t=armyBottomFor(c.followerCardInstanceId)!,id=`a-${s.nextEventId++}`,childId=`a-${s.nextEventId++}`,lifeId=lifeIdentity(p);
 if(t.useLevelSource==='own-warrior'){t.useLevel=gameStats(s,p.id).warrior_level;t.effectLevel=t.useLevel;}
 const stats=gameStats(s,p.id,{technique:t}),checkSpecs:NonNullable<ActionFrame['checkSpecs']>=Array.from({length:Math.max(0,t.useLevel-(t.school==='warrior'?stats.warrior_level:stats.magic_level))},()=>({purpose:'excess-level',modifier:0}));
 const parent:ActionFrame={id,eventId:id,parentWindowId:null,actorId:p.id,cardInstanceId:ALL_ARMY,kind:'reaction',allArmy:{childId,followerCardInstanceId:c.followerCardInstanceId},reclaimOwnerLifeId:lifeId,targetIds:[...c.targetIds],technique:techniqueFor('a2-p05-r3c1')!,groupId:null,stage:'declaration',checks:[],roll:null,canceled:false};
 const child:ActionFrame={id:childId,eventId:id,parentWindowId:null,actorId:p.id,cardInstanceId:c.followerCardInstanceId,kind:'attack',allArmyParentId:id,sourceZone:'hand',reclaimOwnerLifeId:lifeId,targetIds:[...c.targetIds],technique:t,groupId:null,stage:'declaration',checks:checkSpecs.map(c=>c.modifier),checkSpecs,roll:null,canceled:false};
 for(const card of [ALL_ARMY,c.followerCardInstanceId]){p.hand.splice(p.hand.indexOf(card),1);s.resolution.push(card);}
 (s.actions??={})[id]=parent;s.actions[childId]=child;acceptActionModifiers(s,child);s.phase='combat';openWindow(s,'declaration',id,{kind:'action',id});s.revision++;return {ok:true,state:s,events:[]};
}
export function beginArmyChild(s:GameState,a:ActionFrame):void{const child=s.actions?.[a.allArmy!.childId];if(child){a.stage='resolve';openWindow(s,'declaration',a.eventId,{kind:'action',id:child.id});}}
export function advanceArmyMorale(s:GameState,a:ActionFrame,dice:()=>number):boolean{
 requirePhysicalAction(a);
 const f=followerFor(a.cardInstanceId)!;if(!f.moraleRequired){a.allArmyMoraleDone=true;return true;}
 if(!a.allArmyMoraleRollId){a.allArmyMoraleRollId=beginRoll(s,{eventId:a.eventId,rollerId:a.actorId,purpose:'follower-morale',formula:'2d6',check:{base:'morale',modifier:f.moraleModifier},resume:{kind:'technique',actionId:a.id}},dice).id;return false;}
 const roll=s.rolls!.find(r=>r.id===a.allArmyMoraleRollId)!;if(roll.stage!=='applied')return false;
 a.allArmyMoraleDone=true;if(!roll.success)a.canceled=true;return true;
}
