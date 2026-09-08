import {describe,it,expect} from 'vitest';
import {parseGameCommand} from '../src/index.js';
describe('strict lifecycle commands',()=>{
 const valid=[
  {type:'PLAY_DEATH_GIFT',cardInstanceId:'a2-p02-r3c2',giftCardInstanceId:'a2-p03-r1c1',targetId:'B'},
  {type:'CHOOSE_REVIVAL',revive:true},{type:'CHOOSE_REVIVAL',revive:false},
  ...['lancelot-transform','vanmil-subordinates','arseil-conspiracy'].map(ability=>({type:'USE_LIFECYCLE_ABILITY',ability})),
  {type:'TRANSFER_RITUAL',targetId:'B'},{type:'USE_REVIVAL_RITUAL'},
 ];
 it.each(valid)('accepts the exact saved wire shape $type',command=>{expect(parseGameCommand(command)).toEqual({ok:true,value:command});});
 it.each(valid)('rejects identity, result, and arbitrary payload injection for $type',command=>{for(const field of ['actorId','presence','outcome','winnerIds','sourceCardInstanceId','extra'])expect(parseGameCommand({...command,[field]:'forged'})).toEqual({ok:false,code:'INVALID_COMMAND'});});
 it.each([{type:'CHOOSE_REVIVAL',revive:1},{type:'USE_LIFECYCLE_ABILITY',ability:'unknown'},{type:'TRANSFER_RITUAL',targetId:''},{type:'PLAY_DEATH_GIFT',cardInstanceId:'a2-p02-r3c2',targetId:'B'},{type:'PLAY_DEATH_GIFT',cardInstanceId:'a2-p02-r3c2',giftCardInstanceId:[],targetId:'B'}])('rejects malformed lifecycle inputs',command=>{expect(parseGameCommand(command)).toEqual({ok:false,code:'INVALID_COMMAND'});});
});
