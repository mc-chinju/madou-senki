import { allCardInstanceIds, createGame, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand, readySetup } from './scenario-tools.js';

export const followerEntryScenarioNames = ['entry-arnes', 'entry-arnes-cancel', 'entry-lester-spirit', 'entry-lester-hidden', 'entry-lester-revealed', 'entry-tia'] as const;
export type FollowerEntryScenarioName = typeof followerEntryScenarioNames[number];
export function isFollowerEntryScenario(name: string): name is FollowerEntryScenarioName {
  return (followerEntryScenarioNames as readonly string[]).includes(name);
}
/** Prior ownership/training only; every attack is declared through the actual engine. */
export function makeFollowerEntryScenario(name: FollowerEntryScenarioName, players: { id: string; name: string }[]): GameState {
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy();
    const result = transition(state, input, random);
    if (!result.ok) throw Error(`FOLLOWER_ENTRY_FIXTURE_${name}_${result.code}`);
    if (JSON.stringify(result) !== JSON.stringify(transition(JSON.parse(JSON.stringify(state)) as GameState, input, random))) throw Error('FOLLOWER_ENTRY_FIXTURE_REPLAY');
    state = result.state;
    const ids = allCardInstanceIds(state);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('FOLLOWER_ENTRY_FIXTURE_CARDS');
  }
  function until(done: () => boolean) {
    for (let i = 0; i < 500; i++) {
      if (done()) return;
      const window = state.windows?.at(-1);
      if (!window) throw Error(`FOLLOWER_ENTRY_FIXTURE_NO_WINDOW_${name}`);
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('FOLLOWER_ENTRY_FIXTURE_NOT_FINISHED');
  }
  function place(owner: string, cardName: string) {
    const id = takeCard(state, owner, cardName);
    state.players[owner]!.hand = state.players[owner]!.hand.filter(card => card !== id);
    state.players[owner]!.followers.push({ cardInstanceId: id, revealed: false });
    return id;
  }
  readySetup(()=>state,id=>act(id,{type:'PASS_SETUP'}));
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  const lester = name.startsWith('entry-lester');
  assignCharacter(state, a, lester ? '吟遊詩人のレスター' : name === 'entry-tia' ? '有翼人のティア' : '魔聖母ディア');
  assignCharacter(state, b, '黒妖精のアーネス'); assignCharacter(state, c, '獣使いのウパニシャット'); assignCharacter(state, d, '侍大将のシン');
  for (const player of Object.values(state.players)) player.permanent = { spirit: 12, endurance: 50 };
  state.players[a]!.permanent = { ...state.players[a]!.permanent, warrior_level: 8, magic_level: 8 };
  state.events = [];
  if (name === 'entry-lester-revealed') act(b, { type: 'REVEAL_CHARACTER' });
  if (name === 'entry-tia') act(a, { type: 'REVEAL_CHARACTER' });
  until(() => !state.windows?.length);
  if (name === 'entry-arnes-cancel' || name === 'entry-lester-hidden') { const fate = takeCard(state, c, '命運凶変'); trimHand(state, c, fate); }
  if (lester) {
    if (name === 'entry-lester-spirit') place(b, 'ウッドゴーレム');
    else { place(b, '兵士'); place(b, '女性親衛隊'); }
    const sword = takeCard(state, a, '黒翼飛翔剣'); trimHand(state, a, sword);
    act(a, { type: 'ATTACK', cardInstanceId: sword, targetIds: [b], dedicated: false });
    until(() => viewFor(state, a).activeWindow?.kind === 'attack-abilities');
  } else if (name === 'entry-tia') {
    place(b, '兵士'); place(c, 'グリフォン');
    const arrow = takeCard(state, a, '風矢');
    const first = takeCard(state, a, 'a2-p23-r1c2'); const second = takeCard(state, a, 'a2-p23-r1c3');
    trimHand(state, a, arrow, first, second);
    act(a, { type: 'ATTACK', cardInstanceId: arrow, targetIds: [b, c], dedicated: true });
    until(() => viewFor(state, b).activeWindow?.kind === 'normal-defense');
  } else {
    const dwarves = place(a, '小人族');
    const option = viewFor(state, a).followerBundleOptions.find(option => option.abilityId === 'c2-p06-r1c2-ab04');
    if (!option) throw Error('FOLLOWER_ENTRY_FIXTURE_C10_NOT_OFFERED');
    act(a, { type: 'USE_FOLLOWER_ATTACK', abilityId: option.abilityId, targetEventId: option.targetEventId,
      sources: [{ cardInstanceId: dwarves, dedicated: false, targetIds: [b] }] });
    until(() => viewFor(state, b).activeWindow?.kind === 'normal-defense');
  }
  return state;
}
