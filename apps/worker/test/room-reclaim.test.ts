import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameState} from '@madou/engine';
import {getAction,actionCards} from '@madou/catalog';
import type {ClientEnvelope,GameCommand} from '@madou/protocol';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
type Room=Awaited<ReturnType<typeof openTestRoom>>;
const game=async(room:Room)=>(await room.stored()).state.game!;
async function send(room:Room,actorId:string,id:string,command:GameCommand) {
  const saved=await room.stored();
  const envelope:ClientEnvelope={protocolVersion:1,commandId:id,expectedRevision:saved.revision,...activeWindowRef(saved.state.game!)!,command};
  const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});
  expect(new Set(allCardInstanceIds(await game(room))).size).toBe(220);
  return {actorId,envelope,ack};
}
async function replay(room:Room,sent:Awaited<ReturnType<typeof send>>) {
  const before=await room.stored();await room.restart();
  expect(await room.command(sent.actorId,sent.envelope)).toEqual(sent.ack);expect(await room.stored()).toEqual(before);
}
async function until(room:Room,done:(s:GameState)=>boolean,prefix:string) {
  for(let n=0;n<150;n++){const s=await game(room);if(done(s))return;const w=s.windows!.at(-1)!;await send(room,w.participants[w.cursor]!,`${prefix}-${n}`,{type:'PASS'});}
  throw Error('RECLAIM_WORKER_LIMIT');
}
async function heal(room:Room) {
  const id=(await game(room)).players.A!.hand.find(id=>getAction(id)?.name==='封傷')!;
  return send(room,'A','heal',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:id,targetIds:['A'],dedicated:false});
}
it('sword discard occurrence survives hidden claimant reveal and duplicate accepted take',async()=>{
  const room=await openTestRoom('reclaim-sword-discard'),sword='a2-p04-r2c1';await send(room,'A','end-action',{type:'PASS_ACTION'});
  const s=await game(room),excess=s.players.A!.hand.length-viewFor(s,'A').self.stats.handLimit;
  await replay(room,await send(room,'A','discard-sword',{type:'END_TURN',discardIds:[sword,...s.players.A!.hand.filter(id=>id!==sword)].slice(0,excess)}));
  const occurrence=(await game(room)).discardOccurrences![0]!;expect(occurrence).toMatchObject({origin:{zone:'hand',ownerId:'A'},stage:'open'});
  for(const actor of ['A','B'])await send(room,actor,`pass-${actor}`,{type:'PASS'});
  const w=(await game(room)).windows!.at(-1)!;expect((await room.snapshotFor('C')).game!.reclaim!.claims).toEqual([]);
  await replay(room,await send(room,'C','reveal-cham',{type:'REVEAL_CHARACTER'}));expect((await game(room)).windows!.at(-1)).toEqual(w);
  const d=(await room.snapshotFor('C')).game!.reclaim!;
  const take=await send(room,'C','take-sword',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId});await replay(room,take);
  const done=await game(room);expect(done.players.C!.hand.filter(id=>id===sword)).toHaveLength(1);expect(done.resolution).not.toContain(sword);expect(done.discard).not.toContain(sword);
  expect(done.discardOccurrences).toHaveLength(1);expect(done.discardOccurrences![0]).toMatchObject({id:occurrence.id,stage:'closed'});expect(done.turnSeat).toBe(1);
});
it('actual sword installation persists its paid source and completes once after reload',async()=>{
  const room=await openTestRoom('reclaim-sword-install'),sword='a2-p04-r2c1';
  const declared=await send(room,'A','install',{type:'PLAY_TURN_CARD',cardInstanceId:sword});await replay(room,declared);
  expect((await game(room)).resolution).toContain(sword);expect((await game(room)).players.A!.attachments).not.toContain(sword);
  await until(room,s=>!s.windows?.length,'install-response');await replay(room,declared);
  expect((await game(room)).players.A!.attachments).toEqual([sword]);expect((await game(room)).phase).toBe('hand-adjustment');
});
it.each(['combination-advances','combination-hit-advance'] as const)('%s retains paid cost sources and saved parent across replay',async scenario=>{
  const room=await openTestRoom(scenario),initial=await game(room),cost='a2-p23-r1c2';
  const command:GameCommand=scenario==='combination-advances'?{type:'ATTACK',cardInstanceId:'a2-p09-r2c1',dedicated:true,targetIds:['B'],advanceCardInstanceIds:[cost]}:
    {type:'PAY_HIT_ADVANCES',groupId:initial.windows!.at(-1)!.continuation.id,cardInstanceIds:[cost]};
  const receipt=await send(room,'A','cost',command);await replay(room,receipt);
  const pending=await game(room);expect(pending.windows!.at(-1)!.kind).toBe('reclaim');expect(pending.resolution).toContain(cost);expect(pending.players.A!.hand).not.toContain(cost);
  expect(pending.reclaimDecisions!.at(-1)!.source).toMatchObject({usedModeName:'advance',sourceActorId:'A'});
  await until(room,s=>s.windows?.at(-1)?.kind!=='reclaim','cost-responses');
  expect((await game(room)).windows!.at(-1)!.kind).toBe(scenario==='combination-advances'?'declaration':'hit');
  await until(room,s=>!s.windows?.length,'cost-parent');await replay(room,receipt);
  const final=await game(room);expect(final.discard.filter(id=>id===cost)).toHaveLength(1);expect(final.reclaimDecisions!.filter(d=>d.cardInstanceId===cost)).toHaveLength(1);
  if(scenario==='combination-hit-advance')expect(final.players.B!.damage).toBe(20);
});
it('combat maai and advance keep their parent response and exact payment through restart and replay',async()=>{
  const room=await openTestRoom('property-lancaster');await until(room,s=>s.windows?.at(-1)?.kind==='normal-defense','to-defense');
  const initial=await game(room),cards=initial.players.B!.hand.filter(id=>getAction(id)?.modes?.some(m=>m.playMode==='distance'));
  const push=initial.players.A!.hand.find(id=>getAction(id)?.name==='踏み込み／殴る')!;
  for(let n=0;n<2;n++){
    await replay(room,await send(room,'B',`maai-${n}`,{type:'PLAY_MAAI',cardInstanceId:cards[n]!}));
    const s=await game(room);expect(s.windows!.at(-1)!.kind).toBe('reclaim');expect(s.resolution).toContain(cards[n]!);
    expect((await room.snapshotFor('B')).game!.reclaim!.claims).toEqual([]);
    await until(room,s=>s.windows?.at(-1)?.kind!=='reclaim',`decline-maai-${n}`);
    expect((await room.snapshotFor('B')).game!.maaiDefense!.targets[0]!.submitted).toBe(n+1);
  }
  const receipt=await send(room,'A','push',{type:'PLAY_ADVANCE',cardInstanceId:push});await replay(room,receipt);
  expect((await game(room)).reclaimDecisions!.at(-1)!.source).toMatchObject({sourceActorId:'A',usedModeName:'advance'});
  await until(room,s=>s.windows?.at(-1)?.kind!=='reclaim','decline-push');
  expect((await room.snapshotFor('A')).game!.maaiDefense!.sharedAdvances).toBe(1);
  await until(room,s=>!s.windows?.length,'finish-maai');await replay(room,receipt);
  for(const id of [...cards.slice(0,2),push])expect((await game(room)).discard.filter(c=>c===id)).toHaveLength(1);
});
it('distance payments preserve payer and mode across DO reload without spending owned recovery',async()=>{
  const room=await openTestRoom('reclaim-distance'),s=await game(room);
  const advance=s.players.A!.hand.find(id=>getAction(id)?.name==='踏み込み／蹴る')!,maai=s.players.B!.hand.find(id=>getAction(id)?.name==='間合い／休息')!;
  await send(room,'A','approach',{type:'APPROACH',targetId:'B',cardInstanceId:advance});
  await send(room,'B','maai',{type:'PLAY_MAAI',cardInstanceId:maai});
  await replay(room,await send(room,'A','stop-approach',{type:'PASS'}));
  expect((await game(room)).reclaimDecisions!.at(-1)!.source).toMatchObject({sourceActorId:'A',usedModeName:'advance'});
  await until(room,s=>s.reclaimDecisions!.at(-1)!.cardInstanceId===maai,'first-source');
  const saved=await room.stored();await room.restart();expect(await room.stored()).toEqual(saved);
  expect((await game(room)).reclaimDecisions!.at(-1)!.source).toMatchObject({sourceActorId:'B',usedModeName:'distance'});
  await until(room,s=>!s.windows?.length,'second-source');
  const final=await game(room);expect(final.phase).toBe('action');expect(final.distances.A!.B).toBe('far');
  expect(final.players.A!.reclaimUsage?.['踏み込み／蹴る']).toBeUndefined();expect(final.discard).toEqual(expect.arrayContaining([advance,maai]));
});
it.each(['reclaim-courage','reclaim-courage-fail'] as const)('%s resumes the actual printed check and delivers only to the original user',async scenario=>{
  const room=await openTestRoom(scenario),option=viewFor(await game(room),'A').anytimeCardOptions[0]!;
  await replay(room,await send(room,'A','courage',{type:'PLAY_ANYTIME_CARD',cardInstanceId:option.cardInstanceId,targetEventId:option.targetEventId}));
  await until(room,s=>s.windows?.at(-1)?.kind==='reclaim','courage-resolve');
  await send(room,'A','decline-a',{type:'PASS'});await send(room,'B','decline-b',{type:'PASS'});
  const prefix=(await game(room)).windows!.at(-1)!;
  expect((await room.snapshotFor('C')).game!.reclaim!.claims).toEqual([]);
  await replay(room,await send(room,'C','reveal',{type:'REVEAL_CHARACTER'}));
  expect((await game(room)).windows!.at(-1)).toEqual(prefix);
  const d=(await room.snapshotFor('C')).game!.reclaim!;
  const requested=await send(room,'C','request-check',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'request-check',claimId:d.claims[0]!.claimId});
  await replay(room,requested);
  await until(room,s=>s.rolls?.at(-1)?.resume.kind==='reclaim-check'&&s.rolls.at(-1)?.stage==='after-roll','courage-roll');
  const rolled=(await game(room)).rolls!.at(-1)!;await room.restart();expect((await game(room)).rolls!.at(-1)).toEqual(rolled);
  expect(rolled).toMatchObject({rollerId:'C',formula:'2d6',modifier:0,success:scenario==='reclaim-courage'});
  await until(room,s=>s.windows?.at(-1)?.kind==='reclaim','check-finish');
  if(scenario==='reclaim-courage'){
    const take=(await room.snapshotFor('A')).game!.reclaim!;expect(take.stage).toBe('beneficiary-choice');
    expect((await room.snapshotFor('C')).game!.reclaim!.claims).toEqual([]);
    await replay(room,await send(room,'A','take-courage',{type:'CHOOSE_RECLAIM',decisionId:take.decisionId,choice:'take',claimId:take.claims[0]!.claimId}));
    expect((await game(room)).reclaimReservations).toContain('a2-p01-r3c3');
  }else expect((await room.snapshotFor('D')).game!.reclaim!.pendingActorId).toBe('D');
  await until(room,s=>!s.windows?.length,'finish-courage');
  const final=await game(room);
  expect(final.players.A!.hand.includes('a2-p01-r3c3')).toBe(scenario==='reclaim-courage');expect(final.players.C!.hand).not.toContain('a2-p01-r3c3');
  expect(final.rolls!.filter(r=>r.resume.kind==='reclaim-check')).toHaveLength(1);
  expect(final.players.A!.reclaimUsage?.['勇気']).toBeUndefined();expect(final.players.C!.reclaimUsage?.['勇気']).toBeUndefined();
});
it('actual recovery decision and name budget survive reload and duplicate accepted command',async()=>{
  const room=await openTestRoom('reclaim-owned');await replay(room,await heal(room));
  await until(room,s=>s.windows?.at(-1)?.kind==='reclaim','resolve');
  const initial=await room.stored();await room.restart();expect(await room.stored()).toEqual(initial);
  const d=viewFor(await game(room),'A').reclaim!;
  for(const id of ['B','C','D'])expect((await room.snapshotFor(id)).game!.reclaim!.claims).toEqual([]);
  const result=await send(room,'A','take',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId});await replay(room,result);
  const s=await game(room);expect(s.players.A!.hand).toContain(d.cardInstanceId);expect(s.players.A!.reclaimUsage?.['封傷']?.baseSpent).toBe(true);expect(s.phase).toBe('hand-adjustment');
  const before=await room.stored();expect(await room.command('A',{...result.envelope,commandId:'stale-take'})).toMatchObject({type:'error'});expect(await room.stored()).toEqual(before);
});
it('zero-right and owned worlds retain the same all-seat schedule through disconnect and explicit passes',async()=>{
  const owner=await openTestRoom('reclaim-owned'),none=await openTestRoom('reclaim-unowned');
  await heal(owner);await heal(none);
  await until(owner,s=>s.windows?.at(-1)?.kind==='reclaim','resolve');await until(none,s=>s.windows?.at(-1)?.kind==='reclaim','resolve');
  for(let n=0;n<4;n++) {
    for(const id of ['B','C','D'])expect((await owner.snapshotFor(id)).game).toEqual((await none.snapshotFor(id)).game);
    const before=await none.stored();await none.restart();expect(await none.stored()).toEqual(before);
    const s=await game(owner),w=s.windows!.at(-1)!,actorId=w.participants[w.cursor]!;
    const a=await send(owner,actorId,`pass-${n}`,{type:'PASS'}),b=await send(none,actorId,`pass-${n}`,{type:'PASS'});expect(b.ack).toEqual(a.ack);await replay(owner,a);await replay(none,b);for(const room of [owner,none])expect(allCardInstanceIds(await game(room)).sort()).toEqual(actionCards.map(c=>c.id).sort());
  }
  expect((await game(owner)).phase).toBe('hand-adjustment');expect((await game(none)).phase).toBe('hand-adjustment');
  for(const id of ['B','C','D'])expect((await owner.snapshotFor(id)).game).toEqual((await none.snapshotFor(id)).game);for(const room of [owner,none]){const s=await game(room);expect(s.windows??[]).toEqual([]);expect(s.resolution).toEqual([]);expect(s.reclaimReservations).toEqual([]);expect(Object.values(s.actions??{})).toEqual([]);expect(s.lifecycle??[]).toEqual([]);}
});
it('a reclaimed cancellation stays reserved across parent reload and returns once after all source decisions',async()=>{
  const room=await openTestRoom('reclaim-owned');await heal(room);await send(room,'A','first-pass',{type:'PASS'});
  const parent=viewFor(await game(room),'B').reactionTargetActionId!;
  await send(room,'B','cancel',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:parent});
  await until(room,s=>s.windows?.at(-1)?.kind==='reclaim','cancel-resolve');
  const d=viewFor(await game(room),'B').reclaim!;
  expect(d.claims).toHaveLength(1);
  const chosen=await send(room,'B','take-cancel',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId});await replay(room,chosen);
  expect((await room.snapshotFor('B')).game!.reservedCards).toEqual(['a2-p02-r2c3']);
  expect((await game(room)).players.B!.hand).not.toContain('a2-p02-r2c3');
  await until(room,s=>!s.windows?.length,'finish');
  expect((await game(room)).players.B!.hand.filter(id=>id==='a2-p02-r2c3')).toHaveLength(1);
  expect((await game(room)).reclaimReservations).toEqual([]);
});
it.each(['rest','potion'] as const)('actual %s batch keeps its next physical child through cancellation, eviction and replay',async kind=>{
 const room=await openTestRoom(kind==='rest'?'reclaim-rest':'reclaim-potion');const initial=await game(room);
 const cards=initial.players.A!.hand.filter(id=>getAction(id)?.name===(kind==='rest'?'間合い／休息':'回復の薬')).slice(0,2);expect(cards).toHaveLength(2);
 const paid=await send(room,'A','utility-pay',kind==='rest'?{type:'REST',cardInstanceIds:cards}:{type:'PLAY_TURN_CARD',cardInstanceIds:cards});
 await replay(room,paid);let s=await game(room);expect(s.resolution).toEqual(expect.arrayContaining(cards));expect(s.players.A!.damage).toBe(8);
 const first=Object.values(s.actions!)[0]!.id;await until(room,s=>s.windows?.at(-1)?.participants[s.windows!.at(-1)!.cursor]==='B','utility-to-B');
 const fate=s.players.B!.hand.find(id=>getAction(id)?.name==='命運凶変')!;
 const canceled=await send(room,'B','utility-cancel',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:first});await replay(room,canceled);
 await until(room,s=>Object.values(s.actions??{}).some(a=>a.cardInstanceId===cards[1]),'utility-to-next');s=await game(room);
 expect(s.players.A!.damage).toBe(8);expect(s.discard.filter(id=>id===cards[0])).toHaveLength(1);const pending=await room.stored();await room.restart();expect(await room.stored()).toEqual(pending);
 if(kind==='potion'){
  await until(room,s=>s.rolls?.some(r=>r.purpose==='potion-recovery')===true,'utility-roll');const rolled=await room.stored();await room.restart();expect(await room.stored()).toEqual(rolled);
 }
 await until(room,s=>!s.windows?.length,'utility-finish');s=await game(room);
 const recovered=kind==='rest'?1:s.rolls!.find(r=>r.purpose==='potion-recovery')!.total!;
 expect(s.players.A!.damage).toBe(Math.max(0,8-recovered));expect(s.phase).toBe('hand-adjustment');
 for(const card of cards)expect(s.discard.filter(id=>id===card)).toHaveLength(1);
 expect(s.rolls?.filter(r=>r.purpose==='potion-recovery')??[]).toHaveLength(kind==='potion'?1:0);
 await replay(room,paid);
});
it.each(['book','training','dedicated','crown','crystal'] as const)('actual early-turn %s saves its source declaration and final outcome through eviction and receipt replay',async kind=>{
 const room=await openTestRoom('reclaim-early');const initial=await game(room),card=kind==='book'?'a2-p03-r1c1':kind==='crown'?'a2-p03-r1c2':kind==='crystal'?'a2-p03-r1c3':'a2-p03-r2c2';
 const paid=await send(room,'A','early-pay',{type:'PLAY_TURN_CARD',cardInstanceId:card,...(kind==='dedicated'?{mode:'dedicated' as const}:{})});
 await replay(room,paid);expect((await game(room)).resolution).toContain(card);
 if(kind==='training'||kind==='book'){
  await until(room,s=>s.rolls?.some(r=>r.purpose===(kind==='book'?'extra-draw':'training'))===true,'early-roll');
  const waiting=await room.stored();await room.restart();expect(await room.stored()).toEqual(waiting);
 }
 await until(room,s=>!s.windows?.length,'early-finish');const done=await game(room);await replay(room,paid);
 expect(done.phase).toBe(kind==='book'?'action':'hand-adjustment');
 if(kind==='book'){
  const r=done.rolls!.find(r=>r.purpose==='extra-draw')!;expect(done.players.A!.hand).toHaveLength(initial.players.A!.hand.length-1+r.total!);
  expect(done.discard).toContain(card);expect((await room.snapshotFor('A')).game!.turnCardOptions.some(o=>o.cardInstanceId==='a2-p03-r1c1')).toBe(false);
 }else if(kind==='training'){
  const r=done.rolls!.find(r=>r.purpose==='training')!;expect(r.comparison).toBe('greater-than');expect(done.players.A!.attachments.includes(card)).toBe(r.success);
 }else{expect(done.players.A!.attachments).toContain(card);expect(done.rolls?.length??0).toBe(0);}
});
it.each(['good','evil','exchange','identity','astrology','mother'] as const)('actual targeted %s preserves private results and effect across eviction and duplicate receipt',async kind=>{
 const room=await openTestRoom('reclaim-choices'),initial=await game(room);
 const card=kind==='good'?'a2-p04-r1c1':kind==='evil'?'a2-p04-r1c2':kind==='exchange'?'a2-p04-r1c3':kind==='mother'?'a2-p05-r1c2':'a2-p04-r2c2';
 const paid=await send(room,'A','choice-pay',{type:'PLAY_TURN_CARD',cardInstanceId:card,targetId:kind==='identity'?'D':'B',mode:kind==='astrology'?'astrology':'ordinary'});await replay(room,paid);
 if(kind==='identity'||kind==='astrology'){
  await until(room,s=>s.windows?.at(-1)?.kind==='private-inspection','choice-inspect');const saved=await room.stored();await room.restart();expect(await room.stored()).toEqual(saved);
  const own=(await room.snapshotFor('A')).game!,other=(await room.snapshotFor('C')).game!;expect(own.inspection?.zone).toBe(kind==='identity'?'character':'hand');expect(other.inspection).toBeNull();
  if(kind==='identity'){expect(own.inspection!.characterId).toBe(initial.players.D!.characterId);expect(other.players.D).not.toHaveProperty('characterId');}
  const d=own.inspection!,discard=kind==='astrology'?d.cards[0]!.cardInstanceId:undefined;
  const chosen=await send(room,'A','choice-confirm',{type:'CHOOSE_INSPECTION',decisionId:d.decisionId,choice:discard?'discard-one':'finish',...(discard?{cardInstanceId:discard}:{})});await replay(room,chosen);
  if(discard)expect((await game(room)).discard).toContain(discard);
 }
 else if(kind==='good'||kind==='evil'){
  await until(room,s=>s.rolls?.at(-1)?.stage==='after-roll','choice-roll');const saved=await room.stored();await room.restart();expect(await room.stored()).toEqual(saved);
 }
 await until(room,s=>!s.windows?.length,'choice-finish');const s=await game(room);await replay(room,paid);expect(s.phase).toBe('hand-adjustment');
 if(kind==='exchange'){expect(s.players.A!.hand).toEqual(initial.players.B!.hand);expect(s.players.B!.hand).toEqual(initial.players.A!.hand.filter(id=>id!==card));}
 if(kind==='mother')expect(s.players.B!.attachments).toContain(card);
 if(kind==='mother'||kind==='good'||kind==='evil')expect(s.players.B!.faction).toBe(kind==='evil'?'EVIL':'GOOD');
 if(kind==='identity')expect((await room.snapshotFor('A')).game!.privateLogs.some(e=>e.type==='CHARACTER_INSPECTED')).toBe(true);
});
it.each(['tragedy','keil','hostage','amulet'] as const)('actual named anytime %s saves paid child, refill and single scope after eviction',async kind=>{
 const room=await openTestRoom(`reclaim-${kind}`),owner=kind==='amulet'?'A':'B',initial=await game(room),option=viewFor(initial,owner).anytimeCardOptions[0]!;
 const paid=await send(room,owner,'named-pay',{type:'PLAY_ANYTIME_CARD',cardInstanceId:option.cardInstanceId,targetEventId:option.targetEventId,...(option.targetId?{targetId:option.targetId}:{})});await replay(room,paid);
 const s=await game(room);expect(s.resolution).toContain(option.cardInstanceId);expect(s.players[owner]!.hand).toHaveLength(initial.players[owner]!.hand.length);
 await until(room,s=>!s.windows?.length,'named-finish');const done=await game(room);await replay(room,paid);
 if(kind!=='amulet'){expect(done.players.B!.damage).toBe(0);expect(done.players.C!.damage).toBe(kind==='keil'?15:0);}
 if(kind==='keil')expect(done.players.B!.permanent?.spirit).toBe(1);
 if(kind==='amulet')expect(done.rolls?.filter(r=>r.purpose==='ability-check')??[]).toHaveLength(0);
});
it('actual public Cham card response survives eviction under ability prohibition and resumes the hostage parent once',async()=>{
 const room=await openTestRoom('reclaim-hostage'),o=viewFor(await game(room),'B').anytimeCardOptions[0]!;
 await send(room,'B','hostage',{type:'PLAY_ANYTIME_CARD',cardInstanceId:o.cardInstanceId,targetEventId:o.targetEventId});
 await until(room,s=>s.windows?.at(-1)?.participants[s.windows!.at(-1)!.cursor]==='C','cham-slot');await send(room,'C','cham-reveal',{type:'REVEAL_CHARACTER'});
 const response=viewFor(await game(room),'C').abilityOptions.find(o=>o.name==='人質を中止する')!;
 const chosen=await send(room,'C','cham-cancel',{type:'USE_ABILITY',abilityId:response.abilityId,targetEventId:response.targetEventId});await replay(room,chosen);
 await until(room,s=>!s.windows?.length,'cham-finish');const done=await game(room);expect(done.players.B!.damage).toBe(21);expect(done.players.C!.damage).toBe(0);expect(done.discard).toContain('a2-p02-r2c2');await replay(room,chosen);
});
it.each(['peace','revelation'] as const)('actual information anytime %s survives eviction with its saved private choice or public expiry',async kind=>{
 const room=await openTestRoom(`reclaim-${kind}`),initial=await game(room),card=kind==='peace'?'a2-p02-r1c1':'a2-p02-r1c2',o=viewFor(initial,'A').anytimeCardOptions.find(o=>o.cardInstanceId===card&&o.targetId==='B')!;
 const paid=await send(room,'A','info-pay',{type:'PLAY_ANYTIME_CARD',cardInstanceId:card,targetEventId:o.targetEventId,targetId:'B'});await replay(room,paid);
 if(kind==='revelation'){
  await until(room,s=>s.windows?.at(-1)?.kind==='private-inspection','info-inspect');const before=await room.stored();await room.restart();expect(await room.stored()).toEqual(before);
  const d=(await room.snapshotFor('A')).game!.inspection!;expect(d.zone).toBe('all');expect(new Set(d.cards.map(c=>c.zone))).toEqual(new Set(['hand','followers','chants']));expect((await room.snapshotFor('C')).game!.inspection).toBeNull();
  await replay(room,await send(room,'A','info-confirm',{type:'CHOOSE_INSPECTION',decisionId:d.decisionId,choice:'finish'}));
 }
 await until(room,s=>!s.windows?.length,'info-finish');expect((await game(room)).phase).toBe('action');await replay(room,paid);
 if(kind==='revelation'){expect((await room.snapshotFor('A')).game!.inspectionHistory).toHaveLength(1);expect((await room.snapshotFor('C')).game!.inspectionHistory).toEqual([]);expect((await game(room)).players.B).toEqual(initial.players.B);}
 else{
  expect((await room.snapshotFor('B')).game!.self.stats.spirit).toBe(12);expect((await room.snapshotFor('C')).game!.peaceExpiries).toEqual([{targetId:'B',timing:'next-own-action'}]);
  await send(room,'A','info-pass',{type:'PASS_ACTION'});await send(room,'A','info-end',{type:'END_TURN',discardIds:[]});await send(room,'B','info-start',{type:'START_TURN'});await send(room,'B','info-draw',{type:'CHOOSE_DRAW',draw:false});
  const end=await send(room,'B','info-expire',{type:'PASS_ACTION'});await replay(room,end);expect((await room.snapshotFor('C')).game!.peaceExpiries).toEqual([]);
 }
});

