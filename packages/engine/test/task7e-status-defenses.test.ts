import { expect, it } from 'vitest';
import * as engine from '../src/index.js';
import { act, closeWindow, finish, pass, ready, until } from './combat-helpers.js';
import { character, entropy, handCard, handCards } from './fixtures.js';

function moveToChant(state: engine.GameState, owner: string, cardInstanceId: string) {
  state.players[owner]!.hand = state.players[owner]!.hand.filter(id => id !== cardInstanceId);
  state.players[owner]!.chants = [{ cardInstanceId, revealed: false }];
}

function resolveResistance(state: engine.GameState, dice: number[]) {
  state = until(state, 'hit');
  state = closeWindow(state);
  while (state.windows?.at(-1)?.kind === 'hit-abilities') state = closeWindow(state);
  expect(engine.viewFor(state, 'A').currentRoll).toMatchObject({ purpose: 'status-resistance', stage: 'before-roll' });
  state = closeWindow(state, dice);
  state = closeWindow(state);
  return finish(state);
}

it('projects an allowlisted status view while keeping internal identity and future modifiers private', () => {
  const state = ready();
  state.players.B!.statuses = [{
    id: 'g-private:B:stopped', kind: 'stopped', modifiers: [-3, -2, -1], nextCheck: 1,
    sourceActorId: 'A', sourceCardInstanceId: 'a2-p17-r1c1', targetId: 'B',
  } as any];
  expect(engine.viewFor(state, 'C').players.B!.statuses).toEqual([{
    kind: 'stopped', sourceActorId: 'A', sourceCardInstanceId: 'a2-p17-r1c1',
    recoveryModifier: -2, nextCheck: 1,
  }]);
  expect(JSON.stringify(engine.viewFor(state, 'C').players.B)).not.toContain('g-private');
  expect(JSON.stringify(engine.viewFor(state, 'C').players.B)).not.toContain('targetId');

  state.players.C!.statuses = [{ id: 'legacy', kind: 'silenced', modifiers: [-2, -1], nextCheck: 9 }];
  expect(engine.viewFor(state, 'A').players.C!.statuses).toEqual([{
    kind: 'silenced', recoveryModifier: -1, nextCheck: 9,
  }]);
});

it('keeps printed Arseil cancellation and character-limited cards legal despite the shared ability guard', () => {
  let state = ready();
  character(state, 'C', '占星術師のアルセイル');
  state.players.C!.revealed = true;
  state.players.C!.statuses = [{ id: 'confusion', kind: 'ability-disabled', modifiers: [-2, -1], nextCheck: 1 } as any];
  expect(engine.canUseCharacterAbility(state.players.C!)).toBe(false);
  const fate = handCard(state, 'B', '命運凶変');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: handCard(state, 'A', '踏み込み／弓'), targetIds: ['D'], dedicated: false });
  state = pass(state);
  state = act(state, 'B', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel', targetActionId: Object.keys(state.actions!)[0]! });
  const reactionId = Object.values(state.actions!).find(action => action.kind === 'reaction')!.id;
  while (state.windows!.at(-1)!.participants[state.windows!.at(-1)!.cursor] !== 'C') state = pass(state);
  expect(engine.viewFor(state, 'C').legalChoices).toContain('CANCEL_REACTION');
  state = act(state, 'C', { type:'CANCEL_REACTION', targetActionId:reactionId });
  expect(state.actions![reactionId]!.canceled).toBe(true);
  expect(engine.viewFor(state, 'C').reactionTargetAbilityId).toBeNull();

  state = ready();
  character(state, 'A', '占星術師のアルセイル');
  state.players.A!.statuses = [{ id: 'confusion', kind: 'ability-disabled', modifiers: [-2, -1], nextCheck: 1 } as any];
  const confusion = handCard(state, 'A', '錯乱');
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: confusion, targetIds: ['B'], dedicated: true } }, entropy()).ok).toBe(true);
});

