import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,type GameCommand,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it.each([false,true])('S11-S12 three=%s DO saves each physical payment and preserves exact scope on duplicate receipt',async(three)=>{
 const room=await openTestRoom(three?'r6-s12':'r6-s11');let seq=0;const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`s11-12-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<300;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('S11_12_DO_WINDOW');}
 const s=await game(),distances=structuredClone(s.distances),card=(owner:string,name:string)=>s.players[owner]!.hand.find(id=>getAction(id)!.name===name)!,bm=card('B','間合い／休息'),cm=card('C','間合い／休息'),advance=card('A','踏み込み／蹴る');expect(Object.values(s.groups!)[0]!.hitIndices).toEqual(three?[0,1,2]:[0]);await send('B',{type:'PLAY_MAAI',cardInstanceId:bm});await until(s=>s.windows?.at(-1)?.kind!=='reclaim');
 if(three){await send('A',{type:'PASS'});const g=Object.values((await game()).groups!)[0]!;expect(g.hitCursor).toBe(1);expect(g.targets[0]!.hits.map(h=>h.defended)).toEqual([true,false,false]);}
 else {await send('C',{type:'PLAY_MAAI',cardInstanceId:cm});await until(s=>s.windows?.at(-1)?.kind!=='reclaim');await send('A',{type:'PLAY_ADVANCE',cardInstanceId:advance});await until(s=>s.windows?.at(-1)?.kind!=='reclaim');expect((await game()).distances).toEqual(distances);for(const id of [bm,cm,advance])expect((await game()).discard.filter(x=>x===id)).toHaveLength(1);}
 await until(s=>!s.windows?.length);const done=await game();expect(done.distances).toEqual(distances);expect([done.players.B!.damage,done.players.C!.damage]).toEqual(three?[14,0]:[7,7]);expect(done.discard.filter(id=>id===bm)).toHaveLength(1);expect(done.phase).toBe('withdrawal');
});
