import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {allCardInstanceIds,viewFor} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it.each(['suppression-wandering-ban','suppression-wandering-source','suppression-wandering-target'] as const)('%s retains the established effect at a structural saved boundary and the next real command',async scenario=>{
  const room=await openTestRoom(scenario),before=await room.stored(),s=before.state.game!;
  const ban=scenario.endsWith('-ban'),target=ban?'A':scenario.endsWith('-source')?'C':'B';
  expect(s.players[target]!.presence).toBe('wandering');expect(s.players[target]!.hand).toEqual([]);
  expect(s.suppressionDesignations).toHaveLength(1);expect(s.blessingLeases??[]).toHaveLength(ban?0:1);
  await room.restart();
  for(const id of ['A','B','C','D']){
    const view=(await room.snapshotFor(id)).game!;expect(view).toEqual(viewFor(s,id));
    expect(view.suppressionTargets).toEqual([{targetId:'B',designated:true,applicability:ban?'suppressed':'relieved'}]);
  }
  expect(await room.stored()).toEqual(before);
  const envelope={protocolVersion:1 as const,commandId:'wandering-next-action',expectedRevision:before.revision,command:{type:'PASS_ACTION' as const}};
  const ack=await room.command('D',envelope);expect(ack).toMatchObject({type:'ack'});
  const saved=await room.stored(),after=saved.state.game!;
  expect(after.suppressionDesignations).toEqual(s.suppressionDesignations);expect(after.blessingLeases??[]).toEqual(s.blessingLeases??[]);
  expect(after.players[target]!.characterId).toBe(s.players[target]!.characterId);expect(after.players[target]!.lifeId).toBe(s.players[target]!.lifeId);
  expect(allCardInstanceIds(after).sort()).toEqual(allCardInstanceIds(s).sort());expect(new Set(allCardInstanceIds(after)).size).toBe(220);
  await room.restart();expect(await room.command('D',envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
  for(const id of ['A','B','C','D']){
    expect((await room.snapshotFor(id)).game).toEqual(viewFor(after,id));
    expect(viewFor(after,id).suppressionTargets).toEqual([{targetId:'B',designated:true,applicability:ban?'suppressed':'relieved'}]);
  }
});