it('blocks stopped hand-card side paths but retains PASS, reveal, and follower defense', () => {
  let state = ready();
  const attack = handCard(state, 'A', '踏み込み／弓');
  const maai = handCard(state, 'B', '間合い／休息');
  const defense = handCard(state, 'B', '見切る');
  state.players.B!.statuses = [{ id: 'stop', kind: 'stopped', modifiers: [0], nextCheck: 1 }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  state = until(state, 'normal-defense');
  expect(engine.viewFor(state, 'B').legalChoices).toEqual(expect.arrayContaining(['PASS', 'START_FOLLOWERS', 'REVEAL_CHARACTER']));
  expect(engine.viewFor(state, 'B').legalChoices).not.toEqual(expect.arrayContaining(['PLAY_MAAI', 'PLAY_DEFENSE']));
  expect(engine.transition(state, { actorId: 'B', command: { type: 'PLAY_MAAI', cardInstanceId: maai } }, entropy())).toEqual({ ok: false, code: 'STOPPED' });
  expect(engine.transition(state, { actorId: 'B', command: { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: false } }, entropy())).toEqual({ ok: false, code: 'STOPPED' });
  state = act(state, 'B', { type: 'START_FOLLOWERS' });
  expect(state.players.B!.statuses).toHaveLength(1);
});

it.each([
  ['毒流', '凍気のアイエル', false, 4, 10, 0],
  ['毒流', '凍気のアイエル', true, 4, 10, 0],
  ['幻矢', '大神官ジル', false, 0, 10, -1],
] as const)('applies one target-local conditional damage result for %s dedicated=%s', (name, owner, dedicated, successDamage, failureDamage, modifier) => {
  const scenario = (dice: number[]) => {
    let state = ready(); character(state, 'A', owner);
    const card = handCard(state, 'A', name);
    state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated });
    state = until(state, 'hit'); state = closeWindow(state);
  while (state.windows?.at(-1)?.kind === 'hit-abilities') state = closeWindow(state);
    expect(engine.viewFor(state, 'B').currentRoll).toMatchObject({ purpose: 'status-resistance', modifier });
    state = closeWindow(state, dice); state = closeWindow(state); state = finish(state);
    expect(state.discard.filter(id => id === card)).toHaveLength(1);
    return state.players.B!.damage;
  };
  expect(scenario([1, 1])).toBe(successDamage);
  expect(scenario([6, 6])).toBe(failureDamage);
});

it('enforces 血流 faction, chant, dedicated modifier, and additional damage before final application', () => {
  let state = ready(); character(state, 'A', '白魔術師シェリム');
  let card = handCard(state, 'A', '血流'); moveToChant(state, 'A', card);
  const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false } }, entropy())).toEqual({ ok: false, code: 'UNSUPPORTED_CARD' });
  expect(JSON.stringify(state)).toBe(before);

  state = ready(); character(state, 'A', '魔導王ガイナス'); card = handCard(state, 'A', '血流'); moveToChant(state, 'A', card);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true });
  state = until(state, 'hit'); state = closeWindow(state);
  while (state.windows?.at(-1)?.kind === 'hit-abilities') state = closeWindow(state);
  expect(engine.viewFor(state, 'B').currentRoll).toMatchObject({ modifier: -3, purpose: 'status-resistance' });
  state = closeWindow(state, [6, 6]); state = closeWindow(state); state = finish(state);
  expect(state.players.B!.damage).toBe(20);
});

it('uses ordinary 血流 modifier -2 and keeps its base damage when resistance succeeds', () => {
  let state = ready(); character(state, 'A', '不死王ガドューラ');
  const card = handCard(state, 'A', '血流'); moveToChant(state, 'A', card);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
  state = until(state, 'hit'); state = closeWindow(state);
  while (state.windows?.at(-1)?.kind === 'hit-abilities') state = closeWindow(state);
  expect(engine.viewFor(state, 'B').currentRoll).toMatchObject({ modifier: -2, purpose: 'status-resistance' });
  state = closeWindow(state, [1, 1]); state = closeWindow(state); state = finish(state);
  expect(state.players.B!.damage).toBe(10);
});

