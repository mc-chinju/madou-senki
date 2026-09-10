import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
import {advanceRemainingScenarios,advanceRemainingCards} from './fixtures/advance-remaining-physical-scenarios.js';
afterEach(async()=>{await reset();});
it.each(advanceRemainingScenarios)('%s physical mode survives every command restart and duplicate replay',async scenario=>{
 const room=await openTestRoom(scenario),index=Number(scenario.split('-')[2])-1,card=advanceRemainingCards[index]!,mode=scenario.split('-')[3];let seq=0;const state=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand,reject=false){const stored=await room.stored(),envelope={protocolVersion:1 as const,commandId:`advance-remaining-${seq++}`,expectedRevision:stored.revision,...activeWindowRef(stored.state.game!),command},ack=await room.command(actorId,envelope);expect(ack,JSON.stringify({command,ack})).toMatchObject({type:reject?'error':'ack'});const saved=await room.stored();if(reject)expect(saved.state.game).toEqual(stored.state.game);const ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<300;n++){if(done(await state()))return;const w=(await state()).windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('ADVANCE_DO_LIMIT');}
 const before=structuredClone(await state());
 if(mode==='attack')await send('A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});
 else if(mode==='advance'){await send('B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'});await until(s=>s.windows?.at(-1)?.kind==='defense-advance');await send('A',{type:'PLAY_ADVANCE',cardInstanceId:card});}
 else {await send('A',{type:'APPROACH',cardInstanceId:card,targetId:'B'});if(mode==='cancel')await send('B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'});}
 await until(s=>!s.windows?.length);const after=await state();expect(after.players.B!.damage).toBe(mode==='attack'?(index===0?4:index===1?5:3):mode==='advance'?10:0);expect(after.players.A!.hand).not.toContain(card);
 if(mode==='approach'){expect(after.distances.A!.B).toBe('near');expect(after.distances.B!.A).toBe('near');expect(Object.values(after.distanceMarkers??{})).toEqual([{a:'A',b:'B',ownerId:'A',cardInstanceId:card}]);expect(after.discard).not.toContain(card);}
 else {expect(after.distances).toEqual(before.distances);expect(after.discard.filter(id=>id===card)).toHaveLength(1);}
 expect(after.phase).toBe(mode==='attack'||mode==='advance'?'withdrawal':'action');
 await send('A',{type:'APPROACH',cardInstanceId:card,targetId:'C'},true);
 await send('A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false},true);
},20000);
