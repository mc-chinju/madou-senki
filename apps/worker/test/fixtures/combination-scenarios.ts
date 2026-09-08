import { allCardInstanceIds, createGame, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

export const combinationScenarioNames = ['combination-defense', 'combination-ready', 'combination-cancel', 'combination-advances', 'combination-hit-advance', 'combination-double', 'combination-critical', 'combination-shadow', 'combination-lia', 'combination-blast'] as const;
export type CombinationScenarioName = typeof combinationScenarioNames[number];
export function isCombinationScenario(name: string): name is CombinationScenarioName {
  return (combinationScenarioNames as readonly string[]).includes(name);
}
export function makeCombinationScenario(name: CombinationScenarioName, players: { id: string; name: string }[]): GameState {
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand, dice = entropy().dice) {
    const input = { actorId, command }; const random = { ...entropy(), dice };
    const result = transition(state, input, random);
    if (!result.ok) throw Error(`COMBINATION_FIXTURE_${name}_${result.code}`);
    const replay = transition(JSON.parse(JSON.stringify(state)) as GameState, input, random);
    if (JSON.stringify(result) !== JSON.stringify(replay)) throw Error('COMBINATION_FIXTURE_REPLAY');
    state = result.state;
    const ids = allCardInstanceIds(state);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('COMBINATION_FIXTURE_CARDS');
  }
  function passUntil(done: () => boolean, dice = entropy().dice) {
    for (let step = 0; step < 500; step++) {
      if (done()) return;
      const window = state.windows?.at(-1);
      if (!window) throw Error(`COMBINATION_FIXTURE_MISSING_WINDOW_${name}`);
      act(window.participants[window.cursor]!, { type: 'PASS' }, dice);
    }
    throw Error(`COMBINATION_FIXTURE_DID_NOT_CONVERGE_${name}`);
  }
  function chant(owner: string, source: string) {
    const id = takeCard(state, owner, source);
    state.players[owner]!.hand = state.players[owner]!.hand.filter(card => card !== id);
    state.players[owner]!.chants.push({ cardInstanceId: id, revealed: false });
    return id;
  }
  for (const player of players) act(player.id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  assignCharacter(state, a, '黒騎士ガーウィン'); assignCharacter(state, b, '魔導王ガイナス');
  assignCharacter(state, c, '白魔術師シェリム'); assignCharacter(state, d, '占星術師のアルセイル');
  state.events = [];
  state.distances[a]![b] = state.distances[b]![a] = 'near';
  if (name === 'combination-defense') {
    assignCharacter(state, b, '獣使いのウパニシャット');
    state.players[b]!.permanent = { spirit: 6 };
    const source = takeCard(state, a, '踏み込み／弓');
    takeCard(state, b, '獣王剣'); takeCard(state, b, '手裏剣');
    act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b], dedicated: false });
    passUntil(() => viewFor(state, b).activeWindow?.kind === 'normal-defense');
    return state;
  }
  if (name === 'combination-ready' || name === 'combination-cancel') {
    assignCharacter(state, a, '獣使いのウパニシャット');
    const source = takeCard(state, a, '獣王剣');
    const coSource = takeCard(state, a, '踏み込み／弓');
    trimHand(state, a, source, coSource);
    if (name === 'combination-ready') return state;
    const fate = takeCard(state, b, '命運凶変'); trimHand(state, b, fate);
    act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b], dedicated: true, coSource: { cardInstanceId: coSource, dedicated: false } });
    passUntil(() => viewFor(state, b).reactionTargetActionId !== null && viewFor(state, b).activeWindow?.pendingActorId === b);
    return state;
  }
  if (name === 'combination-advances') {
    const source = takeCard(state, a, '魔空剣');
    const cost = takeCard(state, a, 'a2-p23-r1c2'); trimHand(state, a, source, cost);
    return state;
  }
  if (name === 'combination-hit-advance') {
    assignCharacter(state, a, '黒妖精のアーネス');
    const source = chant(a, '黒翼天翔剣');
    takeCard(state, a, 'a2-p23-r1c2');
    act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b], dedicated: true });
    passUntil(() => viewFor(state, a).techniqueDecision?.kind === 'hit-advance');
    return state;
  }
  if (name === 'combination-double') {
    const source = takeCard(state, a, '黒竜剣');
    act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b], dedicated: true });
    passUntil(() => viewFor(state, a).techniqueDecision?.kind === 'damage-double');
    return state;
  }
  if (name === 'combination-critical') {
    assignCharacter(state, a, '忍びのイダ');
    const source = takeCard(state, a, '裏天空剣');
    act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b], dedicated: true });
    passUntil(() => viewFor(state, a).abilityOptions.some(option => option.abilityId === 'c2-p04-r2c2-ab03'));
    const option = viewFor(state, a).abilityOptions.find(item => item.abilityId === 'c2-p04-r2c2-ab03')!;
    act(a, { type: 'USE_ABILITY', abilityId: option.abilityId, targetEventId: option.targetEventId });
    // First attempt is a real saved non-consecutive roll; browser chooses the second attempt.
    passUntil(() => viewFor(state, a).abilityOptions.some(item => item.abilityId === option.abilityId), Array.from({ length: 100 }, (_, i) => i % 2 ? 4 : 2));
    return state;
  }
  if (name === 'combination-shadow') {
    assignCharacter(state, a, '黒妖精のアーネス'); assignCharacter(state, b, '忍びのイダ');
    // Prior training guarantees the printed defense's ordinary use checks, not its result.
    state.players[b]!.permanent = { spirit: 6 };
    state.distances[a]![b] = state.distances[b]![a] = 'far';
    const source = takeCard(state, a, '踏み込み／弓');
    takeCard(state, b, '影分身'); takeCard(state, b, '黒翼飛翔剣'); takeCard(state, b, '裏天空剣');
    act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b], dedicated: false });
    passUntil(() => viewFor(state, b).activeWindow?.kind === 'normal-defense');
    return state;
  }
  if (name === 'combination-lia') {
    assignCharacter(state, c, 'リーア姫');
    state.players[c]!.permanent = { spirit: 6 };
    takeCard(state, c, '光王陣');
    const source = takeCard(state, a, '魔空剣');
    act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b, d], dedicated: true });
    passUntil(() => viewFor(state, c).groupDefenseOptions.length > 0);
    return state;
  }
  assignCharacter(state, a, '魔導王ガイナス');
  // Prior endurance training keeps the target alive even when the fixed-6 resistance fails.
  state.players[b]!.permanent = { endurance: 40 };
  const source = takeCard(state, a, '竜王爆砕剣');
  act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b], dedicated: true });
  passUntil(() => viewFor(state, b).activeWindow?.kind === 'normal-defense');
  return state;
}
