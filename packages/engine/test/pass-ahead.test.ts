import {describe, expect, it} from 'vitest';
import * as engine from '../src/index.js';
import {entropy, handCard} from './fixtures.js';
import {act, finish, pass, ready, until} from './combat-helpers.js';
import {legalCommands} from '../src/bot/index.js';
import {pruneStandingPasses} from '../src/reactions/windows.js';

function bowAttack(target = 'B') {
  let s = ready();
  const bow = handCard(s, 'A', '踏み込み／弓');
  s = act(s, 'A', {type: 'ATTACK', cardInstanceId: bow, targetIds: [target], dedicated: false});
  return s;
}
const top = (s: engine.GameState) => s.windows!.at(-1)!;
/** The same attack against a target that is already face up. A hit turns a hidden target over, and that ends
 *  every turn-long hand-over (G03), so a test about the range itself starts with nothing left to turn. */
function bowAttackOnRevealed() { const s = bowAttack(); s.players.B!.revealed = true; return s; }
const reject = (s: engine.GameState, actorId: string, command: unknown, code: string) => {
  const before = JSON.stringify(s);
  expect(engine.transition(s, {actorId, command} as engine.GameInput, entropy())).toEqual({ok: false, code});
  expect(JSON.stringify(s)).toBe(before);
};

