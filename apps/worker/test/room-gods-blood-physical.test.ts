import {reset} from 'cloudflare:test';
import {afterEach,expect,it,vi} from 'vitest';
import {activeWindowRef,allCardInstanceIds,gameStats,viewFor,type GameCommand} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
import {godsBloodPhysicalScenarios} from './fixtures/gods-blood-physical-scenarios.js';
afterEach(async()=>{vi.restoreAllMocks();await reset();});
it.each(godsBloodPhysicalScenarios)('%s saves actual Blood reveal stat checks transfer or death and replays every command once',async scenario=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(<T extends ArrayBufferView|null>(array:T):T=>{if(array instanceof Uint32Array)array.fill(0);return array;});const room=await openTestRoom(scenario);let seq=0;const state=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const stored=await room.stored(),envelope={protocolVersion:1 as const,commandId:`blood-${seq++}`,expectedRevision:stored.revision,...activeWindowRef(stored.state.game!),command},ack=await room.command(actorId,envelope);expect(ack,JSON.stringify({command,ack})).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function settle(stop?:string){for(let n=0;n<200;n++){const s=await state(),w=s.windows?.at(-1);if(!w||w.kind===stop)return;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('BLOOD_DO_WINDOW');}
 const initial=await state(),base=gameStats(initial,'A'),b=gameStats(initial,'B'),permanent=structuredClone(initial.players.A!.permanent);for(const id of ['A','B','C','D'])await send(id,{type:'PASS_SETUP'});await send('A',{type:'START_TURN'});await send('A',{type:'CHOOSE_DRAW',draw:scenario!=='blood-book'});if(scenario==='blood-book'){await send('A',{type:'PLAY_TURN_CARD',cardInstanceId:'a2-p03-r1c1'});await settle();}
 let s=await state();expect(gameStats(s,'A')).toEqual({...base,warrior_level:base.warrior_level+1,magic_level:base.magic_level+1,spirit:base.spirit+1});expect(s.players.A!.permanent).toEqual(permanent);expect(s.players.A!.revealed).toBe(false);expect(s.players.A!.open).toContain('a2-p01-r1c3');for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game!.players.A!.open).toContain('a2-p01-r1c3');
 if(scenario==='blood-transfer'||scenario==='blood-death'){
  await send('A',{type:'PASS_ACTION'});s=await state();await send('A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(0,Math.max(0,s.players.A!.hand.length-gameStats(s,'A').handLimit))});await settle();await send('B',{type:'START_TURN'});await send('B',{type:'CHOOSE_DRAW',draw:false});
  if(scenario==='blood-transfer'){await send('B',{type:'PLAY_TURN_CARD',cardInstanceId:'a2-p04-r3c2',mode:'wish'});await settle('wish');await send('B',{type:'CHOOSE_WISH',decisionId:viewFor(await state(),'B').wish!.decisionId,source:{kind:'public',cardInstanceId:'a2-p01-r1c3'}});await settle();s=await state();expect(gameStats(s,'B')).toEqual({...b,warrior_level:b.warrior_level+1,magic_level:b.magic_level+1,spirit:b.spirit+1});expect(s.players.B!.open).toContain('a2-p01-r1c3');}
  else{await send('B',{type:'ATTACK',cardInstanceId:'a2-p24-r2c2',targetIds:['A'],dedicated:false});await settle();s=await state();expect(s.players.A!.presence).toBe('dead');expect(s.discard.filter(id=>id==='a2-p01-r1c3')).toHaveLength(1);}
  expect(gameStats(s,'A')).toEqual(base);expect(s.players.A!.open).not.toContain('a2-p01-r1c3');expect(s.players.A!.permanent).toEqual(permanent);
 }else if(['blood-warrior','blood-magic','blood-spirit'].includes(scenario)){
  await send('A',{type:'ATTACK',cardInstanceId:scenario==='blood-magic'?'a2-p18-r1c3':'a2-p24-r1c2',targetIds:['B'],dedicated:false});await settle();s=await state();const checks=(s.rolls??[]).filter(r=>r.purpose==='excess-level');expect(checks).toHaveLength(scenario==='blood-spirit'?2:0);for(const r of checks)expect(r).toMatchObject({threshold:7,success:true});expect(s.players.B!.damage).toBe(scenario==='blood-magic'?8:4);
 }
 expect(s.events.filter(e=>e.type==='OPEN'&&e.cardInstanceId==='a2-p01-r1c3')).toHaveLength(1);expect(s.resolution).toEqual([]);
},15000);
