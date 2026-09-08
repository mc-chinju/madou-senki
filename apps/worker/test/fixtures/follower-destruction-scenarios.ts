import { allCardInstanceIds, createGame, transition, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

export const followerDestructionScenarioNames = ['destroy-lancaster', 'destroy-lancelot', 'destroy-asfelt', 'destroy-asfelt-blessing', 'destroy-frenzy'] as const;
export type FollowerDestructionScenarioName = typeof followerDestructionScenarioNames[number];
export function isFollowerDestructionScenario(name: string): name is FollowerDestructionScenarioName {
  return (followerDestructionScenarioNames as readonly string[]).includes(name);
}
const characters: Record<FollowerDestructionScenarioName, string> = {
  'destroy-lancaster': '早駆けのランカスター', 'destroy-lancelot': '聖騎士ランスロット',
  'destroy-asfelt': '竜皇子アスフェルト', 'destroy-asfelt-blessing': '竜皇子アスフェルト', 'destroy-frenzy': '不死王ガドューラ',
};
/** Historical ownership/training only; actual attack declaration, no new ability preselected. */
export function makeFollowerDestructionScenario(name: FollowerDestructionScenarioName, players: { id: string; name: string }[]): GameState {
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy();
    const result = transition(state, input, random);
    if (!result.ok) throw Error(`DESTRUCTION_FIXTURE_${name}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(state)) as GameState, input, random))) throw Error('DESTRUCTION_FIXTURE_REPLAY');
    state = result.state;
    const ids = allCardInstanceIds(state);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('DESTRUCTION_FIXTURE_CARDS');
  }
  function place(reference: string) {
    const id = takeCard(state, b, reference);
    state.players[b]!.hand = state.players[b]!.hand.filter(card => card !== id);
    state.players[b]!.followers.push({ cardInstanceId: id, revealed: false });
  }
  for (const player of players) act(player.id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  assignCharacter(state, a, characters[name]);
  assignCharacter(state, b, name === 'destroy-lancelot' ? '不死王ガドューラ' : name === 'destroy-frenzy' ? '黒妖精のアーネス' : '黒騎士ガーウィン');
  assignCharacter(state, c, 'リーア姫'); assignCharacter(state, d, '侍大将のシン');
  for (const player of Object.values(state.players)) player.permanent = { spirit: 12, endurance: 50 };
  if (name === 'destroy-lancaster') place('飛竜');
  else if (name === 'destroy-lancelot') place('ワイト');
  else if (name === 'destroy-frenzy') place('兵士');
  else { place('メタルゴーレム'); place('兵士'); }
  if (name === 'destroy-asfelt-blessing') {
    const blessing = takeCard(state, b, '祝福');
    state.players[b]!.hand = state.players[b]!.hand.filter(card => card !== blessing);
    state.players[b]!.open.push(blessing);
  }
  const card = takeCard(state, a, name === 'destroy-frenzy' ? '妖獣' : '黒翼飛翔剣');
  const fate = takeCard(state, c, '命運凶変');
  trimHand(state, a, card); trimHand(state, c, fate);
  state.events = [];
  act(a, { type: 'ATTACK', cardInstanceId: card, targetIds: [b], dedicated: false });
  for (let i = 0; i < 300; i++) {
    const window = state.windows?.at(-1);
    if (window?.kind === (name === 'destroy-lancelot' ? 'damage' : 'attack-abilities')) return state;
    if (!window) throw Error('DESTRUCTION_FIXTURE_NO_WINDOW');
    act(window.participants[window.cursor]!, { type: 'PASS' });
  }
  throw Error('DESTRUCTION_FIXTURE_NOT_READY');
}
