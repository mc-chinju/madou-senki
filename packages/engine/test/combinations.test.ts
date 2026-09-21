import {passReclaims,act,ready,until,pass,finish,closeWindow} from './combat-helpers.js';
import {describe,it,expect} from 'vitest';
import {transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {character,handCard,entropy} from './fixtures.js';
function prepared(s: GameState, actor: string, name: string) { const id = handCard(s, actor, name); s.players[actor]!.hand = s.players[actor]!.hand.filter(c => c !== id); s.players[actor]!.chants.push({ cardInstanceId: id, revealed: false }); return id; }
function attack(name: string, owner: string, dedicated: boolean, extra: Record<string, unknown> = {}) {
    let s = ready();
    character(s, 'A', owner);
    s.distances.A!.B = 'near';
    s.distances.B!.A = 'near';
    const id = ['黒翼天翔剣', '死歌'].includes(name) ? prepared(s, 'A', name) : handCard(s, 'A', name);
    return act(s, 'A', { type: 'ATTACK', cardInstanceId: id, targetIds: ['B'], dedicated, ...extra });
}
function priority(s: GameState, actor: string) {
    for (let n = 0; n < 50; n++) {
        const w = s.windows!.at(-1)!;
        if (w.participants[w.cursor] === actor)
            return s;
        s = pass(s);
    }
    throw Error('PRIORITY');
}
function rejected(s: GameState, actorId: string, command: unknown) { const before = JSON.stringify(s); expect(transition(s, { actorId, command } as Parameters<typeof transition>[1], entropy()).ok).toBe(false); expect(JSON.stringify(s)).toBe(before); }
function group(s: GameState) { return Object.values(s.groups!)[0]!; }
function lethal(s: GameState, faces: number[]) { const option = viewFor(s, 'A').abilityOptions.find(o => o.abilityId.endsWith('ab03'))!; expect(option).toBeDefined(); s = act(s, 'A', { type: 'USE_ABILITY', abilityId: option.abilityId, targetEventId: option.targetEventId }); s = closeWindow(s, faces); return closeWindow(s); }
describe('printed attacks through real transitions', () => {
    it.each([
        ['黒翼天翔剣', '黒妖精のアーネス', 12, 15], ['裏天空剣', '忍びのイダ', 5, 5],
        ['獣王剣', '獣使いのウパニシャット', 10, 10], ['黒竜剣', '黒騎士ガーウィン', 6, 10],
        ['魔空剣', '黒騎士ガーウィン', 10, 15], ['竜王爆砕剣', '魔導王ガイナス', 10, 10],
        ['死歌', '吟遊詩人のレスター', 4, 15],
    ])('%s preserves ordinary and elected dedicated values', (name, owner, ordinary, dedicated) => {
        for (const selected of [false, true]) {
            let s = attack(name as string, owner as string, selected);
            s = finish(s);
            expect(s.players.B!.damage).toBe(selected ? dedicated : ordinary);
        }
    });
    it('printed Ura grants exactly two independently elected critical attempts without costs', () => {
        let s = attack('裏天空剣', '忍びのイダ', true);
        s = until(s, 'hit-abilities');
        expect(group(s).targets[0]!.hits[0]!.abilityBudget!.granted).toBe(2);
        s = lethal(s, [1, 2]);
        s = lethal(s, [5, 6]);
        expect(viewFor(s, 'A').abilityOptions).toEqual([]);
        s = finish(s);
        expect(s.players.B!.damage).toBe(20);
        expect(s.players.A!.damage).toBe(0);
    });
    it('Black Dragon requires an explicit saved optional doubling check', () => {
        let s = attack('黒竜剣', '黒騎士ガーウィン', true);
        s = until(s, 'technique-double-choice');
        const actionId = Object.keys(s.actions!)[0]!;
        s = act(s, 'A', { type: 'CHOOSE_DAMAGE_DOUBLE', actionId, attempt: true });
        s = closeWindow(s, [1, 1]);
        s = closeWindow(s);
        s = finish(s);
        expect(s.players.B!.damage).toBe(20);
        expect(s.rolls!.filter(r => r.purpose === 'technique-check')).toHaveLength(1);
    });
    it('Magic Sky batch is paid at acceptance, sets effect level, and never forms distance or refills', () => {
        let s = ready();
        character(s, 'A', '黒騎士ガーウィン');
        const card = handCard(s, 'A', '魔空剣');
        const cost = handCard(s, 'A', '踏み込み／弓');
        const count = s.players.A!.hand.length;
        s = passReclaims(act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'C'], dedicated: true, advanceCardInstanceIds: [cost] }));
        expect(s.players.A!.hand).toHaveLength(count - 2);
        expect(discardIds(s)).toContain(cost);
        expect(Object.values(s.actions!)[0]!.technique.effectLevel).toBe(8);
        expect(s.distanceMarkers ?? {}).toEqual({});
        s = finish(s);
    });
    it('Beast combination uses two physical sources and one summed formula', () => {
        let s = ready();
        character(s, 'A', '獣使いのウパニシャット');
        const card = handCard(s, 'A', '獣王剣');
        const co = handCard(s, 'A', '気斬');
        const expected = 10 + viewFor(s, 'A').self.stats.spirit;
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true, coSource: { cardInstanceId: co, dedicated: false } });
        expect(s.resolution).toEqual(expect.arrayContaining([card, co]));
        s = finish(s);
        expect(s.players.B!.damage).toBe(expected);
        expect(discardIds(s)).toEqual(expect.arrayContaining([card, co]));
    });
    it('Black Wing batch changes pending damage once', () => {
        let s = attack('黒翼天翔剣', '黒妖精のアーネス', true);
        const cost = handCard(s, 'A', '踏み込み／弓');
        s = until(s, 'hit-advance-choice');
        const groupId = group(s).id;
        s = passReclaims(act(s, 'A', { type: 'PAY_HIT_ADVANCES', groupId, cardInstanceIds: [cost] }));
        expect(discardIds(s)).toContain(cost);
        s = finish(s);
        expect(s.players.B!.damage).toBe(20);
    });
    it('Dragon King uses a shared maai die and fixed six resistance; skip is coalesced', () => {
        let s = attack('竜王爆砕剣', '魔導王ガイナス', true);
        s.players.B!.skipTurns = 1;
        s = until(s, 'attack-abilities');
        expect(group(s).technique.maaiRequired).toBe(2);
        s = until(s, 'before-roll');
        expect(s.rolls!.at(-1)).toMatchObject({ purpose: 'hit-resistance', checkBase: 'fixed', threshold: 6 });
        s = closeWindow(s, [6, 6]);
        s = closeWindow(s);
        s = finish(s);
        expect(s.players.B!.damage).toBe(30);
        expect(s.players.B!.skipTurns).toBe(1);
    });
});
describe('fixed defenses and source identity', () => {
    it('printed Ida Shadow grants a real optional attack without an AbilityFrame', () => {
        let s = ready();
        character(s, 'A', '黒騎士ガーウィン');
        character(s, 'B', '忍びのイダ');
        const source = handCard(s, 'A', '衝破');
        const defense = handCard(s, 'B', '影分身');
        const child = handCard(s, 'B', '踏み込み／弓');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: source, targetIds: ['B'], dedicated: false });
        s = until(s, 'normal-defense');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: true });
        s = until(s, 'ability-attack');
        expect(Object.keys(s.abilities ?? {})).toEqual([]);
        expect((viewFor(s, 'B') as any).additionalAttack).toMatchObject({ source: 'card', sourceCardInstanceId: defense, actorId: 'B', targetId: 'A' });
        s = act(s, 'B', { type: 'ATTACK', cardInstanceId: child, targetIds: ['A'], dedicated: false });
        s = finish(s);
        expect(s.players.B!.damage).toBe(0);
        expect(s.players.A!.damage).toBe(4);
        expect(discardIds(s)).toContain(defense);
    });
    it('Leaf rejects fire even for Ida before costs; ordinary enemy check uses minus one', () => {
        let s = ready();
        character(s, 'B', '忍びのイダ');
        const card = prepared(s, 'A', '烈火');
        const defense = handCard(s, 'B', '木の葉隠れ');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
        s = until(s, 'normal-defense');
        rejected(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: true });
    });
    it('Lia substitutes a whole frozen other-player set and returns her own damage once', () => {
        let s = ready();
        character(s, 'A', '黒騎士ガーウィン');
        character(s, 'C', 'リーア姫');
        const card = handCard(s, 'A', '魔空剣');
        const defense = handCard(s, 'C', '光王陣');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'D'], dedicated: true });
        s = until(s, 'attack-abilities');
        s = priority(s, 'C');
        const groupId = group(s).id;
        s = act(s, 'C', { type: 'PLAY_GROUP_DEFENSE', cardInstanceId: defense, groupId, dedicated: true });
        s = until(s, 'before-roll');
        s = closeWindow(s, [1, 1]);
        s = closeWindow(s);
        s = finish(s);
        expect(s.players.B!.damage).toBe(0);
        expect(s.players.D!.damage).toBe(0);
        expect(s.players.A!.damage).toBe(10);
        expect(s.players.C!.damage).toBe(0);
    });
});
describe('legality, costs, and saved source choices', () => {
    it('rejects wrong owners, unexpected batches, repeated source and unprepared components before any payment', () => {
        let s = ready();
        character(s, 'A', '獣使いのウパニシャット');
        const card = handCard(s, 'A', '獣王剣');
        const chant = handCard(s, 'A', '滅殺斧');
        const ordinary = handCard(s, 'A', '気斬');
        const cost = handCard(s, 'A', '踏み込み／弓');
        const base = { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true };
        for (const extra of [{ coSource: { cardInstanceId: card, dedicated: false } }, { coSource: { cardInstanceId: ordinary, dedicated: true } }, { coSource: { cardInstanceId: chant, dedicated: false } }, { advanceCardInstanceIds: [cost] }])
            rejected(s, 'A', { ...base, ...extra });
        character(s, 'A', '忍びのイダ');
        rejected(s, 'A', base);
    });
    it('projects only own legal co-sources, including own hidden chant but never foreign hidden cards', () => {
        const s = ready();
        character(s, 'A', '獣使いのウパニシャット');
        handCard(s, 'A', '獣王剣');
        s.players.A!.permanent = { warrior_level: 1 };
        const co = prepared(s, 'A', '星流弓');
        const foreign = handCard(s, 'B', '気斬');
        const pool = viewFor(s, 'A').combinationOptions[0]!.coSources;
        expect(pool).toContainEqual({ cardInstanceId: co, dedicated: false });
        expect(pool.some(c => c.cardInstanceId === foreign)).toBe(false);
        expect(viewFor(s, 'B').combinationOptions).toEqual([]);
    });
    it('cancellation consumes both composite sources and independent source-use history', () => {
        let s = ready();
        character(s, 'A', '獣使いのウパニシャット');
        const card = handCard(s, 'A', '獣王剣');
        const co = handCard(s, 'A', '気斬');
        const fate = handCard(s, 'B', '命運凶変');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true, coSource: { cardInstanceId: co, dedicated: false } });
        const event = Object.values(s.actions!)[0]!.eventId;
        s = priority(s, 'B');
        s = act(s, 'B', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel', targetActionId: viewFor(s, 'B').reactionTargetActionId! });
        s = finish(s);
        expect(discardIds(s)).toEqual(expect.arrayContaining([card, co]));
        expect(s.used).toEqual(expect.arrayContaining([`${event}:A:${card}`, `${event}:A:${co}`]));
        expect(s.players.B!.damage).toBe(0);
    });
    it('canceled Magic Sky declaration retains the advance batch and prohibits a second payment', () => {
        let s = ready();
        character(s, 'A', '黒騎士ガーウィン');
        const card = handCard(s, 'A', '魔空剣');
        const cost = handCard(s, 'A', '踏み込み／弓');
        const fate = handCard(s, 'B', '命運凶変');
        s = passReclaims(act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true, advanceCardInstanceIds: [cost] }));
        s = priority(s, 'B');
        s = act(s, 'B', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel', targetActionId: viewFor(s, 'B').reactionTargetActionId! });
        s = finish(s);
        expect(discardIds(s)).toEqual(expect.arrayContaining([card, cost]));
        expect(s.players.B!.damage).toBe(0);
    });
    it('composite formula and inherited multi-hit are evaluated once with persisted provenance', () => {
        let s = ready();
        character(s, 'A', '獣使いのウパニシャット');
        const card = handCard(s, 'A', '獣王剣');
        s.players.A!.permanent = { warrior_level: 1 };
        const co = prepared(s, 'A', '天地百撃斬');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true, coSource: { cardInstanceId: co, dedicated: false } });
        s = until(s, 'damage');
        s = closeWindow(s, [2]);
        s = closeWindow(s);
        s = until(s, 'attack-abilities');
        expect(group(s).sourceCardInstanceIds).toEqual([card, co]);
        expect(group(s).targets[0]!.hits).toHaveLength(2);
        expect(group(s).technique.damage).toBe(17);
        s = finish(s);
        expect(s.players.B!.damage).toBe(34);
    });
    it('a null co-source remains null while Beast retains its numeric ten and inherited counter restrictions', () => {
        let s = ready();
        character(s, 'A', '獣使いのウパニシャット');
        const card = handCard(s, 'A', '獣王剣');
        const co = handCard(s, 'A', '影分身');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true, coSource: { cardInstanceId: co, dedicated: false } });
        expect(Object.values(s.actions!)[0]!.coSource!.technique.damage).toBeNull();
        s = finish(s);
        expect(s.players.B!.damage).toBe(10);
    });
    it('printed critical source grants two under suppression but suppresses actual optional ability', () => {
        let s = attack('裏天空剣', '忍びのイダ', true);
        s.players.A!.statuses = [{ id: 'seal', kind: 'ability-disabled', modifiers: [0], nextCheck: 0 }];
        s = until(s, 'hit-abilities');
        expect(group(s).targets[0]!.hits[0]!.abilityBudget!.granted).toBe(2);
        expect(viewFor(s, 'A').abilityOptions).toEqual([]);
        s = finish(s);
        expect(s.players.B!.damage).toBe(5);
    });
    it('critical cancellation consumes one attempt; God rerolls the second whole pair without a third', () => {
        let s = attack('裏天空剣', '忍びのイダ', true);
        const fate = handCard(s, 'B', '命運凶変');
        const god = handCard(s, 'C', '神性介入');
        s = until(s, 'hit-abilities');
        const event = viewFor(s, 'A').abilityOptions[0]!.targetEventId;
        s = act(s, 'A', { type: 'USE_ABILITY', abilityId: 'c2-p04-r2c2-ab03', targetEventId: event });
        s = act(s, 'B', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel-ability', targetAbilityId: viewFor(s, 'B').reactionTargetAbilityId! });
        s = passReclaims(closeWindow(s));
        s = passReclaims(closeWindow(s));
        s = act(s, 'A', { type: 'USE_ABILITY', abilityId: 'c2-p04-r2c2-ab03', targetEventId: event });
        s = passReclaims(closeWindow(s, [2, 2]));
        const roll = s.rolls!.at(-1)!.id;
        s = priority(s, 'C');
        s = act(s, 'C', { type: 'PLAY_REACTION', cardInstanceId: god, mode: 'reroll', targetRollId: roll });
        s = passReclaims(closeWindow(s, [1, 2]));
        s = passReclaims(closeWindow(s));
        expect(viewFor(s, 'A').abilityOptions).toEqual([]);
        s = finish(s);
        expect(s.players.B!.damage).toBe(10);
        expect(s.players.B!.presence ?? 'active').toBe('active');
    });
    it('Lia resistance failure consumes source, never rolls returned damage, and preserves original targets', () => {
        let s = ready();
        character(s, 'A', '黒騎士ガーウィン');
        character(s, 'C', 'リーア姫');
        const card = handCard(s, 'A', '魔空剣');
        const defense = handCard(s, 'C', '光王陣');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'D'], dedicated: true });
        s = until(s, 'attack-abilities');
        s = priority(s, 'C');
        s = act(s, 'C', { type: 'PLAY_GROUP_DEFENSE', cardInstanceId: defense, groupId: group(s).id, dedicated: true });
        s = until(s, 'before-roll');
        s = closeWindow(s, [6, 6]);
        s = closeWindow(s);
        s = finish(s);
        expect(s.players.B!.damage).toBe(15);
        expect(s.players.D!.damage).toBe(15);
        expect(discardIds(s)).toContain(defense);
        expect(s.rolls!.filter(r => r.formula === 'd6-product-min10')).toHaveLength(0);
    });
    it.each(['影分身', '木の葉隠れ'])('%s ordinary has its own minus-one enemy check; failure cancels only the received hit', (name) => {
        let s = ready();
        character(s, 'A', '黒騎士ガーウィン');
        const card = handCard(s, 'A', '衝破');
        const defense = handCard(s, 'B', name);
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
        s = until(s, 'normal-defense');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: false });
        s = until(s, 'damage');
        s = closeWindow(s);
        expect(s.rolls!.at(-1)).toMatchObject({ purpose: 'technique-check', rollerId: 'A', modifier: -1 });
        s = closeWindow(s, [6, 6]);
        s = closeWindow(s);
        s = finish(s);
        expect(s.players.B!.damage).toBe(0);
        expect(s.players.A!.damage).toBe(0);
    });
    it('Shadow Shin exception and Leaf dedicated automatic negation remain distinct', () => {
        for (const [name, damage] of [['影分身', 5], ['木の葉隠れ', 0]] as const) {
            let s = ready();
            character(s, 'B', '忍びのイダ');
            const card = handCard(s, 'A', '衝破');
            const defense = handCard(s, 'B', name);
            s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
            s = until(s, 'normal-defense');
            s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: true });
            s = finish(s);
            expect(s.players.B!.damage).toBe(damage);
            expect(s.rolls?.some(r => r.purpose === 'technique-check') ?? false).toBe(false);
        }
    });
});
describe('saved result boundaries and target groups', () => {
    it('ordinary Light King uses current spirit for use/effect level, a separate minus-two check, and defense only', () => {
        let s = ready();
        character(s, 'B', '白魔術師シェリム');
        const source = handCard(s, 'A', '衝破');
        const defense = handCard(s, 'B', '光王陣');
        s.distances.A!.B = 'near';
        s.distances.B!.A = 'near';
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: source, targetIds: ['B'], dedicated: false });
        s = until(s, 'normal-defense');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: false });
        expect(Object.values(s.actions!).find(a => a.cardInstanceId === defense)!.technique.useLevel).toBe(viewFor(s, 'B').self.stats.spirit);
        s = closeWindow(s);
        expect(s.rolls!.at(-1)).toMatchObject({ purpose: 'activation', rollerId: 'B', modifier: -2 });
        s = finish(s);
        expect(s.players.A!.damage).toBe(0);
        expect(s.players.B!.damage).toBe(0);
    });
    it('Lia ordinary elected dedicated defense needs no check, compares Lv normally, and grants no return at near range', () => {
        let s = ready();
        character(s, 'B', 'リーア姫');
        const source = handCard(s, 'A', '衝破');
        const defense = handCard(s, 'B', '光王陣');
        s.distances.A!.B = 'near';
        s.distances.B!.A = 'near';
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: source, targetIds: ['B'], dedicated: false });
        s = until(s, 'normal-defense');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: true });
        s = finish(s);
        expect(s.players.A!.damage).toBe(0);
        expect(s.players.B!.damage).toBe(0);
        expect(s.rolls?.some(r => r.kind === 'check') ?? false).toBe(false);
    });
    it('Light King forbids EVIL, counter-prohibited groups, and the normal Lv-insufficient defense without payment', () => {
        let s = attack('魔空剣', '黒騎士ガーウィン', true);
        const card = handCard(s, 'B', '光王陣');
        s = until(s, 'normal-defense');
        rejected(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false });
        character(s, 'B', 'リーア姫');
        s.players.B!.permanent = { spirit: -5 };
        rejected(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: true });
        s = attack('死歌', '吟遊詩人のレスター', true);
        character(s, 'C', 'リーア姫');
        handCard(s, 'C', '光王陣');
        s = until(s, 'attack-abilities');
        s = priority(s, 'C');
        expect(viewFor(s, 'C').groupDefenseOptions).toEqual([]);
        rejected(s, 'C', { type: 'PLAY_GROUP_DEFENSE', cardInstanceId: 'a2-p16-r3c3', groupId: group(s).id, dedicated: true });
    });
    it('Lia freezes all other eligible hits, excluding self and follower-started targets, across a child response', () => {
        let s = ready();
        character(s, 'A', '黒騎士ガーウィン');
        character(s, 'C', 'リーア姫');
        const card = handCard(s, 'A', '魔空剣');
        const defense = handCard(s, 'C', '光王陣');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'C', 'D'], dedicated: true });
        s = until(s, 'normal-defense');
        s = act(s, 'B', { type: 'START_FOLLOWERS' });
        s = until(s, 'hit');
        s = priority(s, 'C');
        expect(viewFor(s, 'C').groupDefenseOptions[0]!.targetIds).toEqual(['D']);
        const sourceGroup = group(s).id;
        s = act(s, 'C', { type: 'PLAY_GROUP_DEFENSE', cardInstanceId: defense, groupId: sourceGroup, dedicated: true });
        const action = Object.values(s.actions!).find(a => a.cardInstanceId === defense)!;
        expect(action.substitution!.hits).toEqual([{ targetId: 'D', hitIndex: 0 }]);
        s = finish(s);
        expect(s.players.B!.damage).toBe(15);
        expect(s.players.C!.damage).toBe(15);
        expect(s.players.D!.damage).toBe(0);
        expect(s.players.A!.damage).toBe(10);
    });
    it('Light King product is one saved whole two-face roll, and God replaces both faces', () => {
        let s = ready();
        character(s, 'A', '黒騎士ガーウィン');
        character(s, 'C', 'リーア姫');
        const card = handCard(s, 'A', '魔空剣');
        const defense = handCard(s, 'C', '光王陣');
        const god = handCard(s, 'D', '神性介入');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true });
        s = until(s, 'attack-abilities');
        s = priority(s, 'C');
        s = act(s, 'C', { type: 'PLAY_GROUP_DEFENSE', cardInstanceId: defense, groupId: group(s).id, dedicated: true });
        s = until(s, 'before-roll');
        s = closeWindow(s, [1, 1]);
        s = closeWindow(s, [2, 3]);
        const roll = s.rolls!.at(-1)!;
        expect(roll).toMatchObject({ formula: 'd6-product-min10', faces: [2, 3], total: 10 });
        s = priority(s, 'D');
        s = act(s, 'D', { type: 'PLAY_REACTION', cardInstanceId: god, mode: 'reroll', targetRollId: roll.id });
        s = closeWindow(s, [3, 4]);
        s = closeWindow(s);
        s = finish(s);
        expect(s.players.A!.damage).toBe(12);
        expect(s.randomRolls!.find(r => r.id === roll.id)).toMatchObject({ faces: [3, 4], total: 12 });
    });
    it.each([[1, 1, 0], [6, 6, 15]])('Death Song Gadyura own resistance %i/%i gives damage %i and uses no character metadata', (a, b, damage) => {
        let s = attack('死歌', '吟遊詩人のレスター', true);
        character(s, 'B', '不死王ガドューラ');
        s = until(s, 'before-roll');
        expect(s.rolls!.at(-1)).toMatchObject({ purpose: 'hit-resistance', rollerId: 'B', modifier: 0 });
        expect(JSON.stringify(viewFor(s, 'C').currentRoll)).not.toContain('c2-');
        s = closeWindow(s, [a, b]);
        s = closeWindow(s);
        s = finish(s);
        expect(s.players.B!.damage).toBe(damage);
        expect(s.rolls!.filter(r => r.purpose === 'hit-resistance')).toHaveLength(1);
    });
    it('Dragon King skip consumes one real whole turn, decrements fixed stop, and delays deadly recovery', () => {
        let s = attack('竜王爆砕剣', '魔導王ガイナス', true);
        s.players.B!.statuses = [{ id: 'fixed', kind: 'stopped', timing: 'fixed-turns', remainingTurns: 2 }, { id: 'deadly', kind: 'stopped', timing: 'deadly-recovery', modifiers: [-2], nextCheck: 0 }];
        s = finish(s);
        expect(viewFor(s, 'A').players.B!.skipsNextTurn).toBe(true);
        s = act(s, 'A', { type: 'PASS_WITHDRAWAL' });
        s = act(s, 'A', { type: 'END_TURN', discardIds: s.players.A!.hand.slice(0, Math.max(0, s.players.A!.hand.length - viewFor(s, 'A').self.stats.handLimit)) });
        s = finish(s);
        const hand = [...s.players.B!.hand];
        const rolls = s.rolls?.length ?? 0;
        s = act(s, 'B', { type: 'START_TURN' });
        expect(s.turnSeat).toBe(2);
        expect(s.phase).toBe('turn-start');
        expect(s.players.B!.hand).toEqual(hand);
        expect(s.rolls?.length ?? 0).toBe(rolls);
        expect(s.players.B!.statuses).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'fixed', remainingTurns: 1 }), expect.objectContaining({ id: 'deadly', nextCheck: 0 })]));
        expect(viewFor(s, 'C').players.B!.skipsNextTurn).toBe(false);
    });
    it('all multi-target damage waits for the group before simultaneous death settlement', () => {
        let s = ready();
        character(s, 'A', '吟遊詩人のレスター');
        character(s, 'B', '忍びのイダ');
        character(s, 'D', '白魔術師シェリム');
        s.players.B!.damage = 10;
        s.players.D!.damage = 10;
        const card = prepared(s, 'A', '死歌');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'D'], dedicated: true });
        s = until(s, 'hit');
        s = closeWindow(s);
        expect(s.players.B!.presence ?? 'active').toBe('active');
        expect(s.players.B!.damage).toBe(10);
        s = finish(s);
        expect(s.players.B!.presence).toBe('dead');
        expect(s.players.D!.presence).toBe('dead');
        const deaths = s.events.filter(e => e.type === 'PLAYER_DIED');
        expect(deaths.map(e => e.actorId)).toEqual(['B', 'D']);
        expect(new Set(deaths.map(e => e.death?.eventId)).size).toBe(1);
    });
});
describe('pending-hit arithmetic and nested source continuations', () => {
    it('Black Wing batch respects already finalized targets and applies before each pending hit multiplier', () => {
        let s = attack('黒翼天翔剣', '黒妖精のアーネス', true);
        const cost = handCard(s, 'A', '踏み込み／弓');
        s = until(s, 'hit-advance-choice');
        const g = group(s);
        // Persisted modifier/finalization inputs model a prior legal hit intervention, independently of this producer.
        g.targets[0]!.hits[0]!.damage = 30;
        g.targets[0]!.hits[0]!.damageMultiplier = 2;
        g.targets.push({ actorId: 'D', followerStarted: true, normalDefenseClosed: true, followerSnapshot: [], hitsApplied: true, pendingDamage: 15, hits: [{ index: 0, defended: false, damage: 15, hit: true, lineage: [] }] });
        s = passReclaims(act(s, 'A', { type: 'PAY_HIT_ADVANCES', groupId: g.id, cardInstanceIds: [cost] }));
        expect(group(s).targets[0]!.hits[0]!.damage).toBe(40);
        expect(group(s).targets[1]!.pendingDamage).toBe(15);
        expect(group(s).targets[1]!.hits[0]!.damage).toBe(15);
        rejected(s, 'A', { type: 'PAY_HIT_ADVANCES', groupId: g.id, cardInstanceIds: [] });
    });
    it('Black Dragon failure does not waive or repeat its optional own check after God and Fate', () => {
        let s = attack('黒竜剣', '黒騎士ガーウィン', true);
        const fate = handCard(s, 'B', '命運凶変');
        const god = handCard(s, 'C', '神性介入');
        s = until(s, 'technique-double-choice');
        s = act(s, 'A', { type: 'CHOOSE_DAMAGE_DOUBLE', actionId: viewFor(s, 'A').techniqueDecision!.kind === 'damage-double' ? (viewFor(s, 'A').techniqueDecision as any).actionId : 'invalid', attempt: true });
        const id = s.rolls!.at(-1)!.id;
        s = priority(s, 'B');
        s = act(s, 'B', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'force-fail', targetRollId: id });
        s = passReclaims(closeWindow(s));
        s = passReclaims(closeWindow(s, [1, 1]));
        s = priority(s, 'C');
        s = act(s, 'C', { type: 'PLAY_REACTION', cardInstanceId: god, mode: 'reroll', targetRollId: id });
        s = passReclaims(closeWindow(s, [2, 2]));
        s = passReclaims(closeWindow(s));
        s = finish(s);
        expect(s.players.B!.damage).toBe(10);
        expect(s.rolls!.filter(r => r.purpose === 'technique-check')).toHaveLength(1);
    });
    it('composite numeric provenance survives a counter child with its two physical sources still reserved', () => {
        let s = ready();
        character(s, 'A', '獣使いのウパニシャット');
        character(s, 'B', '早駆けのランカスター');
        s.distances.A!.B = 'near';
        s.distances.B!.A = 'near';
        const source = handCard(s, 'A', '獣王剣');
        const co = handCard(s, 'A', '狼牙');
        const defense = handCard(s, 'B', '閃光槍');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: source, targetIds: ['B'], dedicated: true, coSource: { cardInstanceId: co, dedicated: false } });
        s = until(s, 'damage');
        s = closeWindow(s, [3, 4]);
        s = closeWindow(s);
        s = until(s, 'normal-defense');
        const parent = group(s);
        const damageRoll = parent.damageRollId;
        expect(parent.technique.damage).toBe(17);
        expect(parent.sourceDamageRollIds).toEqual([damageRoll]);
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: true });
        s = until(s, 'attack-abilities');
        expect(s.groups![parent.id]!.sourceCardInstanceIds).toEqual([source, co]);
        expect(s.groups![parent.id]!.damageRollId).toBe(damageRoll);
        expect(s.resolution).toEqual(expect.arrayContaining([source, co, defense]));
        s = finish(s);
        expect(discardIds(s)).toEqual(expect.arrayContaining([source, co, defense]));
        expect(s.randomRolls!.find(r => r.id === damageRoll)).toMatchObject({ faces: [3, 4], total: 7 });
    });
    it('printed Shadow child canceled by Fate consumes the chosen attack and cannot reopen the grant', () => {
        let s = ready();
        character(s, 'A', '黒騎士ガーウィン');
        character(s, 'B', '忍びのイダ');
        const card = handCard(s, 'A', '衝破');
        const defense = handCard(s, 'B', '影分身');
        const child = handCard(s, 'B', '踏み込み／弓');
        const fate = handCard(s, 'C', '命運凶変');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false });
        s = until(s, 'normal-defense');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: defense, dedicated: true });
        s = until(s, 'ability-attack');
        s = act(s, 'B', { type: 'ATTACK', cardInstanceId: child, targetIds: ['A'], dedicated: false });
        s = act(s, 'C', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel', targetActionId: viewFor(s, 'C').reactionTargetActionId! });
        s = finish(s);
        expect(s.players.A!.damage).toBe(0);
        expect(s.players.B!.damage).toBe(0);
        expect(discardIds(s)).toEqual(expect.arrayContaining([card, defense, child]));
        expect(s.phase).toBe('withdrawal');
    });
    it('Lia return does not inherit incoming follower ignore and carries its used source lineage', () => {
        let s = ready();
        character(s, 'A', '黒騎士ガーウィン');
        character(s, 'C', 'リーア姫');
        const card = handCard(s, 'A', '魔空剣');
        const defense = handCard(s, 'C', '光王陣');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true });
        s = until(s, 'attack-abilities');
        group(s).technique.followerIgnore = true;
        s = priority(s, 'C');
        s = act(s, 'C', { type: 'PLAY_GROUP_DEFENSE', cardInstanceId: defense, groupId: group(s).id, dedicated: true });
        s = until(s, 'before-roll');
        s = closeWindow(s, [1, 1]);
        s = closeWindow(s);
        s = closeWindow(s);
        const child = Object.values(s.groups!).find(g => g.attackerId === 'C')!;
        expect(child.technique.followerIgnore).toBe(false);
        expect(child.targets[0]!.hits[0]!.lineage).toContain(defense);
        expect(child.technique.attributes).toEqual(['魔', '白', '反']);
        s = finish(s);
    });
});
describe('physical follower effects and immutable source legality', () => {
    it.each([
        ['獣王剣', '獣使いのウパニシャット', true, '水竜', 10, false],
        ['黒竜剣', '黒騎士ガーウィン', false, '守護者', 6, false],
        ['魔空剣', '黒騎士ガーウィン', false, '守護者', 10, false],
        ['黒翼天翔剣', '黒妖精のアーネス', true, '水竜', 15, true],
        ['裏天空剣', '忍びのイダ', true, '水竜', 5, true],
        ['死歌', '吟遊詩人のレスター', false, '水竜', 4, true],
    ])('%s resolves its exact follower clause', (name, owner, dedicated, followerName, damage, survives) => {
        let s = attack(name as string, owner as string, dedicated as boolean);
        const follower = handCard(s, 'B', followerName as string);
        s.players.B!.hand = s.players.B!.hand.filter(id => id !== follower);
        s.players.B!.followers.push({ cardInstanceId: follower, revealed: false });
        s = finish(s);
        expect(s.players.B!.damage).toBe(damage);
        expect(s.players.B!.followers.some(f => f.cardInstanceId === follower)).toBe(survives);
        if (!survives)
            expect(discardIds(s)).toContain(follower);
    });
    it('Magic Sky forbids evade, Black Wing requires two maai, and ordinary targets remain singular', () => {
        let s = attack('魔空剣', '黒騎士ガーウィン', false);
        const evade = handCard(s, 'B', '見切る');
        s = until(s, 'normal-defense');
        rejected(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: evade, dedicated: false });
        s = attack('黒翼天翔剣', '黒妖精のアーネス', false);
        const maai = handCard(s, 'B', '間合い／休息');
        s = until(s, 'normal-defense');
        s = passReclaims(act(s, 'B', { type: 'PLAY_MAAI', cardInstanceId: maai }));
        s = finish(s);
        expect(s.players.B!.damage).toBe(12);
        s = ready();
        character(s, 'A', '黒騎士ガーウィン');
        const card = handCard(s, 'A', '魔空剣');
        rejected(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B', 'C'], dedicated: false });
    });
    it('all dedicated sources reject a different owner and magic sources respect silence before consumption', () => {
        const attacks = ['黒翼天翔剣', '裏天空剣', '獣王剣', '黒竜剣', '魔空剣', '竜王爆砕剣', '死歌'];
        for (const name of attacks) {
            const s = ready();
            const card = handCard(s, 'A', name);
            rejected(s, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: true });
        }
        let s = ready();
        character(s, 'A', '吟遊詩人のレスター');
        const song = handCard(s, 'A', '死歌');
        rejected(s, 'A', { type: 'ATTACK', cardInstanceId: song, targetIds: ['B'], dedicated: true });
        s.players.A!.statuses = [{ id: 'silence', kind: 'silenced', modifiers: [0], nextCheck: 0 }];
        rejected(s, 'A', { type: 'CHANT', cardInstanceId: song, dedicated: true });
    });
});
describe('Beast composed counter entry', () => {
    function counterSetup(attackName = '衝破') {
        let s = ready();
        character(s, 'B', '獣使いのウパニシャット');
        const attack = handCard(s, 'A', attackName);
        const beast = handCard(s, 'B', '獣王剣');
        const co = handCard(s, 'B', '手裏剣');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: attack, targetIds: ['B'], dedicated: false });
        return { s: until(s, 'normal-defense'), beast, co };
    }
    it('normal defense offers compatible own counter sources and resolves Lv6/damage15 with both physical costs', () => {
        let { s, beast, co } = counterSetup();
        expect(viewFor(s, 'B').combinationOptions[0]!.coSources).toContainEqual({ cardInstanceId: co, dedicated: false });
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: co, dedicated: false } });
        expect(s.resolution).toEqual(expect.arrayContaining([beast, co]));
        s = finish(s);
        expect(s.players.A!.damage).toBe(15);
        expect(s.players.B!.damage).toBe(0);
        expect(discardIds(s)).toEqual(expect.arrayContaining([beast, co]));
    });
    it('composed defense cancellation spends both cards and resumes its one incoming hit', () => {
        let { s, beast, co } = counterSetup();
        const fate = handCard(s, 'C', '命運凶変');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: co, dedicated: false } });
        s = act(s, 'C', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel', targetActionId: viewFor(s, 'C').reactionTargetActionId! });
        s = finish(s);
        expect(s.players.B!.damage).toBe(5);
        expect(s.players.A!.damage).toBe(0);
        expect(discardIds(s)).toEqual(expect.arrayContaining([beast, co]));
    });
    it('insufficient Lv6, noncounter component, and counter prohibition reject before both payments', () => {
        let { s, beast, co } = counterSetup();
        const ordinary = handCard(s, 'B', '気斬');
        rejected(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: ordinary, dedicated: false } });
        group(s).technique.effectLevel = 7;
        expect(viewFor(s, 'B').combinationOptions.flatMap(o => o.coSources).some(c => c.cardInstanceId === co)).toBe(false);
        rejected(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: co, dedicated: false } });
        group(s).technique.effectLevel = 5;
        group(s).technique.counterProhibited = true;
        expect(viewFor(s, 'B').combinationOptions.flatMap(o => o.coSources)).toEqual([]);
        rejected(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: co, dedicated: false } });
    });
});
it('Beast defense evaluates a dynamic printed co-source use level without replacing the composed base Lv6', () => {
    let s = ready();
    character(s, 'B', '獣使いのウパニシャット');
    const source = handCard(s, 'A', '踏み込み／弓');
    const beast = handCard(s, 'B', '獣王剣');
    const parry = handCard(s, 'B', '受け流し');
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: source, targetIds: ['B'], dedicated: false });
    s = until(s, 'normal-defense');
    expect(viewFor(s, 'B').combinationOptions.flatMap(o => o.coSources)).toContainEqual({ cardInstanceId: parry, dedicated: false });
    s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: beast, dedicated: true, coSource: { cardInstanceId: parry, dedicated: false } });
    const action = Object.values(s.actions!).find(a => a.cardInstanceId === beast)!;
    expect(action.technique).toMatchObject({ useLevel: 6, effectLevel: 6, damage: 10 });
    expect(action.coSource!.technique.useLevel).toBe(3);
    s = finish(s);
    expect(s.players.B!.damage).toBe(0);
    expect(s.players.A!.damage).toBe(0);
});

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
describe('actual source classification and relative references', () => {
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
        expect(discardIds(s)).toEqual(expect.arrayContaining([beast, mirror]));
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
        // Physical Prayer disposal has its own window; close the actual parent effect boundary.
        while(s.windows?.at(-1)?.kind!=='damage'||s.windows.at(-1)!.continuation.id!==actionId)s=pass(s);
        expect(s.actions![actionId]!.technique).toMatchObject({ effectLevel: 8, blockWarriorLimit: 8, reflectMagicLimit: 9 });
        s = finish(s);
    });
});
describe('authoritative additional attack options', () => {
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
describe('exact grant packages and fixed defense limits', () => {
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
