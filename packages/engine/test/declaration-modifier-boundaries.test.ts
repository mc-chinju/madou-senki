import { describe, expect, it } from 'vitest';
import { act, ready, until, finish, closeWindow, pass } from './combat-helpers.js';
import { character, handCard, entropy } from './fixtures.js';
import { transition, viewFor, previewDeclarationCandidate, type GameState } from '../src/index.js';
const SHELIM_ALL = 'c2-p01-r1c1-ab04', GARWIN_ALL = 'c2-p05-r2c1-ab04';
const GAINAS_ALL = 'c2-p05-r2c2-ab04', GIL_COUNTER = 'c2-p01-r1c2-ab01';
const GIL_RANGE = 'c2-p01-r1c2-ab03', BEAST = 'c2-p06-r2c2-ab02', VANMIL = 'c2-p07-r1c2-ab02';
const GARWIN = 'c2-p05-r2c1-ab03';
function scenario(name: string, cardName: string, chanted = false, revealed = false) {
    let s = ready();
    character(s, 'A', name);
    for (const p of Object.values(s.players))
        p.permanent = { spirit: 10, endurance: 100 };
    const card = handCard(s, 'A', cardName);
    if (chanted)
        s = act(s, 'A', { type: 'CHANT', cardInstanceId: card });
    // CHANT consumes the turn action. Advance through actual turn commands.
    if (chanted)
        s = nextOwnTurn(s);
    if (revealed)
        s = act(s, 'A', { type: 'REVEAL_CHARACTER' });
    return { s, card };
}
function nextOwnTurn(s: GameState) {
    if (s.phase === 'withdrawal')
        s = act(s, 'A', { type: 'PASS_WITHDRAWAL' });
    s = act(s, 'A', { type: 'END_TURN', discardIds: s.players.A!.hand.slice(5) });
    for (const actor of ['B', 'C', 'D']) {
        s = act(s, actor, { type: 'START_TURN' });
        s = act(s, actor, { type: 'CHOOSE_DRAW', draw: false });
        s = act(s, actor, { type: 'PASS_ACTION' });
        s = act(s, actor, { type: 'END_TURN', discardIds: s.players[actor]!.hand.slice(5) });
    }
    s = act(s, 'A', { type: 'START_TURN' });
    return act(s, 'A', { type: 'CHOOSE_DRAW', draw: false });
}
function attack(s: GameState, card: string, ids: string[], targetIds = ['B']) {
    return act(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds, declarationAbilityIds: ids });
}
function priority(s: GameState, actor: string) {
    for (let n = 0; n < 20; n++) {
        const w = s.windows!.at(-1)!;
        if (w.participants[w.cursor] === actor)
            return s;
        s = pass(s);
    }
    throw Error('PRIORITY');
}
function cancel(s: GameState, abilityId: string) {
    for (let n = 0; n < 100; n++) {
        const action = viewFor(s, 'A').currentAction;
        if (action?.source === 'ability' && action.abilityId === abilityId)
            break;
        s = pass(s);
    }
    const fate = handCard(s, 'B', '命運凶変');
    s = priority(s, 'B');
    return act(s, 'B', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel-ability', targetAbilityId: viewFor(s, 'B').reactionTargetAbilityId! });
}
function reject(s: GameState, actorId: string, command: unknown, code: string) {
    const original = JSON.stringify(s);
    expect(transition(s, { actorId, command } as any, entropy())).toEqual({ ok: false, code });
    expect(JSON.stringify(s)).toBe(original);
}
function attackFrame(s: GameState) { return Object.values(s.actions!).find(a => a.actorId === 'A' && a.kind === 'attack')!; }
// Expected values are independent printed card numbers, not preview-derived expectations.
describe('all-target declaration conditions and preserved targets', () => {
    it.each([
        ['白魔術師シェリム', '烈火', SHELIM_ALL],
        ['黒騎士ガーウィン', '天地百撃斬', GARWIN_ALL],
        ['魔導王ガイナス', '天地百撃斬', GAINAS_ALL],
    ])('%s selects, declines and cancels the whole all-target package', (name, cardName, id) => {
        for (const mode of ['select', 'decline', 'cancel']) {
            const initial = scenario(name!, cardName!, true, true);
            let s = attack(initial.s, initial.card, mode === 'decline' ? [] : [id!], mode === 'decline' ? ['B'] : ['B', 'C']);
            if (mode === 'cancel') {
                s = cancel(s, id!);
                s = finish(s);
                expect([s.players.B!.damage, s.players.C!.damage]).toEqual([0, 0]);
                expect(s.discard.filter(c => c === initial.card)).toHaveLength(1);
            }
            else {
                s = until(s, 'normal-defense');
                expect(viewFor(s, 'B').currentAttack!.targetIds).toEqual(mode === 'decline' ? ['B'] : ['B', 'C']);
                s = finish(s);
                expect(s.players.C!.damage > 0).toBe(mode === 'select');
            }
        }
    });
    it('real chant is distinct from waiver, and unrevealed source conditions reject', () => {
        const { s, card } = scenario('白魔術師シェリム', '烈火');
        const command = { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: ['B', 'C'], declarationAbilityIds: ['c2-p01-r1c1-ab03', SHELIM_ALL] };
        reject(s, 'A', command, 'ABILITY_DISABLED');
        const revealed = act(s, 'A', { type: 'REVEAL_CHARACTER' });
        reject(revealed, 'A', command, 'ABILITY_DISABLED');
        expect(viewFor(revealed, 'A').declarationCandidates.find(c => c.choice.cardInstanceId === card)!.abilities.map(a => a.abilityId)).not.toContain(SHELIM_ALL);
    });
    it('Gainas requires actual source usage level six, irrespective of later effect boosts', () => {
        const { s, card } = scenario('魔導王ガイナス', '黒竜剣', false, true);
        reject(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: ['B', 'C'], declarationAbilityIds: [GAINAS_ALL] }, 'ABILITY_DISABLED');
    });
    it('all-target selection keeps revealed friends, inactive players and self forbidden', () => {
        const { s, card } = scenario('白魔術師シェリム', '烈火', true, true);
        character(s, 'B', '大神官ジル');
        s.players.B!.revealed = true;
        s.players.C!.presence = 'dead';
        for (const target of ['A', 'B', 'C'])
            reject(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: [target, 'D'], declarationAbilityIds: [SHELIM_ALL] }, 'INVALID_TARGET');
    });
});
describe('range, counter acceptance and failure boundaries', () => {
    it('Gil range is selected, declined or canceled without manufacturing a generic attack', () => {
        for (const mode of ['select', 'decline', 'cancel']) {
            const { s: initial, card } = scenario('大神官ジル', '踏み込み／蹴る');
            if (mode === 'decline') {
                reject(initial, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: ['B'] }, 'OUT_OF_RANGE');
                continue;
            }
            let s = attack(initial, card, [GIL_RANGE]);
            if (mode === 'cancel') {
                s = finish(cancel(s, GIL_RANGE));
                expect(s.players.B!.damage).toBe(0);
            }
            else {
                s = until(s, 'normal-defense');
                expect(attackFrame(s).technique.range).toBe('far');
                s = finish(s);
                expect(s.players.B!.damage).toBe(2);
            }
        }
    });
    it('Gil conversion has one spirit check, equality cancels and near at far only blocks', () => {
        for (const incomingName of ['踏み込み／弓', '黒翼飛翔剣']) {
            let s = ready();
            character(s, 'B', '大神官ジル');
            s.players.B!.permanent = { spirit: 10 };
            const incoming = handCard(s, 'A', incomingName), card = handCard(s, 'B', incomingName === '黒翼飛翔剣' ? '狼牙' : '死鬼旋風脚');
            s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B'] });
            s = until(s, 'normal-defense');
            s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false, declarationAbilityIds: [GIL_COUNTER] });
            s = finish(s);
            expect(s.rolls!.filter(r => r.purpose === 'ability-check' && r.rollerId === 'B')).toHaveLength(1);
            expect([s.players.A!.damage, s.players.B!.damage]).toEqual([0, 0]);
        }
    });
    it('selected random upper bound allows a defense, then insufficient final value spends and resumes', () => {
        let s = ready();
        character(s, 'B', '餓狼ヨーツルム');
        // Helper-only ownership combination: no canonical Yotsurm→Gil inheritance producer.
        s.players.B!.abilityCharacterIds = ['c2-p01-r1c2'];
        const incoming = handCard(s, 'A', '踏み込み／弓'), card = handCard(s, 'B', '狼牙');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B'] });
        s = until(s, 'normal-defense');
        // Structural helper: immutable incoming Lv has no producer at this chosen boundary.
        const g = Object.values(s.groups!)[0]!;
        g.technique.effectLevel = 8;
        const option = viewFor(s, 'B').declarationCandidates.find(c => c.choice.cardInstanceId === card && !c.choice.dedicated)!;
        expect(option).toBeDefined();
        expect(previewDeclarationCandidate(option, [BEAST, GIL_COUNTER])).toMatchObject({ canDeclare: true, pendingEffectDie: true });
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false, declarationAbilityIds: [BEAST, GIL_COUNTER] });
        s = finish(s);
        expect(s.players.B!.damage).toBe(4);
        expect(s.discard).toContain(card);
        expect(s.windows).toHaveLength(0);
    });
});
describe('separate numeric cutoffs and actual transformation', () => {
    it('Yotsurm saves independent effect and damage dice with usage checks waived', () => {
        const { s: initial, card } = scenario('餓狼ヨーツルム', '踏み込み／蹴る');
        initial.distances.A!.B = initial.distances.B!.A = 'near';
        let s = attack(initial, card, [BEAST]);
        s = until(s, 'effect-level');
        s = closeWindow(s, [2]);
        s = closeWindow(s);
        expect(s.windows!.at(-1)!.kind).toBe('damage');
        s = closeWindow(s, [5]);
        s = closeWindow(s);
        s = until(s, 'normal-defense');
        expect(viewFor(s, 'B').currentAttack!.technique).toMatchObject({ effectLevel: 3, damage: 7 });
        const a = attackFrame(s);
        expect(a.declaration!.effectRollId).not.toBe(a.declaration!.damageRollId);
        expect(s.rolls!.filter(r => r.purpose === 'excess-level')).toHaveLength(0);
    });
    it.each(['before-use', 'before-effect', 'before-damage', 'after-damage'])('helper suppression at %s observes each cutoff', (cutoff) => {
        const { s: initial, card } = scenario('黒騎士ガーウィン', '破黒剣');
        initial.distances.A!.B = initial.distances.B!.A = 'near';
        let s = attack(initial, card, [GARWIN]);
        s = closeWindow(s);
        if (cutoff !== 'before-use')
            s = closeWindow(s);
        if (cutoff === 'before-damage' || cutoff === 'after-damage')
            s = until(s, 'damage');
        if (cutoff === 'after-damage')
            s = until(s, 'normal-defense');
        s.players.A!.statuses = [{ id: 'helper-disable', kind: 'ability-disabled', modifiers: [0], nextCheck: 0 }];
        s = until(s, 'normal-defense');
        expect(viewFor(s, 'B').currentAttack!.technique).toMatchObject({ effectLevel: ['before-use', 'before-effect'].includes(cutoff) ? 4 : 5, damage: cutoff === 'after-damage' ? 7 : 5 });
    });
    it('actual Uonos ritual becomes Vanmil and does not inherit Uonos abilities', () => {
        let s = ready();
        character(s, 'A', '邪祭ウーノス');
        handCard(s, 'A', '復活の儀式');
        s = act(s, 'A', { type: 'USE_REVIVAL_RITUAL' });
        s = finish(s);
        s = nextOwnTurn(s);
        expect(s.players.A!.characterId).toBe('c2-p07-r1c2');
        expect(s.players.A!.abilityCharacterIds).toEqual(['c2-p07-r1c2']);
        const card = handCard(s, 'A', '烈火');
        s = attack(s, card, [VANMIL], ['B', 'C']);
        s = until(s, 'normal-defense');
        expect(viewFor(s, 'B').currentAttack!.technique).toMatchObject({ effectLevel: 10, damage: 15 });
        expect(viewFor(s, 'A').currentAttack!.targetIds).toEqual(['B', 'C']);
    });
});
