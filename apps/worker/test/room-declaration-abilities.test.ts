import { expect, it } from 'vitest';
import { allCardInstanceIds, viewFor } from '@madou/engine';
import { getAction } from '@madou/catalog';
import { declarationScenarioNames, declarationScenarioSpecs, makeDeclarationScenario } from './fixtures/declaration-scenarios.js';
import { transition, type GameCommand, type GameState } from '@madou/engine';
import type { DeclarationScenarioName } from './fixtures/declaration-scenarios.js';
import { entropy } from './fixtures/scenario-tools.js';
import { reset } from 'cloudflare:test';
import { afterEach } from 'vitest';
import { activeWindowRef } from '@madou/engine';
import { openTestRoom } from './fixtures/recovery-room.js';

it.each(declarationScenarioNames)('%s starts before the new declaration selection with canonical source prerequisites', name => {
  const game = makeDeclarationScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const spec = declarationScenarioSpecs[name];
  const defense = 'defense' in spec && spec.defense;
  const owner = defense ? 'B' : 'A';
  const player = game.players[owner]!;
  const chanted = 'chanted' in spec && spec.chanted;
  const source = (chanted ? player.chants.map(chant => chant.cardInstanceId) : 'placed' in spec && spec.placed ? player.followers.map(follower => follower.cardInstanceId) : player.hand).find(id => getAction(id)?.name === spec.card);
  expect(source).toBeTruthy();
  expect(game.discard).not.toContain(source);
  if (defense) {
    expect(viewFor(game, owner).activeWindow).toMatchObject({ kind: 'normal-defense', pendingActorId: owner });
    expect(viewFor(game, owner).currentAttack!.technique).toMatchObject({ effectLevel: 5, damage: 6 });
  } else {
    expect(game.phase).toBe('action');
    expect(game.seatOrder[game.turnSeat]).toBe(owner);
    expect(game.windows ?? []).toEqual([]);
  }
  if ('vanmil' in spec && spec.vanmil) {
    expect(player.characterId).toBe('c2-p07-r1c2');
    expect(player.damage).toBe(0);
    expect(player.abilityCharacterIds ?? []).not.toContain('c2-p05-r1c1');
    expect(game.discard.filter(id => id === 'a2-p05-r1c1')).toHaveLength(1);
  }
  const ids = allCardInstanceIds(game);
  expect(ids).toHaveLength(220);
  expect(new Set(ids).size).toBe(220);
});


