import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import type {ClientEnvelope,GameCommand} from '@madou/protocol';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
type Room=Awaited<ReturnType<typeof openTestRoom>>;const game=async(r:Room)=>(await r.stored()).state.game!;
async function send(r:Room,actorId:string,id:string,command:GameCommand){const before=await r.stored(),envelope:ClientEnvelope={protocolVersion:1,commandId:id,expectedRevision:before.revision,...activeWindowRef(before.state.game!)!,command},ack=await r.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});expect(new Set(allCardInstanceIds(await game(r))).size).toBe(220);return {actorId,envelope,ack};}
async function replay(r:Room,sent:Awaited<ReturnType<typeof send>>){const saved=await r.stored();await r.restart();expect(await r.command(sent.actorId,sent.envelope)).toEqual(sent.ack);expect(await r.stored()).toEqual(saved);}
async function until(r:Room,done:(s:GameState)=>boolean,prefix:string){for(let n=0;n<200;n++){const s=await game(r);if(done(s))return;const w=s.windows!.at(-1)!;await send(r,w.participants[w.cursor]!,`${prefix}-${n}`,{type:'PASS'});}throw Error('COMBINATION_LIMIT');}
it.each(['none','a2-p05-r1c3','a2-p05-r2c1','parent'])('actual two-component cancellation=%s preserves payment, saved parent and one result',async cancel=>{
 const r=await openTestRoom('reclaim-printed-combinations'),initial=await game(r),cardInstanceId=initial.players.A!.hand.find(id=>getAction(id)?.name==='魔詩')!,spirit=viewFor(initial,'A').self.stats.spirit;
 const paid=await send(r,'A','compound-pay',{type:'ATTACK',cardInstanceId,targetIds:['B'],dedicated:false,combinationCardInstanceIds:['a2-p05-r1c3','a2-p05-r2c1']});await replay(r,paid);expect((await game(r)).players.A!.hand).toHaveLength(initial.players.A!.hand.length-3);
 if(cancel!=='none'){await until(r,s=>{const w=s.windows!.at(-1)!;return s.actions?.[w.continuation.id]?.cardInstanceId===(cancel==='parent'?cardInstanceId:cancel)&&w.participants[w.cursor]==='C';},'compound-cancel-window');const s=await game(r),fate=s.players.C!.hand.find(id=>getAction(id)?.name==='命運凶変')!;await replay(r,await send(r,'C','compound-cancel',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:viewFor(s,'C').reactionTargetActionId!}));}
 await until(r,s=>!s.windows?.length,'compound-finish');await replay(r,paid);const s=await game(r);expect(s.players.B!.damage).toBe(cancel==='parent'?0:cancel==='a2-p05-r2c1'?5:9);expect(viewFor(s,'A').self.stats.spirit).toBe(spirit+(cancel==='parent'||cancel==='a2-p05-r1c3'?0:2));
 await replay(r,await send(r,'A','compound-withdraw',{type:'PASS_WITHDRAWAL'}));expect((await r.snapshotFor('A')).game!.self.stats.spirit).toBe(spirit);
});
it('actual counter combination retains the respondent bonus across eviction and the original attack end',async()=>{
 const r=await openTestRoom('reclaim-printed-counter'),s=await game(r),spirit=viewFor(s,'B').self.stats.spirit,cardInstanceId=s.players.B!.hand.find(id=>getAction(id)?.name==='閃光槍')!;
 const paid=await send(r,'B','compound-counter',{type:'PLAY_DEFENSE',cardInstanceId,dedicated:false,combinationCardInstanceIds:['a2-p05-r1c3']});await replay(r,paid);await until(r,s=>!s.windows?.length,'counter-finish');await replay(r,paid);expect((await game(r)).players.A!.damage).toBe(5);expect((await r.snapshotFor('B')).game!.self.stats.spirit).toBe(spirit+2);await send(r,'A','counter-withdraw',{type:'PASS_WITHDRAWAL'});expect((await r.snapshotFor('B')).game!.self.stats.spirit).toBe(spirit);
});