it.each([
  ['氷結', '凍気のアイエル', false, 'stopped', [-1], 4],
  ['氷結', '凍気のアイエル', true, 'stopped', [-3], 8],
  ['錯乱', '占星術師のアルセイル', false, 'ability-disabled', [-2, -1], 0],
  ['錯乱', '占星術師のアルセイル', true, 'ability-disabled', [-2], 0],
  ['鏡封', '占星術師のアルセイル', false, 'stopped', [-2], 0],
  ['鏡封', '占星術師のアルセイル', true, 'stopped', [-2], 0],
  ['催眠', '占星術師のアルセイル', false, 'stopped', [-2, -1], 0],
  ['催眠', '占星術師のアルセイル', true, 'stopped', [-2, -1], 0],
  ['植縛', '小人のランバ', false, 'stopped', [-3, -2, -1, 0], 0],
  ['植縛', '小人のランバ', true, 'stopped', [-3, -2, -1, 0], 0],
  ['魔詩', '吟遊詩人のレスター', false, 'stopped', [-3, -2, -1], 5],
  ['魔詩', '吟遊詩人のレスター', true, 'stopped', [-3], 7],
  ['狂王陣', '大神官ジル', false, 'stopped', [-2, -1, 0], 5],
] as const)('persists source-owned %s status with printed recovery sequence dedicated=%s', (name, owner, dedicated, kind, modifiers, damage) => {
  let state = ready(); character(state, 'A', owner);
  const card = handCard(state, 'A', name);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated });
  state = resolveResistance(state, [6, 6]);
  expect(state.players.B!.damage).toBe(damage);
  expect(state.players.B!.statuses).toEqual([{
    id: expect.stringContaining(':B:'), kind, modifiers: [...modifiers], nextCheck: 1,
    sourceActorId: 'A', sourceCardInstanceId: card, targetId: 'B',
  }]);
  expect(state.discard.filter(id => id === card)).toHaveLength(1);
  expect(JSON.parse(JSON.stringify(state))).toEqual(state);
});

it('destroys only the receiving target followers for dedicated 錯乱 before applying its null-damage status', () => {
  let state = ready(); character(state, 'A', '占星術師のアルセイル');
  const card = handCard(state, 'A', '錯乱');
  const bFollower = handCard(state, 'B', '兵士'); const cFollower = handCard(state, 'C', 'ゴブリン');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== bFollower); state.players.B!.followers = [{ cardInstanceId: bFollower, revealed: false }];
  state.players.C!.hand = state.players.C!.hand.filter(id => id !== cFollower); state.players.C!.followers = [{ cardInstanceId: cFollower, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true });
  state = resolveResistance(state, [6, 6]);
  expect(state.players.B!.followers).toEqual([]);
  expect(state.players.C!.followers).toEqual([{ cardInstanceId: cFollower, revealed: false }]);
  expect(state.players.B!.damage).toBe(0);
  expect(state.players.B!.revealed).toBe(true);
});

it('keeps dedicated 魔詩 follower cards while bypassing their defense', () => {
  let state = ready(); character(state, 'A', '吟遊詩人のレスター');
  const card = handCard(state, 'A', '魔詩'); const follower = handCard(state, 'B', '水竜');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== follower); state.players.B!.followers = [{ cardInstanceId: follower, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true });
  state = resolveResistance(state, [6, 6]);
  expect(state.players.B!.followers).toEqual([{ cardInstanceId: follower, revealed: false }]);
  expect(state.players.B!.damage).toBe(7);
});

it('uses Asfelt-specific -2 for every 悪夢 resistance and a shared rerollable 2d6x2 damage formula', () => {
  let state = ready(); character(state, 'A', '魔聖母ディア'); character(state, 'B', '竜皇子アスフェルト'); character(state, 'D', '小人のランバ');
  const card = handCard(state, 'A', '悪夢'); const god = handCard(state, 'C', '神性介入');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'D'], dedicated: true });
  state = until(state, 'damage');
  while (state.windows!.at(-1)!.cursor < state.windows!.at(-1)!.participants.length - 1) state = pass(state);
  state = pass(state, [2, 3]);
  const roll = engine.viewFor(state, 'C').currentRoll!;
  expect(roll).toMatchObject({ purpose: 'attack-damage', formula: '2d6x2', faces: [2, 3], total: 10 });
  while (state.windows!.at(-1)!.participants[state.windows!.at(-1)!.cursor] !== 'C') state = pass(state);
  state = act(state, 'C', { type: 'PLAY_REACTION', cardInstanceId: god, mode: 'reroll', targetRollId: roll.rollId });
  state = closeWindow(state, [4, 1]); state = closeWindow(state);
  state = until(state, 'hit'); state = closeWindow(state);
  while (state.windows?.at(-1)?.kind === 'hit-abilities') state = closeWindow(state);
  expect(engine.viewFor(state, 'B').currentRoll).toMatchObject({ purpose: 'status-resistance', modifier: -2 });
  state = closeWindow(state, [6, 6]); state = closeWindow(state);
  state = until(state, 'hit'); state = closeWindow(state);
  while (state.windows?.at(-1)?.kind === 'hit-abilities') state = closeWindow(state);
  expect(engine.viewFor(state, 'D').currentRoll).toMatchObject({ purpose: 'status-resistance', modifier: -1 });
  state = closeWindow(state, [6, 6]); state = closeWindow(state); state = finish(state);
  expect([state.players.B!.damage, state.players.D!.damage]).toEqual([10, 10]);
  expect(state.players.B!.statuses![0]!).toMatchObject({modifiers:[-2]});
  expect(state.players.D!.statuses![0]!).toMatchObject({modifiers:[-1]});
  expect(state.rolls!.find(frame => frame.id === roll.rollId)!.attempts).toEqual([
    { generation: 0, faces: [2, 3], total: 10 }, { generation: 1, faces: [4, 1], total: 10 },
  ]);
});

