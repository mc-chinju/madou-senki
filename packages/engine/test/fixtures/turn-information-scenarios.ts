import { allCardInstanceIds, createGame, derivedStats, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

type Spec = { owner: string; ownerSeat?: 1; target?: string; draw?: boolean; setup?: boolean; growth?: boolean; followers?: boolean; chants?: boolean; attack?: boolean; revealOwner?: boolean; revealTarget?: boolean; forcedLia?: boolean; discard?: boolean };
export const turnInformationScenarioSpecs = {
  'info-cham-draw': { owner: '小妖精のチャム', draw: true },
  'info-lancelot-growth': { owner: '聖騎士ランスロット', target: 'リーア姫', draw: true, growth: true },
  'info-cham-followers': { owner: '小妖精のチャム', followers: true },
  'info-lia-chants': { owner: 'リーア姫', target: '侍大将のシン', chants: true },
  'info-lia-attack': { owner: 'リーア姫', target: '侍大将のシン', chants: true, attack: true },
  'info-lester-rumor': { owner: '吟遊詩人のレスター' },
  'info-alseil-hand': { owner: '占星術師のアルセイル' },
  'info-alseil-attack': { owner: '占星術師のアルセイル', attack: true },
  'info-lancaster-discard': { owner: '早駆けのランカスター', discard: true },
  'info-aiel-twins': { owner: '凍気のアイエル', target: '爆炎のフレイアード', revealTarget: true, followers: true },
  'info-flaiard-twins': { owner: '爆炎のフレイアード', target: '凍気のアイエル', revealTarget: true, followers: true },
  'info-twins-hidden': { owner: '凍気のアイエル', target: '爆炎のフレイアード', followers: true },
  'info-alseil-shadow': { owner: '占星術師のアルセイル', revealOwner: true },
  'info-alseil-truepower': { owner: '占星術師のアルセイル' },
  'info-alseil-reveal-setup': { owner: '占星術師のアルセイル', setup: true },
  'info-alseil-reveal-attack': { owner: '占星術師のアルセイル', ownerSeat: 1, attack: true },
  'info-alseil-reveal-otherturn': { owner: '占星術師のアルセイル', ownerSeat: 1 },
  'info-uonos-reveal': { owner: '邪祭ウーノス', target: '占星術師のアルセイル' },
  'info-uonos-lia': { owner: '邪祭ウーノス', target: 'リーア姫', forcedLia: true },
} as const satisfies Record<string, Spec>;
export type TurnInformationScenarioName = keyof typeof turnInformationScenarioSpecs;
export const turnInformationScenarioNames = Object.keys(turnInformationScenarioSpecs) as TurnInformationScenarioName[];
export function isTurnInformationScenario(name: string): name is TurnInformationScenarioName { return Object.hasOwn(turnInformationScenarioSpecs, name); }

/** New abilities remain unselected. Actual initial follower placement, prior CHANTs,
 * voluntary reveal and Lance II transformation produce their prerequisites. Initial
 * card arrangements, permanent gains, near distance and Haja OPEN are stated history. */
export function makeTurnInformationScenario(name: TurnInformationScenarioName, players: { id: string; name: string }[]): GameState {
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  const spec: Spec = turnInformationScenarioSpecs[name];
  const owner = spec.ownerSeat === 1 ? b : a;
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy();
    const result = transition(game, input, random);
    if (!result.ok) throw Error(`INFORMATION_FIXTURE_${name}_${command.type}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(game)), input, random))) throw Error('INFORMATION_FIXTURE_REPLAY');
    game = result.state;
    const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('INFORMATION_FIXTURE_CARDS');
  }
  function until(done: (state: GameState) => boolean) {
    for (let count = 0; count < 600; count++) {
      if (done(game)) return;
      const window = game.windows?.at(-1);
      if (!window) throw Error('INFORMATION_FIXTURE_NO_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('INFORMATION_FIXTURE_NOT_READY');
  }
  const settle = () => until(state => !state.windows?.length);
  function start(actorId: string, stopAtDraw = false, drawOne = false) {
    act(actorId, { type: 'START_TURN' }); settle();
    if (!stopAtDraw) { act(actorId, { type: 'CHOOSE_DRAW', draw: drawOne }); settle(); }
  }
  function finish(actorId: string) {
    if (game.phase === 'action') act(actorId, { type: 'PASS_ACTION' });
    const player = game.players[actorId]!;
    act(actorId, { type: 'END_TURN', discardIds: player.hand.slice(0, Math.max(0, player.hand.length - derivedStats(player).handLimit)) }); settle();
  }
  assignCharacter(game, a, spec.ownerSeat === 1 ? '侍大将のシン' : spec.owner);
  assignCharacter(game, b, spec.ownerSeat === 1 ? spec.owner : spec.target ?? '大神官ジル');
  assignCharacter(game, c, spec.forcedLia ? '聖騎士ランスロット' : '黒妖精のアーネス');
  assignCharacter(game, d, '白魔術師シェリム');
  for (const player of Object.values(game.players)) player.permanent = { spirit: 12, endurance: 100 };
  if (name.includes('truepower') || name.includes('reveal-')) game.players[owner]!.permanent = { spirit: 2, endurance: 100 };
  const fate = takeCard(game, d, '命運凶変');
  const divine = takeCard(game, c, '神性介入');
  trimHand(game, d, fate); trimHand(game, c, divine);
  const attack = spec.attack ? takeCard(game, a, '白光') : undefined;
  if (attack) trimHand(game, a, attack);
  const followers = spec.followers ? ['市民', '兵士'].map(card => takeCard(game, b, card)) : [];
  if (followers.length) trimHand(game, b, ...followers);
  const chants = spec.chants ? ['天地爆砕剣', '黒翼天翔剣'].map(card => takeCard(game, b, card)) : [];
  if (chants.length) {
    const haja = takeCard(game, b, '賢者ハジャ');
    game.players[b]!.hand = game.players[b]!.hand.filter(card => card !== haja); game.players[b]!.open.push(haja);
    trimHand(game, b, ...chants);
    game.distances[a]![b] = game.distances[b]![a] = 'near';
  }
  if (spec.discard) {
    const cards = ['白光', '魔詩', '破黒剣', '天使', '転移'].map(card => takeCard(game, a, card));
    trimHand(game, a, ...cards);
  }
  if (spec.setup) { game.events = []; return game; }
  for (const player of players) {
    if (player.id === b) for (const cardInstanceId of followers) act(b, { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId });
    act(player.id, { type: 'PASS_SETUP' });
  }
  // A real ordinary draw makes the two public twins' hands unequal. Initial follower placement refills.
  start(a, !!spec.draw && !spec.growth, !!spec.revealTarget);
  if (spec.revealOwner) { act(owner, { type: 'REVEAL_CHARACTER' }); settle(); }
  if (spec.revealTarget) { act(b, { type: 'REVEAL_CHARACTER' }); settle(); }
  if (spec.growth) {
    act(b, { type: 'REVEAL_CHARACTER' });
    until(state => viewFor(state, a).lifecycleAbilities.includes('lancelot-transform'));
    act(a, { type: 'USE_LIFECYCLE_ABILITY', ability: 'lancelot-transform' }); settle();
    if (game.players[a]!.characterId !== 'c2-p07-r1c1' || !game.players[a]!.abilityCharacterIds?.includes('c2-p02-r2c2')) throw Error('INFORMATION_FIXTURE_TRANSFORMATION');
    finish(a);
    for (const actor of game.seatOrder.slice(1)) { start(actor); finish(actor); }
    start(a, true);
  }
  for (const cardInstanceId of chants) {
    finish(a);
    for (const actor of game.seatOrder.slice(1)) { start(actor); if (actor === b) act(b, { type: 'CHANT', cardInstanceId }); finish(actor); }
    start(a);
  }
  game.events = [];
  if (attack) act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: false });
  return game;
}
