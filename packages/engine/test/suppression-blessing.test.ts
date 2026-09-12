import {cleanBlessingLeases,vanmilSuppressed} from '../src/abilities/suppression-state.js';
import {expect, it} from 'vitest';
import {transition, viewFor, gameStats, type GameState} from '../src/index.js';
import {canUseCharacterAbility} from '../src/state.js';
import {act, closeWindow, finish, ready, pass, until} from './combat-helpers.js';
import {character, entropy, handCard} from './fixtures.js';
import {beginResetup, settleDamage} from '../src/lifecycle/advance.js';

const BAN = 'c2-p07-r1c2-ab03', BLESS = 'c2-p03-r1c2-ab04';
function setup() {
  const s = ready();
  character(s, 'A', '破壊神ヴァンミール');
  character(s, 'B', '侍大将のシン');
  character(s, 'C', 'リーア姫');
  character(s, 'D', '黒騎士ガーウィン');
  s.players.A!.revealed = true;
  return s;
}
function use(s: GameState, actorId: string, abilityId: string, targets: string[]) {
  const option = viewFor(s, actorId).abilityOptions.find(o => o.abilityId === abilityId);
  expect(option, `missing ${abilityId} option: ${JSON.stringify({phase:s.phase,window:s.windows?.at(-1),used:s.used,lifecycle:s.lifecycle})}`).toBeDefined();
  return act(s, actorId, {type: 'USE_ABILITY', abilityId, targetEventId: option!.targetEventId,
    ...(abilityId === BAN ? {targetIds: targets} : {targetId: targets[0]})});
}
function rejected(s: GameState, actorId: string, command: unknown) {
  const before = JSON.stringify(s);
  expect(transition(s, {actorId, command} as Parameters<typeof transition>[1], entropy()).ok).toBe(false);
  expect(JSON.stringify(s)).toBe(before);
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

it('C16 actual ban declaration applies only after its cancellable window and accumulates designations', () => {
  let s = setup();
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(true);
  s = use(s, 'A', BAN, ['B']);
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(true);
  s = closeWindow(s);
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
  expect(viewFor(s, 'B').abilityOptions).toEqual([]);
  expect(s.players.B!.statuses ?? []).toEqual([]);
  rejected(s, 'A', {type:'USE_ABILITY', abilityId:BAN, targetEventId:'stale', targetIds:['D']});
  s.turnNumber = (s.turnNumber ?? 0) + 1; // A new public opportunity; isolated declaration boundary test.
  s = closeWindow(use(s, 'A', BAN, ['B','D']));
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
  expect(canUseCharacterAbility(s.players.D!, s)).toBe(false);
});

it.each(['リーア姫', '聖騎士ランスロット2'])('C16 hidden %s produces the same targeting transcript as an ordinary identity', name => {
  let ordinary = setup();
  // This paired state isolates projection. Canonical ritual coverage is separate.
  character(ordinary, 'C', '忍びのイダ');
  ordinary.players.B!.revealed = false;
  let exempt = structuredClone(ordinary);
  character(exempt, 'B', name); exempt.players.B!.revealed = false;
  for (const actor of ['A', 'C', 'D']) expect(viewFor(exempt, actor)).toEqual(viewFor(ordinary, actor));
  ordinary = use(ordinary, 'A', BAN, ['B']); exempt = use(exempt, 'A', BAN, ['B']);
  for (const actor of ['A', 'C', 'D']) expect(viewFor(exempt, actor)).toEqual(viewFor(ordinary, actor));
  ordinary = closeWindow(ordinary); exempt = closeWindow(exempt);
  for (const actor of ['A', 'C', 'D']) expect(viewFor(exempt, actor)).toEqual(viewFor(ordinary, actor));
  expect(canUseCharacterAbility(ordinary.players.B!, ordinary)).toBe(false);
  expect(canUseCharacterAbility(exempt.players.B!, exempt)).toBe(true);
});

it('C16 canceled addition keeps the old designation and spends this public opportunity', () => {
  let s = setup(); const fate = handCard(s, 'D', '命運凶変');
  const attack = handCard(s, 'A', '踏み込み／弓');
  s = closeWindow(use(s, 'A', BAN, ['B']));
  const old = structuredClone(s.suppressionDesignations);
  s = act(s, 'A', {type:'ATTACK',cardInstanceId:attack,targetIds:['D'],dedicated:false});
  const opportunity = viewFor(s,'A').abilityOptions.find(o=>o.abilityId===BAN)!.targetEventId;
  s = use(s, 'A', BAN, ['B','D']);
  while (s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor] !== 'D')
    s = act(s, s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!, {type:'PASS'});
  s = act(s, 'D', {type:'PLAY_REACTION', cardInstanceId:fate, mode:'cancel-ability', targetAbilityId:viewFor(s, 'D').reactionTargetAbilityId});
  s = finish(s);
  expect(s.suppressionDesignations).toEqual(old);
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
  expect(canUseCharacterAbility(s.players.D!, s)).toBe(true);
  expect(viewFor(s, 'A').abilityOptions.some(o => o.abilityId === BAN && o.targetEventId===opportunity)).toBe(false);
  expect(s.discard).toContain(fate);
});

