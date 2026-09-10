import {expect,it} from 'vitest';
import {gameStats,transition,viewFor,type GameState} from '../src/index.js';
import {act,ready,until,finish,pass,closeWindow,passReclaims} from './combat-helpers.js';
import {entropy,handCard} from './fixtures.js';
import {makeR6MaaiScenario} from '../../../apps/worker/test/fixtures/r6-maai-scenarios.js';
const CARD='a2-p12-r1c3';
const players=['A','B','C','D'].map(id=>({id,name:id}));
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
function source(level=3){const s=ready(),attack=handCard(s,'A','踏み込み／弓');handCard(s,'B','受け流し');handCard(s,'B','必勝の祈り');handCard(s,'C','命運凶変');s.players.B!.permanent={warrior_level:level-gameStats(s,'B').warrior_level,endurance:100};return {s,attack};}
function declare(s:GameState){return act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:CARD,dedicated:false});}
it.each([2,3])('Physical parry binds incoming level3 and its complete printed profile when defender warrior is%s',level=>{
 for(const distance of ['near','far'] as const){let {s,attack}=source(level);s.distances.A!.B=s.distances.B!.A=distance;s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');s=declare(s);const defense=Object.values(s.actions!).find(a=>a.cardInstanceId===CARD)!;
  expect(defense.technique).toMatchObject({school:'warrior',range:'none',useLevel:3,effectLevel:3,damage:null,attributes:['戦','反'],counter:true,defense:'parry',chant:false});expect(defense.checkSpecs).toHaveLength(3-level);expect(s.resolution).toContain(CARD);s=finish(s);expect(s.rolls?.filter(r=>r.purpose==='excess-level').length??0).toBe(3-level);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);expect(s.discard.filter(id=>id===CARD)).toHaveLength(1);expect(s.distances.A!.B).toBe(distance);
 }
});
it('Physical parry failed use check stays paid and permits a different physical defense',()=>{
 let {s,attack}=source(2);const evade=handCard(s,'B','見切る');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');s=until(declare(s),'before-roll');s=passReclaims(closeWindow(s,[6,6]));expect(s.rolls!.at(-1)).toMatchObject({purpose:'excess-level',success:false});s=until(s,'normal-defense');reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:CARD,dedicated:false});s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false}));expect(s.players.B!.damage).toBe(0);expect(s.discard.filter(id=>id===CARD)).toHaveLength(1);
});
it('Physical parry actual Prayer raises only its effect level and never creates a returned attack',()=>{
 let {s,attack}=source(2);s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');s=until(declare(s),'effect-level');while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);const id=Object.values(s.actions!).find(a=>a.cardInstanceId===CARD)!.id,checks=s.rolls!.filter(r=>r.purpose==='excess-level').length;
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:'a2-p05-r2c3',mode:'effect-plus',targetActionId:id});for(let n=0;n<300;n++){if(s.windows?.at(-1)?.kind==='damage'&&s.windows.at(-1)!.continuation.id===id)break;s=pass(s,[6]);}
 expect(s.actions![id]!.technique).toMatchObject({useLevel:3,effectLevel:9,damage:null});expect(s.rolls!.filter(r=>r.purpose==='excess-level')).toHaveLength(checks);s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);expect(s.groups).toEqual({});expect(s.discard.filter(id=>id===CARD)).toHaveLength(1);expect(s.discard).toContain('a2-p05-r2c3');
});
it('Physical parry cancels only one hit from an actually chanted three-hit warrior attack',()=>{
 let s=makeR6MaaiScenario(players,true,CARD);s=finish(declare(s));expect(s.players.B!.damage).toBe(14);expect(s.players.A!.damage).toBe(0);expect(s.discard.filter(id=>id===CARD)).toHaveLength(1);
});
it('Physical parry can be declined or canceled by an actual Fate while the original hit survives',()=>{
 for(const canceled of [false,true]){let {s,attack}=source();s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');if(canceled){s=declare(s);const defense=Object.values(s.actions!).find(a=>a.cardInstanceId===CARD)!;s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:defense.id});}s=finish(s);expect(s.players.B!.damage).toBe(4);expect(s.players.B!.hand.includes(CARD)).toBe(!canceled);expect(s.discard.filter(id=>id===CARD)).toHaveLength(canceled?1:0);}
});
it('Physical parry rejects own-turn attack, magic, foreign recipient and follower-start boundaries without payment',()=>{
 let {s}=source();reject(s,'B',{type:'ATTACK',cardInstanceId:CARD,targetIds:['A'],dedicated:false});const own=handCard(s,'A','受け流し');reject(s,'A',{type:'ATTACK',cardInstanceId:own,targetIds:['B'],dedicated:false});
 for(const target of ['B','C']){const start=source();s=start.s;const flame=handCard(s,'A','炎矢');s.players.A!.permanent={magic_level:20};s=until(act(s,'A',{type:'ATTACK',cardInstanceId:target==='B'?flame:start.attack,targetIds:[target],dedicated:false}),'normal-defense');reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:CARD,dedicated:false});expect(s.players.B!.hand).toContain(CARD);}
 const start=source();s=until(act(start.s,'A',{type:'ATTACK',cardInstanceId:start.attack,targetIds:['B'],dedicated:false}),'normal-defense');s=act(s,'B',{type:'START_FOLLOWERS'});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:CARD,dedicated:false});s=finish(s);expect(s.players.B!.damage).toBe(4);expect(s.players.B!.hand).toContain(CARD);
});
