import {canUseCharacterAbility} from '../../../packages/engine/src/state.js';
import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,gameStats,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
import {entropy} from './fixtures/scenario-tools.js';
import {getAction,actionCards} from '@madou/catalog';
afterEach(async()=>{await reset();});
it.each(['confusion','hypnosis'] as const)('actual %s remains after Blessing releases only Vanmil through every saved command',async mode=>{
 const room=await openTestRoom(mode==='confusion'?'suppression-blessing-confusion':'suppression-blessing-hypnosis');let seq=0;
 const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`lia-life-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};await runInDurableObject(room.room,instance=>{(instance as CanonicalRoom).setNextEntropy(entropy());});const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);expect([...ids].sort()).toEqual(actionCards.map(card=>card.id).sort());await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));}
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<300;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('LIA_LIFE_WINDOW');}
 const finish=()=>until(s=>!s.windows?.length);
 async function own(target:string){for(let n=0;n<100;n++){let s=await game();if(s.windows?.length){await finish();continue;}const id=s.seatOrder[s.turnSeat]!;if(s.phase==='action'&&id===target)return;if(s.phase==='turn-start')await send(id,{type:'START_TURN'});else if(s.phase==='draw')await send(id,{type:'CHOOSE_DRAW',draw:false});else if(s.phase==='action')await send(id,{type:'PASS_ACTION'});else if(s.phase==='withdrawal')await send(id,{type:'PASS_WITHDRAWAL'});else if(s.phase==='hand-adjustment')await send(id,{type:'END_TURN',discardIds:s.players[id]!.hand.slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});else throw Error('LIA_LIFE_TURN');}throw Error('LIA_LIFE_TURN_LIMIT');}
 async function use(actorId:string,abilityId:string){const o=viewFor(await game(),actorId).abilityOptions.find(o=>o.abilityId===abilityId)!;expect(o).toBeDefined();await send(actorId,{type:'USE_ABILITY',abilityId,targetEventId:o.targetEventId,...(actorId==='A'?{targetIds:['B']}:{targetId:'B'})});await finish();}
 await use('A','c2-p07-r1c2-ab03');await own('D');const card=(await game()).players.D!.hand.find(id=>getAction(id)!.name===(mode==='confusion'?'錯乱':'催眠'))!;await send('D',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});await finish();
 expect((await game()).players.B!.statuses).toContainEqual(expect.objectContaining({kind:mode==='confusion'?'ability-disabled':'stopped',sourceCardInstanceId:card}));
 await own('C');const before=await game(),statuses=structuredClone(before.players.B!.statuses),designations=structuredClone(before.suppressionDesignations);expect(canUseCharacterAbility(before.players.B!,before)).toBe(false);
 await use('C','c2-p03-r1c2-ab04');const done=await game();expect(done.players.B!.statuses).toEqual(statuses);expect(done.suppressionDesignations).toEqual(designations);expect(done.blessingLeases).toHaveLength(1);expect(viewFor(done,'B').suppressionTargets[0]!.applicability).toBe('relieved');expect(canUseCharacterAbility(done.players.B!,done)).toBe(false);
});
