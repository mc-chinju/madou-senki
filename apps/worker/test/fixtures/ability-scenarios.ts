import { allCardInstanceIds, createGame, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

export const abilityScenarioNames = ['ability-hide', 'ability-hidden-cancel', 'ability-martial', 'ability-critical', 'ability-critical-roll', 'ability-shadow'] as const;
export type AbilityScenarioName = typeof abilityScenarioNames[number];
export function isAbilityScenario(name: string): name is AbilityScenarioName { return (abilityScenarioNames as readonly string[]).includes(name); }
export function makeAbilityScenario(name: AbilityScenarioName, players: { id: string; name: string }[]): GameState {
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  const act = (actorId: string, command: GameCommand, dice = entropy().dice) => {
    const input = { actorId, command }; const random = { ...entropy(), dice };
    const result = transition(state, input, random);
    if (!result.ok) throw Error(`ABILITY_FIXTURE_${result.code}`);
    const replay = transition(JSON.parse(JSON.stringify(state)) as GameState, input, random);
    if (JSON.stringify(result) !== JSON.stringify(replay)) throw Error('ABILITY_FIXTURE_REPLAY');
    state = result.state;
    const ids = allCardInstanceIds(state);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('ABILITY_FIXTURE_CARDS');
  };
  const passUntil = (done: () => boolean, dice = entropy().dice) => {
    for (let i = 0; i < 500; i++) {
      if (done()) return;
      const w = state.windows?.at(-1); if (!w) throw Error('ABILITY_FIXTURE_MISSING_WINDOW');
      act(w.participants[w.cursor]!, { type: 'PASS' }, dice);
    }
    throw Error('ABILITY_FIXTURE_DID_NOT_CONVERGE');
  };
  for (const player of players) act(player.id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  assignCharacter(state, a, '忍びのイダ'); assignCharacter(state, b, '黒騎士ガーウィン');
  assignCharacter(state, c, '白魔術師シェリム'); assignCharacter(state, d, '魔導王ガイナス');
  state.events = [];
  if (name === 'ability-hide' || name === 'ability-hidden-cancel') {
    const cost = takeCard(state, a, 'a2-p07-r3c1'); trimHand(state, a, cost);
    state.players[a]!.damage = 5; state.players[a]!.revealed = name === 'ability-hide';
    if (name === 'ability-hide') return state;
    const fate = takeCard(state, b, '命運凶変'); trimHand(state, b, fate);
    const option = viewFor(state, a).abilityOptions.find(item => item.abilityId === 'c2-p04-r2c2-ab04');
    if (!option) throw Error('ABILITY_FIXTURE_NO_HIDE');
    act(a, { type: 'USE_ABILITY', abilityId: option.abilityId, targetEventId: option.targetEventId, costCardInstanceId: cost, conceal: false });
    passUntil(() => viewFor(state, b).reactionTargetAbilityId !== null && viewFor(state, b).activeWindow?.pendingActorId === b);
    return state;
  }
  if (name === 'ability-shadow') {
    assignCharacter(state, a, '黒妖精のアーネス'); assignCharacter(state, b, '忍びのイダ');
    // Prior stat drain and training make both future checks deterministic, not a seeded ability result.
    state.players[a]!.statuses = [{ id: 'prior-soul-drain', kind: 'stat-drain', timing: 'until-death', amount: 8 }];
    state.players[b]!.permanent = { spirit: 6 };
    const attack = takeCard(state, a, '黒翼飛翔剣'); takeCard(state, b, '踏み込み／弓');
    act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: true });
    passUntil(() => viewFor(state, b).activeWindow?.kind === 'normal-defense');
    return state;
  }
  const attack = takeCard(state, a, name === 'ability-martial' ? '踏み込み／殴る' : '踏み込み／弓');
  takeCard(state, a, '神性介入');
  if (name === 'ability-martial') {
    state.distances[a]![b] = state.distances[b]![a] = 'near';
    const follower = takeCard(state, b, '兵士'); state.players[b]!.hand = state.players[b]!.hand.filter(id => id !== follower);
    state.players[b]!.followers.push({ cardInstanceId: follower, revealed: false });
  }
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: false });
  const abilityId = name === 'ability-martial' ? 'c2-p04-r2c2-ab02' : 'c2-p04-r2c2-ab03';
  passUntil(() => viewFor(state, a).abilityOptions.some(option => option.abilityId === abilityId));
  if (name === 'ability-critical-roll') {
    const option = viewFor(state, a).abilityOptions.find(item => item.abilityId === abilityId)!;
    act(a, { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId });
    passUntil(() => viewFor(state, a).currentRoll?.purpose === 'ability-value' && viewFor(state, a).currentRoll?.stage === 'after-roll', Array.from({ length: 100 }, (_, i) => i % 2 ? 3 : 2));
  }
  return state;
}
