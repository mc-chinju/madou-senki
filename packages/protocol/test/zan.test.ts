import {expect,it} from 'vitest';
import {parseGameCommand} from '../src/index.js';
it('Zan uses the server-bound ability command without client damage or maai history',()=>{const c={type:'USE_ABILITY',abilityId:'c2-p04-r1c2-ab02',targetEventId:'g-10-B-follower-entry'};expect(parseGameCommand(c)).toEqual({ok:true,value:c});for(const extra of [{damage:10},{multiplier:2},{maaiWasSubmitted:false},{hitIndex:0}])expect(parseGameCommand({...c,...extra}).ok).toBe(false);});
