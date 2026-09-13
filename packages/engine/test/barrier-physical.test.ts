import {expect,it} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,until,pass,closeWindow,passReclaims,ready} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {takeCard} from '../../../apps/worker/test/fixtures/scenario-tools.js';
import {makeBarrierPhysicalScenario} from '../../../apps/worker/test/fixtures/barrier-physical-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
const rows=[['barrier-physical-1','a2-p18-r2c2'],['barrier-physical-2','a2-p18-r2c3']] as const;
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
it.each(rows)('%s physical %s copies received magic6 with one missing-level check or no check at magic6',(scenario,card)=>{
 for(const level of [5,6]){let s=makeBarrierPhysicalScenario(scenario,players,{level});s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});const defense=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!;expect(defense.technique).toMatchObject({school:'magic',range:'none',useLevel:6,effectLevel:6,damage:null,attributes:['魔','反'],counter:true,defense:'negate',chant:false,noChecks:false});expect(defense.technique.attributes).not.toContain('−');expect(defense.checkSpecs).toHaveLength(6-level);expect(s.resolution).toContain(card);s=finish(s);expect(s.rolls?.filter(r=>r.purpose==='excess-level').length??0).toBe(6-level);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);expect(s.discard.filter(id=>id===card)).toHaveLength(1);}
});
it.each(rows)('%s physical %s failed check stays paid and a different physical barrier can succeed',(scenario,card)=>{
 let s=makeBarrierPhysicalScenario(scenario,players);s=until(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false}),'before-roll');s=passReclaims(closeWindow(s,[6,6]));expect(s.rolls!.at(-1)).toMatchObject({purpose:'excess-level',threshold:6,success:false});s=until(s,'normal-defense');reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});const spare=card==='a2-p18-r2c2'?'a2-p18-r2c3':'a2-p18-r2c2';s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:spare,dedicated:false}));expect(s.rolls!.filter(r=>r.purpose==='excess-level').map(r=>r.success)).toEqual([false,true]);expect(s.players.B!.damage).toBe(0);expect(s.discard.filter(id=>id===card||id===spare)).toHaveLength(2);
});
it.each(rows)('%s physical %s real Prayer changes effect only and never adds a new use check or returned attack',(scenario,card)=>{
 let s=makeBarrierPhysicalScenario(scenario,players);s=until(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false}),'effect-level');while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);const id=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!.id;s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:'a2-p05-r2c3',mode:'effect-plus',targetActionId:id});for(let n=0;n<300;n++){if(s.windows?.at(-1)?.kind==='damage'&&s.windows.at(-1)!.continuation.id===id)break;s=pass(s,[2]);}expect(s.actions![id]!.technique).toMatchObject({useLevel:6,effectLevel:8,damage:null});expect(s.rolls!.filter(r=>r.purpose==='excess-level')).toHaveLength(1);s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);expect(s.discard.filter(id=>id===card)).toHaveLength(1);
});
it.each(rows)('%s physical %s cancels only its own hit in an actual two-target dedicated Ice Arrow',(scenario,card)=>{
 let s=makeBarrierPhysicalScenario(scenario,players,{mode:'multiple'});expect(Object.values(s.groups!)[0]!.targets.map(t=>t.actorId)).toEqual(['B','C']);s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false}));expect([s.players.A!.damage,s.players.B!.damage,s.players.C!.damage]).toEqual([0,0,6]);expect(s.discard.filter(id=>id===card)).toHaveLength(1);
});
it.each(rows)('%s physical %s actual Fate cancellation keeps payment and original magic damage',(scenario,card)=>{
 let s=makeBarrierPhysicalScenario(scenario,players);s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});const id=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!.id;s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id});s=finish(s);expect(s.rolls?.filter(r=>r.purpose==='excess-level')??[]).toEqual([]);expect(s.players.B!.damage).toBe(5);expect(s.discard.filter(id=>id===card)).toHaveLength(1);expect(s.players.B!.hand).not.toContain(card);
});
it.each(rows)('%s physical %s refuses warrior actual counter prohibition invented dedicated and root attack unchanged',(scenario,card)=>{
 for(const mode of ['warrior','prohibited'] as const){const s=makeBarrierPhysicalScenario(scenario,players,{mode});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});expect(s.players.B!.hand).toContain(card);}const ordinary=makeBarrierPhysicalScenario(scenario,players);reject(ordinary,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:true});const s=ready();takeCard(s,'A',card);reject(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});
});
it.each(rows)('%s physical %s optional decline and actual follower start retain the unspent source',(scenario,card)=>{
 for(const followers of [false,true]){let s=makeBarrierPhysicalScenario(scenario,players);if(followers){s=act(s,'B',{type:'START_FOLLOWERS'});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});}s=finish(s);expect(s.players.B!.damage).toBe(5);expect(s.players.B!.hand).toContain(card);expect(s.discard).not.toContain(card);}
});

it.each(rows)('%s structural three-hit input lets physical %s cancel only first own hit after reconstruction',(scenario,card)=>{
 let s=makeBarrierPhysicalScenario(scenario,players,{mode:'multiple',level:6});
 const group=Object.values(s.groups!)[0]!;
 // Explicit resolver input: this does not claim Ice Arrow produces three hits.
 for(const target of group.targets)target.hits=Array.from({length:3},()=>structuredClone(target.hits[0]!));
 s=JSON.parse(JSON.stringify(s)) as GameState;
 s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});
 s=JSON.parse(JSON.stringify(s)) as GameState;
 s=finish(s);
 expect([s.players.A!.damage,s.players.B!.damage,s.players.C!.damage]).toEqual([0,12,18]);
 expect(s.discard.filter(id=>id===card)).toHaveLength(1);
 expect(s.resolution).not.toContain(card);
});
