import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getCharacter } from '@madou/catalog';
import { transition, viewFor, previewDeclarationCandidate, type GameState, discardIds } from '../src/index.js';
import { act, ready, until, finish, closeWindow } from './combat-helpers.js';
import { character, handCard, entropy } from './fixtures.js';
const sources = JSON.parse(readFileSync(new URL('./fixtures/declaration-modifier-sources.json', import.meta.url), 'utf8'));
const SHELIM = 'c2-p01-r1c1-ab03';
const FURY = 'c2-p02-r1c2-ab04';
const GARWIN = 'c2-p05-r2c1-ab03';
const SHIN_COUNTER = 'c2-p01-r2c1-ab01';
const SHIN_CHANT = 'c2-p01-r2c1-ab02';
function setup(name: string, cardName: string) {
    const s = ready();
    character(s, 'A', name);
    for (const p of Object.values(s.players))
        p.permanent = { endurance: 100, spirit: 10 };
    const card = handCard(s, 'A', cardName);
    return { s, card };
}
function attack(s: GameState, card: string, ids: string[], targets = ['B']) {
    return act(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: targets, declarationAbilityIds: ids });
}
function rejected(s: GameState, command: unknown, code: string, actorId = 'A') {
    const before = JSON.stringify(s);
    expect(transition(s, { actorId, command } as any, entropy())).toEqual({ ok: false, code });
    expect(JSON.stringify(s)).toBe(before);
}
describe('whole declaration packages', () => {
    it.each([
        ['大神官ジル', '黒翼飛翔剣', 'c2-p01-r1c2-ab01'],
        ['侍大将のシン', '狼牙', SHIN_COUNTER],
    ])('%s counter conversion rejects unrelated %s for %s', (name, cardName, abilityId) => {
        let s = ready();character(s, 'B', name!);
        const incoming = handCard(s, 'A', '踏み込み／弓'), card = handCard(s, 'B', cardName!);
        s = until(act(s, 'A', {type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B']}), 'normal-defense');
        const saved = JSON.stringify(s);
        expect(transition(s, {actorId: 'B', command: {type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false, declarationAbilityIds: [abilityId!]}}, entropy()).ok).toBe(false);
        expect(JSON.stringify(s)).toBe(saved);
    });
    it.each([
        ['白魔術師シェリム', '天地百撃斬', SHELIM],
        ['侍大将のシン', '烈火', SHIN_CHANT],
        ['大神官ジル', '黒翼飛翔剣', 'c2-p01-r1c2-ab03'],
    ])('%s cannot select declaration %s with unrelated filter %s', (name, cardName, abilityId) => {
        const {s, card} = setup(name!, cardName!);
        const candidate = viewFor(s, 'A').declarationCandidates.find(c => c.choice.cardInstanceId === card && !c.choice.dedicated);
        expect(candidate?.abilities.some(a => a.abilityId === abilityId) ?? false).toBe(false);
        const saved = JSON.stringify(s);
        expect(transition(s, {actorId: 'A', command: {type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: ['B'], declarationAbilityIds: [abilityId!]}}, entropy()).ok).toBe(false);
        expect(JSON.stringify(s)).toBe(saved);
    });
    it('keeps all thirteen independent Japanese source records intact', () => {
        expect(sources).toHaveLength(13);
        for (const entry of sources) {
            const source = getCharacter(entry.characterId)!;
            expect({ characterId: source.id, characterName: source.name, ability: (({ implementation, ...printed }) => printed)(source.abilities.find(a => a.id === entry.ability.id)!) }).toEqual(entry);
        }
    });
    it.each([
        ['白魔術師シェリム', '烈火', SHELIM],
        ['妖精王フューリー', '烈火', FURY],
        ['魔導王ガイナス', '烈火', 'c2-p05-r2c2-ab03'],
        ['魔導王ガイナス', '天地百撃斬', 'c2-p05-r2c2-ab03'],
        ['侍大将のシン', '天地百撃斬', SHIN_CHANT],
    ])('%s %s explicitly waives chant through a saved cancellable declaration', (name, cardName, abilityId) => {
        const { s: initial, card } = setup(name!, cardName!);
        rejected(initial, { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: ['B'] }, 'CHANT_REQUIRED');
        let s = attack(initial, card, [abilityId!]);
        expect(s.resolution).toContain(card);
        s = closeWindow(s);
        expect(viewFor(s, 'A').currentAction).toMatchObject({ source: 'ability', abilityId });
        for (const viewer of ['B', 'C', 'D'])
            expect(JSON.stringify(viewFor(s, viewer))).not.toContain(abilityId);
        s = until(s, 'normal-defense');
        expect(viewFor(s, 'B').currentAttack!.technique.effectLevel).toBe(cardName === '烈火' ? (abilityId === FURY ? 8 : 7) : 7);
        s = finish(s);
        expect(discardIds(s).filter(id => id === card)).toHaveLength(1);
    });
    it('Garwin selects both range and sword numeric clauses together', () => {
        const { s: initial, card } = setup('黒騎士ガーウィン', '破黒剣');
        let s = attack(initial, card, [GARWIN]);
        s = until(s, 'normal-defense');
        expect(viewFor(s, 'B').currentAttack!.technique).toMatchObject({ effectLevel: 5, damage: 7 });
        expect(viewFor(s, 'A').abilityOptions.some(o => o.abilityId === GARWIN)).toBe(false);
    });
    it('a canceled requisite spends the card and resumes without a stuck PASS', () => {
        const { s: initial, card } = setup('白魔術師シェリム', '烈火');
        const fate = handCard(initial, 'B', '命運凶変');
        let s = closeWindow(attack(initial, card, [SHELIM]));
        s = act(s, 'B', { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel-ability', targetAbilityId: viewFor(s, 'B').reactionTargetAbilityId });
        s = finish(s);
        expect(s.players.B!.damage).toBe(0);
        expect(s.phase).toBe('withdrawal');
        expect(discardIds(s)).toEqual(expect.arrayContaining([card, fate]));
    });
    it('two Shin abilities use separate checks and convert an unchanted sword defense', () => {
        let s = ready();
        character(s, 'B', '侍大将のシン');
        s.players.B!.permanent = { spirit: 10 };
        const incoming = handCard(s, 'A', '踏み込み／弓');
        const sword = handCard(s, 'B', '天地百撃斬');
        s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B'] });
        s = until(s, 'normal-defense');
        s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: sword, dedicated: false, declarationAbilityIds: [SHIN_CHANT, SHIN_COUNTER] });
        s = finish(s);
        expect(s.rolls!.filter(r => r.rollerId === 'B' && r.purpose === 'ability-check')).toHaveLength(2);
        expect(s.players.B!.damage).toBe(0);
        expect(discardIds(s)).toContain(sword);
    });
    it('forged and duplicate selections reject atomically', () => {
        const { s, card } = setup('白魔術師シェリム', '烈火');
        for (const ids of [[GARWIN], [SHELIM, SHELIM], ['invented']]) {
            rejected(s, { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: ['B'], declarationAbilityIds: ids }, ids[0] === GARWIN ? 'ABILITY_DISABLED' : 'INVALID_COMMAND');
        }
    });
});


it('retains Garwin unchanted sword candidates so shared preview rejects both empty and selected modifiers', () => {
    const initial = setup('黒騎士ガーウィン', '黒翼天翔剣');
    const s = act(initial.s, 'A', {type: 'REVEAL_CHARACTER'});
    const before = JSON.stringify(s);
    const candidates = viewFor(s, 'A').declarationCandidates.filter(candidate =>
        candidate.choice.cardInstanceId === initial.card && !candidate.choice.dedicated);
    expect(candidates).toHaveLength(1);
    const candidate = candidates[0]!;
    expect(candidate).toMatchObject({kind: 'attack', sourceZone: 'hand', fromChant: false});
    expect(candidate.abilities.map(ability => ability.abilityId)).toEqual([GARWIN]);
    expect(previewDeclarationCandidate(candidate, [])).toMatchObject({canDeclare: false});
    expect(previewDeclarationCandidate(candidate, [GARWIN])).toMatchObject({
        canDeclare: false,
        technique: {chant: true, target: 'one'},
    });
    for (const viewer of ['B', 'C', 'D']) {
        expect(viewFor(s, viewer).declarationCandidates).toEqual([]);
        expect(viewFor(s, viewer).declarationSelection).toBeNull();
    }
    rejected(s, {type: 'ATTACK', cardInstanceId: initial.card, dedicated: false,
        targetIds: ['B', 'C'], declarationAbilityIds: [GARWIN]}, 'CHANT_REQUIRED');
    expect(JSON.stringify(s)).toBe(before);
});
