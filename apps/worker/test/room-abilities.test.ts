import { reset } from 'cloudflare:test';
import { afterEach, expect, it } from 'vitest';
import { activeWindowRef, allCardInstanceIds } from '@madou/engine';
import type { ClientEnvelope } from '@madou/protocol';
import { openTestRoom } from './fixtures/recovery-room.js';

afterEach(async () => { await reset(); });
it('persists a concealed ability declaration and its canceled cost through eviction and exact replay', async () => {
  const room = await openTestRoom('ability-hidden-cancel');
  const own = (await room.snapshotFor('A')).game!; const other = (await room.snapshotFor('B')).game!;
  expect(own.currentAction).toMatchObject({ source: 'ability', abilityId: 'c2-p04-r2c2-ab04' });
  expect(other.currentAction).toMatchObject({ source: 'ability', label: '特殊能力' });
  expect(JSON.stringify(other)).not.toContain('c2-p04-r2c2');
  expect(other.abilityOptions).toEqual([]);
  expect(other.reactionTargetAbilityId).toBeTruthy();
  const before = await room.stored(); await room.restart(); expect(await room.stored()).toEqual(before);
  const command: ClientEnvelope = { protocolVersion: 1, commandId: 'cancel-hidden-ability', expectedRevision: before.revision,
    ...activeWindowRef(before.state.game!)!, command: { type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'cancel-ability', targetAbilityId: other.reactionTargetAbilityId! } };
  const reply = await room.command('B', command); expect(reply).toMatchObject({ type: 'ack' });
  const committed = await room.stored(); await room.restart();
  expect(await room.command('B', command)).toEqual(reply); expect(await room.stored()).toEqual(committed);
  for (let i = 0; i < 100; i++) {
    const stored = await room.stored(); const game = stored.state.game!; const w = game.windows?.at(-1);
    if (!w) break;
    const response = await room.command(w.participants[w.cursor]!, { protocolVersion: 1, commandId: `ability-pass-${i}`, expectedRevision: stored.revision,
      ...activeWindowRef(game)!, command: { type: 'PASS' } });
    expect(response).toMatchObject({ type: 'ack' });
  }
  const ended = await room.stored(); expect(ended.state.game!.windows).toHaveLength(0);
  expect(ended.state.game!.players.A).toMatchObject({ damage: 5, revealed: false });
  expect(ended.state.game!.players.A!.hand).toEqual(before.state.game!.players.A!.hand);
  expect(ended.state.game!.discard).toContain('a2-p07-r3c1');
  expect(ended.state.game!.discard).toContain('a2-p02-r2c3');
  expect(allCardInstanceIds(ended.state.game!)).toHaveLength(220);
  expect(new Set(allCardInstanceIds(ended.state.game!)).size).toBe(220);
  expect((await room.snapshotFor('A')).game!.abilityOptions).toEqual([]);
});
it('saves the actual Ida cost response before declaration and does not repay or reheal after reload', async () => {
  const room = await openTestRoom('ability-hide');
  const initial=await room.stored();const own=(await room.snapshotFor('A')).game!;
  const option=own.abilityOptions.find(o=>o.abilityId==='c2-p04-r2c2-ab04')!;
  const command:ClientEnvelope={protocolVersion:1,commandId:'pay-ida-cost',expectedRevision:initial.revision,
    command:{type:'USE_ABILITY',abilityId:option.abilityId,targetEventId:option.targetEventId,costCardInstanceId:'a2-p07-r3c1',conceal:true}};
  const reply=await room.command('A',command);expect(reply.type).toBe('ack');
  const paid=await room.stored();expect(paid.state.game!.windows!.at(-1)!.kind).toBe('reclaim');
  expect(paid.state.game!.resolution).toContain('a2-p07-r3c1');expect(paid.state.game!.players.A!.damage).toBe(5);
  await room.restart();expect(await room.command('A',command)).toEqual(reply);expect(await room.stored()).toEqual(paid);
  for(let i=0;i<4;i++){
    const stored=await room.stored(),game=stored.state.game!,w=game.windows!.at(-1)!;
    expect(w.kind).toBe('reclaim');expect((await room.snapshotFor(w.participants[w.cursor]!)).game!.reclaim!.claims).toEqual([]);
    expect(await room.command(w.participants[w.cursor]!,{protocolVersion:1,commandId:`ida-cost-pass-${i}`,expectedRevision:stored.revision,...activeWindowRef(game)!,command:{type:'PASS'}})).toMatchObject({type:'ack'});
  }
  const resumed=await room.stored();expect(resumed.state.game!.windows!.at(-1)!.kind).toBe('declaration');
  expect(resumed.state.game!.players.A!.damage).toBe(5);await room.restart();expect(await room.stored()).toEqual(resumed);
  for(let i=0;i<20;i++){
    const stored=await room.stored(),game=stored.state.game!,w=game.windows?.at(-1);if(!w)break;
    expect(await room.command(w.participants[w.cursor]!,{protocolVersion:1,commandId:`ida-declaration-pass-${i}`,expectedRevision:stored.revision,...activeWindowRef(game)!,command:{type:'PASS'}})).toMatchObject({type:'ack'});
  }
  const done=await room.stored();expect(done.state.game!.players.A).toMatchObject({damage:3,revealed:false});
  expect(done.state.game!.phase).toBe('hand-adjustment');expect(done.state.game!.discard.filter(id=>id==='a2-p07-r3c1')).toHaveLength(1);
  expect(done.state.game!.reclaimDecisions!.filter(d=>d.cardInstanceId==='a2-p07-r3c1')).toHaveLength(1);
  expect(done.state.game!.players.A!.hand).toHaveLength(initial.state.game!.players.A!.hand.length-1);
  await room.restart();expect(await room.command('A',command)).toEqual(reply);expect(await room.stored()).toEqual(done);
});
