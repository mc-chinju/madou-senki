import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it.each([['virtual-blade-ice',false],['virtual-blade-fire',false],['virtual-blade-ice',true],['virtual-blade-fire',true]] as const)('%s canceled=%s saves the declaration, rolls and single group without physical source',async(name,cancel)=>{
 const room=await openTestRoom(name),abilityId=name.endsWith('ice')?'c2-p04-r1c1-ab02':'c2-p06-r2c1-ab02';let seq=0;const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`blade-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let i=0;i<300;i++){const s=await game();if(done(s))return;const w=s.windows?.at(-1);if(!w)throw Error('BLADE_DO_WINDOW');await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('BLADE_DO_LIMIT');}
 const start=await game(),hand=[...start.players.A!.hand];for(const actor of ['B','C','D'])expect((await room.snapshotFor(actor)).game!.virtualBladeOptions).toEqual([]);await send('A',{type:'DECLARE_VIRTUAL_BLADE',abilityId,targetIds:['B']});expect(Object.values((await game()).actions!)[0]).toMatchObject({source:{kind:'ability',abilityId,actorId:'A'},cardInstanceId:null});
 if(cancel){await until(s=>viewFor(s,'C').activeWindow?.pendingActorId==='C');await send('C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(await game(),'C').reactionTargetAbilityId!});}
 else{await until(s=>s.windows?.at(-1)?.kind==='normal-defense');expect(Object.values((await game()).groups!)).toHaveLength(1);if(name.endsWith('ice'))expect((await game()).rolls!.some(r=>r.purpose==='excess-level')).toBe(true);}
 await until(s=>!s.windows?.length);const end=await game();expect(end.phase).toBe('withdrawal');expect(end.players.B!.damage).toBe(cancel?0:name.endsWith('ice')?3:5);expect(end.players.A!.hand).toEqual(hand);expect(end.actions).toEqual({});expect(end.discard).toEqual(cancel?['a2-p02-r2c3']:[]);
});
