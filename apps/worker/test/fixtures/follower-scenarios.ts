import { allCardInstanceIds, createGame, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

export const followerScenarioNames = ['follower-initial', 'follower-royal', 'follower-regeneration', 'follower-rear-guard', 'follower-placement', 'magic-gate-ready', 'magic-gate-hidden-invalid', 'magic-gate-cancel', 'magic-gate-extra-slot'] as const;
export type FollowerScenarioName = typeof followerScenarioNames[number];
export function isFollowerScenario(name: string): name is FollowerScenarioName {
  return (followerScenarioNames as readonly string[]).includes(name);
}
export function makeFollowerScenario(name: FollowerScenarioName, players: { id: string; name: string }[]): GameState {
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  function act(actorId: string, command: GameCommand) {
    const input = { actorId, command }; const random = entropy();
    const result = transition(state, input, random);
    if (!result.ok) throw Error(`FOLLOWER_FIXTURE_${name}_${result.code}`);
    const replay = transition(JSON.parse(JSON.stringify(state)) as GameState, input, random);
    if (JSON.stringify(result) !== JSON.stringify(replay)) throw Error('FOLLOWER_FIXTURE_REPLAY');
    state = result.state;
    const ids = allCardInstanceIds(state);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('FOLLOWER_FIXTURE_CARDS');
  }
  function passUntil(done: () => boolean) {
    for (let step = 0; step < 500; step++) {
      if (done()) return;
      const window = state.windows?.at(-1);
      if (!window) throw Error(`FOLLOWER_FIXTURE_MISSING_WINDOW_${name}`);
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error(`FOLLOWER_FIXTURE_DID_NOT_CONVERGE_${name}`);
  }
  // Starting ownership and prior training are fixture preconditions; effects below use real transitions.
  function place(owner: string, cardName: string) {
    const id = takeCard(state, owner, cardName);
    state.players[owner]!.hand = state.players[owner]!.hand.filter(card => card !== id);
    state.players[owner]!.followers.push({ cardInstanceId: id, revealed: false });
    return id;
  }
  if (name === 'follower-initial') {
    assignCharacter(state, a, '魔導王ガイナス');
    takeCard(state, a, 'アルケミア城'); takeCard(state, a, '砦'); return state;
  }
  for (const player of players) act(player.id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  assignCharacter(state, a, '魔導王ガイナス'); assignCharacter(state, b, 'リーア姫');
  assignCharacter(state, c, '白魔術師シェリム'); assignCharacter(state, d, '黒騎士ガーウィン');
  state.events = [];
  if (name === 'follower-placement') {
    place(a, '闇の聖女'); place(a, 'ゴブリン');
    takeCard(state, a, '砦'); takeCard(state, a, 'アルケミア城'); return state;
  }
  if (name.startsWith('magic-gate-')) {
    place(a, '闇の聖女'); const replacement = place(a, 'ゴブリン');
    place(b, name === 'magic-gate-hidden-invalid' ? 'アルケミア城' : '砦'); place(b, '市民');
    const source = takeCard(state, a, '魔招門'); trimHand(state, a, source);
    if (name === 'magic-gate-extra-slot') {
      const blessing = takeCard(state, a, '祝福');
      state.players[a]!.hand = state.players[a]!.hand.filter(card => card !== blessing);
      state.players[a]!.open.push(blessing);
    }
    if (name === 'magic-gate-cancel') {
      const fate = takeCard(state, b, '命運凶変'); trimHand(state, b, fate);
      act(a, { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: source, targetIds: [b], dedicated: false,
        followerTransfer: { targetPosition: 0, destinationPosition: 0, replacementCardInstanceId: replacement } });
      passUntil(() => viewFor(state, b).reactionTargetActionId !== null && viewFor(state, b).activeWindow?.pendingActorId === b);
    }
    return state;
  }
  state.players[b]!.permanent = { spirit: 12 };
  if (name === 'follower-royal') place(b, '王立騎士団');
  else if (name === 'follower-regeneration') place(b, 'スケルトン');
  else { place(b, 'ゴブリン'); place(b, '親衛隊'); assignCharacter(state, a, '黒妖精のアーネス'); }
  const attack = takeCard(state, a, name === 'follower-royal' ? '踏み込み／弓' : name === 'follower-regeneration' ? '破黒剣' : '黒流弓');
  state.distances[a]![b] = state.distances[b]![a] = 'near';
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: name === 'follower-rear-guard' });
  passUntil(() => viewFor(state, b).activeWindow?.kind === 'normal-defense');
  return state;
}
