import {expect,it} from 'vitest';
import {getAction,actionCards} from '@madou/catalog';
import {viewFor,gameStats,allCardInstanceIds,type GameState} from '../src/index.js';
import {canUseCharacterAbility} from '../src/state.js';
import {act as checkedAct} from './combat-helpers.js';
import {makeCanonicalLiaLife} from './fixtures/canonical-lia-life-scenario.js';
import {makeCanonicalRecovery} from './fixtures/canonical-recovery-scenario.js';
function trace(s:GameState){const w=s.windows?.at(-1);return JSON.stringify({phase:s.phase,window:w,chooser:w?.participants[w.cursor],view:w?viewFor(s,w.participants[w.cursor]!).activeWindow:null});}
function savedState(s:GameState){
 const ids=allCardInstanceIds(s);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);expect(ids.sort()).toEqual(actionCards.map(card=>card.id).sort());
 const restored=JSON.parse(JSON.stringify(s)) as GameState;
 for(const actorId of s.seatOrder)expect(viewFor(restored,actorId),trace(s)).toEqual(viewFor(s,actorId));
 return restored;
}
function act(...args:Parameters<typeof checkedAct>){return savedState(checkedAct(savedState(args[0]),args[1],args[2],args[3]));}
function pass(s:GameState){const w=s.windows?.at(-1);if(!w)throw Error(`NO_WINDOW:${trace(s)}`);return act(s,w.participants[w.cursor]!,{type:'PASS'},Array(30).fill(1));}
function until(s:GameState,kind:string){for(let n=0;n<300;n++){if(s.windows?.at(-1)?.kind===kind)return savedState(s);s=pass(s);}throw Error(`MISSING_BOUNDARY:${kind}:${trace(s)}`);}
function closeWindow(s:GameState){const id=s.windows?.at(-1)?.id;if(!id)throw Error(`NO_WINDOW:${trace(s)}`);for(let n=0;n<300;n++){if(s.windows?.at(-1)?.id!==id)return s;s=pass(s);}throw Error(`WINDOW_LIMIT:${trace(s)}`);}
function finish(s:GameState){
 for(let n=0;n<300;n++){
  if(!s.windows?.length){expect(s.actions??{},trace(s)).toEqual({});expect(s.groups??{},trace(s)).toEqual({});expect(s.lifecycle??[],trace(s)).toEqual([]);expect(s.resolution).toEqual([]);expect(s.reclaimReservations).toEqual([]);return savedState(s);}
  s=pass(s);
 }
 throw Error(`UNFINISHED:${trace(s)}`);
}
const BAN='c2-p07-r1c2-ab03',BLESS='c2-p03-r1c2-ab04';

