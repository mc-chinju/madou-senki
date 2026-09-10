import type {GameCommand} from '@madou/protocol';
import type {EngineErrorCode} from '../commands.js';
import {canUseCharacterAbility,hasStatus,type GameState} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import {ownsAbility} from './ownership.js';
import {lifeIdentity} from './suppression-state.js';
import {gameStats} from '../game-stats.js';
import {openWindow,participants} from '../reactions/windows.js';
import type {ActionFrame,Technique} from '../reactions/continuations.js';
import type {AbilityFrame} from './frames.js';
import {acceptActionModifiers} from './action-modifiers.js';
import {VIRTUAL_BLADES,type VirtualBladeId} from './virtual-blade-sources.js';
export {VIRTUAL_BLADES,type VirtualBladeId} from './virtual-blade-sources.js';
export function virtualBladeTechnique(id:VirtualBladeId):Technique{return {contract:{conditions:['own-action','character-specific'],costs:[],timing:['declaration','effect-level','damage','normal-defense','hit'],targets:'declared-players',lifetime:'attack-group'},school:'magic',range:'near',useLevel:4,effectLevel:4,damage:id==='c2-p04-r1c1-ab02'?3:5,attributes:['魔',id==='c2-p04-r1c1-ab02'?'水':'炎'],counter:false,chant:false,noChecks:false,defense:'none',hitCount:1,target:'one',followerIgnore:false,maaiRequired:id==='c2-p04-r1c1-ab02'?2:1};}
function live(s:GameState,actorId:string,id:VirtualBladeId){const p=s.players[actorId];return !!p&&isActive(p)&&p.revealed&&canUseCharacterAbility(p,s)&&ownsAbility(p,id)&&!hasStatus(p,'stopped')&&!hasStatus(p,'silenced');}
export function virtualBladeOptions(s:GameState,actorId:string){if(s.outcome||s.windows?.length||s.phase!=='action'||s.seatOrder[s.turnSeat]!==actorId)return [];return (Object.keys(VIRTUAL_BLADES) as VirtualBladeId[]).filter(id=>live(s,actorId,id)).map(abilityId=>({abilityId,name:VIRTUAL_BLADES[abilityId].name,technique:virtualBladeTechnique(abilityId),targetIds:s.seatOrder.filter(id=>id!==actorId&&isActive(s.players[id]!)&&s.distances[actorId]?.[id]==='near')}));}
export function acceptVirtualBlade(s:GameState,actorId:string,c:Extract<GameCommand,{type:'DECLARE_VIRTUAL_BLADE'}>):EngineErrorCode|undefined{
 if(c.targetEventId||s.windows?.length||s.phase!=='action')return 'WRONG_PHASE';if(s.seatOrder[s.turnSeat]!==actorId)return 'NOT_YOUR_TURN';
 const option=virtualBladeOptions(s,actorId).find(o=>o.abilityId===c.abilityId);if(!option)return 'ABILITY_DISABLED';if(c.targetIds.length!==1||!option.targetIds.includes(c.targetIds[0]!))return 'INVALID_TARGET';
 const p=s.players[actorId]!,id=`a-${s.nextEventId++}`,technique=option.technique,stats=gameStats(s,actorId,{technique}),checkSpecs:NonNullable<ActionFrame['checkSpecs']>=Array.from({length:Math.max(0,technique.useLevel-stats.magic_level)},()=>({purpose:'excess-level',modifier:0}));
 const a:ActionFrame={id,eventId:id,parentWindowId:null,actorId,cardInstanceId:null,source:{kind:'ability',abilityId:c.abilityId,actorId},sourceCardInstanceIds:[],kind:'attack',targetIds:[...c.targetIds],technique,groupId:null,stage:'declaration',checks:checkSpecs.map(c=>c.modifier),checkSpecs,roll:null,canceled:false};acceptActionModifiers(s,a);(s.actions??={})[id]=a;
 const f:AbilityFrame={source:'ability',id:`ability-${s.nextEventId++}`,abilityId:c.abilityId,actorId,targetIds:[...c.targetIds],eventId:id,parentWindowId:null,useOrdinal:1,costs:{ownAction:true},stage:'declaration',canceled:false,rollIds:[],context:{kind:'virtual-blade',actionId:id,lifeId:lifeIdentity(p)}};(s.abilities??={})[f.id]=f;s.phase='combat';openWindow(s,'declaration',id,{kind:'ability',id:f.id},participants(s));
}
export function resolveVirtualBlade(s:GameState,f:AbilityFrame){if(f.context.kind!=='virtual-blade')return;const a=s.actions?.[f.context.actionId];if(a)a.canceled=f.canceled||!live(s,f.actorId,f.abilityId as VirtualBladeId)||lifeIdentity(s.players[f.actorId]!)!==f.context.lifeId;return a;}
