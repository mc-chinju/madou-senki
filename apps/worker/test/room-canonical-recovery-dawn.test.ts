import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand} from '@madou/engine';
import {getAction,actionCards} from '@madou/catalog';
import {openTestRoom} from './fixtures/recovery-room.js';
import {entropy} from './fixtures/scenario-tools.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});
it('R6 canonical extra recovery cancellation saves Dawn shuffle and final physical disposition under every receipt replay',async()=>{
 const room=await openTestRoom('canonical-recovery-dawn');let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`recovery-dawn-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy(entropy());});const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(new Set(ids).size).toBe(220);expect(ids.sort()).toEqual(actionCards.map(card=>card.id).sort());await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));return {actorId,envelope,ack};}

 const initial=await game(),bow=initial.players.A!.hand.find(id=>getAction(id)!.name==='踏み込み／弓')!,fate='a2-p02-r2c3',dawn=initial.deck[0]!,discarded=initial.discard.at(-1)!;
 async function pass(){const w=(await game()).windows!.at(-1)!;return send(w.participants[w.cursor]!,{type:'PASS'});}
 await send('A',{type:'ATTACK',cardInstanceId:bow,targetIds:['B'],dedicated:false});
 for(let n=0;n<150&&(await game()).windows?.at(-1)?.kind!=='reclaim';n++)await pass();
 const decision=viewFor(await game(),'A').reclaim!,claim=decision.claims.find(c=>c.right==='extra')!;expect(claim).toBeDefined();
 await send('A',{type:'CHOOSE_RECLAIM',decisionId:decision.decisionId,choice:'take',claimId:claim.claimId});
 const declared=await game(),ability=Object.values(declared.abilities!).find(a=>a.context.kind==='reclaim')!;
 expect(declared.deck[0]).toBe(dawn);expect(declared.resolution).toContain(bow);expect(declared.reclaimReservations).not.toContain(bow);
 await pass();await send('B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:ability.id});
 const opened=await game();expect(opened.players.B!.open).toContain(dawn);expect(opened.discard).not.toContain(discarded);expect([...opened.deck,...opened.players.B!.hand]).toContain(discarded);
 expect(opened.resolution).toContain(bow);expect(opened.reclaimReservations).not.toContain(bow);expect(opened.deck).not.toContain(bow);expect(opened.discard).not.toContain(bow);for(const p of Object.values(opened.players))expect(p.hand).not.toContain(bow);
 for(let n=0;n<300&&(await game()).windows?.length;n++)await pass();
 const done=await game();expect(done.discard.filter(id=>id===bow)).toHaveLength(1);expect(done.players.A!.hand).not.toContain(bow);
 expect(done.players.A!.reclaimUsage?.['踏み込み／弓']).toEqual({baseSpent:false,extraSpentByAbility:['c2-p02-r1c2-ab03']});
 expect(done.reclaimDecisions!.find(d=>d.id===decision.decisionId)!.attemptedClaimIds).toEqual([claim.claimId]);
 expect(done.windows).toEqual([]);expect(done.resolution).toEqual([]);expect(done.reclaimReservations).toEqual([]);expect(Object.values(done.actions??{})).toEqual([]);expect(Object.values(done.groups??{})).toEqual([]);expect(done.lifecycle??[]).toEqual([]);
 for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(done,id));
});
