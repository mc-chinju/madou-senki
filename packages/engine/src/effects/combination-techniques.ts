import type { Technique } from '../reactions/continuations.js';
const owners: Record<string, string> = {
    'a2-p08-r1c2': '黒妖精のアーネス', 'a2-p08-r3c1': '忍びのイダ', 'a2-p08-r3c2': '忍びのイダ',
    'a2-p09-r1c1': '獣使いのウパニシャット', 'a2-p09-r1c3': '黒騎士ガーウィン', 'a2-p09-r2c1': '黒騎士ガーウィン',
    'a2-p09-r2c2': '魔導王ガイナス', 'a2-p13-r2c2': '忍びのイダ', 'a2-p16-r3c3': 'リーア姫', 'a2-p17-r1c3': '吟遊詩人のレスター',
};
export function canSelectCombinationDedicated(id: string, name?: string): boolean { return !!name && owners[id] === name; }
function base(level: number, damage: number | null, changes: Partial<Technique> = {}): Technique {
    return { school: 'warrior', range: 'far', useLevel: level, effectLevel: level, damage, attributes: ['戦', '剣'], counter: false, chant: false, noChecks: false, defense: 'none', hitCount: 1, target: 'one', followerIgnore: false,
        contract: { conditions: ['in-hand-or-chant', 'own-action'], costs: [{ kind: 'physical-card', at: 'accept' }], timing: ['declaration'], targets: 'declared-players', lifetime: 'attack-group' }, ...changes };
}
export function combinationTechniqueFor(id: string, name?: string, selected = false): Technique | undefined {
    const own = selected && canSelectCombinationDedicated(id, name);
    switch (id) {
        case 'a2-p08-r1c2': return base(7, own ? 15 : 12, { attributes: ['戦', '剣', '詠'], chant: true, maaiRequired: 2, ...(own ? { effectLevel: 8, noChecks: true, followerIgnore: true, postHitAdvances: true } : {}) });
        case 'a2-p08-r3c1': return base(5, 5, { range: 'near', attributes: ['戦', '剣', '忍'], ...(own ? { noChecks: true, followerIgnore: true, criticalAttempts: 2 } : {}) });
        case 'a2-p08-r3c2': return base(5, null, { range: 'none', attributes: ['戦', '忍', '反'], counter: true, defense: 'fixed-negate', fixedNegate: { shinImmune: true, automatic: own, grantAttack: own } });
        case 'a2-p09-r1c1': return base(6, 10, { attributes: ['戦', '剣', '獣'], ...(own ? { noChecks: true, combinable: true, destroyFollowerAttributes: ['獣'] } : {}) });
        case 'a2-p09-r1c3': return base(5, own ? 10 : 6, { range: 'near', destroyFollowerAttributes: ['白'], ...(own ? { effectLevel: 6, noChecks: true, optionalDamageDouble: true } : {}) });
        case 'a2-p09-r2c1': return base(6, own ? 15 : 10, { destroyFollowerAttributes: ['白'], evadeProhibited: true, ...(own ? { effectLevel: 7, noChecks: true, target: 'all', advanceEffectCost: true } : {}) });
        case 'a2-p09-r2c2': return base(8, 10, own ? { noChecks: true, target: 'all', randomExtraMaai: true, dragonKingHit: true } : {});
        case 'a2-p13-r2c2': return base(3, null, { school: 'magic', range: 'none', attributes: ['魔', '忍', '反'], counter: true, defense: 'fixed-negate', fixedNegate: { automatic: own, forbiddenAttributes: ['炎', '風'] } });
        case 'a2-p16-r3c3': return base(0, 0, { school: 'magic', range: 'none', attributes: ['魔', '白', '反'], counter: true, defense: 'counter', useLevelSource: 'own-spirit', damageFormula: 'd6-product-min10', prohibitedFactions: ['EVIL', 'ヴァンミール'], ...(name !== 'リーア姫' ? { activationCheckModifier: -2 } : {}), ...(own ? { noChecks: true, target: 'all', groupSubstitution: true } : {}) });
        case 'a2-p17-r1c3': return base(7, 0, { school: 'magic', attributes: ['魔', '精', '歌', '詠'], chant: true, followerIgnore: true, damageFormula: own ? 'attacker-magic-x3' : '2d6x2', ...(own ? { effectLevel: 8, noChecks: true, target: 'all', counterProhibited: true, deathSongResistance: true } : {}) });
    }
}
