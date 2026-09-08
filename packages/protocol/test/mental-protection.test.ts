import {it,expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';
const ids=['c2-p01-r1c2-ab04','c2-p01-r2c1-ab04','c2-p01-r2c2-ab04','c2-p02-r1c1-ab03','c2-p02-r2c2-ab03','c2-p05-r1c1-ab03','c2-p05-r2c1-ab02','c2-p06-r1c1-ab02'];
it.each(ids)('%s uses ordinary strict declaration without client-selected protection clause',abilityId=>{
 const command={type:'USE_ABILITY',abilityId,targetEventId:'ability-42'};
 expect(parseGameCommand(command)).toEqual({ok:true,value:command});
 for(const patch of [{sourceAbilityId:'ability-7'},{rollId:'roll-7'},{mentalGuards:[]},{mentalStopReserved:true},{context:{kind:'mental-guard'}},{clause:'technique'},{description:'forged'},{success:true},{faces:[6,6]},{targetId:'B'}])expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
});