const wholeCases = [
  { scenario: 'declare-shelim-waive', ids: ['c2-p01-r1c1-ab03'], targets: ['B'], effect: 7, damage: 10 },
  { scenario: 'declare-shelim-all', ids: ['c2-p01-r1c1-ab04'], targets: ['B', 'C'], effect: 7, damage: 10 },
  { scenario: 'declare-gil-range', ids: ['c2-p01-r1c2-ab03'], targets: ['B'], effect: 4, damage: 38 },
  { scenario: 'declare-gil-counter', ids: ['c2-p01-r1c2-ab01', 'c2-p01-r1c2-ab03'], targets: ['A'], effect: 6, damage: 6 },
  { scenario: 'declare-shin-waive', ids: ['c2-p01-r2c1-ab02'], targets: ['B'], effect: 7, damage: 12 },
  { scenario: 'declare-shin-counter', ids: ['c2-p01-r2c1-ab01'], targets: ['A'], effect: 6, damage: 10 },
  { scenario: 'declare-shin-both', ids: ['c2-p01-r2c1-ab01', 'c2-p01-r2c1-ab02'], targets: ['A'], effect: 7, damage: 12 },
  { scenario: 'declare-fury-element', ids: ['c2-p02-r1c2-ab04'], targets: ['B'], effect: 8, damage: 15 },
  { scenario: 'declare-garwin-sword', ids: ['c2-p05-r2c1-ab03'], targets: ['B'], effect: 5, damage: 7 },
  { scenario: 'declare-garwin-all', ids: ['c2-p05-r2c1-ab04'], targets: ['B', 'C'], effect: 7, damage: 12 },
  { scenario: 'declare-garwin-follower-hand', ids: ['c2-p05-r2c1-ab03'], targets: ['B'], effect: 6, damage: 14 },
  { scenario: 'declare-garwin-follower-placed', ids: ['c2-p05-r2c1-ab03'], targets: ['B'], effect: 6, damage: 14 },
  { scenario: 'declare-gainas-waive', ids: ['c2-p05-r2c2-ab03'], targets: ['B'], effect: 7, damage: 12 },
  { scenario: 'declare-gainas-all', ids: ['c2-p05-r2c2-ab04'], targets: ['B', 'C'], effect: 6, damage: 10 },
  { scenario: 'declare-yotsurm', ids: ['c2-p06-r2c2-ab02'], targets: ['B'], effect: 8, damage: 7 },
  { scenario: 'declare-vanmil-warrior', ids: ['c2-p07-r1c2-ab02'], targets: ['B', 'C'], effect: 7, damage: 24 },
  { scenario: 'declare-vanmil-magic', ids: ['c2-p07-r1c2-ab02'], targets: ['B', 'C'], effect: 10, damage: 15 },
  { scenario: 'declare-vanmil-null', ids: ['c2-p07-r1c2-ab02'], targets: ['B', 'C'], effect: 10, damage: null },
] satisfies { scenario: DeclarationScenarioName; ids: string[]; targets: string[]; effect: number; damage: number | null }[];
function fixture(name: DeclarationScenarioName) {
  let game = makeDeclarationScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const spec = declarationScenarioSpecs[name];
  const defense = 'defense' in spec && spec.defense;
  const owner = defense ? 'B' : 'A';
  const held = game.players[owner]!;
  const source = [...held.hand, ...held.chants.map(card => card.cardInstanceId), ...held.followers.map(card => card.cardInstanceId)].find(id => getAction(id)?.name === spec.card)!;
  function act(actorId: string, command: GameCommand, dice = Array(100).fill(1)) {
    const input = { actorId, command };
    const random = { ...entropy(), dice };
    const result = transition(game, input, random);
    expect(result.ok, JSON.stringify({ input, result: result.ok ? 'ok' : result })).toBe(true);
    if (!result.ok) throw Error(result.code);
    expect(transition(JSON.parse(JSON.stringify(game)), input, random)).toEqual(result);
    game = result.state;
    const ids = allCardInstanceIds(game);
    expect(ids).toHaveLength(220);
    expect(new Set(ids).size).toBe(220);
  }
  function until(done: (state: GameState) => boolean, dice?: number[]) {
    for (let i = 0; i < 1000; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1);
      if (!window) throw Error('DECLARATION_TEST_NO_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' }, dice);
    }
    throw Error('DECLARATION_TEST_NOT_READY');
  }
  function declare(ids: string[], targets = ['B']) {
    const dedicated = getAction(source)?.category === 'follower';
    const command: GameCommand = defense ? { type: 'PLAY_DEFENSE', cardInstanceId: source, dedicated, declarationAbilityIds: ids }
      : { type: 'ATTACK', cardInstanceId: source, dedicated, targetIds: targets, declarationAbilityIds: ids };
    act(owner, command);
    return Object.values(game.actions!).find(action => action.actorId === owner && action.cardInstanceId === source && action.stage === 'declaration')!.id;
  }
  return { get game() { return game; }, source, owner, defense, act, until, declare };
}
function consumed(game: GameState, owner: string, source: string) {
  expect(game.discard.filter(id => id === source)).toHaveLength(1);
  expect(game.players[owner]!.hand).not.toContain(source);
  expect(game.players[owner]!.chants.map(card => card.cardInstanceId)).not.toContain(source);
  expect(game.players[owner]!.followers.map(card => card.cardInstanceId)).not.toContain(source);
}
it.each(wholeCases)('$scenario explicitly selects the whole source ability and commits exact values once', entry => {
  const f = fixture(entry.scenario);
  const actionId = f.declare(entry.ids, entry.targets);
  expect(viewFor(f.game, f.owner).declarationSelection?.abilities.map(ability => ability.abilityId).sort()).toEqual([...entry.ids].sort());
  for (const actor of ['A', 'B', 'C', 'D'].filter(actor => actor !== f.owner)) {
    expect(viewFor(f.game, actor).declarationSelection).toBeNull();
    if (!f.game.players[f.owner]!.revealed) for (const id of entry.ids) expect(JSON.stringify(viewFor(f.game, actor))).not.toContain(id);
  }
  f.until(state => !!state.groups && Object.values(state.groups).some(group => group.actionId === actionId));
  const action = f.game.actions![actionId]!;
  expect(action.technique).toMatchObject({ effectLevel: entry.effect, damage: entry.damage });
  if (f.defense) {
    // Actual original attacker Dia cannot use her mental defense against a converted return.
    expect(viewFor(f.game, 'A').abilityOptions.map(ability => ability.abilityId)).not.toContain('c2-p06-r1c2-ab01');
  }
  f.until(state => !state.windows?.length);
  for (const target of entry.targets) expect(f.game.players[target]!.damage).toBe(entry.damage ?? 0);
  if (f.defense) expect(f.game.players.B!.damage).toBe(0);
  consumed(f.game, f.owner, f.source);
});

