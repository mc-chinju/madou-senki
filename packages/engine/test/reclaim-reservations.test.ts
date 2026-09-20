import {expect, it} from 'vitest';
import {allCardInstanceIds, type GameState} from '../src/state.js';
import {act, finish, pass, ready, until} from './combat-helpers.js';
import {character, handCard, entropy} from './fixtures.js';
import {gameStats,viewFor,transition, discardIds } from '../src/index.js';

/** Reach a physical reservation using Lia's actual printed prayer response. */
function prayerDeclaration() {
  let s = ready();
  character(s, 'B', 'リーア姫');
  const attack = handCard(s, 'A', '踏み込み／弓');
  const prayer = handCard(s, 'B', '必勝の祈り');
  s = until(act(s, 'A', {type:'ATTACK',cardInstanceId:attack,targetIds:['C'],dedicated:false}), 'effect-level');
  s = pass(s);
  const action = Object.values(s.actions!)[0]!;
  s = act(s, 'B', {type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:action.id,dedicated:true});
  return {s,prayer,eventId:action.eventId};
}
function prayerReservation() {
  const prepared=prayerDeclaration();let s=prepared.s;const {prayer,eventId}=prepared;
  for (let n=0; !s.reclaimReservations.includes(prayer) && n<100; n++) s=pass(s);
  expect(s.reclaimReservations).toContain(prayer);
  return {s, prayer, eventId};
}

it.each(['active','otherworld','wandering'] as const)('Reservation owner life and absence decide one final disposition: living %s', presence => {
  const prepared=prayerReservation(); let s=prepared.s;
  // This matrix isolates release eligibility; the reservation itself is reached by commands.
  s.players.B!.presence=presence;
  s=finish(JSON.parse(JSON.stringify(s)) as GameState);
  expect(s.reclaimReservations).not.toContain(prepared.prayer);
  expect(s.players.B!.hand).toContain(prepared.prayer);
  expect(discardIds(s)).not.toContain(prepared.prayer);
  expect(new Set(allCardInstanceIds(s)).size).toBe(220);
});

it('Reservation owner life and absence decide one final disposition: a revived life loses its old claim', () => {
  const prepared=prayerReservation(); let s=prepared.s;
  s.players.B!.lifeId='new-life-after-death';
  s=finish(JSON.parse(JSON.stringify(s)) as GameState);
  expect(s.players.B!.hand).not.toContain(prepared.prayer);
  expect(discardIds(s)).toContain(prepared.prayer);
  expect(s.reclaimReservations).toEqual([]);
});

it.each(['pending-death','dead','exited'] as const)('Reservation owner life and absence decide one final disposition: unavailable %s',presence=>{
 const prepared=prayerReservation();let s=prepared.s;
 // Isolate saved release eligibility; this presence assignment is not a death/exit producer.
 // Actual prayer-owner death is exercised separately in reclaim-owner-death.test.ts.
 s.players.B!.presence=presence;
 s=finish(JSON.parse(JSON.stringify(s)) as GameState);
 expect(s.players.B!.hand).not.toContain(prepared.prayer);
 expect(discardIds(s).filter(id=>id===prepared.prayer)).toHaveLength(1);
 expect(s.reclaimReservations).toEqual([]);expect(s.reclaim?.[prepared.prayer]).toBeUndefined();
 expect(s.used).toContain(`${prepared.eventId}:B:${prepared.prayer}`);
 expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 expect(finish(s)).toEqual(s);
});

it('Dedicated Lia prayer keeps S07 same-event prohibition through general release', () => {
  const {s,prayer,eventId}=prayerReservation();
  expect(s.reclaim?.[prayer]).toMatchObject({ownerId:'B',eventId,ownerLifeId:'initial-life:B'});
  expect(s.used).toContain(`${eventId}:B:${prayer}`);
  expect(s.players.B!.hand).not.toContain(prayer);
  const ended=finish(s);
  expect(ended.players.B!.hand.filter(id=>id===prayer)).toHaveLength(1);
  expect(ended.used).toContain(`${eventId}:B:${prayer}`);
  expect(ended.reclaim?.[prayer]).toBeUndefined();
});

