import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameState,type GameCommand} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it('Fury DO reloads both numeric dice before and after rolling and rerolls one saved die',async()=>{
 const room=await openTestRoom('value-fury');let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`fury-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const ids=allCardInstanceIds(await game());expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);return {actorId,envelope,ack};}
 async function until(done:(s:GameState)=>boolean){let last:Awaited<ReturnType<typeof send>>|undefined;for(let i=0;i<400;i++){const s=await game();if(done(s))return last;const w=s.windows?.at(-1);if(!w)throw Error('FURY_DO_WINDOW');last=await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('FURY_DO_LIMIT');}
 async function reload(receipt:Awaited<ReturnType<typeof send>>){const saved=await room.stored();await room.restart();expect(await room.command(receipt.actorId,receipt.envelope)).toEqual(receipt.ack);expect(await room.stored()).toEqual(saved);}
 const ability='c2-p02-r1c2-ab03',base=viewFor(await game(),'A').actionCalculation!;
 expect(JSON.stringify((await room.snapshotFor('B')).game)).not.toContain(ability);
 const offer=viewFor(await game(),'A').abilityOptions.find(o=>o.abilityId===ability)!;
 const accepted=await send('A',{type:'USE_ABILITY',abilityId:ability,targetEventId:offer.targetEventId});await reload(accepted);
 const effectBefore=await until(s=>viewFor(s,'A').currentRoll?.purpose==='ability-value'&&viewFor(s,'A').currentRoll?.stage==='before-roll');await reload(effectBefore!);
 const effectId=viewFor(await game(),'A').currentRoll!.rollId;
 const effectAfter=await until(s=>viewFor(s,'A').currentRoll?.rollId===effectId&&viewFor(s,'A').currentRoll?.stage==='after-roll');await reload(effectAfter!);
 await until(s=>viewFor(s,'C').activeWindow?.pendingActorId==='C');
 const reaction=await send('C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r1c3',mode:'reroll',targetRollId:effectId});await reload(reaction);
 await until(s=>s.rolls!.find(r=>r.id===effectId)!.generation===1);
 const effect=structuredClone((await game()).rolls!.find(r=>r.id===effectId)!);expect(effect.attempts).toHaveLength(2);
 const frozen=await until(s=>s.windows?.at(-1)?.kind==='damage');await reload(frozen!);
 expect(viewFor(await game(),'A').actionCalculation).toMatchObject({effectLevel:base.effectLevel+effect.total!,calculation:{effectLevel:'final',damage:'pending'}});
 const damageBefore=await until(s=>viewFor(s,'A').currentRoll?.purpose==='ability-value'&&viewFor(s,'A').currentRoll?.stage==='before-roll');await reload(damageBefore!);
 const damageId=viewFor(await game(),'A').currentRoll!.rollId;expect(damageId).not.toBe(effectId);
 const damageAfter=await until(s=>viewFor(s,'A').currentRoll?.rollId===damageId&&viewFor(s,'A').currentRoll?.stage==='after-roll');await reload(damageAfter!);
 const damage=(await game()).rolls!.find(r=>r.id===damageId)!;
 await until(s=>s.windows?.at(-1)?.kind==='normal-defense');
 expect(viewFor(await game(),'A').currentAction).toMatchObject({technique:{useLevel:3,effectLevel:base.effectLevel+effect.total!,damage:4+damage.total!}});
 expect((await game()).rolls!.find(r=>r.id===effectId)).toMatchObject({faces:effect.faces,total:effect.total,attempts:effect.attempts});
 expect(JSON.stringify((await room.snapshotFor('B')).game)).not.toContain(ability);
 await until(s=>!s.windows?.length);expect((await game()).players.B!.damage).toBe(4+damage.total!);await reload(accepted);
});
