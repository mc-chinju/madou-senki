import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,gameStats,type GameState} from '@madou/engine';
import type {ClientEnvelope,GameCommand} from '@madou/protocol';
import {openTestRoom} from './fixtures/recovery-room.js';
import {CanonicalRoom} from './fixtures/canonical-room.js';

afterEach(async()=>{await reset();});

type Room=Awaited<ReturnType<typeof openTestRoom>>;
type Draw={calls:number;consumed:number;pending:boolean};
type Probe=()=>Promise<Draw>;

/** The next command a seat may legally give without making a choice the fixture did not set up. */
function advance(state:GameState):{actorId:string;command:GameCommand}|null {
  const window=state.windows?.at(-1);
  if(window)return {actorId:window.participants[window.cursor]!,command:{type:'PASS'}};
  const actorId=state.seatOrder[state.turnSeat]!;
  const player=state.players[actorId]!;
  switch(state.phase) {
    case 'setup': return {actorId,command:{type:'PASS_SETUP'}};
    case 'turn-start': return {actorId,command:{type:'START_TURN'}};
    case 'draw': return {actorId,command:{type:'CHOOSE_DRAW',draw:false}};
    case 'action': return {actorId,command:{type:'PASS_ACTION'}};
    case 'withdrawal': return {actorId,command:{type:'PASS_WITHDRAWAL'}};
    case 'hand-adjustment': return {actorId,command:{type:'END_TURN',
      discardIds:player.hand.slice(0,Math.max(0,player.hand.length-gameStats(state,actorId).handLimit))}};
    default: return null;
  }
}

const envelope=(stored:Awaited<ReturnType<Room['stored']>>,commandId:string,command:GameCommand):ClientEnvelope=>
  ({protocolVersion:1,commandId,expectedRevision:stored.revision,...activeWindowRef(stored.state.game!),command});

/**
 * The Worker-side obligation for every command: after eviction the duplicate receipt returns the
 * first ack, leaves the saved state untouched and draws no new entropy. What each card does with
 * the command is settled in the engine tests; per-participant views are `room-view-secrecy`.
 */
async function replay(room:Room,actorId:string,request:ClientEnvelope,probe:Probe) {
  const before=await probe();
  const ack=await room.command(actorId,request);
  expect(ack).toMatchObject({type:'ack'});
  const committed=await probe();
  const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);
  expect(ids).toHaveLength(220);
  expect(new Set(ids).size).toBe(220);
  // Eviction drops the instance, so the probe restarts at zero; the replay must leave it there.
  await room.restart();
  const evicted=await probe();
  expect(await room.command(actorId,request)).toEqual(ack);
  expect(await room.stored()).toEqual(saved);
  expect(await probe()).toEqual(evicted);
  return {ack,before,committed};
}

const probeFor=(room:Room):Probe=>()=>runInDurableObject(room.room,instance=>(instance as CanonicalRoom).entropyProbe());

const STEPS=8;
it.each(['death-gift','amulet-refill','suppression-blessing','canonical-S04','follower-attack-royal','r6-s26-revive'] as const)(
  '%s replays each committed command after eviction with the same ack, saved state and entropy draw',async scenario=>{
  const room=await openTestRoom(scenario),probe=probeFor(room);
  for(let step=0;step<STEPS;step++) {
    const stored=await room.stored(),next=advance(stored.state.game!);
    expect(next,`${scenario} still has a legal command at step ${step}`).not.toBeNull();
    await replay(room,next!.actorId,envelope(stored,`${scenario}-${step}`,next!.command),probe);
  }
});

it('canonical-S04 takes the seeded roll once per command and the duplicate receipt never calls the provider',async()=>{
  const room=await openTestRoom('canonical-S04'),probe=probeFor(room);
  const seed=()=>runInDurableObject(room.room,instance=>(instance as CanonicalRoom).setNextEntropy({now:1000,dice:[4,4],random:Array(4096).fill(0.5)}));
  const game=async()=>(await room.stored()).state.game!;
  const rollId=(await game()).rolls!.at(-1)!.id;
  expect((await game()).rolls!.at(-1)!.faces).toEqual([2,3]);

  async function send(commandId:string,actorId:string,command:GameCommand) {
    await seed();
    const draws=await replay(room,actorId,envelope(await room.stored(),commandId,command),probe);
    expect(draws.before.pending).toBe(true);
    expect(draws.committed).toEqual({calls:draws.before.calls+1,consumed:draws.before.consumed+1,pending:false});
  }

  await send('canonical-S04-reroll','B',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r1c3',mode:'reroll',targetRollId:rollId});
  for(let step=0;step<300;step++) {
    const roll=(await game()).rolls!.at(-1)!;
    if(roll.attempts.length===2) {
      expect(roll).toMatchObject({id:rollId,faces:[4,4],success:true});
      expect(roll.attempts.map(attempt=>attempt.faces)).toEqual([[2,3],[4,4]]);
      return;
    }
    const next=advance(await game());
    expect(next,'the reroll must stay reachable').not.toBeNull();
    await send(`canonical-S04-${step}`,next!.actorId,next!.command);
  }
  throw Error('S04_REROLL_NOT_REACHED');
});
