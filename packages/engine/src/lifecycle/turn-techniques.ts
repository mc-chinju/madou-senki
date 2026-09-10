import {enqueueLifecycle} from './events.js';
import {resolveMagicGate} from './magic-gate.js';
import type {GameState,PlayerState} from '../state.js';
import type {ActionFrame,Technique} from '../reactions/continuations.js';
import {isActive} from './objectives.js';
const fixed=['c2-p01-r1c1','c2-p01-r2c1','c2-p02-r1c2','c2-p02-r2c2','c2-p03-r1c2','c2-p07-r1c1','c2-p05-r2c2','c2-p06-r1c1','c2-p07-r1c2'];
export function canRevivalConvert(source:PlayerState,target:PlayerState):boolean{
 return !fixed.includes(target.characterId)&&(!['c2-p06-r1c2','c2-p06-r2c2'].includes(target.characterId)||source.faction!=='GOOD');
}
export function validTurnTechniqueTargets(s:GameState,actorId:string,t:Technique,targets:string[],convert:string[]):boolean{
 const source=s.players[actorId]!;
 if(!t.turnEffect||!targets.length||targets.some(id=>!Object.hasOwn(s.players,id)))return false;
 if(t.turnEffect==='magic-gate')return targets.length===1&&targets[0]!==actorId&&isActive(s.players[targets[0]!]!)&&!convert.length;
 if(t.turnEffect==='revive')return (t.target==='all'||targets.length===1)&&targets.every(id=>s.players[id]!.presence==='dead')&&(!convert.length||!!t.revivalConversion)&&convert.every(id=>targets.includes(id)&&canRevivalConvert(source,s.players[id]!));
 if(convert.length||targets.length!==1)return false;
 if(t.turnEffect==='heal-self')return targets[0]===actorId&&isActive(source);
 const target=s.players[targets[0]!]!;return target.id!==actorId&&isActive(target)&&s.distances[actorId]![target.id]==='near';
}
export function resolveTurnTechnique(s:GameState,a:ActionFrame):void{
 const p=s.players[a.actorId]!;const effect=a.technique.turnEffect;
 if(!isActive(p))return;
 if(effect==='magic-gate'){resolveMagicGate(s,a);return;}
 if(effect==='revive'){
  // The selected set is stable; invalidated targets are skipped, never replaced.
  enqueueLifecycle(s,{kind:'resume-phase',rootEventIds:[a.eventId],id:`resume-${a.id}`,phase:'hand-adjustment'});
  enqueueLifecycle(s,{kind:'protection',rootEventIds:[a.eventId],id:`protection-${a.id}`});
  enqueueLifecycle(s,{kind:'technique-revival',rootEventIds:[a.eventId],id:`revive-${a.id}`,sourceActorId:p.id,targetIds:[...a.targetIds],convertTargetIds:[...(a.convertTargetIds??[])],cursor:0});
 }else if(validTurnTechniqueTargets(s,p.id,a.technique,a.targetIds,[]))s.players[a.targetIds[0]!]!.damage=0;
}
