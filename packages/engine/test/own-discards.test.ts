import {expect,it} from 'vitest';
import {discardIds,viewFor} from '../src/index.js';
import {act,finish,pass,ready,until} from './combat-helpers.js';
import {character,handCard} from './fixtures.js';

it('lists the cards a seat let go, in the order it let them go',()=>{
  let s=ready();const rest=handCard(s,'A','間合い／休息');
  s=finish(act(s,'A',{type:'REST',cardInstanceIds:[rest]}));
  handCard(s,'A','兵士');handCard(s,'A','市民');
  const dropped=s.players.A!.hand.slice(5);expect(dropped).toHaveLength(2);
  s=finish(act(s,'A',{type:'END_TURN',discardIds:dropped}));
  expect(viewFor(s,'A').self.discardedCardInstanceIds).toEqual([rest,...dropped]);
});

it('tells the other seats only the count and never the hidden cards behind it',()=>{
  let s=ready();handCard(s,'A','兵士');handCard(s,'A','市民');
  const dropped=s.players.A!.hand.slice(5);expect(dropped).toHaveLength(2);
  s.phase='hand-adjustment';s=finish(act(s,'A',{type:'END_TURN',discardIds:dropped}));
  for(const id of ['B','C','D']){
    const view=viewFor(s,id);
    expect(view.self.discardedCardInstanceIds).toEqual([]);
    expect(view.discardCount).toBe(discardIds(s).length);
    for(const card of dropped)expect(JSON.stringify(view)).not.toContain(card);
  }
});

it('shows a dead seat the hand it lost, and nobody else',()=>{
  let s=ready();character(s,'A','大神官ジル');s.players.A!.damage=9;
  const kill=handCard(s,'A','滅界');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==kill);
  s.players.A!.chants=[{cardInstanceId:kill,revealed:false}];
  const lost=[...s.players.B!.hand];
  s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:kill,targetIds:['B'],dedicated:false}));
  expect(viewFor(s,'B').self.discardedCardInstanceIds).toEqual(expect.arrayContaining(lost));
  expect(viewFor(s,'C').self.discardedCardInstanceIds).toEqual([]);
});

it('drops a card from the list once it leaves the pile, by reshuffle or by reclaim',()=>{
  let s=ready();character(s,'A','大神官ジル');s.players.A!.damage=3;
  s=finish(act(s,'A',{type:'REST',cardInstanceIds:[handCard(s,'A','間合い／休息')]}));
  s.phase='action';
  const card=handCard(s,'A','封傷');
  s=until(act(s,'A',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:card,targetIds:['A'],dedicated:false}),'reclaim');
  const decision=s.reclaimDecisions!.at(-1)!;
  s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:decision.id,claimId:`${decision.id}-A-base`,choice:'take'});
  while(s.windows?.length)s=pass(s);
  expect(viewFor(s,'A').self.discardedCardInstanceIds).not.toContain(card);
  expect(viewFor(s,'A').self.discardedCardInstanceIds.length).toBeGreaterThan(0);
  // The continent's Dawn shuffles the pile back into the deck, so no seat is still holding a discard.
  s.deck=[...s.deck,...discardIds(s)];s.discard=[];
  for(const id of s.seatOrder)expect(viewFor(s,id).self.discardedCardInstanceIds).toEqual([]);
});
