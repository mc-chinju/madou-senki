import {it,expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';
const command={type:'CHOOSE_BEAST_CAPTURE',groupId:'g-1',windowId:'w-1',cardInstanceIds:['a2-p20-r3c1']};
it('capture validates strict exact identity and copies bounded list; empty is explicit decline',()=>{
 for(const ids of [[],command.cardInstanceIds,['same','same']]){const c={...command,cardInstanceIds:ids};const r=parseGameCommand(c);expect(r).toEqual({ok:true,value:c});if(r.ok&&r.value.type==='CHOOSE_BEAST_CAPTURE')expect(r.value.cardInstanceIds).not.toBe(ids);}
 for(const patch of [{groupId:''},{windowId:''},{cardInstanceIds:['!']},{cardInstanceIds:Array(221).fill('x')},{cardInstanceIds:'all'},{actorId:'B'}])expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
 const {windowId,...missing}=command;expect(parseGameCommand(missing)).toEqual({ok:false,code:'INVALID_COMMAND'});
});
