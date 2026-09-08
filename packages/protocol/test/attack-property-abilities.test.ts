import {it,expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';
it.each(['c2-p02-r2c1-ab01','c2-p03-r2c2-ab03'])('plain %s package uses existing strict command; no invented split or property payload',abilityId=>{
 const c={type:'USE_ABILITY',abilityId,targetEventId:'a-1'};expect(parseGameCommand(c)).toEqual({ok:true,value:c});
 for(const patch of [{abilityEffectIds:['spirit-conversion']},{abilityEffectIds:[]},{maaiRequired:3},{evadeProhibited:true},{damage:2},{actorId:'B'}])expect(parseGameCommand({...c,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
});
