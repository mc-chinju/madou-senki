import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import type {ClientEnvelope,GameCommand} from '@madou/protocol';
import {openTestRoom} from './fixtures/recovery-room.js';
import {namedDeathCases} from './fixtures/named-follower-death-scenario.js';
afterEach(async()=>{await reset();});
type Room=Awaited<ReturnType<typeof openTestRoom>>;
const game=async(r:Room)=>(await r.stored()).state.game!;
async function send(r:Room,actorId:string,id:string,command:GameCommand){const saved=await r.stored(),envelope:ClientEnvelope={protocolVersion:1,commandId:id,expectedRevision:saved.revision,...activeWindowRef(saved.state.game!),command},ack=await r.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});expect(new Set(allCardInstanceIds(await game(r))).size).toBe(220);return {actorId,envelope,ack};}
async function replay(r:Room,c:Awaited<ReturnType<typeof send>>){const saved=await r.stored();await r.restart();expect(await r.command(c.actorId,c.envelope)).toEqual(c.ack);expect(await r.stored()).toEqual(saved);}
async function until(r:Room,done:(s:GameState)=>boolean,prefix:string){for(let n=0;n<300;n++){const s=await game(r);if(done(s))return;const w=s.windows!.at(-1)!;await send(r,w.participants[w.cursor]!,`${prefix}-${n}`,{type:'PASS'});}throw Error('NAMED_DEATH_LIMIT');}
it.each(['reclaim-named-death-ship','reclaim-named-death-dragon','reclaim-named-death-griffin','reclaim-named-death-skeleton','reclaim-named-death-zombie','reclaim-named-death-wight','reclaim-named-death-knight'] as const)('%s saves actual death recovery and replays one accepted claim',async scenario=>{
 const room=await openTestRoom(scenario),[ability,name]=namedDeathCases[scenario],initial=await game(room),card=initial.players.A!.followers.find(f=>getAction(f.cardInstanceId)!.name===name)!.cardInstanceId;
 expect(initial.windows!.at(-1)!.kind).toBe('normal-defense');await room.restart();
 await until(room,s=>viewFor(s,'A').reclaim?.cardInstanceId===card,'death');
 expect((await game(room)).players.A!.followers).toEqual([]);
 const d=viewFor(await game(room),'A').reclaim!,claim=d.claims.find(c=>c.right==='unlimited')!;expect(claim).toBeDefined();
 expect((await game(room)).reclaimDecisions!.find(x=>x.id===d.decisionId)!.source).toMatchObject({trigger:'follower-died'});
 const accepted=await send(room,'A','take',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:claim.claimId});await replay(room,accepted);
 expect(Object.values((await game(room)).abilities!).some(f=>f.abilityId===ability)).toBe(true);
 await until(room,s=>s.reclaimReservations.includes(card),'reserve');await room.restart();
 const reserved=await game(room);expect(reserved.players.A!.hand).not.toContain(card);expect(reserved.discard).not.toContain(card);
 await until(room,s=>!s.windows?.length,'finish');await replay(room,accepted);
 const final=await game(room);expect(final.players.A!.hand.filter(c=>c===card)).toHaveLength(1);expect(final.discard).not.toContain(card);expect(final.reclaimReservations).not.toContain(card);expect(final.players.A!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);
});