it('C16 actual Blessing spirit minus five roll relieves only Vanmil and survives temporary absence', () => {
  let s = closeWindow(use(setup(), 'A', BAN, ['B']));
  s.turnSeat = s.seatOrder.indexOf('C'); // Isolate C02 own-turn declaration and exact check.
  s = use(s, 'C', BLESS, ['B']);
  s = closeWindow(s);
  expect(s.rolls!.at(-1)).toMatchObject({formula:'2d6', rollerId:'C', modifier:-5});
  s = finish(s);
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(true);
  s.players.C!.presence = 'otherworld';
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(true);
  s.players.B!.statuses = [{id:'unrelated', kind:'ability-disabled', modifiers:[0], nextCheck:0}];
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
});

it('C16 suppression stops existing selected conditional and true-power values through the common live gate', () => {
  let s = setup(); character(s, 'B', '占星術師のアルセイル');
  s.players.B!.spiritReplacements = [{id:'prior-power', sourceAbilityId:'c2-p04-r2c1-ab03', sourceCharacterId:s.players.B!.characterId, base:12, expiresOnActorId:'A', timing:'turn-end'}];
  expect(gameStats(s, 'B').spirit).toBe(12);
  s = closeWindow(use(s, 'A', BAN, ['B']));
  expect(gameStats(s, 'B').spirit).toBeLessThan(12);
  expect(viewFor(s, 'B').spiritExpiry).toMatchObject({active:false});
});

it('C16 actual ritual then ban uses Vanmil current ownership without Uonos inheritance', () => {
  let s = setup(); character(s, 'A', '邪祭ウーノス');
  handCard(s, 'A', '復活の儀式'); s.players.A!.damage = 4;
  s = finish(act(s, 'A', {type:'USE_REVIVAL_RITUAL'}));
  expect(s.players.A).toMatchObject({characterId:'c2-p07-r1c2', damage:0, abilityCharacterIds:['c2-p07-r1c2']});
  s = closeWindow(use(s, 'A', BAN, ['B']));
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
  expect(viewFor(s, 'A').abilityOptions.some(o => o.abilityId.startsWith('c2-p05-r1c1-'))).toBe(false);
});

it('C16 public exemptions are excluded but hidden exemptions remain selectable', () => {
  const s = setup();
  const targets = () => viewFor(s, 'A').abilityOptions.find(o => o.abilityId === BAN)!.targetIds;
  s.players.C!.revealed = false; expect(targets()).toContain('C');
  s.players.C!.revealed = true; expect(targets()).not.toContain('C');
  character(s, 'B', '聖騎士ランスロット2'); s.players.B!.revealed = true;
  expect(targets()).not.toContain('B');
});

it('C16 self-designation prevents subsequent ability use and never adds a public disabled status', () => {
  let s = closeWindow(use(setup(), 'A', BAN, ['A']));
  expect(canUseCharacterAbility(s.players.A!, s)).toBe(false);
  expect(viewFor(s, 'A').abilityOptions).toEqual([]);
  expect(s.players.A!.statuses ?? []).toEqual([]);
  expect(viewFor(s, 'D').suppressionTargets).toEqual([{targetId:'A', designated:true, applicability:'suppressed'}]);
});

