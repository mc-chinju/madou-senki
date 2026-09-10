import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});

it('Actual prayer owner death retains the reserved source through reload and discards it once',async()=>{
 const room=await openTestRoom('lia-prayer-fatal'),prayer='a2-p05-r2c3';let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`owner-death-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};
  const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});
  const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
 }
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<300;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('OWNER_DEATH_LIMIT');}
 const initial=await game(),action=initial.actions![initial.windows!.at(-1)!.continuation.id]!;
 await send('B',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:action.id,dedicated:true});
 await until(s=>s.reclaimReservations.includes(prayer));
 expect((await game()).players.B!.presence??'active').toBe('active');
 for(const actor of ['A','B','C','D'])expect((await room.snapshotFor(actor)).game!.self.hand).not.toContain(prayer);
 await until(s=>s.players.B!.presence==='pending-death');
 const dying=await game();expect(dying.reclaimReservations).toContain(prayer);expect(dying.outcome).toBeUndefined();
 expect(dying.lifecycle?.some(t=>t.rootEventIds?.includes(action.eventId))).toBe(true);
 await until(s=>!s.windows?.length);
 const done=await game();expect(done.players.B!.presence).toBe('dead');expect(done.reclaimReservations).toEqual([]);
 expect(done.discard.filter(id=>id===prayer)).toHaveLength(1);expect(done.reclaim![prayer]).toBeUndefined();
 for(const p of Object.values(done.players))expect(p.hand).not.toContain(prayer);
 expect(done.used).toContain(`${action.eventId}:B:${prayer}`);
});
