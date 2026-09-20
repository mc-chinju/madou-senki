import {recordDamage,recordReshuffle} from '../public-record.js';
import {snapshotCombatDamage,queueCombatRewards} from '../abilities/combat-reward-state.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {rewardSadLove} from '../abilities/sad-love-state.js';
import {advanceWishCompletion} from '../effects/wish.js';
import {finishTurnCardDraw} from '../combat/attack.js';
import {advanceDiscardResponses,discardIds,discardPlayerCards,moveToDiscard} from '../discard.js';
import {enqueueLifecycle} from './events.js';
import {gameStats} from '../game-stats.js';
import {cleanBlessingLeases} from '../abilities/suppression-state.js';
import {expireTurnEnd} from '../abilities/spirit-lifetime.js';
import {activeBeastOwner} from '../abilities/beast-empathy.js';
import {canRevivalConvert} from './turn-techniques.js';
import {getAction} from '@madou/catalog';
import type {GameState,PlayerState} from '../state.js';
import {appendEvent,refillInitialHand,shuffle} from '../setup.js';
import {beginRoll} from '../rolls/advance.js';
import {openWindow,participants,dropStandingPasses} from '../reactions/windows.js';
import {factionObjective,initialProtection,isActive,protectedDead,replaceAllegiance} from './objectives.js';
import type {DamageIntent,LifecycleTask,Outcome} from './types.js';

