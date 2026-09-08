import { describe, it, expect } from 'vitest';
import { parseGameCommand } from '../src/index.js';
describe('Task7i bounded wire choices', () => {
    const attack = { type: 'ATTACK', cardInstanceId: 'a2-p09-r1c1', targetIds: ['B'], dedicated: true, coSource: { cardInstanceId: 'a2-p08-r3c3', dedicated: false }, advanceCardInstanceIds: [] };
    it.each([attack, { type: 'CHOOSE_DAMAGE_DOUBLE', actionId: 'a-1', attempt: true }, { type: 'PAY_HIT_ADVANCES', groupId: 'g-1', cardInstanceIds: [] }, { type: 'PLAY_GROUP_DEFENSE', groupId: 'g-1', cardInstanceId: 'a2-p16-r3c3', dedicated: true }])('parses a detached exact choice %o', command => {
        const result = parseGameCommand(command);
        expect(result).toEqual({ ok: true, value: command });
        if (result.ok && result.value.type === 'ATTACK')
            expect(result.value.coSource).not.toBe(attack.coSource);
    });
    it.each([{ ...attack, coSource: { ...attack.coSource, actorId: 'forged' } }, { ...attack, coSource: { ...attack.coSource, dedicated: 1 } }, { ...attack, advanceCardInstanceIds: ['a', 'a'] }, { type: 'CHOOSE_DAMAGE_DOUBLE', actionId: 'a-1', attempt: 'true' }, { type: 'PAY_HIT_ADVANCES', groupId: 'g-1', cardInstanceIds: ['a', 'a'] }, { type: 'PLAY_GROUP_DEFENSE', groupId: 'g-1', cardInstanceId: 'a', dedicated: false }, { type: 'PLAY_GROUP_DEFENSE', groupId: 'g-1', cardInstanceId: 'a', dedicated: true, targetIds: ['B'] }])('rejects malformed or selective choices %o', command => expect(parseGameCommand(command).ok).toBe(false));
    it('rejects nested accessors without executing them', () => { let invoked = false; const coSource = { get cardInstanceId() { invoked = true; return 'a'; }, dedicated: false }; expect(parseGameCommand({ ...attack, coSource }).ok).toBe(false); expect(invoked).toBe(false); });
});
it('parses a composed defense as two independently selected physical sources', () => {
    const command = { type: 'PLAY_DEFENSE', cardInstanceId: 'a2-p09-r1c1', dedicated: true, coSource: { cardInstanceId: 'a2-p08-r2c3', dedicated: false } };
    expect(parseGameCommand(command)).toEqual({ ok: true, value: command });
    expect(parseGameCommand({ ...command, coSource: { ...command.coSource, unexpected: true } }).ok).toBe(false);
});
