import { allCardInstanceIds, createGame, derivedStats, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

type Spec = { owner: string; card: string; defense?: boolean; chanted?: boolean; reveal?: boolean; near?: boolean; vanmil?: boolean; placed?: boolean; gate?: boolean };
export const declarationScenarioSpecs = {
  'declare-shelim-gate': { owner: '白魔術師シェリム', card: '魔招門', gate: true },
  'declare-shelim-waive': { owner: '白魔術師シェリム', card: '天舞' },
  'declare-shelim-all': { owner: '白魔術師シェリム', card: '天舞', chanted: true, reveal: true },
  'declare-shelim-hidden-all': { owner: '白魔術師シェリム', card: '天舞', chanted: true },
  'declare-gil-range': { owner: '大神官ジル', card: '気破' },
  'declare-gil-counter': { owner: '大神官ジル', card: '死鬼旋風脚', defense: true },
  'declare-shin-waive': { owner: '侍大将のシン', card: '黒翼天翔剣' },
  'declare-shin-counter': { owner: '侍大将のシン', card: '魔空剣', defense: true },
  'declare-shin-both': { owner: '侍大将のシン', card: '黒翼天翔剣', defense: true },
  'declare-fury-element': { owner: '妖精王フューリー', card: '烈火' },
  'declare-garwin-follower-hand': { owner: '黒騎士ガーウィン', card: '黒騎士団' },
  'declare-garwin-follower-placed': { owner: '黒騎士ガーウィン', card: '黒騎士団', placed: true },
  'declare-garwin-sword': { owner: '黒騎士ガーウィン', card: '破黒剣' },
  'declare-garwin-all': { owner: '黒騎士ガーウィン', card: '黒翼天翔剣', chanted: true, reveal: true },
  'declare-garwin-unchanted-all': { owner: '黒騎士ガーウィン', card: '黒翼天翔剣', reveal: true },
  'declare-gainas-waive': { owner: '魔導王ガイナス', card: '黒翼天翔剣' },
  'declare-gainas-all': { owner: '魔導王ガイナス', card: '魔空剣', reveal: true },
  'declare-gainas-below': { owner: '魔導王ガイナス', card: '黒翼飛翔剣', reveal: true },
  'declare-yotsurm': { owner: '餓狼ヨーツルム', card: '死鬼界滅拳', near: true },
  'declare-vanmil-warrior': { owner: '邪祭ウーノス', card: '黒翼天翔剣', vanmil: true },
  'declare-vanmil-magic': { owner: '邪祭ウーノス', card: '烈火', vanmil: true },
  'declare-vanmil-null': { owner: '邪祭ウーノス', card: '幻矢', vanmil: true },
} as const satisfies Record<string, Spec>;
export type DeclarationScenarioName = keyof typeof declarationScenarioSpecs;
export const declarationScenarioNames = Object.keys(declarationScenarioSpecs) as DeclarationScenarioName[];
export function isDeclarationScenario(name: string): name is DeclarationScenarioName { return Object.hasOwn(declarationScenarioSpecs, name); }

/** New declaration abilities are never preselected. Actual earlier CHANT or ritual transactions
 * produce source-zone/identity prerequisites; initial permanent gains and distance are historical fixture arrangements. */
export function makeDeclarationScenario(name: DeclarationScenarioName, players: { id: string; name: string }[]): GameState {
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  const spec: Spec = declarationScenarioSpecs[name];
  const owner = spec.defense ? b : a;
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command };
    const random = entropy();
    const result = transition(game, input, random);
    if (!result.ok) throw Error(`DECLARATION_FIXTURE_${name}_${command.type}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(game)), input, random))) throw Error('DECLARATION_FIXTURE_REPLAY');
    game = result.state;
    const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('DECLARATION_FIXTURE_CARDS');
  }
  function until(done: (state: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1);
      if (!window) throw Error('DECLARATION_FIXTURE_NO_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('DECLARATION_FIXTURE_NOT_READY');
  }
  function start(actorId: string) {
    act(actorId, { type: 'START_TURN' });
    act(actorId, { type: 'CHOOSE_DRAW', draw: false });
  }
  function finish(actorId: string) {
    const player = game.players[actorId]!;
    const extra = Math.max(0, player.hand.length - derivedStats(player).handLimit);
    act(actorId, { type: 'END_TURN', discardIds: player.hand.slice(0, extra) });
  }
  function nextOwnTurn() {
    finish(a);
    for (const actor of [b, c, d]) {
      start(actor);
      act(actor, { type: 'PASS_ACTION' });
      finish(actor);
    }
    if (game.seatOrder[game.turnSeat] !== a) throw Error('DECLARATION_FIXTURE_TURN');
    start(a);
  }
  assignCharacter(game, a, spec.defense ? '魔聖母ディア' : spec.owner);
  assignCharacter(game, b, spec.defense ? spec.owner : spec.owner === '侍大将のシン' ? '大神官ジル' : '侍大将のシン');
  assignCharacter(game, c, '黒妖精のアーネス');
  assignCharacter(game, d, spec.owner === '白魔術師シェリム' ? '小人のランバ' : '白魔術師シェリム');
  for (const player of Object.values(game.players)) player.permanent = { spirit: 12, endurance: 100 };
  const card = takeCard(game, owner, spec.card);
  const fate = takeCard(game, d, '命運凶変');
  const divine = takeCard(game, c, '神性介入');
  const prayer = takeCard(game, c, '必勝の祈り');
  const incoming = spec.defense ? takeCard(game, a, '白光') : undefined;
  const ritual = spec.vanmil ? takeCard(game, a, '復活の儀式') : undefined;
  trimHand(game, owner, card, ...(ritual ? [ritual] : []));
  if (incoming) trimHand(game, a, incoming);
  trimHand(game, c, divine, prayer);
  trimHand(game, d, fate);
  if (spec.near) game.distances[a]![b] = game.distances[b]![a] = 'near';
  if (spec.placed) act(owner, { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: card });
  const donor = spec.gate ? takeCard(game, b, '市民') : undefined;
  for (const player of players) {
    if (player.id === b && donor) act(b, { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: donor });
    act(player.id, { type: 'PASS_SETUP' });
  }
  start(a);
  if (spec.reveal) {
    act(owner, { type: 'REVEAL_CHARACTER' });
    until(state => !state.windows?.length);
  }
  if (spec.chanted) {
    act(owner, { type: 'CHANT', cardInstanceId: card });
    nextOwnTurn();
    if (!game.players[owner]!.chants.some(chant => chant.cardInstanceId === card)) throw Error('DECLARATION_FIXTURE_CHANT');
  }
  if (spec.vanmil) {
    game.players[a]!.damage = 7; // Historical injury proves the actual ritual's full healing.
    act(a, { type: 'USE_REVIVAL_RITUAL' });
    until(state => !state.windows?.length);
    if (game.players[a]!.characterId !== 'c2-p07-r1c2' || game.players[a]!.damage !== 0) throw Error('DECLARATION_FIXTURE_RITUAL');
    nextOwnTurn();
    if (game.discard.filter(id => id === ritual).length !== 1) throw Error('DECLARATION_FIXTURE_RITUAL_CARD');
  }
  game.events = [];
  if (incoming) {
    act(a, { type: 'ATTACK', cardInstanceId: incoming, targetIds: [b], dedicated: false });
    until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  }
  return game;
}
