import {expect,it} from 'vitest';
import {transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,finish,pass,passReclaims} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {makeWolfLanceScenario} from './fixtures/wolf-lance-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
const rows=[['wolf-ordinary','a2-p10-r3c1',false,null],['wolf-dedicated','a2-p10-r3c1',true,null],['lance-ordinary','a2-p10-r3c2',false,null],['lance-one','a2-p10-r3c2',true,'one-hit'],['lance-two','a2-p10-r3c2',true,'two-hit']] as const;
function attack(card:string,dedicated:boolean,variant:'one-hit'|'two-hit'|null){return {type:'ATTACK' as const,cardInstanceId:card,targetIds:['B'],dedicated,...(variant?{techniqueVariant:variant}:{})};}
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
function toDefense(s:GameState){for(let n=0;n<300;n++){if(s.windows?.at(-1)?.kind==='normal-defense')return s;s=pass(s,[2,3,4]);}throw Error('WOLF_LANCE_DEFENSE');}
it.each(rows)('%s physical %s dedicated=%s variant=%s declares its exact printed profile and resolves actual damage',(scenario,card,dedicated,variant)=>{
 const wolf=card==='a2-p10-r3c1',use=wolf?5:4,hits=variant==='two-hit'?2:1,total=wolf?(dedicated?9:5):(dedicated?7:5)*hits;
 for(const level of [use-1,use]){let s=makeWolfLanceScenario(scenario,players,{level});s=act(s,'A',attack(card,dedicated,variant));const frame=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!;expect(frame.technique).toMatchObject({school:'warrior',range:wolf&&!dedicated?'near':'far',useLevel:use,effectLevel:wolf?5:dedicated?5:4,damage:wolf?null:dedicated?7:5,attributes:wolf?['戦','格']:['戦','槍'],noChecks:dedicated,chant:false,hitCount:hits});expect(frame.checkSpecs).toHaveLength(dedicated?0:use-level);
  s=toDefense(s);if(wolf)expect(s.rolls!.find(r=>r.purpose==='attack-damage')).toMatchObject({formula:dedicated?'3d6':'2d6',faces:dedicated?[2,3,4]:[2,3],total});const g=Object.values(s.groups!)[0]!;expect(g.targets[0]!.hits.map(h=>h.damage)).toEqual(Array(hits).fill(total/hits));s=finish(s);expect(s.rolls?.filter(r=>r.purpose==='excess-level').length??0).toBe(dedicated?0:use-level);expect(s.players.B!.damage).toBe(total);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);expect(s.players.A!.hand).not.toContain(card);
 }
});
it.each(rows)('%s physical %s dedicated=%s variant=%s requires its exact per-hit maai payment',(scenario,card,dedicated,variant)=>{
 const required=card==='a2-p10-r3c1'&&!dedicated?1:2,hits=variant==='two-hit'?2:1,damage=card==='a2-p10-r3c1'?(dedicated?9:5):dedicated?7:5;
 for(const count of [1,2]){let s=toDefense(act(makeWolfLanceScenario(scenario,players),'A',attack(card,dedicated,variant)));s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'}));reject(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'});if(required===2&&count===2)s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c2'}));s=finish(s);expect(s.players.B!.damage).toBe((hits-(count>=required?1:0))*damage);}
});
it.each(rows)('%s physical %s dedicated=%s variant=%s actual Fate cancellation pays once without dice or hits',(scenario,card,dedicated,variant)=>{
 let s=act(makeWolfLanceScenario(scenario,players),'A',attack(card,dedicated,variant));const id=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!.id;s=pass(s);s=pass(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id});s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.rolls??[]).toEqual([]);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);expect(s.phase).toBe('withdrawal');
});
it('Ordinary Wolf rejects far then a different actual approach card enables its near attack',()=>{
 let s=makeWolfLanceScenario('wolf-ordinary',players,{approach:false});reject(s,'A',attack('a2-p10-r3c1',false,null));s=finish(act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:'a2-p24-r1c2'}));expect(s.distances.A!.B).toBe('near');s=finish(act(s,'A',attack('a2-p10-r3c1',false,null)));expect(s.players.B!.damage).toBe(2);expect(discardIds(s)).toContain('a2-p10-r3c1');
});
it('Dedicated Lance two hits deduct the actual initial Soldier HP independently and destroy it only once',()=>{
 let s=makeWolfLanceScenario('lance-two',players,{follower:true});const soldier=s.players.B!.followers[0]!.cardInstanceId;s=finish(act(s,'A',attack('a2-p10-r3c2',true,'two-hit')));expect(s.players.B!.damage).toBe(12);expect(s.players.B!.followers).toEqual([]);expect(discardIds(s).filter(id=>id===soldier)).toHaveLength(1);expect(discardIds(s).filter(id=>id==='a2-p10-r3c2')).toHaveLength(1);
});
it('Dedicated Lance cannot split its simultaneous hits or select variants outside the printed mode',()=>{
 const s=makeWolfLanceScenario('lance-two',players);reject(s,'A',{...attack('a2-p10-r3c2',true,'two-hit'),targetIds:['B','C']});reject(s,'A',attack('a2-p10-r3c2',false,'two-hit'));reject(s,'A',{...attack('a2-p10-r3c2',true,'two-hit'),techniqueVariant:'three-hit'});
});
it.each(['wolf-dedicated','lance-two'] as const)('%s refuses a foreign dedicated owner without paying',scenario=>{
 const s=makeWolfLanceScenario(scenario,players,{owner:'侍大将のシン'});reject(s,'A',attack(scenario==='wolf-dedicated'?'a2-p10-r3c1':'a2-p10-r3c2',true,scenario==='lance-two'?'two-hit':null));
});
