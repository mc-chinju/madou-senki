import {distanceReceivedSources} from './r5-distance-scenarios.js';
import { allCardInstanceIds, createGame, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

const sources = {
  ...distanceReceivedSources,
  'received-griffin': { defender: '破壊神ヴァンミール', card: 'グリフォン' },
  'received-griffin-follower': { defender: '破壊神ヴァンミール', card: 'グリフォン' },
  'received-fury': { defender: '妖精王フューリー', card: 'a2-p12-r2c2' },
  'received-silver-black': { defender: '聖騎士ランスロット', card: 'a2-p14-r1c1' },
  'received-silver-white': { defender: '聖騎士ランスロット', card: '白光' },
  'received-shelim': { defender: '白魔術師シェリム', card: '炎舞' },
  'received-shelim-hp': { defender: '白魔術師シェリム', card: '白光' },
  'received-shared': { defender: '黒妖精のアーネス', card: 'a2-p18-r1c3' },
  'received-aiel-fire': { defender: '凍気のアイエル', card: '炎舞' },
  'received-aiel-water': { defender: '凍気のアイエル', card: '凍流' },
  'received-fleiard-fire': { defender: '爆炎のフレイアード', card: '炎舞' },
  'received-fleiard-water': { defender: '爆炎のフレイアード', card: '凍流' },
  'received-aiel-wind': { defender: '凍気のアイエル', card: 'a2-p14-r3c3' },
} as const;
export type ReceivedDefenseScenarioName = keyof typeof sources;
export const receivedDefenseScenarioNames = Object.keys(sources) as ReceivedDefenseScenarioName[];
export function isReceivedDefenseScenario(name: string): name is ReceivedDefenseScenarioName { return Object.hasOwn(sources, name); }

/** Historical ownership/training only; real commands create every pending attack, Prayer and Soldier. */
export function makeReceivedDefenseScenario(name: ReceivedDefenseScenarioName, players: { id: string; name: string }[]): GameState {
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy(); const result = transition(game, input, random);
    if (!result.ok) throw Error(`RECEIVED_FIXTURE_${name}_${command.type}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(game)), input, random))) throw Error('RECEIVED_FIXTURE_REPLAY');
    game = result.state; const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('RECEIVED_FIXTURE_CARDS');
  }
  assignCharacter(game, a, name.startsWith('received-griffin')?'獣使いのウパニシャット':'魔導王ガイナス'); assignCharacter(game, b, sources[name].defender);
  assignCharacter(game, c, '忍びのイダ'); assignCharacter(game, d, '侍大将のシン');
  for (const player of Object.values(game.players)) player.permanent = { spirit: 12, endurance: 50 };
  const attack = takeCard(game, a, sources[name].card); const fate = takeCard(game, c, '命運凶変');
  const hp = name === 'received-shelim-hp';
  const prayer = hp ? takeCard(game, a, '必勝の祈り') : undefined;
  const soldier = hp || name==='received-griffin-follower' ? takeCard(game, b, '兵士') : undefined;
  trimHand(game, a, attack, ...(prayer ? [prayer] : [])); trimHand(game, c, fate);
  if (soldier) trimHand(game, b, soldier);
  for (const player of players) {
    if (player.id === b && soldier) act(b, { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: soldier });
    act(player.id, { type: 'PASS_SETUP' });
  }
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  game.events = [];
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: name === 'received-shared' ? [b, c] : [b], dedicated: name.startsWith('received-griffin') });
  let prayed = false;
  for (let i = 0; i < 400; i++) {
    const window = game.windows?.at(-1);
    if (window?.kind === 'normal-defense') return game;
    if (!window) throw Error('RECEIVED_FIXTURE_NO_WINDOW');
    if (prayer && !prayed && window.kind === 'effect-level' && window.participants[window.cursor] === a) {
      const targetActionId = viewFor(game, a).currentAction!.actionId;
      act(a, { type: 'PLAY_REACTION', cardInstanceId: prayer, mode: 'effect-plus', targetActionId, dedicated: false }); prayed = true;
    } else act(window.participants[window.cursor]!, { type: 'PASS' });
  }
  throw Error('RECEIVED_FIXTURE_NOT_READY');
}
