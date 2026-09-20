import {composeValue} from '../src/abilities/action-modifiers.js';
import {expect,it} from 'vitest';
import {viewFor,transition,type GameState, discardIds } from '../src/index.js';
import {act,ready,until,finish,pass,closeWindow,readySetup} from './combat-helpers.js';
import {character,handCard,handCards,entropy,freshGame} from './fixtures.js';
const ZAN='c2-p04-r1c2-ab02';
function incoming(maai=false,withBan=false,name='破砕剣'){let s=ready();character(s,'A','竜皇子アスフェルト');if(withBan){character(s,'C','破壊神ヴァンミール');s.players.C!.revealed=true;}for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};const sword=handCard(s,'A',name),advance=handCard(s,'A','踏み込み／蹴る'),distance=handCard(s,'B','間合い／休息');handCard(s,'C','命運凶変');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:sword,targetIds:['B'],dedicated:false}),'normal-defense');if(maai){s=until(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:distance}),'defense-advance');s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advance});}return until(s,'follower-entry-abilities');}
function use(s:GameState){const o=viewFor(s,'A').abilityOptions.find(o=>o.abilityId===ZAN);expect(o).toBeDefined();return act(s,'A',{type:'USE_ABILITY',abilityId:ZAN,targetEventId:o!.targetEventId});}
it.each(['select','decline','cancel'] as const)('Actual sword five with Zan %s only doubles the selected uncanceled use',choice=>{
 let s=incoming();if(choice!=='decline'){s=use(s);if(choice==='cancel'){while(viewFor(s,'C').activeWindow?.pendingActorId!=='C')s=pass(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(s,'C').reactionTargetAbilityId!});}}s=finish(s);expect(s.players.B!.damage).toBe(choice==='select'?10:5);
});
it('A real maai canceled by a real advance still prevents Zan for that hit',()=>{
 let s=incoming(true);expect(Object.values(s.groups!)[0]!.targets[0]!.hits[0]!.maaiWasSubmitted).toBe(true);expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===ZAN)).toBe(false);const before=JSON.stringify(s);expect(transition(s,{actorId:'A',command:{type:'USE_ABILITY',abilityId:ZAN,targetEventId:s.windows!.at(-1)!.eventId}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);s=finish(s);expect(s.players.B!.damage).toBe(5);
});
it('Non-sword has no Zan offer and a structural null sword preserves null arithmetic',()=>{
 let s=incoming(false,false,'踏み込み／弓');expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===ZAN)).toBe(false);expect(finish(s).players.B!.damage).toBe(4);
 s=incoming();Object.values(s.groups!)[0]!.targets[0]!.hits[0]!.damage=null;s=until(use(s),'follower-start');expect(Object.values(s.groups!)[0]!.targets[0]!.hits[0]!.damage).toBeNull();expect(finish(s).players.B!.damage).toBe(0);
});
it.each(['declaration','reserved','frozen'] as const)('Actual Vanmil ban at Zan %s honors the saved cutoff',timing=>{
 let s=use(incoming(false,true));if(timing!=='declaration')s=closeWindow(s);if(timing==='frozen')s=until(s,'hit');while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='C')s=pass(s);const ban='c2-p07-r1c2-ab03',o=viewFor(s,'C').abilityOptions.find(o=>o.abilityId===ban)!;expect(o).toBeDefined();s=act(s,'C',{type:'USE_ABILITY',abilityId:ban,targetEventId:o.targetEventId,targetIds:['A']});s=finish(s);expect(s.players.B!.damage).toBe(timing==='frozen'?10:5);
});
it('Actual Asfelt all-target Wind Sword only doubles the target where Zan was selected',()=>{
 let s=ready();character(s,'A','竜皇子アスフェルト');for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};const sword=handCard(s,'A','風斬剣');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:sword,targetIds:['B','C'],dedicated:true}),'follower-entry-abilities');expect(s.windows!.at(-1)!.continuation).toMatchObject({targetId:'B'});s=finish(use(s));expect([s.players.B!.damage,s.players.C!.damage]).toEqual([24,12]);
});
it('Actual chanted two-hit sword preserves canceled first-hit maai while doubling the independent second hit',()=>{
 let s=ready();character(s,'A','竜皇子アスフェルト');for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};const sword=handCard(s,'A','天地百撃斬'),advance=handCard(s,'A','踏み込み／蹴る'),maai=handCard(s,'B','間合い／休息');
 s=act(s,'A',{type:'CHANT',cardInstanceId:sword});for(const actor of s.seatOrder){if(actor!=='A'){s=act(s,actor,{type:'START_TURN'});s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});s=act(s,actor,{type:'PASS_ACTION'});}s=finish(act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.filter(id=>id!==maai&&id!==advance).slice(0,Math.max(0,s.players[actor]!.hand.length-5))}));}
 s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});s=until(act(s,'A',{type:'ATTACK',cardInstanceId:sword,targetIds:['B'],dedicated:false}),'damage');s=closeWindow(s,[2]);s=until(s,'normal-defense');s=until(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai}),'defense-advance');s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advance});s=until(s,'follower-entry-abilities');const g=Object.values(s.groups!)[0]!;expect(g.targets[0]!.hits.map(h=>!!h.maaiWasSubmitted)).toEqual([true,false]);s=until(use(s),'follower-start');expect(Object.values(s.groups!)[0]!.targets[0]!.hits.map(h=>h.damage)).toEqual([7,14]);s=finish(s);expect(s.players.B!.damage).toBe(21);
});

it('Zan doubles before the actual initially placed Soldier subtracts its HP',()=>{
 let s=freshGame();character(s,'A','竜皇子アスフェルト');character(s,'B','黒騎士ガーウィン');for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};const sword=handCard(s,'A','破砕剣'),soldier=handCard(s,'B','兵士');for(const actor of s.seatOrder){if(actor==='B')s=act(s,actor,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:soldier});s=act(s,actor,{type:'PASS_SETUP'});}s=readySetup(s);s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});s=until(act(s,'A',{type:'ATTACK',cardInstanceId:sword,targetIds:['B'],dedicated:false}),'follower-entry-abilities');s=finish(use(s));expect(s.players.B!.damage).toBe(9);expect(discardIds(s).filter(id=>id===soldier)).toHaveLength(1);
});
it('Explicit abstract composition adds before both multipliers and rounds once',()=>{expect(composeValue(5,null,[1],[2,0.5])).toBe(6);});

it('Zan skips the target that actually teleported while doubling the remaining undefended sword hit',()=>{
 let s=ready();character(s,'A','竜皇子アスフェルト');for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};
 const sword=handCard(s,'A','風斬剣'),teleport=handCard(s,'B','転移');
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:sword,targetIds:['B','C'],dedicated:true}),'normal-defense');
 s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:teleport,dedicated:false});s=until(s,'follower-entry-abilities');
 const g=Object.values(s.groups!)[0]!;expect(g.targets.find(t=>t.actorId==='B')!.hits[0]!.defended).toBe(true);
 expect(s.windows!.at(-1)!.continuation).toMatchObject({targetId:'C'});s=finish(use(s));
 expect([s.players.B!.damage,s.players.C!.damage]).toEqual([0,24]);expect(discardIds(s).filter(id=>id===teleport)).toHaveLength(1);
});
