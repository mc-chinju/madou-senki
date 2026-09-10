import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it.each(['cost','attack','child','cancel-child','cancel-ability'] as const)('Shadow jump %s persists each stage and duplicate ACK through real DO restart',async choice=>{
 const room=await openTestRoom('shadow-jump');let seq=0;const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`jump-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let i=0;i<300;i++){const s=await game();if(done(s))return;const w=s.windows?.at(-1);if(!w)throw Error('JUMP_DO_WINDOW');await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('JUMP_DO_LIMIT');}
 const start=await game(),advance=start.players.B!.hand.find(id=>getAction(id)!.name==='踏み込み／蹴る')!,child=start.players.B!.hand.find(id=>getAction(id)!.name==='黒翼飛翔剣')!,o=viewFor(start,'B').abilityOptions.find(o=>o.abilityId==='c2-p06-r2c2-ab01')!;expect(o).toBeDefined();await send('B',{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId});
 if(choice==='cancel-ability'){await send('C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(await game(),'C').reactionTargetAbilityId!});}
 else{await until(s=>s.windows?.at(-1)?.kind==='shadow-jump-cost');const cost=viewFor(await game(),'B').shadowJumpCost!;for(const actor of ['A','C','D'])expect((await room.snapshotFor(actor)).game!.shadowJumpCost).toBeNull();
  if(choice!=='cost'){await send('B',{type:'PAY_SHADOW_JUMP',abilityEventId:cost.abilityEventId,advanceCardInstanceId:advance});await until(s=>s.windows?.at(-1)?.kind==='ability-attack');expect((await game()).players.B!.hand).not.toContain(advance);
   if(choice==='child'||choice==='cancel-child'){await send('B',{type:'ATTACK',cardInstanceId:child,targetIds:['A'],dedicated:false});const a=Object.values((await game()).actions!).find(a=>a.actorId==='B')!;expect(a.shadowJumpOrigin).toMatchObject({paidAdvanceId:advance,originalAttackerId:'A'});if(choice==='cancel-child')await send('C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:a.id});}
  }
 }
 await until(s=>!s.windows?.length);const end=await game();expect([end.players.A!.damage,end.players.B!.damage]).toEqual([choice==='child'?7:0,choice==='cancel-ability'?4:0]);expect(end.phase).toBe('withdrawal');expect(end.actions).toEqual({});expect(end.abilities).toEqual({});if(choice==='cost'||choice==='cancel-ability')expect(end.players.B!.hand).toContain(advance);else expect(end.discard.filter(id=>id===advance)).toHaveLength(1);
});
