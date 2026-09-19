import { expect, it } from 'vitest';
import { commandBaseRef, transition, viewFor } from '../src/index.js';
import { character, entropy, freshGame, handCard, loadFixture } from './fixtures.js';
import { act,ready,until } from './combat-helpers.js';
it('allowlists private state and logs, public backs, and safe pending actor', () => {
  const s = freshGame();
  const follower = handCard(s, 'B', '兵士'); s.players.B!.hand = s.players.B!.hand.filter(id => id !== follower); s.players.B!.followers.push({ cardInstanceId: follower, revealed: false });
  const chant = handCard(s, 'B', '命運凶変'); s.players.B!.hand = s.players.B!.hand.filter(id => id !== chant); s.players.B!.chants.push({ cardInstanceId: chant, revealed: false });
  const v = viewFor(s, 'A'); const serialized = JSON.stringify(v);
  for (const secret of [...s.players.B!.hand, ...s.deck, follower, chant, s.players.B!.characterId]) expect(serialized).not.toContain(secret);
  expect(v.players.B!.handCount).toBe(s.players.B!.hand.length); expect(v.players.B!.followers).toEqual([{ position: 0, face: 'back' }]);
  expect(v.players.B!.chants).toEqual([{ position: 0, face: 'back' }]); expect(v.players.B!.chantCount).toBe(1);
  expect(v.players.B).not.toHaveProperty('faction'); expect(v.players.B).not.toHaveProperty('stats'); expect(v.players.B).not.toHaveProperty('objective');
  expect(v.self.hand).toEqual(s.players.A!.hand); expect(v.self.characterId).toBe(s.players.A!.characterId);
  expect(v.pending).toEqual({ kind: 'initial-followers', round: 1, participantIds: ['A', 'B', 'C', 'D'], readyIds: [] });
  expect(v.logs.some((e: any) => e.type === 'CHARACTER_ASSIGNED')).toBe(false);
  expect(v.privateLogs.every((e: any) => e.actorId === 'A')).toBe(true);
});
it('reveal works at setup boundary even out of turn and exposes only revealed character data', () => {
  const s = freshGame(); const r = transition(s, { actorId: 'B', command: { type: 'REVEAL_CHARACTER' } }, entropy());
  expect(r.ok).toBe(true); if (!r.ok) throw Error(r.code);
  expect(viewFor(r.state, 'A').players.B!.characterId).toBe(s.players.B!.characterId);
  expect(JSON.stringify(viewFor(r.state, 'A'))).not.toContain(s.players.C!.characterId);
  expect(r.state.pending).toEqual(s.pending); expect(r.state.players.B!.followers).toEqual([]);
  expect(transition(r.state, { actorId: 'B', command: { type: 'REVEAL_CHARACTER' } }, entropy())).toEqual({ ok: false, code: 'ALREADY_REVEALED' });
});
it('views do not alias state and reject unknown viewers including prototype properties', () => {
  const s = freshGame(); const before = JSON.stringify(s); const v = viewFor(s, 'A');
  v.self.hand.length = 0; v.seatOrder.reverse(); v.players.B!.open.push('bad'); v.distances.A!.B = 'near'; v.logs.length = 0; v.self.stats.spirit = 99;
  expect(JSON.stringify(s)).toBe(before);
  for (const viewer of ['intruder', '__proto__', 'constructor']) expect(() => viewFor(s, viewer)).toThrow('UNKNOWN_VIEWER');
});
it('exposes public follower faces while keeping unrevealed physical ids absent', () => {
  const s = freshGame(); const id = handCard(s, 'B', '兵士'); s.players.B!.hand = s.players.B!.hand.filter(x => x !== id); s.players.B!.followers.push({ cardInstanceId: id, revealed: true });
  expect(viewFor(s, 'A').players.B!.followers).toEqual([{ position: 0, face: 'front', cardInstanceId: id }]);
});

it('projects only public window ownership and private legal command kinds',()=>{
  const s=loadFixture('third-party-interrupt');const publicView=viewFor(s,'A');const actorView=viewFor(s,'C');
  expect(publicView.activeWindow).toMatchObject({pendingActorId:'C',kind:'declaration'});expect(publicView.legalChoices).toEqual(['REVEAL_CHARACTER']);
  expect(actorView.legalChoices).toEqual(['REVEAL_CHARACTER','PASS','PLAY_REACTION','PASS_ACTION_THROUGH']);expect(JSON.stringify(publicView.activeWindow)).not.toContain(s.players.C!.characterId);
});

