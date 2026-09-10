import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
import {actionCards} from '@madou/catalog';
afterEach(async()=>{await reset();});
it.each([['r5-distance-approach',false],['r5-distance-withdrawal',false],['r5-distance-approach',true],['r5-distance-withdrawal',true]] as const)('%s exchange cancel=%s preserves partial response and receipts through DO restart',async(name,cancel)=>{
 const room=await openTestRoom(name),withdraw=name.endsWith('withdrawal'),owner=withdraw?'A':'B',other=withdraw?'B':'A',kind=withdraw?'withdrawal':'approach',abilityId=withdraw?'c2-p02-r1c1-ab01':'c2-p01-r2c2-ab01';let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`exchange-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const ids=allCardInstanceIds(await game());expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);const saved=await room.stored();await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let i=0;i<300;i++){const s=await game();if(done(s))return;const w=s.windows?.at(-1);if(!w)throw Error('EXCHANGE_WINDOW');await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('EXCHANGE_LIMIT');}
 const start=await game(),maai=start.players[owner]!.hand.find(id=>actionCards.find(c=>c.id===id)!.name==='間合い／休息')!,advances=start.players[other]!.hand.filter(id=>actionCards.find(c=>c.id===id)!.name==='踏み込み／蹴る');
 for(const actor of start.seatOrder.filter(id=>id!==owner))expect((await room.snapshotFor(actor)).game!.maaiAbilityOptions).toEqual([]);
 await send(owner,withdraw?{type:'WITHDRAW',targetId:'B',cardInstanceId:maai,abilityId}:{type:'PLAY_MAAI',cardInstanceId:maai,abilityId});
 if(cancel){await until(s=>viewFor(s,'C').activeWindow?.pendingActorId==='C');await send('C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(await game(),'C').reactionTargetAbilityId!});}
 await until(s=>s.windows?.at(-1)?.kind===kind);await send(other,{type:'PLAY_ADVANCE',cardInstanceId:advances[0]!});
 expect(viewFor(await game(),other).distanceExchange).toMatchObject({paidAdvances:1,requiredAdvances:cancel?1:2,responseComplete:cancel});expect(viewFor(await game(),other).activeWindow!.pendingActorId).toBe(cancel?owner:other);
 if(!cancel)await send(other,{type:'PLAY_ADVANCE',cardInstanceId:advances[1]!});await until(s=>!s.windows?.length);const end=await game();expect(end.distances.A!.B).toBe('near');expect(end.discard.filter(id=>id===maai)).toHaveLength(1);
 if(!withdraw){const marker=Object.values(end.distanceMarkers!)[0]!.cardInstanceId;expect(marker).toBe(advances[cancel?0:1]);expect(end.discard).not.toContain(marker);}if(cancel)expect(end.players[other]!.hand).toContain(advances[1]);
});
it.each(['select','decline','cancel'] as const)('Tia earth immunity %s survives actual DO reload and duplicate receipt',async choice=>{
 const room=await openTestRoom('r5-distance-earth');let sequence=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`distance-${sequence++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const ids=allCardInstanceIds(await game());expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);return {actorId,envelope,ack};}
 async function reload(receipt?:Awaited<ReturnType<typeof send>>){const before=await room.stored();await room.restart();if(receipt)expect(await room.command(receipt.actorId,receipt.envelope)).toEqual(receipt.ack);expect(await room.stored()).toEqual(before);}
 async function until(done:(s:GameState)=>boolean){for(let i=0;i<300;i++){const s=await game();if(done(s))return;const w=s.windows?.at(-1);if(!w)throw Error('DISTANCE_DO_WINDOW');await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('DISTANCE_DO_LIMIT');}
 const abilityId='c2-p02-r1c1-ab01',option=viewFor(await game(),'B').abilityOptions.find(o=>o.abilityId===abilityId)!;expect(option).toBeDefined();await reload();
 for(const actor of ['A','C','D'])expect(JSON.stringify((await room.snapshotFor(actor)).game)).not.toContain(abilityId);
 if(choice!=='decline'){
  const receipt=await send('B',{type:'USE_ABILITY',abilityId,targetEventId:option.targetEventId});await reload(receipt);
  if(choice==='cancel'){await until(s=>viewFor(s,'C').activeWindow?.pendingActorId==='C');const canceled=await send('C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(await game(),'C').reactionTargetAbilityId!});await reload(canceled);await until(s=>s.windows?.at(-1)?.kind==='normal-defense');expect(viewFor(await game(),'B').abilityOptions.some(o=>o.abilityId===abilityId)).toBe(false);}
 }
 await until(s=>!s.windows?.length);await reload();expect((await game()).players.B!.damage).toBe(choice==='select'?0:6);
 expect((await game()).discard.filter(id=>id==='a2-p16-r2c3')).toHaveLength(1);
});
it.each([['r5-distance-cham',false],['r5-distance-tia',false],['r5-distance-lancaster',false],['r5-distance-cham',true]] as const)('%s canceled=%s saves elected maai payment and distinct advance receipts',async(name,cancel)=>{
 const room=await openTestRoom(name),lancaster=name.endsWith('lancaster'),defender=lancaster?'A':'B',attacker=lancaster?'B':'A',abilityId=lancaster?'c2-p02-r2c1-ab03':name.endsWith('cham')?'c2-p01-r2c2-ab01':'c2-p02-r1c1-ab01';let sequence=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`maai-${sequence++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const ids=allCardInstanceIds(await game());expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);return {actorId,envelope,ack};}
 async function reload(receipt:Awaited<ReturnType<typeof send>>){const saved=await room.stored();await room.restart();expect(await room.command(receipt.actorId,receipt.envelope)).toEqual(receipt.ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let i=0;i<300;i++){const s=await game();if(done(s))return;const w=s.windows?.at(-1);if(!w)throw Error('MAAI_DO_WINDOW');await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('MAAI_DO_LIMIT');}
 const start=await game(),maai=start.players[defender]!.hand.find(id=>actionCards.find(c=>c.id===id)!.name==='間合い／休息')!,advances=start.players[attacker]!.hand.filter(id=>actionCards.find(c=>c.id===id)!.name==='踏み込み／蹴る');expect(advances).toHaveLength(2);
 for(const actor of start.seatOrder.filter(id=>id!==defender)){const v=(await room.snapshotFor(actor)).game!;expect(v.maaiAbilityOptions).toEqual([]);expect(JSON.stringify(v)).not.toContain(abilityId);}
 const payment=await send(defender,{type:'PLAY_MAAI',cardInstanceId:maai,abilityId});await reload(payment);
 if(cancel){await until(s=>viewFor(s,'C').activeWindow?.pendingActorId==='C');const canceled=await send('C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(await game(),'C').reactionTargetAbilityId!});await reload(canceled);await until(s=>s.windows?.at(-1)?.kind==='defense-advance');const paid=await send(attacker,{type:'PLAY_ADVANCE',cardInstanceId:advances[0]!});await reload(paid);await until(s=>!s.windows?.length);const end=await game();expect(end.players[defender]!.damage).toBe(4);expect(end.players[attacker]!.hand).toContain(advances[1]);for(const id of [maai,advances[0]])expect(end.discard.filter(x=>x===id)).toHaveLength(1);return;}
 if(lancaster){await until(s=>!s.windows?.length);expect((await game()).players.A!.damage).toBe(0);expect((await game()).players.B!.hand).toEqual(start.players.B!.hand);await reload(payment);return;}
 await until(s=>s.windows?.at(-1)?.kind==='defense-advance');const first=await send(attacker,{type:'PLAY_ADVANCE',cardInstanceId:advances[0]!});await reload(first);await until(s=>s.windows?.at(-1)?.kind==='defense-advance');await reload(first);
 expect(viewFor(await game(),attacker).maaiDefense).toMatchObject({sharedAdvances:1,targets:[{submitted:1,effective:1,advanceFactor:2}]});
 const second=await send(attacker,{type:'PLAY_ADVANCE',cardInstanceId:advances[1]!});await reload(second);await until(s=>!s.windows?.length);const end=await game();expect(end.players[defender]!.damage).toBe(4);for(const id of [maai,...advances])expect(end.discard.filter(x=>x===id)).toHaveLength(1);await reload(first);await reload(second);
});
