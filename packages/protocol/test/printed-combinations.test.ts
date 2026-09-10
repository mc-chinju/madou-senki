import {expect,it} from 'vitest';
import {parseGameCommand} from '../src/index.js';
it.each(['ATTACK','PLAY_DEFENSE'])('%s copies finite printed components with declaration modifiers',type=>{
 const command={type,cardInstanceId:'a2-p17-r1c1',dedicated:false,...(type==='ATTACK'?{targetIds:['B']}:{}),combinationCardInstanceIds:['a2-p05-r1c3','a2-p05-r2c1'],declarationAbilityIds:['c2-p01-r1c1-ab03']},r=parseGameCommand(command);expect(r).toEqual({ok:true,value:command});if(r.ok&&'combinationCardInstanceIds' in r.value)expect(r.value.combinationCardInstanceIds).not.toBe(command.combinationCardInstanceIds);
});
it.each([null,['a2-p05-r1c3','a2-p05-r1c3'],['a2-p05-r2c2'],['a2-p05-r2c1','extra'],{}])('rejects invalid printed components %j',combinationCardInstanceIds=>expect(parseGameCommand({type:'ATTACK',cardInstanceId:'a2-p17-r1c1',dedicated:false,targetIds:['B'],combinationCardInstanceIds}).ok).toBe(false));
it('cannot add a combination to a past roll, reaction, approach or standalone turn card',()=>{for(const command of [{type:'PLAY_REACTION',cardInstanceId:'fate',mode:'force-fail',targetRollId:'roll'},{type:'APPROACH',cardInstanceId:'step',targetId:'B'},{type:'PLAY_TURN_CARD',cardInstanceIds:['a2-p05-r1c3']}])expect(parseGameCommand({...command,combinationCardInstanceIds:['a2-p05-r1c3']}).ok).toBe(false);});
