import {expect,it} from 'vitest';
import {act,until,finish} from './combat-helpers.js';
import {makeKiSlashPhysical,kiSlashCard} from './fixtures/ki-slash-physical-scenarios.js';
it('S16 actual zero-spirit Ki Slash numeric zero hit reveals the hidden target without adding damage',()=>{
 const players=['A','B','C','D'].map(id=>({id,name:id}));let s=makeKiSlashPhysical('ki-slash-ordinary',players,{spirit:0,warrior:6});expect(s.players.B!.revealed).toBe(false);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:kiSlashCard,targetIds:['B'],dedicated:false}),'attack-abilities');const g=Object.values(s.groups!)[0]!;expect(g.technique.damage).toBe(0);expect(g.targets[0]!.hits[0]!.damage).toBe(0);
 s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.B!.revealed).toBe(true);expect(s.discard.filter(id=>id===kiSlashCard)).toHaveLength(1);
});
