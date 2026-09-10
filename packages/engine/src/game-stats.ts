import {followerFor} from './effects/follower-descriptors.js';
import {combinationSpiritBonus} from './effects/printed-combinations.js';
import type {DerivedStats,GameState} from './state.js';
import {canUseCharacterAbility} from './state.js';
import {derivedStats} from './setup.js';
import {conditionalStatAdditions} from './abilities/conditional-stats.js';
import {combatStatContext,techniqueStatContext,type StatProvenance} from './abilities/stat-context.js';
export interface GameStatOptions {excludeSourceAbilityId?:string|undefined;provenance?:StatProvenance;technique?:{school:string;attributes:string[]}}
/** Authoritative live values. Roll callers supply exact persisted provenance before G07 freeze. */
export function gameStats(s:GameState,playerId:string,options:GameStatOptions={}):DerivedStats{
 const p=s.players[playerId];if(!p)throw Error('UNKNOWN_ACTOR');
 const additions=conditionalStatAdditions(s,p,options.provenance);
 const selected=techniqueStatContext(s,options.provenance),technique=options.technique??(selected?.actorId===playerId?selected.technique:undefined);
 const attachments=p.presence==='wandering'?[]:p.attachments;
 const crown=attachments.includes('a2-p03-r1c2'),crystal=attachments.includes('a2-p03-r1c3');
 const magic=technique?.school==='magic'?(crown&&technique.attributes.some(a=>['地','水','炎','風'].includes(a))?1:0)+(crystal&&technique.attributes.some(a=>['黒','精'].includes(a))?2:0):0;
 const context=combatStatContext(s,options.provenance),group=context?.groupId?s.groups?.[context.groupId]:undefined;
 const follower=group?.targets.find(t=>t.actorId===p.id)?.followerDefense?.find(d=>d.source==='physical'&&d.cardInstanceId===context?.moraleFollowerCardInstanceId);
 const morale=(follower?.descriptor.attributes??(context?.attackerId===p.id&&context.moraleFollowerCardInstanceId?followerFor(context.moraleFollowerCardInstanceId)?.attributes:[]))?.includes('人')?(crown&&p.faction==='GOOD'?1:0)+(crystal&&p.faction==='EVIL'?2:0):0;
 const stats=derivedStats(p,{excludeSourceAbilityId:options.excludeSourceAbilityId,spiritAddition:additions.spirit+combinationSpiritBonus(s,playerId),magicAddition:magic,abilityAllowed:canUseCharacterAbility(p,s)});
 return {...stats,handLimit:stats.handLimit+additions.handLimit,moraleBonus:stats.moraleBonus+additions.moraleBonus+morale};
}
export type {StatProvenance};
