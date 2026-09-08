import {expect,it} from 'vitest';
import {parseGameCommand} from '../src/index.js';
const base={type:'ATTACK',cardInstanceId:'a2-p20-r3c1',targetIds:['B','C'],dedicated:true};
it('physical follower attacks retain existing exact ATTACK wire',()=>{expect(parseGameCommand(base)).toEqual({ok:true,value:base});});
it('Beast physical follower co-source retains exact explicit dedication wire',()=>{const value={...base,cardInstanceId:'a2-p09-r1c1',coSource:{cardInstanceId:'a2-p20-r3c1',dedicated:true}};expect(parseGameCommand(value)).toEqual({ok:true,value});});
it.each([{sourceZone:'followers'},{followerPosition:0},{targetMode:'mandatory-all'},{sourceActorId:'B'}])('rejects forged source/target mode assertions %j',extra=>{expect(parseGameCommand({...base,...extra}).ok).toBe(false);});
it.each([{sourceZone:'followers'},{fromFollowers:true},{actorId:'B'}])('rejects forged co-source origin %j',extra=>{expect(parseGameCommand({...base,cardInstanceId:'a2-p09-r1c1',coSource:{cardInstanceId:'a2-p20-r3c1',dedicated:true,...extra}}).ok).toBe(false);});
