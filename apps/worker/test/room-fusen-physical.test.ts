import {reset} from 'cloudflare:test';
import {afterEach,expect,it,vi} from 'vitest';
import {activeWindowRef,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
import {fusenPhysicalScenarios} from './fixtures/fusen-physical-scenarios.js';
afterEach(async()=>{vi.restoreAllMocks();await reset();});
it.each([...fusenPhysicalScenarios.map(s=>[s,true] as const),['fusen-book',false]] as const)('%s accept first=%s persists independent OPEN decisions death identity and parent refill exactly once',async(scenario,revive)=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(<T extends ArrayBufferView|null>(array:T):T=>{if(array instanceof Uint32Array)array.fill(0);return array;});const room=await openTestRoom(scenario);let seq=0;
 const state=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const stored=await room.stored(),envelope={protocolVersion:1 as const,commandId:`fusen-${seq++}`,expectedRevision:stored.revision,...activeWindowRef(stored.state.game!),command};const ack=await room.command(actorId,envelope);expect(ack,JSON.stringify({command,ack})).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(stop?:string){for(let n=0;n<200;n++){const s=await state(),w=s.windows?.at(-1);if(!w||w.kind===stop)return;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('FUSEN_DO_WINDOW');}
 const initial=await state(),identity=structuredClone(initial.players.B!.deathIdentity),source=scenario==='fusen-draw'?'D':'A';
 if(scenario!=='fusen-converted-choice')await send(source,scenario==='fusen-draw'?{type:'CHOOSE_DRAW',draw:true}:{type:'PLAY_TURN_CARD',cardInstanceId:'a2-p03-r1c1'});
 await until('revival');
 if(scenario!=='fusen-empty'){
  expect((await state()).windows!.at(-1)).toMatchObject({kind:'revival',participants:['B']});await send('B',{type:'CHOOSE_REVIVAL',revive});
  if(revive){let s=await state();expect(s.players.B).toMatchObject({...identity,presence:'active',revealed:true,damage:0,statuses:[],attachments:[]});expect(s.players.B!.hand).toHaveLength(5);expect(s.players.B!.permanent).toEqual(initial.players.B!.permanent);expect(s.windows!.at(-1)!.kind).toBe('re-setup');await send('B',{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:'a2-p18-r3c3'});await send('B',{type:'PASS_SETUP'});s=await state();expect(s.players.B!.hand).toHaveLength(5);expect(s.players.B!.followers).toContainEqual(expect.objectContaining({cardInstanceId:'a2-p18-r3c3',revealed:false}));}
  await until('revival');expect((await state()).windows!.at(-1)).toMatchObject({kind:'revival',participants:['C']});await send('C',{type:'CHOOSE_REVIVAL',revive:false});await until();
 }
 const s=await state();expect(s.rolls!.filter(r=>r.purpose==='revival').map(r=>({actor:r.rollerId,faces:r.faces,success:r.success}))).toEqual(scenario==='fusen-empty'?[]:[{actor:'B',faces:[1],success:true},{actor:'C',faces:[1],success:true}]);expect(s.players[source]!.open.filter(id=>id==='a2-p01-r1c1')).toHaveLength(1);expect(s.events.filter(e=>e.type==='OPEN'&&e.cardInstanceId==='a2-p01-r1c1')).toHaveLength(1);expect(s.players.B!.presence).toBe(scenario==='fusen-empty'||revive?'active':'dead');expect(s.players.C!.presence).toBe(scenario==='fusen-empty'?'active':'dead');expect(s.phase).toBe('action');expect(s.resolution).toEqual([]);expect(s.lifecycle??[]).toEqual([]);expect(s.outcome).toBeUndefined();
},15000);
