import { describe, expect, it } from 'vitest';
import { act, ready, until, finish, closeWindow, pass } from './combat-helpers.js';
import { character, handCard, entropy } from './fixtures.js';
import { transition, viewFor, type GameState, discardIds } from '../src/index.js';
import { declarationNumbers } from '../src/abilities/declaration-resolution.js';
import { effectPreview, damagePreview } from '../src/abilities/action-modifiers.js';
const BEAST = 'c2-p06-r2c2-ab02', VANMIL = 'c2-p07-r1c2-ab02', GIL = 'c2-p01-r1c2-ab01';
const SHIN_COUNTER = 'c2-p01-r2c1-ab01', SHIN_CHANT = 'c2-p01-r2c1-ab02';
function attack(s: GameState, card: string, ids: string[], targets = ['B']) {
    return act(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: targets, declarationAbilityIds: ids });
}
function source(s: GameState, actor = 'A') { return Object.values(s.actions!).find(a => a.actorId === actor && a.declaration)!; }
function priority(s: GameState, actor: string) { for (let n = 0; n < 20; n++) {
    const w = s.windows!.at(-1)!;
    if (w.participants[w.cursor] === actor)
        return s;
    s = pass(s);
} throw Error('PRIORITY'); }
function setup(name: string, cardName: string) { const s = ready(); character(s, 'A', name); s.players.A!.permanent = { spirit: 10, endurance: 100 }; s.distances.A!.B = s.distances.B!.A = 'near'; return { s, card: handCard(s, 'A', cardName) }; }
function cancelAbility(s: GameState, actor = 'B') {
    const fate = handCard(s, actor, '命運凶変');
    s = priority(s, actor);
    return act(s, actor, { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel-ability', targetAbilityId: viewFor(s, actor).reactionTargetAbilityId! });
}
describe('whole numeric package decline/cancellation', () => {
    it.each([
        ['妖精王フューリー', '炎矢', 'c2-p02-r1c2-ab04', 4, 5, 5, 5],
        ['黒騎士ガーウィン', '破黒剣', 'c2-p05-r2c1-ab03', 4, 5, 5, 7],
        ['餓狼ヨーツルム', '踏み込み／蹴る', BEAST, 1, 2, 2, 3],
        ['破壊神ヴァンミール', '黒流弓', VANMIL, 5, 10, 5, 20],
        ['破壊神ヴァンミール', '炎矢', VANMIL, 4, 5, 10, 5],
    ] as const)('%s %s declines or cancels all numeric clauses together', (name, cardName, id, baseEffect, baseDamage, selectedEffect, selectedDamage) => {
        for (const mode of ['decline', 'select', 'cancel']) {
            // Direct Vanmil here is a labeled arithmetic fixture; actual ritual producer is covered separately.
            const initial = setup(name, cardName);
            let s = attack(initial.s, initial.card, mode === 'decline' ? [] : [id]);
            if (mode === 'cancel') {
                s = closeWindow(s);
                s = cancelAbility(s);
            }
            s = until(s, 'normal-defense');
            expect(viewFor(s, 'B').currentAttack!.technique).toMatchObject({ effectLevel: mode === 'select' ? selectedEffect : baseEffect, damage: mode === 'select' ? selectedDamage : baseDamage });
        }
    });
    it('Vanmil replacement can lower base above ten, then iron-fist lower bound and Prayer add in order', () => {
        const { s: initial, card } = setup('破壊神ヴァンミール', '炎矢');
        // Structural helper: source above10/magic+格/inherited鉄拳 is not a canonical printed combination.
        initial.players.A!.abilityCharacterIds = ['c2-p01-r1c2'];
        initial.players.A!.permanent!.warrior_level = 12;
        let s = attack(initial, card, [VANMIL]);
        const a = source(s);
        a.declaration!.base.effectLevel = 14;
        a.declaration!.base.attributes.push('格');
        a.modifiers!.effectBase = 14;
        s = until(s, 'effect-level');
        expect(effectPreview(s, source(s))).toBe(10);
        s = priority(s, 'A');
        const fist = viewFor(s, 'A').abilityOptions.find(o => o.abilityId === 'c2-p01-r1c2-ab02')!;
        s = act(s, 'A', { type: 'USE_ABILITY', abilityId: fist.abilityId, targetEventId: fist.targetEventId });
        s = closeWindow(s);
        const afterFist = effectPreview(s, source(s));
        expect(afterFist).toBeGreaterThan(10);
        const prayer = handCard(s, 'A', '必勝の祈り');
        s = priority(s, 'A');
        s = act(s, 'A', { type: 'PLAY_REACTION', cardInstanceId: prayer, mode: 'effect-plus', targetActionId: source(s).id });
        s = closeWindow(s, [3]);
        s = closeWindow(s);
        expect(effectPreview(s, source(s))).toBe(afterFist + 3);
    });
    it('null damage remains null for additive and double packages', () => {
        const { s: initial, card } = setup('破壊神ヴァンミール', '炎矢');
        let s = until(attack(initial, card, [VANMIL]), 'effect-level');
        const a = source(s);
        // Structural null damage with warrior package and numeric bonus has no printed producer.
        a.declaration!.base.school = 'warrior';
        a.technique.school = 'warrior';
        a.technique.damage = null;
        a.technique.damageAdditive = 9;
        expect(damagePreview(s, a)).toBeNull();
        expect(declarationNumbers(s, a).damageMultiplier).toBe(2);
    });
    it('Yotsurm Divine reroll changes effect die without copying it to the damage die', () => {
        const { s: initial, card } = setup('餓狼ヨーツルム', '踏み込み／蹴る');
        let s = until(attack(initial, card, [BEAST]), 'effect-level');
        const divine = handCard(s, 'B', '神性介入');
        s = closeWindow(s, [2]);
        s = priority(s, 'B');
        const effectRoll = source(s).declaration!.effectRollId!;
        s = act(s, 'B', { type: 'PLAY_REACTION', cardInstanceId: divine, mode: 'reroll', targetRollId: effectRoll });
        // Reroll payment and its renewed after-roll responses may add child windows.
        for (let n = 0; s.windows!.at(-1)!.kind !== 'damage' && n < 300; n++) s = pass(s, [6]);
        expect(s.windows!.at(-1)!.kind).toBe('damage');
        s = closeWindow(s, [4]);
        s = closeWindow(s);
        s = until(s, 'normal-defense');
        expect(viewFor(s, 'B').currentAttack!.technique).toMatchObject({ effectLevel: 7, damage: 6 });
        expect(s.rolls!.find(r => r.id === effectRoll)).toMatchObject({ generation: 1, total: 6 });
    });
});
describe('counter prerequisites fail through ordinary disposal', () => {
    it.each([SHIN_COUNTER, SHIN_CHANT])('canceling requisite %s spends unchanted noncounter and preserves incoming targets', abilityId => {
        let s = ready();
        character(s, 'B', '侍大将のシン');
        s.players.B!.permanent = { spirit: 10 };
        const incoming = handCard(s, 'A', '黒流弓'), card = handCard(s, 'B', '天地百撃斬');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B'] });
        s = until(s, 'normal-defense');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false, declarationAbilityIds: [SHIN_COUNTER, SHIN_CHANT] });
        for (let n = 0; n < 100; n++) {
            const a = viewFor(s, 'B').currentAction;
            if (a?.source === 'ability' && a.abilityId === abilityId)
                break;
            s = pass(s);
        }
        s = cancelAbility(s, 'C');
        s = finish(s);
        expect(s.players.B!.damage).toBe(10);
        expect(discardIds(s)).toContain(card);
        expect(s.windows).toHaveLength(0);
    });
    it('Fate force-fail of Gil conversion fails defense and spends both sources', () => {
        let s = ready();
        character(s, 'B', '大神官ジル');
        const incoming = handCard(s, 'A', '黒流弓'), card = handCard(s, 'B', '死鬼旋風脚'), fate = handCard(s, 'C', '命運凶変');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B'] });
        s = until(s, 'normal-defense');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false, declarationAbilityIds: [GIL] });
        s = until(s, 'before-roll');
        s = priority(s, 'C');
        s = act(s, 'C', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'force-fail', targetRollId: viewFor(s, 'C').reactionTargetRollId! });
        s = finish(s);
        expect(s.players.B!.damage).toBe(10);
        expect(discardIds(s)).toEqual(expect.arrayContaining([card, fate]));
    });
    it('canceled redundant conversion keeps an original printed counter legal', () => {
        let s = ready();
        character(s, 'B', '侍大将のシン');
        s.distances.A!.B = s.distances.B!.A = 'near';
        const incoming = handCard(s, 'A', '踏み込み／弓'), card = handCard(s, 'B', '妖撃破山剣');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B'] });
        s = until(s, 'normal-defense');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false, declarationAbilityIds: [SHIN_COUNTER] });
        s = closeWindow(s);
        s = cancelAbility(s, 'C');
        s = finish(s);
        expect(s.players.B!.damage).toBe(0);
        expect(s.players.A!.damage).toBe(4);
        expect((s.rolls ?? []).filter(r => r.purpose === 'ability-check')).toHaveLength(0);
    });
    it('impossible random maximum rejects before any source payment', () => {
        let s = ready();
        character(s, 'B', '餓狼ヨーツルム');
        s.players.B!.abilityCharacterIds = ['c2-p01-r1c2'];
        const incoming = handCard(s, 'A', '黒流弓'), card = handCard(s, 'B', '狼牙');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B'] });
        s = until(s, 'normal-defense');
        Object.values(s.groups!)[0]!.technique.effectLevel = 12;
        const command = { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false, declarationAbilityIds: [GIL, BEAST] };
        const before = JSON.stringify(s);
        expect(transition(s, { actorId: 'B', command } as any, entropy())).toEqual({ ok: false, code: 'ILLEGAL_DEFENSE' });
        expect(JSON.stringify(s)).toBe(before);
    });
});
it('selected deterministic Vanmil replacement legalizes an otherwise insufficient native counter', () => {
    let s = ready();
    character(s, 'B', '破壊神ヴァンミール');
    const incoming = handCard(s, 'A', '黒翼飛翔剣'), counter = handCard(s, 'B', '狂王陣');
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B'] });
    s = until(s, 'effect-level');
    const prayer = handCard(s, 'A', '必勝の祈り');
    s = priority(s, 'A');
    const actionId = Object.values(s.actions!).find(a => a.kind === 'attack')!.id;
    s = act(s, 'A', { type: 'PLAY_REACTION', cardInstanceId: prayer, mode: 'effect-plus', targetActionId: actionId });
    s = closeWindow(s, [1]);
    s = closeWindow(s);
    s = until(s, 'normal-defense');
    expect(viewFor(s, 'B').currentAttack!.technique.effectLevel).toBe(6);
    const before = JSON.stringify(s);
    expect(transition(s, { actorId: 'B', command: { type: 'PLAY_DEFENSE', cardInstanceId: counter, dedicated: false } }, entropy())).toEqual({ ok: false, code: 'ILLEGAL_DEFENSE' });
    expect(JSON.stringify(s)).toBe(before);
    s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: counter, dedicated: false, declarationAbilityIds: [VANMIL] });
    s = until(s, 'normal-defense');
    expect(Object.values(s.groups!).find(g => g.attackerId === 'B')!.technique.effectLevel).toBe(10);
});
it('converted counter respects an actual printed counter prohibition', () => {
    let s = ready();
    character(s, 'A', '不死王ガドューラ');
    character(s, 'B', '大神官ジル');
    const incoming = handCard(s, 'A', 'スケルトン'), counter = handCard(s, 'B', '死鬼旋風脚');
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: true, targetIds: ['B'] });
    s = until(s, 'normal-defense');
    expect(viewFor(s, 'B').currentAttack!.defenseRestrictions.counterProhibited).toBe(true);
    const before = JSON.stringify(s);
    expect(transition(s, { actorId: 'B', command: { type: 'PLAY_DEFENSE', cardInstanceId: counter, dedicated: false, declarationAbilityIds: [GIL] } }, entropy())).toEqual({ ok: false, code: 'ILLEGAL_DEFENSE' });
    expect(JSON.stringify(s)).toBe(before);
});
it('Yotsurm never creates damage from a printed null column', () => {
    const { s: initial, card } = setup('餓狼ヨーツルム', '踏み込み／蹴る');
    let s = attack(initial, card, [BEAST]);
    // No printed martial null-damage non-formula source exists: isolate that numeric invariant.
    source(s).declaration!.base.damage = null;
    source(s).technique.damage = null;
    s = until(s, 'normal-defense');
    expect(viewFor(s, 'B').currentAttack!.technique.damage).toBeNull();
    expect(source(s).declaration!.damageRollId).toBeUndefined();
    expect(s.rolls!.filter(r => r.purpose === 'ability-value')).toHaveLength(1);
});
it('Gil conversion can be declined or canceled before its check with ordinary spent-defense resume', () => {
    let s = ready();
    character(s, 'B', '大神官ジル');
    const incoming = handCard(s, 'A', '黒流弓'), card = handCard(s, 'B', '死鬼旋風脚');
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B'] });
    s = until(s, 'normal-defense');
    const before = JSON.stringify(s);
    expect(transition(s, { actorId: 'B', command: { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false } }, entropy())).toEqual({ ok: false, code: 'ILLEGAL_DEFENSE' });
    expect(JSON.stringify(s)).toBe(before);
    s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false, declarationAbilityIds: [GIL] });
    s = closeWindow(s);
    s = cancelAbility(s, 'C');
    s = finish(s);
    expect(s.players.B!.damage).toBe(10);
    expect(discardIds(s)).toContain(card);
    expect((s.rolls ?? []).filter(r => r.purpose === 'ability-check')).toHaveLength(0);
});

it('structural sword turn technique keeps Garwin numeric clauses without an attack range grant', async () => {
    const { declarationEffects } = await import('../src/abilities/declaration-effects.js');
    const { techniqueFor } = await import('../src/effects/registry.js');
    // No printed sword healing technique exists; this covers the whole-package numeric rule.
    const technique = techniqueFor('a2-p12-r2c1')!;
    technique.attributes.push('剣');
    expect(declarationEffects('c2-p05-r2c1-ab03', technique, 'turn-technique', false, false)).toEqual({ effectAddition: 1, damageAddition: 2 });
});
