import type {DiscardEntry} from './discard.js';
import type {GameState, PlayerId} from './state.js';

/** What one seat kept to itself: its person, its hand, and every card it laid down face first. */
export interface SeatReveal {characterId:string;hand:string[];followers:string[];chants:string[]}
/** The whole table turned over. The printed rules say nothing about this; at a table everyone simply shows
 *  their hand once the game is decided, so online it waits for `outcome` instead (オンライン設計 §8). */
export interface EndgameReveal {players:Record<PlayerId,SeatReveal>;deck:string[];discard:DiscardEntry[]}
/** The single gate for everything the game held back: `viewFor` calls it only once `outcome` stands, so a
 *  seat's secrets have exactly one way onto the wire and it is closed for as long as the game is played. */
export function endgameReveal(state:GameState):EndgameReveal {
  return {
    players:Object.fromEntries(state.seatOrder.map(id=>{const player=state.players[id]!;
      return [id,{characterId:player.characterId,hand:[...player.hand],
        followers:player.followers.map(card=>card.cardInstanceId),chants:player.chants.map(card=>card.cardInstanceId)}];})),
    deck:[...state.deck],discard:state.discard.map(entry=>({...entry})),
  };
}
