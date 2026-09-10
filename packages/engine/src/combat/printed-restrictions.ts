import {getCharacter} from '@madou/catalog';
import type {Technique} from '../reactions/continuations.js';
/** Printed character restrictions are mandatory, independent of optional ability availability. */
export function printedTechniqueAllowed(player:{characterId:string;faction:string},technique:Technique):boolean {
 const restrictions=getCharacter(player.characterId)?.restrictions??[];
 return !(['白','黒'] as const).some(attribute=>technique.attributes.includes(attribute)&&restrictions.includes(`${attribute}技使用不可`))
  && !technique.prohibitedFactions?.some(faction=>faction===player.faction);
}
