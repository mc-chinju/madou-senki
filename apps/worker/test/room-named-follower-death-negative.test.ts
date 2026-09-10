import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import type {ClientEnvelope,GameCommand} from '@madou/protocol';
import {openTestRoom} from './fixtures/recovery-room.js';
import {namedDeathCases,type NamedDeathScenario} from './fixtures/named-follower-death-scenario.js';
afterEach(async()=>{await reset();});
type Room=Awaited<ReturnType<typeof openTestRoom>>;
const game=async(r:Room)=>(await r.stored()).state.game!;
async function send(r:Room,actorId:string,id:string,command:GameCommand){const saved=await r.stored(),envelope:ClientEnvelope={protocolVersion:1,commandId:id,expectedRevision:saved.revision,...activeWindowRef(saved.state.game!),command},ack=await r.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});expect(new Set(allCardInstanceIds(await game(r))).size).toBe(220);return {actorId,envelope,ack};}
async function replay(r:Room,c:Awaited<ReturnType<typeof send>>){const saved=await r.stored();await r.restart();expect(await r.command(c.actorId,c.envelope)).toEqual(c.ack);expect(await r.stored()).toEqual(saved);}
async function until(r:Room,done:(s:GameState)=>boolean,prefix:string){for(let n=0;n<300;n++){const s=await game(r);if(done(s))return;const w=s.windows!.at(-1)!;await send(r,w.participants[w.cursor]!,`${prefix}-${n}`,{type:'PASS'});}throw Error('NAMED_DEATH_LIMIT');}
it.each([["reclaim-named-death-ship", "decline"], ["reclaim-named-death-ship-cancel", "cancel"], ["reclaim-named-death-ship-ban", "ban"], ["reclaim-named-death-dragon", "decline"], ["reclaim-named-death-dragon-cancel", "cancel"], ["reclaim-named-death-dragon-ban", "ban"], ["reclaim-named-death-griffin", "decline"], ["reclaim-named-death-griffin-cancel", "cancel"], ["reclaim-named-death-griffin-ban", "ban"], ["reclaim-named-death-skeleton", "decline"], ["reclaim-named-death-skeleton-cancel", "cancel"], ["reclaim-named-death-skeleton-ban", "ban"], ["reclaim-named-death-zombie", "decline"], ["reclaim-named-death-zombie-cancel", "cancel"], ["reclaim-named-death-zombie-ban", "ban"], ["reclaim-named-death-wight", "decline"], ["reclaim-named-death-wight-cancel", "cancel"], ["reclaim-named-death-wight-ban", "ban"], ["reclaim-named-death-knight", "decline"], ["reclaim-named-death-knight-cancel", "cancel"], ["reclaim-named-death-knight-ban", "ban"]] as const)('%s preserves the actual %s result through eviction and ACK replay',async(scenario,mode)=>{
 const room=await openTestRoom(scenario),base=scenario.replace(/-(cancel|ban)$/,'') as NamedDeathScenario,[ability,name]=namedDeathCases[base],initial=await game(room),card=initial.players.A!.followers.find(f=>getAction(f.cardInstanceId)!.name===name)!.cardInstanceId;
 await until(room,s=>viewFor(s,'A').reclaim?.cardInstanceId===card,'death');await room.restart();
 const d=viewFor(await game(room),'A').reclaim!,claim=d.claims.find(c=>c.right==='unlimited')!;
 const chosen=await send(room,'A','choose',mode==='decline'?{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'decline'}:{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:claim.claimId});await replay(room,chosen);
 if(mode!=='decline'){
  const actor=mode==='cancel'?'B':'C';await until(room,s=>s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]===actor,'respond');
  const s=await game(room),frame=Object.values(s.abilities!).find(f=>f.abilityId===ability)!;
  if(mode==='cancel')await replay(room,await send(room,actor,'cancel',{type:'PLAY_REACTION',cardInstanceId:s.players.B!.hand.find(id=>getAction(id)!.name==='命運凶変')!,mode:'cancel-ability',targetAbilityId:frame.id}));
  else {const option=viewFor(s,actor).abilityOptions.find(o=>o.abilityId==='c2-p07-r1c2-ab03')!;await replay(room,await send(room,actor,'ban',{type:'USE_ABILITY',abilityId:option.abilityId,targetEventId:option.targetEventId,targetIds:['A']}));}
 }
 await until(room,s=>!s.windows?.length,'finish');await replay(room,chosen);
 const final=await game(room);expect(final.players.A!.hand).not.toContain(card);expect(final.discard.filter(c=>c===card)).toHaveLength(1);expect(final.reclaimReservations).not.toContain(card);
 expect(final.players.A!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);expect(final.reclaimDecisions!.find(x=>x.id===d.decisionId)!.attemptedClaimIds).toHaveLength(mode==='decline'?0:1);
 if(mode==='ban')expect(final.suppressionDesignations?.some(x=>x.sourceActorId==='C'&&x.targetId==='A')).toBe(true);
});
