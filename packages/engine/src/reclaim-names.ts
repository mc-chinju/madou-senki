import {ownedCardNames} from '@madou/catalog';
import type {PlayerState} from './state.js';

/** Current printed ownership is distinct from inherited ability ownership. */
export function canonicalOwnedNames(player:PlayerState,kind:'technique'|'follower'):string[] {
  return [...new Set(ownedCardNames(player.characterId,kind)??[])];
}
