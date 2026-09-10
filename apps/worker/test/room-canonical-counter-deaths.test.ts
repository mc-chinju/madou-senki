import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand} from '@madou/engine';
import {actionCards} from '@madou/catalog';
import {openTestRoom} from './fixtures/recovery-room.js';
import {entropy} from './fixtures/scenario-tools.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});
it('R6 canonical local counter child follower reduction and simultaneous death order survive every saved receipt replay',async()=>{
 const room=await openTestRoom('r6-combined-counter-death');let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`counter-death-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy(entropy());});const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(new Set(ids).size).toBe(220);expect(ids.sort()).toEqual(actionCards.map(card=>card.id).sort());await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));return {actorId,envelope,ack};}

 let s=await game();
 async function pass(){const w=(await game()).windows!.at(-1)!;return send(w.participants[w.cursor]!,{type:'PASS'});}
 const parent=Object.values(s.groups!)[0]!,source=s.actions![parent.actionId]!,counter='a2-p10-r3c3',soldier=s.players.C!.followers[0]!.cardInstanceId,b=s.players.B!.damage,c=s.players.C!.damage,a=s.players.A!.damage;
 expect(parent.hitIndices).toEqual([0,1,2]);expect(parent.targets.map(t=>t.actorId)).toEqual(['B','C']);
 await send('B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:true});s=await game();
 let childSeen=false,followersSeen=false;
 for(let n=0;n<400;n++){
  expect(s.outcome).toBeUndefined();const child=Object.values(s.groups??{}).find(g=>g.attackerId==='B');
  if(child){childSeen=true;const action=s.actions![child.actionId]!;expect(action.cardInstanceId).toBe(counter);expect(action.resume).toMatchObject({groupId:parent.id,targetId:'B',hitIndex:0});expect(child.targets.map(t=>[t.actorId,t.hits.length])).toEqual([['A',1]]);expect(child.hitIndices).toEqual([0]);expect(child.technique.damage).toBe(7);expect(s.groups![parent.id]!.targets[0]!.hits.map(h=>h.defended)).toEqual([true,false,false]);expect(s.groups![parent.id]!.targets[1]!.hits.map(h=>h.defended)).toEqual([false,false,false]);}
  const current=s.groups?.[parent.id];if(current?.targets[1]!.followersSettled){followersSeen=true;expect(current.targets[1]!.hits.map(h=>h.damage)).toEqual([6,6,6]);expect(current.targets[1]!.followerDestroyed).toEqual([soldier]);}
  if(s.players.B!.presence==='pending-death')break;await pass();s=await game();
 }
 expect(childSeen).toBe(true);expect(followersSeen).toBe(true);expect(s.players.A!.damage).toBe(a+7);expect(s.players.B).toMatchObject({presence:'pending-death',damage:b+14});expect(s.players.C).toMatchObject({presence:'pending-death',damage:c+18});expect(s.lifecycle!.find(t=>t.kind==='death-batch')).toMatchObject({actorIds:['B','C']});expect(s.events.filter(e=>e.type==='PLAYER_DIED')).toEqual([]);
 for(let n=0;n<300&&(await game()).windows?.length;n++)await pass();s=await game();expect(s.events.filter(e=>e.type==='PLAYER_DIED').map(e=>e.actorId)).toEqual(['B','C']);expect(s.players.B!.presence).toBe('dead');expect(s.players.C!.presence).toBe('dead');expect(s.outcome).toBeUndefined();
 expect(s.windows).toEqual([]);expect(s.groups).toEqual({});expect(s.actions).toEqual({});expect(s.lifecycle??[]).toEqual([]);expect(s.resolution).toEqual([]);expect(s.reclaimReservations).toEqual([]);for(const id of [counter,soldier,source.cardInstanceId])expect(s.discard.filter(x=>x===id)).toHaveLength(1);

 for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(s,id));
});
