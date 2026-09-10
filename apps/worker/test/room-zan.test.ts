import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it.each(['select','decline','cancel','maai'] as const)('Zan %s persists hit history and commits damage once through real DO restarts',async choice=>{
 const room=await openTestRoom(choice==='maai'?'zan-maai':'zan');let seq=0;const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`zan-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let i=0;i<300;i++){const s=await game();if(done(s))return;const w=s.windows?.at(-1);if(!w)throw Error('ZAN_DO_WINDOW');await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('ZAN_DO_LIMIT');}
 const start=await game(),o=viewFor(start,'A').abilityOptions.find(o=>o.abilityId==='c2-p04-r1c2-ab02');for(const actor of ['B','C','D'])expect(JSON.stringify((await room.snapshotFor(actor)).game)).not.toContain('c2-p04-r1c2-ab02');
 if(choice==='maai'){expect(o).toBeUndefined();expect(Object.values(start.groups!)[0]!.targets[0]!.hits[0]!.maaiWasSubmitted).toBe(true);}
 else{expect(o).toBeDefined();if(choice!=='decline'){await send('A',{type:'USE_ABILITY',abilityId:o!.abilityId,targetEventId:o!.targetEventId});if(choice==='cancel'){await until(s=>viewFor(s,'C').activeWindow?.pendingActorId==='C');await send('C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(await game(),'C').reactionTargetAbilityId!});}}}
 await until(s=>s.windows?.at(-1)?.kind==='follower-start');expect(Object.values((await game()).groups!)[0]!.targets[0]!.hits[0]!.damage).toBe(choice==='select'?10:5);await until(s=>!s.windows?.length);expect((await game()).players.B!.damage).toBe(choice==='select'?10:5);expect((await game()).phase).toBe('withdrawal');
});
