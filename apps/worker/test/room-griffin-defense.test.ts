import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,gameStats,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
import {entropy} from './fixtures/scenario-tools.js';
import {getAction,actionCards} from '@madou/catalog';
afterEach(async()=>{await reset();});
it.each(['select','cancel','late'] as const)('actual Griffin %s preserves per-hit Giant attempts and follower cutoff through DO replay',async mode=>{
 const room=await openTestRoom(mode==='late'?'received-griffin-follower':'received-griffin');let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`lia-life-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy(entropy());});const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);expect([...ids].sort()).toEqual(actionCards.map(card=>card.id).sort());await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));}
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<300;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('LIA_LIFE_WINDOW');}
 const finish=()=>until(s=>!s.windows?.length);
 const giant='c2-p07-r1c2-ab01',first=viewFor(await game(),'B').abilityOptions.find(o=>o.abilityId===giant)!;expect(first).toBeDefined();
 async function rejectOld(){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`reject-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command:{type:'USE_ABILITY' as const,abilityId:giant,targetEventId:first.targetEventId}},ack=await room.command('B',envelope);expect(ack).toMatchObject({type:'error'});expect(await room.stored()).toEqual(before);await room.restart();expect(await room.command('B',envelope)).toEqual(ack);expect(await room.stored()).toEqual(before);}
 if(mode==='late'){await send('B',{type:'START_FOLLOWERS'});expect(viewFor(await game(),'B').abilityOptions.some(o=>o.abilityId===giant)).toBe(false);await rejectOld();}
 else {await send('B',{type:'USE_ABILITY',abilityId:giant,targetEventId:first.targetEventId});if(mode==='cancel'){await until(s=>s.windows?.at(-1)?.participants[s.windows.at(-1)!.cursor]==='C'&&!!viewFor(s,'C').reactionTargetAbilityId);await send('C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(await game(),'C').reactionTargetAbilityId!});await until(s=>s.windows?.at(-1)?.kind==='normal-defense');expect(viewFor(await game(),'B').abilityOptions.some(o=>o.abilityId===giant)).toBe(false);await rejectOld();}}
 if(mode==='late'){await until(s=>{expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===giant)).toBe(false);return !s.windows?.length;});expect((await game()).outcome).toBeUndefined();return;}
 await until(s=>s.windows?.at(-1)?.kind==='normal-defense'&&viewFor(s,'B').currentAttack?.hitIndex===1);const second=viewFor(await game(),'B').abilityOptions.find(o=>o.abilityId===giant)!;expect(second).toBeDefined();expect(second.targetEventId).not.toBe(first.targetEventId);await rejectOld();await send('B',{type:'USE_ABILITY',abilityId:giant,targetEventId:second.targetEventId});await finish();const done=await game();expect(done.players.B!.damage).toBe(mode==='cancel'?8:0);expect(done.resolution).toEqual([]);expect(done.outcome).toBeUndefined();
});
