import {expect,it} from 'vitest';
import {gameStats,transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,until,finish,closeWindow,passReclaims} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {assignCharacter} from './fixtures/scenario-tools.js';
import {makeTeleportPhysicalScenario} from './fixtures/teleport-physical-scenarios.js';
import {makeR6MaaiScenario} from './fixtures/r6-maai-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
const rows=[['teleport-physical-1','a2-p06-r1c1'],['teleport-physical-2','a2-p06-r1c2']] as const;
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
function roll(s:GameState,card:string,dedicated:boolean,dice:number[]){s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});s=until(s,'before-roll');return passReclaims(closeWindow(s,dice));}
it.each(rows)('%s physical %s lets Yotsurm elect plus1 for this check only at the same boundary faces',(scenario,card)=>{
 for(const dedicated of [false,true]){let s=makeTeleportPhysicalScenario(scenario,players);const stats=gameStats(s,'B');expect(stats.spirit).toBe(6);s=roll(s,card,dedicated,[3,4]);expect(s.rolls!.at(-1)).toMatchObject({purpose:'teleport',rollerId:'B',formula:'2d6',faces:[3,4],threshold:dedicated?7:6,success:dedicated,modifier:dedicated?1:0});expect(gameStats(s,'B')).toEqual(stats);s=finish(s);expect(s.players.B!.damage).toBe(dedicated?0:4);expect(gameStats(s,'B')).toEqual(stats);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);}
});
it.each(rows)('%s physical %s uses the defender spirit and admits ordinary mental attacks',(scenario,card)=>{
 let s=makeTeleportPhysicalScenario(scenario,players,true);expect(viewFor(s,'B').currentAttack!.technique.attributes).toContain('精');expect(gameStats(s,'A').spirit).not.toBe(6);s=roll(s,card,false,[3,3]);expect(s.rolls!.at(-1)).toMatchObject({purpose:'teleport',threshold:6,success:true});s=finish(s);expect(s.players.B!.damage).toBe(0);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);
});
it.each(rows)('%s physical %s failure permits a different defense and refuses the spent source',(scenario,card)=>{
 let s=makeTeleportPhysicalScenario(scenario,players);s=roll(s,card,false,[6,6]);s=until(s,'normal-defense');expect(discardIds(s)).toContain(card);reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p05-r3c1',dedicated:false}));expect(s.players.B!.damage).toBe(0);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);expect(s.rolls!.filter(r=>r.purpose==='teleport')).toHaveLength(1);
});
it.each(rows)('%s physical %s optional bonus does not carry into a distinct ordinary teleport',(scenario,card)=>{
 let s=makeTeleportPhysicalScenario(scenario,players);s=roll(s,card,true,[6,6]);s=until(s,'normal-defense');const spare=card==='a2-p06-r1c1'?'a2-p06-r1c2':'a2-p06-r1c1';s=roll(s,spare,false,[3,4]);expect(s.rolls!.filter(r=>r.purpose==='teleport').map(r=>[r.threshold,r.success])).toEqual([[7,false],[6,false]]);s=finish(s);expect(s.players.B!.damage).toBe(4);expect(gameStats(s,'B').spirit).toBe(6);
});
it.each(rows)('%s physical %s succeeds for only one real chanted hit and one recipient',(_scenario,card)=>{
 for(const three of [false,true]){let s=makeR6MaaiScenario(players,three,card);s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false}));expect(s.players.B!.damage).toBe(three?14:0);expect(s.players.C!.damage).toBe(three?0:7);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);}
});
it.each(rows)('%s physical %s actual Fate cancellation pays without generating a teleport check',(scenario,card)=>{
 let s=makeTeleportPhysicalScenario(scenario,players);s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});const defense=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!;s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:defense.id});s=finish(s);expect(s.rolls?.some(r=>r.purpose==='teleport')??false).toBe(false);expect(s.players.B!.damage).toBe(4);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);
});
it.each(rows)('%s physical %s refuses a foreign dedicated owner before payment',(scenario,card)=>{
 const s=makeTeleportPhysicalScenario(scenario,players);assignCharacter(s,'B','黒騎士ガーウィン');reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:true});expect(s.players.B!.hand).toContain(card);
});
