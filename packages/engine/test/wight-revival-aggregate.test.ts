import {expect,it} from 'vitest';
import {gameStats,transition,viewFor,type GameState} from '../src/index.js';
import {act,pass,finish,until,closeWindow} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {makeWightPhysicalScenario} from '../../../apps/worker/test/fixtures/wight-physical-scenarios.js';
const SK='a2-p21-r1c1',METAL='a2-p22-r1c1',ARMY='a2-p05-r2c2',DWARF='a2-p21-r2c3',SAINT='a2-p22-r1c3',KNIGHT='a2-p21-r2c1',players=['A','B','C','D'].map(id=>({id,name:id}));
function reject(s:GameState,actorId:string,c:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command:c} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
function ready(s:GameState,card=SK,initial=true,rear=false){if(initial)s=act(s,'A',{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:card});if(rear)s=act(s,'A',{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:'a2-p22-r1c1'});for(const id of s.seatOrder)s=act(s,id,{type:'PASS_SETUP'});s=act(s,'A',{type:'START_TURN'});return act(s,'A',{type:'CHOOSE_DRAW',draw:false});}
function next(s:GameState,target='B'){for(let n=0;n<180;n++){const id=s.seatOrder[s.turnSeat]!,w=s.windows?.at(-1);if(w)s=pass(s);else if(id===target&&s.phase==='action')return s;else if(s.phase==='action')s=act(s,id,{type:'PASS_ACTION'});else if(s.phase==='withdrawal')s=act(s,id,{type:'PASS_WITHDRAWAL'});else if(s.phase==='hand-adjustment')s=act(s,id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>!['a2-p24-r1c2','a2-p24-r2c1','a2-p21-r2c3','a2-p22-r1c3','a2-p21-r2c1','a2-p14-r1c2'].includes(x)).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});else if(s.phase==='turn-start')s=act(s,id,{type:'START_TURN'});else if(s.phase==='draw')s=act(s,id,{type:'CHOOSE_DRAW',draw:false});else throw Error('ORC_FORT_TURN');}throw Error('ORC_FORT_LIMIT');}
function bundle(s:GameState,ids=[DWARF]){const o=viewFor(s,'B').followerBundleOptions.find(o=>o.abilityId==='c2-p06-r1c2-ab04')!;return act(s,'B',{type:'USE_FOLLOWER_ATTACK',abilityId:o.abilityId,targetEventId:o.targetEventId,sources:ids.map(cardInstanceId=>({cardInstanceId,dedicated:false,targetIds:['A']}))});}
function approach(s:GameState,actor='B'){return finish(act(s,actor,{type:'APPROACH',cardInstanceId:actor==='B'?'a2-p24-r2c1':'a2-p24-r1c3',targetId:actor==='B'?'A':'B'}));}
function defense(level=6,rear=false){return approach(next(ready(makeWightPhysicalScenario('wight-defense-revive',players,{level}),SK,true,rear)));}
it.each([0,3])('structural destruction at hit%i prevents revival while every other saved hit keeps follower HP',index=>{
 let s=until(bundle(defense(),[DWARF,SAINT]),'follower-start');
 const t=Object.values(s.groups!)[0]!.targets[0]!;
 // Explicit mixed-effect resolver input, not a claim about the printed grant sources.
 const h=t.hits[index]!;
 h.technique={...structuredClone(h.technique!),destroyFollowerAttributes:['死']};
 s=JSON.parse(JSON.stringify(s)) as GameState;
 s=until(s,'hit');
 const f=Object.values(s.groups!)[0]!.targets[0]!.followerDefense![0]!;
 expect(f.revivalForbidden).toBe(true);
 expect(f.hits.map(h=>h.hpReduction)).toEqual(Array.from({length:4},()=>0));
 expect(f.hits[index]!.outcome).toBe('attribute-destroyed');
 s=finish(JSON.parse(JSON.stringify(s)) as GameState);
 expect(s.players.A!.damage).toBe(26);
 expect(s.players.A!.followers).toEqual([]);
 expect(s.discard.filter(id=>id===SK)).toHaveLength(1);
});
