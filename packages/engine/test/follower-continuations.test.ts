import { expect, it } from 'vitest';
import { actionCards } from '@madou/catalog';
import { viewFor, type GameState } from '../src/index.js';
import { act, ready, until, finish, pass, closeWindow } from './combat-helpers.js';
import { character, handCard } from './fixtures.js';
function place(s: GameState, owner: string, name: string) { const id = handCard(s, owner, name); s.players[owner]!.hand = s.players[owner]!.hand.filter(x => x !== id); s.players[owner]!.followers.push({ cardInstanceId: id, revealed: false }); return id; }
function attack(s: GameState, name = '踏み込み／弓') { const id = handCard(s, 'A', name); if (actionCards.find(c => c.id === id)!.printed_text.split('\n')[0]!.includes('詠')) {
    s.players.A!.hand = s.players.A!.hand.filter(x => x !== id);
    s.players.A!.chants.push({ cardInstanceId: id, revealed: false });
} return until(act(s, 'A', { type: 'ATTACK', cardInstanceId: id, targetIds: ['B'], dedicated: false }, Array(30).fill(1)), 'normal-defense'); }
function group(s: GameState) { return Object.values(s.groups!)[0]!; }
function child(s: GameState) { for (let i = 0; i < 100; i++) {
    if (Object.values(s.groups!).length > 1)
        return s;
    s = pass(s);
} throw Error('NO_CHILD'); }
it('real guard reflection receives normal hand defense, including a second reflection with the same guard lineage only once', () => {
    let s = ready();
    character(s, 'A', '白魔術師シェリム');
    const guard = place(s, 'B', '王立騎士団');
    const mirror = handCard(s, 'A', '氷鏡');
    s = child(attack(s, '氷矢'));
    s = until(s, 'normal-defense');
    expect(viewFor(s, 'A').legalChoices).toContain('PLAY_DEFENSE');
    s = act(s, 'A', { type: 'PLAY_DEFENSE', cardInstanceId: mirror, dedicated: false });
    while (Object.values(s.groups!).length < 3)
        s = pass(s);
    s = finish(s);
    expect(s.players.A!.damage).toBe(0);
    expect(s.players.B!.damage).toBe(0);
    expect(s.players.B!.followers.map(f => f.cardInstanceId)).toContain(guard);
    expect(s.rolls!.filter(r => r.purpose === 'follower-morale')).toHaveLength(2);
});
it('snapshot retains levels and slots across nested reflection after Blessing loss and physical source movement', () => {
    let s = ready();
    character(s, 'A', '白魔術師シェリム');
    const guard = place(s, 'B', '王立騎士団');
    const rear = place(s, 'B', 'スケルトン');
    const blessing = handCard(s, 'B', '祝福');
    s.players.B!.hand = s.players.B!.hand.filter(id => id !== blessing);
    s.players.B!.open.push(blessing);
    s = child(attack(s, '氷矢'));
    const frozen = structuredClone(group(s).targets[0]!.followerDefense!);
    expect(frozen.map(f => f.levels)).toEqual([[6], [4]]);
    s.players.B!.open = s.players.B!.open.filter(id => id !== blessing);
    s.discard.push(blessing);
    s.players.B!.followers = s.players.B!.followers.filter(f => f.cardInstanceId !== rear);
    s.discard.push(rear);
    expect(group(s).targets[0]!.followerDefense).toEqual(frozen);
    s = finish(s);
    expect(s.players.A!.damage).toBe(4);
    expect(s.discard.filter(id => id === rear)).toHaveLength(1);
    expect(s.players.B!.followers[0]!.cardInstanceId).toBe(guard);
});
it('morale reroll replaces the complete saved roll and remains one source evaluation', () => {
    let s = ready();
    place(s, 'B', '有翼族');
    const reroll = handCard(s, 'C', '神性介入');
    s = until(attack(s), 'follower-start');
    s = closeWindow(s);
    s = closeWindow(s, [6, 6]);
    const id = s.rolls!.at(-1)!.id;
    while (s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor] !== 'C')
        s = pass(s);
    s = act(s, 'C', { type: 'PLAY_REACTION', cardInstanceId: reroll, mode: 'reroll', targetRollId: id }, [1, 2]);
    s = finish(s);
    const roll = s.rolls!.find(r => r.id === id)!;
    expect(roll.attempts).toHaveLength(2);
    expect(roll.faces).toHaveLength(2);
    expect(roll.success).toBe(true);
    expect(s.rolls!.filter(r => r.purpose === 'follower-morale')).toHaveLength(1);
    expect(s.players.B!.damage).toBe(0);
});
it('morale can be forced to fail and contributes no HP', () => {
    let s = ready();
    const source = place(s, 'B', '小人族');
    const fate = handCard(s, 'C', '命運凶変');
    s = until(attack(s), 'follower-start');
    s = closeWindow(s);
    const id = s.rolls!.at(-1)!.id;
    while (s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor] !== 'C')
        s = pass(s);
    s = act(s, 'C', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'force-fail', targetRollId: id });
    s = finish(s);
    expect(s.players.B!.damage).toBe(4);
    expect(s.discard).toContain(source);
    expect(s.rolls!.find(r => r.id === id)!.forcedFailure).toBe(true);
});
it.each([['スケルトン', '風斬剣'], ['ゾンビー', '黒流弓'], ['ワイト', '裂風斬'], ['デス・ナイト', '天地百撃斬']] as const)('%s survives a real printed technique at its revival upper bound', (name, attackName) => {
    let s = ready();
    const f = place(s, 'B', name);
    s = finish(attack(s, attackName));
    expect(s.players.B!.followers.some(x => x.cardInstanceId === f)).toBe(true);
    expect(s.discard).not.toContain(f);
});
// Explicit future C10 boundary fixtures: real attack group continuation with distinct per-hit techniques.
// They validate the consumer only; no heterogeneous attack declaration is implemented or claimed.
function heterogeneous(s: GameState, levels: number[], changes: Record<number, Record<string, unknown>> = {}) {
    s = attack(s);
    const g = group(s);
    g.hitIndices = levels.map((_, i) => i);
    g.targets[0]!.hits = levels.map((level, index) => ({ index, defended: false, damage: 10, hit: false, lineage: [], technique: { ...structuredClone(g.technique), effectLevel: level, damage: 10, ...changes[index] } }));
    return s;
}
it('future heterogeneous consumer pauses each reflection without reapplying earlier HP, rolls or physical destruction', () => {
    let s = ready();
    const front = place(s, 'B', '兵士');
    const guard = place(s, 'B', '王立騎士団');
    s = heterogeneous(s, [3, 6]);
    s = child(s);
    expect(group(s).targets[0]!.hits.map(h => h.damage)).toEqual([9, 9]);
    expect(s.discard).not.toContain(front);
    expect(s.players.B!.damage).toBe(0);
    expect(group(s).targets[0]!.followerDefense![1]!.hitCursor).toBe(1);
    s = finish(s);
    expect(s.players.A!.damage).toBe(9);
    expect(s.players.B!.damage).toBe(9);
    expect(s.discard).toEqual(expect.arrayContaining([front, guard]));
    expect(s.rolls!.filter(r => r.purpose === 'follower-morale')).toHaveLength(1);
});
it('future homogeneous multihit reflection continues every hit once even when counter cards are forbidden', () => {
    let s = ready();
    place(s, 'B', '王立騎士団');
    s = heterogeneous(s, [4, 4], { 0: { counterProhibited: true }, 1: { counterProhibited: true } });
    s = child(s);
    const returned = Object.values(s.groups!)[1]!;
    expect(returned.technique.counterProhibited).toBe(true);
    s = finish(s);
    expect(s.players.A!.damage).toBe(20);
    expect(s.players.B!.damage).toBe(0);
    expect(s.rolls!.filter(r => r.purpose === 'follower-morale')).toHaveLength(1);
});
it.each([['スケルトン', 3, 4], ['ゾンビー', 4, 5], ['ワイト', 5, 6], ['デス・ナイト', 7, 7]] as const)('future heterogeneous %s applies HP to every live hit and revives only without over-cap defeat', (name, level, limit) => {
    for (const overcap of [false, true]) {
        let s = ready();
        const id = place(s, 'B', name);
        s = heterogeneous(s, [level, overcap ? limit + 1 : limit]);
        s = finish(s);
        expect(s.players.B!.followers.some(f => f.cardInstanceId === id)).toBe(!overcap);
        expect(s.discard.includes(id)).toBe(overcap);
    }
});
it('future heterogeneous explicit destruction prevents revival but preserves other hit HP reduction', () => {
    let s = ready();
    const id = place(s, 'B', 'スケルトン');
    s = heterogeneous(s, [4, 4], { 0: { destroyFollowerAttributes: ['死'] } });
    s = until(s, 'hit');
    const d = group(s).targets[0]!.followerDefense![0]!;
    expect(d.hits.map(h => [h.outcome, h.hpReduction])).toEqual([['attribute-destroyed', 0], ['lower-destroyed', 4]]);
    s = finish(s);
    expect(s.players.B!.damage).toBe(16);
    expect(s.discard).toContain(id);
});
it('future heterogeneous explicit destruction still applies to spirit-immune golem and respects 飛 versus 空', () => {
    for (const name of ['ウッドゴーレム', '小悪魔', '小天使', '歌う船']) {
        let s = ready();
        const id = place(s, 'B', name);
        s = heterogeneous(s, [3], { 0: { attributes: ['魔', '精'], school: 'magic', destroyAllFollowersExceptAttributes: ['空'] } });
        s = finish(s);
        expect(s.players.B!.followers.some(f => f.cardInstanceId === id)).toBe(name === '歌う船');
    }
});
it('future heterogeneous reached earth warrior compares normally while earth magic is nullified', () => {
    let s = ready();
    place(s, 'B', '歌う船');
    s = heterogeneous(s, [6, 6], { 0: { school: 'magic', attributes: ['魔', '地'] }, 1: { school: 'warrior', attributes: ['戦', '地'] } });
    s = finish(s);
    expect(s.players.B!.damage).toBe(8);
});
it('reflection origin absence closes just the returned hit without retarget or losing remaining group', () => {
    let s = ready();
    place(s, 'B', '王立騎士団');
    s = heterogeneous(s, [4, 6]);
    s = until(s, 'follower-start');
    s.players.A!.presence = 'otherworld';
    s = finish(s);
    expect(s.players.B!.damage).toBe(10);
    expect(s.players.C!.damage).toBe(0);
    expect(s.windows).toEqual([]);
});
it('future heterogeneous frozen castle still blocks after child interruption changes faction and removes its physical card', () => {
    let s = ready();
    const guard = place(s, 'B', '王立騎士団');
    const castle = place(s, 'B', 'ガイナス城');
    const blessing = handCard(s, 'B', '祝福');
    s.players.B!.hand = s.players.B!.hand.filter(id => id !== blessing);
    s.players.B!.open.push(blessing);
    s = heterogeneous(s, [4, 6], { 1: { ignoreFollowerAttributes: ['人'] } });
    s = child(s);
    expect(group(s).targets[0]!.followerDefense![1]!.levels).toEqual([6, 6]);
    s.players.B!.faction = 'GOOD';
    s.players.B!.open = s.players.B!.open.filter(id => id !== blessing);
    s.discard.push(blessing);
    s = pass(s);
    expect(s.discard).toContain(castle);
    s = finish(s);
    expect(s.players.B!.damage).toBe(0);
    expect(s.discard.filter(id => id === castle)).toHaveLength(1);
    expect(s.players.B!.followers.map(f => f.cardInstanceId)).toEqual([guard]);
});
it('future heterogeneous reflected hit keeps original on-hit card provenance after return', () => {
    let s = ready();
    place(s, 'B', '王立騎士団');
    s = heterogeneous(s, [4], { 0: { school: 'magic', attributes: ['魔', '精'], onHitResistance: { modifiers: [-1], statusKind: 'silenced' } } });
    const original = s.actions![group(s).actionId]!.cardInstanceId;
    s = child(s);
    while (s.windows?.length) {
        const roll = s.rolls?.at(-1);
        s = pass(s, roll?.purpose === 'status-resistance' ? [6, 6] : Array(30).fill(1));
    }
    expect(s.players.A!.statuses?.find(status => status.kind === 'silenced')?.sourceCardInstanceId).toBe(original);
});
it('real hand reflection before Royal guard retains the original stopped-effect source', () => {
    let s = ready();
    character(s, 'A', '白魔術師シェリム');
    character(s, 'B', '凍気のアイエル');
    const guard = place(s, 'A', '王立騎士団');
    const spell = handCard(s, 'A', '鏡封');
    const mirror = handCard(s, 'B', '氷鏡');
    s = until(act(s, 'A', { type: 'ATTACK', cardInstanceId: spell, targetIds: ['B'], dedicated: false }), 'normal-defense');
    s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: mirror, dedicated: false });
    for (let i = 0; s.windows?.length && i < 250; i++) {
        s = pass(s, s.rolls?.at(-1)?.purpose === 'status-resistance' ? [6, 6] : Array(30).fill(1));
    }
    expect(s.windows).toEqual([]);
    expect(s.players.B!.statuses?.find(status => status.kind === 'stopped')).toMatchObject({ sourceActorId: 'A', sourceCardInstanceId: spell });
    expect(s.players.A!.followers.map(follower => follower.cardInstanceId)).toContain(guard);
    expect(s.discard).toContain(mirror);
});
