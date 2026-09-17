import {recordStepChanges,recordTurn} from './public-record.js';
import {transitionChamGift} from './abilities/cham-death-gift.js';
import {transitionSadLove} from './abilities/sad-love.js';
import {transitionAllArmy} from './effects/all-army.js';
import {cleanCombinationSpirit} from './effects/printed-combinations.js';
import {transitionWish} from './effects/wish.js';
import {bindPeaceAction,cleanPeaceLifetimes} from './abilities/peace-lifetime.js';
import {cleanMotherTruth} from './effects/turn-choice-cards.js';
import {advanceDiscardResponses} from './discard.js';
import {finalizeReclaimReservations} from './reclaim.js';
import {transitionSuppression} from './abilities/suppression.js';
import {cleanBlessingLeases,lifeIdentity} from './abilities/suppression-state.js';
import {gameStats} from './game-stats.js';
import {transitionConditionalAbility,cleanConditionalSelections} from './abilities/conditional-selection.js';
import {revealCharacter} from './abilities/character-visibility.js';
import {transitionTurnPackage,revealAbilityOptions,startVoluntaryBenefit,revealExpiryActor} from './abilities/turn-information.js';
import {transitionInspection,cleanInspections} from './abilities/private-inspection.js';
import {cleanSpiritLifetimes} from './abilities/spirit-lifetime.js';
import {transitionBeastCapture} from './abilities/beast-empathy.js';
import {transitionFollowerBundle} from './combat/follower-bundles.js';
import {canPlaceFollower,maintainFollowers} from './combat/follower-placement.js';
import {transitionAbilityCommand} from './abilities/advance.js';
import {transitionLifecycleCommand} from './lifecycle/commands.js';
import {advanceLifecycle,beginResetup,settleProtection,stableOutcome,expireSourceTurn,normalizeTurn,settleDamage,scheduleBoundary} from './lifecycle/advance.js';
import {isActive} from './lifecycle/objectives.js';
import { transitionCombat,drainEmptyWindows } from './combat/attack.js';
import { transitionTurn } from './turns.js';
import { getAction } from '@madou/catalog';
import { parseGameCommand } from '@madou/protocol';
import type { GameInput, TransitionResult } from './commands.js';
import type { Entropy, GameState } from './state.js';
import { appendEvent, EntropyError, randomSource, refillInitialHand } from './setup.js';
function transitionCore(state: GameState, input: GameInput, entropy: Entropy): TransitionResult {
  const command = parseGameCommand(input?.command);
  if (!command.ok) return { ok: false, code: 'INVALID_COMMAND' };
  if (!input || !Object.hasOwn(state.players, input.actorId)) return { ok: false, code: 'UNKNOWN_ACTOR' };
  if (state.windows?.length || state.phase === 'combat' || state.phase === 'withdrawal' || ['DECLARE_VIRTUAL_BLADE','PLAY_ANYTIME_CARD','PLAY_TURN_TECHNIQUE','CHOOSE_LIFETIME_EFFECT','ATTACK', 'APPROACH', 'WITHDRAW', 'PASS_WITHDRAWAL', 'PLAY_MAAI', 'PLAY_ADVANCE', 'PLAY_DEFENSE', 'PLAY_REACTION', 'CANCEL_REACTION', 'PASS', 'START_FOLLOWERS'].includes(command.value.type)) return transitionCombat(state, { actorId: input.actorId, command: command.value }, entropy);
  if (state.phase !== 'setup') return transitionTurn(state, { actorId: input.actorId, command: command.value }, entropy);
  if (!['PLACE_INITIAL_FOLLOWER', 'PASS_SETUP', 'REVEAL_CHARACTER'].includes(command.value.type)) return { ok: false, code: 'WRONG_PHASE' };
  const p = state.players[input.actorId]!;
  if (command.value.type === 'REVEAL_CHARACTER') {
    if (p.revealed) return { ok: false, code: 'ALREADY_REVEALED' };
  } else {
    if (state.pending?.actorId !== input.actorId) return { ok: false, code: 'NOT_YOUR_TURN' };
    if (command.value.type === 'PLACE_INITIAL_FOLLOWER') {
      const id = command.value.cardInstanceId;
      if (!p.hand.includes(id)) return { ok: false, code: 'CARD_NOT_IN_HAND' };
      const card = getAction(id);
      if (card?.category !== 'follower') return { ok: false, code: 'NOT_FOLLOWER' };
      if (p.followers.length >= gameStats(state,p.id).followerLimit) return { ok: false, code: 'FOLLOWER_CAPACITY' };
      // The other 38 followers' character-only sections modify attack/morale, not placement (G01).
      if (!canPlaceFollower(p,id)) return { ok: false, code: 'FOLLOWER_RESTRICTED' };
    }
  }
  try {
    const random = randomSource(entropy);
    const next = structuredClone(state); const player = next.players[input.actorId]!; const eventStart = next.events.length;
    switch (command.value.type) {
      case 'REVEAL_CHARACTER':
        revealCharacter(next,player.id,entropy.now); break;
      case 'PLACE_INITIAL_FOLLOWER': {
        const id = command.value.cardInstanceId; player.hand.splice(player.hand.indexOf(id), 1); player.followers.push({cardInstanceId:id,revealed:false,placedById:player.id,placedLifeId:lifeIdentity(player)});
        appendEvent(next, entropy.now, { type: 'FOLLOWER_PLACED', actorId: player.id, audience: 'public' });
        refillInitialHand(next, player, random, entropy.now); break;
      }
      case 'PASS_SETUP':
        appendEvent(next, entropy.now, { type: 'SETUP_PASSED', actorId: player.id, audience: 'public' }); next.setupCursor++;
        if (next.setupCursor === next.seatOrder.length) {
          next.phase = 'turn-start'; next.pending = null;
          appendEvent(next, entropy.now, { type: 'SETUP_COMPLETE', actorId: next.seatOrder[next.turnSeat]!, audience: 'public' });
        } else next.pending = { kind: 'initial-followers', actorId: next.seatOrder[next.setupCursor]!, seat: next.setupCursor };
    }
    next.revision++; return { ok: true, state: next, events: structuredClone(next.events.slice(eventStart)) };
  } catch (error) { if (error instanceof EntropyError) return { ok: false, code: 'INVALID_ENTROPY' }; throw error; }
}

