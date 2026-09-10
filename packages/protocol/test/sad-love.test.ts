import {expect,it} from 'vitest';
import {parseGameCommand} from '../src/validation.js';
it('Sad love accepts only explicit aura state or a bound substitution hit',()=>{
 const common={type:'USE_ABILITY',abilityId:'c2-p05-r1c2-ab05',targetEventId:'a-1'},aura={...common,mode:'aura',enabled:true},sub={...common,mode:'substitute',targetId:'B',groupId:'g-1',hitIndex:0};
 expect(parseGameCommand(aura).ok).toBe(true);expect(parseGameCommand({...aura,enabled:false}).ok).toBe(true);expect(parseGameCommand(sub).ok).toBe(true);
 for(const c of [common,{...aura,enabled:undefined},{...aura,targetId:'B'},{...sub,hitIndex:-1},{...sub,hitIndex:6},{...sub,hitIndex:0.5},{...sub,enabled:true},{...sub,damage:10},{...sub,sourceLifeId:'fake'},{...aura,abilityId:'c2-p04-r1c2-ab02'}])expect(parseGameCommand(c).ok).toBe(false);
});
