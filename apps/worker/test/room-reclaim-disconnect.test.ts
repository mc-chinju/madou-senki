import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it,vi} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor, discardIds } from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';

afterEach(async()=>{vi.restoreAllMocks();await reset();});

it('Recovery disconnect never auto-passes a no-claim actor',async()=>{
 const now=vi.spyOn(Date,'now').mockReturnValue(1000);
 vi.spyOn(crypto,'getRandomValues').mockImplementation(<T extends ArrayBufferView|null>(array:T):T=>{
  if(array)new Uint8Array(array.buffer,array.byteOffset,array.byteLength).fill(0);return array;
 });
 const rooms=[await openTestRoom('shared-budget-none'),await openTestRoom('shared-budget-base')];
 const initial=await Promise.all(rooms.map(room=>room.stored()));
 const source=viewFor(initial[0]!.state.game!,'A').reclaim!.cardInstanceId;
 expect(initial.map(saved=>viewFor(saved.state.game!,'A').reclaim!.claims.map(c=>c.right))).toEqual([[],['base']]);
 for(const saved of initial)expect(saved.state.game!.windows!.at(-1)).toMatchObject({kind:'reclaim',cursor:0,participants:['A','B','C','D']});

 // snapshotFor closes its authenticated socket without sending a command.
 // Advance the wall clock and invoke the real alarm handler, including after eviction.
 for(const elapsed of [0,60_000,86_400_000]){
  now.mockReturnValue(1000+elapsed);
  for(let i=0;i<rooms.length;i++){
   const room=rooms[i]!;
   await room.snapshotFor('A');await room.restart();
   await runInDurableObject(room.room,instance=>instance.alarm());
   await room.snapshotFor('A');
   expect(await room.stored()).toEqual(initial[i]);
  }
  for(const actor of ['B','C','D'])expect((await rooms[1]!.snapshotFor(actor)).game).toEqual((await rooms[0]!.snapshotFor(actor)).game);
 }

 // Every participant still owes an explicit response in both private worlds.
 for(const [cursor,actor] of ['A','B','C','D'].entries()){
  const receipts=[];
  for(const room of rooms){
   const before=await room.stored(),s=before.state.game!;
   expect(s.windows!.at(-1)).toMatchObject({kind:'reclaim',cursor});
   expect(s.resolution).toContain(source);expect(discardIds(s)).not.toContain(source);
   const envelope={protocolVersion:1 as const,commandId:`disconnect-pass-${cursor}`,expectedRevision:before.revision,...activeWindowRef(s),command:{type:'PASS' as const}};
   const ack=await room.command(actor,envelope);expect(ack).toMatchObject({type:'ack'});receipts.push(ack);
   const saved=await room.stored();expect(saved.revision).toBe(before.revision+1);
   await room.restart();expect(await room.command(actor,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
   const ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);
  }
  expect(receipts[1]).toEqual(receipts[0]);
  for(const observer of ['B','C','D'])expect((await rooms[1]!.snapshotFor(observer)).game).toEqual((await rooms[0]!.snapshotFor(observer)).game);
 }
 for(const room of rooms){
  const s=(await room.stored()).state.game!;
  expect(s.windows).toEqual([]);expect(s.phase).toBe('withdrawal');
  expect(discardIds(s).filter(id=>id===source)).toHaveLength(1);expect(s.resolution).not.toContain(source);
  expect(s.reclaimDecisions!.at(-1)).toMatchObject({stage:'closed'});
 }
});
