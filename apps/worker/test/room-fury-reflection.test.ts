import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand} from '@madou/engine';
import {actionCards} from '@madou/catalog';
import {openTestRoom} from './fixtures/recovery-room.js';
import {entropy,readySetupAsync} from './fixtures/scenario-tools.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});

it('Actual Fury Royal Knights bow reflection retains original dice through every Worker restart and replay',async()=>{
 const room=await openTestRoom('fury-royal-reflection');let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),s=before.state.game!;
  const envelope={protocolVersion:1 as const,commandId:`fury-reflect-${seq++}`,expectedRevision:before.revision,...activeWindowRef(s),command};
  const die=s.windows?.at(-1)?.kind==='damage'||s.rolls?.at(-1)?.purpose==='attack-damage'?5:1;
  await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy({...entropy(),dice:Array(100).fill(die)});});
  const ack=await room.command(actorId,envelope);expect(ack,JSON.stringify({command,ack})).toMatchObject({type:'ack'});
  const saved=await room.stored();expect(allCardInstanceIds(saved.state.game!).sort()).toEqual(actionCards.map(c=>c.id).sort());
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));
 }
 await send('A',{type:'PASS_SETUP'});
 await send('B',{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:'a2-p21-r1c2'});
 await readySetupAsync(async()=>(await room.stored()).state.game!,id=>send(id,{type:'PASS_SETUP'}));
 await send('A',{type:'START_TURN'});await send('A',{type:'CHOOSE_DRAW',draw:false});
 const option=viewFor(await game(),'A').followerBundleOptions.find(o=>o.abilityId==='c2-p06-r1c2-ab04')!;
 await send('A',{type:'USE_FOLLOWER_ATTACK',abilityId:option.abilityId,targetEventId:option.targetEventId,sources:[{cardInstanceId:'a2-p21-r3c3',dedicated:false,targetIds:['B']}]});
 const reflectedIds=new Set<string>();
 for(let n=0;n<300;n++){
  const s=await game();
  for(const a of Object.values(s.actions??{}))if(a.kind==='follower-reflection'){
   reflectedIds.add(a.id);expect(a).toMatchObject({actorId:'B',targetIds:['A'],fixedReceivedEffect:true,technique:{useLevel:4,effectLevel:4,damage:9,attributes:['遠','戦','弓','白']}});
   expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId==='c2-p02-r1c2-ab03')).toBe(false);
  }
  expect(s.rolls?.filter(r=>r.purpose==='ability-value')??[]).toEqual([]);
  const w=s.windows?.at(-1);if(!w)break;
  await send(w.participants[w.cursor]!,{type:'PASS'});
 }
 const done=await game();expect(reflectedIds.size).toBe(1);
 expect([done.players.A!.damage,done.players.B!.damage]).toEqual([9,0]);
 expect(done.rolls!.filter(r=>r.kind==='numeric').map(r=>r.faces)).toEqual([[1],[5]]);
 expect(done.discard.filter(id=>id==='a2-p21-r3c3')).toHaveLength(1);
 expect(done.windows??[]).toEqual([]);expect(Object.keys(done.actions??{})).toEqual([]);expect(Object.keys(done.groups??{})).toEqual([]);
});
