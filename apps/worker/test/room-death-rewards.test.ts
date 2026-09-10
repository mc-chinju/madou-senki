import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
for(const scenario of ['death-reward-dia','death-reward-hunger','cham-death-gift'] as const)it.each(['use','decline','cancel'] as const)(`${scenario} %s persists choice and transfers through every DO restart`,async choice=>{
 const room=await openTestRoom(scenario);let seq=0;const game=async()=>(await room.stored()).state.game!;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`death-reward-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 async function until(done:(s:GameState)=>boolean){for(let n=0;n<300;n++){const s=await game();if(done(s))return;const w=s.windows!.at(-1)!;await send(w.participants[w.cursor]!,{type:'PASS'});}throw Error('DEATH_REWARD_DO_LIMIT');}
 const initial=await game(),cham=scenario==='cham-death-gift',gift=initial.players.B!.hand.find(id=>getAction(id)!.name==='香具羅')!,abilityId=scenario==='death-reward-dia'?'c2-p06-r1c2-ab03':'c2-p06-r2c2-ab04';
 if(choice!=='decline'){
  if(cham)await send('B',{type:'CHAM_DEATH_GIFT',decisionId:viewFor(initial,'B').lifecycleDecision!.chamGift!.decisionId,cardInstanceId:gift,targetId:'C'});
  else await send('A',{type:'USE_ABILITY',abilityId,targetEventId:viewFor(initial,'A').abilityOptions.find(o=>o.abilityId===abilityId)!.targetEventId});
  expect((await game()).outcome).toBeUndefined();for(const actor of ['A','D'])if(cham)expect(JSON.stringify(await room.snapshotFor(actor))).not.toContain(gift);
  if(choice==='cancel'){await until(s=>s.windows?.at(-1)?.participants[s.windows!.at(-1)!.cursor]==='C');await send('C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(await game(),'C').reactionTargetAbilityId!});}
 }
 await until(s=>!s.windows?.length);const done=await game();expect(done.players.B!.presence).toBe('dead');
 if(cham){expect(done.players.C!.hand.includes(gift)).toBe(choice==='use');expect(done.discard.includes(gift)).toBe(choice!=='use');if(choice==='use'){for(const actor of ['B','C'])expect((await room.snapshotFor(actor)).game!.privateLogs.some(e=>e.type==='CARD_GIFTED'&&e.cardInstanceId===gift)).toBe(true);for(const actor of ['A','D'])expect((await room.snapshotFor(actor)).game!.privateLogs.some(e=>e.cardInstanceId===gift)).toBe(false);}}
 else{expect(done.players.A!.damage).toBe(choice==='use'?(scenario==='death-reward-dia'?5:0):8);expect(done.players.A!.combatRewardIds?.length??0).toBe(choice==='use'?1:0);expect(done.players.A!.permanent!.warrior_level).toBe(initial.players.A!.permanent!.warrior_level!+(choice==='use'&&scenario==='death-reward-hunger'?2:0));}
});
