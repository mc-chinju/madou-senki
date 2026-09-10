import {it,expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';
it('Dark Saint ignore accepts an explicit boolean only and never accepts caller-supplied hidden physical identity',()=>{
 for(const ignore of [false,true]){const c={type:'CHOOSE_DARK_SAINT_IGNORE',ignore};expect(parseGameCommand(c)).toEqual({ok:true,value:c});for(const extra of [{targetId:'A'},{cardInstanceId:'a2-p21-r2c1'},{actorId:'B'}])expect(parseGameCommand({...c,...extra}).ok).toBe(false);}
 for(const ignore of [undefined,null,0,'true'])expect(parseGameCommand({type:'CHOOSE_DARK_SAINT_IGNORE',ignore}).ok).toBe(false);
});
