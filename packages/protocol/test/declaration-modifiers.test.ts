import { describe, expect, it } from 'vitest';
import { parseGameCommand } from '../src/index.js';
const ability = 'c2-p01-r1c1-ab03';
const commands = [
    { type: 'ATTACK', cardInstanceId: 'source', targetIds: ['B'], dedicated: false },
    { type: 'PLAY_DEFENSE', cardInstanceId: 'source', dedicated: false },
    { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: 'source', targetIds: ['A'], dedicated: false },
    { type: 'PLAY_GROUP_DEFENSE', cardInstanceId: 'source', groupId: 'group', dedicated: true },
];
describe('strict optional declaration selections', () => {
    it.each(commands)('round-trips selections on $type without mutating the input', command => {
        const input = { ...command, declarationAbilityIds: [ability] };
        const parsed = parseGameCommand(input);
        expect(parsed).toEqual({ ok: true, value: input });
        if (parsed.ok) {
            expect((parsed.value as any).declarationAbilityIds).not.toBe(input.declarationAbilityIds);
        }
    });
    it.each([undefined, null, 'ability', [ability, ability], ['invented'], ['c2-p01-r1c1-ab02'], Array(14).fill(ability), Array(1)])('rejects malformed, unrelated or duplicate IDs (%j)', ids => {
        expect(parseGameCommand({ ...commands[0], declarationAbilityIds: ids })).toEqual({ ok: false, code: 'INVALID_COMMAND' });
    });
    it.each([
        { type: 'CHANT', cardInstanceId: 'source' },
        { type: 'PASS' },
        { type: 'USE_ABILITY', abilityId: ability, targetEventId: 'event' },
    ])('does not admit a declaration field on $type', command => {
        expect(parseGameCommand({ ...command, declarationAbilityIds: [] })).toEqual({ ok: false, code: 'INVALID_COMMAND' });
    });
    it('rejects private state, accessor properties and nested forged IDs', () => {
        for (const extra of [{ declaration: { committed: true } }, { ownerId: 'A' }, { declarationSelection: {} }, { abilities: [] }]) {
            expect(parseGameCommand({ ...commands[0], declarationAbilityIds: [ability], ...extra }).ok).toBe(false);
        }
        const accessor = Object.defineProperty({ ...commands[0] }, 'declarationAbilityIds', { enumerable: true, get() { throw Error('must not invoke'); } });
        expect(parseGameCommand(accessor).ok).toBe(false);
        expect(parseGameCommand({ ...commands[0], declarationAbilityIds: [ability], coSource: { cardInstanceId: 'component', dedicated: false, declarationAbilityIds: [ability] } }).ok).toBe(false);
    });
});
