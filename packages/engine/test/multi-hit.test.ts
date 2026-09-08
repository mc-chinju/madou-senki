import { expect, it } from 'vitest';
import * as engine from '../src/index.js';
import { closeWindow, act, finish, pass, ready, until } from './combat-helpers.js';
import { character, handCard, loadFixture } from './fixtures.js';

it('keeps targets and hits as separate serialized arrays for the printed multi-hit technique',()=>{
  let s=ready(); character(s,'A','侍大将のシン'); const card=handCard(s,'A','天地百撃斬');
  s.players.A!.chants.push({cardInstanceId:card,revealed:false}); s.players.A!.hand=s.players.A!.hand.filter(id=>id!==card);
  s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B','C'],dedicated:true});s=until(s,'damage');s=closeWindow(s,[3]);s=closeWindow(s);
  s=finish(s);
  expect(s.players.B!.damage).toBe(21); expect(s.players.C!.damage).toBe(21);
  expect(s).toEqual(JSON.parse(JSON.stringify(s)));
});

it('loads the named multi-target multi-hit fixture with locked hit indices',()=>{
  const s=loadFixture('multi-target-multi-hit');const group=Object.values(s.groups!)[0]!;
  expect(group.hitIndices).toEqual([0,1,2]);expect(group.targets.map(target=>target.actorId)).toEqual(['B','C']);
});

it('snapshots a nonzero-HP follower once and subtracts its HP from every simultaneous hit',()=>{
  let s=ready(); character(s,'A','侍大将のシン'); const card=handCard(s,'A','天地百撃斬'); const soldier=handCard(s,'B','兵士');
  s.players.A!.chants.push({cardInstanceId:card,revealed:false}); s.players.A!.hand=s.players.A!.hand.filter(id=>id!==card);
  s.players.B!.followers.push({cardInstanceId:soldier,revealed:false}); s.players.B!.hand=s.players.B!.hand.filter(id=>id!==soldier);
  s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:true});s=until(s,'damage');s=closeWindow(s,[3]);s=closeWindow(s); s=finish(s);
  expect(s.players.B!.damage).toBe(18); expect(s.players.B!.followers).toEqual([]); expect(s.discard).toContain(soldier);
});

it('records one failed morale check for the simultaneous group before level comparison',()=>{
  let s=ready();character(s,'A','侍大将のシン');const card=handCard(s,'A','天地百撃斬');const follower=handCard(s,'B','王立騎士団');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==card);s.players.A!.chants=[{cardInstanceId:card,revealed:false}];s.players.B!.hand=s.players.B!.hand.filter(id=>id!==follower);s.players.B!.followers=[{cardInstanceId:follower,revealed:false}];s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:true});s=until(s,'damage');s=closeWindow(s,[2]);s=closeWindow(s);
  while(s.windows!.at(-1)!.kind!=='follower-start')s=pass(s);s=pass(s);s=closeWindow(s,[6,6]);s=closeWindow(s);const group=Object.values(s.groups!)[0]!;expect(group.targets[0]!.followerResults).toEqual([{cardInstanceId:follower,morale:{dice:[6,6],threshold:engine.derivedStats(s.players.B!).spirit,success:false},outcome:'morale-failed',hpReduction:0}]);expect(s.discard).toContain(follower);s=finish(s);expect(s.players.B!.damage).toBe(14);
});

it('applies Goblin then nonzero HP follower order to every hit and records distinct causes',()=>{
  let s=ready();character(s,'A','侍大将のシン');const card=handCard(s,'A','天地百撃斬');const goblin=handCard(s,'B','ゴブリン');const soldier=handCard(s,'B','兵士');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==card);s.players.A!.chants=[{cardInstanceId:card,revealed:false}];s.players.B!.hand=s.players.B!.hand.filter(id=>id!==goblin&&id!==soldier);s.players.B!.followers=[{cardInstanceId:goblin,revealed:false},{cardInstanceId:soldier,revealed:false}];s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:true});s=until(s,'damage');s=closeWindow(s,[2]);s=closeWindow(s);while(s.windows!.at(-1)!.kind!=='follower-start')s=pass(s);s=pass(s);const results=Object.values(s.groups!)[0]!.targets[0]!.followerResults;expect(results).toEqual([{cardInstanceId:goblin,morale:null,outcome:'lower-destroyed',hpReduction:0},{cardInstanceId:soldier,morale:null,outcome:'lower-destroyed',hpReduction:1}]);s=finish(s);expect(s.players.B!.damage).toBe(12);expect(s.discard).toEqual(expect.arrayContaining([goblin,soldier]));
});

it('records equal-level follower destruction as a blocking cause',()=>{let s=ready();s.distances.A!.B='near';s.distances.B!.A='near';const attack=handCard(s,'A','踏み込み／槍');const soldier=handCard(s,'B','兵士');s.players.B!.hand=s.players.B!.hand.filter(id=>id!==soldier);s.players.B!.followers=[{cardInstanceId:soldier,revealed:false}];s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});while(s.windows!.at(-1)!.kind!=='follower-start')s=pass(s);s=pass(s);const target=Object.values(s.groups!)[0]!.targets[0]!;expect(target.followerResults).toEqual([{cardInstanceId:soldier,morale:null,outcome:'equal-destroyed',hpReduction:0}]);expect(target.hits[0]!.defended).toBe(true);s=finish(s);expect(s.players.B!.damage).toBe(0);});