it('C16 a fresh attack window cannot retry a no-new-target designation', () => {
  let s = closeWindow(use(setup(), 'A', BAN, ['B']));
  s = act(s, 'A', {type:'ATTACK', cardInstanceId:handCard(s, 'A', '踏み込み／弓'), targetIds:['D'], dedicated:false});
  const option = viewFor(s, 'A').abilityOptions.find(o => o.abilityId === BAN)!;
  expect(option).toBeDefined();
  rejected(s, 'A', {type:'USE_ABILITY', abilityId:BAN, targetEventId:option.targetEventId, targetIds:['B']});
  s = closeWindow(use(s, 'A', BAN, ['B','D']));
  expect(s.suppressionDesignations!.map(d => d.targetId)).toEqual(['B','D']);
});

it('C16 bans persist while Vanmil is stopped or absent; mandatory non-ability rules remain separate', () => {
  const s = closeWindow(use(setup(), 'A', BAN, ['B']));
  s.players.A!.statuses = [{id:'stop',kind:'stopped',modifiers:[0],nextCheck:0}];
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
  s.players.A!.presence = 'otherworld';
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
  s.players.B!.presence = 'wandering';
  expect(s.suppressionDesignations!.map(d=>d.targetId)).toEqual(['B']);
  s.players.B!.presence = 'active';
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
});

it('C16 active Tia election is suspended by actual ban and restored by actual successful Blessing', () => {
  let s = setup(); character(s, 'B', '有翼人のティア'); character(s, 'D', '吟遊詩人のレスター');
  // Maintain another faction, so this numeric boundary fixture cannot end early.
  s.players.D!.faction = 'EVIL'; s.players.D!.revealed = true;
  s.players.B!.conditionalSelections = [{abilityId:'c2-p02-r1c1-ab04',sourceCharacterId:'c2-p02-r1c1',targetIds:[]}];
  const selected = structuredClone(s.players.B!.conditionalSelections), before = gameStats(s, 'B').spirit;
  s = closeWindow(use(s, 'A', BAN, ['B']));
  expect(gameStats(s, 'B').spirit).toBe(before-1);
  expect(s.players.B!.conditionalSelections).toEqual(selected);
  expect(viewFor(s, 'B').conditionalAbilities[0]).toMatchObject({enabled:true,active:false,suppressed:true});
  s = actionFor(s,'C');
  s = finish(use(s,'C',BLESS,['B']));
  expect(s.rolls!.at(-1)).toMatchObject({rollerId:'C',modifier:-5,success:true});
  expect(s.players.B!.conditionalSelections).toEqual(selected);
  expect(gameStats(s,'B').spirit).toBe(before);
  expect(viewFor(s,'B').conditionalAbilities[0]).toMatchObject({enabled:true,active:true,suppressed:false});
});

it('C16 an initially hidden exempt target may actually reveal during ban responses without invalidating the accepted declaration', () => {
  let s = setup(); s.players.C!.revealed = false; // Initial public/hidden boundary fixture.
  s = use(s,'A',BAN,['C']);
  const declaration = Object.values(s.abilities!).find(frame=>frame.abilityId===BAN)!;
  s = act(s,'C',{type:'REVEAL_CHARACTER'});
  expect(s.players.C!.revealed).toBe(true);
  s = finish(s);
  expect(s.suppressionDesignations).toEqual([expect.objectContaining({targetId:'C',eventId:declaration.eventId})]);
  expect(canUseCharacterAbility(s.players.C!,s)).toBe(true);
  expect(viewFor(s,'D').suppressionTargets).toEqual([{targetId:'C',designated:true,applicability:'exempt'}]);
});


function blessed() {
  let s = closeWindow(use(setup(), 'A', BAN, ['B']));
  s.turnSeat = 2;
  return finish(use(s, 'C', BLESS, ['B']));
}
it('C16 Blessing expires at G15 death entry and cannot revive with its old life', () => {
  const s = blessed();
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(true);
  const oldLife = s.blessingLeases![0]!.sourceLifeId;
  // Direct lifecycle boundary check; the adjacent actual attack supplies canonical death evidence.
  settleDamage(s, [{targetId:'C',damage:99,eventId:'death-boundary',sourceActorId:'D',cause:'attack'}], 1000);
  expect(s.players.C!.presence).toBe('pending-death');
  expect(s.players.C!.lifeId).not.toBe(oldLife);
  expect(s.blessingLeases).toEqual([]);
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
  beginResetup(s, s.players.C!, 1001, true);
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
});

