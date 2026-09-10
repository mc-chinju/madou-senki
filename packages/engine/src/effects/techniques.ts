import {canSelectCombinationDedicated} from './combination-techniques.js';
import {canSelectLifetimeDedicated} from './lifetime-techniques.js';
import type { Technique } from '../reactions/continuations.js';
import type { TechniqueVariant } from '@madou/protocol';
import { canSelectPrintedMagicDedicated } from './magic-techniques.js';

type TechniqueChanges = Partial<Omit<Technique, 'contract'>>;

const contract: Technique['contract'] = {
  conditions: ['in-hand-or-chant', 'own-action'],
  costs: [{ kind: 'physical-card', at: 'accept' }],
  timing: ['declaration'],
  targets: 'declared-players',
  lifetime: 'attack-group',
};

function warrior(changes: TechniqueChanges): Technique {
  return {
    school: 'warrior', range: 'none', useLevel: 0, effectLevel: 0, damage: null,
    attributes: [], counter: false, chant: false, noChecks: false,
    defense: 'none', hitCount: 1, target: 'one', followerIgnore: false,
    ...changes,
    contract,
  };
}

function dedicated(
  ordinary: Technique,
  selected: boolean,
  changes: TechniqueChanges,
): Technique {
  return selected ? { ...ordinary, ...changes } : ordinary;
}

type Factory = (characterName: string | undefined, selected: boolean, variant?: TechniqueVariant) => Technique;

