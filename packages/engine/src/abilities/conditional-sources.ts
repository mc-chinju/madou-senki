import type {ConditionalAbilityId} from '@madou/protocol';
export const TIA_SPIRIT='c2-p02-r1c1-ab04',LIA_AURA='c2-p03-r1c2-ab03',ARNES_SPIRIT='c2-p03-r2c2-ab04',DRAGON_MORALE='c2-p04-r1c2-ab03',ASFELT_TRUTH='c2-p04-r1c2-ab05',UPA_BEAST='c2-p05-r1c2-ab01',GARWIN_RIVAL='c2-p05-r2c1-ab05',DIA_CAPACITY='c2-p06-r1c2-ab02';
export const CONDITIONAL_ABILITIES = {
 [TIA_SPIRIT]:{name:'ティアがんばる',kind:'conditional-stat',description:'公開されたレスターがいる間、精神力+1。'},
 [LIA_AURA]:{name:'この世界に愛を',kind:'conditional-stat',description:'自分が公開中、選んだ公開の他者の精神力+1。公開ランスロットがいる間、自分の精神力+2。'},
 [ARNES_SPIRIT]:{name:'男ごときが',kind:'conditional-stat',description:'公開男性を攻撃・防御する間、精神力+2。'},
 [DRAGON_MORALE]:{name:'竜皇子',kind:'conditional-stat',description:'竜属性の従者の士気判定値+2。'},
 [ASFELT_TRUTH]:{name:'真実',kind:'conditional-stat',description:'GOODの間、精神力+1。さらに公開ガイナス・ウーノスへの攻撃は技の効果Lv+1、ダメージ+2。'},
 [UPA_BEAST]:{name:'獣性',kind:'conditional-stat',description:'攻撃時のみ精神力+1。戦士技のダメージ+1。'},
 [GARWIN_RIVAL]:{name:'我がライバル',kind:'conditional-stat',description:'EVILかつ公開ランスロットがいる間、精神力+2。'},
 [DIA_CAPACITY]:{name:'闇の聖女達の情報',kind:'conditional-stat',description:'公開中は手札上限+2。賢者ハジャの追加と合算し、通常の手番末に調整する。'},
} as const satisfies Record<ConditionalAbilityId,{name:string;kind:'conditional-stat';description:string}>;
export function isConditionalAbility(id:string):id is ConditionalAbilityId{return Object.hasOwn(CONDITIONAL_ABILITIES,id);}
export interface ConditionalSelection {abilityId:ConditionalAbilityId;sourceCharacterId:string;targetIds:string[]}
