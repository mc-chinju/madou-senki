import { allCardInstanceIds, createGame, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

export const followerAttackScenarioNames = ['follower-attack-royal', 'follower-attack-cancel', 'follower-attack-griffin', 'follower-attack-fairy', 'follower-attack-dwarves', 'follower-attack-all', 'follower-attack-beast'] as const;
export type FollowerAttackScenarioName = typeof followerAttackScenarioNames[number];
export function isFollowerAttackScenario(name: string): name is FollowerAttackScenarioName {
  return (followerAttackScenarioNames as readonly string[]).includes(name);
}
export function makeFollowerAttackScenario(name: FollowerAttackScenarioName, players: { id: string; name: string }[]): GameState {
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy(); const result = transition(state, input, random);
    if (!result.ok) throw Error(`FOLLOWER_ATTACK_FIXTURE_${name}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(state)) as GameState, input, random))) throw Error('FOLLOWER_ATTACK_FIXTURE_REPLAY');
    state = result.state; const ids = allCardInstanceIds(state);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('FOLLOWER_ATTACK_FIXTURE_CARDS');
  }
  for (const player of players) act(player.id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  const character = name === 'follower-attack-griffin' || name === 'follower-attack-beast' ? '獣使いのウパニシャット'
    : name === 'follower-attack-fairy' ? '妖精王フューリー' : name === 'follower-attack-dwarves' ? '小人のランバ' : 'リーア姫';
  assignCharacter(state, a, character); assignCharacter(state, b, '魔導王ガイナス');
  assignCharacter(state, c, '白魔術師シェリム'); assignCharacter(state, d, '黒騎士ガーウィン');
  // Prior ownership/training are fixture preconditions; every attack below is a real accepted command.
  state.players[a]!.permanent = { spirit: 12 };
  state.players[b]!.permanent = { endurance: 40 }; state.players[d]!.permanent = { endurance: 40 };
  state.distances[a]![b] = state.distances[b]![a] = 'near';
  const sourceName = name === 'follower-attack-griffin' || name === 'follower-attack-beast' ? 'グリフォン'
    : name === 'follower-attack-fairy' ? '妖精族' : name === 'follower-attack-dwarves' ? '小人族'
      : name === 'follower-attack-all' ? '守護者' : '王立騎士団';
  const source = takeCard(state, a, sourceName);
  if (name !== 'follower-attack-fairy' && name !== 'follower-attack-all') {
    state.players[a]!.hand = state.players[a]!.hand.filter(id => id !== source);
    state.players[a]!.followers.push({ cardInstanceId: source, revealed: false });
  }
  if (name === 'follower-attack-beast') { const beast = takeCard(state, a, '獣王剣'); trimHand(state, a, beast); }
  if (name === 'follower-attack-all') state.players[c]!.revealed = true;
  state.events = [];
  if (name === 'follower-attack-cancel') {
    const fate = takeCard(state, b, '命運凶変'); trimHand(state, b, fate);
    act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b], dedicated: true });
    for (let i = 0; i < 200; i++) {
      const own = viewFor(state, b);
      if (own.reactionTargetActionId && own.activeWindow?.pendingActorId === b) return state;
      const window = state.windows?.at(-1); if (!window) throw Error('FOLLOWER_ATTACK_FIXTURE_NO_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('FOLLOWER_ATTACK_FIXTURE_DID_NOT_CONVERGE');
  }
  return state;
}