it('stacks separate physical status sources and advances each recovery independently', () => {
  let state = ready();
  state.players.B!.statuses = [
    { id: 'one', kind: 'stopped', modifiers: [-3, -2], nextCheck: 1, sourceActorId: 'A', sourceCardInstanceId: 'a2-p16-r3c1', targetId: 'B' },
    { id: 'two', kind: 'stopped', modifiers: [-2, -1], nextCheck: 1, sourceActorId: 'C', sourceCardInstanceId: 'a2-p17-r3c1', targetId: 'B' },
  ];
  state.turnSeat = 1; state.phase = 'turn-start';
  state = act(state, 'B', { type: 'START_TURN' });
  state = closeWindow(state, [6, 6]); state = closeWindow(state);
  state = closeWindow(state, [1, 1]); state = closeWindow(state);
  expect(state.players.B!.statuses).toEqual([{ id: 'one', kind: 'stopped', modifiers: [-3, -2], nextCheck: 2, sourceActorId: 'A', sourceCardInstanceId: 'a2-p16-r3c1', targetId: 'B' }]);
});

it('uses each 結界 copy as a dynamic-level one-hit magic negate and resumes defense after a failed check', () => {
  let state = ready(); character(state, 'A', '白魔術師シェリム'); character(state, 'B', '魔聖母ディア');
  const attack = handCard(state, 'A', '天舞'); moveToChant(state, 'A', attack);
  const [first, second] = handCards(state, ['B', 'B'], '結界');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  state = until(state, 'normal-defense');
  state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: first!, dedicated: false });
  const firstAction = Object.values(state.actions!).find(action => action.cardInstanceId === first)!;
  expect(firstAction.technique.useLevel).toBe(7);
  expect(firstAction.checks).toHaveLength(1);
  state = until(state, 'before-roll'); state = closeWindow(state, [6, 6]); state = closeWindow(state);
  expect(state.discard).toContain(first);
  expect(state.windows!.at(-1)!.kind).toBe('normal-defense');
  expect(engine.transition(state, { actorId: 'B', command: { type: 'PLAY_DEFENSE', cardInstanceId: first!, dedicated: false } }, entropy())).toEqual({ ok: false, code: 'CARD_NOT_IN_HAND' });
  state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: second!, dedicated: false });
  state = until(state, 'before-roll'); state = closeWindow(state, [1, 1]); state = closeWindow(state); state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.discard.filter(id => id === first || id === second)).toHaveLength(2);
});

it('rejects 結界 against warrior and rejects both fixed defenses under 反撃禁止 before card cost', () => {
  const rejectDefense = (attackName: string, defenseName: string, setupAttack?: (state: engine.GameState, id: string) => void) => {
    let state = ready(); const attack = handCard(state, 'A', attackName); const defense = handCard(state, 'B', defenseName);
    setupAttack?.(state, attack);
    state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
    state = until(state, 'normal-defense'); const before = JSON.stringify(state);
    expect(engine.transition(state, { actorId: 'B', command: { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: false } }, entropy())).toEqual({ ok: false, code: 'ILLEGAL_DEFENSE' });
    expect(JSON.stringify(state)).toBe(before);
  };
  rejectDefense('踏み込み／弓', '結界');
  const prepareDragon = (state:engine.GameState,id:string) => { moveToChant(state, 'A', id); state.distances.A!.B = state.distances.B!.A = 'near'; };
  rejectDefense('紋竜破', '結界', prepareDragon);
  rejectDefense('紋竜破', '神王界', prepareDragon);
});

