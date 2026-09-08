import { expect, it } from 'vitest';
import * as engine from '../src/index.js';
import { closeWindow, act, finish, ready } from './combat-helpers.js';
import { character, entropy, handCard, loadFixture } from './fixtures.js';
import { actionCards } from '@madou/catalog';

it('lets the priority-holding third party cancel a declaration, spends and immediately refills the anytime card',()=>{
  let s=ready(); const attack=handCard(s,'A','踏み込み／弓'); const interrupt=handCard(s,'C','命運凶変');
  while(s.players.C!.hand.length>5)s.deck.push(s.players.C!.hand.shift()!);
  s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});
  s=act(s,'A',{type:'PASS'}); s=act(s,'B',{type:'PASS'});
  const actionId=Object.keys(s.actions!)[0]!;
  const before=s.players.C!.hand.length;
  s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:interrupt,mode:'cancel',targetActionId:actionId});
  expect(s.players.C!.hand).toHaveLength(before); expect(s.resolution).toContain(interrupt);
  expect((s.windows!.at(-1)!).passed).toEqual([]);expect(Object.values(s.actions!).some(action=>action.kind==='reaction')).toBe(true);
  s=finish(s); expect(s.players.B!.damage).toBe(0); expect(s.discard).toContain(attack);
});

it('restores the named third-party interruption fixture at the same priority',()=>{
  const s=loadFixture('third-party-interrupt');expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  expect(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]).toBe('C');
});

it('rejects a repeated physical reaction for the same event without mutation',()=>{
  let s=ready(); const attack=handCard(s,'A','踏み込み／弓'); const interrupt=handCard(s,'A','命運凶変');
  s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}); const actionId=Object.keys(s.actions!)[0]!;
  const key=`${s.actions![actionId]!.eventId}:A:${interrupt}`; s.used!.push(key); const before=JSON.stringify(s);
  expect(engine.transition(s,{actorId:'A',command:{type:'PLAY_REACTION',cardInstanceId:interrupt,mode:'cancel',targetActionId:actionId}},entropy())).toEqual({ok:false,code:'ALREADY_USED'});
  expect(JSON.stringify(s)).toBe(before);
});

it('persists a cancellable reaction child and restores the parent declaration generation',()=>{
  let s=ready();character(s,'D','占星術師のアルセイル');s.players.D!.revealed=true;const attack=handCard(s,'A','踏み込み／弓');const fate=handCard(s,'C','命運凶変');
  s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=act(s,'A',{type:'PASS'});s=act(s,'B',{type:'PASS'});const parentId=Object.keys(s.actions!)[0]!;
  s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:parentId});const reaction=Object.values(s.actions!).find(a=>a.kind==='reaction')!;
  expect(JSON.parse(JSON.stringify(s))).toEqual(s);expect(s.windows).toHaveLength(2);
  s=act(s,'D',{type:'CANCEL_REACTION',targetActionId:reaction.id});while(Object.values(s.actions!).some(a=>a.kind==='reaction'))s=act(s,s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!,{type:'PASS'});
  expect(s.windows).toHaveLength(1);expect(s.windows![0]!.passed).toEqual([]);expect(s.windows![0]!.cursor).toBe(0);s=finish(s);
  expect(s.players.B!.damage).toBe(4);expect(s.discard).toEqual(expect.arrayContaining([attack,fate]));
});

it('processes OPEN cards during immediate reaction refill before the child declaration resolves',()=>{
  let s=ready();const attack=handCard(s,'A','踏み込み／弓');const fate=handCard(s,'C','命運凶変');
  while(s.players.C!.hand.length>5){const i=s.players.C!.hand.findIndex(id=>id!==fate);s.deck.push(s.players.C!.hand.splice(i,1)[0]!);}
  const open=actionCards.find(card=>card.name==='神々の血')!.id;s.deck=s.deck.filter(id=>id!==open);for(const player of Object.values(s.players)){player.hand=player.hand.filter(id=>id!==open);player.open=player.open.filter(id=>id!==open);}s.deck.unshift(open);
  s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=act(s,'A',{type:'PASS'});s=act(s,'B',{type:'PASS'});const parent=Object.keys(s.actions!)[0]!;
  s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:parent});
  expect(s.players.C!.open).toContain(open);expect(s.players.C!.hand).toHaveLength(5);expect(s.events.at(-2)?.type).toBe('OPEN');expect(s.resolution).toContain(fate);
});

it('resolves 必勝の祈り as a child in the effect-level window and locks its d6 addition',()=>{
  let s=ready();const attack=handCard(s,'A','踏み込み／弓');const prayer=handCard(s,'A','必勝の祈り');
  s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});
  while(s.windows!.at(-1)!.kind!=='effect-level')s=act(s,s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!,{type:'PASS'},Array(20).fill(1));
  const parent=Object.keys(s.actions!).find(id=>s.actions![id]!.kind==='attack')!;s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:parent},[2]);
  while(Object.values(s.actions!).some(a=>a.kind==='reaction'))s=act(s,s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!,{type:'PASS'},[2]);
  expect(s.actions![parent]!.technique.effectLevel).toBe(5);expect(JSON.parse(JSON.stringify(s))).toEqual(s);
});

it('lets Liera explicitly use dedicated prayer for another actor and recovers it after the parent event',()=>{let s=ready();character(s,'B','リーア姫');const attack=handCard(s,'A','踏み込み／弓');const prayer=handCard(s,'B','必勝の祈り');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['C'],dedicated:false});while(s.windows!.at(-1)!.kind!=='effect-level')s=act(s,s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!,{type:'PASS'});s=act(s,'A',{type:'PASS'});const parent=Object.keys(s.actions!).find(id=>s.actions![id]!.kind==='attack')!;s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:parent,dedicated:true},[2]);while(Object.values(s.actions!).some(a=>a.kind==='reaction'))s=act(s,s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!,{type:'PASS'},[2]);expect(s.reclaimReservations).toContain(prayer);expect(s.players.B!.hand).not.toContain(prayer);s=finish(s);expect(s.reclaimReservations).not.toContain(prayer);expect(s.players.B!.hand).toContain(prayer);expect(JSON.parse(JSON.stringify(s))).toEqual(s);});
