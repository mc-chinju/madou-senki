import {reset} from 'cloudflare:test';
import {afterEach,expect,it,vi} from 'vitest';
import {activeWindowRef,allCardInstanceIds,gameStats,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{vi.restoreAllMocks();await reset();});
it.each([['teleport-physical-1','a2-p06-r1c1',false],['teleport-physical-1','a2-p06-r1c1',true],['teleport-physical-2','a2-p06-r1c2',false],['teleport-physical-2','a2-p06-r1c2',true]] as const)('%s physical %s saves the elected teleport modifier dedicated=%s',async(scenario,card,dedicated)=>{
 vi.spyOn(crypto,'getRandomValues').mockImplementation(<T extends ArrayBufferView|null>(array:T):T=>{if(array instanceof Uint32Array)for(let i=0;i<array.length;i++)array[i]=i%2===0?2:3;return array;});
 const room=await openTestRoom(scenario);let seq=0;const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`teleport-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<300;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('TELEPORT_DO_WINDOW');}
 const before=gameStats(await game(),'B');await send('B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});await until(s=>s.rolls?.at(-1)?.stage==='after-roll');const roll=structuredClone((await game()).rolls!.at(-1)!);expect(roll).toMatchObject({purpose:'teleport',faces:[3,4],threshold:dedicated?7:6,success:dedicated,modifier:dedicated?1:0});
 for(const actor of ['A','C','D']){const view=(await room.snapshotFor(actor)).game!;expect(view.currentRoll).not.toHaveProperty('threshold');expect(view.currentRoll).not.toHaveProperty('success');expect(view.players.B).not.toHaveProperty('characterId');}
 await until(s=>!s.windows?.length);const done=await game();expect(done.rolls!.find(r=>r.id===roll.id)).toMatchObject({faces:[3,4],threshold:roll.threshold,success:dedicated,attempts:roll.attempts});expect(done.players.B!.damage).toBe(dedicated?0:4);expect(gameStats(done,'B')).toEqual(before);expect(done.discard.filter(id=>id===card)).toHaveLength(1);expect(done.players.B!.hand).not.toContain(card);
});
