import { allCardInstanceIds, createGame, derivedStats, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand, readySetup } from './scenario-tools.js';

type Spec = { owner: string; ownerSeat?: 1; counterpart?: string; publicOwner?: boolean; publicCounterpart?: boolean; lanceII?: boolean; truth?: boolean; dragon?: boolean; defending?: boolean; warrior?: boolean; haja?: boolean };
export const conditionalScenarioSpecs = {
  'conditional-tia-public': { owner: '有翼人のティア', counterpart: '吟遊詩人のレスター', publicCounterpart: true },
  'conditional-tia-hidden': { owner: '有翼人のティア', counterpart: '吟遊詩人のレスター' },
  'conditional-lia-public': { owner: 'リーア姫', counterpart: '聖騎士ランスロット', publicOwner: true, publicCounterpart: true },
  'conditional-lia-hidden': { owner: 'リーア姫', counterpart: '聖騎士ランスロット', publicCounterpart: true },
  'conditional-lia-lance-ii': { owner: 'リーア姫', counterpart: '聖騎士ランスロット', publicOwner: true, lanceII: true },
  'conditional-arnes-attack': { owner: '黒妖精のアーネス', counterpart: '侍大将のシン', publicCounterpart: true, warrior: true },
  'conditional-arnes-defense': { owner: '黒妖精のアーネス', ownerSeat: 1, defending: true },
  'conditional-asfelt-dragon': { owner: '竜皇子アスフェルト', ownerSeat: 1, defending: true, dragon: true },
  'conditional-asfelt-truth': { owner: '竜皇子アスフェルト', counterpart: '吟遊詩人のレスター', truth: true, warrior: true },
  'conditional-upa-attack': { owner: '獣使いのウパニシャット', counterpart: '侍大将のシン', publicCounterpart: true, warrior: true },
  'conditional-garwin-rival': { owner: '黒騎士ガーウィン', counterpart: '聖騎士ランスロット', publicCounterpart: true },
  'conditional-dia-public': { owner: '魔聖母ディア', publicOwner: true, haja: true },
  'conditional-dia-hidden': { owner: '魔聖母ディア', haja: true },
} as const satisfies Record<string, Spec>;
export type ConditionalScenarioName = keyof typeof conditionalScenarioSpecs;
export const conditionalScenarioNames = Object.keys(conditionalScenarioSpecs) as ConditionalScenarioName[];
export function isConditionalScenario(name: string): name is ConditionalScenarioName { return Object.hasOwn(conditionalScenarioSpecs, name); }

/** All eight new sources start OFF. Actual reveals, Lance II transformation,
 * initial dragon placement and Lester's six-double conversion produce prerequisites.
 * Initial cards, permanent gains, near distance and Haja OPEN are stated history. */
