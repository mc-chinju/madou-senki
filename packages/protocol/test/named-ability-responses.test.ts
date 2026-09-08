import {it,expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';

it.each(['c2-p01-r2c1-ab05','c2-p07-r1c1-ab02'])('%s accepts an opaque exact source target and rejects client-created cancellation state',abilityId=>{
 const command={type:'USE_ABILITY',abilityId,targetEventId:'ability-42'};
 expect(parseGameCommand(command)).toEqual({ok:true,value:command});
 for(const patch of [{abilityEffectIds:[]},{abilityEffectIds:['spirit-conversion']},{targetAbilityId:'ability-43'},{sourceAbilityId:'ability-43'},{canceled:true},{permanentBan:true},{context:{kind:'ability-response',sourceAbilityId:'ability-43'}}]){
  expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
 }
});
