import type {DerivedStats,GameState} from './state.js';
import {derivedStats} from './setup.js';
import {conditionalStatAdditions} from './abilities/conditional-stats.js';
import type {StatProvenance} from './abilities/stat-context.js';
export interface GameStatOptions {excludeSourceAbilityId?:string|undefined;provenance?:StatProvenance}
/** Authoritative live values. Roll callers supply exact persisted provenance before G07 freeze. */
export function gameStats(s:GameState,playerId:string,options:GameStatOptions={}):DerivedStats{
 const p=s.players[playerId];if(!p)throw Error('UNKNOWN_ACTOR');
 const additions=conditionalStatAdditions(s,p,options.provenance);
 const stats=derivedStats(p,{excludeSourceAbilityId:options.excludeSourceAbilityId,spiritAddition:additions.spirit});
 return {...stats,handLimit:stats.handLimit+additions.handLimit,moraleBonus:stats.moraleBonus+additions.moraleBonus};
}
export type {StatProvenance};
