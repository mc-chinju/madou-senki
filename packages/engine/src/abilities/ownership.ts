import {getCharacter} from '@madou/catalog';
import type {PlayerState} from '../state.js';
/** Only canonical abilities on the current or actually inherited source characters. */
export function ownsAbility(player:PlayerState,abilityId:string):boolean {
 return [player.characterId,...(player.abilityCharacterIds??[])].some(id=>getCharacter(id)?.abilities.some(a=>a.id===abilityId));
}
