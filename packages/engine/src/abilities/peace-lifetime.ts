import type {GameInput} from '../commands.js';
import type {GameState} from '../state.js';
import {eventPending,reclaimEventId} from '../reclaim.js';
const PEACE='a2-p02-r1c1';
/** Bind the next accepted main action before synchronous declarations can finish. */
export function bindPeaceAction(s:GameState,before:GameState,input:GameInput):void {
 const c=input.command,p=s.players[input.actorId];
 if(!p||before.phase!=='action'||before.seatOrder[before.turnSeat]!==p.id||!['ATTACK','DECLARE_VIRTUAL_BLADE','PLAY_ALL_ARMY','PLAY_TURN_TECHNIQUE','PLAY_TURN_CARD','REST','CHANT','ARRANGE_FOLLOWERS','PASS_ACTION','USE_ABILITY'].includes(c.type)||c.type==='PLAY_TURN_CARD'&&'cardInstanceId' in c&&c.cardInstanceId==='a2-p03-r1c1')return;
 if(!p.spiritReplacements)return;
 const action=Object.values(s.actions??{}).find(a=>a.actorId===p.id&&!before.actions?.[a.id]);
 const ability=Object.values(s.abilities??{}).find(a=>a.actorId===p.id&&!before.abilities?.[a.id]&&a.costs.ownAction);
 if(c.type==='USE_ABILITY'&&!ability)return;
 const source=action??ability;
 p.spiritReplacements=p.spiritReplacements.filter(r=>{
  if(r.sourceCardInstanceId!==PEACE||!r.awaitingOwnAction)return true;
  if(!source)return false;
  delete r.awaitingOwnAction;r.expiresAfterEventId=reclaimEventId(s,source);return true;
 });
}
export function cleanPeaceLifetimes(s:GameState):void {
 for(const p of Object.values(s.players))if(p.spiritReplacements)p.spiritReplacements=p.spiritReplacements.filter(r=>r.sourceCardInstanceId!==PEACE||!r.expiresAfterEventId||eventPending(s,r.expiresAfterEventId));
}
export function peaceExpiryViews(s:GameState):{targetId:string;timing:'current-action'|'next-own-action'}[]{
 return s.seatOrder.flatMap(targetId=>s.players[targetId]!.spiritReplacements?.filter(r=>r.sourceCardInstanceId===PEACE).map(r=>({targetId,timing:r.awaitingOwnAction?'next-own-action' as const:'current-action' as const}))??[]);
}
