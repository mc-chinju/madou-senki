import { allCardInstanceIds, createGame, derivedStats, transition, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand, readySetup } from './scenario-tools.js';

export const beastCaptureScenarioNames = ['beast-capture', 'beast-capture-no-beasts', 'beast-capture-guard', 'beast-capture-blocked', 'beast-capture-lethal'] as const;
export type BeastCaptureScenarioName = typeof beastCaptureScenarioNames[number];
export function isBeastCaptureScenario(name: string): name is BeastCaptureScenarioName {
  return (beastCaptureScenarioNames as readonly string[]).includes(name);
}
/** Historical ownership and damage only; the attack and every subsequent ability choice are real commands. */
export function makeBeastCaptureScenario(name: BeastCaptureScenarioName, players: { id: string; name: string }[]): GameState {
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy();
    const result = transition(game, input, random);
    if (!result.ok) throw Error(`BEAST_FIXTURE_${name}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(game)), input, random))) throw Error('BEAST_FIXTURE_REPLAY');
    game = result.state;
    const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('BEAST_FIXTURE_CARDS');
  }
  function place(reference: string) {
    const id = takeCard(game, b, reference);
    game.players[b]!.hand = game.players[b]!.hand.filter(card => card !== id);
    game.players[b]!.followers.push({ cardInstanceId: id, revealed: false });
  }
  readySetup(()=>game,id=>act(id,{type:'PASS_SETUP'}));
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  assignCharacter(game, a, '獣使いのウパニシャット'); assignCharacter(game, b, '侍大将のシン');
  assignCharacter(game, c, '黒妖精のアーネス'); assignCharacter(game, d, '魔導王ガイナス');
  for (const player of Object.values(game.players)) player.permanent = { spirit: 12, endurance: 50 };
  if (name === 'beast-capture-no-beasts') { place('メタルゴーレム'); place('兵士'); }
  else if (name === 'beast-capture-blocked') { place('メタルゴーレム'); place('飛竜'); }
  else if (name === 'beast-capture-guard') { place('グリフォン'); place('親衛隊'); }
  else { place('グリフォン'); place('飛竜'); }
  if (name === 'beast-capture-lethal') {
    game.players[b]!.damage = derivedStats(game.players[b]!).endurance - 1;
    const gift = takeCard(game, b, 'a2-p02-r3c3'); const card = takeCard(game, b, '必勝の祈り');
    trimHand(game, b, gift, card);
  }
  const attack = takeCard(game, a, '黒翼飛翔剣'); const fate = takeCard(game, c, '命運凶変');
  trimHand(game, a, attack); trimHand(game, c, fate);
  game.events = [];
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: false });
  for (let i = 0; i < 300; i++) {
    const window = game.windows?.at(-1);
    if (window?.kind === 'attack-abilities') return game;
    if (!window) throw Error('BEAST_FIXTURE_NO_WINDOW');
    act(window.participants[window.cursor]!, { type: 'PASS' });
  }
  throw Error('BEAST_FIXTURE_NOT_READY');
}