it.each(wholeCases)('$scenario cancels a required selected ability and resumes with the original paid source', entry => {
  const f = fixture(entry.scenario);
  f.declare(entry.ids, entry.targets);
  const canceled = entry.ids[0]!;
  f.until(state => viewFor(state, f.owner).declarationSelection?.abilities.some(ability => ability.abilityId === canceled && ability.status === 'resolving') === true);
  const frame = viewFor(f.game, 'D').reactionTargetAbilityId!;
  expect(frame).toBeTruthy();
  f.until(state => viewFor(state, 'D').activeWindow?.pendingActorId === 'D');
  const fate = f.game.players.D!.hand.find(id => getAction(id)?.name === '命運凶変')!;
  f.act('D', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel-ability', targetAbilityId: frame });
  f.until(state => !state.windows?.length);
  expect(f.game.players.A!.damage).toBe(0);
  expect(f.game.players.B!.damage).toBe(f.defense ? 6 : entry.scenario === 'declare-yotsurm' ? 6 : 0);
  expect(f.game.players.C!.damage).toBe(0);
  expect(f.game.discard.filter(id => id === fate)).toHaveLength(1);
  consumed(f.game, f.owner, f.source);
});
it.each([
  { scenario: 'declare-shelim-hidden-all', id: 'c2-p01-r1c1-ab04' },
  { scenario: 'declare-garwin-unchanted-all', id: 'c2-p05-r2c1-ab04' },
  { scenario: 'declare-gainas-below', id: 'c2-p05-r2c2-ab04' },
] as const)('$scenario rejects an unavailable declaration before paying any source', entry => {
  const f = fixture(entry.scenario);
  const before = structuredClone(f.game);
  const candidates = viewFor(f.game, f.owner).declarationCandidates.filter(candidate => candidate.choice.cardInstanceId === f.source && !candidate.choice.dedicated);
  expect(candidates.flatMap(candidate => candidate.abilities.map(ability => ability.abilityId))).not.toContain(entry.id);
  const result = transition(f.game, { actorId: f.owner, command: { type: 'ATTACK', cardInstanceId: f.source, targetIds: ['B', 'C'], dedicated: false, declarationAbilityIds: [entry.id] } }, entropy());
  expect(result.ok).toBe(false);
  expect(f.game).toEqual(before);
});

afterEach(async () => { await reset(); });

it.each([
  { scenario: 'declare-shelim-waive', ids: ['c2-p01-r1c1-ab03'], targets: ['B'], damage: 10 },
  { scenario: 'declare-shin-both', ids: ['c2-p01-r2c1-ab01', 'c2-p01-r2c1-ab02'], targets: ['A'], damage: 12 },
  { scenario: 'declare-vanmil-warrior', ids: ['c2-p07-r1c2-ab02'], targets: ['B', 'C'], damage: 24 },
] as const)('DO $scenario restores selection and replays the same paid declaration before and after completion', async entry => {
  const room = await openTestRoom(entry.scenario);
  const defense = entry.scenario === 'declare-shin-both';
  const owner = defense ? 'B' : 'A';
  const spec = declarationScenarioSpecs[entry.scenario];
  const source = room.initial.players[owner]!.hand.find(id => getAction(id)?.name === spec.card)!;
  const command: GameCommand = defense ? { type: 'PLAY_DEFENSE', cardInstanceId: source, dedicated: false, declarationAbilityIds: [...entry.ids] }
    : { type: 'ATTACK', cardInstanceId: source, dedicated: false, targetIds: [...entry.targets], declarationAbilityIds: [...entry.ids] };
  let sequence = 0;
  async function send(actorId: string, command: GameCommand) {
    const before = await room.stored();
    const envelope = { protocolVersion: 1 as const, commandId: `declaration-${sequence++}`, expectedRevision: before.revision, ...activeWindowRef(before.state.game!), command };
    const ack = await room.command(actorId, envelope);
    expect(ack).toMatchObject({ type: 'ack' });
    const ids = allCardInstanceIds((await room.stored()).state.game!);
    expect(ids.length).toBe(220);
    expect(new Set(ids).size).toBe(220);
    return { actorId, envelope, ack };
  }
  const receipt = await send(owner, command);
  const selected = (await room.snapshotFor(owner)).game!.declarationSelection;
  expect(selected?.abilities.map(ability => ability.abilityId)).toEqual([...entry.ids]);
  for (const actor of ['A', 'B', 'C', 'D'].filter(actor => actor !== owner)) expect((await room.snapshotFor(actor)).game!.declarationSelection).toBeNull();
  async function replay() {
    const before = await room.stored();
    await room.restart();
    expect(await room.command(receipt.actorId, receipt.envelope)).toEqual(receipt.ack);
    expect(await room.stored()).toEqual(before);
  }
  await replay();
  expect((await room.snapshotFor(owner)).game!.declarationSelection).toEqual(selected);
  for (let i = 0; i < 500; i++) {
    const game = (await room.stored()).state.game!;
    const window = game.windows?.at(-1);
    if (!window) break;
    await send(window.participants[window.cursor]!, { type: 'PASS' });
  }
  const done = (await room.stored()).state.game!;
  expect(done.windows ?? []).toEqual([]);
  for (const target of entry.targets) expect(done.players[target]!.damage).toBe(entry.damage);
  if (defense) expect(done.players.B!.damage).toBe(0);
  consumed(done, owner, source);
  await replay();
}, 15000); // Hundreds of real WS/storage operations share the full Worker pool.

it('Magic Gate uses an explicit whole declaration ability without changing the selected donor position', () => {
  const f = fixture('declare-shelim-gate');
  const donor = f.game.players.B!.followers[0]!.cardInstanceId;
  const candidate = viewFor(f.game, 'A').declarationCandidates.find(candidate => candidate.kind === 'turn-technique' && candidate.choice.cardInstanceId === f.source)!;
  expect(candidate.abilities).toContainEqual({ abilityId: 'c2-p01-r1c1-ab03', name: '大魔術師', effects: { waiveChant: true } });
  f.act('A', { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: f.source, dedicated: false, targetIds: ['B'],
    followerTransfer: { targetPosition: 0, destinationPosition: 0 }, declarationAbilityIds: ['c2-p01-r1c1-ab03'] });
  expect(viewFor(f.game, 'A').declarationSelection?.abilities.map(ability => ability.name)).toEqual(['大魔術師']);
  f.until(state => !state.windows?.length);
  expect(f.game.players.B!.followers).toEqual([]);
  expect(f.game.players.A!.followers[0]!.cardInstanceId).toBe(donor);
  consumed(f.game, 'A', f.source);
});
