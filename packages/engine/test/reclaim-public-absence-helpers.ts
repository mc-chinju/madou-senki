import {expect} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {entropy} from './fixtures.js';

export function absentRecoveryResponse(s:GameState,card:string,absent:string[],order:string[]):string|null {
 const w=s.windows?.at(-1),d=viewFor(s,s.seatOrder[0]!).reclaim;
 if(w?.kind!=='reclaim'||d?.cardInstanceId!==card)return null;
 expect(w.participants).toEqual(order);
 for(const id of s.seatOrder)expect(viewFor(s,id).reclaim!.pendingActorId).toBe(d.pendingActorId);
 for(const actorId of absent){
  expect(viewFor(s,actorId).reclaim).toMatchObject({claims:[],canDecline:false});
  const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));
  expect(transition(s,{actorId,command:{type:'PASS'}},entropy()).ok).toBe(false);
  expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);
 }
 return d.pendingActorId;
}
