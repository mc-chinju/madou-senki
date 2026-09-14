import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import type {ClientEnvelope,GameCommand} from '@madou/protocol';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
type Room=Awaited<ReturnType<typeof openTestRoom>>;
const game=async(r:Room)=>(await r.stored()).state.game!;
async function send(r:Room,actorId:string,id:string,command:GameCommand){const saved=await r.stored(),envelope:ClientEnvelope={protocolVersion:1,commandId:id,expectedRevision:saved.revision,...activeWindowRef(saved.state.game!),command},ack=await r.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});expect(new Set(allCardInstanceIds(await game(r))).size).toBe(220);const savedAfter=await r.stored();await r.restart();expect(await r.command(actorId,envelope)).toEqual(ack);expect(await r.stored()).toEqual(savedAfter);for(const id of ['A','B','C','D'])expect((await r.snapshotFor(id)).game).toEqual(viewFor(savedAfter.state.game!,id));return {actorId,envelope,ack};}
async function replay(r:Room,c:Awaited<ReturnType<typeof send>>){const saved=await r.stored();await r.restart();expect(await r.command(c.actorId,c.envelope)).toEqual(c.ack);expect(await r.stored()).toEqual(saved);}
async function until(r:Room,done:(s:GameState)=>boolean,prefix:string){for(let n=0;n<300;n++){const s=await game(r);if(done(s))return;const w=s.windows!.at(-1)!;await send(r,w.participants[w.cursor]!,`${prefix}-${n}`,{type:'PASS'});}throw Error('NAMED_DEATH_LIMIT');}
it('Actual placed follower death restores ordinary recovery once through every DO restart and replay',async()=>{
 const room=await openTestRoom('reclaim-ordinary-follower-death'),name='女神官のシャリア',initial=await game(room),card=initial.players.A!.followers.find(f=>getAction(f.cardInstanceId)!.name===name)!.cardInstanceId;
 expect(initial.windows!.at(-1)!.kind).toBe('normal-defense');await room.restart();
 await until(room,s=>viewFor(s,'A').reclaim?.cardInstanceId===card,'death');
 expect((await game(room)).players.A!.followers).toEqual([]);
 await send(room,'A','reveal-owner',{type:'REVEAL_CHARACTER'});
 const d=viewFor(await game(room),'A').reclaim!,claim=d.claims.find(c=>c.right==='base')!;expect(claim).toBeDefined();
 expect((await game(room)).reclaimDecisions!.find(x=>x.id===d.decisionId)!.source).toMatchObject({trigger:'follower-died'});
 const accepted=await send(room,'A','take',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:claim.claimId});await replay(room,accepted);
 await until(room,s=>s.reclaimReservations.includes(card),'reserve');await room.restart();
 const reserved=await game(room);expect(reserved.players.A!.hand).not.toContain(card);expect(reserved.discard).not.toContain(card);
 await until(room,s=>!s.windows?.length,'finish');await replay(room,accepted);
 const final=await game(room);expect(final.players.A!.hand.filter(c=>c===card)).toHaveLength(1);expect(final.discard).not.toContain(card);expect(final.reclaimReservations).not.toContain(card);expect(final.players.A!.reclaimUsage?.[name]?.baseSpent??false).toBe(true);
});