it('reflects magic through 神王界 at fixed level six without ordinary comparison and preserves the frozen roll', () => {
  let state = ready(); character(state, 'A', '吟遊詩人のレスター');
  const attack = handCard(state, 'A', '呪歌'); const defense = handCard(state, 'B', '神王界'); const god = handCard(state, 'C', '神性介入');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  state = until(state, 'damage'); while (state.windows!.at(-1)!.cursor < state.windows!.at(-1)!.participants.length - 1) state = pass(state);
  state = pass(state, [3]);
  const firstRollId = engine.viewFor(state, 'C').currentRoll!.rollId;
  while (state.windows!.at(-1)!.participants[state.windows!.at(-1)!.cursor] !== 'C') state = pass(state);
  state = act(state, 'C', { type: 'PLAY_REACTION', cardInstanceId: god, mode: 'reroll', targetRollId: firstRollId });
  state = closeWindow(state, [4]); state = closeWindow(state);
  const frozen = state.randomRolls![0]!;
  expect(frozen).toMatchObject({ id:firstRollId, faces:[4], total:8 });
  state = until(state, 'normal-defense'); state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: false });
  while (Object.keys(state.groups!).length < 2) state = pass(state);
  const reflected = Object.values(state.groups!).find(group => group.attackerId === 'B')!;
  expect(reflected.damageRollId).toBe(frozen.id);
  expect(reflected.targets[0]!.hits[0]!.damageRollId).toBe(frozen.id);
  state = finish(state);
  expect(state.players.A!.damage).toBe(8);
  expect(state.players.B!.damage).toBe(0);

  state = ready(); character(state, 'A', '白魔術師シェリム');
  const tooStrong = handCard(state, 'A', '天舞'); moveToChant(state, 'A', tooStrong); const realm = handCard(state, 'B', '神王界');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: tooStrong, targetIds: ['B'], dedicated: false }); state = until(state, 'normal-defense');
  const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'B', command: { type: 'PLAY_DEFENSE', cardInstanceId: realm, dedicated: false } }, entropy())).toEqual({ ok: false, code: 'ILLEGAL_DEFENSE' });
  expect(JSON.stringify(state)).toBe(before);
});

it('lets Lancaster dedicated 閃光槍 counter any effect level only after its spirit check', () => {
  let state = ready(); character(state, 'A', '大神官ジル'); character(state, 'B', '早駆けのランカスター');
  const attack = handCard(state, 'A', '神罰'); moveToChant(state, 'A', attack); const counter = handCard(state, 'B', '閃光槍');
  const follower = handCard(state, 'A', '水竜'); state.players.A!.hand = state.players.A!.hand.filter(id => id !== follower); state.players.A!.followers = [{ cardInstanceId: follower, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false }); state = until(state, 'normal-defense');
  state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: counter, dedicated: true });
  expect(Object.values(state.actions!).find(action => action.cardInstanceId === counter)!.checks).toEqual([0]);
  state = until(state, 'before-roll'); expect(engine.viewFor(state, 'B').currentRoll).toMatchObject({ purpose: 'counter' });
  state = closeWindow(state, [1, 1]); state = closeWindow(state); state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.players.A!.followers).toEqual([{ cardInstanceId: follower, revealed: false }]);
  expect(state.players.A!.damage).toBe(7);
});

it('consumes failed dedicated 閃光槍 and restores the parent for another defense', () => {
  let state = ready(); character(state, 'B', '早駆けのランカスター');
  const attack = handCard(state, 'A', '踏み込み／弓'); const counter = handCard(state, 'B', '閃光槍'); const evade = handCard(state, 'B', '見切る');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false }); state = until(state, 'normal-defense');
  state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: counter, dedicated: true }); state = until(state, 'before-roll');
  state = closeWindow(state, [6, 6]); state = closeWindow(state);
  expect(state.discard).toContain(counter);
  expect(state.windows!.at(-1)!.kind).toBe('normal-defense');
  state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: evade, dedicated: false }); state = finish(state);
  expect(state.players.B!.damage).toBe(0);
});

