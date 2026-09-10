import {it, expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';
const ban = {type:'USE_ABILITY', abilityId:'c2-p07-r1c2-ab03', targetEventId:'opportunity', targetIds:['B','C']};
const blessing = {type:'USE_ABILITY', abilityId:'c2-p03-r1c2-ab04', targetEventId:'opportunity', targetId:'B'};
it.each([ban, blessing])('C16 strict round trip %#', command => expect(parseGameCommand(command)).toEqual({ok:true, value:command}));
it.each([
  {...ban, targetIds:[]}, {...ban, targetIds:['B','B']}, {...ban, targetIds:['B',,'C']},
  {...ban, targetId:'B'}, {...ban, targetIds:Array.from({length:11}, (_, i) => `P${i}`)},
  {...ban, costCardInstanceId:'card'}, {...ban, conceal:true}, {...ban, abilityEffectIds:[]},
  {...blessing, targetIds:['B']}, {...blessing, targetId:undefined}, {...blessing, costCardInstanceId:'card'},
  {...ban, abilityId:'c2-p01-r2c1-ab03'},
])('C16 malformed target/foreign fields fail %#', command => expect(parseGameCommand(command)).toEqual({ok:false, code:'INVALID_COMMAND'}));
