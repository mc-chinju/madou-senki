import {expect,it} from 'vitest';
import {allCardInstanceIds,transition,viewFor,type GameCommand} from '../src/index.js';
import {entropy} from './fixtures.js';
import {makeAbilityScenario} from './fixtures/ability-scenarios.js';
it.each([false,true])('G09 explicit optional critical use %s keeps unchosen identity and candidates private',use=>{
 let s=makeAbilityScenario('ability-critical',['A','B','C','D'].map(id=>({id,name:id})));const ida='c2-p04-r2c2',ability=ida+'-ab03',before=structuredClone(s),option=viewFor(s,'A').abilityOptions.find(o=>o.abilityId===ability)!;expect(option).toBeDefined();expect(s.players.A!.revealed).toBe(false);
 function privateViews(){for(const id of ['B','C','D']){const v=viewFor(s,id);expect(v.players.A).not.toHaveProperty('characterId');expect(JSON.stringify(v)).not.toContain(ida);expect(v.abilityOptions.some(o=>o.abilityId===ability)).toBe(false);}}
 function send(actorId:string,command:GameCommand){const input={actorId,command},e={...entropy(),dice:Array.from({length:100},(_,i)=>i%2?3:2)},r=transition(s,input,e);expect(r).toEqual(transition(JSON.parse(JSON.stringify(s)),input,e));if(!r.ok)throw Error(`${command.type}: ${r.code}`);s=r.state;expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);privateViews();}
 privateViews();for(let n=0;n<3;n++)viewFor(s,'A');expect(s).toEqual(before);expect(Object.values(s.abilities??{})).toEqual([]);expect(s.used?.some(k=>k.includes(ability))??false).toBe(false);
 const forged=transition(s,{actorId:'B',command:{type:'USE_ABILITY',abilityId:ability,targetEventId:option.targetEventId}},entropy());expect(forged.ok).toBe(false);expect(s).toEqual(before);privateViews();
 if(use){send('A',{type:'USE_ABILITY',abilityId:ability,targetEventId:option.targetEventId});expect(Object.values(s.abilities??{})).toHaveLength(1);expect(viewFor(s,'A').currentAction).toMatchObject({source:'ability',abilityId:ability});for(const id of ['B','C','D'])expect(viewFor(s,id).currentAction).toMatchObject({source:'ability',label:'特殊能力'});}
 for(let n=0;n<300&&s.windows?.length;n++){const w=s.windows!.at(-1)!;send(w.participants[w.cursor]!,{type:'PASS'});}
 expect(s.windows??[]).toEqual([]);expect(s.players.A!.revealed).toBe(false);expect(s.players.B!.damage).toBe(use?8:4);expect(s.used?.filter(k=>k.includes(ability))??[]).toHaveLength(use?1:0);expect(s.rolls?.filter(r=>r.purpose==='ability-value')??[]).toHaveLength(use?1:0);privateViews();
 if(!use)expect(s.used).toEqual(before.used);
});