it('keeps follower defense for a dedicated 閃光槍 used as an ordinary attack', () => {
  let state = ready(); character(state, 'A', '早駆けのランカスター');
  const attack = handCard(state, 'A', '閃光槍'); const follower = handCard(state, 'B', '水竜');
  state.players.B!.hand = state.players.B!.hand.filter(id => id !== follower); state.players.B!.followers = [{ cardInstanceId: follower, revealed: false }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: true }); state = finish(state);
  expect(state.players.B!.damage).toBe(0);
  expect(state.players.B!.followers).toEqual([{ cardInstanceId: follower, revealed: true }]);
});

it.each([
  ['血流', '白魔術師シェリム'], ['毒流', '大神官ジル'], ['氷結', '大神官ジル'],
  ['錯乱', '大神官ジル'], ['鏡封', '大神官ジル'], ['催眠', '大神官ジル'],
  ['悪夢', '大神官ジル'], ['植縛', '大神官ジル'], ['魔詩', '大神官ジル'],
] as const)('rejects wrong-owner dedicated %s before physical cost', (name, wrongOwner) => {
  const state = ready(); character(state, 'A', wrongOwner); const card = handCard(state, 'A', name); const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true } }, entropy())).toEqual({ ok: false, code: 'UNSUPPORTED_CARD' });
  expect(JSON.stringify(state)).toBe(before);
});

it.each(['幻矢', '狂王陣'])('rejects unprinted dedicated status/damage mode for %s before cost', name => {
  const state = ready(); const card = handCard(state, 'A', name); const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'A', command: { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true } }, entropy())).toEqual({ ok: false, code: 'UNSUPPORTED_CARD' });
  expect(JSON.stringify(state)).toBe(before);
});

it('rejects magic fixed defenses while silenced without consuming them', () => {
  for (const defenseName of ['結界', '神王界']) {
    let state = ready(); character(state, 'A', '吟遊詩人のレスター');
    const attack = handCard(state, 'A', '呪歌'); const defense = handCard(state, 'B', defenseName);
    state.players.B!.statuses = [{ id: 'silence', kind: 'silenced', modifiers: [-2, -1], nextCheck: 1 }];
    state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false }); state = until(state, 'normal-defense');
    const before = JSON.stringify(state);
    expect(engine.transition(state, { actorId: 'B', command: { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: false } }, entropy())).toEqual({ ok: false, code: 'SILENCED' });
    expect(JSON.stringify(state)).toBe(before);
  }
});

it('blocks stopped Fate/God card reactions while preserving PASS and public reveal', () => {
  let state = ready(); const attack = handCard(state, 'A', '踏み込み／弓'); const fate = handCard(state, 'B', '命運凶変');
  state.players.B!.statuses = [{ id: 'stop', kind: 'stopped', modifiers: [0], nextCheck: 1 }];
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['C'], dedicated: false });
  state = pass(state);
  expect(engine.viewFor(state, 'B').legalChoices).toEqual(expect.arrayContaining(['PASS', 'REVEAL_CHARACTER']));
  expect(engine.viewFor(state, 'B').legalChoices).not.toContain('PLAY_REACTION');
  const before = JSON.stringify(state);
  expect(engine.transition(state, { actorId: 'B', command: { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel', targetActionId: Object.keys(state.actions!)[0]! } }, entropy())).toEqual({ ok: false, code: 'STOPPED' });
  expect(JSON.stringify(state)).toBe(before);
});

it('does not create a persistent status when the initial resistance succeeds', () => {
  let state = ready(); character(state, 'A', '凍気のアイエル'); const card = handCard(state, 'A', '氷結');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
  state = resolveResistance(state, [1, 1]);
  expect(state.players.B!.statuses ?? []).toEqual([]);
  expect(state.players.B!.damage).toBe(4);
});

it('blocks withdrawal after a reflected attack stops its own attacker without paying the distance card', () => {
  let state = ready();
  const attack = handCard(state, 'A', '狂王陣');
  const realm = handCard(state, 'B', '神王界');
  const distance = handCard(state, 'A', '間合い／休息');
  state.distances.A!.B = state.distances.B!.A = 'near';

  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
  state = until(state, 'normal-defense');
  state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: realm, dedicated: false });
  state = until(state, 'hit');
  state = closeWindow(state);
  while (state.windows?.at(-1)?.kind === 'hit-abilities') state = closeWindow(state);
  expect(engine.viewFor(state, 'A').currentRoll).toMatchObject({ purpose: 'status-resistance', modifier: -2 });
  state = closeWindow(state, [6, 6]);
  state = closeWindow(state);
  state = finish(state);

  expect(state.phase).toBe('withdrawal');
  expect(state.players.A!.statuses).toEqual([
    expect.objectContaining({ kind: 'stopped', sourceActorId: 'B', sourceCardInstanceId: attack, targetId: 'A' }),
  ]);
  expect(engine.viewFor(state, 'A').legalChoices).toContain('PASS_WITHDRAWAL');
  expect(engine.viewFor(state, 'A').legalChoices).not.toContain('WITHDRAW');

  const snapshot = JSON.stringify(state);
  expect(engine.transition(state, {
    actorId: 'A',
    command: { type: 'WITHDRAW', targetId: 'B', cardInstanceId: distance },
  }, entropy())).toEqual({ ok: false, code: 'STOPPED' });
  expect(JSON.stringify(state)).toBe(snapshot);
  expect(state.players.A!.hand).toContain(distance);

  const beforeCompletion = structuredClone({
    deck: state.deck, discard: state.discard, resolution: state.resolution,
    playerZones: Object.fromEntries(state.seatOrder.map(id => [id, {
      hand: state.players[id]!.hand, followers: state.players[id]!.followers,
      chants: state.players[id]!.chants, open: state.players[id]!.open,
      attachments: state.players[id]!.attachments,
    }])),
    status: state.players.A!.statuses,
  });
  state = act(state, 'A', { type: 'PASS_WITHDRAWAL' });
  expect(state.phase).toBe('turn-start');
  expect(state.turnSeat).toBe(1);
  expect({
    deck: state.deck, discard: state.discard, resolution: state.resolution,
    playerZones: Object.fromEntries(state.seatOrder.map(id => [id, {
      hand: state.players[id]!.hand, followers: state.players[id]!.followers,
      chants: state.players[id]!.chants, open: state.players[id]!.open,
      attachments: state.players[id]!.attachments,
    }])),
    status: state.players.A!.statuses,
  }).toEqual(beforeCompletion);
  expect(engine.viewFor(state, 'B').legalChoices).toContain('START_TURN');
});

