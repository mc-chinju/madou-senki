import { allCardInstanceIds, createGame, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

const sources = {
  'defense-half': { defender: '小人のランバ', card: '白光' },
  'defense-half-odd': { defender: '小人のランバ', card: '雷走' },
  'defense-half-resistance': { defender: '小人のランバ', card: '幻矢' },
  'defense-half-shared': { defender: '小人のランバ', card: '地裂' },
  'defense-grace-zero': { defender: 'リーア姫', card: 'a2-p23-r2c3' },
  'defense-grace-residual': { defender: 'リーア姫', card: '死鬼滅殺拳' },
  'defense-shield': { defender: '聖騎士ランスロット', card: '白光' },
  'defense-majesty': { defender: '魔導王ガイナス', card: '白光' },
  'defense-majesty-prohibited': { defender: '魔導王ガイナス', card: 'スケルトン' },
} as const;
export type RollingDefenseScenarioName = keyof typeof sources;
export const rollingDefenseScenarioNames = Object.keys(sources) as RollingDefenseScenarioName[];
export function isRollingDefenseScenario(name: string): name is RollingDefenseScenarioName { return Object.hasOwn(sources, name); }

/** Historical ownership/training; real commands create Soldier placement, transformation and incoming attacks. */
export function makeRollingDefenseScenario(name: RollingDefenseScenarioName, players: { id: string; name: string }[]): GameState {
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy(); const result = transition(game, input, random);
    if (!result.ok) throw Error(`ROLLING_DEFENSE_FIXTURE_${name}_${command.type}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(game)), input, random))) throw Error('ROLLING_DEFENSE_FIXTURE_REPLAY');
    game = result.state; const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('ROLLING_DEFENSE_FIXTURE_CARDS');
  }
  function until(done: (state: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error('ROLLING_DEFENSE_FIXTURE_NO_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('ROLLING_DEFENSE_FIXTURE_NOT_READY');
  }
  const shield = name === 'defense-shield'; const prohibited = name === 'defense-majesty-prohibited';
  assignCharacter(game, a, prohibited ? '不死王ガドューラ' : '邪祭ウーノス');
  assignCharacter(game, b, sources[name].defender);
  assignCharacter(game, c, shield ? 'リーア姫' : '忍びのイダ'); assignCharacter(game, d, '侍大将のシン');
  for (const player of Object.values(game.players)) player.permanent = { spirit: 12, endurance: 50 };
  const attack = takeCard(game, a, sources[name].card); const evade = takeCard(game, a, '見切る');
  const fate = takeCard(game, c, '命運凶変'); const reroll = takeCard(game, c, '神性介入');
  const soldier = name === 'defense-half' || name === 'defense-half-odd' || name === 'defense-half-shared' ? takeCard(game, b, '兵士') : undefined;
  trimHand(game, a, attack, evade); trimHand(game, c, fate, reroll); if (soldier) trimHand(game, b, soldier);
  for (const player of players) {
    if (player.id === b && soldier) act(b, { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: soldier });
    act(player.id, { type: 'PASS_SETUP' });
  }
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  if (shield) {
    act(c, { type: 'REVEAL_CHARACTER' });
    until(state => viewFor(state, b).lifecycleAbilities.includes('lancelot-transform'));
    act(b, { type: 'USE_LIFECYCLE_ABILITY', ability: 'lancelot-transform' });
    until(state => !state.windows?.length);
    if (game.players[b]!.characterId !== 'c2-p07-r1c1' || !game.players[b]!.abilityCharacterIds?.includes('c2-p02-r2c2')) throw Error('ROLLING_DEFENSE_FIXTURE_TRANSFORMATION');
  }
  if (name === 'defense-grace-residual' || name === 'defense-grace-zero') game.distances[a]![b] = game.distances[b]![a] = 'near';
  game.events = [];
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: name === 'defense-half-shared' ? [b, c] : [b], dedicated: prohibited });
  until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  return game;
}
