import {it,expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';
it.each(['c2-p03-r2c1-ab01','c2-p06-r1c1-ab01','c2-p06-r1c2-ab01'])('mental defense %s uses one strict plain declaration',abilityId=>{
 const command={type:'USE_ABILITY',abilityId,targetEventId:'g-42-1'};
 expect(parseGameCommand(command)).toEqual({ok:true,value:command});
 for(const patch of [{abilityEffectIds:[]},{faces:[6,6]},{success:false},{pendingFatal:true},{targetId:'C'},
  {sourceActorId:'C'},{expiresOnActorId:'B'},{currentObjective:{kind:'extinction',enemyFactions:[]}},
  {defeatCondition:'なし'},{protection:{characterIds:[]}}]){
  expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
 }
});
