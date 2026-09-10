import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,gameStats,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it('S07 exact prayer reservation rejection return and later independent reuse survive every DO restart and replay',async()=>{
 const room=await openTestRoom('canonical-S07'),prayer='a2-p05-r2c3';let seq=0;const state=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand,reject=false){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`s07-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:reject?'error':'ack'});const saved=await room.stored();if(reject){expect(saved.state.game).toEqual(before.state.game);expect(saved.revision).toBe(before.revision);}const ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<300;n++){const s=await state();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('S07_DO_LIMIT');}
 let firstEvent='';
 for(const [actor,card] of [['A','a2-p24-r1c2'],['B','a2-p24-r1c3']] as const){
 await send(actor,{type:'ATTACK',cardInstanceId:card,targetIds:['C'],dedicated:false});await until(s=>s.windows?.at(-1)?.kind==='effect-level'&&s.windows.at(-1)!.participants[s.windows.at(-1)!.cursor]==='B');
 const action=Object.values((await state()).actions!).find(a=>a.cardInstanceId===card)!;
 if(actor==='A')firstEvent=action.eventId;else expect(action.eventId).not.toBe(firstEvent);
 const command={type:'PLAY_REACTION' as const,cardInstanceId:prayer,mode:'effect-plus' as const,targetActionId:action.id,dedicated:true};await send('B',command);await until(s=>s.reclaimReservations.includes(prayer));expect((await state()).players.B!.hand).not.toContain(prayer);await send('B',command,true);await until(s=>!s.windows?.length);expect((await state()).players.B!.hand.filter(id=>id===prayer)).toHaveLength(1);expect((await state()).discard).not.toContain(prayer);await send('B',command,true);
 if(actor==='A'){await send('A',{type:'PASS_WITHDRAWAL'});const s=await state();await send('A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(gameStats(s,'A').handLimit)});await until(s=>!s.windows?.length);await send('B',{type:'START_TURN'});await send('B',{type:'CHOOSE_DRAW',draw:false});}
 }
});
