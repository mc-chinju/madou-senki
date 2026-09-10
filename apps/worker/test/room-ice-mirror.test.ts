import {reset} from 'cloudflare:test';
import {afterEach,expect,it,vi} from 'vitest';
import {activeWindowRef,allCardInstanceIds,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{vi.restoreAllMocks();await reset();});
it.each([['ice-mirror-magic',false],['ice-mirror-magic',true],['ice-mirror-warrior',true]] as const)('%s dedicated=%s saves actual Prayer relative limits and one physical reflection or block',async(scenario,dedicated)=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(<T extends ArrayBufferView|null>(array:T):T=>{if(array instanceof Uint32Array)array.fill(1);return array;});const room=await openTestRoom(scenario);let seq=0;const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`ice-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<300;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('ICE_DO_WINDOW');}
 await send('B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p12-r3c2',dedicated});const id=Object.values((await game()).actions!).find(a=>a.cardInstanceId==='a2-p12-r3c2')!.id;await until(s=>s.windows?.at(-1)?.kind==='effect-level'&&s.windows.at(-1)!.participants[s.windows.at(-1)!.cursor]==='B');expect((await game()).rolls?.filter(r=>r.purpose==='excess-level').length??0).toBe(dedicated?0:1);
 await send('B',{type:'PLAY_REACTION',cardInstanceId:'a2-p05-r2c3',mode:'effect-plus',targetActionId:id});await until(s=>s.windows?.at(-1)?.kind==='damage'&&s.windows.at(-1)!.continuation.id===id);expect((await game()).actions![id]!.technique).toMatchObject({useLevel:6,effectLevel:8,reflectMagicLimit:8,blockWarriorLimit:dedicated?8:-1});
 for(const actor of ['A','C','D'])expect((await room.snapshotFor(actor)).game!.players.B).not.toHaveProperty('characterId');
 await until(s=>!s.windows?.length);const done=await game();expect([done.players.A!.damage,done.players.B!.damage]).toEqual(scenario==='ice-mirror-magic'?[5,0]:[0,0]);expect(done.discard.filter(id=>id==='a2-p12-r3c2')).toHaveLength(1);expect(done.players.B!.hand).not.toContain('a2-p12-r3c2');
});
