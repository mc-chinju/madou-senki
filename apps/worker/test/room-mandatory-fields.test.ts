import {reset} from 'cloudflare:test';
import {afterEach,expect,it,vi} from 'vitest';
import {activeWindowRef,allCardInstanceIds,gameStats,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{vi.restoreAllMocks();await reset();});
it.each(['mandatory-cham-warrior','mandatory-cham-magic','mandatory-conversion-asfelt','mandatory-conversion-garwin'] as const)('%s retains mandatory values through real DO restart and identical ACK',async scenario=>{
 const room=await openTestRoom(scenario),cham=scenario.startsWith('mandatory-cham-'),expected=scenario==='mandatory-cham-warrior'?2:5;let seq=0;const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`mandatory-field-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<300;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('MANDATORY_FIELDS_DO_LIMIT');}
 const initial=await game();await room.restart();expect(await game()).toEqual(initial);
 if(cham){await until(s=>s.windows?.at(-1)?.kind==='attack-abilities');expect(Object.values((await game()).groups!)[0]!.technique.damage).toBe(expected);await until(s=>!s.windows?.length);expect((await game()).players.B!.damage).toBe(expected);}
 else{
 // Successful resistance preserves allegiance; production entropy is random.
 vi.spyOn(crypto,'getRandomValues').mockImplementation(<T extends ArrayBufferView|null>(array:T):T=>{if(array instanceof Uint32Array)array.fill(0);return array;});
 const threshold=gameStats(initial,'B').spirit+1;await until(s=>s.windows?.at(-1)?.kind==='after-roll');expect((await game()).rolls!.at(-1)).toMatchObject({purpose:'faction-change',threshold,modifier:-1,faces:[1,1],total:2,success:true});expect((await room.snapshotFor('B')).game!.currentRoll!.threshold).toBe(threshold);await until(s=>!s.windows?.length);expect((await game()).players.B!.faction).toBe(initial.players.B!.faction);}
});
