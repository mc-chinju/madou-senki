import type {GameState} from '../state.js';
import {appendEvent} from '../setup.js';
/** Mandatory consequences belong to every actual reveal, regardless of who chose it. */
export function revealCharacter(s:GameState,actorId:string,now:number):void{
 const p=s.players[actorId]!;
 if(p.revealed)return;
 p.revealed=true;
 appendEvent(s,now,{type:'CHARACTER_REVEALED',actorId,audience:'public',characterId:p.characterId});
 for(const g of Object.values(s.groups??{}))for(const t of g.targets){
  const target=s.players[t.actorId]!;
  if(!t.followerStarted&&target.revealed&&target.faction===s.players[g.attackerId]!.faction)for(const hit of t.hits)hit.defended=true;
 }
}
