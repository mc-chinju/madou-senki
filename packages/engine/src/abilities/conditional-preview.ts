import type {GameState} from '../state.js';
import type {Technique} from '../reactions/continuations.js';
import {conditionalTechniqueAdditions} from './conditional-stats.js';
export interface ConditionalTargetValue {actorId:string;effectLevel:number|string;damage:number|string}
/** Finite public target previews share the same live additive evaluator as action freeze. */
export function conditionalSourcePreview(s:GameState,actorId:string,t:Technique,targetIds:string[]):{effectLevel:number|string;damage:number|string;targetValues?:ConditionalTargetValue[]}{
 const source={actorId,kind:'attack' as const,technique:t,canceled:false};
 function values(targetId?:string){
  const add=conditionalTechniqueAdditions(s,source,targetId),multiplier=t.damageMultiplier??1;
  const effectLevel=t.effectLevelFormula?`${t.effectLevel+add.effect}+1d6`:t.effectLevel+add.effect;
  const addition=(t.damageAdditive??0)+add.damage;
  const formula=t.damageFormula?`${addition?`${addition}+`:''}${t.damageFormula==='d6'?'1d6':t.damageFormula}`:undefined;
  const damage=formula?(multiplier===1?formula:`(${formula})×${multiplier}`):t.damage===null?'−':Math.max(0,(t.damage+addition)*multiplier);
  return {effectLevel,damage};
 }
 const shared=values(),targetValues=targetIds.map(id=>({actorId:id,...values(id)}));
 return {...shared,...(targetValues.some(t=>t.effectLevel!==shared.effectLevel||t.damage!==shared.damage)?{targetValues}:{})};
}
