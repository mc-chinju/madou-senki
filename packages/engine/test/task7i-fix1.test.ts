import { describe, it, expect } from 'vitest';
import { transition, viewFor, type GameState } from '../src/index.js';
import { act, ready, until, pass, finish, closeWindow } from './combat-helpers.js';
import { character, handCard, entropy } from './fixtures.js';
function prepared(s: GameState, owner: string, name: string) {
    const card = handCard(s, owner, name);
    s.players[owner]!.hand = s.players[owner]!.hand.filter(id => id !== card);
    s.players[owner]!.chants.push({ cardInstanceId: card, revealed: false });
    return card;
}
function rejected(s: GameState, actorId: string, command: unknown) {
    const before = JSON.stringify(s);
    expect(transition(s, { actorId, command } as Parameters<typeof transition>[1], entropy()).ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
}
function defenseSetup(name = '魔空剣', chant = false) {
    let s = ready();
    character(s, 'B', '獣使いのウパニシャット');
    const attack = chant ? prepared(s, 'A', name) : handCard(s, 'A', name);
    const beast = handCard(s, 'B', '獣王剣');
    const mirror = handCard(s, 'B', 'ミラーシールド');
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
    return { s: until(s, 'normal-defense'), beast, mirror };
}
function grantSetup(source: 'card' | 'ability') {
    let s = ready();
    character(s, 'A', '黒騎士ガーウィン');
    character(s, 'B', '忍びのイダ');
    const card = handCard(s, 'A', '衝破');
    const printed = handCard(s, 'B', '影分身');
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
    s = until(s, 'normal-defense');
    if (source === 'card') {
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: printed, dedicated: true });
        return until(s, 'ability-attack');
    }
    const option = viewFor(s, 'B').abilityOptions.find(o => o.abilityId.endsWith('ab01'))!;
    s = act(s, 'B', { type: 'USE_ABILITY', abilityId: option.abilityId, targetEventId: option.targetEventId });
    s = closeWindow(s);
    s = closeWindow(s, [1, 1]);
    s = closeWindow(s);
    s = closeWindow(s, [6, 6]);
    return closeWindow(s);
}
const options = (s: GameState, owner = 'B') => (viewFor(s, owner) as any).additionalAttackOptions as {
    cardInstanceId: string;
    dedicated: boolean;
    techniqueVariant?: string;
    coSource?: {
        cardInstanceId: string;
        dedicated: boolean;
    };
}[];
describe('Task7i fix1 actual source classification and relative references', () => {
    it('rejects an unclassified evade co-source and never advertises it, while a printed warrior attack mode remains legal', () => {
        let { s, beast } = defenseSetup();
        const evade = handCard(s, 'B', '見切る');
        const command = { type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: evade, dedicated: false } };
        expect(viewFor(s, 'B').combinationOptions.flatMap(o => o.coSources).some(c => c.cardInstanceId === evade)).toBe(false);
        rejected(s, 'B', command);
        s = ready();
        character(s, 'A', '獣使いのウパニシャット');
        const primary = handCard(s, 'A', '獣王剣');
        const bad = handCard(s, 'A', '見切る');
        const valid = handCard(s, 'A', '踏み込み／弓');
        rejected(s, 'A', { type: 'ATTACK', cardInstanceId: primary, targetIds: ['B'], dedicated: true, coSource: { cardInstanceId: bad, dedicated: false } });
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: primary, targetIds: ['B'], dedicated: true, coSource: { cardInstanceId: valid, dedicated: false } });
        s = finish(s);
        expect(s.players.B!.damage).toBe(14);
    });
    it.each([['魔空剣', false, 0], ['氷狼乱舞陣', true, 7]] as const)('composite Mirror resolves the printed relative boundary against %s', (name, chant, returned) => {
        let { s, beast, mirror } = defenseSetup(name, chant);
        const choice = { cardInstanceId: mirror, dedicated: false };
        expect(viewFor(s, 'B').combinationOptions.flatMap(o => o.coSources)).toContainEqual(choice);
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource: choice });
        s = finish(s);
        expect(s.players.B!.damage).toBe(0);
        expect(s.players.A!.damage).toBe(returned);
        expect(s.discard).toEqual(expect.arrayContaining([beast, mirror]));
    });
    it.each([['天地百撃斬', true], ['神罰', true]] as const)('composite Mirror excludes the first above-boundary %s', (name, chant) => {
        const { s, beast, mirror } = defenseSetup(name, chant);
        expect(viewFor(s, 'B').combinationOptions.flatMap(o => o.coSources).some(c => c.cardInstanceId === mirror)).toBe(false);
        rejected(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: mirror, dedicated: false } });
    });
    it('effect-level freeze recomputes only source-relative Mirror limits after a real prayer child', () => {
        let { s, beast, mirror } = defenseSetup();
        const prayer = handCard(s, 'B', '必勝の祈り');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: mirror, dedicated: false } });
        s = until(s, 'effect-level');
        s = pass(s);
        const actionId = Object.values(s.actions!).find(a => a.cardInstanceId === beast)!.id;
        s = act(s, 'B', { type: 'PLAY_REACTION', cardInstanceId: prayer, mode: 'effect-plus', targetActionId: actionId });
        s = closeWindow(s, [2]);
        s = closeWindow(s);
        s = closeWindow(s);
        expect(s.actions![actionId]!.technique).toMatchObject({ effectLevel: 8, blockWarriorLimit: 8, reflectMagicLimit: 9 });
        s = finish(s);
    });
});
describe('Task7i fix1 authoritative additional attack options', () => {
    it.each(['card', 'ability'] as const)('%s grant excludes illegal near attacks and unprepared chants while accepting every offered exact choice', (source) => {
        let s = grantSetup(source);
        const near = handCard(s, 'B', '踏み込み／殴る');
        const far = handCard(s, 'B', '踏み込み／弓');
        const chant = handCard(s, 'B', '天地百撃斬');
        expect(options(s)).toBeDefined();
        expect(options(s).some(o => o.cardInstanceId === near || o.cardInstanceId === chant)).toBe(false);
        expect(options(s)).toContainEqual({ cardInstanceId: far, dedicated: false });
        rejected(s, 'B', { type: 'ATTACK', cardInstanceId: near, targetIds: ['A'], dedicated: false });
        rejected(s, 'B', { type: 'ATTACK', cardInstanceId: chant, targetIds: ['A'], dedicated: false });
        s.players.B!.hand = s.players.B!.hand.filter(id => id !== chant);
        s.players.B!.chants.push({ cardInstanceId: chant, revealed: false });
        expect(options(s)).toContainEqual({ cardInstanceId: chant, dedicated: false });
        for (const candidate of options(s))
            act(s, 'B', { type: 'ATTACK', targetIds: ['A'], ...candidate });
        expect(options(s, 'A')).toEqual([]);
        expect(options(ready())).toEqual([]);
        expect(JSON.stringify(viewFor(s, 'C'))).not.toContain(chant);
    });
    it('grant selection respects explicit dedicated/variant, faction and silence restrictions', () => {
        let s = grantSetup('card');
        const own = handCard(s, 'B', '手裏剣');
        const wrong = handCard(s, 'B', '光竜剣');
        const forbidden = handCard(s, 'B', '死刻鎌');
        const magic = handCard(s, 'B', '白光');
        expect(options(s)).toContainEqual({ cardInstanceId: own, dedicated: true });
        expect(options(s).some(o => o.cardInstanceId === wrong && o.dedicated || o.cardInstanceId === forbidden)).toBe(false);
        expect(options(s).some(o => o.cardInstanceId === own && o.techniqueVariant !== undefined)).toBe(false);
        expect(options(s)).toContainEqual({ cardInstanceId: magic, dedicated: false });
        s.players.B!.statuses = [{ id: 'silence', kind: 'silenced', modifiers: [0], nextCheck: 0 }];
        expect(options(s).some(o => o.cardInstanceId === magic)).toBe(false);
        rejected(s, 'B', { type: 'ATTACK', cardInstanceId: magic, targetIds: ['A'], dedicated: false });
    });
    it('printed grant filters the complete co-source selection at its fixed far target', () => {
        let s = grantSetup('card');
        // A resolved printed grant is independent of later character suppression/replacement.
        character(s, 'B', '獣使いのウパニシャット');
        const beast = handCard(s, 'B', '獣王剣');
        const near = handCard(s, 'B', '黒竜剣');
        const far = handCard(s, 'B', '気斬');
        expect(options(s).some(o => o.cardInstanceId === beast && o.coSource?.cardInstanceId === near)).toBe(false);
        const candidate = { cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: far, dedicated: false } };
        expect(options(s)).toContainEqual(candidate);
        rejected(s, 'B', { type: 'ATTACK', targetIds: ['A'], cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: near, dedicated: false } });
        s = act(s, 'B', { type: 'ATTACK', targetIds: ['A'], ...candidate });
        s = finish(s);
        expect(s.players.A!.damage).toBe(17);
    });
});
describe('Task7i fix1 exact grant packages and fixed defense limits', () => {
    it('fixed printed God King limit stays six when prayer changes its effect level', () => {
        let s = ready();
        character(s, 'B', '白魔術師シェリム');
        const attack = handCard(s, 'A', '氷結');
        const defense = handCard(s, 'B', '神王界');
        const prayer = handCard(s, 'B', '必勝の祈り');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
        s = until(s, 'normal-defense');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: false });
        s = until(s, 'effect-level');
        s = pass(s);
        const actionId = Object.values(s.actions!).find(a => a.cardInstanceId === defense)!.id;
        s = act(s, 'B', { type: 'PLAY_REACTION', cardInstanceId: prayer, mode: 'effect-plus', targetActionId: actionId });
        s = closeWindow(s, [2]);
        s = closeWindow(s);
        s = closeWindow(s);
        expect(s.actions![actionId]!.technique).toMatchObject({ effectLevel: 7, reflectMagicLimit: 6, blockWarriorLimit: -1 });
        expect(s.actions![actionId]!.technique.relativeDefenseLimits).toBeUndefined();
        s = finish(s);
    });
    it('granted attack distinguishes inherited chant-required and full-II chant-waived dedicated variants', () => {
        let s = grantSetup('card');
        character(s, 'B', '聖騎士ランスロット2');
        const card = handCard(s, 'B', '光竜破山剣');
        expect(options(s)).toContainEqual({ cardInstanceId: card, dedicated: true, techniqueVariant: 'lancelot-2' });
        expect(options(s).some(o => o.cardInstanceId === card && (!o.dedicated || o.techniqueVariant === 'lancelot-1'))).toBe(false);
        rejected(s, 'B', { type: 'ATTACK', cardInstanceId: card, targetIds: ['A'], dedicated: true, techniqueVariant: 'lancelot-1' });
        s.players.B!.hand = s.players.B!.hand.filter(id => id !== card);
        s.players.B!.chants.push({ cardInstanceId: card, revealed: false });
        expect(options(s)).toContainEqual({ cardInstanceId: card, dedicated: true, techniqueVariant: 'lancelot-1' });
        expect(options(s)).toContainEqual({ cardInstanceId: card, dedicated: false });
        for (const choice of options(s).filter(o => o.cardInstanceId === card))
            act(s, 'B', { type: 'ATTACK', targetIds: ['A'], ...choice });
    });
    it('a dedicated ranged override is offered separately from the illegal ordinary near package', () => {
        let s = grantSetup('card');
        character(s, 'B', '餓狼ヨーツルム');
        const card = handCard(s, 'B', '狼牙');
        expect(options(s).filter(o => o.cardInstanceId === card)).toEqual([{ cardInstanceId: card, dedicated: true }]);
        rejected(s, 'B', { type: 'ATTACK', cardInstanceId: card, targetIds: ['A'], dedicated: false });
        s = act(s, 'B', { type: 'ATTACK', cardInstanceId: card, targetIds: ['A'], dedicated: true });
        s = finish(s);
        expect(s.players.A!.damage).toBe(3);
    });
    it('losing priority, stopping, or a public friendly fixed target leaves no private offered candidates', () => {
        let s = grantSetup('ability');
        const card = handCard(s, 'B', '踏み込み／弓');
        expect(options(s)).toContainEqual({ cardInstanceId: card, dedicated: false });
        s.players.B!.statuses = [{ id: 'stop', kind: 'stopped', modifiers: [0], nextCheck: 0 }];
        expect(options(s)).toEqual([]);
        rejected(s, 'B', { type: 'ATTACK', cardInstanceId: card, targetIds: ['A'], dedicated: false });
        s.players.B!.statuses = [];
        s.players.A!.revealed = true;
        s.players.A!.faction = s.players.B!.faction;
        expect(options(s)).toEqual([]);
        rejected(s, 'B', { type: 'ATTACK', cardInstanceId: card, targetIds: ['A'], dedicated: false });
    });
    it('every offered composed defense passes the same current incoming restriction checks', () => {
        let { s, beast } = defenseSetup();
        handCard(s, 'B', '見切る');
        handCard(s, 'B', '手裏剣');
        handCard(s, 'B', '影分身');
        handCard(s, 'B', '受け流し');
        const choices = viewFor(s, 'B').combinationOptions.flatMap(o => o.coSources);
        expect(choices.length).toBeGreaterThan(0);
        for (const coSource of choices)
            act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource });
    });
});
