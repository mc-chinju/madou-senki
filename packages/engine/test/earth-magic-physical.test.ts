import {expect,it} from 'vitest';
import {gameStats,transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,until,passReclaims} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {makeEarthMagicScenario,earthMagicMode,type EarthMagicScenario} from '../../../apps/worker/test/fixtures/earth-magic-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
const rows=['earth-spear-ordinary','earth-spear-dedicated','earth-stream-ordinary','earth-stream-dedicated'] as const;
function command(name:EarthMagicScenario){const m=earthMagicMode(name);return {type:'ATTACK' as const,cardInstanceId:m.card,targetIds:m.dedicated?['B','C']:['B'],dedicated:m.dedicated};}
function reject(s:GameState,actorId:string,command:unknown,code?:string){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id)),r=transition(s,{actorId,command} as never,entropy());expect(r.ok).toBe(false);if(code)expect(r).toMatchObject({code});expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
function nextOwn(s:GameState,card:string){for(let n=0;n<100;n++){const id=s.seatOrder[s.turnSeat]!;if(s.windows?.length)s=pass(s);else if(s.phase==='action'){if(id==='A')return s;s=act(s,id,{type:'PASS_ACTION'});}else if(s.phase==='withdrawal')s=act(s,id,{type:'PASS_WITHDRAWAL'});else if(s.phase==='hand-adjustment')s=act(s,id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>x!==card).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});else if(s.phase==='turn-start')s=act(s,id,{type:'START_TURN'});else if(s.phase==='draw')s=act(s,id,{type:'CHOOSE_DRAW',draw:false});else throw Error('ANNIHILATION_TURN');}throw Error('ANNIHILATION_TURN_LIMIT');}
function claim(s:GameState,card:string){for(let n=0;n<300;n++){const d=viewFor(s,'A').reclaim;if(s.windows?.at(-1)?.kind==='reclaim'&&d?.pendingActorId==='A'&&d.cardInstanceId===card){expect(d.claims.map(c=>c.right)).toContain('base');return act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims.find(c=>c.right==='base')!.claimId});}s=pass(s);}throw Error('ANNIHILATION_CLAIM');}
it.each(rows)('%s actual printed magic profile and use-level boundary distinguish ordinary and dedicated without chant',scenario=>{
 const m=earthMagicMode(scenario);for(const level of [m.use-1,m.use]){let s=act(makeEarthMagicScenario(scenario,players,{level}),'A',command(scenario));const f=Object.values(s.actions!).find(a=>a.cardInstanceId===m.card)!;expect(f.technique).toMatchObject({school:'magic',range:'far',useLevel:m.use,effectLevel:m.effect,damage:m.damage,attributes:['魔','地'],chant:false,noChecks:m.dedicated,target:m.dedicated?'all':'one'});expect(f.technique.maaiRequired??1).toBe(m.maai);expect(f.checkSpecs).toHaveLength(m.dedicated?0:m.use-level);s=finish(s);expect([s.players.B!.damage,s.players.C!.damage,s.players.D!.damage]).toEqual([m.damage,m.dedicated?m.damage:0,0]);expect(s.discard.filter(id=>id===m.card)).toHaveLength(1);}
});
it.each(rows)('%s actual maai needs the printed number of different cards and defends only its target',scenario=>{
 const m=earthMagicMode(scenario);for(const count of [1,2]){let s=until(act(makeEarthMagicScenario(scenario,players),'A',command(scenario)),'normal-defense');s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'}));reject(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'});if(m.maai===2&&count===2)s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c2'}));s=finish(s);expect([s.players.B!.damage,s.players.C!.damage]).toEqual([count>=m.maai?0:m.damage,m.dedicated?m.damage:0]);expect(s.players.B!.hand.includes('a2-p07-r1c2')).toBe(m.maai===1||count===1);}
});
it.each(rows)('%s actual Evade defends only B without changing dedicated C damage',scenario=>{
 const m=earthMagicMode(scenario);let s=until(act(makeEarthMagicScenario(scenario,players),'A',command(scenario)),'normal-defense');s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p05-r3c1',dedicated:false}));expect([s.players.B!.damage,s.players.C!.damage]).toEqual([0,m.dedicated?m.damage:0]);expect(s.discard).toContain('a2-p05-r3c1');
});
it.each(rows)('%s actual Fate cancels then base reclaim and later real turn reuse preserve elected values',scenario=>{
 const m=earthMagicMode(scenario);let s=act(makeEarthMagicScenario(scenario,players),'A',command(scenario));const id=Object.values(s.actions!).find(a=>a.cardInstanceId===m.card)!.id;s=pass(s);s=pass(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id});s=finish(claim(s,m.card));expect([s.players.B!.damage,s.players.C!.damage]).toEqual([0,0]);expect(s.players.A!.hand.filter(id=>id===m.card)).toHaveLength(1);expect(s.players.A!.reclaimUsage?.[m.name]?.baseSpent).toBe(true);s=nextOwn(s,m.card);s=finish(act(s,'A',command(scenario)));expect([s.players.B!.damage,s.players.C!.damage]).toEqual([m.damage,m.dedicated?m.damage:0]);expect(s.discard.filter(id=>id===m.card)).toHaveLength(1);
});
it.each(rows)('%s actual initial Soldier HP still reduces fire damage and disposes once',scenario=>{
 const m=earthMagicMode(scenario);let s=makeEarthMagicScenario(scenario,players,{follower:true});const guard=s.players.B!.followers[0]!.cardInstanceId;s=finish(act(s,'A',command(scenario)));expect([s.players.B!.damage,s.players.C!.damage]).toEqual([m.damage-1,m.dedicated?m.damage:0]);expect(s.discard.filter(id=>id===guard)).toHaveLength(1);expect(s.players.B!.followers).toEqual([]);
});
it.each(rows)('%s cannot use magic after actual Silence and real subsequent turns',scenario=>{
 const s=makeEarthMagicScenario(scenario,players,{silenced:true});expect(s.rolls!.some(r=>r.faces.join(',')==='6,6'&&r.success===false)).toBe(true);reject(s,'A',command(scenario),'SILENCED');
});
it.each(['earth-spear-dedicated','earth-stream-dedicated'] as const)('%s refuses foreign dedicated owner, ordinary multi-target and invented chant or variant',scenario=>{
 const s=makeEarthMagicScenario(scenario,players),foreign=makeEarthMagicScenario(scenario,players,{owner:'侍大将のシン'});reject(foreign,'A',command(scenario),'UNSUPPORTED_CARD');reject(s,'A',{...command(scenario),dedicated:false});reject(s,'A',{type:'CHANT',cardInstanceId:earthMagicMode(scenario).card});reject(s,'A',{...command(scenario),techniqueVariant:'two-hit'});
});