it('C16 real lethal attack expires the existing Blessing before death disposal', () => {
  let s = blessed(); s.turnSeat = 0;
  s.players.C!.damage = gameStats(s, 'C').endurance-1;
  s = act(s, 'A', {type:'ATTACK',cardInstanceId:handCard(s, 'A', '踏み込み／弓'),targetIds:['C'],dedicated:false});
  for(let n=0;n<200 && s.players.C!.presence!=='pending-death';n++)s=pass(s);
  expect(s.players.C!.presence).toBe('pending-death');
  expect(s.blessingLeases).toEqual([]);
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
  expect(s.players.C!.hand.length).toBeGreaterThan(0);
});

it('C16 failed Blessing keeps suppression and spends the own-turn attempt without taking the main action', () => {
  let s = closeWindow(use(setup(), 'A', BAN, ['B'])); s.turnSeat = 2;
  s = closeWindow(use(s, 'C', BLESS, ['B']));
  s = closeWindow(s, [6,6]); s = finish(s);
  expect(s.rolls!.at(-1)).toMatchObject({faces:[6,6],success:false,modifier:-5});
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
  expect(s.phase).toBe('action');
  expect(viewFor(s, 'C').abilityOptions.some(o => o.abilityId===BLESS)).toBe(false);
});

it('C16 Blessing on a concealed inert designation has the same outsider transcript', () => {
  let ordinary=setup(); ordinary.players.B!.revealed=false;
  let exempt=structuredClone(ordinary); character(exempt,'B','聖騎士ランスロット2');exempt.players.B!.revealed=false;
  ordinary=closeWindow(use(ordinary,'A',BAN,['B']));exempt=closeWindow(use(exempt,'A',BAN,['B']));
  ordinary.turnSeat=2;exempt.turnSeat=2;
  ordinary=use(ordinary,'C',BLESS,['B']);exempt=use(exempt,'C',BLESS,['B']);
  for(let steps=0;ordinary.windows?.length && steps<100;steps++){
    for(const id of ['A','C','D'])expect(viewFor(exempt,id)).toEqual(viewFor(ordinary,id));
    ordinary=pass(ordinary);exempt=pass(exempt);
  }
  expect(ordinary.windows).toEqual([]);expect(exempt.windows).toEqual([]);
  for(const id of ['A','C','D'])expect(viewFor(exempt,id)).toEqual(viewFor(ordinary,id));
  expect(ordinary.blessingLeases).toEqual(exempt.blessingLeases);
});

it('C16 suppressed Lancelot cannot transform until Blessing succeeds; actual transformation exempts the old designation', () => {
  let s=setup();character(s,'B','聖騎士ランスロット');s.players.B!.damage=4;s.players.C!.revealed=true;
  s=closeWindow(use(s,'A',BAN,['B']));
  expect(viewFor(s,'B').lifecycleAbilities).not.toContain('lancelot-transform');
  rejected(s,'B',{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'});
  s.turnSeat=2;s=finish(use(s,'C',BLESS,['B']));
  s=closeWindow(act(s,'B',{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'}));
  expect(s.players.B).toMatchObject({characterId:'c2-p07-r1c1',damage:4,abilityCharacterIds:['c2-p02-r2c2','c2-p07-r1c1']});
  expect(s.used).toContain('B:lancelot-transform');
  expect(s.suppressionDesignations!.map(d=>d.targetId)).toEqual(['B']);
  expect(viewFor(s,'D').suppressionTargets).toEqual([{targetId:'B',designated:true,applicability:'exempt'}]);
});

it('C16 same-opportunity reaction children cannot replenish the ban attempt', () => {
  let s=setup();s=use(s,'A',BAN,['B']);
  expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===BAN)).toBe(false);
  const fate=handCard(s,'D','命運凶変');
  while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='D')s=pass(s);
  s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(s,'D').reactionTargetAbilityId});
  while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='A')s=pass(s);
  expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===BAN)).toBe(false);
});

