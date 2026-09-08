import { getAction } from '@madou/catalog';
import type { Technique, EffectContract } from '../reactions/continuations.js';
export interface FollowerDescriptor {
    level: number;
    hp: number;
    attributes: string[];
    moraleRequired: boolean;
    moraleModifier: number;
    conditionalLevel?: {
        kind: 'magic' | 'white-magic' | 'black-magic' | 'fire' | 'wind';
        level: number;
    };
    dedicated?: {
        characterIds: string[];
        level?: number;
        waiveMorale?: boolean;
        cancelIgnore?: boolean;
    };
    placementFaction?: 'GOOD' | 'EVIL';
    nonremovable?: boolean;
    revivalLimit?: number;
    spiritPass?: boolean;
    earthMagicNullify?: boolean;
    reflectionLimit?: number;
    cancelIgnore?: boolean;
    contract: EffectContract;
}
// The exact forty physical definitions; attack lines deliberately grant no permissions.
const rules: Record<string, Partial<FollowerDescriptor>> = {
    'a2-p19-r2c1': { revivalLimit: 4 }, 'a2-p19-r2c3': { spiritPass: true }, 'a2-p19-r3c2': { conditionalLevel: { kind: 'magic', level: 5 } }, 'a2-p19-r3c3': { revivalLimit: 5 },
    'a2-p20-r2c1': { earthMagicNullify: true }, 'a2-p20-r2c2': { conditionalLevel: { kind: 'magic', level: 5 } }, 'a2-p20-r2c3': { spiritPass: true },
    'a2-p20-r3c1': { moraleRequired: true, dedicated: { characterIds: ['c2-p05-r1c2'], waiveMorale: true } },
    'a2-p20-r3c2': { placementFaction: 'GOOD' }, 'a2-p20-r3c3': { placementFaction: 'EVIL', dedicated: { characterIds: ['c2-p04-r2c1'], level: 6 } },
    'a2-p21-r1c1': { revivalLimit: 6 }, 'a2-p21-r1c2': { moraleRequired: true, reflectionLimit: 4, dedicated: { characterIds: ['c2-p03-r1c2'], waiveMorale: true } },
    'a2-p21-r1c3': { moraleRequired: true, moraleModifier: -1, earthMagicNullify: true, dedicated: { characterIds: ['c2-p02-r1c1'], level: 7, waiveMorale: true } },
    'a2-p21-r2c1': { nonremovable: true, conditionalLevel: { kind: 'magic', level: 6 } },
    'a2-p21-r2c2': { moraleRequired: true, dedicated: { characterIds: ['c2-p03-r2c2'], waiveMorale: true, cancelIgnore: true } },
    'a2-p21-r2c3': { moraleRequired: true, moraleModifier: -2, dedicated: { characterIds: ['c2-p03-r1c1'], waiveMorale: true } },
    'a2-p21-r3c1': { moraleRequired: true, conditionalLevel: { kind: 'white-magic', level: 7 }, dedicated: { characterIds: ['c2-p05-r1c1'], level: 6, waiveMorale: true } },
    'a2-p21-r3c3': { moraleRequired: true, conditionalLevel: { kind: 'magic', level: 6 } }, 'a2-p22-r1c1': { spiritPass: true },
    'a2-p22-r1c2': { moraleRequired: true, dedicated: { characterIds: ['c2-p05-r1c1'], waiveMorale: true } },
    'a2-p22-r1c3': { moraleRequired: true, moraleModifier: -2, cancelIgnore: true, dedicated: { characterIds: ['c2-p03-r1c2'], waiveMorale: true } },
    'a2-p22-r2c1': { moraleRequired: true, conditionalLevel: { kind: 'magic', level: 7 }, dedicated: { characterIds: ['c2-p01-r1c1', 'c2-p03-r1c2'], waiveMorale: true } },
    'a2-p22-r2c2': { moraleRequired: true, conditionalLevel: { kind: 'fire', level: 7 } }, 'a2-p22-r2c3': { moraleRequired: true, conditionalLevel: { kind: 'magic', level: 7 } },
    'a2-p22-r3c1': { moraleRequired: true, conditionalLevel: { kind: 'wind', level: 7 }, dedicated: { characterIds: ['c2-p04-r1c2'], waiveMorale: true } },
    'a2-p22-r3c2': { moraleRequired: true, moraleModifier: -2, revivalLimit: 7, dedicated: { characterIds: ['c2-p06-r1c1'], waiveMorale: true } },
    'a2-p22-r3c3': { moraleRequired: true, moraleModifier: -1, conditionalLevel: { kind: 'black-magic', level: 8 }, cancelIgnore: true, dedicated: { characterIds: ['c2-p03-r1c2'], waiveMorale: true } },
    'a2-p23-r1c1': { moraleRequired: true },
};
export function followerFor(id: string): FollowerDescriptor | undefined {
    const card = getAction(id);
    if (card?.category !== 'follower')
        return;
    const stats = card.stats as {
        follower_level: number;
        hp: number;
        attributes: string[];
    };
    return { level: stats.follower_level, hp: stats.hp, attributes: [...stats.attributes], moraleRequired: false, moraleModifier: 0, ...structuredClone(rules[id] ?? {}), contract: { conditions: [], costs: [], timing: ['follower-start'], targets: 'self', lifetime: 'attack-group' } };
}
export function canSelectFollowerDedicated(id: string, characterId: string): boolean { return followerFor(id)?.dedicated?.characterIds.includes(characterId) ?? false; }
export function followerLevel(d: FollowerDescriptor, t: Technique, bonus: number, dedicated: boolean): number {
    let level = dedicated ? d.dedicated?.level ?? d.level : d.level;
    const c = d.conditionalLevel;
    if (c && (c.kind === 'magic' && t.school === 'magic' || c.kind === 'white-magic' && t.school === 'magic' && t.attributes.includes('白') || c.kind === 'black-magic' && t.school === 'magic' && t.attributes.includes('黒') || c.kind === 'fire' && t.attributes.includes('炎') || c.kind === 'wind' && t.attributes.includes('風')))
        level = c.level;
    return level + bonus;
}
