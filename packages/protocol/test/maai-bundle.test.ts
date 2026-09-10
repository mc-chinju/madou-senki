import {it,expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';
it('atomic maai accepts distinct physical cards and preserves the optional elected ability',()=>{
 const command={type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c2',additionalCardInstanceIds:['a2-p07-r1c3'],abilityId:'c2-p01-r2c2-ab01'};
 expect(parseGameCommand(command)).toEqual({ok:true,value:command});
 const single={type:'PLAY_MAAI',cardInstanceId:command.cardInstanceId};expect(parseGameCommand(single)).toEqual({ok:true,value:single});
});
it.each([undefined,null,[],['a2-p07-r1c2'],['a2-p07-r1c3','a2-p07-r1c3'],[''],[1],'a2-p07-r1c3'])('atomic maai rejects malformed or duplicate additional payment %j',additionalCardInstanceIds=>{
 expect(parseGameCommand({type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c2',additionalCardInstanceIds})).toEqual({ok:false,code:'INVALID_COMMAND'});
});
it('atomic maai payload cannot override required count or attach to unrelated commands',()=>{
 const command={type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c2',additionalCardInstanceIds:['a2-p07-r1c3']};
 for(const patch of [{maaiRequired:1},{actorId:'C'},{type:'PLAY_ADVANCE'},{type:'APPROACH',targetId:'A'}])expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
});
