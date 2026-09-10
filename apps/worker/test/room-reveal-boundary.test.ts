import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it.each(['canonical-S15-before','canonical-S15-after','canonical-S16'] as const)('%s real hit and reveal boundary survives every restart and duplicate receipt',async scenario=>{
 const room=await openTestRoom(scenario),zero=scenario==='canonical-S16';let seq=0;const state=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`reveal-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 expect((await state()).players.B!.revealed).toBe(false);
 if(zero){const group=Object.values((await state()).groups!)[0]!;expect(group.technique.damage).toBe(0);expect(group.targets[0]!.hits[0]!.damage).toBe(0);}else await send('B',{type:'REVEAL_CHARACTER'});
 for(let n=0;n<300;n++){const s=await state(),w=s.windows?.at(-1);if(!w)break;await send(w.participants[w.cursor]!,{type:'PASS'});}
 const final=await state();expect(final.windows??[]).toEqual([]);expect(final.players.B!.revealed).toBe(true);expect(final.players.B!.damage).toBe(scenario==='canonical-S15-after'?4:0);expect(final.discard.filter(id=>id===(zero?'a2-p08-r3c3':'a2-p24-r1c2'))).toHaveLength(1);
});