export function transition(state:GameState,input:GameInput,entropy:Entropy):TransitionResult{
 const parsed=parseGameCommand(input?.command);if(!parsed.ok)return {ok:false,code:'INVALID_COMMAND'};
 if(!input||!Object.hasOwn(state.players,input.actorId))return {ok:false,code:'UNKNOWN_ACTOR'};
 if(state.outcome)return {ok:false,code:'GAME_COMPLETE'};
 const command=parsed.value;const w=state.windows?.at(-1);const actor=state.players[input.actorId]!;
 const special=w?.continuation.kind==='lifecycle'&&w.participants[w.cursor]===actor.id;
 if(!isActive(actor)&&!(special&&['PASS','PLAY_DEATH_GIFT','CHAM_DEATH_GIFT','CHOOSE_REVIVAL'].includes(command.type)))return {ok:false,code:'INACTIVE_ACTOR'};
 if(w?.kind==='wish'&&command.type!=='CHOOSE_WISH'||w?.kind==='wish-capacity'&&command.type!=='CHOOSE_WISH_CAPACITY')return {ok:false,code:'WRONG_PHASE'};
 if(w?.kind==='reclaim'&&!['CHOOSE_RECLAIM','PASS','REVEAL_CHARACTER'].includes(command.type))return {ok:false,code:'WRONG_PHASE'};
 if(w?.kind==='private-inspection'&&!['PASS','CHOOSE_INSPECTION','REVEAL_CHARACTER'].includes(command.type))return {ok:false,code:'WRONG_PHASE'};
 if(command.type==='REVEAL_CHARACTER'&&command.abilityId&&!revealAbilityOptions(state,input.actorId).some(o=>o.abilityId===command.abilityId))return {ok:false,code:'ABILITY_DISABLED'};
 const selectedReveal=command.type==='REVEAL_CHARACTER'&&command.abilityId;
 const expiresOnActorId=selectedReveal?revealExpiryActor(state):undefined;
 try{
  const random=randomSource(entropy);
  let result:TransitionResult;
  if(command.type==='CHOOSE_REVIVAL'){
   if(!special||w!.kind!=='revival')return {ok:false,code:'WRONG_PHASE'};
   const s=structuredClone(state);const task=s.lifecycle!.find(t=>t.id===w!.continuation.id)!;
   if(task.kind!=='fusen')return {ok:false,code:'WRONG_PHASE'};
   s.windows!.pop();task.cursor++;delete task.rollId;task.waiting=false;
   if(command.revive)beginResetup(s,s.players[actor.id]!,entropy.now,true);
   s.revision++;result={ok:true,state:s,events:[]};
  }else if(special&&w!.kind==='re-setup'&&(command.type==='PLACE_INITIAL_FOLLOWER'||command.type==='PASS_SETUP')){
   if(command.type==='PLACE_INITIAL_FOLLOWER'){
    if(!actor.hand.includes(command.cardInstanceId))return {ok:false,code:'CARD_NOT_IN_HAND'};
    const card=getAction(command.cardInstanceId);if(card?.category!=='follower')return {ok:false,code:'NOT_FOLLOWER'};
    if(actor.followers.length>=gameStats(state,actor.id).followerLimit)return {ok:false,code:'FOLLOWER_CAPACITY'};
    if(!canPlaceFollower(actor,command.cardInstanceId))return {ok:false,code:'FOLLOWER_RESTRICTED'};
   }
   const s=structuredClone(state);const p=s.players[actor.id]!;s.windows!.pop();
   const task=s.lifecycle!.find(t=>t.id===w!.continuation.id)!;
   if(command.type==='PASS_SETUP')s.lifecycle=s.lifecycle!.filter(t=>t.id!==task.id);
   else {p.hand.splice(p.hand.indexOf(command.cardInstanceId),1);p.followers.push({cardInstanceId:command.cardInstanceId,revealed:false,placedById:p.id,placedLifeId:lifeIdentity(p)});if(task.kind==='re-setup')task.waiting=false;refillInitialHand(s,p,randomSource(entropy),entropy.now);}
   s.revision++;result={ok:true,state:s,events:[]};
  }else result=transitionChamGift(state,{actorId:input.actorId,command})??transitionAllArmy(state,{actorId:input.actorId,command})??transitionWish(state,{actorId:input.actorId,command},random,entropy.now)??transitionSuppression(state,{actorId:input.actorId,command})??transitionConditionalAbility(state,{actorId:input.actorId,command})??transitionInspection(state,{actorId:input.actorId,command})??transitionTurnPackage(state,{actorId:input.actorId,command})??transitionBeastCapture(state,{actorId:input.actorId,command},entropy.now)??transitionFollowerBundle(state,{actorId:input.actorId,command})??transitionSadLove(state,{actorId:input.actorId,command})??transitionAbilityCommand(state,{actorId:input.actorId,command})??transitionLifecycleCommand(state,{actorId:input.actorId,command},entropy.now)??transitionCore(state,{actorId:input.actorId,command},entropy);
  if(!result.ok)return result;
  const s=result.state;bindPeaceAction(s,state,{actorId:input.actorId,command});
  if(state.phase==='action'&&state.seatOrder[state.turnSeat]===actor.id&&s.phase!=='action'&&s.earlyTurnBook)s.earlyTurnBook.closed=true;
  if(selectedReveal)startVoluntaryBenefit(s,input.actorId,expiresOnActorId!);
  cleanMotherTruth(s);cleanBlessingLeases(s);cleanSpiritLifetimes(s);cleanConditionalSelections(s);cleanInspections(s);maintainFollowers(s);
  if(s.events.slice(state.events.length).some(e=>e.type==='CHARACTER_REVEALED'&&e.characterId==='c2-p03-r1c2'))scheduleBoundary(s,'lia-revealed');
  let diceCursor=0;const dice=()=>{const value=entropy.dice[diceCursor++];if(value===undefined)throw new EntropyError('ENTROPY_EXHAUSTED');return value;};
  for(let n=0;n<1000;n++){advanceLifecycle(s,random,entropy.now);maintainFollowers(s);drainEmptyWindows(s,dice,random,entropy.now);const top=s.lifecycle?.at(-1);if(!top||'waiting' in top&&top.waiting||s.windows?.at(-1)?.continuation.kind==='roll'||s.discardOccurrences?.some(o=>o.stage==='open'&&s.reclaimDecisions?.find(d=>d.id===o.decisionId)?.stage!=='closed'))break;}
  if(!s.lifecycle?.length&&!s.windows?.length&&s.phase!=='setup'){
   settleDamage(s,[],entropy.now);advanceLifecycle(s,random,entropy.now);
   if(!s.lifecycle?.length){settleProtection(s,random,entropy.now);advanceLifecycle(s,random,entropy.now);}
  }
  if(s.turnSeat!==state.turnSeat)expireSourceTurn(s,s.seatOrder[s.turnSeat]!);
  normalizeTurn(s);cleanMotherTruth(s);cleanBlessingLeases(s);cleanSpiritLifetimes(s);cleanConditionalSelections(s);cleanInspections(s);if(s.turnSeat!==state.turnSeat)s.turnNumber=(state.turnNumber??0)+1;cleanPeaceLifetimes(s);cleanCombinationSpirit(s);finalizeReclaimReservations(s);advanceDiscardResponses(s);stableOutcome(s,entropy.now);
  recordStepChanges(state,s);if(s.turnSeat!==state.turnSeat&&state.phase!=='setup')recordTurn(s,'TURN_ENDED',state.seatOrder[state.turnSeat]!,(state.turnNumber??0)+1);
  for(const event of s.events.slice(state.events.length))event.at=entropy.now;
  result.events=structuredClone(s.events.slice(state.events.length));return result;
 }catch(error){if(error instanceof EntropyError)return {ok:false,code:'INVALID_ENTROPY'};throw error;}
}
