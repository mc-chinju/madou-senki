import {it,expect} from 'vitest';
import {viewFor,derivedStats,transition,type GameState} from '../src/index.js';
import {act,ready,pass,closeWindow,finish,until} from './combat-helpers.js';
import {character,handCard,entropy,freshGame} from './fixtures.js';
const TRUE='c2-p04-r2c1-ab03',SHADOW='c2-p04-r2c1-ab01';
function base(){const s=ready();character(s,'A','占星術師のアルセイル');return s;}
function use(s:GameState,id:string){const o=viewFor(s,'A').abilityOptions.find(o=>o.abilityId===id)!;return act(s,'A',{type:'USE_ABILITY',abilityId:id,targetEventId:o.targetEventId});}
function priority(s:GameState,actor:string){while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!==actor)s=pass(s);return s;}
function end(s:GameState,actor='A'){s=act(s,actor,{type:'PASS_ACTION'});return act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.slice(5)});}
it('voluntary reveal decline does not auto-activate and duplicate/stale reveal cannot retrigger',()=>{let s=base();expect(viewFor(s,'A').revealAbilityOptions).toEqual([{abilityId:TRUE,name:'本当の力'}]);s=act(s,'A',{type:'REVEAL_CHARACTER'});expect(derivedStats(s.players.A!).spirit).toBe(6);expect(viewFor(s,'A').revealAbilityOptions).toEqual([]);expect(transition(s,{actorId:'A',command:{type:'REVEAL_CHARACTER',abilityId:TRUE}},entropy()).ok).toBe(false);});
it('TruePower canceled benefit preserves actual public reveal and offers no free second activation',()=>{let s=act(base(),'A',{type:'REVEAL_CHARACTER',abilityId:TRUE});s=priority(s,'B');const card=handCard(s,'B','命運凶変');s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:card,mode:'cancel-ability',targetAbilityId:viewFor(s,'B').reactionTargetAbilityId!});s=finish(s);expect(s.players.A!.revealed).toBe(true);expect(derivedStats(s.players.A!).spirit).toBe(6);expect(viewFor(s,'A').spiritExpiry).toBeNull();});
it('TruePower replaces base before independent bonuses and drains, and Shadow excludes only this replacement',()=>{let s=base();const blood=handCard(s,'A','神々の血');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==blood);s.players.A!.open.push(blood);s.players.A!.permanent={spirit:2};s.players.A!.statuses=[{id:'drain',kind:'stat-drain',timing:'until-death',amount:1}];s=finish(act(s,'A',{type:'REVEAL_CHARACTER',abilityId:TRUE}));expect(derivedStats(s.players.A!).spirit).toBe(14);expect(viewFor(s,'A').self.stats.spirit).toBe(14);s=closeWindow(use(s,SHADOW));s=closeWindow(s,[1,1]);expect(viewFor(s,'A').currentRoll!.threshold).toBe(7);s=finish(s);expect(derivedStats(s.players.A!).spirit).toBe(14);s.players.A!.spiritReplacements!.unshift({id:'independent',base:9,expiresOnActorId:'C',timing:'turn-end'});expect(derivedStats(s.players.A!,{excludeSourceAbilityId:TRUE}).spirit).toBe(11);});
it.each(['stopped','ability-disabled'] as const)('TruePower %s suppression is live and still expires while suppressed',kind=>{let s=finish(act(base(),'A',{type:'REVEAL_CHARACTER',abilityId:TRUE}));s.players.A!.statuses=[{id:'fixture',kind,modifiers:[0],nextCheck:0}];expect(derivedStats(s.players.A!).spirit).toBe(6);expect(viewFor(s,'A').spiritExpiry).toMatchObject({active:false});if(kind==='stopped')s=act(s,'A',{type:'PASS_ACTION'});else s=end(s);expect(viewFor(s,'A').spiritExpiry).toBeNull();s.players.A!.statuses=[];expect(derivedStats(s.players.A!).spirit).toBe(6);});
it('setup fallback expires at chosen first seat end, not at its start',()=>{let s=freshGame();character(s,'B','占星術師のアルセイル');s=finish(act(s,'B',{type:'REVEAL_CHARACTER',abilityId:TRUE}));expect(s.phase).toBe('setup');expect(viewFor(s,'B').spiritExpiry!.expiresOnActorId).toBe('A');for(const id of s.seatOrder)s=act(s,id,{type:'PASS_SETUP'});s=act(s,'A',{type:'START_TURN'});expect(derivedStats(s.players.B!).spirit).toBe(12);s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});s=end(s);expect(derivedStats(s.players.B!).spirit).toBe(6);});
it('ordinary other-player voluntary reveal expires on current non-attacking turn end',()=>{let s=ready();character(s,'B','占星術師のアルセイル');s=finish(act(s,'B',{type:'REVEAL_CHARACTER',abilityId:TRUE}));expect(viewFor(s,'B').spiritExpiry!.expiresOnActorId).toBe('A');s=end(s);expect(viewFor(s,'B').spiritExpiry).toBeNull();});
it('nested attack reveal uses actual attacker end and restores exact attack window',()=>{let s=ready();character(s,'B','占星術師のアルセイル');const card=handCard(s,'A','踏み込み／弓');s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});const w=s.windows!.at(-1)!.id;s=act(s,'B',{type:'REVEAL_CHARACTER',abilityId:TRUE});while(s.windows!.at(-1)!.id!==w)s=pass(s);expect(viewFor(s,'B').spiritExpiry!.expiresOnActorId).toBe('A');s=finish(s);if(s.phase==='withdrawal')s=act(s,'A',{type:'PASS_WITHDRAWAL'});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(5)});expect(viewFor(s,'B').spiritExpiry).toBeNull();});
it('private inspection permits selected voluntary reveal while retaining snapshot and blocking inspection commands during child',()=>{let s=base();const o=viewFor(s,'A').abilityOptions.find(o=>o.abilityId==='c2-p04-r2c1-ab02')!;s=until(act(s,'A',{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId,targetId:'B'}),'private-inspection');const d=viewFor(s,'A').inspection!;s=act(s,'A',{type:'REVEAL_CHARACTER',abilityId:TRUE});expect(viewFor(s,'A').inspection).toEqual(d);expect(viewFor(s,'A').legalChoices).not.toContain('CHOOSE_INSPECTION');expect(transition(s,{actorId:'A',command:{type:'CHOOSE_INSPECTION',decisionId:d.decisionId,choice:'finish'}},entropy()).ok).toBe(false);s=until(s,'private-inspection');expect(viewFor(s,'A').inspection).toEqual(d);expect(viewFor(s,'A').spiritExpiry).toMatchObject({active:true});s=pass(s);expect(s.phase).toBe('action');});
it.each(['death','otherworld','transform'] as const)('TruePower clears after %s and never restores from saved field',mode=>{let s=finish(act(base(),'A',{type:'REVEAL_CHARACTER',abilityId:TRUE}));if(mode==='transform')character(s,'A','大神官ジル');else s.players.A!.presence=mode==='death'?'dead':'otherworld';s=act(s,'C',{type:'REVEAL_CHARACTER'});expect(viewFor(s,'A').spiritExpiry).toBeNull();character(s,'A','占星術師のアルセイル');s.players.A!.presence='active';expect(derivedStats(s.players.A!).spirit).toBe(6);});
it('saved counterattacker end survives its arrival and expires after its upcoming actual whole turn skip',()=>{let s=ready();character(s,'C','占星術師のアルセイル');const attack=handCard(s,'A','踏み込み／弓'),counter=handCard(s,'B','閃光槍');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});s=until(s,'attack-abilities');expect(viewFor(s,'C').currentAttack!.attackerId).toBe('B');s=act(s,'C',{type:'REVEAL_CHARACTER',abilityId:TRUE});s=finish(s);expect(viewFor(s,'C').spiritExpiry!.expiresOnActorId).toBe('B');if(s.phase==='withdrawal')s=act(s,'A',{type:'PASS_WITHDRAWAL'});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(5)});expect(s.seatOrder[s.turnSeat]).toBe('B');expect(derivedStats(s.players.C!).spirit).toBe(12);s.players.B!.skipTurns=1;s=act(s,'B',{type:'START_TURN'});expect(viewFor(s,'C').spiritExpiry).toBeNull();});
it.each(['dead','otherworld'] as const)('counterattack-bound expiry passes inactive arriving %s seat without surviving the skip',presence=>{let s=ready();character(s,'C','占星術師のアルセイル');const attack=handCard(s,'A','踏み込み／弓'),counter=handCard(s,'B','閃光槍');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});s=until(s,'attack-abilities');s=finish(act(s,'C',{type:'REVEAL_CHARACTER',abilityId:TRUE}));expect(viewFor(s,'C').spiritExpiry!.expiresOnActorId).toBe('B');s.players.B!.presence=presence;s=act(s,'A',{type:'PASS_WITHDRAWAL'});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(5)});expect(s.seatOrder[s.turnSeat]).toBe('C');expect(viewFor(s,'C').spiritExpiry).toBeNull();});
it('second voluntary reveal after actual Shadow is a fresh trigger, while ended effects never reactivate',()=>{let s=finish(act(base(),'A',{type:'REVEAL_CHARACTER',abilityId:TRUE}));s=finish(use(s,SHADOW));expect(s.players.A!.revealed).toBe(false);s=finish(act(s,'A',{type:'REVEAL_CHARACTER',abilityId:TRUE}));expect(s.players.A!.spiritReplacements).toHaveLength(1);s=end(s);expect(derivedStats(s.players.A!).spirit).toBe(6);s.players.A!.revealed=false;expect(viewFor(s,'A').spiritExpiry).toBeNull();});
it('new optional reveal benefit rejects foreign owner, stopped and disabled actors atomically',()=>{for(const kind of ['foreign','stopped','ability-disabled']){const s=base();if(kind==='foreign')character(s,'A','大神官ジル');else s.players.A!.statuses=[{id:'fixture',kind:kind as 'stopped'|'ability-disabled',modifiers:[0],nextCheck:0}];const before=JSON.stringify(s);expect(transition(s,{actorId:'A',command:{type:'REVEAL_CHARACTER',abilityId:TRUE}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(viewFor(s,'A').revealAbilityOptions).toEqual([]);}});
it('before-roll response rereads current live bonuses while Shadow keeps only TruePower excluded',()=>{let s=finish(act(base(),'A',{type:'REVEAL_CHARACTER',abilityId:TRUE}));s=closeWindow(use(s,SHADOW));s.players.A!.permanent={spirit:3};s=closeWindow(s,[1,1]);expect(viewFor(s,'A').currentRoll!.threshold).toBe(8);s=finish(s);expect(derivedStats(s.players.A!).spirit).toBe(15);});
/** Place through an ordinary prior turn, then create the returned attack with real commands. */
function counterRollScenario(kind:'follower'|'hit'){
 let s=ready();character(s,'C','占星術師のアルセイル');
 if(kind==='follower'){
  const follower=handCard(s,'A','有翼族');
  s=act(s,'A',{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[follower]});
  s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(5)});
  for(const actor of ['B','C','D']){s=act(s,actor,{type:'START_TURN'});s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});s=end(s,actor);}
  s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});
 }
 const attack=handCard(s,'A','踏み込み／弓'),counter=handCard(s,'B',kind==='follower'?'閃光槍':'狂王陣');
 s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});
 s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});
 for(let n=0;n<120;n++){
  const w=s.windows?.at(-1),r=s.rolls?.find(r=>w?.continuation.kind==='roll'&&r.id===w.continuation.id);
  if(w?.kind==='before-roll'&&r?.resume.kind===kind){expect(s.groups![r.resume.groupId]!.attackerId).toBe('B');return s;}
  s=pass(s);
 }
 throw Error('COUNTER_ROLL_NOT_REACHED');
}
it.each(['follower','hit'] as const)('counterattack %s roll provenance takes priority over the original parent attack',kind=>{
 for(const afterRoll of [false,true]){
  let s=counterRollScenario(kind);if(afterRoll)s=closeWindow(s,[1,1]);
  const roll=s.rolls!.find(r=>r.id===s.windows!.at(-1)!.continuation.id)!;
  expect(roll.resume.kind).toBe(kind);
  s=act(s,'C',{type:'REVEAL_CHARACTER',abilityId:TRUE});
  const ability=Object.values(s.abilities!).find(a=>a.abilityId===TRUE)!;
  expect(ability.context).toMatchObject({expiresOnActorId:'B'});
  s=finish(s);expect(viewFor(s,'C').spiritExpiry!.expiresOnActorId).toBe('B');
  s=act(s,'A',{type:'PASS_WITHDRAWAL'});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(5)});
  expect(s.seatOrder[s.turnSeat]).toBe('B');expect(derivedStats(s.players.C!).spirit).toBe(12);
  s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});s=end(s,'B');
  expect(viewFor(s,'C').spiritExpiry).toBeNull();
 }
});
it.each(['follower','hit'] as const)('nested Divine reaction retains counterattack %s roll provenance',kind=>{
 let s=closeWindow(counterRollScenario(kind),[1,1]);
 const rollId=s.windows!.at(-1)!.continuation.id;
 const divine=handCard(s,'D','神性介入');s=priority(s,'D');
 s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:divine,mode:'reroll',targetRollId:rollId});
 expect(s.windows!.at(-1)!.continuation.kind).toBe('action');
 s=act(s,'C',{type:'REVEAL_CHARACTER',abilityId:TRUE});
 expect(Object.values(s.abilities!).find(a=>a.abilityId===TRUE)!.context).toMatchObject({expiresOnActorId:'B'});
 s=finish(s);expect(viewFor(s,'C').spiritExpiry!.expiresOnActorId).toBe('B');
 expect(s.rolls!.find(r=>r.id===rollId)!.attempts).toHaveLength(2);
});