const factories: Record<string, Factory> = {
  'a2-p07-r3c3': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 5, effectLevel: 5, damage: 10, attributes: ['戦', '弓'] }),
    selected && characterName === '黒妖精のアーネス',
    { followerIgnore: true, noChecks: true, target: 'all' },
  ),
  'a2-p08-r1c1': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 5, effectLevel: 5, damage: 7, attributes: ['戦', '剣'], maaiRequired: 2 }),
    selected && characterName === '黒妖精のアーネス',
    { effectLevel: 6, damage: 10, followerIgnore: true, noChecks: true },
  ),
  'a2-p08-r1c3': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 4, effectLevel: 4, damage: 6, attributes: ['戦', '剣', '風'], maaiRequired: 2, followerHpIgnore: true }),
    selected && characterName === '竜皇子アスフェルト',
    { effectLevel: 6, damage: 12, noChecks: true, target: 'all' },
  ),
  'a2-p08-r2c1': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 5, effectLevel: 5, damage: 7, attributes: ['戦', '剣', '風'], evadeProhibited: true }),
    selected && characterName === '竜皇子アスフェルト',
    { effectLevel: 7, damage: 14, noChecks: true, target: 'all' },
  ),
  'a2-p08-r2c2': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 6, effectLevel: 6, damage: 8, attributes: ['戦', '剣', '風'], maaiRequired: 2, evadeProhibited: true, followerHpIgnore: true }),
    selected && characterName === '竜皇子アスフェルト',
    { effectLevel: 8, damage: 16, noChecks: true, target: 'all', destroyFollowersAtOrBelowEffectLevel: true },
  ),
  'a2-p08-r3c3': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 6, effectLevel: 6, damage: null, damageFormula: 'attacker-spirit', attributes: ['戦', '剣', '精', '忍'], followerIgnore: true }),
    selected && characterName === '忍びのイダ',
    { effectLevel: 7, damageFormula: 'attacker-spirit-x2', noChecks: true },
  ),
  'a2-p09-r1c2': (characterName, selected) => dedicated(
    warrior({ range: 'near', useLevel: 4, effectLevel: 4, damage: 5, attributes: ['戦', '剣'], destroyFollowerAttributes: ['白'] }),
    selected && characterName === '黒騎士ガーウィン',
    { effectLevel: 5, damage: 7, noChecks: true },
  ),
  'a2-p09-r2c3': (characterName, selected) => dedicated(
    warrior({ range:'far', useLevel:8, effectLevel:8, damage:10, attributes:['戦','黒','詠'], chant:true, prohibitedFactions:['GOOD'], onHitResistance:{modifiers:[-2],failureDamage:10} }),
    selected && characterName === '魔導王ガイナス',
    { noChecks:true, target:'all', onHitResistance:{modifiers:[-3],failureDamage:10} },
  ),
  'a2-p09-r3c2': (characterName, selected) => dedicated(
    warrior({ range: 'near', useLevel: 4, effectLevel: 4, damage: null, damageFormula: 'attacker-spirit-x2', attributes: ['戦', '格', '精', '白'], maaiRequired: 2 }),
    selected && characterName === '大神官ジル',
    {
      noChecks: true,
      characterImmunityExceptions: [{ characterName: '不死王ガドューラ', immunity: 'spirit-techniques' }],
    },
  ),
  'a2-p09-r3c3': (characterName, selected) => dedicated(
    warrior({ range: 'near', useLevel: 6, effectLevel: 6, damage: 6, attributes: ['戦', '格'], maaiRequired: 2 }),
    selected && characterName === '大神官ジル',
    { noChecks: true },
  ),
  'a2-p10-r1c1': (characterName, selected) => dedicated(
    warrior({ range: 'near', useLevel: 7, effectLevel: 7, damage: 6, attributes: ['戦', '格', '白'], destroyFollowerAttributes: ['黒', '死'] }),
    selected && characterName === '大神官ジル',
    { noChecks: true },
  ),
  'a2-p10-r1c2': (characterName, selected) => dedicated(
    warrior({ range: 'near', useLevel: 8, effectLevel: 8, damage: 10, attributes: ['戦', '格', '白'], destroyFollowerAttributes: ['黒', '死'] }),
    selected && characterName === '大神官ジル',
    { noChecks: true, characterDamageMultipliers: [{ characterNames: ['不死王ガドューラ', '魔聖母ディア'], multiplier: 2 }] },
  ),
  'a2-p10-r2c1': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 8, effectLevel: 8, damage: 15, attributes: ['戦', '剣', '詠'], chant: true, maxTargets: 2, ...(characterName !== '侍大将のシン' ? { activationCheckModifier: -2 } : {}) }),
    selected && characterName === '侍大将のシン',
    { counter: true, defense: 'counter', maaiRequired: 2, noChecks: true, target: 'all' },
  ),
  'a2-p10-r2c2': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 6, effectLevel: 6, damage: 8, attributes: ['戦', '弓', '白'], destroyFollowerAttributes: ['黒', '死'], characterDamageMultipliers: [{ characterNames: ['不死王ガドューラ'], multiplier: 2 }] }),
    selected && characterName === '妖精王フューリー',
    { damage: 10, maaiRequired: 2, noChecks: true, target: 'all' },
  ),
  'a2-p10-r2c3': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 7, effectLevel: 7, damage: 10, attributes: ['戦', '弓', '白', '詠'], chant: true, maaiRequired: 2, evadeProhibited: true, destroyFollowerAttributes: ['黒', '死'] }),
    selected && characterName === '妖精王フューリー',
    { effectLevel: 8, damage: 13, noChecks: true, target: 'all', destroyFollowersAtOrBelowEffectLevel: true },
  ),
  'a2-p10-r3c1': (characterName, selected) => dedicated(
    warrior({ range: 'near', useLevel: 5, effectLevel: 5, damage: null, damageFormula: '2d6', attributes: ['戦', '格'] }),
    selected && characterName === '餓狼ヨーツルム',
    { range: 'far', damageFormula: '3d6', maaiRequired: 2, noChecks: true },
  ),
  'a2-p10-r3c2': (characterName, selected, variant) => dedicated(
    warrior({ range: 'far', useLevel: 4, effectLevel: 4, damage: 5, attributes: ['戦', '槍'], maaiRequired: 2 }),
    selected && characterName === '早駆けのランカスター',
    { effectLevel: 5, damage: 7, hitCount: variant === 'one-hit' ? 1 : 2, noChecks: true },
  ),
  'a2-p11-r1c1': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 6, effectLevel: 6, damage: 10, attributes: ['戦', '槍'], destroyAllFollowers: true }),
    selected && characterName === '早駆けのランカスター',
    { effectLevel: 7, damage: 15, noChecks: true, target: 'all', optionalChant: true, chantDamageMultiplier: 2 },
  ),
  'a2-p11-r1c2': (characterName, selected) => dedicated(
    warrior({ range: 'near', useLevel: 5, effectLevel: 5, damage: 4, attributes: ['戦', '剣', '白', '反'], counter: true, defense: 'counter', destroyFollowerAttributes: ['黒', '死'] }),
    selected && (characterName === '聖騎士ランスロット' || characterName === '聖騎士ランスロット2'),
    { effectLevel: 6, damage: 7, counterNoChecks: true },
  ),
  'a2-p11-r2c1': (characterName, selected, variant) => {
    const ordinary = warrior({ range: 'near', useLevel: 6, effectLevel: 6, damage: 6, attributes: ['戦', '剣', '白'], destroyFollowerAttributes: ['黒', '死'] });
    if (!selected) return ordinary;
    if (characterName === '聖騎士ランスロット2' && variant !== 'lancelot-1') return { ...ordinary, effectLevel: 8, damage: 15, maaiRequired: 2, noChecks: true };
    return dedicated(ordinary, characterName === '聖騎士ランスロット' || (characterName === '聖騎士ランスロット2' && variant === 'lancelot-1'), { effectLevel: 7, damage: 10, maaiRequired: 2, noChecks: true });
  },
  'a2-p11-r2c2': (characterName, selected, variant) => {
    const ordinary = warrior({ range: 'far', useLevel: 7, effectLevel: 7, damage: 10, attributes: ['戦', '剣', '白', '詠'], chant: true, destroyFollowerAttributes: ['黒', '死'] });
    if (!selected) return ordinary;
    if (characterName === '聖騎士ランスロット2' && variant !== 'lancelot-1') return { ...ordinary, effectLevel: 9, damage: 25, chant: false, noChecks: true, target: 'all' };
    return dedicated(ordinary, characterName === '聖騎士ランスロット' || (characterName === '聖騎士ランスロット2' && variant === 'lancelot-1'), { effectLevel: 8, damage: null, damageFormula: '4d6+1', noChecks: true, target: 'all' });
  },
  'a2-p11-r2c3': (characterName, selected) => dedicated(
    warrior({ range: 'near', useLevel: 4, effectLevel: 4, damage: 6, attributes: ['戦', '斧'] }),
    selected && characterName === '小人のランバ',
    { noChecks: true, destroyFollowersAtOrBelow: 5 },
  ),
  'a2-p11-r3c1': (characterName, selected) => dedicated(
    warrior({ range: 'near', useLevel: 5, effectLevel: 5, damage: 8, attributes: ['戦', '斧'] }),
    selected && characterName === '小人のランバ',
    { noChecks: true, destroyFollowersAtOrBelow: 6 },
  ),
  'a2-p11-r3c2': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 6, effectLevel: 6, damage: 10, attributes: ['戦', '斧'], maaiRequired: 2 }),
    selected && characterName === '小人のランバ',
    { noChecks: true, target: 'all', destroyFollowersAtOrBelow: 7 },
  ),
  'a2-p11-r3c3': (characterName, selected) => dedicated(
    warrior({ range: 'far', useLevel: 7, effectLevel: 7, damage: 12, attributes: ['戦', '斧', '詠'], chant: true }),
    selected && characterName === '小人のランバ',
    { effectLevel: 8, damage: 20, chant: false, noChecks: true, target: 'all' },
  ),
  'a2-p12-r1c1': (characterName, selected) => {
    const ordinary = warrior({ range: 'near', useLevel: 4, effectLevel: 4, damage: 4, attributes: ['戦', '剣', '白'], destroyFollowerAttributesAtOrBelowEffectLevel: ['黒', '死'] });
    if (!selected) return ordinary;
    if (characterName === 'リーア姫') return { ...ordinary, damage: 5, noChecks: true };
    return dedicated(ordinary, characterName === '聖騎士ランスロット' || characterName === '聖騎士ランスロット2', { effectLevel: 5, damage: 6, noChecks: true });
  },
  'a2-p12-r1c2': () => warrior({ range: 'far', useLevel: 4, effectLevel: 4, damage: 5, attributes: ['戦', '剣'] }),
};

