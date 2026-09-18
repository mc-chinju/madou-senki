import { allCardInstanceIds, createGame, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand, readySetup } from './scenario-tools.js';

const sources = {
  'mental-lester-choice': { character: '吟遊詩人のレスター', abilityId: 'c2-p03-r2c1-ab01', result: 'choice' },
  'mental-dia-choice': { character: '魔聖母ディア', abilityId: 'c2-p06-r1c2-ab01', result: 'choice' },
  'mental-fear-choice': { character: '不死王ガドューラ', abilityId: 'c2-p06-r1c1-ab01', result: 'choice' },
  'mental-lester-six': { character: '吟遊詩人のレスター', abilityId: 'c2-p03-r2c1-ab01', result: 'six' },
  'mental-dia-six': { character: '魔聖母ディア', abilityId: 'c2-p06-r1c2-ab01', result: 'six' },
  'mental-dia-fixed-six': { character: '魔聖母ディア', abilityId: 'c2-p06-r1c2-ab01', result: 'six' },
  'mental-lester-double': { character: '吟遊詩人のレスター', abilityId: 'c2-p03-r2c1-ab01', result: 'double' },
  'mental-lester-failed': { character: '吟遊詩人のレスター', abilityId: 'c2-p03-r2c1-ab01', result: 'failed' },
  'mental-fear-six-shared': { character: '不死王ガドューラ', abilityId: 'c2-p06-r1c1-ab01', result: 'six' },
  'mental-fear-six-gift': { character: '不死王ガドューラ', abilityId: 'c2-p06-r1c1-ab01', result: 'six' },
} as const;
export type MentalDefenseScenarioName = keyof typeof sources;
export const mentalDefenseScenarioNames = Object.keys(sources) as MentalDefenseScenarioName[];
export function isMentalDefenseScenario(name: string): name is MentalDefenseScenarioName { return Object.hasOwn(sources, name); }

/** Actual ability/check transactions may seed saved dice; no roll/status/result object is edited. */
export function makeMentalDefenseScenario(name: MentalDefenseScenarioName, players: { id: string; name: string }[]): GameState {
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand, dice?: number[]) {
    const input = { actorId, command };
    const random = { ...entropy(), ...(dice ? { dice } : {}) };
    const result = transition(game, input, random);
    if (!result.ok) throw Error(`MENTAL_FIXTURE_${name}_${command.type}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(game)), input, random))) throw Error('MENTAL_FIXTURE_REPLAY');
    game = result.state;
    const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('MENTAL_FIXTURE_CARDS');
  }
  function until(done: (state: GameState) => boolean, dice?: number[]) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1);
      if (!window) throw Error('MENTAL_FIXTURE_NO_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' }, dice);
    }
    throw Error('MENTAL_FIXTURE_NOT_READY');
  }
  const spec = sources[name];
  const lester = name.startsWith('mental-lester');
  const fixed = name === 'mental-dia-fixed-six';
  const shared = name === 'mental-fear-six-shared' || name === 'mental-fear-six-gift';
  assignCharacter(game, a, fixed ? '侍大将のシン' : lester ? '邪祭ウーノス' : '小人のランバ');
  assignCharacter(game, b, spec.character);
  assignCharacter(game, c, lester ? '黒妖精のアーネス' : '邪祭ウーノス');
  assignCharacter(game, d, fixed ? '白魔術師シェリム' : '侍大将のシン');
  for (const player of Object.values(game.players)) player.permanent = { spirit: 12, endurance: 50 };
  const attack = takeCard(game, a, shared ? '地裂' : '白光');
  const gift = name === 'mental-fear-six-gift' ? takeCard(game, a, '「姫を頼む」') : undefined;
  const prayer = gift ? takeCard(game, a, '必勝の祈り') : undefined;
  const fate = takeCard(game, c, '命運凶変');
  const reroll = takeCard(game, d, '神性介入');
  trimHand(game, a, attack, ...(gift && prayer ? [gift, prayer] : []));
  trimHand(game, c, fate);
  trimHand(game, d, reroll);
  readySetup(()=>game,id=>act(id,{type:'PASS_SETUP'}));
  act(a, { type: 'START_TURN' });
  act(a, { type: 'CHOOSE_DRAW', draw: false });
  game.events = [];
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: shared ? [b, c] : [b], dedicated: false });
  until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  if (spec.result === 'choice') return game;
  const option = viewFor(game, b).abilityOptions.find(option => option.abilityId === spec.abilityId);
  if (!option) throw Error('MENTAL_FIXTURE_SOURCE_UNAVAILABLE');
  act(b, { type: 'USE_ABILITY', abilityId: spec.abilityId, targetEventId: option.targetEventId });
  const dice = spec.result === 'six' ? [6, 6] : spec.result === 'double' ? [2, 2] : [1, 2];
  until(state => viewFor(state, a).currentRoll?.purpose === 'ability-check' && viewFor(state, a).currentRoll?.stage === 'after-roll', dice);
  if (spec.result === 'failed') {
    until(state => viewFor(state, c).activeWindow?.pendingActorId === c);
    const rollId = viewFor(game, a).currentRoll!.rollId;
    act(c, { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'force-fail', targetRollId: rollId });
    until(state => viewFor(state, a).currentRoll?.rollId === rollId && viewFor(state, a).currentRoll?.stage === 'after-roll' && viewFor(state, a).currentRoll?.forcedFailure === true);
  }
  return game;
}