it.each([false,true])('actual pre-attack Dispel cancellation=%s persists both payments and resumes the committed attack once',async cancel=>{
 const room=await openTestRoom('reclaim-dispel'),initial=await game(room),attack=initial.players.A!.hand.find(id=>getAction(id)?.name==='踏み込み／弓')!;
 const paid=await send(room,'A','dispel-pay',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false,dispel:{cardInstanceId:'a2-p02-r3c1',targetId:'B'}});await replay(room,paid);
 expect((await game(room)).players.A!.hand).toHaveLength(initial.players.A!.hand.length-2);expect((await game(room)).deck).toEqual(initial.deck);
 if(cancel){const child=viewFor(await game(room),'B').reactionTargetActionId!,fate=initial.players.B!.hand.find(id=>getAction(id)?.name==='命運凶変')!;await replay(room,await send(room,'B','dispel-cancel',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:child}));}
 else{await until(room,s=>s.windows?.at(-1)?.kind==='reclaim','dispel-dispose');const saved=await room.stored();await room.restart();expect(await room.stored()).toEqual(saved);}
 await until(room,s=>s.windows?.at(-1)?.kind==='attack-abilities','dispel-parent');const s=await game(room);expect(s.players.B!.followers).toHaveLength(cancel?2:1);expect(Object.keys(s.groups!)).toHaveLength(1);expect(s.discard).toContain('a2-p02-r3c1');
 if(!cancel){const other=(await room.snapshotFor('C')).game!;expect(other.players.B!.followers).toEqual([{position:0,face:'back'}]);expect(other.logs.filter(e=>e.type==='FOLLOWER_DESTROYED').map(e=>e.cardInstanceId)).toEqual(['a2-p19-r2c3']);}
 await until(room,s=>!s.windows?.length,'dispel-finish');await replay(room,paid);expect((await game(room)).phase).toBe('withdrawal');expect((await game(room)).discard).toContain(attack);
});

