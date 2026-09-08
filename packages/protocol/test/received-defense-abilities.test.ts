import {it,expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';
it.each(['c2-p03-r1c1-ab02','c2-p03-r1c2-ab01','c2-p07-r1c1-ab01','c2-p05-r2c2-ab02','c2-p01-r1c1-ab01','c2-p02-r1c2-ab01','c2-p02-r1c2-ab02','c2-p02-r2c2-ab01','c2-p03-r1c1-ab01','c2-p03-r2c2-ab01','c2-p04-r1c1-ab01','c2-p05-r2c1-ab01','c2-p05-r2c2-ab01','c2-p06-r2c1-ab01','c2-p07-r1c2-ab01'])('received package %s uses strict plain command without forged outcome or split effects',abilityId=>{
 const command={type:'USE_ABILITY',abilityId,targetEventId:'g-42-1'};expect(parseGameCommand(command)).toEqual({ok:true,value:command});
 for(const patch of [{abilityEffectIds:[]},{abilityEffectIds:['spirit-conversion']},{effectLevel:3},{reduction:1},{defended:true},{targetId:'C'},{hitIndex:1},{bodyDamage:{directDamage:2,resistanceDamage:0,total:2}},{reflection:{source:'ability'}},{rollResult:6},{checkSuccess:true}])expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
});
