import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import type {ClientEnvelope,GameCommand} from '@madou/protocol';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
type Room=Awaited<ReturnType<typeof openTestRoom>>;const game=async(r:Room)=>(await r.stored()).state.game!;
async function send(r:Room,actorId:string,id:string,command:GameCommand){const before=await r.stored(),envelope:ClientEnvelope={protocolVersion:1,commandId:id,expectedRevision:before.revision,...activeWindowRef(before.state.game!)!,command},ack=await r.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const ids=allCardInstanceIds(await game(r));expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);return {actorId,envelope,ack};}
async function replay(r:Room,sent:Awaited<ReturnType<typeof send>>){const saved=await r.stored();await r.restart();expect(await r.command(sent.actorId,sent.envelope)).toEqual(sent.ack);expect(await r.stored()).toEqual(saved);}
async function until(r:Room,done:(s:GameState)=>boolean,prefix:string){for(let n=0;n<200;n++){const s=await game(r);if(done(s))return;const w=s.windows!.at(-1)!;await send(r,w.participants[w.cursor]!,`${prefix}-${n}`,{type:'PASS'});}throw Error('ARMY_LIMIT');}
const command:GameCommand={type:'PLAY_ALL_ARMY',cardInstanceId:'a2-p05-r2c2',followerCardInstanceId:'a2-p20-r3c1',targetIds:['B']};
it.each(['success','failure','parent','follower','morale'])('live All Army %s saves each independent declaration and check without returning paid cards',async mode=>{
 const r=await openTestRoom(mode==='failure'?'reclaim-all-army-fail':'reclaim-all-army'),initial=await game(r),paid=await send(r,'A','army-pay',command);await replay(r,paid);expect((await game(r)).players.A!.hand).toHaveLength(initial.players.A!.hand.length-2);
 for(const stage of ['parent','follower','morale'] as const){
  if(stage!=='parent')await until(r,s=>{const a=viewFor(s,'A').currentAction;return stage==='follower'?a?.source==='card'&&a.cardInstanceId==='a2-p20-r3c1':s.rolls?.at(-1)?.purpose==='follower-morale';},`army-${stage}`);
  await replay(r,paid);
  if(mode===stage){await until(r,s=>s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]==='C',`army-${stage}-priority`);const s=await game(r),fate=s.players.C!.hand.find(id=>getAction(id)?.name==='命運凶変')!,v=viewFor(s,'C');await replay(r,await send(r,'C','army-cancel',stage==='morale'?{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:v.reactionTargetRollId!}:{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:v.reactionTargetActionId!}));break;}
 }
 if(mode==='success'||mode==='failure'){await until(r,s=>s.windows?.at(-1)?.kind==='after-roll','army-rolled');await replay(r,paid);}
 await until(r,s=>!s.windows?.length,'army-finish');await replay(r,paid);const s=await game(r);expect(s.players.B!.damage).toBe(mode==='success'?16:0);expect(s.discard).toEqual(expect.arrayContaining(['a2-p05-r2c2','a2-p20-r3c1']));expect(s.players.A!.followers).toEqual([]);expect(s.phase).toBe('withdrawal');expect(Object.keys(s.actions!)).toEqual([]);
 if(mode==='success'||mode==='failure'){expect(s.rolls!.filter(r=>r.purpose==='follower-morale')).toHaveLength(1);expect(s.rolls!.find(r=>r.purpose==='follower-morale')!.success).toBe(mode==='success');}
});