it('Reservation waits for both attack disposition and its actual death boundary', () => {
  const prepared=prayerReservation();let s=prepared.s;
  character(s,'C','忍びのイダ');
  s.players.C!.damage=gameStats(s,'C').endurance-1;
  s=until(s,'death-gift');
  expect(s.players.C!.presence).toBe('pending-death');
  expect(s.lifecycle?.some(task=>task.rootEventIds?.includes(prepared.eventId))).toBe(true);
  expect(s.windows?.some(w=>w.kind==='reclaim')).toBe(true);
  expect(s.reclaimReservations).toContain(prepared.prayer);
  expect(s.players.B!.hand).not.toContain(prepared.prayer);
  s=finish(JSON.parse(JSON.stringify(s)) as GameState);
  expect(s.players.C!.presence).toBe('dead');
  expect(s.players.B!.hand).toContain(prepared.prayer);
});

it('A paid prayer keeps its declaring life through death and revival before reservation', () => {
  const prepared=prayerDeclaration();let s=prepared.s;
  // Saved continuation boundary: a later life cannot inherit this already-paid response.
  s.players.B!.lifeId='revived-before-prayer-resolves';
  s=finish(s);
  expect(s.players.B!.hand).not.toContain(prepared.prayer);
  expect(discardIds(s)).toContain(prepared.prayer);
});

it('Reservation survives a nested counter until the original attack source disposition completes',()=>{
  let s=ready();character(s,'B','聖騎士ランスロット');s.players.A!.permanent={endurance:100};
  s.distances.A!.B='near';s.distances.B!.A='near';
  const attack=handCard(s,'A','破山剣'),counter=handCard(s,'B','妖撃破山剣');
  s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');
  s=until(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:true}),'reclaim');
  const d=viewFor(s,'B').reclaim!;expect(d.cardInstanceId).toBe(counter);expect(d.claims).toHaveLength(1);
  s=act(s,'B',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId});
  expect(viewFor(s,'A').reclaim!.cardInstanceId).toBe(attack);
  expect(s.reclaimReservations).toContain(counter);expect(s.players.B!.hand).not.toContain(counter);
  s=finish(s);expect(s.players.B!.hand).toContain(counter);expect(s.reclaimReservations).toEqual([]);
});

import {makeSharedReclaimScenario} from './fixtures/shared-reclaim-scenarios.js';
it('Shared A09 adapter binds B check and A reservation across both saved boundaries',()=>{let s=makeSharedReclaimScenario('shared-a09-hidden',['A','B','C','D'].map(id=>({id,name:id})));s=pass(s);s=act(s,'B',{type:'REVEAL_CHARACTER'});const d=viewFor(s,'B').reclaim!,claim=d.claims.find(c=>c.right==='printed')!;s=act(s,'B',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'request-check',claimId:claim.claimId});expect(s.reclaimDecisions!.find(t=>t.id===d.decisionId)).toMatchObject({checkActorId:'B',checkAttempted:true,checkRollId:s.rolls!.at(-1)!.id});s=until(JSON.parse(JSON.stringify(s)),'reclaim');const take=viewFor(s,'A').reclaim!;expect(take.stage).toBe('beneficiary-choice');s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:take.decisionId,choice:'take',claimId:take.claims[0]!.claimId});expect(s.reclaim!['a2-p01-r3c3']).toMatchObject({ownerId:'A',ownerLifeId:'initial-life:A'});expect(s.resolution).not.toContain('a2-p01-r3c3');s=finish(JSON.parse(JSON.stringify(s)));expect(s.players.A!.hand.filter(id=>id==='a2-p01-r3c3')).toHaveLength(1);expect(s.players.B!.hand).not.toContain('a2-p01-r3c3');expect(s.reclaimReservations).toEqual([]);});

