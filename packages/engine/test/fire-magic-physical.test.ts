import {expect,it} from 'vitest';
import {transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,finish,pass,until,passReclaims} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {makeFireMagicScenario,fireMagicMode,type FireMagicScenario} from './fixtures/fire-magic-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
const rows=['fire-arrow-ordinary','fire-arrow-dedicated','fire-dance-ordinary','fire-dance-dedicated','fire-explosion-ordinary','fire-explosion-dedicated'] as const;
function command(name:FireMagicScenario){const m=fireMagicMode(name);return {type:'ATTACK' as const,cardInstanceId:m.card,targetIds:m.dedicated?['B','C']:['B'],dedicated:m.dedicated};}
function reject(s:GameState,actorId:string,command:unknown,code?:string){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id)),r=transition(s,{actorId,command} as never,entropy());expect(r.ok).toBe(false);if(code)expect(r).toMatchObject({code});expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
it.each(rows)('%s actual printed magic profile and use-level boundary distinguish ordinary and dedicated without chant',scenario=>{
 const m=fireMagicMode(scenario);for(const level of [m.use-1,m.use]){let s=act(makeFireMagicScenario(scenario,players,{level}),'A',command(scenario));const f=Object.values(s.actions!).find(a=>a.cardInstanceId===m.card)!;expect(f.technique).toMatchObject({school:'magic',range:'far',useLevel:m.use,effectLevel:m.effect,damage:m.damage,attributes:['魔','炎'],chant:false,noChecks:m.dedicated,target:m.dedicated?'all':'one'});expect(!!f.technique.evadeProhibited).toBe(m.noEvade);expect(f.checkSpecs).toHaveLength(m.dedicated?0:m.use-level);s=finish(s);expect([s.players.B!.damage,s.players.C!.damage,s.players.D!.damage]).toEqual([m.damage,m.dedicated?m.damage:0,0]);expect(discardIds(s).filter(id=>id===m.card)).toHaveLength(1);}
});
it.each(rows)('%s actual one-card maai prevents only the selected recipients hit',scenario=>{
 const m=fireMagicMode(scenario);let s=until(act(makeFireMagicScenario(scenario,players),'A',command(scenario)),'normal-defense');s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'}));s=finish(s);expect([s.players.B!.damage,s.players.C!.damage]).toEqual([0,m.dedicated?m.damage:0]);
});
it.each(rows)('%s actual Evade is forbidden only by Flame Dance and does not affect the other recipient',scenario=>{
 const m=fireMagicMode(scenario);let s=until(act(makeFireMagicScenario(scenario,players),'A',command(scenario)),'normal-defense');if(m.noEvade){reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p05-r3c1',dedicated:false},'ILLEGAL_DEFENSE');s=finish(s);expect([s.players.B!.damage,s.players.C!.damage]).toEqual([m.damage,m.dedicated?m.damage:0]);expect(s.players.B!.hand).toContain('a2-p05-r3c1');}else{s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p05-r3c1',dedicated:false}));expect([s.players.B!.damage,s.players.C!.damage]).toEqual([0,m.dedicated?m.damage:0]);}
});
it.each(rows)('%s actual Fate cancellation pays once without magic damage or dedicated leftovers',scenario=>{
 const m=fireMagicMode(scenario);let s=act(makeFireMagicScenario(scenario,players),'A',command(scenario));const id=Object.values(s.actions!).find(a=>a.cardInstanceId===m.card)!.id;s=pass(s);s=pass(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id});s=finish(s);expect([s.players.B!.damage,s.players.C!.damage]).toEqual([0,0]);expect(discardIds(s).filter(id=>id===m.card)).toHaveLength(1);expect(s.rolls??[]).toEqual([]);
});
it.each(rows)('%s actual initial Soldier HP still reduces fire damage and disposes once',scenario=>{
 const m=fireMagicMode(scenario);let s=makeFireMagicScenario(scenario,players,{follower:true});const guard=s.players.B!.followers[0]!.cardInstanceId;s=finish(act(s,'A',command(scenario)));expect([s.players.B!.damage,s.players.C!.damage]).toEqual([m.damage-1,m.dedicated?m.damage:0]);expect(discardIds(s).filter(id=>id===guard)).toHaveLength(1);expect(s.players.B!.followers).toEqual([]);
});
it.each(rows)('%s cannot use magic after actual Silence and real subsequent turns',scenario=>{
 const s=makeFireMagicScenario(scenario,players,{silenced:true});expect(s.rolls!.some(r=>r.faces.join(',')==='6,6'&&r.success===false)).toBe(true);reject(s,'A',command(scenario),'SILENCED');
});
it.each(['fire-arrow-dedicated','fire-dance-dedicated','fire-explosion-dedicated'] as const)('%s refuses foreign dedicated owner, ordinary multi-target and invented chant or variant',scenario=>{
 const s=makeFireMagicScenario(scenario,players),foreign=makeFireMagicScenario(scenario,players,{owner:'侍大将のシン'});reject(foreign,'A',command(scenario),'UNSUPPORTED_CARD');reject(s,'A',{...command(scenario),dedicated:false});reject(s,'A',{type:'CHANT',cardInstanceId:fireMagicMode(scenario).card});reject(s,'A',{...command(scenario),techniqueVariant:'two-hit'});
});
