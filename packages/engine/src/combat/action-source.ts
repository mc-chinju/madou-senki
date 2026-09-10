import type {ActionFrame} from '../reactions/continuations.js';
/** Physical-only continuations must never accept an ability as a card. */
export function requirePhysicalAction(a:ActionFrame):asserts a is ActionFrame&{cardInstanceId:string}{if(a.cardInstanceId===null)throw Error('PHYSICAL_ACTION_REQUIRED');}
export function actionCards(a:ActionFrame):string[]{return [...(a.cardInstanceId?[a.cardInstanceId]:[]),...(a.coSource?[a.coSource.cardInstanceId]:[])];}
export function effectProvenance(a:ActionFrame):{sourceCardInstanceId?:string;sourceAbilityId?:string}{if(a.effectSourceAbilityId&&!a.effectSourceCardInstanceId)return {sourceAbilityId:a.effectSourceAbilityId};const card=a.effectSourceCardInstanceId??a.cardInstanceId;return card?{sourceCardInstanceId:card}:a.effectSourceAbilityId?{sourceAbilityId:a.effectSourceAbilityId}:a.source?.kind==='ability'?{sourceAbilityId:a.source.abilityId}:{};}
export function physicalEffectCard(a:ActionFrame):string{const card=a.effectSourceCardInstanceId??a.cardInstanceId;if(!card)throw Error('PHYSICAL_EFFECT_REQUIRED');return card;}
export function physicalActionCard(a:ActionFrame):string{requirePhysicalAction(a);return a.cardInstanceId;}