it('C16 Vanmil may use his own public response on another turn but cannot use a neutral off-turn boundary', () => {
  let s=setup();s.turnSeat=1;
  expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===BAN)).toBe(false);
  s=act(s,'B',{type:'ATTACK',cardInstanceId:handCard(s,'B','踏み込み／弓'),targetIds:['D'],dedicated:false});
  while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='A')s=pass(s);
  expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===BAN)).toBe(true);
  s=closeWindow(use(s,'A',BAN,['B']));
  expect(canUseCharacterAbility(s.players.B!,s)).toBe(false);
});

it('C16 a new declaration containing an already relieved target never cancels its living Blessing', () => {
  let s=blessed();s.turnSeat=0;
  s=act(s,'A',{type:'ATTACK',cardInstanceId:handCard(s,'A','踏み込み／弓'),targetIds:['D'],dedicated:false});
  s=closeWindow(use(s,'A',BAN,['B','D']));
  expect(canUseCharacterAbility(s.players.B!,s)).toBe(true);
  expect(canUseCharacterAbility(s.players.D!,s)).toBe(false);
  s.players.C!.statuses=[{id:'silence-ability',kind:'ability-disabled',modifiers:[0],nextCheck:0}];
  expect(canUseCharacterAbility(s.players.B!,s)).toBe(true);
});

