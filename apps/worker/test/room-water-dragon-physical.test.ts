import {readySetupAsync} from './fixtures/scenario-tools.js';
import {reset} from 'cloudflare:test';
import {afterEach,expect,it,vi} from 'vitest';
import {activeWindowRef,allCardInstanceIds,gameStats,viewFor,type GameCommand} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
import {waterDragonPhysicalMode,waterDragonPhysicalScenarios} from './fixtures/water-dragon-physical-scenarios.js';
afterEach(async()=>{vi.restoreAllMocks();await reset();});
it.each([...waterDragonPhysicalScenarios.map(s=>[s,false] as const),['water-dragon-army',true],['water-dragon-grant-field',true]] as const)('%s canceled=%s persists Water Dragon defense and actual source-clock expiry',async(scenario,canceled)=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(<T extends ArrayBufferView|null>(array:T):T=>{if(array instanceof Uint32Array)array.fill(0);return array;});const room=await openTestRoom(scenario),m=waterDragonPhysicalMode(scenario);let seq=0;
 async function state(){return (await room.stored()).state.game!;}
 async function send(actorId:string,command:GameCommand){const stored=await room.stored(),envelope={protocolVersion:1 as const,commandId:`water-${seq++}`,expectedRevision:stored.revision,...activeWindowRef(stored.state.game!),command};const ack=await room.command(actorId,envelope);expect(ack,JSON.stringify({command,ack})).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function settle(stop?:string){for(let n=0;n<300;n++){const s=await state(),w=s.windows?.at(-1);if(!w||w.kind===stop)return;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('WATER_DO_SETTLE');}
 async function step(){const s=await state(),id=s.seatOrder[s.turnSeat]!,w=s.windows?.at(-1);if(w)await send(w.participants[w.cursor]!,{type:'PASS'});else if(s.phase==='action')await send(id,{type:'PASS_ACTION'});else if(s.phase==='withdrawal')await send(id,{type:'PASS_WITHDRAWAL'});else if(s.phase==='hand-adjustment')await send(id,{type:'END_TURN',discardIds:s.players[id]!.hand.slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});else if(s.phase==='turn-start')await send(id,{type:'START_TURN'});else if(s.phase==='draw')await send(id,{type:'CHOOSE_DRAW',draw:false});else throw Error(`WATER_DO_PHASE_${s.phase}`);}
 async function advance(id:string,phase='turn-start'){for(let n=0;n<300;n++){const s=await state();if(!s.windows?.length&&s.seatOrder[s.turnSeat]===id&&s.phase===phase)return;await step();}throw Error('WATER_DO_CLOCK');}
 async function stops(id:string){return ((await state()).players[id]!.statuses??[]).filter(t=>t.sourceCardInstanceId===m.card&&t.timing==='source-turn');}
 if(m.initial)await send('A',{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:m.card});await send('A',{type:'PASS_SETUP'});for(const cardInstanceId of m.pair??[])await send('B',{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId});await readySetupAsync(async()=>(await room.stored()).state.game!,id=>send(id,{type:'PASS_SETUP'}));await send('A',{type:'START_TURN'});await send('A',{type:'CHOOSE_DRAW',draw:false});
 if(m.defense){if(!m.initial)await send('A',{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[m.card]});await advance('B','action');if(m.sky||m.destroy)await send('B',{type:'ATTACK',cardInstanceId:m.sky?'a2-p15-r1c3':'a2-p13-r1c2',targetIds:m.sky?['A','C']:['A'],dedicated:true});else{const o=viewFor(await state(),'B').followerBundleOptions.find(o=>o.abilityId==='c2-p06-r1c2-ab04')!;await send('B',{type:'USE_FOLLOWER_ATTACK',abilityId:o.abilityId,targetEventId:o.targetEventId,sources:[{cardInstanceId:'a2-p21-r2c3',dedicated:false,targetIds:['A']}]});}}
 else{
  if(m.overlap){await advance('B','action');await send('B',{type:'ATTACK',cardInstanceId:'a2-p15-r2c2',targetIds:['C'],dedicated:false});await settle();await advance('A','action');}
  if(m.army)await send('A',{type:'PLAY_ALL_ARMY',cardInstanceId:'a2-p05-r2c2',followerCardInstanceId:m.card,targetIds:['B','C','D']});else{const o=viewFor(await state(),'A').followerBundleOptions.find(o=>o.abilityId==='c2-p05-r1c2-ab02')!;await send('A',{type:'USE_FOLLOWER_ATTACK',abilityId:o.abilityId,targetEventId:o.targetEventId,sources:[{cardInstanceId:m.card,dedicated:false,targetIds:['B','C','D']}]});}
  if(canceled){let s=await state();const id=m.army?Object.values(s.actions!).find(a=>a.cardInstanceId==='a2-p05-r2c2')!.id:Object.values(s.abilities!).find(a=>a.abilityId==='c2-p05-r1c2-ab02')!.id;while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='D'){await step();s=await state();}await send('D',m.army?{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id}:{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:id});}
  else if(m.maai||m.mirror){await settle('normal-defense');await send('B',m.mirror?{type:'PLAY_DEFENSE',cardInstanceId:'a2-p11-r1c3',dedicated:false}:{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c2'});}
 }
 await settle();let s=await state();const alive=m.defense&&(m.sky||!m.destroy&&!m.fail&&m.attackLevel<7);expect(s.players.A!.followers.map(f=>f.cardInstanceId)).toEqual(alive?[m.card]:[]);expect(s.discard.filter(id=>id===m.card)).toHaveLength(alive?0:1);expect(s.resolution).toEqual([]);
 if(m.defense){expect([s.players.A!.damage,s.players.C!.damage]).toEqual(m.sky?[12,12]:[m.destroy?0:m.fail?18:m.attackLevel>7?6:0,0]);if(m.sky)expect(s.players.A!.followers[0]!.revealed).toBe(false);}
 else if(canceled){for(const id of ['B','C','D']){expect(s.players[id]!.damage).toBe(0);expect(await stops(id)).toEqual([]);}}
 else{
  const recipients=m.dead?['C','D']:m.wander?['B','D']:m.maai||m.mirror||m.block?['C','D']:['B','C','D'];
  for(const id of recipients)expect(await stops(id)).toEqual([expect.objectContaining({kind:'stopped',sourceActorId:'A'})]);if(!recipients.includes('B'))expect(await stops('B')).toEqual([]);
  if(m.block||m.hp){expect(s.players.B!.damage).toBe(0);expect(s.players.B!.followers.map(f=>f.cardInstanceId)).toEqual(m.block?m.pair:[]);}else if(!m.dead&&!m.wander)expect(s.players.B!.damage).toBe(m.maai||m.mirror?0:5);
  if(m.mirror&&!m.dead){expect(s.players.A!.damage).toBe(5);expect(await stops('A')).toEqual([expect.objectContaining({sourceActorId:'B',sourceCardInstanceId:m.card,kind:'stopped'})]);}
  if(m.dead||m.wander){expect(s.players.A!.presence).toBe(m.dead?'dead':'wandering');await advance('D');for(const id of recipients)expect(await stops(id)).toHaveLength(1);await advance('B');}
  else{
   await advance('B');if(m.mirror)expect(await stops('A')).toEqual([]);for(const id of ['C','D'])expect(await stops(id)).toHaveLength(1);
   if(m.skip){await advance('B','action');await send('B',{type:'ATTACK',cardInstanceId:'a2-p09-r2c2',targetIds:['A'],dedicated:true});await settle();expect((await state()).players.A!.skipTurns).toBe(1);}
   await advance('A');if(m.skip){expect((await state()).players.A!.skipTurns).toBe(1);for(const id of recipients)expect(await stops(id)).toEqual([]);await send('A',{type:'START_TURN'});expect((await state()).seatOrder[(await state()).turnSeat]).toBe('B');}
  }
  s=await state();for(const id of s.seatOrder)expect(await stops(id)).toEqual([]);const recovery=(s.rolls??[]).filter(r=>r.purpose==='status-recovery');expect(recovery).toHaveLength(m.overlap?2:0);if(m.overlap)expect(s.players.C!.statuses).toContainEqual(expect.objectContaining({sourceCardInstanceId:'a2-p15-r2c2',kind:'stopped'}));
 }
},15000);
