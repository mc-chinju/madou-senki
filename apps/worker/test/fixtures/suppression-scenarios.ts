import { allCardInstanceIds, createGame, transition, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

export const suppressionScenarioNames = ['suppression-hidden-lia', 'suppression-hidden-ordinary', 'suppression-blessing', 'suppression-blessing-fail'] as const;
export type SuppressionScenarioName = typeof suppressionScenarioNames[number];
export function isSuppressionScenario(name: string): name is SuppressionScenarioName {
  return suppressionScenarioNames.some(value => value === name);
}
/** Initial deal/character assignment and stated prior spirit gains/losses are fixture inputs.
 * Ritual, transformation, turn progression and all suppression/lease effects use real commands.
 * No suppression designation, lease, ability frame or resolved roll is injected. */
export function makeSuppressionScenario(name: SuppressionScenarioName, players: { id: string; name: string }[]): GameState {
  if (players.length !== 4) throw Error('SUPPRESSION_FIXTURE_FOUR_SEATS');
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  const blessing = name === 'suppression-blessing' || name === 'suppression-blessing-fail';
  assignCharacter(game, a, '邪祭ウーノス');
  assignCharacter(game, b, name === 'suppression-hidden-lia' ? 'リーア姫' : '侍大将のシン');
  assignCharacter(game, c, blessing ? 'リーア姫' : '大神官ジル');
  assignCharacter(game, d, '占星術師のアルセイル');
  if (blessing) game.players[c]!.permanent = { ...game.players[c]!.permanent, spirit: name === 'suppression-blessing-fail' ? -10 : 20 };
  const ritual = takeCard(game, a, '復活の儀式');
  const fate = takeCard(game, d, '命運凶変');
  trimHand(game, a, ritual); trimHand(game, d, fate);
  function act(actorId: string, command: GameCommand) {
    const result = transition(game, { actorId, command }, entropy());
    if (!result.ok) throw Error(`SUPPRESSION_FIXTURE_${command.type}_${result.code}`);
    game = result.state;
    const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('SUPPRESSION_FIXTURE_CARDS');
  }
  function settle() {
    for (let i = 0; i < 150; i++) {
      const window = game.windows?.at(-1); if (!window) return;
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('SUPPRESSION_FIXTURE_WINDOW');
  }
  for (const id of [a, b, c, d]) act(id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' }); settle();
  act(a, { type: 'CHOOSE_DRAW', draw: false }); settle();
  act(a, { type: 'USE_REVIVAL_RITUAL' }); settle();
  if (game.players[a]!.characterId !== 'c2-p07-r1c2' || !game.players[a]!.revealed || game.players[a]!.abilityCharacterIds?.includes('c2-p05-r1c1')) throw Error('SUPPRESSION_FIXTURE_RITUAL');
  if (game.suppressionDesignations?.length || game.blessingLeases?.length) throw Error('SUPPRESSION_FIXTURE_INJECTED_EFFECT');
  return game;
}