const dedicatedOwners: Record<string, string> = {
  'a2-p07-r3c3': '黒妖精のアーネス',
  'a2-p08-r1c1': '黒妖精のアーネス',
  'a2-p08-r1c3': '竜皇子アスフェルト',
  'a2-p08-r2c1': '竜皇子アスフェルト',
  'a2-p08-r2c2': '竜皇子アスフェルト',
  'a2-p08-r3c3': '忍びのイダ',
  'a2-p09-r1c2': '黒騎士ガーウィン',
  'a2-p09-r2c3': '魔導王ガイナス',
  'a2-p09-r3c2': '大神官ジル',
  'a2-p09-r3c3': '大神官ジル',
  'a2-p10-r1c1': '大神官ジル',
  'a2-p10-r1c2': '大神官ジル',
  'a2-p10-r1c3': '侍大将のシン',
  'a2-p10-r2c1': '侍大将のシン',
  'a2-p10-r2c2': '妖精王フューリー',
  'a2-p10-r2c3': '妖精王フューリー',
  'a2-p10-r3c1': '餓狼ヨーツルム',
  'a2-p10-r3c2': '早駆けのランカスター',
  'a2-p11-r1c1': '早駆けのランカスター',
  'a2-p11-r1c2': '聖騎士ランスロット',
  'a2-p11-r2c1': '聖騎士ランスロット',
  'a2-p11-r2c2': '聖騎士ランスロット',
  'a2-p11-r2c3': '小人のランバ',
  'a2-p11-r3c1': '小人のランバ',
  'a2-p11-r3c2': '小人のランバ',
  'a2-p11-r3c3': '小人のランバ',
  'a2-p12-r1c1': 'リーア姫',
};

