import {expect,it} from 'vitest';
import {parseGameCommand} from '../src/index.js';
it('Shadow jump payment accepts only its saved ability event and physical advance',()=>{
 const c={type:'PAY_SHADOW_JUMP',abilityEventId:'ability-12',advanceCardInstanceId:'a2-p06-r3c1'};expect(parseGameCommand(c)).toEqual({ok:true,value:c});for(const extra of [{damage:7},{targetIds:['A']},{followerIgnore:true},{abilityEventId:''},{advanceCardInstanceId:4}])expect(parseGameCommand({...c,...extra}).ok).toBe(false);
});
