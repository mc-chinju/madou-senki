import {expect,it} from 'vitest';
import {allCardInstanceIds,viewFor, discardIds } from '../src/index.js';
import {act,ready,until,pass,finish,closeWindow} from './combat-helpers.js';
import {character,handCard} from './fixtures.js';
import {vanmilSuppressed} from '../src/abilities/suppression-state.js';

it.each([
 ['妖精王フューリー','踏み込み／弓'],['聖騎士ランスロット','破山剣'],
] as const)('Actual Vanmil suppression leaves only ordinary recovery for %s using %s',(owner,name)=>{
 let s=ready();character(s,'A',owner);character(s,'B','破壊神ヴァンミール');s.players.B!.revealed=true;
 s.players.A!.revealed=true;
 for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};
 s.distances.A!.B=s.distances.B!.A='near';
 const card=handCard(s,'A',name);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'effect-level');
 for(let n=0;s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B'&&n<20;n++)s=pass(s);
 const option=viewFor(s,'B').abilityOptions.find(o=>o.abilityId==='c2-p07-r1c2-ab03');expect(option).toBeDefined();
 s=closeWindow(act(s,'B',{type:'USE_ABILITY',abilityId:option!.abilityId,targetEventId:option!.targetEventId,targetIds:['A']}));
 s=until(s,'reclaim');
 expect(vanmilSuppressed(s,'A')).toBe(true);
 expect(s.suppressionDesignations?.some(x=>x.sourceActorId==='B'&&x.targetId==='A')).toBe(true);
 const decision=viewFor(s,'A').reclaim!;expect(decision.cardInstanceId).toBe(card);
 expect(decision.claims.map(c=>c.right)).toEqual(['base']);
 s=act(JSON.parse(JSON.stringify(s)),'A',{type:'CHOOSE_RECLAIM',decisionId:decision.decisionId,choice:'take',claimId:decision.claims[0]!.claimId});
 s=finish(s);
 expect(s.players.A!.hand.filter(id=>id===card)).toHaveLength(1);expect(discardIds(s)).not.toContain(card);
 expect(s.players.A!.reclaimUsage?.[name]).toEqual({baseSpent:true,extraSpentByAbility:[]});
 const cards=allCardInstanceIds(s);expect(cards).toHaveLength(220);expect(new Set(cards).size).toBe(220);
});
