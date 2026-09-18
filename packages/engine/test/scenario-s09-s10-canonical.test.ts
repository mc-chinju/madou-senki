import {expect,it} from 'vitest';
import {act,pass,until,finish} from './combat-helpers.js';
import {makeCanonicalDefense} from './fixtures/canonical-defense-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
it('S09 Ramba dedicated Death Axe6 versus Shin checked parry6 cancels B and keeps C damage10',()=>{
 let s=makeCanonicalDefense(players,'S09');const incoming=Object.values(s.actions!).find(a=>a.kind==='attack')!;expect(incoming.technique).toMatchObject({effectLevel:6,damage:10,noChecks:true});
 s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p12-r1c3',dedicated:false});const defense=Object.values(s.actions!).find(a=>a.kind==='defense')!;expect(defense.technique.effectLevel).toBe(6);expect(defense.checks).toHaveLength(1);
 s=until(s,'normal-defense');expect(s.windows!.at(-1)!.continuation).toMatchObject({targetId:'C'});const group=Object.values(s.groups!)[0]!;expect(group.targets[0]!.hits[0]!.defended).toBe(true);expect(group.targets[1]!.hits[0]).toMatchObject({defended:false,damage:10});
 s=finish(s);expect([s.players.A!.damage,s.players.B!.damage,s.players.C!.damage]).toEqual([0,0,10]);
});
it('S10 Arnes ordinary Black Bow5 versus Lancelot dedicated sword6 plus real prayer1 blocks at far without return',()=>{
 let s=makeCanonicalDefense(players,'S10');expect(s.distances.A!.B).toBe('far');expect(Object.values(s.actions!).find(a=>a.kind==='attack')!.technique.effectLevel).toBe(5);
 s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p11-r1c2',dedicated:true});const defense=Object.values(s.actions!).find(a=>a.kind==='defense')!;expect(defense.technique).toMatchObject({effectLevel:6,counterNoChecks:true,range:'near'});
 expect(defense.checks).toHaveLength(0);s=until(s,'effect-level');while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:'a2-p05-r2c3',mode:'effect-plus',targetActionId:defense.id});
 for(let n=0;!(s.windows?.at(-1)?.kind==='damage'&&s.windows.at(-1)!.continuation.id===defense.id)&&n<300;n++)s=pass(s,[1]);
 expect(s.actions![defense.id]!.technique.effectLevel).toBe(7);s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);expect(s.distances.A!.B).toBe('far');
});
