import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand} from '@madou/engine';
import {actionCards} from '@madou/catalog';
import {openTestRoom} from './fixtures/recovery-room.js';
import {entropy} from './fixtures/scenario-tools.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});

it('Same-root prayer owner death and revival preserve the old reservation through every Worker restart',async()=>{
 const room=await openTestRoom('lia-prayer-revival'),prayer='a2-p05-r2c3';let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`owner-revival-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};
  await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy(entropy());});
  const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});
  const saved=await room.stored();expect(allCardInstanceIds(saved.state.game!).sort()).toEqual(actionCards.map(c=>c.id).sort());
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));
 }

 const initial=await game(),root=Object.values(initial.actions!).find(a=>a.cardInstanceId==='a2-p10-r1c3')!,life=initial.players.B!.lifeId??'initial-life:B';
 const card=(name:string)=>actionCards.find(c=>c.name===name)!.id;
 const gift=card('「これで勝ったと思うなよ」'),transfer=card('香具羅'),fate=card('命運凶変');
 await send('B',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:root.id,dedicated:true});
 let reserved=false,died=false,revived=false,giftPlayed=false,canceled=false;
 for(let n=0;n<600;n++){
  const s=await game(),w=s.windows?.at(-1);if(!w)break;const actor=w.participants[w.cursor]!;
  if(s.reclaimReservations.includes(prayer)){reserved=true;for(const p of Object.values(s.players))expect(p.hand).not.toContain(prayer);}
  if(s.players.B!.presence==='dead'){died=true;expect(s.reclaimReservations).toContain(prayer);}
  if(w.kind==='death-gift'&&actor==='C'&&!giftPlayed){
   expect(died).toBe(true);giftPlayed=true;await send('C',{type:'PLAY_DEATH_GIFT',cardInstanceId:gift,giftCardInstanceId:transfer,targetId:'D'});
  }else if(w.kind==='revival'&&actor==='B'){
   expect(died).toBe(true);expect(s.reclaimReservations).toContain(prayer);
   expect(s.lifecycle?.some(t=>t.rootEventIds?.includes(root.eventId))).toBe(true);
   await send('B',{type:'CHOOSE_REVIVAL',revive:true});revived=true;
   const restored=await game();expect(restored.players.B!.lifeId).not.toBe(life);
   expect(restored.reclaim![prayer]).toMatchObject({ownerId:'B',ownerLifeId:life,eventId:root.eventId});
  }else if(w.kind==='re-setup')await send(actor,{type:'PASS_SETUP'});
  else {
   const child=Object.values(s.actions??{}).find(a=>a.cardInstanceId===gift);
   if(child&&actor==='A'&&w.kind==='declaration'&&!canceled){canceled=true;await send('A',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:child.id});}
   else await send(actor,{type:'PASS'});
  }
 }
 const done=await game();expect({reserved,died,revived,giftPlayed,canceled}).toEqual({reserved:true,died:true,revived:true,giftPlayed:true,canceled:true});
 expect(done.players.B!.presence).toBe('active');expect(done.players.C!.presence).toBe('dead');
 expect(done.players.B!.hand).not.toContain(prayer);expect(done.discard.filter(id=>id===prayer)).toHaveLength(1);
 expect(done.reclaimReservations).toEqual([]);expect(done.reclaim?.[prayer]).toBeUndefined();
 expect(done.windows??[]).toEqual([]);expect(done.lifecycle??[]).toEqual([]);
 expect(Object.keys(done.actions??{})).toEqual([]);expect(Object.keys(done.groups??{})).toEqual([]);
 expect(done.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='B')).toHaveLength(1);
 expect(done.events.filter(e=>e.type==='PLAYER_REVIVED'&&e.actorId==='B')).toHaveLength(1);
 expect(done.used).toContain(`${root.eventId}:B:${prayer}`);
},15000);
