import {expect,it} from 'vitest';
import {gameStats,transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,finish,until,pass,closeWindow,passReclaims,ready} from './combat-helpers.js';
import {entropy,handCard} from './fixtures.js';
import {assignCharacter} from './fixtures/scenario-tools.js';
import {makeIceMirrorScenario} from './fixtures/ice-mirror-scenarios.js';
const CARD='a2-p12-r3c2',players=['A','B','C','D'].map(id=>({id,name:id}));
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
function declare(s:GameState,dedicated:boolean){return act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:CARD,dedicated});}
it.each([false,true])('Physical Ice Mirror retains printed magic reflection and waives checks only for elected Aiel dedicated=%s',dedicated=>{
 let s=makeIceMirrorScenario('ice-mirror-magic',players);expect(gameStats(s,'B').magic_level).toBe(5);s=declare(s,dedicated);const defense=Object.values(s.actions!).find(a=>a.cardInstanceId===CARD)!;expect(defense.technique).toMatchObject({school:'magic',range:'none',useLevel:6,effectLevel:6,damage:null,attributes:['魔','反'],counter:true,defense:'reflect',chant:false,noChecks:dedicated});expect(defense.checkSpecs).toHaveLength(dedicated?0:1);expect(s.resolution).toContain(CARD);s=finish(s);expect(s.rolls?.filter(r=>r.purpose==='excess-level').length??0).toBe(dedicated?0:1);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([5,0]);expect(discardIds(s).filter(id=>id===CARD)).toHaveLength(1);
});
it('Physical Ice Mirror ordinary refuses warrior6 while elected Aiel blocks that same actual hit',()=>{
 let s=makeIceMirrorScenario('ice-mirror-warrior',players);expect(viewFor(s,'B').currentAttack!.technique.effectLevel).toBe(6);reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:CARD,dedicated:false});s=finish(declare(s,true));expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);expect(s.rolls?.filter(r=>r.purpose==='excess-level').length??0).toBe(0);expect(discardIds(s).filter(id=>id===CARD)).toHaveLength(1);
});
it.each([false,true])('Physical Ice Mirror real Prayer changes its relative limit without creating ordinary warrior permission dedicated=%s',dedicated=>{
 let s=makeIceMirrorScenario('ice-mirror-magic',players);s=until(declare(s,dedicated),'effect-level');while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);const id=Object.values(s.actions!).find(a=>a.cardInstanceId===CARD)!.id;s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:'a2-p05-r2c3',mode:'effect-plus',targetActionId:id});for(let n=0;n<300;n++){if(s.windows?.at(-1)?.kind==='damage'&&s.windows.at(-1)!.continuation.id===id)break;s=pass(s,[2]);}
 expect(s.actions![id]!.technique).toMatchObject({useLevel:6,effectLevel:8,reflectMagicLimit:8,blockWarriorLimit:dedicated?8:-1});s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([5,0]);expect(discardIds(s).filter(id=>id===CARD)).toHaveLength(1);
});
it('Physical Ice Mirror rejects attacks above its declared limit and a foreign dedicated owner unchanged',()=>{
 for(const [scenario,attack] of [['ice-mirror-magic','炎舞'],['ice-mirror-warrior','a2-p10-r1c2']] as const){const s=makeIceMirrorScenario(scenario,players,attack,scenario==='ice-mirror-magic');expect(viewFor(s,'B').currentAttack!.technique.effectLevel).toBeGreaterThan(6);reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:CARD,dedicated:true});}
 const s=makeIceMirrorScenario('ice-mirror-magic',players);assignCharacter(s,'B','黒騎士ガーウィン');reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:CARD,dedicated:true});expect(s.players.B!.hand).toContain(CARD);
});
it('Physical Ice Mirror actual failed check and canceled declaration both keep payment without reflection',()=>{
 for(const cancel of [false,true]){let s=makeIceMirrorScenario('ice-mirror-magic',players);s=declare(s,false);if(cancel){const id=Object.values(s.actions!).find(a=>a.cardInstanceId===CARD)!.id;s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id});}else{s=until(s,'before-roll');s=passReclaims(closeWindow(s,[6,6]));expect(s.rolls!.at(-1)!.success).toBe(false);}s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,5]);expect(discardIds(s).filter(id=>id===CARD)).toHaveLength(1);expect(s.players.B!.hand).not.toContain(CARD);}
});
it('Physical Ice Mirror is defense-only and normal defense closes after actual follower start',()=>{
 let s=ready();handCard(s,'A','氷鏡');reject(s,'A',{type:'ATTACK',cardInstanceId:CARD,targetIds:['B'],dedicated:false});s=makeIceMirrorScenario('ice-mirror-magic',players);s=act(s,'B',{type:'START_FOLLOWERS'});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:CARD,dedicated:true});s=finish(s);expect(s.players.B!.damage).toBe(5);expect(s.players.B!.hand).toContain(CARD);
});
it('Physical Ice Mirror cannot answer an actual counter-prohibited Lester poem even for Aiel',()=>{
 let s=ready();assignCharacter(s,'A','吟遊詩人のレスター');assignCharacter(s,'B','凍気のアイエル');const poem=handCard(s,'A','呪歌');handCard(s,'B','氷鏡');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:poem,targetIds:['B'],dedicated:true}),'normal-defense');expect(viewFor(s,'B').currentAttack!.defenseRestrictions.counterProhibited).toBe(true);reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:CARD,dedicated:true});expect(s.players.B!.hand).toContain(CARD);
});
