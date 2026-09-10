import {expect,it} from 'vitest';
import {parseGameCommand} from '../src/validation.js';
it('Cham gift requires exactly one bound decision, physical hand card and recipient',()=>{const c={type:'CHAM_DEATH_GIFT',decisionId:'death-1',cardInstanceId:'a2-p03-r1c1',targetId:'B'};expect(parseGameCommand(c)).toEqual({ok:true,value:c});for(const bad of [{...c,decisionId:''},{...c,cardInstanceId:[]},{...c,targetId:null},{...c,giftCardInstanceId:'x'},{...c,cardInstanceIds:['x']},{...c,refill:true}])expect(parseGameCommand(bad).ok).toBe(false);});
