import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it('S28 Lancelot transformation saves before selection and after commit and replays every receipt without repeated transformation',async()=>{
 const room=await openTestRoom('lifecycle-transform');let sequence=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){
  const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`transform-${sequence++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};
  const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});
  const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);
  await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  return {envelope,ack};
 }
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<200;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('TRANSFORM_LIMIT');}
 await send('B',{type:'REVEAL_CHARACTER'});await until(s=>!s.windows?.length);
 const before=await room.stored(),initial=before.state.game!;await room.restart();expect(await room.stored()).toEqual(before);
 expect((await room.snapshotFor('A')).game!.lifecycleAbilities).toContain('lancelot-transform');
 const receipt=await send('A',{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'});
 await until(s=>s.players.A!.characterId==='c2-p07-r1c1');
 const committed=await room.stored();expect(committed.state.game!.players.A).toMatchObject({damage:initial.players.A!.damage,abilityCharacterIds:['c2-p02-r2c2','c2-p07-r1c1']});expect(committed.state.game!.used).toEqual(expect.arrayContaining(initial.used??[]));expect(committed.state.game!.used!.filter(key=>key==='A:lancelot-transform')).toHaveLength(1);
 await room.restart();expect(await room.command('A',receipt.envelope)).toEqual(receipt.ack);expect(await room.stored()).toEqual(committed);
 await until(s=>!s.windows?.length);const final=await room.stored();expect((await room.snapshotFor('A')).game!.lifecycleAbilities).not.toContain('lancelot-transform');
 await room.restart();expect(await room.command('A',receipt.envelope)).toEqual(receipt.ack);expect(await room.stored()).toEqual(final);
});