it.each([false,true])('actual substitute cancellation=%s saves one exact hit, refills once and returns to its two-target three-hit parent',async cancel=>{
 const room=await openTestRoom('reclaim-substitute'),initial=await game(room),o=viewFor(initial,'C').anytimeCardOptions.find(o=>o.cardInstanceId==='a2-p02-r2c1'&&o.hitIndex===1)!;
 const paid=await send(room,'C','substitute-pay',{type:'PLAY_ANYTIME_CARD',cardInstanceId:o.cardInstanceId,targetEventId:o.targetEventId,targetId:o.targetId!,groupId:o.groupId!,hitIndex:o.hitIndex!});await replay(room,paid);
 expect((await game(room)).players.C!.hand).toHaveLength(initial.players.C!.hand.length);
 if(cancel){const target=viewFor(await game(room),'D').reactionTargetActionId!,fate=initial.players.D!.hand.find(id=>getAction(id)?.name==='命運凶変')!;await replay(room,await send(room,'D','substitute-cancel',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:target}));}
 else{
  await until(room,s=>s.windows?.at(-1)?.kind==='normal-defense'&&s.windows.at(-1)!.participants[0]==='C','substitute-response');const saved=await room.stored();await room.restart();expect(await room.stored()).toEqual(saved);
  const v=(await room.snapshotFor('C')).game!;expect(v.currentAttack!.substitution).toEqual({originalTargetId:'B',originalHitIndex:1});expect(v.legalChoices).not.toContain('START_FOLLOWERS');expect(v.legalChoices).not.toContain('PLAY_MAAI');expect(v.anytimeCardOptions).toEqual([]);
  expect((await room.snapshotFor('D')).game!.players.C).not.toHaveProperty('characterId');
 }
 await until(room,s=>!s.windows?.length,'substitute-finish');await replay(room,paid);const done=await game(room);expect(done.players.B!.damage).toBe(cancel?21:14);expect(done.players.C!.damage).toBe(cancel?21:28);expect(done.discard).toContain('a2-p02-r2c1');expect(done.phase).toBe('withdrawal');
});