it('projects explicit setup and turn choices only to the eligible viewer',()=>{const setup=freshGame();expect(viewFor(setup,'A').legalChoices).toEqual(['REVEAL_CHARACTER','PLACE_INITIAL_FOLLOWER','PASS_SETUP']);expect(viewFor(setup,'B').legalChoices).toEqual(['REVEAL_CHARACTER','PLACE_INITIAL_FOLLOWER','PASS_SETUP']);const readied=act(setup,'B',{type:'PASS_SETUP'});expect(viewFor(readied,'B').legalChoices).toEqual(['REVEAL_CHARACTER']);expect(viewFor(readied,'A').legalChoices).toEqual(['REVEAL_CHARACTER','PLACE_INITIAL_FOLLOWER','PASS_SETUP']);let turn=ready();expect(viewFor(turn,'A').legalChoices).toEqual(['REVEAL_CHARACTER','ATTACK','APPROACH','CHANT','ARRANGE_FOLLOWERS','REST','PLAY_TURN_CARD','PLAY_TURN_TECHNIQUE','PASS_ACTION']);expect(viewFor(turn,'B').legalChoices).toEqual(['REVEAL_CHARACTER','SET_CONDITIONAL_ABILITY']);expect(viewFor(turn,'B').conditionalAbilities).toEqual([expect.objectContaining({abilityId:'c2-p05-r2c1-ab05',enabled:false,canActivate:true,canDeactivate:false})]);});

it('projects self reveal at combat boundaries and out of turn without leaking concealed opponents',()=>{
  let s=ready();
  expect(viewFor(s,'B').legalChoices).toContain('REVEAL_CHARACTER');
  const attack=handCard(s,'A','踏み込み／弓');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');
  expect(viewFor(s,'B').legalChoices).toContain('REVEAL_CHARACTER');
  s=act(s,'B',{type:'START_FOLLOWERS'});
  expect(viewFor(s,'B').legalChoices).toContain('REVEAL_CHARACTER');
  const revealed=act(s,'B',{type:'REVEAL_CHARACTER'});const ownView=viewFor(revealed,'B');
  expect(ownView.legalChoices).not.toContain('REVEAL_CHARACTER');
  expect(ownView.players.C).not.toHaveProperty('characterId');
  // B may privately know that Gainas is its protected character without learning
  // whether concealed C is Gainas. Changing C's identity must not change B's wire.
  expect(ownView.self.protection.characterIds).toContain('c2-p05-r2c2');
  const concealedAlternative=structuredClone(revealed);
  character(concealedAlternative,'C','小妖精のチャム');
  expect(viewFor(concealedAlternative,'B')).toEqual(ownView);
});

it('allowlists current action and attack identities without early locked values or private candidates',()=>{let s=ready();const attack=handCard(s,'A','踏み込み／弓');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});let view=viewFor(s,'C');expect(view.currentAction).toMatchObject({actorId:'A',cardInstanceId:attack,targetIds:['B'],stage:'declaration',technique:{range:'far',useLevel:3}});expect((view.currentAction?.source==='card'?view.currentAction.technique:undefined)).not.toHaveProperty('effectLevel');expect((view.currentAction?.source==='card'?view.currentAction.technique:undefined)).not.toHaveProperty('damage');expect(view.reactionTargetActionId).toBe(view.currentAction!.actionId);expect(JSON.stringify(view)).not.toContain(s.players.B!.characterId);
  s=until(s,'normal-defense');view=viewFor(s,'C');expect(view.currentAttack).toMatchObject({attackerId:'A',targetIds:['B'],hitIndex:0,targetId:'B',reason:'normal-defense',technique:{effectLevel:3,damage:4,attributes:['遠','戦','弓']},targets:[{actorId:'B',hits:[{index:0,defended:false,hit:false}]}]});expect((view.currentAction?.source==='card'?view.currentAction.technique:undefined)).toMatchObject({effectLevel:3,damage:4,hitCount:1});});
it('sends only the discard count, never discard pile card ids, to every viewer', () => {
  const s = freshGame();
  const discarded = { B: s.players.B!.hand.splice(0, 2), C: s.players.C!.hand.splice(0, 1) }; s.discard.push(...discarded.B, ...discarded.C);
  for (const viewer of s.seatOrder) {
    const v = viewFor(s, viewer);
    expect(v).not.toHaveProperty('discard'); expect(v.discardCount).toBe(s.discard.length);
    // Own draw history may name one's own cards; nobody else's discarded ids may appear.
    const serialized = JSON.stringify(v);
    for (const [owner, ids] of Object.entries(discarded)) if (owner !== viewer) for (const id of ids) expect(serialized).not.toContain(id);
  }
});
it('bases commands on the open window generation, the setup round, or nothing at all',()=>{
 const setup=freshGame();
 expect(commandBaseRef(setup)).toEqual({windowId:'setup-1',windowRevision:0});
 const soldier=handCard(setup,'A','兵士');
 let round2=act(setup,'A',{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:soldier});
 for(const id of setup.seatOrder)round2=act(round2,id,{type:'PASS_SETUP'});
 expect(commandBaseRef(round2)).toEqual({windowId:'setup-2',windowRevision:0});
 const turn=ready();
 expect(commandBaseRef(turn)).toBeNull();
 const attacking=loadFixture('third-party-interrupt');
 const window=attacking.windows!.at(-1)!;
 expect(commandBaseRef(attacking)).toEqual({windowId:window.id,windowRevision:window.revision});
});