it('R6 Task5 actual extra claim cancellation refills Dawn and shuffles while its physical source awaits parent disposition',()=>{
  let s=makeCanonicalRecovery(['A','B','C','D'].map(id=>({id,name:id})));
  const bow=s.players.A!.hand.find(id=>getAction(id)!.name==='踏み込み／弓')!,fate='a2-p02-r2c3',dawn=s.deck[0]!,discarded=s.discard.at(-1)!;
  s=until(act(s,'A',{type:'ATTACK',cardInstanceId:bow,targetIds:['B'],dedicated:false}),'reclaim');
  const decision=viewFor(s,'A').reclaim!,claim=decision.claims.find(c=>c.right==='extra')!;
  expect(claim).toBeDefined();
  s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:decision.decisionId,choice:'take',claimId:claim.claimId});
  const ability=Object.values(s.abilities!).find(a=>a.context.kind==='reclaim')!;
  expect(s.deck[0]).toBe(dawn);
  expect(s.resolution).toContain(bow);expect(s.reclaimReservations).not.toContain(bow);
  s=pass(s);
  s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:ability.id});
  expect(s.players.B!.open).toContain(dawn);expect(s.discard).not.toContain(discarded);
  expect([...s.deck,...s.players.B!.hand]).toContain(discarded);
  expect(s.resolution).toContain(bow);expect(s.reclaimReservations).not.toContain(bow);
  expect(s.deck).not.toContain(bow);expect(s.discard).not.toContain(bow);
  for(const p of Object.values(s.players))expect(p.hand).not.toContain(bow);
  s=finish(JSON.parse(JSON.stringify(s)));
  expect(s.discard.filter(id=>id===bow)).toHaveLength(1);expect(s.players.A!.hand).not.toContain(bow);
  expect(s.players.A!.reclaimUsage?.['踏み込み／弓']).toEqual({baseSpent:false,extraSpentByAbility:['c2-p02-r1c2-ab03']});
  expect(s.reclaimDecisions!.find(d=>d.id===decision.decisionId)!.attemptedClaimIds).toEqual([claim.claimId]);
  expect(s.resolution).toEqual([]);expect(s.reclaimReservations).toEqual([]);expect(s.windows).toEqual([]);
});
function use(s: GameState, actorId: string, abilityId: string, targets: string[]) {
  const option = viewFor(s, actorId).abilityOptions.find(o => o.abilityId === abilityId);
  expect(option, `missing ${abilityId} option: ${JSON.stringify({phase:s.phase,window:s.windows?.at(-1),used:s.used,lifecycle:s.lifecycle})}`).toBeDefined();
  return act(s, actorId, {type: 'USE_ABILITY', abilityId, targetEventId: option!.targetEventId,
    ...(abilityId === BAN ? {targetIds: targets} : {targetId: targets[0]})});
}
function startAction(s: GameState) {
  const actorId = s.seatOrder[s.turnSeat]!;
  if (s.phase === 'turn-start') s = finish(act(s, actorId, {type:'START_TURN'}));
  if (s.phase === 'draw') s = finish(act(s, actorId, {type:'CHOOSE_DRAW',draw:false}));
  return s;
}
function endTurn(s: GameState) {
  s = startAction(s); const actorId = s.seatOrder[s.turnSeat]!;
  if (s.phase === 'action') s = act(s, actorId, {type:'PASS_ACTION'});
  if (s.phase === 'withdrawal') s = act(s, actorId, {type:'PASS_WITHDRAWAL'});
  const discardIds = s.players[actorId]!.hand.slice(0, Math.max(0, s.players[actorId]!.hand.length-gameStats(s,actorId).handLimit));
  return finish(act(s, actorId, {type:'END_TURN',discardIds}));
}
function actionFor(s: GameState, targetId: string) {
  for (let n=0;n<12;n++) {
    s = startAction(s);
    if (s.seatOrder[s.turnSeat] === targetId && s.phase === 'action') return s;
    s = endTurn(s);
  }
  throw Error('SUPPRESSION_TURN_LIMIT');
}

