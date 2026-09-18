import { actionCards } from '@madou/catalog';
import { allCardInstanceIds, createGame, transition, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand, readySetup } from './scenario-tools.js';

export const attackPropertyScenarioNames = ['property-lancaster', 'property-lancaster-shared', 'property-arnes'] as const;
export type AttackPropertyScenarioName = typeof attackPropertyScenarioNames[number];
export function isAttackPropertyScenario(name: string): name is AttackPropertyScenarioName {
  return (attackPropertyScenarioNames as readonly string[]).includes(name);
}

/** Historical hands only; ordinary setup, declaration and public windows produce the ready state. */
export function makeAttackPropertyScenario(name: AttackPropertyScenarioName, players: { id: string; name: string }[]): GameState {
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy();
    const result = transition(game, input, random);
    if (!result.ok) throw Error(`PROPERTY_FIXTURE_${name}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(game)), input, random))) throw Error('PROPERTY_FIXTURE_REPLAY');
    game = result.state;
    const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('PROPERTY_FIXTURE_CARDS');
  }
  readySetup(()=>game,id=>act(id,{type:'PASS_SETUP'}));
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  assignCharacter(game, a, name === 'property-arnes' ? '黒妖精のアーネス' : '早駆けのランカスター');
  assignCharacter(game, b, '侍大将のシン'); assignCharacter(game, c, '忍びのイダ'); assignCharacter(game, d, '魔導王ガイナス');
  for (const player of Object.values(game.players)) player.permanent = { spirit: 12, endurance: 50 };
  const shared = name === 'property-lancaster-shared';
  const attack = takeCard(game, a, shared ? '竜殺天空槍' : name === 'property-arnes' ? '黒流弓' : '黒翼飛翔剣');
  const advance = takeCard(game, a, '踏み込み／殴る');
  const maai = actionCards.filter(card => card.modes?.some(mode => mode.playMode === 'distance')).map(card => card.id);
  const bCards = maai.slice(0, shared ? 3 : 4).map(id => takeCard(game, b, id));
  const cCards = shared ? maai.slice(3, 6).map(id => takeCard(game, c, id)) : [];
  const evade = takeCard(game, b, '見切る'); const fate = takeCard(game, c, '命運凶変');
  trimHand(game, a, attack, advance); trimHand(game, b, ...bCards, evade); trimHand(game, c, ...cCards, fate);
  game.events = [];
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: shared ? [b, c] : [b], dedicated: shared });
  const boundary = name === 'property-arnes' ? 'effect-level' : 'attack-abilities';
  for (let i = 0; i < 300; i++) {
    const window = game.windows?.at(-1);
    if (window?.kind === boundary) return game;
    if (!window) throw Error('PROPERTY_FIXTURE_NO_WINDOW');
    act(window.participants[window.cursor]!, { type: 'PASS' });
  }
  throw Error('PROPERTY_FIXTURE_NOT_READY');
}