describe('PASS before priority on public windows (G03)', () => {
  it('takes a later seat\'s pass while an earlier seat still holds priority', () => {
    let s = bowAttack();
    expect(top(s)).toMatchObject({kind: 'declaration', participants: ['A', 'B', 'C', 'D'], cursor: 0});
    s = act(s, 'A', {type: 'PASS'});
    const generation = top(s).revision;
    s = act(s, 'D', {type: 'PASS'});
    expect(top(s)).toMatchObject({kind: 'declaration', passed: ['A', 'D'], cursor: 1});
    // A pass leaves the other answers valid, so the window generation does not move.
    expect(top(s).revision).toBe(generation);
  });

  it('closes the window without asking a seat that already passed', () => {
    let s = bowAttack();
    const windowId = top(s).id;
    s = act(s, 'D', {type: 'PASS'});
    s = act(s, 'A', {type: 'PASS'});
    s = act(s, 'B', {type: 'PASS'});
    expect(top(s).id).toBe(windowId);
    s = act(s, 'C', {type: 'PASS'});
    expect(top(s).id).not.toBe(windowId);
  });

  it('moves priority past the seats that passed ahead', () => {
    let s = bowAttack();
    s = act(s, 'A', {type: 'PASS'});
    s = act(s, 'C', {type: 'PASS'});
    s = act(s, 'B', {type: 'PASS'});
    expect(top(s)).toMatchObject({kind: 'declaration', cursor: 3});
    expect(engine.viewFor(s, 'D').activeWindow).toMatchObject({pendingActorId: 'D', passedActorIds: ['A', 'C', 'B'], passAhead: true});
  });

  it('rejects a second pass in the same generation', () => {
    let s = bowAttack();
    s = act(s, 'D', {type: 'PASS'});
    reject(s, 'D', {type: 'PASS'}, 'NOT_PRIORITY');
  });

  it('still refuses a real play from a seat without priority', () => {
    let s = bowAttack();
    const fate = handCard(s, 'D', '命運凶変');
    const actionId = Object.keys(s.actions!)[0]!;
    reject(s, 'D', {type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel', targetActionId: actionId}, 'NOT_PRIORITY');
  });

  it('drops the passes given ahead when someone intervenes', () => {
    let s = bowAttack();
    const fate = handCard(s, 'B', '命運凶変');
    const actionId = Object.keys(s.actions!)[0]!;
    const declaration = top(s).id;
    s = act(s, 'A', {type: 'PASS'});
    s = act(s, 'D', {type: 'PASS'});
    s = act(s, 'B', {type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel', targetActionId: actionId});
    for (let n = 0; n < 40 && top(s).id !== declaration; n++) s = pass(s);
    const parent = s.windows!.find(w => w.id === declaration)!;
    expect(parent.passed).toEqual([]);
    expect(engine.viewFor(s, 'D').legalChoices).toContain('PASS');
  });

  it('drops the passes given ahead when someone reveals their character', () => {
    let s = bowAttack();
    s = act(s, 'A', {type: 'PASS'});
    s = act(s, 'D', {type: 'PASS'});
    s = act(s, 'C', {type: 'REVEAL_CHARACTER'});
    expect(top(s)).toMatchObject({kind: 'declaration', passed: [], cursor: 0});
  });

  it('keeps single-respondent and alternating windows on priority only', () => {
    let s = ready();
    const advance = handCard(s, 'A', '踏み込み／弓');
    s = act(s, 'A', {type: 'APPROACH', targetId: 'B', cardInstanceId: advance});
    expect(top(s).kind).toBe('approach');
    reject(s, 'C', {type: 'PASS'}, 'NOT_PRIORITY');

    let defense = bowAttack();
    defense = until(defense, 'normal-defense');
    reject(defense, 'C', {type: 'PASS'}, 'NOT_PRIORITY');
  });

  it('keeps the wish and death windows on priority only', () => {
    let s = bowAttack();
    const wish = structuredClone(s);
    top(wish).kind = 'wish';
    reject(wish, 'D', {type: 'PASS'}, 'WRONG_PHASE');
    for (const kind of ['death-gift', 'lifecycle-boundary'] as const) {
      const probe = structuredClone(s);
      top(probe).kind = kind;
      reject(probe, 'D', {type: 'PASS'}, 'NOT_PRIORITY');
    }
  });

  it('offers a respondent without priority only the pass and the public reveal', () => {
    let s = bowAttack();
    expect(engine.viewFor(s, 'D').legalChoices).toEqual(['REVEAL_CHARACTER', 'PASS', 'PASS_ACTION_THROUGH']);
    s = act(s, 'D', {type: 'PASS'});
    expect(engine.viewFor(s, 'D').legalChoices).toEqual(['REVEAL_CHARACTER']);
  });
});

describe('passing a whole action through (G03)', () => {
  it('fills in the later windows of the same action for the seats that left it', () => {
    let s = bowAttack();
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH'});
    expect(s.standingPasses).toMatchObject([{scope: 'action', actorIds: ['C', 'D']}]);
    s = act(s, 'A', {type: 'PASS'});
    s = act(s, 'B', {type: 'PASS'});
    // Every later public window of this attack already carries C and D, right through to the hit.
    const kinds: string[] = [];
    for (let n = 0; n < 30 && s.windows?.length && top(s).kind !== 'lifecycle-boundary'; n++) {
      const w = top(s); kinds.push(w.kind);
      expect(w.participants.filter(id => ['C', 'D'].includes(id) && !w.passed.includes(id)), w.kind).toEqual([]);
      s = act(s, w.participants[w.cursor]!, {type: 'PASS'});
    }
    expect(kinds).toEqual(expect.arrayContaining(['effect-level', 'damage', 'attack-abilities', 'normal-defense', 'follower-entry-abilities', 'hit']));
    expect(s.players.B!.damage).toBeGreaterThan(0);
  });

  it('reaches the defender in one step when every seat leaves the action', () => {
    let s = bowAttack();
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'B', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'A', {type: 'PASS_ACTION_THROUGH'});
    expect(top(s)).toMatchObject({kind: 'normal-defense', participants: ['B']});
  });

  it('asks the third parties again once the defender plays a card', () => {
    let s = bowAttack();
    const teleport = handCard(s, 'B', '転移');
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'A', {type: 'PASS'});
    s = act(s, 'B', {type: 'PASS'});
    s = until(s, 'normal-defense');
    s = act(s, 'B', {type: 'PLAY_DEFENSE', cardInstanceId: teleport, dedicated: false});
    expect(s.standingPasses).toBeUndefined();
    expect(top(s)).toMatchObject({kind: 'declaration', passed: []});
    expect(engine.viewFor(s, 'D').legalChoices).toContain('PASS_ACTION_THROUGH');
  });

  it('drops every standing pass when someone reveals their character', () => {
    let s = bowAttack();
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'B', {type: 'REVEAL_CHARACTER'});
    expect(s.standingPasses).toBeUndefined();
    expect(top(s)).toMatchObject({kind: 'declaration', passed: []});
  });

  it('is never offered to a bot, which keeps answering window by window', () => {
    const s = bowAttack();
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(engine.viewFor(s, id).legalChoices).toContain('PASS_ACTION_THROUGH');
      expect(legalCommands(engine.viewFor(s, id)).map(command => command.type)).not.toContain('PASS_ACTION_THROUGH');
    }
  });

  it('does not carry a standing pass into the next attack', () => {
    let s = bowAttack();
    for (const id of ['A', 'B', 'C', 'D']) s = act(s, id, {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'B', {type: 'PASS'});
    for (let n = 0; n < 60 && s.windows?.length; n++) s = pass(s);
    expect(s.standingPasses).toBeUndefined();
  });

  it('keeps the passes already recorded when the seat cancels', () => {
    let s = bowAttack();
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH'});
    expect(engine.viewFor(s, 'D').legalChoices).toEqual(expect.arrayContaining(['CANCEL_PASS_THROUGH']));
    s = act(s, 'D', {type: 'CANCEL_PASS_THROUGH'});
    expect(s.standingPasses).toBeUndefined();
    expect(top(s).passed).toEqual(['D']);
    reject(s, 'D', {type: 'PASS'}, 'NOT_PRIORITY');
  });

  it('asks a seat again on the windows opened after it cancels', () => {
    let s = bowAttack();
    handCard(s, 'D', '命運凶変');
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'D', {type: 'CANCEL_PASS_THROUGH'});
    // The pass already given to the open window stays; only the later ones come back.
    expect(top(s).passed).toEqual(['D']);
    s = act(s, 'A', {type: 'PASS'});
    s = act(s, 'B', {type: 'PASS'});
    s = act(s, 'C', {type: 'PASS'});
    for (let n = 0; n < 10 && top(s).participants[top(s).cursor] !== 'D'; n++) s = pass(s);
    expect(top(s).passed).not.toContain('D');
    expect(engine.viewFor(s, 'D').legalChoices).toContain('PLAY_REACTION');
  });

  it('records one public line per action and nothing for the passes it fills in', () => {
    let s = bowAttack();
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'A', {type: 'PASS'});
    s = act(s, 'B', {type: 'PASS'});
    s = until(s, 'normal-defense');
    const passes = s.events.filter(e => e.type === 'PASSED' && e.actorId === 'C');
    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({windowKind: 'action-through', audience: 'public'});
  });

  it('refuses to leave an action on a window that is not a public one', () => {
    let s = until(bowAttack(), 'normal-defense');
    reject(s, 'B', {type: 'PASS_ACTION_THROUGH'}, 'WRONG_PHASE');
    reject(s, 'B', {type: 'CANCEL_PASS_THROUGH'}, 'WRONG_PHASE');
  });

  it('takes the action back from a window that keeps priority strictly', () => {
    let s = bowAttack();
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH'});
    s = until(s, 'normal-defense');
    expect(top(s)).toMatchObject({kind: 'normal-defense', participants: ['B']});
    // D is not asked on this window, but the standing pass it gave is still running (G03).
    expect(engine.viewFor(s, 'D').legalChoices).toContain('CANCEL_PASS_THROUGH');
    expect(engine.viewFor(s, 'D').legalChoices).not.toContain('PASS_ACTION_THROUGH');
    s = act(s, 'D', {type: 'CANCEL_PASS_THROUGH'});
    expect(s.standingPasses).toBeUndefined();
    expect(engine.viewFor(s, 'D').legalChoices).not.toContain('CANCEL_PASS_THROUGH');
  });

  it.each(['wish', 'wish-capacity', 'private-inspection'] as const)('allows cancellation during %s without answering that private decision', kind => {
    let s = act(bowAttack(), 'D', {type: 'PASS_ACTION_THROUGH'});
    // Model an outstanding private decision while D's standing pass is still active.
    Object.assign(top(s), {kind, participants: ['B'], passed: [], cursor: 0});
    const decision = structuredClone(top(s));
    expect(engine.viewFor(s, 'D').legalChoices).toContain('CANCEL_PASS_THROUGH');
    reject(s, 'D', {type: 'PASS'}, 'WRONG_PHASE');
    s = act(s, 'D', {type: 'CANCEL_PASS_THROUGH'});
    expect(s.standingPasses).toBeUndefined();
    expect(top(s)).toEqual(decision);
  });
});