it('R6 Task5 living Vanmil ban suspends elected Asfelt value and Lia death revival requires a fresh successful Blessing', () => {
  let s=makeCanonicalLiaLife(['A','B','C','D'].map(id=>({id,name:id})));
  const attack=s.players.D!.hand.find(id=>getAction(id)!.name==='踏み込み／弓')!,revival=s.players.D!.hand.find(id=>getAction(id)!.name==='復活')!;
  const election=viewFor(s,'B').conditionalAbilities.find(o=>o.abilityId==='c2-p04-r1c2-ab05')!;
  expect(election).toBeDefined();
  s=finish(act(s,'B',{type:'SET_CONDITIONAL_ABILITY',abilityId:election.abilityId,targetEventId:election.targetEventId,enabled:true}));
  const elected=structuredClone(s.players.B!.conditionalSelections),value=gameStats(s,'B').spirit,permanent=structuredClone(s.players.B!.permanent);
  s=closeWindow(use(s,'A',BAN,['B']));
  expect(gameStats(s,'B').spirit).toBe(value-1);
  expect(s.players.B!.conditionalSelections).toEqual(elected);
  s=actionFor(s,'C');s=finish(use(s,'C',BLESS,['B']));
  expect(s.rolls!.at(-1)).toMatchObject({rollerId:'C',modifier:-5,success:true});
  expect(gameStats(s,'B').spirit).toBe(value);
  const oldLease=structuredClone(s.blessingLeases![0]!);
  expect(canUseCharacterAbility(s.players.B!,s)).toBe(true);
  s=actionFor(s,'D');
  s=act(s,'D',{type:'ATTACK',cardInstanceId:attack,targetIds:['C'],dedicated:false});
  s=until(s,'death-gift');
  expect(s.players.C!.presence).toBe('pending-death');
  expect(s.players.C!.hand.length).toBeGreaterThan(0);
  expect(s.blessingLeases).toEqual([]);
  expect(gameStats(s,'B').spirit).toBe(value-1);
  expect(s.players.B!.permanent).toEqual(permanent);
  expect(s.players.A!.presence).toBe('active');
  expect(canUseCharacterAbility(s.players.B!,s)).toBe(false);
  s=finish(s);expect(s.players.C!.presence).toBe('dead');expect(s.outcome).toBeUndefined();
  s=actionFor(endTurn(s),'D');
  s=act(s,'D',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:revival,targetIds:['C'],dedicated:true});
  s=until(s,'re-setup');
  expect(s.players.C).toMatchObject({presence:'active',damage:0,revealed:true});
  expect(s.players.C!.lifeId).not.toBe(oldLease.sourceLifeId);
  expect(s.blessingLeases).toEqual([]);
  expect(gameStats(s,'B').spirit).toBe(value-1);
  expect(s.players.B!.permanent).toEqual(permanent);
  expect(s.players.A!.presence).toBe('active');
  expect(canUseCharacterAbility(s.players.B!,s)).toBe(false);
  s=act(s,'C',{type:'PASS_SETUP'});s=finish(s);
  expect(s.discard).toContain(revival);
  expect(s.blessingLeases).toEqual([]);
  expect(s.suppressionDesignations!.map(d=>d.targetId)).toEqual(['B']);
  expect(canUseCharacterAbility(s.players.B!,s)).toBe(false);
  s=actionFor(s,'C');s=finish(use(s,'C',BLESS,['B']));
  expect(s.blessingLeases).toEqual([expect.objectContaining({sourceActorId:'C',sourceLifeId:s.players.C!.lifeId,targetId:'B'})]);
  expect(canUseCharacterAbility(s.players.B!,s)).toBe(true);
  expect(gameStats(s,'B').spirit).toBe(value);
  expect(s.players.B!.permanent).toEqual(permanent);
  expect(s.players.B!.conditionalSelections).toEqual(elected);
  expect(s.players.A!.presence).toBe('active');
  expect(s.outcome).toBeUndefined();
  for(const actor of ['A','B','D']){
    expect(viewFor(s,actor).suppressionTargets).toContainEqual(expect.objectContaining({targetId:'B',applicability:actor==='B'?'relieved':'private'}));
    expect(JSON.stringify(viewFor(s,actor))).not.toContain('sourceLifeId');
  }
});

it('R6 Task5 actual Vanmil death retains accepted designations before G15 commit and ends once at C13 without revival',()=>{
 let s=makeCanonicalLiaLife(['A','B','C','D'].map(id=>({id,name:id})),true);
 s=finish(use(s,'A',BAN,['B']));const designated=structuredClone(s.suppressionDesignations);
 expect(designated).toHaveLength(1);expect(canUseCharacterAbility(s.players.B!,s)).toBe(false);
 s=actionFor(s,'D');const card=s.players.D!.hand.find(id=>getAction(id)!.name==='踏み込み／弓')!;
 s=act(s,'D',{type:'ATTACK',cardInstanceId:card,targetIds:['A'],dedicated:false});
 for(let n=0;n<300&&s.windows?.at(-1)?.kind!=='death-gift';n++){expect(s.suppressionDesignations).toEqual(designated);expect(s.outcome).toBeUndefined();s=pass(s);}
 expect(s.players.A!.presence).toBe('pending-death');expect(s.suppressionDesignations).toEqual(designated);expect(s.outcome).toBeUndefined();
 s=finish(JSON.parse(JSON.stringify(s)));expect(s.players.A!.presence).toBe('dead');expect(s.outcome).toMatchObject({reason:'vanmil-death',winnerIds:['B','C','D']});expect(s.events.filter(e=>e.type==='GAME_COMPLETED')).toHaveLength(1);expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')).toHaveLength(1);expect(s.events.filter(e=>e.type==='PLAYER_REVIVED')).toEqual([]);expect(s.windows??[]).toEqual([]);expect(s.resolution).toEqual([]);expect(s.reclaimReservations).toEqual([]);expect(s.discard.filter(id=>id===card)).toHaveLength(1);
 for(const id of ['A','B','C','D'])expect(viewFor(s,id).outcome).toEqual(s.outcome);
});

