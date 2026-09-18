import {expect,it} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,ready,until,finish} from './combat-helpers.js';
import {entropy,handCard} from './fixtures.js';
import {takeCard} from './fixtures/scenario-tools.js';
import {makeEvadePhysicalScenario} from './fixtures/evade-physical-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
const rows=[['evade-physical-1','a2-p05-r3c1'],['evade-physical-2','a2-p05-r3c2'],['evade-physical-3','a2-p05-r3c3']] as const;
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
function single(card:string,attackName='踏み込み／弓',target='B'){let s=ready();for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};const attack=handCard(s,'A',attackName);takeCard(s,'B',card);return until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:[target],dedicated:false}),'normal-defense');}

it.each(rows)('%s physical %s cancels only the first of three actually chanted hits',(scenario,card)=>{
 let s=makeEvadePhysicalScenario(scenario,players);const group=Object.values(s.groups!)[0]!;expect(group.targets[0]!.hits.map(h=>h.damage)).toEqual([7,7,7]);s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});expect(s.resolution).toContain(card);expect(s.players.B!.hand).not.toContain(card);s=finish(s);expect(s.players.B!.damage).toBe(14);expect(s.players.C!.damage).toBe(0);expect(s.discard.filter(id=>id===card)).toHaveLength(1);expect(s.players.B!.hand).not.toContain(card);
});
it.each(rows)('%s physical %s does not cancel another recipient of the same actual technique',(scenario,card)=>{
 let s=makeEvadePhysicalScenario(scenario,players,false);expect(Object.values(s.groups!)[0]!.targets.map(t=>t.actorId)).toEqual(['B','C']);s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false}));expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBe(7);expect(s.discard.filter(id=>id===card)).toHaveLength(1);
});
it.each(rows)('%s physical %s is optional and negates its own incoming ordinary bow',(_scenario,card)=>{
 for(const use of [false,true]){let s=single(card);if(use)s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});s=finish(s);expect(s.players.B!.damage).toBe(use?0:4);expect(s.players.B!.hand.includes(card)).toBe(!use);expect(s.discard.filter(id=>id===card)).toHaveLength(use?1:0);}
});
it.each(rows)('%s physical %s stays paid when actual Fate cancels its defense',(_scenario,card)=>{
 let s=ready();const attack=handCard(s,'A','踏み込み／弓');takeCard(s,'B',card);const fate=handCard(s,'C','命運凶変');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});const defense=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!;expect(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]).toBe('C');s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:defense.id});s=finish(s);expect(s.players.B!.damage).toBe(4);expect(s.players.B!.hand).not.toContain(card);expect(s.discard.filter(id=>id===card)).toHaveLength(1);expect(s.discard.filter(id=>id===fate)).toHaveLength(1);
});
it.each(rows)('%s physical %s rejects actual mental and evade-prohibited attacks before paying',(_scenario,card)=>{
 for(const attack of ['呪歌','魔風']){let s=single(card,attack);reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});s=finish(s);expect(s.players.B!.hand).toContain(card);expect(s.discard).not.toContain(card);}
});
it.each(rows)('%s physical %s negates an actual nonmental magic hit without level comparison',(_scenario,card)=>{
 let s=single(card,'炎矢');expect(Object.values(s.actions!).find(a=>a.kind==='attack')!.technique).toMatchObject({school:'magic',damage:5});const rolls=s.rolls?.length??0;s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false}));expect(s.players.B!.damage).toBe(0);expect(s.rolls?.length??0).toBe(rolls);expect(s.discard.filter(id=>id===card)).toHaveLength(1);
});
it.each(rows)('%s physical %s cannot defend a different player or an already delegated follower hit',(_scenario,card)=>{
 let s=single(card,'踏み込み／弓','C');reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});s=finish(s);expect(s.players.C!.damage).toBe(4);expect(s.players.B!.hand).toContain(card);
 s=single(card);s=act(s,'B',{type:'START_FOLLOWERS'});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});s=finish(s);expect(s.players.B!.damage).toBe(4);expect(s.players.B!.hand).toContain(card);
});
