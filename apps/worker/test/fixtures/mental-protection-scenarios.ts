import { allCardInstanceIds, createGame, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

export const mentalProtectionScenarioNames = [
  'protect-cham', 'protect-cham-hidden-owner', 'protect-cham-hidden-source',
  'protect-tia', 'protect-tia-hidden-source', 'protect-lancelot', 'protect-lancelot-ii',
  'protect-uonos', 'protect-uonos-hidden-source', 'protect-gad-response',
  'protect-gil-six', 'protect-shin-six', 'protect-garwin-six',
  'protect-garwin-nightmare', 'protect-gad-warrior', 'protect-gad-null', 'protect-gad-gil-exception',
] as const;
export type MentalProtectionScenarioName = typeof mentalProtectionScenarioNames[number];
export function isMentalProtectionScenario(name: string): name is MentalProtectionScenarioName {
  return mentalProtectionScenarioNames.some(candidate => candidate === name);
}

/** Canonical physical attacks and actual ability/reveal/transform transactions.
 * Permanent stat gains and starting distances are explicit historical setup; saved dice enter only through transition entropy.
 * New protection abilities remain unselected, so browser and DO tests must use their real command path. */
export function makeMentalProtectionScenario(name: MentalProtectionScenarioName, players: { id: string; name: string }[]): GameState {
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d, e] = players.map(player => player.id) as [string, string, string, string, string | undefined];
  function act(actorId: string, command: GameCommand, dice?: number[]) {
    const input = { actorId, command };
    const random = { ...entropy(), ...(dice ? { dice } : {}) };
    const result = transition(game, input, random);
    if (!result.ok) throw Error(`MENTAL_PROTECTION_${name}_${command.type}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(game)), input, random))) throw Error('MENTAL_PROTECTION_REPLAY');
    game = result.state;
    const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('MENTAL_PROTECTION_CARDS');
  }
  function until(done: (state: GameState) => boolean, dice?: number[]) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1);
      if (!window) throw Error(`MENTAL_PROTECTION_NO_WINDOW_${name}`);
      act(window.participants[window.cursor]!, { type: 'PASS' }, dice);
    }
    throw Error('MENTAL_PROTECTION_NOT_READY');
  }
  const cham = name.startsWith('protect-cham');
  const tia = name.startsWith('protect-tia');
  const lance = name.startsWith('protect-lancelot');
  const uonos = name.startsWith('protect-uonos');
  const guard = name.endsWith('-six');
  const technique = ['protect-garwin-nightmare', 'protect-gad-warrior', 'protect-gad-null', 'protect-gad-gil-exception'].includes(name);
  const gil = name === 'protect-gil-six' || name === 'protect-gad-gil-exception';
  const shin = name === 'protect-shin-six';
  const garwin = name === 'protect-garwin-six';
  assignCharacter(game, a, gil ? '大神官ジル' : shin ? '侍大将のシン' : garwin ? '黒騎士ガーウィン'
    : tia ? '有翼人のティア' : lance ? '聖騎士ランスロット' : name === 'protect-gad-response' ? '不死王ガドューラ'
    : name === 'protect-gad-warrior' ? '忍びのイダ' : name === 'protect-garwin-nightmare' ? '魔聖母ディア' : '邪祭ウーノス');
  const sourceIsDia = tia || garwin || name === 'protect-gad-response';
  assignCharacter(game, b, technique ? name === 'protect-garwin-nightmare' ? '黒騎士ガーウィン' : '不死王ガドューラ'
    : sourceIsDia ? '魔聖母ディア' : lance || shin ? '不死王ガドューラ' : '吟遊詩人のレスター');
  assignCharacter(game, c, cham ? '小妖精のチャム' : '黒妖精のアーネス');
  assignCharacter(game, d, shin ? '白魔術師シェリム' : '侍大将のシン');
  if (name === 'protect-lancelot-ii') {
    if (!e) throw Error('MENTAL_PROTECTION_REQUIRES_FIVE_SEATS');
    assignCharacter(game, e, 'リーア姫');
  }
  for (const player of Object.values(game.players)) player.permanent = { spirit: 12, endurance: 50 };
  // S19 uses Gil's real spirit 7 (threshold 6), so sixes are an ordinary failure even with faith.
  if (name === 'protect-gil-six') game.players[a]!.permanent = { endurance: 50 };
  // Keep normal incoming resistance capable of failure for the distinct stop-only clause.
  if (name === 'protect-garwin-nightmare' || name === 'protect-gad-null') game.players[b]!.permanent = { endurance: 50 };
  const cardName = name === 'protect-garwin-nightmare' ? '悪夢' : name === 'protect-gad-warrior' ? '気斬'
    : name === 'protect-gad-response' ? '地槍' : name === 'protect-gad-null' ? '幻矢' : name === 'protect-gad-gil-exception' ? '気破' : '白光';
  const attack = takeCard(game, a, cardName);
  const fate = takeCard(game, d, '命運凶変');
  const divine = takeCard(game, c, '神性介入');
  trimHand(game, a, attack);
  trimHand(game, c, divine);
  trimHand(game, d, fate);
  if (name === 'protect-gad-gil-exception') game.distances[a]![b] = game.distances[b]![a] = 'near';
  for (const player of players) act(player.id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' });
  act(a, { type: 'CHOOSE_DRAW', draw: false });
  if (name === 'protect-lancelot-ii') {
    act(e!, { type: 'REVEAL_CHARACTER' });
    until(state => viewFor(state, a).lifecycleAbilities.includes('lancelot-transform'));
    act(a, { type: 'USE_LIFECYCLE_ABILITY', ability: 'lancelot-transform' });
    until(state => !state.windows?.length);
    if (game.players[a]!.characterId !== 'c2-p07-r1c1' || !game.players[a]!.abilityCharacterIds?.includes('c2-p02-r2c2')) throw Error('MENTAL_PROTECTION_TRANSFORMATION');
  }
  if (cham && name !== 'protect-cham-hidden-owner') {
    act(c, { type: 'REVEAL_CHARACTER' });
    until(state => !state.windows?.length);
  }
  if ((cham || tia || uonos) && !name.endsWith('hidden-source')) {
    act(b, { type: 'REVEAL_CHARACTER' });
    until(state => !state.windows?.length);
  }
  game.events = [];
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: name === 'protect-gad-gil-exception' });
  until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  if (technique) return game;
  const abilityId = sourceIsDia ? 'c2-p06-r1c2-ab01' : lance || shin ? 'c2-p06-r1c1-ab01' : 'c2-p03-r2c1-ab01';
  const option = viewFor(game, b).abilityOptions.find(option => option.abilityId === abilityId);
  if (!option) throw Error('MENTAL_PROTECTION_SOURCE_UNAVAILABLE');
  act(b, { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId });
  if (guard) until(state => viewFor(state, a).currentRoll?.purpose === 'ability-check' && viewFor(state, a).currentRoll?.stage === 'after-roll', [6, 6]);
  return game;
}
