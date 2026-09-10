import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
import {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});
it('S04 canonical one-command entropy saves 4,4 once and duplicate final PASS never calls provider after eviction',async()=>{
 const room=await openTestRoom('canonical-S04');let seq=0;const game=async()=>(await room.stored()).state.game!;
 const probe=()=>runInDurableObject(room.room,instance=>(instance as CanonicalRoom).entropyProbe());
 const set=()=>runInDurableObject(room.room,instance=>(instance as CanonicalRoom).setNextEntropy({now:1000,dice:[4,4],random:Array(4096).fill(0.5)}));
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`canonical-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};await set();const old=await probe(),ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});expect(await probe()).toEqual({calls:old.calls+1,consumed:old.consumed+1,pending:false});const ids=allCardInstanceIds(await game());expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);return {actorId,envelope,ack};}
 const initial=await game(),id=initial.rolls!.at(-1)!.id;expect(initial.rolls!.at(-1)!.faces).toEqual([2,3]);
 await send('B',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r1c3',mode:'reroll',targetRollId:id});
 for(let n=0;n<300;n++){
  const s=await game(),w=s.windows!.at(-1)!;const receipt=await send(w.participants[w.cursor]!,{type:'PASS'});
  if((await game()).rolls!.at(-1)!.attempts.length!==2)continue;
  const roll=structuredClone((await game()).rolls!.at(-1)!);expect(roll).toMatchObject({id,faces:[4,4],success:true});expect(roll.attempts.map(a=>a.faces)).toEqual([[2,3],[4,4]]);
  const saved=await room.stored();await room.restart();await set();const beforeReplay=await probe();expect(await room.command(receipt.actorId,receipt.envelope)).toEqual(receipt.ack);expect(await room.stored()).toEqual(saved);expect(await probe()).toEqual(beforeReplay);expect(beforeReplay.pending).toBe(true);return;
 }
 throw Error('S04_CANONICAL_ROLL_NOT_REACHED');
});
