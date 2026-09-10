import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand} from '@madou/engine';
import {actionCards} from '@madou/catalog';
import {openTestRoom} from './fixtures/recovery-room.js';
import {entropy} from './fixtures/scenario-tools.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});
it.each(['base','printed'] as const)('Actual Lester same-seat Courage %s choice persists once through Worker restart and replay',async right=>{
 const room=await openTestRoom('shared-a09-self');let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),s=before.state.game!;
  const envelope={protocolVersion:1 as const,commandId:`lester-rights-${seq++}`,expectedRevision:before.revision,...activeWindowRef(s),command};
  const die=s.windows?.at(-1)?.kind==='damage'||s.rolls?.at(-1)?.purpose==='attack-damage'?5:1;
  await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy({...entropy(),dice:Array(100).fill(die)});});
  const ack=await room.command(actorId,envelope);expect(ack,JSON.stringify({command,ack})).toMatchObject({type:'ack'});
  const saved=await room.stored();expect(allCardInstanceIds(saved.state.game!).sort()).toEqual(actionCards.map(c=>c.id).sort());
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));
 }

 async function until(done:(s:Awaited<ReturnType<typeof game>>)=>boolean){for(let n=0;n<300;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('LESTER_RIGHTS_LIMIT');}
 await send('A',{type:'REVEAL_CHARACTER'});
 const d=viewFor(await game(),'A').reclaim!;
 expect(d.claims.map(c=>c.right).sort()).toEqual(['base','printed']);
 const chosen=d.claims.find(c=>c.right===right)!;
 await send('A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:right==='base'?'take':'request-check',claimId:chosen.claimId});
 if(right==='printed'){
  await until(s=>viewFor(s,'A').reclaim?.stage==='beneficiary-choice');
  const take=viewFor(await game(),'A').reclaim!;expect(take.claims.map(c=>c.right)).toEqual(['printed']);
  await send('A',{type:'CHOOSE_RECLAIM',decisionId:take.decisionId,choice:'take',claimId:take.claims[0]!.claimId});
 }
 const before=await room.stored();
 const rejected=await room.command('A',{protocolVersion:1,commandId:'unused-other-right',expectedRevision:before.revision,...activeWindowRef(before.state.game!),command:{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims.find(c=>c.right!==right)!.claimId}});
 expect(rejected).toMatchObject({type:'error'});expect(await room.stored()).toEqual(before);
 await until(s=>!s.windows?.length);
 const done=await game();expect(done.players.A!.hand.filter(id=>id==='a2-p01-r3c3')).toHaveLength(1);
 expect(done.discard).not.toContain('a2-p01-r3c3');expect(done.reclaimReservations).toEqual([]);
 expect(done.players.A!.reclaimUsage?.['勇気']?.baseSpent??false).toBe(right==='base');
 expect(done.rolls?.filter(r=>r.resume.kind==='reclaim-check').length??0).toBe(right==='printed'?1:0);
 expect(Object.keys(done.actions??{})).toEqual([]);expect(Object.keys(done.groups??{})).toEqual([]);
});
