import { allCardInstanceIds, createGame, transition, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

export const techniqueValueScenarioNames = ['value-staff', 'value-fist', 'value-spirit', 'value-axe', 'value-black-magic'] as const;
export type TechniqueValueScenarioName = typeof techniqueValueScenarioNames[number];
export function isTechniqueValueScenario(name: string): name is TechniqueValueScenarioName {
  return (techniqueValueScenarioNames as readonly string[]).includes(name);
}
const sources = {
  'value-staff': { character: '白魔術師シェリム', card: '白光' },
  'value-fist': { character: '大神官ジル', card: '狼牙' },
  'value-spirit': { character: '侍大将のシン', card: '黒翼飛翔剣' },
  'value-axe': { character: '小人のランバ', card: '黒翼飛翔剣' },
  'value-black-magic': { character: '邪祭ウーノス', card: '妖獣' },
} satisfies Record<TechniqueValueScenarioName, { character: string; card: string }>;

/** Prior ownership and endurance/spirit training only; new abilities remain unselected. */
export function makeTechniqueValueScenario(name: TechniqueValueScenarioName, players: { id: string; name: string }[]): GameState {
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy();
    const result = transition(state, input, random);
    if (!result.ok) throw Error(`VALUE_FIXTURE_${name}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(state)) as GameState, input, random))) throw Error('VALUE_FIXTURE_REPLAY');
    state = result.state;
    const ids = allCardInstanceIds(state);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('VALUE_FIXTURE_CARDS');
  }
  for (const player of players) act(player.id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  assignCharacter(state, a, sources[name].character);
  assignCharacter(state, b, '黒騎士ガーウィン'); assignCharacter(state, c, 'リーア姫'); assignCharacter(state, d, '忍びのイダ');
  for (const player of Object.values(state.players)) player.permanent = { spirit: 12, endurance: 50 };
  if (name === 'value-fist') state.distances[a]![b] = state.distances[b]![a] = 'near';
  const source = takeCard(state, a, sources[name].card);
  const prayer = takeCard(state, c, '必勝の祈り');
  const fate = takeCard(state, c, '命運凶変');
  const reroll = takeCard(state, c, '神性介入');
  trimHand(state, a, source); trimHand(state, c, prayer, fate, reroll);
  state.events = [];
  act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b], dedicated: false });
  for (let i = 0; i < 300; i++) {
    const window = state.windows?.at(-1);
    if (window?.kind === 'effect-level') return state;
    if (!window) throw Error('VALUE_FIXTURE_NO_WINDOW');
    act(window.participants[window.cursor]!, { type: 'PASS' });
  }
  throw Error('VALUE_FIXTURE_NO_EFFECT_WINDOW');
}