it('blocks stopped approach initiation and advertises only the action-phase pass', () => {
  const state = ready();
  const advance = handCard(state, 'A', '踏み込み／弓');
  state.players.A!.statuses = [{ id: 'stop', kind: 'stopped', modifiers: [-1], nextCheck: 1 }];
  expect(engine.viewFor(state, 'A').legalChoices).toEqual(['REVEAL_CHARACTER', 'PASS_ACTION']);

  const snapshot = JSON.stringify(state);
  expect(engine.transition(state, {
    actorId: 'A',
    command: { type: 'APPROACH', targetId: 'B', cardInstanceId: advance },
  }, entropy())).toEqual({ ok: false, code: 'STOPPED' });
  expect(JSON.stringify(state)).toBe(snapshot);
  expect(state.players.A!.hand).toContain(advance);

  const beforeCompletion = structuredClone({ hand: state.players.A!.hand, discard: state.discard, status: state.players.A!.statuses });
  const completed = act(state, 'A', { type: 'PASS_ACTION' });
  expect(completed.phase).toBe('turn-start');
  expect(completed.turnSeat).toBe(1);
  expect({ hand: completed.players.A!.hand, discard: completed.discard, status: completed.players.A!.statuses }).toEqual(beforeCompletion);
});

it('lets a restored stopped hand-adjustment state validate END_TURN and advance without refilling', () => {
  const state = ready();
  state.phase = 'hand-adjustment';
  state.players.A!.statuses = [{ id: 'stop', kind: 'stopped', modifiers: [-1], nextCheck: 1 }];
  state.discard.push(...state.players.A!.hand.splice(2));
  expect(state.players.A!.hand).toHaveLength(2);

  const snapshot = JSON.stringify(state);
  expect(engine.transition(state, {
    actorId: 'B', command: { type: 'END_TURN', discardIds: [] },
  }, entropy())).toEqual({ ok: false, code: 'NOT_YOUR_TURN' });
  const wrongPhase = structuredClone(state);
  wrongPhase.phase = 'action';
  expect(engine.transition(wrongPhase, {
    actorId: 'A', command: { type: 'END_TURN', discardIds: [] },
  }, entropy())).toEqual({ ok: false, code: 'WRONG_PHASE' });
  expect(engine.transition(state, {
    actorId: 'A', command: { type: 'END_TURN', discardIds: [state.players.A!.hand[0]!] },
  }, entropy())).toEqual({ ok: false, code: 'INVALID_DISCARD' });
  expect(JSON.stringify(state)).toBe(snapshot);

  const completed = act(state, 'A', { type: 'END_TURN', discardIds: [] });
  expect(completed.phase).toBe('turn-start');
  expect(completed.turnSeat).toBe(1);
  expect(completed.players.A!.hand).toEqual(state.players.A!.hand);
  expect(completed.discard).toEqual(state.discard);
  expect(completed.players.A!.statuses).toEqual(state.players.A!.statuses);

  const overfull = ready();
  overfull.phase = 'hand-adjustment';
  overfull.players.A!.statuses = [{ id: 'stop', kind: 'stopped', modifiers: [-1], nextCheck: 1 }];
  const requiredDiscard = overfull.deck.pop()!;
  overfull.players.A!.hand.push(requiredDiscard);
  const discarded = act(overfull, 'A', { type: 'END_TURN', discardIds: [requiredDiscard] });
  expect(discarded.phase).toBe('turn-start');
  expect(discarded.turnSeat).toBe(1);
  expect(discarded.players.A!.hand).toEqual(overfull.players.A!.hand.filter(id => id !== requiredDiscard));
  expect(discarded.discard).toEqual([...overfull.discard, requiredDiscard]);
  expect(discarded.players.A!.statuses).toEqual(overfull.players.A!.statuses);
});

