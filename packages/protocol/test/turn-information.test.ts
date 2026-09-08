import {it,expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';
const draw='c2-p01-r2c2-ab02',truePower='c2-p04-r2c1-ab03';
it.each([
 {type:'USE_ABILITY',abilityId:'c2-p01-r2c2-ab03',targetEventId:'turn-1',targetId:'B'},
 {type:'CHOOSE_DRAW',draw:true,abilityId:draw},
 {type:'CHOOSE_DRAW',draw:true,abilityId:'c2-p07-r1c1-ab03'},
 {type:'REVEAL_CHARACTER',abilityId:truePower},
 {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'finish'},
 {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-one',cardInstanceId:'a2-p01-r1c1'},
 {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-all'},
])('strict turn command round trips $type',command=>{expect(parseGameCommand(command)).toEqual({ok:true,value:command});});
it.each([
 {type:'CHOOSE_DRAW',draw:false,abilityId:draw},
 {type:'CHOOSE_DRAW',draw:true,abilityId:truePower},
 {type:'CHOOSE_DRAW',draw:true,abilityId:undefined},
 {type:'REVEAL_CHARACTER',abilityId:draw},
 {type:'REVEAL_CHARACTER',abilityId:null},
 {type:'REVEAL_CHARACTER',abilityId:undefined},
 {type:'PASS',abilityId:truePower},
 {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-one'},
 {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-one',cardInstanceIds:['a2-p01-r1c1']},
 {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-all',cardInstanceId:'a2-p01-r1c1'},
 {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'finish',cardInstanceId:undefined},
 {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'finish',targetId:'B'},
 {type:'CHOOSE_INSPECTION',decisionId:'bad id',choice:'finish'},
 {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-one',cardInstanceId:5},
 {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'finish',actorId:'B'},
 {type:'USE_ABILITY',abilityId:draw,targetEventId:'x',targetId:null},
])('rejects misplaced or forged turn payload %#',command=>{expect(parseGameCommand(command)).toEqual({ok:false,code:'INVALID_COMMAND'});});
it('does not invoke hostile inspection accessors',()=>{let called=false;const value={type:'CHOOSE_INSPECTION',decisionId:'inspection-1',get choice(){called=true;return 'finish';}};expect(parseGameCommand(value).ok).toBe(false);expect(called).toBe(false);});