export function clearDistances(s:GameState,actorId:string):void{
 // A distance marker was played face up onto the table between the two seats.
 for(const [key,marker] of Object.entries(s.distanceMarkers??{}))if(marker.a===actorId||marker.b===actorId){moveToDiscard(s,marker.cardInstanceId,{ownerId:marker.ownerId,faceUp:true});delete s.distanceMarkers![key];}
 for(const id of s.seatOrder)if(id!==actorId){s.distances[actorId]![id]='far';s.distances[id]![actorId]='far';}
}
function deathIdentity(p:PlayerState){return {characterId:p.characterId,faction:p.faction,objective:p.objective,currentObjective:structuredClone(p.currentObjective??factionObjective(p.faction)),protection:structuredClone(p.protection??initialProtection(p.characterId))};}
/** One commit for the entire simultaneous group, including future explicit death/self costs. */
export function settleDamage(s:GameState,intents:DamageIntent[],now:number):void{
 const rewardBatchId=`damage-${s.nextEventId++}`;snapshotCombatDamage(s,intents);
 for(const intent of intents){const p=s.players[intent.targetId];if(p&&isActive(p)){p.damage+=intent.damage;if(intent.damage>0)recordDamage(s,p.id,intent.damage);}}
 const doomed=s.seatOrder.filter(id=>{const p=s.players[id]!;return isActive(p)&&(p.damage>=gameStats(s,p.id).endurance||intents.some(intent=>intent.targetId===id&&intent.instantDeath));});
 queueCombatRewards(s,intents,doomed,rewardBatchId,'kill');
 if(!doomed.length){queueCombatRewards(s,intents,doomed,rewardBatchId,'damage');return;}
 const order=[...s.seatOrder.slice(s.turnSeat),...s.seatOrder.slice(0,s.turnSeat)].filter(id=>doomed.includes(id));
 for(const id of order){const p=s.players[id]!;p.presence='pending-death';p.lifeId=`life-${p.id}-${s.nextEventId}`;delete p.conditionalSelections;p.deathIdentity=deathIdentity(p);if(!p.revealed){p.revealed=true;appendEvent(s,now,{type:'CHARACTER_REVEALED',actorId:id,audience:'public',characterId:p.characterId});dropStandingPasses(s);}appendEvent(s,now,{type:'DEATH_PENDING',actorId:id,audience:'public'});}
 cleanBlessingLeases(s);
 enqueueLifecycle(s,{kind:'death-batch',rewardBatchId,rootEventIds:[...new Set(intents.map(intent=>intent.eventId))],id:`death-${s.nextEventId++}`,actorIds:order,cursor:0,intents:structuredClone(intents)});
 queueCombatRewards(s,intents,doomed,rewardBatchId,'damage');
}
function disposeDeath(s:GameState,p:PlayerState,now:number,death:NonNullable<import('../state.js').GameEvent['death']>):void{
 discardPlayerCards(s,p.id,death.sourceActorId??p.id,death.eventId);
 p.hand=[];p.chants=[];p.followers=[];p.open=[];p.attachments=[];p.presence='dead';if(p.statuses)p.statuses=p.statuses.filter(status=>status.timing!=='until-death');clearDistances(s,p.id);
 if(p.characterId==='c2-p07-r1c2')s.vanmilDeath=true;
 appendEvent(s,now,{type:'PLAYER_DIED',actorId:p.id,audience:'public',death});
}
export function beginResetup(s:GameState,p:PlayerState,now:number,revival:boolean):void{
 if(revival)p.lifeId=`life-${p.id}-${s.nextEventId}`;
 if(revival&&p.deathIdentity){const identity=structuredClone(p.deathIdentity);Object.assign(p,identity);}
 p.presence='active';p.revealed=true;if(revival){p.damage=0;p.statuses=[];}
 appendEvent(s,now,{type:revival?'PLAYER_REVIVED':'PLAYER_RETURNED',actorId:p.id,audience:'public',characterId:p.characterId});
 enqueueLifecycle(s,{kind:'re-setup',id:`setup-${s.nextEventId++}`,actorId:p.id});
 refillInitialHand(s,p,()=>{throw Error('DRAW_IS_QUEUED');},now);
}
function lifecycleWindow(s:GameState,task:LifecycleTask,kind:'beast-capture'|'death-gift'|'revival'|'re-setup'|'lifecycle-boundary',actors?:string[]):void{
 openWindow(s,kind,task.id,{kind:'lifecycle',id:task.id},actors);if('waiting' in task||task.kind!=='draw')Object.assign(task,{waiting:true});
}
/** First publication only; ownership transfer of an already public OPEN never calls this. */
export function revealOpen(s:GameState,p:PlayerState,id:string,random:()=>number,now:number):void{
   p.open.push(id);appendEvent(s,now,{type:'OPEN',actorId:p.id,audience:'public',cardInstanceId:id});
   if(id==='a2-p01-r1c2'){
    const returning=[...s.seatOrder.slice(s.turnSeat),...s.seatOrder.slice(0,s.turnSeat)].filter(id=>s.players[id]!.presence==='otherworld');
    for(const actorId of returning)s.players[actorId]!.presence='active';
    for(const actorId of returning)appendEvent(s,now,{type:'PLAYER_RETURNED',actorId,audience:'public'});
    // The line says how many cards came back from the pile, so it is counted before they join the deck.
    const returned=s.discard.length;s.deck=shuffle([...s.deck,...discardIds(s)],random);s.discard=[];if(returned)recordReshuffle(s,p.id,returned);
   }
   if(id==='a2-p01-r1c1'){const targets=s.seatOrder.filter(actor=>s.players[actor]!.presence==='dead');if(targets.length)enqueueLifecycle(s,{kind:'fusen',id:`open-${s.nextEventId++}`,actorId:p.id,sourceCardInstanceId:id,targetIds:targets,cursor:0});}
}
/** Drain only automatic work; every optional decision and roll is a persisted window. */
export function advanceLifecycle(s:GameState,random:()=>number,now:number):void{
 for(let steps=0;steps<2000;steps++){
  if(advanceDiscardResponses(s))return;
  const task=s.lifecycle?.at(-1);if(!task)return;
  if('waiting' in task&&task.waiting)return;
  if(task.kind==='combat-reward'){const p=s.players[task.actorId];if(!p||!isActive(p)||lifeIdentity(p)!==task.sourceLifeId){s.lifecycle!.pop();continue;}lifecycleWindow(s,task,'lifecycle-boundary');return;}
  if(task.kind==='beast-capture'){
   if(!activeBeastOwner(s,task.actorId)){s.lifecycle!.pop();continue;}
   lifecycleWindow(s,task,'beast-capture',[task.actorId]);return;
  }
  if(task.kind==='post-death-heal'){
   s.lifecycle!.pop();const p=s.players[task.actorId]!;
   if(isActive(p)&&s.events.some(event=>event.id>=task.sinceEventId&&event.type==='PLAYER_DIED'&&task.targetIds.includes(event.actorId)))p.damage=0;continue;
  }
  if(task.kind==='technique-revival'){
   if(task.cursor>=task.targetIds.length){s.lifecycle!.pop();continue;}
   const p=s.players[task.targetIds[task.cursor++]!]!;if(p.presence!=='dead')continue;
   const source=s.players[task.sourceActorId]!;
   beginResetup(s,p,now,true);
   if(task.convertTargetIds.includes(p.id)&&canRevivalConvert(source,p)){
    replaceAllegiance(p,source.faction,source.currentObjective??factionObjective(source.faction),source.protection??initialProtection(source.characterId));p.objective=source.objective;if(p.deathIdentity)p.deathIdentity.objective=source.objective;
    appendEvent(s,now,{type:'FACTION_CHANGED',actorId:p.id,audience:'public'});
   }
   continue;
  }
  if(task.kind==='wish-complete'){if(!advanceWishCompletion(s,task))return;continue;}
  if(task.kind==='turn-card-resume'){s.lifecycle!.pop();finishTurnCardDraw(s,task.actionId);continue;}
  if(task.kind==='draw'){
   const p=s.players[task.actorId]!;
   if(!isActive(p)||p.hand.length>=task.target){s.lifecycle!.pop();continue;}
   if(!s.deck.length&&s.discard.length){const returned=s.discard.length;s.deck=shuffle(discardIds(s),random);s.discard=[];recordReshuffle(s,p.id,returned);}
   const id=s.deck.shift();if(!id){s.lifecycle!.pop();continue;}
   const card=getAction(id);if(!card)throw Error('UNKNOWN_CARD');
   if(card.category!=='open'){p.hand.push(id);appendEvent(s,now,{type:'CARD_DRAWN',actorId:p.id,audience:{playerId:p.id},cardInstanceId:id});continue;}
   revealOpen(s,p,id,random,now);
   continue;
  }
  if(task.kind==='resume-phase'){s.lifecycle!.pop();s.phase=task.phase;if(task.turnSeat!==undefined)s.turnSeat=task.turnSeat;continue;}
  if(task.kind==='protection'){settleProtection(s,random,now,!task.includeNewDefeats);if(s.lifecycle!.at(-1)===task)s.lifecycle!.pop();continue;}
  if(task.kind==='declaration'){s.lifecycle!.pop();const action=s.actions?.[task.actionId];if(action)openWindow(s,'declaration',action.eventId,{kind:'action',id:action.id},participants(s,(s.seatOrder.indexOf(action.actorId)+1)%s.seatOrder.length));return;}
  if(task.kind==='fusen'){
   if(task.cursor>=task.targetIds.length){s.lifecycle!.pop();enqueueLifecycle(s,{kind:'protection',rootEventIds:task.rootEventIds??[],id:`protection-${task.id}`});continue;}
   const actorId=task.targetIds[task.cursor]!;
   if(s.players[actorId]!.presence!=='dead'){task.cursor++;delete task.rollId;continue;}
   if(!task.rollId){task.rollId=beginRoll(s,{eventId:task.id,rollerId:actorId,purpose:'revival',formula:'d6',check:{modifier:0,base:'fixed',threshold:4},resume:{kind:'revival',lifecycleId:task.id,targetId:actorId}},()=>{throw Error('CHECK_ROLLS_AFTER_BEFORE_WINDOW');}).id;return;}
   const roll=s.rolls!.find(frame=>frame.id===task.rollId)!;if(roll.stage!=='applied')return;
   if(roll.success){lifecycleWindow(s,task,'revival',[actorId]);return;}
   task.cursor++;delete task.rollId;continue;
  }
  if(task.kind==='death-batch'){
   if(task.cursor>=task.actorIds.length){s.lifecycle!.pop();continue;}
   lifecycleWindow(s,task,'death-gift',[task.actorIds[task.cursor]!]);return;
  }
  if(task.kind==='re-setup'){lifecycleWindow(s,task,'re-setup',[task.actorId]);return;}
  lifecycleWindow(s,task,'lifecycle-boundary');return;
 }
 throw Error('LIFECYCLE_DID_NOT_CONVERGE');
}
export function passLifecycle(s:GameState,id:string,now:number):void{
 const task=s.lifecycle?.find(task=>task.id===id);if(!task)throw Error('MISSING_LIFECYCLE');
 if(task.kind==='death-batch'){
  const actorId=task.actorIds[task.cursor]!;
  const intent=task.intents.find(intent=>intent.targetId===actorId&&intent.rewardSnapshot?.killingBlow)??task.intents.find(intent=>intent.targetId===actorId&&intent.instantDeath)??task.intents.find(intent=>intent.targetId===actorId&&intent.damage>0);
  const death={cause:intent?.cause??'maximum-endurance' as const,eventId:intent?.eventId??task.id,...(intent?.sourceActorId?{sourceActorId:intent.sourceActorId}:{}),...(intent?.sourceCardInstanceId?{sourceCardInstanceId:intent.sourceCardInstanceId}:{})};
  disposeDeath(s,s.players[actorId]!,now,death);for(const reward of s.lifecycle??[])if(reward.kind==='combat-reward'&&reward.mode==='kill'&&reward.batchId===task.rewardBatchId&&reward.targetId===actorId)reward.confirmed=true;const love=task.intents.find(i=>i.targetId===actorId&&(i.damage>0||i.instantDeath)&&i.sadLoveSource)?.sadLoveSource;if(love)rewardSadLove(s,love);task.cursor++;task.waiting=false;
 }
 else if(task.kind==='fusen'){task.cursor++;delete task.rollId;task.waiting=false;}
 else s.lifecycle=s.lifecycle!.filter(t=>t.id!==id);
}
export function scheduleBoundary(s:GameState,trigger:'lia-revealed'|'vanmil-awakened'):void{
 enqueueLifecycle(s,{kind:'boundary',id:`boundary-${s.nextEventId++}`,trigger});
}
export function settleProtection(s:GameState,random:()=>number,now:number,returnsOnly=false):void{
 for(const id of s.seatOrder){const p=s.players[id]!;if(!returnsOnly&&(isActive(p)||p.presence==='otherworld')&&protectedDead(s,p)){
  s.deck=shuffle([...s.deck,...p.hand,...p.chants.map(c=>c.cardInstanceId),...p.followers.map(c=>c.cardInstanceId)],random);p.hand=[];p.chants=[];p.followers=[];p.presence='wandering';clearDistances(s,id);appendEvent(s,now,{type:'PLAYER_WANDERING',actorId:id,audience:'public'});
 }else if(p.presence==='wandering'&&!protectedDead(s,p)){beginResetup(s,p,now,false);return;}}
}
export function stableOutcome(s:GameState,now:number):void{
 if(s.outcome||s.phase==='setup'||s.lifecycle?.length||s.windows?.length||Object.keys(s.actions??{}).length||Object.keys(s.groups??{}).length||s.turnRoll||s.resolution.length||s.reclaimReservations.length)return;
 const previous=Object.keys(s.individualResults??{});let winners:string[]=[];let reason:Outcome['reason']='objectives';
 const living=s.seatOrder.filter(id=>isActive(s.players[id]!)||s.players[id]!.presence==='otherworld');
 if(s.vanmilDeath){winners=s.seatOrder.filter(id=>s.players[id]!.faction!=='ヴァンミール');reason='vanmil-death';}
 else{
  const initial=s.initialFactions??s.seatOrder.map(id=>s.players[id]!.faction);
  const unrevealedSameFactionDeal=initial.every(faction=>faction===initial[0])&&!s.seatOrder.every(id=>s.players[id]!.revealed);
  if(!unrevealedSameFactionDeal)winners=s.seatOrder.filter(id=>{const p=s.players[id]!;return (isActive(p)||p.presence==='otherworld')&&!(p.currentObjective??factionObjective(p.faction)).enemyFactions.some(faction=>living.some(enemy=>s.players[enemy]!.faction===faction));});
  if(!winners.length){
   if(living.some(id=>isActive(s.players[id]!)))return;
   // G15 provisional no-turn supplement covers opposing living otherworld survivors.
   if(living.length&&new Set(living.map(id=>s.players[id]!.faction)).size<2)return;
   reason=living.length?'stalemate':'mutual-extinction';
  }
 }
 winners=[...new Set([...previous,...winners])];const kind=reason==='stalemate'?'draw':winners.length?'victory':'draw';
 s.outcome={kind,reason,winnerIds:winners,results:Object.fromEntries(s.seatOrder.map(id=>[id,winners.includes(id)?'won':kind==='draw'?'draw':'lost']))};
 appendEvent(s,now,{type:'GAME_COMPLETED',actorId:s.seatOrder[s.turnSeat]!,audience:'public'});
}
/** Source-clock periods expire even when this seat cannot execute its arriving turn. */
export function expireSourceTurn(s:GameState,actorId:string):void{for(const p of Object.values(s.players))if(p.statuses)p.statuses=p.statuses.filter(status=>status.timing==='next-own-seat'?status.expiresOnActorId!==actorId:status.timing!=='source-turn'||status.sourceActorId!==actorId);}
export function normalizeTurn(s:GameState):void{
 if(s.windows?.length||s.lifecycle?.length)return;
 if(!isActive(s.players[s.seatOrder[s.turnSeat]!]!)){
  const next=s.seatOrder.findIndex((_,offset)=>isActive(s.players[s.seatOrder[(s.turnSeat+offset+1)%s.seatOrder.length]!]!));
  if(next>=0){for(let i=0;i<=next;i++){expireTurnEnd(s,s.seatOrder[s.turnSeat]!);s.turnSeat=(s.turnSeat+1)%s.seatOrder.length;expireSourceTurn(s,s.seatOrder[s.turnSeat]!);}s.phase='turn-start';}
 }
}
