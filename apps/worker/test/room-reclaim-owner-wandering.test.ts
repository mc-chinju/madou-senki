import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand} from '@madou/engine';
import {actionCards} from '@madou/catalog';
import {openTestRoom} from './fixtures/recovery-room.js';
import {entropy} from './fixtures/scenario-tools.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});

it('Actual protected death and wandering preserve counter reservation across every Worker restart and replay',async()=>{
 const room=await openTestRoom('reclaim-wandering');let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`owner-wandering-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};
  await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy(entropy());});
  const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});
  const saved=await room.stored();expect(allCardInstanceIds(saved.state.game!).sort()).toEqual(actionCards.map(c=>c.id).sort());
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));
 }


 const initial=await game(),counter=actionCards.find(c=>c.name==='妖撃破山剣')!.id,life=initial.players.B!.lifeId??'initial-life:B';
 const root=Object.values(initial.actions!).find(a=>a.cardInstanceId==='a2-p07-r3c3')!;
 await send('B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:true});
 let reserved=false;let usage:NonNullable<(typeof initial.players)[string]>['reclaimUsage'];
 for(let n=0;n<500;n++){
  const s=await game(),w=s.windows?.at(-1);if(!w)break;
  expect(s.players.B!.lifeId??'initial-life:B').toBe(life);
  if(s.reclaimReservations.includes(counter)){
   reserved=true;expect(s.deck).not.toContain(counter);expect(s.discard).not.toContain(counter);
   for(const p of Object.values(s.players))expect(p.hand).not.toContain(counter);
  }
  const claim=viewFor(s,'B').reclaim;
  if(!reserved&&claim?.cardInstanceId===counter&&claim.claims.length){
   await send('B',{type:'CHOOSE_RECLAIM',decisionId:claim.decisionId,choice:'take',claimId:claim.claims[0]!.claimId});
   const saved=await game();expect(saved.reclaimReservations).toContain(counter);usage=structuredClone(saved.players.B!.reclaimUsage);
  }else await send(w.participants[w.cursor]!,{type:'PASS'});
 }
 const done=await game();expect(reserved).toBe(true);expect(usage).toBeDefined();
 expect(done.players.C!.presence).toBe('dead');expect(done.players.B!.presence).toBe('wandering');
 expect(done.players.B!.hand.filter(id=>id===counter)).toHaveLength(1);expect(done.players.B!.reclaimUsage).toEqual(usage);
 expect(done.reclaimReservations).toEqual([]);expect(done.reclaim?.[counter]).toBeUndefined();
 expect(done.deck).not.toContain(counter);expect(done.discard).not.toContain(counter);
 expect(done.windows??[]).toEqual([]);expect(done.lifecycle??[]).toEqual([]);expect(Object.keys(done.actions??{})).toEqual([]);expect(Object.keys(done.groups??{})).toEqual([]);
 expect(done.events.filter(e=>e.type==='PLAYER_WANDERING'&&e.actorId==='B')).toHaveLength(1);
 expect(done.events.find(e=>e.type==='PLAYER_DIED'&&e.actorId==='C')?.death?.eventId).toBe(root.eventId);
},15000);
