import { allCardInstanceIds, createGame, transition, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

export const followerGroupScenarioNames = ['follower-group-upa', 'follower-group-dia', 'follower-group-grant-cancel', 'follower-group-source-cancel', 'follower-group-reflect', 'follower-group-water', 'follower-group-fairy'] as const;
export type FollowerGroupScenarioName = typeof followerGroupScenarioNames[number];
export function isFollowerGroupScenario(name: string): name is FollowerGroupScenarioName {
  return (followerGroupScenarioNames as readonly string[]).includes(name);
}
/** Prior ownership/training are explicit preconditions; the C10 ability is always an actual later command. */
export function makeFollowerGroupScenario(name: FollowerGroupScenarioName, players: { id: string; name: string }[]): GameState {
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy(); const result = transition(state, input, random);
    if (!result.ok) throw Error(`FOLLOWER_GROUP_FIXTURE_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(state)) as GameState, input, random))) throw Error('FOLLOWER_GROUP_FIXTURE_REPLAY');
    state = result.state;
    const ids = allCardInstanceIds(state); if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('FOLLOWER_GROUP_FIXTURE_CARDS');
  }
  for (const player of players) act(player.id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  const dia = name === 'follower-group-dia' || name === 'follower-group-reflect' || name === 'follower-group-fairy';
  assignCharacter(state, a, dia ? '魔聖母ディア' : '獣使いのウパニシャット');
  assignCharacter(state, b, 'リーア姫'); assignCharacter(state, c, '不死王ガドューラ'); assignCharacter(state, d, '侍大将のシン');
  for (const player of Object.values(state.players)) player.permanent = { spirit: 12, endurance: 50 };
  if (dia && name !== 'follower-group-fairy') state.players[a]!.permanent!.warrior_level = 4;
  state.distances[a]![b] = state.distances[b]![a] = 'near';
  state.distances[a]![d] = state.distances[d]![a] = 'near';
  function place(owner: string, cardName: string) {
    const id = takeCard(state, owner, cardName);
    state.players[owner]!.hand = state.players[owner]!.hand.filter(card => card !== id);
    state.players[owner]!.followers.push({ cardInstanceId: id, revealed: false });
    return id;
  }
  if (dia) {
    place(a, name === 'follower-group-reflect' ? '兵士' : name === 'follower-group-fairy' ? '聖騎士団' : '小人族');
    const magic = takeCard(state, a, name === 'follower-group-fairy' ? '妖精族' : '闇の聖女'); trimHand(state, a, magic);
    if (name !== 'follower-group-fairy') place(b, name === 'follower-group-reflect' ? '王立騎士団' : 'スケルトン');
  } else {
    place(a, 'グリフォン');
    const dragon = takeCard(state, a, name === 'follower-group-water' ? '水竜' : '炎竜'); trimHand(state, a, dragon);
    if (name === 'follower-group-upa') place(b, '小人族');
  }
  if (name === 'follower-group-grant-cancel' || name === 'follower-group-source-cancel') {
    const fate = takeCard(state, b, '命運凶変'); trimHand(state, b, fate);
  }
  state.events = [];
  const ids = allCardInstanceIds(state); if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('FOLLOWER_GROUP_FIXTURE_OWNERSHIP');
  return state;
}
