import {expect,it} from 'vitest';
import {parseGameCommand} from '../src/index.js';
it('virtual blade declaration accepts only two canonical sources and finite target binding',()=>{
 for(const abilityId of ['c2-p04-r1c1-ab02','c2-p06-r2c1-ab02']){const command={type:'DECLARE_VIRTUAL_BLADE',abilityId,targetIds:['B']};expect(parseGameCommand(command)).toEqual({ok:true,value:command});for(const extra of [{damage:100},{cardInstanceId:'invented'},{source:{kind:'ability'}},{targetIds:[]},{targetIds:['B','B']},{abilityId:'c2-p01-r1c1-ab01'}])expect(parseGameCommand({...command,...extra}).ok).toBe(false);}
});
