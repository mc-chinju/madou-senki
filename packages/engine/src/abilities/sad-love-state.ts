import type {GameState,PlayerState} from '../state.js';
import {canUseCharacterAbility,hasPendingFatal} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import {ownsAbility} from './ownership.js';
export const SAD_LOVE='c2-p05-r1c2-ab05';
export const ARNES='c2-p03-r2c2';
export interface SadLoveSource {substitutionEventId:string;originalTargetId:string;substituteId:string;substituteLifeId:string}
export function sadLoveAuraActive(s:GameState,p:PlayerState):boolean{return !!p.sadLoveAura&&ownsAbility(p,SAD_LOVE)&&isActive(p)&&!hasPendingFatal(s,p.id)&&canUseCharacterAbility(p,s);}
export function cleanSadLove(s:GameState):void {for(const p of Object.values(s.players))if(['pending-death','dead','exited'].includes(p.presence??'active')||!ownsAbility(p,SAD_LOVE))delete p.sadLoveAura;}
/** Attribution was saved before the simultaneous death batch; later suppression cannot revoke it. */
export function rewardSadLove(s:GameState,source:SadLoveSource):void {
 const p=s.players[source.originalTargetId];if(!p||p.characterId!==ARNES||p.sadLoveRewardIds?.includes(source.substitutionEventId))return;
 (p.permanent??={}).spirit=(p.permanent.spirit??0)+1;(p.sadLoveRewardIds??=[]).push(source.substitutionEventId);
}
