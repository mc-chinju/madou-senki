import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,gameStats,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it.each([['basic-attachment-warrior','a2-p03-r2c1','warrior_level'],['basic-attachment-magic','a2-p03-r3c1','magic_level'],['basic-attachment-evil','a2-p03-r3c2','spirit'],['basic-attachment-good','a2-p03-r3c3','spirit']] as const)('%s saves installation of %s and removes %s only after an actual opponent Wish',(async(scenario,card,stat)=>{
 const room=await openTestRoom(scenario);let seq=0;const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`attachment-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<300;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('ATTACHMENT_DO_LIMIT');}
 const initial=await game(),before=gameStats(initial,'A'),recipient=gameStats(initial,'B');
 await send('A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});expect(gameStats(await game(),'A')).toEqual(before);await until(s=>!s.windows?.length);
 expect(gameStats(await game(),'A')[stat]).toBe(before[stat]+1);
 for(const actor of ['A','B','C','D'])expect((await room.snapshotFor(actor)).game!.players.A!.attachments).toContain(card);
 await send('A',{type:'END_TURN',discardIds:[]});await send('B',{type:'START_TURN'});await send('B',{type:'CHOOSE_DRAW',draw:false});
 await send('B',{type:'PLAY_TURN_CARD',cardInstanceId:'a2-p04-r3c2',mode:'wish'});await until(s=>s.windows?.at(-1)?.kind==='wish');
 const decision=viewFor(await game(),'B').wish!;
 for(const actor of ['A','C','D'])expect((await room.snapshotFor(actor)).game!.wish).toBeNull();
 await send('B',{type:'CHOOSE_WISH',decisionId:decision.decisionId,source:{kind:'public',cardInstanceId:card}});await until(s=>!s.windows?.length);
 const done=await game();expect(gameStats(done,'A')).toEqual(before);expect(gameStats(done,'B')).toEqual(recipient);
 expect(done.players.A!.attachments).not.toContain(card);expect(done.players.B!.attachments).not.toContain(card);expect(done.players.B!.hand.filter(id=>id===card)).toHaveLength(1);expect(done.discard).not.toContain(card);expect(done.phase).toBe('hand-adjustment');
}));
