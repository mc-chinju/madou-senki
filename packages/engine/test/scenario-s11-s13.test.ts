import {expect,it} from 'vitest';
import {allCardInstanceIds,type GameState} from '../src/index.js';
import {getAction} from '@madou/catalog';
import {resolveFollowerSnapshot,freezeFollowerSnapshot} from '../src/combat/followers.js';
import {act,finish,passReclaims,ready,until} from './combat-helpers.js';
import {handCard} from './fixtures.js';
import {makeR6MaaiScenario} from './fixtures/r6-maai-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
const card=(s:GameState,owner:string,name:string)=>s.players[owner]!.hand.find(id=>getAction(id)!.name===name)!;
it('S11 actual chanted one-hit two-target sword shares one advance against both maai and preserves pair distances through final damage',()=>{let s=makeR6MaaiScenario(players),distances=structuredClone(s.distances);const bm=card(s,'B','間合い／休息'),cm=card(s,'C','間合い／休息'),advance=card(s,'A','踏み込み／蹴る');expect(Object.values(s.groups!)[0]!.hitIndices).toEqual([0]);s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:bm}));s=passReclaims(act(s,'C',{type:'PLAY_MAAI',cardInstanceId:cm}));expect(s.windows!.at(-1)!.kind).toBe('defense-advance');s=passReclaims(act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advance}));expect(s.windows!.at(-1)).toMatchObject({kind:'normal-defense',continuation:{targetId:'B'}});expect(s.distances).toEqual(distances);for(const id of [bm,cm,advance])expect(s.discard.filter(x=>x===id)).toHaveLength(1);s=finish(s);expect(s.distances).toEqual(distances);expect([s.players.B!.damage,s.players.C!.damage]).toEqual([7,7]);expect(s.phase).toBe('withdrawal');});
it('S12 actual chanted three-hit sword one maai evades only the first hit and retains exactly two live hits',()=>{let s=makeR6MaaiScenario(players,true);const maai=card(s,'B','間合い／休息');expect(Object.values(s.groups!)[0]!.hitIndices).toEqual([0,1,2]);s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai}));s=act(s,'A',{type:'PASS'});const target=Object.values(s.groups!)[0]!.targets[0]!;expect(target.hits.map(h=>h.defended)).toEqual([true,false,false]);expect(s.windows!.at(-1)).toMatchObject({kind:'normal-defense',continuation:{targetId:'B'}});expect(Object.values(s.groups!)[0]!.hitCursor).toBe(1);s=finish(s);expect(s.players.B!.damage).toBe(14);expect(s.discard.filter(id=>id===maai)).toHaveLength(1);expect(s.phase).toBe('withdrawal');});
it('S13 abstract Lv5 damage6 three-hit resolver with front Lv3 HP2 yields four each and destroys one physical follower once',()=>{
 let s=ready();for(const p of Object.values(s.players))p.permanent={endurance:100};const attack=handCard(s,'A','踏み込み／弓'),soldier=handCard(s,'B','兵士');s.players.B!.hand=s.players.B!.hand.filter(id=>id!==soldier);s.players.B!.followers=[{cardInstanceId:soldier,revealed:false}];s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'follower-start');
 // Explicit abstract arithmetic boundary: these numbers are not claimed as printed Soldier/bow effects.
 const g=Object.values(s.groups!)[0]!,t=g.targets[0]!;g.technique={...g.technique,effectLevel:5,damage:6};g.hitIndices=[0,1,2];t.hits=[0,1,2].map(index=>({index,damage:6,defended:false,hit:false,lineage:[]}));delete t.followerDefense;freezeFollowerSnapshot(s,g,t);const source=t.followerDefense![0]!;source.descriptor={...source.descriptor,level:3,hp:2,moraleRequired:false};source.levels=[3,3,3];const restored=JSON.parse(JSON.stringify(s)) as GameState,rg=restored.groups![g.id]!,rt=rg.targets[0]!;
 expect(resolveFollowerSnapshot(s,g,t,()=>{throw Error('S13_UNEXPECTED_MORALE');})).toBe(true);expect(resolveFollowerSnapshot(restored,rg,rt,()=>{throw Error('S13_UNEXPECTED_MORALE');})).toBe(true);expect(restored).toEqual(s);expect(t.hits.map(h=>h.damage)).toEqual([4,4,4]);expect(source.hits.map(h=>h.hpReduction)).toEqual([2,2,2]);expect(t.followerDestroyed).toEqual([soldier]);expect(s.resolution.filter(id=>id===soldier)).toHaveLength(1);const settled=JSON.stringify(s);expect(resolveFollowerSnapshot(s,g,t,()=>1)).toBe(true);expect(JSON.stringify(s)).toBe(settled);expect(new Set(allCardInstanceIds(s)).size).toBe(220);s=finish(s);expect(s.players.B!.damage).toBe(12);expect(s.players.B!.followers).toEqual([]);expect(s.discard.filter(id=>id===soldier)).toHaveLength(1);
});
it('S12 second and third actual Hundred Slash hits open separate normal defenses after first-hit maai',()=>{
 let s=makeR6MaaiScenario(players,true);const maai=card(s,'B','間合い／休息');
 s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai}));s=act(s,'A',{type:'PASS'});
 const second=s.windows!.at(-1)!;expect(second.kind).toBe('normal-defense');expect(Object.values(s.groups!)[0]!.hitCursor).toBe(1);
 s=act(s,'B',{type:'PASS'});s=until(s,'normal-defense');
 const third=s.windows!.at(-1)!;expect(third.id).not.toBe(second.id);expect(third.continuation).toMatchObject({targetId:'B'});expect(Object.values(s.groups!)[0]!.hitCursor).toBe(2);
 s=finish(s);expect(s.players.B!.damage).toBe(14);expect(s.discard.filter(id=>id===maai)).toHaveLength(1);
});
