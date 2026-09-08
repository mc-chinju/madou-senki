import {it,expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';
const base={type:'USE_ABILITY',abilityId:'c2-p03-r2c1-ab02',targetEventId:'g-1'};
it('accepts only explicit nonempty unique Lester branch subsets',()=>{
 for(const abilityEffectIds of [['spirit-conversion'],['human-invalidation','arnes-suppression'],['spirit-conversion','human-invalidation','arnes-suppression']]){const c={...base,abilityEffectIds};expect(parseGameCommand(c)).toEqual({ok:true,value:c});}
 for(const extra of [{},{abilityEffectIds:[]},{abilityEffectIds:['human-invalidation','human-invalidation']},{abilityEffectIds:['invented']},{abilityEffectIds:['arnes-suppression'],abilityId:'c2-p03-r2c2-ab02'}])expect(parseGameCommand({...base,...extra}).ok).toBe(false);
});
