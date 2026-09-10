import {vanmilSuppressed} from '../src/abilities/suppression-state.js';
import {expect,it} from 'vitest';
import {viewFor} from '../src/index.js';
import {act,pass} from './combat-helpers.js';
import {handCard,character} from './fixtures.js';
import {makeNamedDeathScenario,namedDeathCases,type NamedDeathScenario} from '../../../apps/worker/test/fixtures/named-follower-death-scenario.js';
const cases=['reclaim-named-death-ship','reclaim-named-death-dragon','reclaim-named-death-griffin','reclaim-named-death-skeleton','reclaim-named-death-zombie','reclaim-named-death-wight','reclaim-named-death-knight'] as const;
function death(scenario:NamedDeathScenario,vanmil=false){
 let s=makeNamedDeathScenario(scenario,['A','B','C','D'].map(id=>({id,name:id})));
 if(vanmil){character(s,'C','破壊神ヴァンミール');s.players.C!.revealed=true;}
 const card=s.players.A!.followers[0]!.cardInstanceId,fate=handCard(s,'B','命運凶変');
 for(let n=0;viewFor(s,'A').reclaim?.cardInstanceId!==card&&n<300;n++)s=pass(JSON.parse(JSON.stringify(s)));
 const d=viewFor(s,'A').reclaim!;expect(d.cardInstanceId).toBe(card);expect(s.players.A!.followers).toEqual([]);
 expect(s.reclaimDecisions!.find(x=>x.id===d.decisionId)!.source).toMatchObject({trigger:'follower-died'});
 return {s,card,fate,d};
}
it.each(cases)('%s actual death can be declined without an automatic return',scenario=>{
 let {s,card,d}=death(scenario);expect(d.claims.some(c=>c.right==='unlimited')).toBe(true);
 s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'decline'});
 for(let n=0;s.windows?.length&&n<300;n++){expect(s.reclaimReservations).not.toContain(card);s=pass(JSON.parse(JSON.stringify(s)));}
 expect(s.windows??[]).toEqual([]);expect(s.players.A!.hand).not.toContain(card);expect(s.discard.filter(c=>c===card)).toHaveLength(1);
 expect(s.reclaimDecisions!.find(x=>x.id===d.decisionId)!.attemptedClaimIds).toEqual([]);expect(s.players.A!.reclaimUsage).toBeUndefined();
});
it.each(cases)('%s actual death recovery cancellation consumes only its one attempt',scenario=>{
 let {s,card,fate,d}=death(scenario);const claim=d.claims.find(c=>c.right==='unlimited')!;
 s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:claim.claimId});
 const frame=Object.values(s.abilities!).find(f=>f.context.kind==='reclaim')!;expect(frame.abilityId).toBe(namedDeathCases[scenario][0]);
 for(let n=0;s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B'&&n<20;n++)s=pass(s);
 s=act(JSON.parse(JSON.stringify(s)),'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:frame.id});
 for(let n=0;s.windows?.length&&n<300;n++){expect(s.reclaimReservations).not.toContain(card);s=pass(JSON.parse(JSON.stringify(s)));}
 expect(s.windows??[]).toEqual([]);expect(s.players.A!.hand).not.toContain(card);expect(s.discard.filter(c=>c===card)).toHaveLength(1);
 expect(s.reclaimDecisions!.find(x=>x.id===d.decisionId)).toMatchObject({stage:'closed',attemptedClaimIds:[claim.claimId],resolvedClaimIds:[claim.claimId]});
 expect(s.players.A!.reclaimUsage?.[namedDeathCases[scenario][1]]?.baseSpent??false).toBe(false);
});

it.each(cases)('%s actual death recovery respects a live Vanmil ban before resolution',scenario=>{
 let {s,card,d}=death(scenario,true);const claim=d.claims.find(c=>c.right==='unlimited')!;
 s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:claim.claimId});
 for(let n=0;s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='C'&&n<20;n++)s=pass(s);
 const option=viewFor(s,'C').abilityOptions.find(o=>o.abilityId==='c2-p07-r1c2-ab03');expect(option).toBeDefined();
 s=act(JSON.parse(JSON.stringify(s)),'C',{type:'USE_ABILITY',abilityId:option!.abilityId,targetEventId:option!.targetEventId,targetIds:['A']});
 for(let n=0;s.windows?.length&&n<300;n++){expect(s.reclaimReservations).not.toContain(card);s=pass(JSON.parse(JSON.stringify(s)));}
 expect(s.windows??[]).toEqual([]);expect(vanmilSuppressed(s,'A')).toBe(true);
 expect(s.players.A!.hand).not.toContain(card);expect(s.discard.filter(c=>c===card)).toHaveLength(1);
 expect(s.reclaimDecisions!.find(x=>x.id===d.decisionId)).toMatchObject({stage:'closed',attemptedClaimIds:[claim.claimId],resolvedClaimIds:[claim.claimId]});
 expect(s.players.A!.reclaimUsage?.[namedDeathCases[scenario][1]]?.baseSpent??false).toBe(false);
});
