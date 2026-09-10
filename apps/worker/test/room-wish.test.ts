import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import type {ClientEnvelope,GameCommand} from '@madou/protocol';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
type Room=Awaited<ReturnType<typeof openTestRoom>>;
const game=async(r:Room)=>(await r.stored()).state.game!;
async function send(r:Room,actorId:string,id:string,command:GameCommand){const before=await r.stored(),envelope:ClientEnvelope={protocolVersion:1,commandId:id,expectedRevision:before.revision,...activeWindowRef(before.state.game!)!,command},ack=await r.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});expect(new Set(allCardInstanceIds(await game(r))).size).toBe(220);return {actorId,envelope,ack};}
async function replay(r:Room,sent:Awaited<ReturnType<typeof send>>){const saved=await r.stored();await r.restart();expect(await r.command(sent.actorId,sent.envelope)).toEqual(sent.ack);expect(await r.stored()).toEqual(saved);}
async function until(r:Room,done:(s:GameState)=>boolean,prefix:string){for(let n=0;n<150;n++){const s=await game(r);if(done(s))return;const w=s.windows!.at(-1)!;await send(r,w.participants[w.cursor]!,`${prefix}-${n}`,{type:'PASS'});}throw Error('WISH_LIMIT');}
for(const cardInstanceId of ['a2-p04-r3c2','a2-p04-r3c3'] as const)it.each(['deck','hand','chant','attachment','capacity','open'] as const)(`${cardInstanceId} actual Wish %s survives eviction and duplicate selection without a second acquisition`,async kind=>{
 const r=await openTestRoom(kind==='open'?'reclaim-wish-open':'reclaim-wish'),initial=await game(r),paid=await send(r,'A','wish-pay',{type:'PLAY_TURN_CARD',cardInstanceId,mode:'wish'});await replay(r,paid);
 await until(r,s=>s.windows?.at(-1)?.kind==='wish','wish-declaration');const before=await r.stored();await r.restart();expect(await r.stored()).toEqual(before);
 const d=(await r.snapshotFor('A')).game!.wish!;for(const actor of ['B','C','D'])expect((await r.snapshotFor(actor)).game!.wish).toBeNull();
 const source:Extract<GameCommand,{type:'CHOOSE_WISH'}>['source']=kind==='hand'?{kind:'hand',ownerId:'B'}:kind==='deck'?{kind:'deck',cardName:d.deckNames.find(o=>o.count>1&&!['祈願','回復の薬'].includes(o.cardName))!.cardName}:kind==='open'?{kind:'deck',cardName:getAction('a2-p01-r1c1')!.name}:{kind:'public',cardInstanceId:d.publicSources.find(o=>o.ownerId==='B'&&o.zone===(kind==='chant'?'chants':kind==='capacity'?'open':'attachments'))!.cardInstanceId};
 const chosen=await send(r,'A','wish-choose',{type:'CHOOSE_WISH',decisionId:d.decisionId,source});await replay(r,chosen);
 if(kind==='open'){expect((await game(r)).windows!.at(-1)!.kind).toBe('before-roll');await until(r,s=>s.windows?.at(-1)?.kind==='after-roll','wish-open-roll');await replay(r,chosen);await until(r,s=>s.windows?.at(-1)?.kind==='revival'||s.windows?.at(-1)?.kind==='reclaim'||!s.windows?.length,'wish-open-result');if((await game(r)).windows?.at(-1)?.kind==='revival')await replay(r,await send(r,'D','wish-revival-decline',{type:'CHOOSE_REVIVAL',revive:false}));}
 if(kind==='capacity'){const cap=(await r.snapshotFor('B')).game!.wishCapacity!;expect(cap.chantCount).toBe(1);expect((await r.snapshotFor('C')).game!.wishCapacity).toBeNull();await replay(r,await send(r,'B','wish-capacity',{type:'CHOOSE_WISH_CAPACITY',decisionId:cap.decisionId,followerIds:[],chantIds:[cap.chantIds[0]!]}));}
 await until(r,s=>!s.windows?.length,'wish-finish');await replay(r,chosen);await replay(r,paid);const s=await game(r);expect(s.phase).toBe('hand-adjustment');expect(s.discard).toContain(cardInstanceId);expect(s.wishes!.filter(d=>d.stage==='complete')).toHaveLength(1);expect(s.events.filter(e=>e.type==='WISH_ACQUIRED'&&e.audience==='public')).toHaveLength(1);
 if(kind==='hand'){const acquired=s.wishes![0]!.acquisition!.cardInstanceId;expect(initial.players.B!.hand).toContain(acquired);for(const viewer of ['A','B'])expect(viewFor(s,viewer).privateLogs.some(e=>e.type==='WISH_ACQUIRED'&&e.cardInstanceId===acquired)).toBe(true);expect(viewFor(s,'C').logs.filter(e=>e.type==='WISH_ACQUIRED').every(e=>!e.cardInstanceId)).toBe(true);}
 if(kind==='open')expect(s.events.filter(e=>e.type==='OPEN'&&e.cardInstanceId==='a2-p01-r1c1')).toHaveLength(1);
});
