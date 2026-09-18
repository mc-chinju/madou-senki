import { allCardInstanceIds, createGame, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand, readySetup } from './scenario-tools.js';

export const namedResponseScenarioNames = [
  'response-mirror-attacker',
  'response-mirror-third',
  'response-mirror-hidden-source',
  'response-mirror-hidden-owner',
  'response-sorrow',
  'response-sorrow-hidden-source',
  'response-sorrow-unrelated',
] as const;
export type NamedResponseScenarioName = typeof namedResponseScenarioNames[number];
export function isNamedResponseScenario(name: string): name is NamedResponseScenarioName {
  return namedResponseScenarioNames.some(candidate => candidate === name);
}

/** Actual reveals, transformation, attack and source declaration; no response is preselected. */
export function makeNamedResponseScenario(name: NamedResponseScenarioName, players: { id: string; name: string }[]): GameState {
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command };
    const random = entropy();
    const result = transition(game, input, random);
    if (!result.ok) throw Error(`NAMED_RESPONSE_${name}_${command.type}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(game)), input, random))) throw Error('NAMED_RESPONSE_REPLAY');
    game = result.state;
    const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('NAMED_RESPONSE_CARDS');
  }
  function until(done: (state: GameState) => boolean) {
    for (let i = 0; i < 500; i++) {
      if (done(game)) return;
      const window = game.windows?.at(-1);
      if (!window) throw Error('NAMED_RESPONSE_NO_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('NAMED_RESPONSE_NOT_READY');
  }
  const sorrow = name.startsWith('response-sorrow');
  const third = name === 'response-mirror-third';
  const unrelated = name === 'response-sorrow-unrelated';
  assignCharacter(game, a, sorrow && !unrelated ? '聖騎士ランスロット' : third ? '小人のランバ' : '侍大将のシン');
  assignCharacter(game, b, sorrow ? '魔導王ガイナス' : '忍びのイダ');
  assignCharacter(game, c, unrelated ? '聖騎士ランスロット' : sorrow ? 'リーア姫' : third ? '侍大将のシン' : '邪祭ウーノス');
  assignCharacter(game, d, unrelated ? 'リーア姫' : sorrow ? '侍大将のシン' : '白魔術師シェリム');
  for (const player of Object.values(game.players)) player.permanent = { spirit: 12, endurance: 50 };
  const attack = takeCard(game, a, '白光');
  const evade = takeCard(game, a, '見切る');
  const fate = takeCard(game, d, '命運凶変');
  trimHand(game, a, attack, evade);
  trimHand(game, d, fate);
  readySetup(()=>game,id=>act(id,{type:'PASS_SETUP'}));
  act(a, { type: 'START_TURN' });
  act(a, { type: 'CHOOSE_DRAW', draw: false });
  if (sorrow) {
    const knight = unrelated ? c : a;
    act(unrelated ? d : c, { type: 'REVEAL_CHARACTER' });
    until(state => viewFor(state, knight).lifecycleAbilities.includes('lancelot-transform'));
    act(knight, { type: 'USE_LIFECYCLE_ABILITY', ability: 'lancelot-transform' });
    until(state => !state.windows?.length);
    if (game.players[knight]!.characterId !== 'c2-p07-r1c1' || !game.players[knight]!.abilityCharacterIds?.includes('c2-p02-r2c2')) throw Error('NAMED_RESPONSE_TRANSFORMATION');
  } else if (name !== 'response-mirror-hidden-owner') {
    act(third ? c : a, { type: 'REVEAL_CHARACTER' });
    until(state => !state.windows?.length);
  }
  if (!name.endsWith('hidden-source')) {
    act(b, { type: 'REVEAL_CHARACTER' });
    until(state => !state.windows?.length);
  }
  game.events = [];
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: false });
  until(state => state.windows?.at(-1)?.kind === 'normal-defense');
  const abilityId = sorrow ? 'c2-p05-r2c2-ab02' : 'c2-p04-r2c2-ab01';
  const option = viewFor(game, b).abilityOptions.find(option => option.abilityId === abilityId);
  if (!option) throw Error('NAMED_RESPONSE_SOURCE_UNAVAILABLE');
  act(b, { type: 'USE_ABILITY', abilityId, targetEventId: option.targetEventId });
  return game;
}