import {makeR6CombinedDeathScenario} from './fixtures/r6-combined-death-scenario.js';
it('R6 Task5 actual two target three hit attack returns one local counter before Soldier reduction and simultaneous deaths',()=>{
 let s=makeR6CombinedDeathScenario(['A','B','C','D'].map(id=>({id,name:id})),true);
 const parent=Object.values(s.groups!)[0]!,source=s.actions![parent.actionId]!,counter='a2-p10-r3c3',soldier=s.players.C!.followers[0]!.cardInstanceId,b=s.players.B!.damage,c=s.players.C!.damage,a=s.players.A!.damage;
 expect(parent.hitIndices).toEqual([0,1,2]);expect(parent.targets.map(t=>t.actorId)).toEqual(['B','C']);
 s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:true});
 let childSeen=false,followersSeen=false;
 for(let n=0;n<400;n++){
  expect(s.outcome).toBeUndefined();const child=Object.values(s.groups??{}).find(g=>g.attackerId==='B');
  if(child){childSeen=true;const action=s.actions![child.actionId]!;expect(action.cardInstanceId).toBe(counter);expect(action.resume).toMatchObject({groupId:parent.id,targetId:'B',hitIndex:0});expect(child.targets.map(t=>[t.actorId,t.hits.length])).toEqual([['A',1]]);expect(child.hitIndices).toEqual([0]);expect(child.technique.damage).toBe(7);expect(s.groups![parent.id]!.targets[0]!.hits.map(h=>h.defended)).toEqual([true,false,false]);expect(s.groups![parent.id]!.targets[1]!.hits.map(h=>h.defended)).toEqual([false,false,false]);}
  const current=s.groups?.[parent.id];if(current?.targets[1]!.followersSettled){followersSeen=true;expect(current.targets[1]!.hits.map(h=>h.damage)).toEqual([6,6,6]);expect(current.targets[1]!.followerDestroyed).toEqual([soldier]);}
  if(s.players.B!.presence==='pending-death')break;s=pass(s);
 }
 expect(childSeen).toBe(true);expect(followersSeen).toBe(true);expect(s.players.A!.damage).toBe(a+7);expect(s.players.B).toMatchObject({presence:'pending-death',damage:b+14});expect(s.players.C).toMatchObject({presence:'pending-death',damage:c+18});expect(s.lifecycle!.find(t=>t.kind==='death-batch')).toMatchObject({actorIds:['B','C']});expect(s.events.filter(e=>e.type==='PLAYER_DIED')).toEqual([]);
 s=finish(JSON.parse(JSON.stringify(s)));expect(s.events.filter(e=>e.type==='PLAYER_DIED').map(e=>e.actorId)).toEqual(['B','C']);expect(s.players.B!.presence).toBe('dead');expect(s.players.C!.presence).toBe('dead');expect(s.outcome).toBeUndefined();
 expect(s.windows).toEqual([]);expect(s.groups).toEqual({});expect(s.actions).toEqual({});expect(s.lifecycle??[]).toEqual([]);expect(s.resolution).toEqual([]);expect(s.reclaimReservations).toEqual([]);for(const id of [counter,soldier,source.cardInstanceId])expect(s.discard.filter(x=>x===id)).toHaveLength(1);
});