it('actual substitute refill OPEN pauses before declaration and survives repeated receipts at both OPEN and response',async()=>{
 const room=await openTestRoom('reclaim-substitute-open'),initial=await game(room),o=viewFor(initial,'C').anytimeCardOptions.find(o=>o.cardInstanceId==='a2-p02-r2c1'&&o.hitIndex===1)!;
 const paid=await send(room,'C','open-substitute',{type:'PLAY_ANYTIME_CARD',cardInstanceId:o.cardInstanceId,targetEventId:o.targetEventId,targetId:o.targetId!,groupId:o.groupId!,hitIndex:o.hitIndex!});await replay(room,paid);
 let s=await game(room);expect(s.windows!.at(-1)!.kind).toBe('before-roll');expect(s.players.C!.open).toContain('a2-p01-r1c1');expect(Object.values(s.actions!).find(a=>a.cardInstanceId===o.cardInstanceId)!.substituteBinding).toMatchObject({targetId:'B',hitIndex:1});
 await until(room,s=>s.windows?.at(-1)?.kind==='after-roll','open-rolled');await replay(room,paid);
 await until(room,s=>['revival','declaration'].includes(s.windows?.at(-1)?.kind??''),'open-choice');
 if((await game(room)).windows!.at(-1)!.kind==='revival')await replay(room,await send(room,'D','open-decline',{type:'CHOOSE_REVIVAL',revive:false}));
 await until(room,s=>!!s.groups?.[s.windows!.at(-1)!.continuation.id]?.substituteOrigin&&s.windows?.at(-1)?.kind==='normal-defense','open-response');const saved=await room.stored();await room.restart();expect(await room.stored()).toEqual(saved);
 await until(room,s=>!s.windows?.length,'open-finish');await replay(room,paid);s=await game(room);expect(s.players.B!.damage).toBe(14);expect(s.players.C!.damage).toBe(28);expect(s.players.C!.hand).toHaveLength(initial.players.C!.hand.length);expect(s.events.filter(e=>e.type==='OPEN'&&e.cardInstanceId==='a2-p01-r1c1')).toHaveLength(1);
});