it('rejects only new magic chants while silenced and keeps warrior chants legal', () => {
  let state = ready();
  state.players.A!.statuses = [{ id: 'silence', kind: 'silenced', modifiers: [-2, -1], nextCheck: 1 }];
  const magic = handCard(state, 'A', '天舞');
  expect(engine.viewFor(state, 'A').legalChoices).toContain('CHANT');
  const snapshot = JSON.stringify(state);
  expect(engine.transition(state, {
    actorId: 'A',
    command: { type: 'CHANT', cardInstanceId: magic, dedicated: false },
  }, entropy())).toEqual({ ok: false, code: 'SILENCED' });
  expect(JSON.stringify(state)).toBe(snapshot);
  expect(state.players.A!.hand).toContain(magic);

  state = ready();
  state.players.A!.statuses = [{ id: 'silence', kind: 'silenced', modifiers: [-2, -1], nextCheck: 1 }];
  const warrior = handCard(state, 'A', '天地百撃斬');
  state = act(state, 'A', { type: 'CHANT', cardInstanceId: warrior, dedicated: false });
  expect(state.players.A!.chants).toContainEqual({ cardInstanceId: warrior, revealed: false });
  expect(state.phase).toBe('hand-adjustment');
});

it('applies one resistance roll, one failure addition, and one status to a shared multi-hit target', () => {
  let state = ready();
  character(state, 'A', '侍大将のシン');
  const attack = handCard(state, 'A', '天地百撃斬');
  moveToChant(state, 'A', attack);
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: true });
  state = until(state, 'damage');
  state = closeWindow(state, [2]);
  state = closeWindow(state);
  state = until(state, 'normal-defense');

  const group = Object.values(state.groups!)[0]!;
  const target = group.targets[0]!;
  expect(target.hits).toHaveLength(2);
  // Construct the cross-feature precondition explicitly: no printed Task 7e status card is multi-hit.
  group.technique.onHitResistance = { modifiers: [-2, -1], failureDamage: 6, statusKind: 'stopped' };
  const baseDamage = target.hits.reduce((total, hit) => total + (hit.damage ?? 0), 0);

  state = until(state, 'hit');
  state = closeWindow(state);
  while (state.windows?.at(-1)?.kind === 'hit-abilities') state = closeWindow(state);
  expect(engine.viewFor(state, 'B').currentRoll).toMatchObject({ purpose: 'status-resistance', modifier: -2 });
  state = closeWindow(state, [6, 6]);
  state = closeWindow(state);
  state = finish(state);

  expect(state.rolls!.filter(roll => roll.purpose === 'status-resistance')).toHaveLength(1);
  expect(state.players.B!.damage).toBe(baseDamage + 6);
  expect(state.players.B!.statuses).toEqual([
    expect.objectContaining({ kind: 'stopped', sourceActorId: 'A', sourceCardInstanceId: attack, targetId: 'B' }),
  ]);
});
