import { allCardInstanceIds, createGame, derivedStats, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand, readySetup } from './scenario-tools.js';

export const lifecycleScenarioNames = ['death-gift', 'lifecycle-finish', 'lifecycle-stalemate', 'fusen-revival', 'lifecycle-transform', 'lifecycle-transform-hidden', 'ritual-transfer', 'ritual-use'] as const;
export type LifecycleScenarioName = typeof lifecycleScenarioNames[number];
export function isLifecycleScenario(name: string): name is LifecycleScenarioName {
  return (lifecycleScenarioNames as readonly string[]).includes(name);
}

/** Source preconditions are seeded; all death, OPEN, revival and outcome boundaries use actual transitions. */
export function makeLifecycleScenario(name: LifecycleScenarioName, players: { id: string; name: string }[]): GameState {
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  const act = (actorId: string, command: GameCommand) => {
    const outcome = transition(state, { actorId, command }, entropy());
    if (!outcome.ok) throw Error(`LIFECYCLE_FIXTURE_${outcome.code}`);
    state = outcome.state;
    if (allCardInstanceIds(state).length !== 220 || new Set(allCardInstanceIds(state)).size !== 220) throw Error('FIXTURE_CARD_CONSERVATION');
  };
  const passUntil = (done: () => boolean) => {
    for (let i = 0; i < 400; i++) {
      if (done()) return;
      const window = state.windows?.at(-1);
      if (!window) throw Error('LIFECYCLE_FIXTURE_MISSING_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('LIFECYCLE_FIXTURE_DID_NOT_CONVERGE');
  };
  readySetup(()=>state,id=>act(id,{type:'PASS_SETUP'}));
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  assignCharacter(state, a, '侍大将のシン'); assignCharacter(state, b, '黒騎士ガーウィン');
  assignCharacter(state, c, '白魔術師シェリム');
  assignCharacter(state, d, name === 'lifecycle-finish' ? '妖精王フューリー' : '魔導王ガイナス');
  state.events = [];

  if (name === 'lifecycle-stalemate') {
    assignCharacter(state, a, '小妖精のチャム'); assignCharacter(state, b, 'リーア姫');
    assignCharacter(state, c, '魔導王ガイナス'); assignCharacter(state, d, '黒騎士ガーウィン');
    state.players[b]!.presence = 'otherworld'; state.players[c]!.presence = 'otherworld';
    // Seed the prior simultaneous damage; real transition opens and settles both death windows.
    state.players[a]!.damage = derivedStats(state.players[a]!).endurance;
    state.players[d]!.damage = derivedStats(state.players[d]!).endurance;
    state.events = [];
    act(a, { type: 'PASS_ACTION' });
    return state;
  }

  if (name === 'lifecycle-transform' || name === 'lifecycle-transform-hidden') {
    assignCharacter(state, a, '聖騎士ランスロット'); assignCharacter(state, b, 'リーア姫');
    state.players[a]!.revealed = name === 'lifecycle-transform';
    takeCard(state, a, '踏み込み／弓');
    return state;
  }
  if (name === 'ritual-use') {
    if (players.length !== 5) throw Error('LIFECYCLE_FIXTURE_NEEDS_FIVE');
    assignCharacter(state, a, '邪祭ウーノス'); assignCharacter(state, b, '魔聖母ディア');
    assignCharacter(state, c, '占星術師のアルセイル'); assignCharacter(state, d, '侍大将のシン');
    assignCharacter(state, players[4]!.id, '魔導王ガイナス');
    takeCard(state, a, '復活の儀式');
    state.players[a]!.damage = 7;
    return state;
  }
  if (name === 'ritual-transfer') {
    assignCharacter(state, a, '魔聖母ディア'); assignCharacter(state, b, '邪祭ウーノス');
    assignCharacter(state, c, 'リーア姫');
    state.players[b]!.revealed = true;
    takeCard(state, a, '復活の儀式');
    return state;
  }

  const attack = takeCard(state, a, '踏み込み／弓');
  takeCard(state, a, '命運凶変');
  takeCard(state, b, '「これで勝ったと思うなよ」');
  takeCard(state, b, '必勝の祈り');
  state.players[b]!.damage = derivedStats(state.players[b]!).endurance - 1;
  state.events = [];
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: false });
  passUntil(() => viewFor(state, b).lifecycleDecision?.kind === 'death-gift' &&
    viewFor(state, b).activeWindow?.pendingActorId === b);
  if (name !== 'fusen-revival') return state;

  passUntil(() => state.players[b]!.presence === 'dead' && !state.windows?.length);
  if (state.outcome) throw Error('LIFECYCLE_FIXTURE_PREMATURE_FINISH');
  // Stack the next draw only after the attack and its children are fully resolved.
  trimHand(state, a);
  act(a, { type: 'PASS_WITHDRAWAL' });
  act(a, { type: 'END_TURN', discardIds: [] });
  if (state.seatOrder[state.turnSeat] !== c) throw Error('LIFECYCLE_FIXTURE_DEAD_TURN_NOT_SKIPPED');
  const follower = takeCard(state, c, '兵士');
  state.players[c]!.hand = state.players[c]!.hand.filter(id => id !== follower);
  state.deck.unshift(follower);
  const fusen = takeCard(state, c, 'a2-p01-r1c1');
  state.players[c]!.hand = state.players[c]!.hand.filter(id => id !== fusen);
  state.deck.unshift(fusen);
  act(c, { type: 'START_TURN' }); act(c, { type: 'CHOOSE_DRAW', draw: true });
  passUntil(() => viewFor(state, c).currentRoll?.purpose === 'revival' && viewFor(state, c).currentRoll?.stage === 'after-roll');
  return state;
}
