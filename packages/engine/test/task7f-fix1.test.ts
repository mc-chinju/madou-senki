import {describe,it,expect} from 'vitest';
import {transition,viewFor,derivedStats,allCardInstanceIds,type GameState} from '../src/index.js';
import {ready,act,pass,closeWindow} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';
function top(s:GameState,id:string){for(const p of Object.values(s.players)){p.hand=p.hand.filter(x=>x!==id);p.open=p.open.filter(x=>x!==id);}s.deck=s.deck.filter(x=>x!==id);s.discard=s.discard.filter(x=>x!==id);s.deck.unshift(id);}
function opposingOtherworld(){const s=ready();character(s,'A','小妖精のチャム');character(s,'B','リーア姫');character(s,'C','魔導王ガイナス');character(s,'D','黒騎士ガーウィン');s.players.B!.presence='otherworld';s.players.C!.presence='otherworld';s.players.A!.damage=derivedStats(s.players.A!).endurance;s.players.D!.damage=derivedStats(s.players.D!).endurance;return s;}
describe('Task7f review fix1',()=>{
 it('R1 settles the last active deaths into stalemate without changing living presence or fishing draws',()=>{
  let s=opposingOtherworld();top(s,'a2-p01-r1c1');const deck=[...s.deck];s=act(s,'A',{type:'PASS_ACTION'});expect(s.outcome).toBeUndefined();s=pass(s);expect(s.outcome).toBeUndefined();s=pass(s);
  expect(s.outcome).toEqual({kind:'draw',reason:'stalemate',winnerIds:[],results:{A:'draw',B:'draw',C:'draw',D:'draw'}});
  expect(s.players.B!.presence).toBe('otherworld');expect(s.players.C!.presence).toBe('otherworld');expect(s.players.A!.presence).toBe('dead');expect(s.players.D!.presence).toBe('dead');expect(s.deck).toEqual(deck);expect(allCardInstanceIds(s)).toHaveLength(220);
  for(const id of s.seatOrder){expect(viewFor(s,id).legalChoices).toEqual([]);expect(viewFor(s,id).outcome).toEqual(s.outcome);expect(transition(JSON.parse(JSON.stringify(s)),{actorId:id,command:{type:'START_TURN'}},entropy())).toEqual({ok:false,code:'GAME_COMPLETE'});}
 });
 it('R1 preserves prior individual victory while the remaining match draws',()=>{
  let s=opposingOtherworld();s.individualResults={D:'won'};s.players.D!.presence='exited';s=act(s,'A',{type:'PASS_ACTION'});s=pass(s);
  expect(s.outcome).toEqual({kind:'draw',reason:'stalemate',winnerIds:['D'],results:{A:'draw',B:'draw',C:'draw',D:'won'}});expect(s.individualResults).toEqual({D:'won'});expect(s.players.D!.presence).toBe('exited');
 });
 it('R1 ordinary otherworld winners are resolved before considering stalemate',()=>{
  let s=opposingOtherworld();character(s,'C','大神官ジル');s=act(s,'A',{type:'PASS_ACTION'});s=pass(s);s=pass(s);expect(s.outcome).toMatchObject({kind:'victory',reason:'objectives',winnerIds:['B','C']});
 });
 it('R1 active stopped actors still have a recovery turn and cannot force a stalemate',()=>{
  let s=opposingOtherworld();s.players.D!.damage=0;s.players.D!.statuses=[{id:'stop',kind:'stopped',modifiers:[0],nextCheck:1}];s=act(s,'A',{type:'PASS_ACTION'});s=pass(s);expect(s.outcome).toBeUndefined();expect(s.turnSeat).toBe(3);expect(viewFor(s,'D').legalChoices).toContain('START_TURN');s=act(s,'D',{type:'START_TURN'});expect(s.windows!.at(-1)!.kind).toBe('before-roll');
 });
 it('R2 excludes a revived same-batch victim at projection, acceptance and accepted-action resolution',()=>{
  let s=ready();character(s,'A','小妖精のチャム');character(s,'B','魔導王ガイナス');character(s,'C','リーア姫');character(s,'D','魔聖母ディア');
  const evil=handCard(s,'B','「これで勝ったと思うなよ」');const giftB=handCard(s,'B','香具羅');const good=handCard(s,'C','「姫を頼む」');const giftC=handCard(s,'C','魔導書');const fate=handCard(s,'D','命運凶変');
  for(const id of ['A','B','C'])s.players[id]!.damage=derivedStats(s.players[id]!).endurance;
  s=act(s,'A',{type:'PASS_ACTION'});s=pass(s);s=act(s,'B',{type:'PLAY_DEATH_GIFT',cardInstanceId:evil,giftCardInstanceId:giftB,targetId:'D'});
  top(s,'a2-p01-r1c1');const actionId=s.windows!.at(-1)!.continuation.id;s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:actionId});s=closeWindow(s,[1]);s=closeWindow(s);s=act(s,'A',{type:'CHOOSE_REVIVAL',revive:true});s=act(s,'A',{type:'PASS_SETUP'});s=closeWindow(s);s=closeWindow(s);s=pass(s);
  expect(s.players.A!.presence).toBe('active');expect(s.lifecycle!.find(t=>t.kind==='death-batch')).toMatchObject({actorIds:['A','B','C'],cursor:2});expect(viewFor(s,'C').lifecycleDecision!.eligibleTargetIds).toEqual(['D']);
  const before=JSON.stringify(s);const input={actorId:'C',command:{type:'PLAY_DEATH_GIFT',cardInstanceId:good,giftCardInstanceId:giftC,targetId:'A'}} as const;expect(transition(s,input,entropy())).toEqual({ok:false,code:'INVALID_TARGET'});expect(transition(JSON.parse(before),input,entropy())).toEqual({ok:false,code:'INVALID_TARGET'});expect(JSON.stringify(s)).toBe(before);expect(s.players.C!.hand).toContain(good);expect(s.players.C!.hand).toContain(giftC);
  // Restore an already accepted historical frame (before this fix) to verify resolution also fails closed.
  s=act(s,'C',{type:'PLAY_DEATH_GIFT',cardInstanceId:good,giftCardInstanceId:giftC,targetId:'D'});const action=s.actions![s.windows!.at(-1)!.continuation.id]!;if(action.lifecycleEffect?.kind!=='gift')throw Error('NOT_GIFT');action.lifecycleEffect.targetId='A';action.targetIds=['A'];s=closeWindow(s);expect(s.players.A!.hand).not.toContain(giftC);expect(s.players.C!.hand).toContain(giftC);expect(s.discard).toContain(good);expect(allCardInstanceIds(s)).toHaveLength(220);
 });
});
