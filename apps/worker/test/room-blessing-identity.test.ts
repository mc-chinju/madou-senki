import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {allCardInstanceIds,viewFor} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';

afterEach(async()=>{await reset();});

it('structural Lia identity loss projects an expired lease and cleans it on a real command through eviction and replay',async()=>{
  const room=await openTestRoom('suppression-identity-boundary');
  const before=await room.stored(),state=before.state.game!;
  const lease=structuredClone(state.blessingLeases![0]!);
  expect(lease).toMatchObject({sourceActorId:'C',sourceCharacterId:'c2-p03-r1c2',targetId:'B'});
  expect(lease.sourceLifeId).toBe(state.players.C!.lifeId??'initial-life:C');
  expect(state.players.C!.characterId).not.toBe(lease.sourceCharacterId);
  expect(state.players.C!.presence??'active').toBe('active');
  expect(state.players.C!.revealed).toBe(true);
  await room.restart();
  for(const actor of ['A','B','C','D']) {
    const projected=(await room.snapshotFor(actor)).game!;
    expect(projected).toEqual(viewFor(state,actor));
    expect(projected.suppressionTargets).toEqual([{targetId:'B',designated:true,applicability:'suppressed'}]);
  }
  // Projection does not mutate storage or pretend that a transformation command ran.
  expect(await room.stored()).toEqual(before);
  const envelope={protocolVersion:1 as const,commandId:'identity-boundary-action',expectedRevision:before.revision,command:{type:'PASS_ACTION' as const}};
  const ack=await room.command('C',envelope);expect(ack).toMatchObject({type:'ack'});
  const saved=await room.stored(),after=saved.state.game!;
  expect(saved.revision).toBe(before.revision+1);
  expect(after.blessingLeases).toEqual([]);
  expect(after.suppressionDesignations).toEqual(state.suppressionDesignations);
  expect(after.players.C!.lifeId).toBe(state.players.C!.lifeId);
  expect(allCardInstanceIds(after).sort()).toEqual(allCardInstanceIds(state).sort());
  expect(new Set(allCardInstanceIds(after)).size).toBe(220);
  await room.restart();expect(await room.command('C',envelope)).toEqual(ack);
  expect(await room.stored()).toEqual(saved);
  for(const actor of ['A','B','C','D'])expect((await room.snapshotFor(actor)).game).toEqual(viewFor(after,actor));
});