it('C16 actual ban after the use-check freeze preserves the saved threshold while suspending live Tia spirit', () => {
  let s=setup();character(s,'B','有翼人のティア');character(s,'D','吟遊詩人のレスター');
  s.players.D!.faction='EVIL';s.players.D!.revealed=true;
  // Isolate an already selected contribution at B's action boundary.
  s.players.B!.conditionalSelections=[{abilityId:'c2-p02-r1c1-ab04',sourceCharacterId:'c2-p02-r1c1',targetIds:[]}];
  s.turnSeat=1;const before=gameStats(s,'B').spirit;
  s=act(s,'B',{type:'ATTACK',cardInstanceId:handCard(s,'B','黒流弓'),targetIds:['D'],dedicated:false});
  s=until(s,'after-roll');const frozen=structuredClone(s.rolls!.at(-1)!);
  while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='A')s=pass(s);
  s=closeWindow(use(s,'A',BAN,['B']));
  expect(gameStats(s,'B').spirit).toBe(before-1);
  expect(s.rolls!.find(r=>r.id===frozen.id)).toEqual(frozen);
  s=finish(s);
  expect(s.rolls!.find(r=>r.id===frozen.id)).toMatchObject({stage:'applied',threshold:frozen.threshold,faces:frozen.faces,success:frozen.success});
});
it('C16 invalid target lists do not spend the attempt and valid designation preserves main action',()=>{
 let s=setup();s=finish(act(s,'C',{type:'REVEAL_CHARACTER'}));
 const attack=handCard(s,'A','踏み込み／弓');
 const option=viewFor(s,'A').abilityOptions.find(o=>o.abilityId===BAN)!;
 expect(option.targetIds).toEqual(expect.arrayContaining(['A','B','D']));expect(option.targetIds).not.toContain('C');
 for(const targetIds of [[],['B','B'],['missing']]){
  rejected(s,'A',{type:'USE_ABILITY',abilityId:BAN,targetEventId:option.targetEventId,targetIds});
  expect(viewFor(s,'A').abilityOptions.find(o=>o.abilityId===BAN)?.targetEventId).toBe(option.targetEventId);
 }
 s=finish(use(s,'A',BAN,['B']));expect(s.phase).toBe('action');
 expect(s.suppressionDesignations!.map(d=>d.targetId)).toEqual(['B']);
 s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['D'],dedicated:false});
 expect(Object.values(s.actions!).some(a=>a.cardInstanceId===attack)).toBe(true);s=finish(s);
 expect(s.phase).toBe('withdrawal');
});
it('C16 real turn advance offers Vanmil only his public reaction and spends it once',()=>{
 let s=setup();const attack=handCard(s,'B','踏み込み／弓'),fate=handCard(s,'D','命運凶変');
 s=actionFor(s,'B');expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===BAN)).toBe(false);
 s=act(s,'B',{type:'ATTACK',cardInstanceId:attack,targetIds:['D'],dedicated:false});
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='A')s=pass(s);
 const event=viewFor(s,'A').abilityOptions.find(o=>o.abilityId===BAN)!.targetEventId;
 s=use(s,'A',BAN,['B']);
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='D')s=pass(s);
 s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(s,'D').reactionTargetAbilityId!});
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='A')s=pass(s);
 s=JSON.parse(JSON.stringify(s));expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===BAN&&o.targetEventId===event)).toBe(false);
 rejected(s,'A',{type:'USE_ABILITY',abilityId:BAN,targetEventId:event,targetIds:['B']});s=finish(s);
});
it.each(['A','B'] as const)('C16 structural death entry and resetup of %s retain the established designation',victim=>{
 const s=closeWindow(use(setup(),'A',BAN,['B']));const saved=structuredClone(s.suppressionDesignations);
 settleDamage(s,[{targetId:victim,damage:999,eventId:'c16-death-boundary',sourceActorId:'D',cause:'attack'}],1000);
 expect(s.players[victim]!.presence).toBe('pending-death');expect(s.suppressionDesignations).toEqual(saved);
 expect(vanmilSuppressed(s,'B')).toBe(true);
 beginResetup(s,s.players[victim]!,1001,true);
 expect(s.suppressionDesignations).toEqual(saved);expect(vanmilSuppressed(s,'B')).toBe(true);
});
it.each(['source-identity','source-generation','target-otherworld','target-wandering'] as const)('C16 structural Blessing lifetime boundary %s preserves only a living matching source',boundary=>{
 const s=blessed();const saved=structuredClone(s.blessingLeases);
 expect(saved).toHaveLength(1);expect(saved![0]).toMatchObject({sourceActorId:'C',sourceCharacterId:'c2-p03-r1c2',sourceLifeId:s.players.C!.lifeId??'initial-life:C',targetId:'B'});
 if(boundary==='source-identity')character(s,'C','侍大将のシン');
 else if(boundary==='source-generation')s.players.C!.lifeId='structural-next-life:C';
 else s.players.B!.presence=boundary==='target-otherworld'?'otherworld':'wandering';
 const restored=JSON.parse(JSON.stringify(s)) as GameState;cleanBlessingLeases(restored);
 const expires=boundary.startsWith('source-');
 expect(restored.blessingLeases).toEqual(expires?[]:saved);expect(vanmilSuppressed(restored,'B')).toBe(expires);
});
it('C16 Blessing candidates use designated public state after actual turn advance',()=>{
 let s=setup();s=finish(use(s,'A',BAN,['B']));s=actionFor(s,'C');
 const option=viewFor(s,'C').abilityOptions.find(o=>o.abilityId===BLESS)!;
 expect(option.targetIds).toEqual(['B']);
 rejected(s,'C',{type:'USE_ABILITY',abilityId:BLESS,targetEventId:option.targetEventId,targetId:'D'});
 s=finish(use(s,'C',BLESS,['B']));expect(s.phase).toBe('action');
 expect(s.blessingLeases![0]).toMatchObject({sourceActorId:'C',targetId:'B',sourceLifeId:s.players.C!.lifeId??'initial-life:C'});
});
it('C16 actual own-turn Blessing expires on the source lethal attack before disposal',()=>{
 let s=setup();s.players.C!.damage=gameStats(s,'C').endurance-1;const attack=handCard(s,'A','踏み込み／弓');
 s=finish(use(s,'A',BAN,['B']));s=actionFor(s,'C');s=finish(use(s,'C',BLESS,['B']));
 expect(s.blessingLeases).toHaveLength(1);s=actionFor(s,'A');
 s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['C'],dedicated:false});
 for(let n=0;n<200&&s.players.C!.presence!=='pending-death';n++)s=pass(s);
 expect(s.players.C!.presence).toBe('pending-death');expect(s.players.C!.hand.length).toBeGreaterThan(0);
 expect(s.blessingLeases).toEqual([]);expect(vanmilSuppressed(s,'B')).toBe(true);
});