describe('passing a whole turn through (G03)', () => {
  /** Run the rest of A's turn out and hand the table to B. */
  function endTurn(s: engine.GameState) {
    s = finish(s);
    if (s.phase === 'withdrawal') s = act(s, 'A', {type: 'PASS_WITHDRAWAL'});
    const limit = engine.gameStats(s, 'A').handLimit;
    return act(s, 'A', {type: 'END_TURN', discardIds: s.players.A!.hand.slice(0, Math.max(0, s.players.A!.hand.length - limit))});
  }

  it('fills in the next action of the same turn, which an action-long pass no longer reaches', () => {
    let s = bowAttackOnRevealed();
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH'});
    s = finish(s);
    expect(s.standingPasses).toEqual([{scope: 'turn', turnNumber: 0, actorIds: ['C']}]);
    // The turn holds more than one action in a real game; here the second one is declared in its own right.
    s.phase = 'action';
    s = act(s, 'A', {type: 'ATTACK', cardInstanceId: handCard(s, 'A', '踏み込み／弓'), targetIds: ['B'], dedicated: false});
    expect(top(s)).toMatchObject({kind: 'declaration', passed: ['C'], cursor: 0});
    expect(engine.viewFor(s, 'D').legalChoices).toContain('PASS_ACTION_THROUGH');
  });

  it('drops it when someone intervenes, and asks that seat again', () => {
    let s = bowAttack();
    const teleport = handCard(s, 'B', '転移');
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    s = until(s, 'normal-defense');
    s = act(s, 'B', {type: 'PLAY_DEFENSE', cardInstanceId: teleport, dedicated: false});
    expect(s.standingPasses).toBeUndefined();
    expect(top(s)).toMatchObject({kind: 'declaration', passed: []});
    expect(engine.viewFor(s, 'D').legalChoices).toContain('PASS_ACTION_THROUGH');
  });

  it('ends with the turn it was given in', () => {
    let s = bowAttack();
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    s = endTurn(s);
    expect(s.seatOrder[s.turnSeat]).toBe('B');
    expect(s.standingPasses).toBeUndefined();
  });

  it('keeps each seat on the range it chose, and lets a seat move up to the whole turn', () => {
    let s = bowAttackOnRevealed();
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    expect(s.standingPasses).toMatchObject([{scope: 'action', actorIds: ['C']}, {scope: 'turn', actorIds: ['D']}]);
    // Both ranges cover the rest of this action, so the later windows of it carry the two seats alike.
    s = until(s, 'normal-defense');
    expect(s.windows!.filter(w => w.participants.includes('C')).every(w => w.passed.includes('C') && w.passed.includes('D'))).toBe(true);
    // Taking the action-long pass back and pressing again leaves that seat on the whole turn.
    s = act(s, 'C', {type: 'CANCEL_PASS_THROUGH'});
    s = finish(s);
    s.phase = 'action';
    s = act(s, 'A', {type: 'ATTACK', cardInstanceId: handCard(s, 'A', '踏み込み／弓'), targetIds: ['B'], dedicated: false});
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    expect(s.standingPasses).toEqual([{scope: 'turn', turnNumber: 0, actorIds: ['D', 'C']}]);
  });

  it('records the range it was given for, and nothing for the passes it fills in', () => {
    let s = bowAttack();
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    s = until(s, 'normal-defense');
    const passes = s.events.filter(e => e.type === 'PASSED' && e.actorId === 'D');
    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({windowKind: 'turn-through', audience: 'public'});
  });

  it('ends when a seat reveals itself with no window open', () => {
    let s = bowAttackOnRevealed();
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    s = finish(s);
    // The action is over and the turn goes on, so nothing is open to answer; the reveal still ends the pass.
    expect(s.windows?.length ?? 0).toBe(0);
    expect(s.standingPasses).toEqual([{scope: 'turn', turnNumber: 0, actorIds: ['D']}]);
    s = act(s, 'C', {type: 'REVEAL_CHARACTER'});
    expect(s.standingPasses).toBeUndefined();
  });

  it('ends when a death reveals a character, though no command asked for the reveal', async () => {
    const {settleDamage} = await import('../src/index.js');
    let s = bowAttack();
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    expect(s.standingPasses).toEqual([{scope: 'turn', turnNumber: 0, actorIds: ['D']}]);
    // A seat can die without an attack ever reaching it, and the reveal that comes with the death is written
    // by the engine rather than asked for by a command. At the table it is the same change of situation.
    expect(s.players.C!.revealed).toBe(false);
    settleDamage(s, [{targetId: 'C', damage: 0, instantDeath: true, cause: 'instant-death', eventId: 'death-event'}], 1000);
    expect(s.events.some(e => e.type === 'CHARACTER_REVEALED' && e.actorId === 'C')).toBe(true);
    expect(s.standingPasses).toBeUndefined();
  });

  it('goes out with a seat that is no longer at the table', () => {
    let s = bowAttack();
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    expect(s.standingPasses).toEqual([{scope: 'turn', turnNumber: 0, actorIds: ['C', 'D']}]);
    // A seat that left the table is not leaving its answers to anyone, so the others stop being told it is.
    s.players.C!.presence = 'dead';
    pruneStandingPasses(s);
    expect(s.standingPasses).toEqual([{scope: 'turn', turnNumber: 0, actorIds: ['D']}]);
  });

  it('records the range it was given for, so two actions of one turn are never read as one', () => {
    let s = bowAttack();
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH'});
    s = finish(s);
    s.phase = 'action';
    s = act(s, 'A', {type: 'ATTACK', cardInstanceId: handCard(s, 'A', '踏み込み／弓'), targetIds: ['B'], dedicated: false});
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH'});
    const ranges = s.events.filter(e => e.type === 'PASSED' && e.windowKind === 'action-through').map(e => e.standingRange);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toBeDefined();
    expect(ranges[0]).not.toBe(ranges[1]);
    // The range has to reach the reader, or the record folds the two actions into one line again.
    expect(engine.viewFor(s, 'B').logs.filter(log => log.windowKind === 'action-through').map(log => log.standingRange)).toEqual(ranges);
    // A turn-long pass names the turn instead, so pressing it twice in one turn is the one range it is.
    const turn = act(act(bowAttack(), 'C', {type: 'PASS_ACTION_THROUGH', scope: 'turn'}), 'D', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    expect(turn.events.filter(e => e.windowKind === 'turn-through').map(e => e.standingRange)).toEqual(['turn-0', 'turn-0']);
  });

  it('ends at a hit that turns its target face up, while the action-long hand-over beside it stands', () => {
    let s = bowAttack();
    s = act(s, 'C', {type: 'PASS_ACTION_THROUGH'});
    s = act(s, 'D', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    expect(s.players.B!.revealed).toBe(false);
    // The hit is the result of the action C handed over, so C stays out of the rest of it; for D the identity
    // it turned up is new information about the actions this turn still holds, so D is asked again.
    s = until(s, 'hit-abilities');
    expect(s.players.B!.revealed).toBe(true);
    expect(s.standingPasses).toEqual([{scope: 'action', rootEventId: expect.any(String), actorIds: ['C']}]);
    expect(top(s).passed).toContain('C');
    expect(top(s).passed).not.toContain('D');
    expect(engine.viewFor(s, 'D').legalChoices).toContain('PASS_ACTION_THROUGH');
    // The rest of this action keeps filling itself in for C, right through to the end of the attack.
    for (let n = 0; n < 30 && s.windows?.length && top(s).kind !== 'lifecycle-boundary'; n++) {
      const w = top(s);
      expect(w.participants.includes('C') && !w.passed.includes('C'), w.kind).toBe(false);
      s = act(s, w.participants[w.cursor]!, {type: 'PASS'});
    }
    // The next action of the same turn asks D again, which is what the turn-long hand-over would have covered.
    s = finish(s);
    s.phase = 'action';
    s = act(s, 'A', {type: 'ATTACK', cardInstanceId: handCard(s, 'A', '踏み込み／弓'), targetIds: ['B'], dedicated: false});
    expect(top(s)).toMatchObject({kind: 'declaration', passed: []});
    expect(engine.viewFor(s, 'D').legalChoices).toContain('PASS');
  });

  it('is never offered to a bot, which keeps answering window by window', () => {
    const s = act(bowAttack(), 'D', {type: 'PASS_ACTION_THROUGH', scope: 'turn'});
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(legalCommands(engine.viewFor(s, id)).map(command => command.type)).not.toContain('PASS_ACTION_THROUGH');
    }
  });
});

describe('stopped seats on public windows (11.2, G03)', () => {
  it('drops the stopped seat from every public window of an attack', () => {
    let s = ready();
    s.players.D!.statuses = [{id: 'stop-d', kind: 'stopped', modifiers: [0], nextCheck: 1}];
    const bow = handCard(s, 'A', '踏み込み／弓');
    s = act(s, 'A', {type: 'ATTACK', cardInstanceId: bow, targetIds: ['C'], dedicated: false});
    s = act(s, 'A', {type: 'PASS'});
    s = act(s, 'B', {type: 'PASS'});
    s = act(s, 'C', {type: 'PASS'});
    for (let n = 0; n < 10 && top(s).kind !== 'normal-defense'; n++) {
      expect(top(s).participants).not.toContain('D');
      s = act(s, top(s).participants[top(s).cursor]!, {type: 'PASS'});
    }
    expect(top(s).kind).toBe('normal-defense');
  });

  it('leaves a stopped seat with nothing but a pass and a public reveal on any public window', () => {
    let s = bowAttack('C');
    for (const kind of ['declaration', 'before-roll', 'after-roll', 'effect-level', 'damage', 'hit', 'attack-abilities', 'hit-abilities', 'follower-entry-abilities'] as const) {
      const probe = structuredClone(s);
      probe.players.D!.statuses = [{id: 'stop-d', kind: 'stopped', modifiers: [0], nextCheck: 1}];
      const w = probe.windows!.at(-1)!;
      w.kind = kind; w.participants = ['A', 'B', 'C', 'D']; w.passed = ['A', 'B', 'C']; w.cursor = 3;
      expect(engine.viewFor(probe, 'D').legalChoices.filter(choice => !['PASS', 'REVEAL_CHARACTER', 'PASS_ACTION_THROUGH', 'CANCEL_PASS_THROUGH'].includes(choice))).toEqual([]);
    }
  });
});

describe('pass-ahead on reclaim responses (G11)', () => {
  function reclaimWindow() {
    let s = ready();
    const bow = handCard(s, 'A', '踏み込み／弓');
    s = act(s, 'A', {type: 'ATTACK', cardInstanceId: bow, targetIds: ['B'], dedicated: false});
    for (let n = 0; n < 60 && top(s).kind !== 'reclaim'; n++) s = pass(s);
    expect(top(s).kind).toBe('reclaim');
    return s;
  }

  it('takes a later seat\'s decline before its turn and keeps it after a public reveal', () => {
    let s = reclaimWindow();
    const later = [...top(s).participants].at(-1)!;
    s = act(s, later, {type: 'PASS'});
    expect(top(s).passed).toEqual([later]);
    expect(top(s).cursor).toBe(0);
    // A reclaim answer is never recorded: who holds the right is secret (G11).
    expect(s.events.some(e => e.type === 'PASSED' && e.windowKind === 'reclaim')).toBe(false);
    // G11 keeps the answers already given through a child reaction; the pass given ahead stays too.
    s = act(s, top(s).participants[0]!, {type: 'REVEAL_CHARACTER'});
    expect(top(s).passed).toEqual([later]);
  });

  it('closes the reclaim window once every seat has answered', () => {
    let s = reclaimWindow();
    const order = [...top(s).participants];
    const windowId = top(s).id;
    for (const id of [...order].reverse()) s = act(s, id, {type: 'PASS'});
    expect(s.windows?.some(w => w.id === windowId)).toBeFalsy();
  });

  it('accepts the offered standing pass and cancellation without retracting a reclaim answer', () => {
    let s = reclaimWindow();
    const later = [...top(s).participants].at(-1)!;
    const windowId = top(s).id;
    expect(engine.viewFor(s, later).legalChoices).toContain('PASS_ACTION_THROUGH');
    s = act(s, later, {type: 'PASS_ACTION_THROUGH'});
    expect(s.standingPasses?.flatMap(saved => saved.actorIds)).toContain(later);
    expect(engine.viewFor(s, later).legalChoices).toContain('CANCEL_PASS_THROUGH');
    s = act(s, later, {type: 'CANCEL_PASS_THROUGH'});
    expect(s.standingPasses).toBeUndefined();
    expect(top(s)).toMatchObject({id: windowId, passed: [later], cursor: 0});
    expect(s.events.some(e => e.type === 'PASSED' && e.actorId === later && ['reclaim', 'action-through'].includes(e.windowKind ?? ''))).toBe(false);
  });
});
