import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand} from '@madou/engine';
import {actionCards} from '@madou/catalog';
import {openTestRoom} from './fixtures/recovery-room.js';
import {entropy} from './fixtures/scenario-tools.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});

it('Actual Arseil exit discards reserved Fate once and keeps spent history through every Worker restart',async()=>{
 const room=await openTestRoom('reclaim-exit');let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`owner-exit-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};
  await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy(entropy());});
  const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});
  const saved=await room.stored();expect(allCardInstanceIds(saved.state.game!).sort()).toEqual(actionCards.map(c=>c.id).sort());
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));
 }



 async function until(done:(s:Awaited<ReturnType<typeof game>>)=>boolean){for(let n=0;n<400;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('RECLAIM_EXIT_LIMIT');}
 const fate='a2-p02-r2c3';
 await send('A',{type:'USE_REVIVAL_RITUAL'});
 const root=Object.values((await game()).actions!).find(a=>a.cardInstanceId==='a2-p05-r1c1')!;
 await until(s=>s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]==='B');
 await send('B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:root.id});
 const paid=Object.values((await game()).actions!).find(a=>a.cardInstanceId===fate)!;
 await until(s=>s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]==='B');
 await send('B',{type:'CANCEL_REACTION',targetActionId:paid.id});expect((await game()).actions![paid.id]!.canceled).toBe(true);
 await until(s=>viewFor(s,'B').reclaim?.cardInstanceId===fate&&!!viewFor(s,'B').reclaim?.claims.length);
 const claim=viewFor(await game(),'B').reclaim!;
 await send('B',{type:'CHOOSE_RECLAIM',decisionId:claim.decisionId,choice:'take',claimId:claim.claims[0]!.claimId});
 const reserved=await game(),usage=structuredClone(reserved.players.B!.reclaimUsage);
 expect(reserved.reclaimReservations).toContain(fate);expect(usage?.['命運凶変']?.baseSpent).toBe(true);
 await until(s=>{expect(s.reclaimReservations).toContain(fate);expect(s.players.B!.hand).not.toContain(fate);return viewFor(s,'B').lifecycleAbilities.includes('arseil-conspiracy');});
 expect((await game()).players.A!.characterId).toBe('c2-p07-r1c2');
 await send('B',{type:'USE_LIFECYCLE_ABILITY',ability:'arseil-conspiracy'});
 await until(s=>{expect(s.players.B!.hand).not.toContain(fate);return !s.windows?.length;});
 const done=await game();expect(done.players.B!.presence).toBe('exited');expect(done.individualResults?.B).toBe('won');
 expect(done.discard.filter(id=>id===fate)).toHaveLength(1);expect(done.players.B!.reclaimUsage).toEqual(usage);
 expect(done.reclaimReservations).toEqual([]);expect(done.reclaim?.[fate]).toBeUndefined();
 expect(done.windows??[]).toEqual([]);expect(done.lifecycle??[]).toEqual([]);expect(Object.keys(done.actions??{})).toEqual([]);expect(Object.keys(done.groups??{})).toEqual([]);
 expect(done.events.filter(e=>e.type==='PLAYER_EXITED'&&e.actorId==='B')).toHaveLength(1);
});
