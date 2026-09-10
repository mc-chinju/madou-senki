import {expect,it} from 'vitest';
import {parseGameCommand} from '../src/index.js';
const attack={type:'ATTACK',cardInstanceId:'a2-p05-r3c1',targetIds:['B'],dedicated:false,dispel:{cardInstanceId:'a2-p02-r3c1',targetId:'B'}};
it('copies the finite pre-attack Dispel choice and retains declaration selections',()=>{
 const command={...attack,declarationAbilityIds:['c2-p01-r1c1-ab03']},r=parseGameCommand(command);expect(r).toEqual({ok:true,value:command});if(r.ok&&r.value.type==='ATTACK')expect(r.value.dispel).not.toBe(command.dispel);
});
it.each([null,{},'a2-p02-r3c1',{cardInstanceId:'a2-p02-r1c1',targetId:'B'},{...attack.dispel,targetId:4},{...attack.dispel,targets:['B']},{...attack.dispel,refill:true}])('rejects malformed or extended Dispel %j',dispel=>expect(parseGameCommand({...attack,dispel}).ok).toBe(false));
it('rejects nested accessors without executing them',()=>{let called=false;expect(parseGameCommand({...attack,dispel:{get cardInstanceId(){called=true;return 'a2-p02-r3c1';},targetId:'B'}}).ok).toBe(false);expect(called).toBe(false);});