export function printedWarriorTechniqueFor(id: string, characterName?: string, selected = false, variant?: TechniqueVariant): Technique | undefined {
  return factories[id]?.(characterName, selected, variant);
}

export function canSelectPrintedVariant(id:string, characterName:string|undefined, selected:boolean, variant:TechniqueVariant|undefined):boolean {
  if (variant === undefined) return true;
  if (!selected) return false;
  if (id === 'a2-p10-r3c2') return characterName === '早駆けのランカスター' && (variant === 'one-hit' || variant === 'two-hit');
  if (id === 'a2-p11-r2c1' || id === 'a2-p11-r2c2') {
    if (variant === 'lancelot-1') return characterName === '聖騎士ランスロット' || characterName === '聖騎士ランスロット2';
    return variant === 'lancelot-2' && characterName === '聖騎士ランスロット2';
  }
  return false;
}

export function canSelectPrintedDedicated(id: string, characterName?: string): boolean {
  if (id==='a2-p12-r3c2') return characterName==='凍気のアイエル';
  if (['a2-p06-r1c1','a2-p06-r1c2'].includes(id)) return characterName === '餓狼ヨーツルム';
  if (canSelectCombinationDedicated(id,characterName)||canSelectLifetimeDedicated(id,characterName)||canSelectPrintedMagicDedicated(id,characterName)) return true;
  if (['a2-p11-r1c2', 'a2-p11-r2c1', 'a2-p11-r2c2'].includes(id)) return characterName === '聖騎士ランスロット' || characterName === '聖騎士ランスロット2';
  if (id === 'a2-p12-r1c1') return characterName === 'リーア姫' || characterName === '聖騎士ランスロット' || characterName === '聖騎士ランスロット2';
  return dedicatedOwners[id] === characterName;
}