const privacyRights=['none','base','extra','unlimited'] as const;
function hiddenBudgetWorld(right:typeof privacyRights[number],name:string){
 let s=ready();character(s,'A',right==='unlimited'?'吟遊詩人のレスター':right==='none'?'忍びのイダ':'妖精王フューリー');character(s,'B','大神官ジル');character(s,'C','魔聖母ディア');character(s,'D','魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,warrior_level:20,magic_level:20};
 // Printed owners and initial spent budgets only; no character receives an invented ability.
 s.players.A!.reclaimUsage={'踏み込み／弓':{baseSpent:right!=='base',extraSpentByAbility:right==='extra'?[]:['c2-p02-r1c2-ab03']},'魔詩':{baseSpent:true,extraSpentByAbility:[]}};
 const card=handCard(s,'A',name);s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'reclaim');return {s,card};
}
it('Hidden zero base extra and unlimited worlds share public all-pass transcripts for both printed sources',()=>{
 // No printed card has both extra and unlimited owners. Cover the two actual sources in every world.
 for(const name of ['踏み込み／弓','魔詩']){
  const prepared=privacyRights.map(right=>hiddenBudgetWorld(right,name));let worlds=prepared.map(p=>p.s);let slots=0;
  expect(worlds.map(s=>viewFor(s,'A').reclaim!.claims.map(c=>c.right))).toEqual(name==='踏み込み／弓'?[[],['base'],['extra'],[]]:[[],[],[],[]]);
  for(let n=0;n<300;n++){
   for(const other of worlds.slice(1)){for(const viewer of ['B','C','D'])expect(viewFor(other,viewer)).toEqual(viewFor(worlds[0]!,viewer));expect(other.revision).toBe(worlds[0]!.revision);expect(other.nextEventId).toBe(worlds[0]!.nextEventId);expect(other.events).toEqual(worlds[0]!.events);}
   if(!worlds[0]!.windows?.length)break;if(worlds[0]!.windows!.at(-1)!.kind==='reclaim')slots++;
   worlds=worlds.map(s=>pass(JSON.parse(JSON.stringify(s))));
  }
  expect(slots).toBe(4);for(const s of worlds){expect(s.windows??[]).toEqual([]);expect(s.discard).toEqual(worlds[0]!.discard);expect(discardIds(s).filter(id=>id===prepared[0]!.card)).toHaveLength(1);}
 }
});
it('Revealed Lester unlimited answer retains cursor, answers once and leaves an unused base slot intact',()=>{
 let s=ready();character(s,'A','吟遊詩人のレスター');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};const card=handCard(s,'A','魔詩');
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'reclaim');
 expect(s.windows!.at(-1)!.participants).toEqual(['A','B','C','D']);const window=structuredClone(s.windows!.at(-1));
 expect(viewFor(s,'A').reclaim!.claims.map(c=>c.right)).toEqual(['base']);s=act(s,'A',{type:'REVEAL_CHARACTER'});expect(s.windows!.at(-1)).toEqual(window);
 const d=viewFor(s,'A').reclaim!,claim=d.claims.find(c=>c.right==='unlimited')!;expect(claim).toBeDefined();
 s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:claim.claimId});
 expect(s.reclaimDecisions!.find(r=>r.id===d.decisionId)!.attemptedClaimIds.filter(id=>id===claim.claimId)).toHaveLength(1);
 const before=JSON.stringify(s);expect(transition(s,{actorId:'A',command:{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:claim.claimId}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
 s=finish(s);expect(s.players.A!.reclaimUsage?.['魔詩']?.baseSpent??false).toBe(false);expect(s.players.A!.hand.filter(id=>id===card)).toHaveLength(1);expect(discardIds(s)).not.toContain(card);
});
