import { allCardInstanceIds, createGame, derivedStats, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

export const lifetimeScenarioNames = ['lifetime-mekai-defense', 'lifetime-heal', 'lifetime-revive', 'lifetime-soul', 'lifetime-fixed-stop', 'lifetime-deadly-stop', 'lifetime-otherworld'] as const;
export type LifetimeScenarioName = typeof lifetimeScenarioNames[number];
export function isLifetimeScenario(name: string): name is LifetimeScenarioName { return (lifetimeScenarioNames as readonly string[]).includes(name); }
export function makeLifetimeScenario(name: LifetimeScenarioName, players: { id: string; name: string }[]): GameState {
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  const act = (actorId: string, command: GameCommand, dice = entropy().dice) => {
    const outcome = transition(state, { actorId, command }, { ...entropy(), dice });
    if (!outcome.ok) throw Error(`LIFETIME_FIXTURE_${outcome.code}`);
    const replay = transition(JSON.parse(JSON.stringify(state)) as GameState, { actorId, command }, { ...entropy(), dice });
    if (JSON.stringify(outcome) !== JSON.stringify(replay)) throw Error('LIFETIME_FIXTURE_REPLAY');
    state = outcome.state;
    if (allCardInstanceIds(state).length !== 220 || new Set(allCardInstanceIds(state)).size !== 220) throw Error('LIFETIME_FIXTURE_CARDS');
  };
  const passUntil = (done: () => boolean, failResistance = false) => {
    for (let i = 0; i < 400; i++) {
      if (done()) return;
      const w = state.windows?.at(-1); if (!w) throw Error('LIFETIME_FIXTURE_MISSING_WINDOW');
      const resistance = state.rolls?.at(-1)?.purpose === 'status-resistance';
      act(w.participants[w.cursor]!, { type: 'PASS' }, Array(100).fill(failResistance && resistance ? 6 : 1));
    }
    throw Error('LIFETIME_FIXTURE_DID_NOT_FINISH');
  };
  const chant = (id: string) => { takeCard(state, a, id); state.players[a]!.hand = state.players[a]!.hand.filter(card => card !== id); state.players[a]!.chants.push({ cardInstanceId: id, revealed: false }); };
  const top = (id: string) => { takeCard(state, a, id); state.players[a]!.hand = state.players[a]!.hand.filter(card => card !== id); state.deck.unshift(id); };
  for (const p of players) act(p.id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  assignCharacter(state, a, '大神官ジル'); assignCharacter(state, b, '黒騎士ガーウィン');
  assignCharacter(state, c, '白魔術師シェリム'); assignCharacter(state, d, '魔導王ガイナス');
  state.events = [];
  if (name === 'lifetime-mekai-defense') {
    assignCharacter(state, a, '邪祭ウーノス'); chant('a2-p13-r2c3');
    takeCard(state, b, 'a2-p18-r2c2'); takeCard(state, b, 'a2-p06-r1c1');
    act(a, { type: 'ATTACK', cardInstanceId: 'a2-p13-r2c3', targetIds: [b], dedicated: false });
    passUntil(() => state.windows?.at(-1)?.kind === 'normal-defense'); return state;
  }
  if (name === 'lifetime-heal') {
    takeCard(state, a, 'a2-p14-r3c1'); state.players[a]!.damage = 3; state.players[b]!.damage = 4;
    // Prior training makes this UI routing case deterministic; engine tests cover failed checks.
    state.players[a]!.permanent = { magic_level: 12, warrior_level: 12, spirit: 12 };
    state.distances[a]![b] = state.distances[b]![a] = 'near'; return state;
  }
  if (name === 'lifetime-revive') {
    assignCharacter(state, a, '邪祭ウーノス'); assignCharacter(state, b, '大神官ジル');
    const attack = takeCard(state, a, '踏み込み／弓'); takeCard(state, a, 'a2-p13-r3c1');
    trimHand(state, a, attack, 'a2-p13-r3c1'); state.players[b]!.damage = derivedStats(state.players[b]!).endurance - 1;
    act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: false });
    passUntil(() => !state.windows?.length);
    if (state.players[b]!.presence !== 'dead') throw Error('LIFETIME_FIXTURE_DEATH');
    top('a2-p18-r3c3');
    act(a, { type: 'PASS_WITHDRAWAL' }); act(a, { type: 'END_TURN', discardIds: [] });
    for (const id of [c, d]) {
      act(id, { type: 'START_TURN' }); act(id, { type: 'CHOOSE_DRAW', draw: false });
      act(id, { type: 'PASS_ACTION' }); act(id, { type: 'END_TURN', discardIds: [] });
    }
    act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false }); return state;
  }
  if (name === 'lifetime-soul' || name === 'lifetime-deadly-stop') {
    assignCharacter(state, a, '魔聖母ディア');
    const id = name === 'lifetime-soul' ? 'a2-p15-r2c3' : 'a2-p15-r3c1';
    if (name === 'lifetime-soul') takeCard(state, a, id); else chant(id);
    act(a, { type: 'ATTACK', cardInstanceId: id, targetIds: [b], dedicated: true });
    passUntil(() => name === 'lifetime-soul' ? viewFor(state, a).lifetimeDecision?.kind === 'soul-drain' : !state.windows?.length, true);
    return state;
  }
  if (name === 'lifetime-fixed-stop') {
    assignCharacter(state, a, '邪祭ウーノス'); chant('a2-p13-r3c3');
    act(a, { type: 'ATTACK', cardInstanceId: 'a2-p13-r3c3', targetIds: [b], dedicated: true });
    passUntil(() => viewFor(state, a).lifetimeDecision?.kind === 'fixed-stop'); return state;
  }
  assignCharacter(state, a, '白魔術師シェリム'); assignCharacter(state, c, '大神官ジル');
  const follower = takeCard(state, b, '兵士'); state.players[b]!.hand = state.players[b]!.hand.filter(id => id !== follower);
  state.players[b]!.followers.push({ cardInstanceId: follower, revealed: false });
  state.players[b]!.statuses = [{ id: 'prior-ability-suppression', kind: 'ability-disabled', modifiers: [-2], nextCheck: 0 }];
  chant('a2-p14-r2c2'); act(a, { type: 'ATTACK', cardInstanceId: 'a2-p14-r2c2', targetIds: [b], dedicated: true });
  passUntil(() => viewFor(state, a).lifetimeDecision?.kind === 'otherworld-modifier');
  act(a, { type: 'CHOOSE_LIFETIME_EFFECT', choice: 'apply' }); passUntil(() => !state.windows?.length, true);
  if (state.players[b]!.presence !== 'otherworld') throw Error('LIFETIME_FIXTURE_BANISHMENT');
  trimHand(state, a); act(a, { type: 'PASS_WITHDRAWAL' }); act(a, { type: 'END_TURN', discardIds: [] });
  act(c, { type: 'START_TURN' }); top('a2-p01-r1c2'); return state;
}
