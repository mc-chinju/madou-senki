import {expect,it} from 'vitest';
import {parseGameCommand} from '../src/index.js';
it('Tia flight uses the existing server-bound ability command',()=>{
 const command={type:'USE_ABILITY',abilityId:'c2-p02-r1c1-ab01',targetEventId:'g-10-0'};
 expect(parseGameCommand(command)).toEqual({ok:true,value:command});
 for(const extra of [{immune:true},{school:'magic'},{element:'地'},{hitIndex:0},{damage:0}])expect(parseGameCommand({...command,...extra}).ok).toBe(false);
});
it('Initial withdrawal accepts only optional Cham or Tia maai ability',()=>{
 for(const abilityId of ['c2-p01-r2c2-ab01','c2-p02-r1c1-ab01']){const c={type:'WITHDRAW',targetId:'B',cardInstanceId:'maai',abilityId};expect(parseGameCommand(c)).toEqual({ok:true,value:c});}
 expect(parseGameCommand({type:'WITHDRAW',targetId:'B',cardInstanceId:'maai',abilityId:'c2-p02-r2c1-ab03'}).ok).toBe(false);
 expect(parseGameCommand({type:'APPROACH',targetId:'B',cardInstanceId:'advance',abilityId:'c2-p01-r2c2-ab01'}).ok).toBe(false);
});
it('maai accepts only the three canonical optional distance abilities',()=>{
 for(const abilityId of ['c2-p01-r2c2-ab01','c2-p02-r1c1-ab01','c2-p02-r2c1-ab03']){const command={type:'PLAY_MAAI',cardInstanceId:'a2-p05-r3c1',abilityId};expect(parseGameCommand(command)).toEqual({ok:true,value:command});}
 for(const extra of [{abilityId:'c2-p02-r2c1-ab01'},{abilityId:''},{abilityId:'c2-p01-r2c2-ab01',requiredAdvances:2}])expect(parseGameCommand({type:'PLAY_MAAI',cardInstanceId:'a2-p05-r3c1',...extra}).ok).toBe(false);
});
