import { expect, it } from 'vitest';
import { actionCards } from '@madou/catalog';
import { viewFor, type GameState, discardIds, moveToDiscard } from '../src/index.js';
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
// Explicit structural heterogeneous hits and faction mutation; not a physical conversion producer.
function heterogeneous(s: GameState, levels: number[], changes: Record<number, Record<string, unknown>> = {}) {
    s = attack(s);
    const g = group(s);
    g.hitIndices = levels.map((_, i) => i);
    g.targets[0]!.hits = levels.map((level, index) => ({ index, defended: false, damage: 10, hit: false, lineage: [], technique: { ...structuredClone(g.technique), effectLevel: level, damage: 10, ...changes[index] } }));
    return s;
}
it.each([['アルケミア城', 'GOOD', 'EVIL'], ['ガイナス城', 'EVIL', 'GOOD']] as const)('structural %s frozen defense survives faction loss and JSON reconstruction', (name, initialFaction, changedFaction) => {
    let s = ready();
    const guard = place(s, 'B', '王立騎士団');
    s.players.B!.faction = initialFaction;
    const castle = place(s, 'B', name);
    const blessing = handCard(s, 'B', '祝福');
    s.players.B!.hand = s.players.B!.hand.filter(id => id !== blessing);
    s.players.B!.open.push(blessing);
    s = heterogeneous(s, [4, 6], { 1: { ignoreFollowerAttributes: ['人'] } });
    s = child(s);
    expect(group(s).targets[0]!.followerDefense![1]!.levels).toEqual([6, 6]);
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s.players.B!.faction = changedFaction;
    s.players.B!.open = s.players.B!.open.filter(id => id !== blessing);
    moveToDiscard(s,blessing,{faceUp:true});
    s = pass(s);
    expect(discardIds(s)).toContain(castle);
    expect(s.players.B!.followers.some(f => f.cardInstanceId === castle)).toBe(false);
    expect(group(s).targets[0]!.followerDefense![1]!.levels).toEqual([6, 6]);
    s = JSON.parse(JSON.stringify(s)) as GameState;
    s = finish(s);
    expect(s.players.B!.damage).toBe(0);
    expect(discardIds(s).filter(id => id === castle)).toHaveLength(1);
    expect(s.players.B!.followers.map(f => f.cardInstanceId)).toEqual([guard]);
});
