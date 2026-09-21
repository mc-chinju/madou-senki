import {expect,it} from 'vitest';
import {gameStats,transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,pass,until,finish} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {makeLeafDefenseScenario,leafDefenseMode,type LeafDefenseScenario} from './fixtures/leaf-defense-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id})),card='a2-p13-r2c2';
const rows=['leaf-ordinary','leaf-dedicated'] as const;
function command(scenario:LeafDefenseScenario){return {type:'PLAY_DEFENSE' as const,cardInstanceId:card,dedicated:leafDefenseMode(scenario).dedicated};}
function settle(s:GameState,faces:number[]=[6,6]){for(let n=0;n<400&&s.windows?.length;n++){expect(s.windows!.at(-1)!.kind).not.toBe('ability-attack');const r=s.rolls?.at(-1);s=pass(s,r?.purpose==='technique-check'&&r.rollerId==='A'&&r.stage==='before-roll'?faces:[1,1]);}expect(s.windows??[]).toEqual([]);return s;}
function reject(s:GameState,id:string,c:unknown,code?:string){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id)),r=transition(s,{actorId:id,command:c} as never,entropy());expect(r.ok).toBe(false);if(code)expect(r).toMatchObject({code});expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
it.each(rows)('%s actual profile retains own use checks and ignores incoming level after real Prayer6',scenario=>{
 const dedicated=leafDefenseMode(scenario).dedicated;for(const level of [2,3]){let s=makeLeafDefenseScenario(scenario,players,{level,bonus:6});expect(Object.values(s.groups!)[0]!.technique.effectLevel).toBe(10);s=act(s,'B',command(scenario));const f=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!;expect(f.technique).toMatchObject({school:'magic',range:'none',useLevel:3,effectLevel:3,damage:null,attributes:['魔','忍','反'],counter:true,chant:false,noChecks:false,defense:'fixed-negate',fixedNegate:{automatic:dedicated,forbiddenAttributes:['炎','風']}});expect(f.checkSpecs).toHaveLength(3-level);s=settle(s);expect(s.players.B!.damage).toBe(0);expect(s.players.A!.damage).toBe(0);expect(s.rolls!.filter(r=>r.purpose==='technique-check'&&r.rollerId==='A')).toHaveLength(dedicated?0:1);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);}
});
it.each([[1,1,true,5],[6,6,false,0]] as const)('ordinary actual attacker %s %s success=%s leaves body %s without a counter attack',(d1,d2,success,damage)=>{
 let s=makeLeafDefenseScenario('leaf-ordinary',players);s=settle(act(s,'B',command('leaf-ordinary')),[d1,d2]);expect(s.rolls!.find(r=>r.purpose==='technique-check')).toMatchObject({rollerId:'A',modifier:-1,threshold:5,success,faces:[d1,d2]});expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,damage]);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);
});
it.each(rows)('%s actual warrior attack from Shin has no exception and no extra attack grant',scenario=>{
 let s=settle(act(makeLeafDefenseScenario(scenario,players,{attack:'warrior'}),'B',command(scenario)));expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);expect(s.phase).toBe('withdrawal');expect(s.seatOrder[s.turnSeat]).toBe('A');
});
it.each(['leaf-three-ordinary','leaf-three-dedicated'] as const)('%s actual chanted three-hit two-target Shin attack loses only B first hit',scenario=>{
 let s=makeLeafDefenseScenario(scenario,players);expect(Object.values(s.groups!)[0]!.targets.map(t=>t.hits.length)).toEqual([3,3]);s=settle(act(s,'B',command(scenario)));expect([s.players.A!.damage,s.players.B!.damage,s.players.C!.damage]).toEqual([0,14,21]);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);expect(discardIds(s).filter(id=>id==='a2-p10-r1c3')).toHaveLength(1);expect(s.rolls!.filter(r=>r.purpose==='technique-check'&&r.rollerId==='A')).toHaveLength(leafDefenseMode(scenario).dedicated?0:1);
});
it.each(rows)('%s actual Fate cancellation pays defense but leaves the original attack intact',scenario=>{
 let s=act(makeLeafDefenseScenario(scenario,players),'B',command(scenario));const id=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!.id;expect(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]).toBe('C');s=settle(act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id}));expect(s.players.B!.damage).toBe(5);expect((s.rolls??[]).filter(r=>r.purpose==='technique-check')).toEqual([]);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);
});
it('ordinary actual enemy success allows a different defense while spent Leaf cannot be retried',()=>{
 let s=act(makeLeafDefenseScenario('leaf-ordinary',players),'B',command('leaf-ordinary'));for(let n=0;n<200&&!(s.windows?.at(-1)?.kind==='normal-defense'&&discardIds(s).includes(card));n++)s=pass(s);expect(s.rolls!.find(r=>r.purpose==='technique-check')!.success).toBe(true);reject(s,'B',command('leaf-ordinary'));s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p05-r3c1',dedicated:false}));expect(s.players.B!.damage).toBe(0);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);
});
it.each([['leaf-ordinary','fire'],['leaf-dedicated','fire'],['leaf-ordinary','wind'],['leaf-dedicated','wind']] as const)('%s refuses actual %s attribute before payment even for Ida',(scenario,attack)=>{
 const s=makeLeafDefenseScenario(scenario,players,{attack});reject(s,'B',command(scenario),'ILLEGAL_DEFENSE');expect(s.players.B!.hand).toContain(card);
});
it.each(rows)('%s refuses actual counter-prohibited attack and foreign dedicated owner',scenario=>{
 const s=makeLeafDefenseScenario(scenario,players,{attack:'prohibited'});reject(s,'B',command(scenario),'ILLEGAL_DEFENSE');const foreign=makeLeafDefenseScenario(scenario,players,{owner:'聖騎士ランスロット'});reject(foreign,'B',{...command(scenario),dedicated:true});
});
it.each(rows)('%s actual non-use retains Leaf and later own action refuses attack or chant from it',scenario=>{
 let s=settle(makeLeafDefenseScenario(scenario,players));expect(s.players.B!.damage).toBe(5);expect(s.players.B!.hand).toContain(card);for(let n=0;n<100;n++){const id=s.seatOrder[s.turnSeat]!;if(s.windows?.length)s=pass(s);else if(s.phase==='action'){if(id==='B')break;s=act(s,id,{type:'PASS_ACTION'});}else if(s.phase==='withdrawal')s=act(s,id,{type:'PASS_WITHDRAWAL'});else if(s.phase==='hand-adjustment')s=act(s,id,{type:'END_TURN',discardIds:s.players[id]!.hand.slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});else if(s.phase==='turn-start')s=act(s,id,{type:'START_TURN'});else if(s.phase==='draw')s=act(s,id,{type:'CHOOSE_DRAW',draw:false});}expect(s.phase).toBe('action');expect(s.seatOrder[s.turnSeat]).toBe('B');reject(s,'B',{type:'ATTACK',cardInstanceId:card,targetIds:['A'],dedicated:leafDefenseMode(scenario).dedicated});reject(s,'B',{type:'CHANT',cardInstanceId:card});
});
it.each(rows)('%s actual failed own use check prevents even dedicated automatic negation',scenario=>{
 let s=act(makeLeafDefenseScenario(scenario,players,{level:2}),'B',command(scenario));s=until(s,'before-roll');expect(s.rolls!.at(-1)).toMatchObject({rollerId:'B',purpose:'excess-level'});for(let n=0;n<400&&s.windows?.length;n++){const r=s.rolls?.at(-1);s=pass(s,r?.rollerId==='B'&&r.purpose==='excess-level'&&r.stage==='before-roll'?[6,6]:[1,1]);}expect(s.rolls!.find(r=>r.purpose==='excess-level')!.success).toBe(false);expect(s.rolls!.filter(r=>r.purpose==='technique-check')).toEqual([]);expect(s.players.B!.damage).toBe(5);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);
});