it.each([['reclaim-extra','extra'],['reclaim-unlimited','unlimited']] as const)('%s persists a cancellable reuse declaration and consumes only the elected budget',async(scenario,right)=>{
 for(const cancel of [false,true]){const room=await openTestRoom(scenario),s=await game(room),name=right==='extra'?'踏み込み／弓':'破山剣',card=s.players.A!.hand.find(id=>getAction(id)?.name===name)!;await send(room,'A','reuse-attack',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});await until(room,s=>s.windows?.at(-1)?.kind==='reclaim','reuse-offer');const d=viewFor(await game(room),'A').reclaim!,claim=d.claims.find(c=>c.right===right)!;const selected=await send(room,'A','reuse-select',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:claim.claimId});await replay(room,selected);expect((await game(room)).resolution).toContain(card);expect((await room.snapshotFor('B')).game!.reclaim!.claims).toEqual([]);
 if(cancel){await until(room,s=>s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]==='B','reuse-cancel-slot');const now=await game(room),fate=now.players.B!.hand.find(id=>getAction(id)?.name==='命運凶変')!;await replay(room,await send(room,'B','reuse-cancel',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(now,'B').reactionTargetAbilityId!}));}
 await until(room,s=>!s.windows?.length,'reuse-finish');await replay(room,selected);const final=await game(room);expect(final.players.A!.hand.includes(card)).toBe(!cancel);expect(final.players.A!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);if(right==='extra')expect(final.players.A!.reclaimUsage?.[name]?.extraSpentByAbility).toHaveLength(1);expect(final.reclaimDecisions!.find(x=>x.id===d.decisionId)!.attemptedClaimIds).toHaveLength(1);}
});

