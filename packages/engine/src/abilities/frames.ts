import {CONDITIONAL_ABILITIES} from './conditional-sources.js';
import {TURN_PACKAGES} from './turn-packages.js';
import {DECLARATION_ABILITIES} from './declaration-effects.js';
/** Canonical source IDs stay in engine storage and the owning player's selection only. */
export const ABILITIES = {
 ...DECLARATION_ABILITIES,
 ...TURN_PACKAGES,
 ...CONDITIONAL_ABILITIES,
 'c2-p01-r1c2-ab04':{name:'信仰心',kind:'mental-protection'},
 'c2-p01-r2c1-ab04':{name:'精神統一',kind:'mental-protection'},
 'c2-p05-r2c1-ab02':{name:'執念',kind:'mental-protection'},
 'c2-p01-r2c2-ab04':{name:'いたずらしちゃった',kind:'named-response'},
 'c2-p02-r1c1-ab03':{name:'私、同性には興味がないもので',kind:'named-response'},
 'c2-p02-r2c2-ab03':{name:'不屈の意志',kind:'named-response'},
 'c2-p05-r1c1-ab03':{name:'愛など無駄だ',kind:'named-response'},
 'c2-p06-r1c1-ab02':{name:'死者',kind:'mental-protection'},
 'c2-p01-r2c1-ab05':{name:'鏡心',kind:'named-response'},
 'c2-p07-r1c1-ab02':{name:'悲しみを胸に',kind:'named-response'},
 'c2-p03-r2c1-ab01':{name:'魔詩',kind:'mental-defense'},
 'c2-p06-r1c1-ab01':{name:'恐怖',kind:'mental-defense'},
 'c2-p06-r1c2-ab01':{name:'魅了',kind:'mental-defense'},
 'c2-p03-r1c1-ab02':{name:'魔法抵抗',kind:'received-defense'},
 'c2-p03-r1c2-ab01':{name:'光の加護',kind:'received-defense'},
 'c2-p07-r1c1-ab01':{name:'光の盾',kind:'received-defense'},
 'c2-p05-r2c2-ab02':{name:'魔導王の威厳',kind:'received-defense'},
 'c2-p01-r1c1-ab01':{name:'絶対結界',kind:'received-defense'},
 'c2-p02-r1c2-ab01':{name:'光の結界',kind:'received-defense'},
 'c2-p02-r1c2-ab02':{name:'ミスリルのローブ',kind:'received-defense'},
 'c2-p02-r2c2-ab01':{name:'白銀の鎧',kind:'received-defense'},
 'c2-p03-r1c1-ab01':{name:'ミスリルの鎧',kind:'received-defense'},
 'c2-p03-r2c2-ab01':{name:'闇の結界',kind:'received-defense'},
 'c2-p04-r1c1-ab01':{name:'氷の結界',kind:'received-defense'},
 'c2-p05-r2c1-ab01':{name:'黒騎士の鎧',kind:'received-defense'},
 'c2-p05-r2c2-ab01':{name:'暗黒の鎧',kind:'received-defense'},
 'c2-p06-r2c1-ab01':{name:'炎の結界',kind:'received-defense'},
 'c2-p07-r1c2-ab01':{name:'巨神',kind:'received-defense'},

 'c2-p02-r2c1-ab01':{name:'瞬風',kind:'attack-property'},
 'c2-p03-r2c2-ab03':{name:'黒弓',kind:'action-value'},
 'c2-p05-r1c2-ab03':{name:'獣共感',kind:'beast-empathy'},
 'c2-p02-r2c1-ab02':{name:'竜殺槍',kind:'follower-destruction'},
 'c2-p02-r2c2-ab02':{name:'白龍の剣',kind:'follower-destruction'},
 'c2-p04-r1c2-ab01':{name:'風龍の剣',kind:'follower-destruction'},
 'c2-p06-r1c1-ab03':{name:'狂魂',kind:'follower-destruction'},
 'c2-p01-r1c1-ab02':{name:'賢者の杖',kind:'action-value'},
 'c2-p01-r1c2-ab02':{name:'鉄拳',kind:'action-value'},
 'c2-p01-r2c1-ab03':{name:'気合い',kind:'action-value'},
 'c2-p03-r1c1-ab03':{name:'斧使い',kind:'action-value'},
 'c2-p05-r1c1-ab02':{name:'破壊神の力',kind:'action-value'},
 'c2-p03-r2c2-ab02':{name:'女性親衛隊',kind:'virtual-guard'},
 'c2-p03-r2c1-ab02':{name:'幻術',kind:'illusion'},
 'c2-p02-r1c1-ab02':{name:'奇襲',kind:'surprise'},
 'c2-p05-r1c2-ab02':{name:'獣使い',kind:'follower-bundle'},
 'c2-p06-r1c2-ab04':{name:'下僕達',kind:'follower-bundle'},
 'c2-p02-r2c2-ab05':{name:'姫への愛',kind:'lancelot-transform'},
 'c2-p07-r1c2-ab04':{name:'破壊神の下僕達',kind:'vanmil-subordinates'},
 'c2-p04-r2c1-ab04':{name:'陰謀',kind:'arseil-conspiracy'},
 'c2-p04-r2c2-ab01':{name:'影分身',kind:'shadow'},
 'c2-p04-r2c2-ab02':{name:'忍び',kind:'martial-bypass'},
 'c2-p04-r2c2-ab03':{name:'必殺',kind:'lethal'},
 'c2-p04-r2c2-ab04':{name:'隠行',kind:'conceal-heal'},
} as const;
export type AbilityId=keyof typeof ABILITIES;
export type AbilityEffectId=import('@madou/protocol').AbilityEffectId;
export interface AbilityOption {targetIds?:string[];actionCost?:'main'|'extra';description?:string;abilityId:AbilityId;name:string;targetEventId:string;costCardInstanceIds?:string[];canConceal?:boolean;effectOptions?:{id:AbilityEffectId;name:string}[]}
export interface AbilityFrame {
 mentalGuards?:{actorId:string;abilityId:AbilityId;rollId:string}[];
 abilityEffectIds?:AbilityEffectId[];spiritSourceHitKeys?:string[];
 followerBundleId?:string;
 source:'ability'; id:string; abilityId:AbilityId; actorId:string; targetIds:string[];
 eventId:string; parentWindowId:string|null; useOrdinal:number;
 costs:{cardInstanceId?:string;ownAction:boolean};
 stage:'declaration'|'self-check'|'enemy-check'|'numeric'|'attack-choice'|'child-attack'|'applied';
 canceled:boolean; rollIds:string[]; conceal?:boolean;
 context:import('./conditional-selection.js').ConditionalContext|import('./turn-information.js').TurnAbilityContext|{kind:'mental-guard';sourceAbilityId:string;rollId:string}|{kind:'ability-response';sourceAbilityId:string}|{kind:'action';actionId:string}|{kind:'follower-entry';groupId:string;targetId:string}|{kind:'boundary';triggerId:string}|{kind:'own-action'}|{kind:'group';groupId:string;targetId:string|null;hitIndex:number};
}