export function makeConditionalScenario(name: ConditionalScenarioName, players: { id: string; name: string }[]): GameState {
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  const spec: Spec = conditionalScenarioSpecs[name];
  const owner = spec.ownerSeat === 1 ? b : a;
  function act(actorId: string, command: GameCommand, dice = Array(100).fill(1)) {
    const input = { actorId, command }; const random = { ...entropy(), dice };
    const result = transition(game, input, random);
    if (!result.ok) throw Error(`CONDITIONAL_FIXTURE_${name}_${command.type}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(game)), input, random))) throw Error('CONDITIONAL_FIXTURE_REPLAY');
    game = result.state;
    const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('CONDITIONAL_FIXTURE_CARDS');
  }
  function until(done: (state: GameState) => boolean, dice?: number[]) {
    for (let step = 0; step < 1000; step++) {
      if (done(game)) return;
      const window = game.windows?.at(-1); if (!window) throw Error(`CONDITIONAL_FIXTURE_NO_WINDOW_${name}`);
      act(window.participants[window.cursor]!, { type: 'PASS' }, dice);
    }
    throw Error('CONDITIONAL_FIXTURE_NOT_READY');
  }
  const settle = (dice?: number[]) => until(state => !state.windows?.length, dice);
  function start(actorId: string) { act(actorId, { type: 'START_TURN' }); settle(); act(actorId, { type: 'CHOOSE_DRAW', draw: false }); settle(); }
  function finish(actorId: string) {
    if (game.phase === 'withdrawal') act(actorId, { type: 'PASS_WITHDRAWAL' });
    if (game.phase === 'action') act(actorId, { type: 'PASS_ACTION' });
    // A stopped actor can complete its turn through the accepted withdrawal/action command.
    if (game.seatOrder[game.turnSeat] !== actorId) {
      if (game.phase !== 'turn-start') throw Error('CONDITIONAL_FIXTURE_UNEXPECTED_TURN_END');
      return;
    }
    // New sources remain OFF throughout fixture construction; low-level setup stats are sufficient here.
    const player = game.players[actorId]!;
    act(actorId, { type: 'END_TURN', discardIds: player.hand.slice(0, Math.max(0, player.hand.length - derivedStats(player).handLimit)) }); settle();
  }
  assignCharacter(game, a, spec.ownerSeat === 1 ? '侍大将のシン' : spec.owner);
  assignCharacter(game, b, spec.ownerSeat === 1 ? spec.owner : spec.counterpart ?? '大神官ジル');
  assignCharacter(game, c, spec.truth ? '魔導王ガイナス' : '占星術師のアルセイル');
  assignCharacter(game, d, spec.truth ? '邪祭ウーノス' : '白魔術師シェリム');
  for (const player of Object.values(game.players)) player.permanent = { warrior_level: 8, magic_level: 8, spirit: 12, endurance: 100 };
  const fate = takeCard(game, d, '命運凶変'); const divine = takeCard(game, c, '神性介入');
  trimHand(game, d, fate); trimHand(game, c, divine);
  const attack = spec.warrior ? takeCard(game, a, '破黒剣') : spec.defending || spec.truth ? takeCard(game, a, '白光') : undefined;
  const conversion = spec.truth ? takeCard(game, a, '白光') : undefined;
  if (attack) trimHand(game, a, attack, ...(conversion ? [conversion] : []));
  const dragon = spec.dragon ? takeCard(game, owner, '飛竜') : undefined;
  if (dragon) trimHand(game, owner, dragon);
  if (spec.defending && !spec.dragon) {
    const defense = takeCard(game, owner, '転移'); trimHand(game, owner, defense);
  }
  if (spec.haja) {
    const haja = takeCard(game, owner, '賢者ハジャ');
    game.players[owner]!.hand = game.players[owner]!.hand.filter(id => id !== haja); game.players[owner]!.open.push(haja);
    trimHand(game, owner);
    // Prior turns legally accumulated eight cards under the elected public capacity.
    // Election starts OFF here to exercise delayed loss and normal END adjustment.
    while (game.players[owner]!.hand.length < 8) game.players[owner]!.hand.push(game.deck.shift()!);
  }
  const previewFollower = spec.truth || name === 'conditional-upa-attack' ? takeCard(game, a, spec.truth ? '飛竜' : 'グリフォン') : undefined;
  const bundleFollower = name === 'conditional-upa-attack' ? takeCard(game, a, '炎竜') : undefined;
  if (previewFollower) trimHand(game, a, previewFollower, ...(attack ? [attack] : []), ...(conversion ? [conversion] : []), ...(bundleFollower ? [bundleFollower] : []));
  if (spec.warrior) for (const other of [b, c, d]) game.distances[a]![other] = game.distances[other]![a] = 'near';
  for (const player of players) {
    if (player.id === a && previewFollower) act(a, { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: previewFollower });
    if (player.id === owner && dragon) act(owner, { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: dragon });
    act(player.id, { type: 'PASS_SETUP' });
  }
  readySetup(()=>game,id=>act(id,{type:'PASS_SETUP'}));
  start(a);
  if (spec.publicOwner) { act(owner, { type: 'REVEAL_CHARACTER' }); if (!spec.lanceII) settle(); }
  if (spec.lanceII) {
    until(state => viewFor(state, b).lifecycleAbilities.includes('lancelot-transform'));
    act(b, { type: 'USE_LIFECYCLE_ABILITY', ability: 'lancelot-transform' }); settle();
    if (game.players[b]!.characterId !== 'c2-p07-r1c1' || !game.players[b]!.abilityCharacterIds?.includes('c2-p02-r2c2')) throw Error('CONDITIONAL_FIXTURE_NO_TRANSFORMATION');
  }
  if (spec.publicCounterpart) { act(b, { type: 'REVEAL_CHARACTER' }); settle(); }
  if (spec.defending) { act(a, { type: 'REVEAL_CHARACTER' }); settle(); }
  if (spec.truth && conversion) {
    act(a, { type: 'ATTACK', cardInstanceId: conversion, targetIds: [b], dedicated: false });
    until(state => state.windows?.at(-1)?.kind === 'normal-defense');
    const option = viewFor(game, b).abilityOptions.find(option => option.abilityId === 'c2-p03-r2c1-ab01');
    if (!option) throw Error('CONDITIONAL_FIXTURE_NO_CONVERSION');
    act(b, { type: 'USE_ABILITY', abilityId: option.abilityId, targetEventId: option.targetEventId }); settle(Array(100).fill(6));
    if (game.players[a]!.faction !== 'GOOD') throw Error('CONDITIONAL_FIXTURE_NOT_GOOD');
    if (game.seatOrder[game.turnSeat] === a) finish(a);
    if (game.seatOrder[game.turnSeat] !== b || game.phase !== 'turn-start') throw Error('CONDITIONAL_FIXTURE_CONVERSION_TURN_END');
    for (const actor of game.seatOrder.slice(1)) { start(actor); finish(actor); }
    start(a);
    for (const actor of [c, d]) { act(actor, { type: 'REVEAL_CHARACTER' }); settle(); }
  }
  game.events = [];
  if (spec.defending && attack) {
    act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: false });
    until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  }
  return game;
}