it('successful Courage beneficiary decline survives eviction and ACK replay without skipping D',async()=>{
 const room=await openTestRoom('reclaim-courage'),option=viewFor(await game(room),'A').anytimeCardOptions[0]!;
 await send(room,'A','courage-decline-source',{type:'PLAY_ANYTIME_CARD',cardInstanceId:option.cardInstanceId,targetEventId:option.targetEventId});
 await until(room,s=>s.windows?.at(-1)?.kind==='reclaim','decline-source');
 await send(room,'A','pass-a',{type:'PASS'});await send(room,'B','pass-b',{type:'PASS'});
 await send(room,'C','reveal-checker',{type:'REVEAL_CHARACTER'});
 const d=viewFor(await game(room),'C').reclaim!;
 await send(room,'C','check',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'request-check',claimId:d.claims[0]!.claimId});
 await until(room,s=>viewFor(s,'A').reclaim?.stage==='beneficiary-choice','check-success');
 await room.restart();
 const declined=await send(room,'A','decline-beneficiary',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'decline'});
 await replay(room,declined);
 for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game!.reclaim).toMatchObject({decisionId:d.decisionId,stage:'responses',pendingActorId:'D'});
 expect((await game(room)).resolution).toContain(option.cardInstanceId);
 await replay(room,await send(room,'D','pass-last',{type:'PASS'}));
 expect((await game(room)).reclaimDecisions!.find(x=>x.id===d.decisionId)!.stage).toBe('closed');
 await until(room,s=>!s.windows?.length,'decline-finish');
 const final=await game(room);expect(final.discard.filter(id=>id===option.cardInstanceId)).toHaveLength(1);
 expect(final.players.A!.hand).not.toContain(option.cardInstanceId);expect(final.players.A!.reclaimUsage?.['勇気']).toBeUndefined();
});
