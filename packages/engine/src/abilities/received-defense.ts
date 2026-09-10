import {gameStats} from '../game-stats.js';
import {beginRoll} from '../rolls/advance.js';
import {startAbilityReflection} from '../combat/attack.js';
import type {GameState} from '../state.js';
import type {AbilityFrame,AbilityId,AbilityOption} from './frames.js';
import type {AttackGroup,AttackTarget,Technique} from '../reactions/continuations.js';
import {currentHit} from '../reactions/continuations.js';
import {activeAbilitySource,effectiveHitTechnique} from './follower-entry.js';
/** Complete C04 packages; numeric deductions and live immunity reservations have separate lifetimes. */
export const MAGIC_HALF='c2-p03-r1c1-ab02';
export const LIGHT_GRACE='c2-p03-r1c2-ab01';
export const LIGHT_SHIELD='c2-p07-r1c1-ab01';
export const MAJESTY='c2-p05-r2c2-ab02';
const PACKAGES={
 'c2-p02-r1c1-ab01':{earthMagic:true},
 [MAGIC_HALF]:{half:true},
 [LIGHT_GRACE]:{check:-3,dieReduction:true},
 [LIGHT_SHIELD]:{check:-5,warriorThreshold:true},
 [MAJESTY]:{check:-5,reflection:true},
 'c2-p01-r1c1-ab01':{threshold:5,lowDamage:true},
 'c2-p02-r1c2-ab01':{reduction:'magic'},
 'c2-p02-r1c2-ab02':{threshold:3},
 'c2-p02-r2c2-ab01':{reduction:'black',threshold:4},
 'c2-p03-r1c1-ab01':{threshold:3},
 'c2-p03-r2c2-ab01':{reduction:'magic'},
 'c2-p04-r1c1-ab01':{elements:true},
 'c2-p05-r2c1-ab01':{threshold:4,warriorOnly:true},
 'c2-p05-r2c2-ab01':{threshold:5},
 'c2-p06-r2c1-ab01':{elements:true},
 'c2-p07-r1c2-ab01':{threshold:5},
} satisfies Partial<Record<AbilityId,Package>>;
interface Package {earthMagic?:boolean;half?:boolean;check?:number;dieReduction?:boolean;warriorThreshold?:boolean;reflection?:boolean;threshold?:number;lowDamage?:boolean;reduction?:'magic'|'black';elements?:boolean;warriorOnly?:boolean}
export type ReceivedDefenseId=keyof typeof PACKAGES;
export interface ReceivedDefense {attempted:ReceivedDefenseId[];reductions:{abilityId:ReceivedDefenseId;amount:number}[];reserved:ReceivedDefenseId[];snapshotApplied?:boolean}
export function isReceivedDefense(id:string):id is ReceivedDefenseId {return Object.hasOwn(PACKAGES,id);}
function applicable(p:Package,t:Technique):boolean {return !(p.earthMagic&&(t.school!=='magic'||!t.attributes.includes('地'))||p.warriorOnly&&t.school!=='warrior'||p.elements&&!t.attributes.some(a=>a==='炎'||a==='水')||(p.reduction==='magic'||p.half)&&t.school!=='magic'||p.reflection&&!!t.counterProhibited);}
export function receivedDefenseOptions(s:GameState,actorId:string,add:(id:AbilityId,extra?:Partial<AbilityOption>)=>void):void {
 const w=s.windows?.at(-1);if(w?.kind!=='normal-defense'||w.continuation.kind!=='group'||w.continuation.targetId!==actorId)return;
 const g=s.groups?.[w.continuation.id],t=g?.targets.find(t=>t.actorId===actorId),h=g&&currentHit(g,actorId);
 if(!g||!t||!h||g.attackerId===actorId||g.stage!=='defense'||t.normalDefenseClosed||t.followerStarted||h.defended||h.passedDefense)return;
 const technique=effectiveHitTechnique(s,g,t,h);
 for(const id of Object.keys(PACKAGES) as ReceivedDefenseId[])if(activeAbilitySource(s,actorId,id)&&!h.receivedDefense?.attempted.includes(id)&&applicable(PACKAGES[id],technique)&&!(id===MAJESTY&&h.lineage.includes(MAJESTY)))add(id);
}
export function validReceivedDefense(s:GameState,f:AbilityFrame):boolean {
 const c=f.context;if(c.kind!=='group'||c.targetId!==f.actorId||!isReceivedDefense(f.abilityId))return false;
 const g=s.groups?.[c.groupId],t=g?.targets.find(t=>t.actorId===c.targetId),h=t?.hits.find(h=>h.index===c.hitIndex);
 return !!g&&!!t&&!!h&&g.stage==='defense'&&g.hitCursor===c.hitIndex&&!t.normalDefenseClosed&&!t.followerStarted&&!h.defended&&!h.passedDefense&&applicable(PACKAGES[f.abilityId],effectiveHitTechnique(s,g,t,h))&&!(f.abilityId===MAJESTY&&h.lineage.includes(MAJESTY));
}
export function receiveAttempt(s:GameState,f:AbilityFrame):void {
 if(f.context.kind!=='group'||!isReceivedDefense(f.abilityId))return;
 const c=f.context,h=s.groups![c.groupId]!.targets.find(t=>t.actorId===c.targetId)!.hits.find(h=>h.index===c.hitIndex)!;
 (h.receivedDefense??={attempted:[],reductions:[],reserved:[]}).attempted.push(f.abilityId);
}
/** Apply only the received numeric delta; all unrelated attacker properties remain live. */
export function receivedTechnique(h:AttackTarget['hits'][number],base:Technique):Technique {
 const received=h.receivedDefense;if(!received||received.snapshotApplied||!received.reductions.length)return base;
 return {...base,effectLevel:Math.max(0,base.effectLevel-received.reductions.reduce((sum,r)=>sum+r.amount,0))};
}
export function resolveReceivedDefense(s:GameState,f:AbilityFrame,dice:()=>number):boolean {
 if(f.context.kind!=='group'||!isReceivedDefense(f.abilityId))return true;
 const c=f.context,g=s.groups![c.groupId]!,t=g.targets.find(t=>t.actorId===c.targetId)!,h=t.hits.find(h=>h.index===c.hitIndex)!;
 const p:Package=PACKAGES[f.abilityId],received=h.receivedDefense!,technique=effectiveHitTechnique(s,g,t,h);
 if(p.check!==undefined){
  if(f.stage==='declaration'){
   f.stage='self-check';
   f.rollIds.push(beginRoll(s,{eventId:f.eventId,rollerId:f.actorId,purpose:'ability-check',formula:'2d6',check:{modifier:p.check},resume:{kind:'ability',abilityId:f.id}},dice).id);
   return false;
  }
  const latest=s.rolls!.find(r=>r.id===f.rollIds.at(-1))!;
  if(latest.stage!=='applied')return false;
  if(f.stage==='self-check'){
   if(!latest.success)return true;
   if(p.dieReduction){
    f.stage='numeric';
    f.rollIds.push(beginRoll(s,{eventId:f.eventId,rollerId:f.actorId,purpose:'ability-value',formula:'d6',resume:{kind:'ability',abilityId:f.id}},dice).id);
    return false;
   }
  }
  if(p.dieReduction){
   received.reductions.push({abilityId:f.abilityId,amount:Math.min(technique.effectLevel,latest.total!)});
   if(technique.effectLevel<=latest.total!)h.defended=true;
  }
  if(p.reflection){startAbilityReflection(s,g,t,h,f);return true;}
 }
 if(p.half||p.warriorThreshold)received.reserved.push(f.abilityId);
 if(p.reduction==='magic'&&technique.school==='magic'||p.reduction==='black'&&technique.attributes.includes('黒'))received.reductions.push({abilityId:f.abilityId,amount:Math.min(1,technique.effectLevel)});
 if(p.threshold!==undefined||p.elements||p.lowDamage||p.earthMagic)received.reserved.push(f.abilityId);
 evaluateReceivedReservations(s,g,t,h);
 return true;
}
export function evaluateReceivedReservations(s:GameState,g:AttackGroup,t:AttackTarget,h:AttackTarget['hits'][number]):void {
 if(g.stage!=='defense'||t.normalDefenseClosed||t.followerStarted||h.defended||h.passedDefense)return;
 const technique=effectiveHitTechnique(s,g,t,h);
 for(const id of h.receivedDefense?.reserved??[]){const p:Package=PACKAGES[id];if(!activeAbilitySource(s,t.actorId,id)||!applicable(p,technique))continue;
  if(p.earthMagic||p.warriorThreshold&&technique.effectLevel<=gameStats(s,t.actorId).warrior_level||p.threshold!==undefined&&technique.effectLevel<=p.threshold||p.lowDamage&&(h.damage===null||h.damage<=5)||p.elements&&technique.attributes.some(a=>a==='炎'||a==='水')){h.defended=true;return;}
 }
}
