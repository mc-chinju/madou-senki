import {expect,it} from 'vitest';
import {parseGameCommand} from '../src/index.js';
const command={type:'PLAY_ALL_ARMY',cardInstanceId:'a2-p05-r2c2',followerCardInstanceId:'a2-p20-r3c1',targetIds:['B']};
it('accepts exactly one physical follower and copies the target selection',()=>{const r=parseGameCommand(command);expect(r).toEqual({ok:true,value:command});if(r.ok&&r.value.type==='PLAY_ALL_ARMY')expect(r.value.targetIds).not.toBe(command.targetIds);});
it.each([{cardInstanceId:'a2-p05-r2c1'},{followerCardInstanceId:null},{followerCardInstanceId:['a2-p20-r3c1']},{followerCardInstanceIds:['a2-p20-r3c1','a2-p21-r3c3']},{targetIds:[]},{targetIds:['B','B']},{profile:{damage:100}},{moraleRequired:false}])('rejects malformed or client-authored army input %j',change=>expect(parseGameCommand({...command,...change}).ok).toBe(false));
