import {expect,it} from 'vitest';
import {allCardInstanceIds,transition,viewFor} from '../src/index.js';
import {techniqueFor} from '../src/effects/registry.js';
import {act,ready,until} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';

it.each([
 ['踏み込み／弓',false],['黒流弓',false],['光流弓',false],
 ['光流弓',true],['星流弓',false],['星流弓',true],
] as const)('Fury actual %s dedicated=%s has no counter permission and rejected defense consumes nothing',(name,dedicated)=>{
 let s=ready();character(s,'B','妖精王フューリー');
 for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};
 const bow=handCard(s,'B',name),attack=handCard(s,'A','黒翼飛翔剣');
 expect(techniqueFor(bow,'妖精王フューリー',dedicated)).toMatchObject({counter:false,defense:'none'});
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');
 const saved=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));
 const result=transition(s,{actorId:'B',command:{type:'PLAY_DEFENSE',cardInstanceId:bow,dedicated}},entropy());
 expect(result.ok).toBe(false);
 expect(JSON.stringify(s)).toBe(saved);
 expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);
 expect(s.players.B!.hand).toContain(bow);
 const physical=allCardInstanceIds(s);expect(physical).toHaveLength(220);expect(new Set(physical).size).toBe(220);
});
