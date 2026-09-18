import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it('S21 White Light6 hidden alternate worlds keep foreign snapshots equal until hit through restart and duplicate receipt',async()=>{
 const rooms=[await openTestRoom('r6-s21'),await openTestRoom('r6-s21-control')];
 expect((await rooms[0]!.snapshotFor('B')).game!.abilityOptions.some(o=>o.abilityId==='c2-p01-r1c1-ab01')).toBe(true);
 for(let n=0;n<300;n++){
  const states=await Promise.all(rooms.map(async r=>(await r.stored()).state.game!));
  expect(states[0]!.players.B!.revealed).toBe(states[1]!.players.B!.revealed);
  if(!states[0]!.players.B!.revealed)for(const actor of ['A','C','D']){
   const views=await Promise.all(rooms.map(r=>r.snapshotFor(actor)));
   // Separate rooms commit at different wall-clock times; the public record's content must still match.
   const [left,right]=views.map(v=>({...v.game!,logs:v.game!.logs.map(log=>({...log,at:0}))}));expect(left).toEqual(right);
   expect(JSON.stringify(views[0]!.game)).not.toContain('c2-p01-r1c1');
  }
  const w=states[0]!.windows?.at(-1);if(!w)break;
  expect(states[1]!.windows?.at(-1)).toEqual(w);
  for(const room of rooms){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`s21-${n}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command:{type:'PASS' as const}};
   const ack=await room.command(w.participants[w.cursor]!,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(w.participants[w.cursor]!,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  }
 }
 for(const room of rooms){const s=(await room.stored()).state.game!;expect(s.windows??[]).toEqual([]);expect(s.players.B).toMatchObject({damage:6,revealed:true});expect(s.discard.filter(id=>id==='a2-p14-r1c2')).toHaveLength(1);for(const actor of ['A','C','D'])expect(JSON.stringify((await room.snapshotFor(actor)).game)).not.toContain('c2-p01-r1c1-ab01');}
});
