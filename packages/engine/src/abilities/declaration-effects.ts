import type { GameState } from '../state.js';
import { canUseCharacterAbility } from '../state.js';
import { isActive } from '../lifecycle/objectives.js';
import { ownsAbility } from './ownership.js';
import type { Technique } from '../reactions/continuations.js';
export const DECLARATION_ABILITIES = {
    'c2-p01-r1c1-ab03': { name: '大魔術師', kind: 'declaration' },
    'c2-p01-r1c1-ab04': { name: '強化詠唱', kind: 'declaration' },
    'c2-p01-r1c2-ab01': { name: '気闘術の奥義', kind: 'declaration' },
    'c2-p01-r1c2-ab03': { name: '拳圧', kind: 'declaration' },
    'c2-p01-r2c1-ab01': { name: 'ツバメ返し', kind: 'declaration' },
    'c2-p01-r2c1-ab02': { name: '居合抜き', kind: 'declaration' },
    'c2-p02-r1c2-ab04': { name: '精霊を統べるもの', kind: 'declaration' },
    'c2-p05-r2c1-ab03': { name: '剣匠', kind: 'declaration' },
    'c2-p05-r2c1-ab04': { name: '衝撃波', kind: 'declaration' },
    'c2-p05-r2c2-ab03': { name: '実力', kind: 'declaration' },
    'c2-p05-r2c2-ab04': { name: '黒龍の剣', kind: 'declaration' },
    'c2-p06-r2c2-ab02': { name: '野獣', kind: 'declaration' },
    'c2-p07-r1c2-ab02': { name: '破壊の神', kind: 'declaration' },
} as const;
export type DeclarationAbilityId = keyof typeof DECLARATION_ABILITIES;
export type DeclarationKind = 'attack' | 'defense' | 'turn-technique' | 'group-defense';
export interface DeclarationEffects {
    waiveChant?: boolean;
    noChecks?: boolean;
    far?: boolean;
    allTargets?: boolean;
    counter?: boolean;
    spiritCheck?: boolean;
    effectAddition?: number;
    effectReplacement?: number;
    effectDie?: boolean;
    damageAddition?: number;
    damageDouble?: boolean;
    damageDie?: boolean;
}
export function isDeclarationAbility(id: string): id is DeclarationAbilityId {
    return Object.hasOwn(DECLARATION_ABILITIES, id);
}
/** Qualify against the actual selected/composed source, never later numeric additions. */
export function declarationEffects(id: DeclarationAbilityId, t: Technique, kind: DeclarationKind, fromChant: boolean, revealed: boolean): DeclarationEffects | undefined {
    const magic = t.school === 'magic', sword = t.attributes.includes('剣'), martial = t.attributes.includes('格');
    const attack = kind !== 'turn-technique';
    if (!t.attributes.some(a => a === '戦' || a === '魔'))
        return;
    switch (id) {
        case 'c2-p01-r1c1-ab03': return magic ? { waiveChant: true } : undefined;
        case 'c2-p01-r1c1-ab04': return kind === 'attack' && magic && fromChant && revealed ? { allTargets: true } : undefined;
        case 'c2-p01-r1c2-ab01': return kind === 'defense' && martial ? { counter: true, spiritCheck: true } : undefined;
        case 'c2-p01-r1c2-ab03': return attack && martial && t.range === 'near' ? { far: true } : undefined;
        case 'c2-p01-r2c1-ab01': return kind === 'defense' && sword ? { counter: true, spiritCheck: true } : undefined;
        case 'c2-p01-r2c1-ab02': return sword ? { waiveChant: true, spiritCheck: true } : undefined;
        case 'c2-p02-r1c2-ab04': return magic && t.attributes.some(a => ['地', '風', '水', '炎'].includes(a)) ? { waiveChant: true, effectAddition: 1 } : undefined;
        case 'c2-p05-r2c1-ab03': return (attack && !magic && t.range === 'near' || sword) ? { ...(attack && !magic && t.range === 'near' ? { far: true } : {}), ...(sword ? { effectAddition: 1, damageAddition: 2 } : {}) } : undefined;
        case 'c2-p05-r2c1-ab04': return kind === 'attack' && sword && fromChant && revealed ? { allTargets: true } : undefined;
        case 'c2-p05-r2c2-ab03': return { waiveChant: true };
        case 'c2-p05-r2c2-ab04': return kind === 'attack' && sword && t.useLevel >= 6 && revealed ? { allTargets: true } : undefined;
        case 'c2-p06-r2c2-ab02': return martial ? { noChecks: true, effectDie: true, damageDie: true } : undefined;
        case 'c2-p07-r1c2-ab02': return { waiveChant: true, ...(kind === 'attack' ? { allTargets: true } : {}), ...(magic ? { effectReplacement: 10 } : { damageDouble: true }) };
    }
}
/** Usage properties and provisional upper bounds; saved numeric arithmetic is separate. */
export function applyDeclarationEffects(base: Technique, effects: DeclarationEffects[], numericMaximum = false): Technique {
    const t = structuredClone(base);
    for (const e of effects) {
        if (e.waiveChant)
            t.chant = false;
        if (e.noChecks)
            t.noChecks = true;
        if (e.far)
            t.range = 'far';
        if (e.allTargets) {
            t.target = 'all';
            delete t.maxTargets;
        }
        if (e.counter) {
            t.counter = true;
            t.defense = 'counter';
            if (!t.attributes.includes('反'))
                t.attributes.push('反');
        }
    }
    if (numericMaximum) {
        const replacement = effects.find(e => e.effectReplacement !== undefined)?.effectReplacement;
        t.effectLevel = (replacement ?? t.effectLevel) + effects.reduce((n, e) => n + (e.effectAddition ?? 0) + (e.effectDie ? 6 : 0), 0);
    }
    return t;
}

export function availableDeclarationEffects(s: GameState, actorId: string, t: Technique, kind: DeclarationKind, fromChant: boolean) {
    const p = s.players[actorId]!;
    if (!isActive(p) || !canUseCharacterAbility(p,s))
        return [];
    return (Object.keys(DECLARATION_ABILITIES) as DeclarationAbilityId[]).flatMap(abilityId => {
        if (!ownsAbility(p, abilityId))
            return [];
        const effects = declarationEffects(abilityId, t, kind, fromChant, p.revealed);
        return effects ? [{ abilityId, name: DECLARATION_ABILITIES[abilityId].name, effects }] : [];
    });
}
