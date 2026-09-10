import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand} from '@madou/engine';
import {actionCards} from '@madou/catalog';
import {openTestRoom} from './fixtures/recovery-room.js';
import {entropy} from './fixtures/scenario-tools.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});

it('Actual Rift banishment keeps prayer reserved through every restart and receipt replay then returns it once',async()=>{
 const room=await openTestRoom('lia-prayer-otherworld'),prayer='a2-p05-r2c3';let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`owner-otherworld-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};
  const roll=before.state.game!.rolls?.at(-1);
  await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy({...entropy(),dice:Array(30).fill(roll?.purpose==='status-resistance'?6:1)});});
  const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});
  const saved=await room.stored();expect(allCardInstanceIds(saved.state.game!).sort()).toEqual(actionCards.map(c=>c.id).sort());
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));
 }
 const initial=await game(),action=Object.values(initial.actions!).find(a=>a.cardInstanceId==='a2-p14-r2c2')!,life=initial.players.B!.lifeId??'initial-life:B';
 await send('B',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:action.id,dedicated:true});
 let reserved=false,banished=false;
 for(let n=0;n<400;n++){
  const s=await game();
  expect(s.players.B!.lifeId??'initial-life:B').toBe(life);
  if(s.reclaimReservations.includes(prayer)){
   reserved=true;expect(s.reclaim![prayer]).toMatchObject({ownerId:'B',ownerLifeId:life,eventId:action.eventId});
   expect(s.deck).not.toContain(prayer);expect(s.discard).not.toContain(prayer);
   for(const p of Object.values(s.players))expect(p.hand).not.toContain(prayer);
  }
  if(s.players.B!.presence==='otherworld'&&!banished){banished=true;expect(s.reclaimReservations).toContain(prayer);}
  const w=s.windows?.at(-1);if(!w)break;
  await send(w.participants[w.cursor]!,{type:'PASS'});
 }
 const done=await game();expect(reserved).toBe(true);expect(banished).toBe(true);
 expect(done.players.B!.presence).toBe('otherworld');expect(done.players.B!.hand.filter(id=>id===prayer)).toHaveLength(1);
 expect(done.reclaimReservations).toEqual([]);expect(done.reclaim?.[prayer]).toBeUndefined();
 expect(done.windows??[]).toEqual([]);expect(Object.keys(done.actions??{})).toEqual([]);expect(Object.keys(done.groups??{})).toEqual([]);
 expect(done.lifecycle??[]).toEqual([]);expect(done.reclaimDecisions?.filter(d=>d.stage!=='closed')??[]).toEqual([]);
 expect(done.discard.filter(id=>id==='a2-p14-r2c2')).toHaveLength(1);expect(done.used).toContain(`${action.eventId}:B:${prayer}`);
 for(const id of ['A','C','D'])expect(done.players[id]!.hand).not.toContain(prayer);
});
