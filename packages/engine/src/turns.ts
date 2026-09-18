import {recordPass,recordRest,recordTurn} from './public-record.js';
import {cloneGameState} from './clone-state.js';
import {printedTechniqueAllowed} from './combat/printed-restrictions.js';
import {playWish} from './effects/wish.js';
import {playTurnChoiceCard} from './effects/turn-choice-cards.js';
import {discardPhysical} from './discard.js';
import {playRemainingTurnCard,payTurnCardBatch} from './effects/remaining-turn-cards.js';
import {lifeIdentity} from './abilities/suppression-state.js';
import {enqueueLifecycle} from './lifecycle/events.js';
import {gameStats} from './game-stats.js';
import {revealCharacter} from './abilities/character-visibility.js';
import {canPlaceFollower,canRemoveFollower} from './combat/follower-placement.js';
import { advanceTurnRolls } from './rolls/turn-continuations.js';
import { getAction, getCharacter } from '@madou/catalog';
import type { GameInput, TransitionResult } from './commands.js';
import { completeOwnTurn,hasStatus, type Entropy, type GameState } from './state.js';
import { appendEvent, EntropyError, randomSource, refillHand } from './setup.js';
import { techniqueFor } from './effects/registry.js';
import { canSelectPrintedDedicated } from './effects/techniques.js';
export function transitionTurn(state: GameState, input: GameInput, entropy: Entropy): TransitionResult {
  const command = input.command;
  if(command.type==='PLAY_TURN_CARD'&&'mode' in command&&command.mode==='wish')return playWish(state,input.actorId,command.cardInstanceId);
  if(command.type==='PLAY_TURN_CARD'&&'targetId' in command)return playTurnChoiceCard(state,input.actorId,command);
  if(command.type==='PLAY_TURN_CARD'&&'cardInstanceId' in command)return playRemainingTurnCard(state,input.actorId,command.cardInstanceId,command.mode);
  if(state.windows?.length)return {ok:false,code:'WRONG_PHASE'};
  if (command.type === 'PASS_SETUP' || command.type === 'PLACE_INITIAL_FOLLOWER') return { ok: false, code: 'WRONG_PHASE' };
  const player = state.players[input.actorId]!;
  if (command.type !== 'REVEAL_CHARACTER' && state.seatOrder[state.turnSeat] !== input.actorId) return { ok: false, code: 'NOT_YOUR_TURN' };
  if (command.type === 'REVEAL_CHARACTER') {
    if (player.revealed) return { ok: false, code: 'ALREADY_REVEALED' };
  } else {
    if (!['START_TURN', 'PASS_ACTION', 'END_TURN'].includes(command.type) && hasStatus(player, 'stopped')) return { ok: false, code: 'STOPPED' };
    const phase = command.type === 'START_TURN' ? 'turn-start' : command.type === 'CHOOSE_DRAW' ? 'draw' : command.type === 'END_TURN' ? 'hand-adjustment' : 'action';
    if (state.phase !== phase) return { ok: false, code: 'WRONG_PHASE' };
    if (command.type === 'ARRANGE_FOLLOWERS') {
      if (command.cardInstanceIds.some(id => !player.hand.includes(id) && !player.followers.some(f => f.cardInstanceId === id))) return { ok: false, code: 'CARD_NOT_IN_HAND' };
      if (command.cardInstanceIds.some(id => getAction(id)?.category !== 'follower')) return { ok: false, code: 'NOT_FOLLOWER' };
      if (command.cardInstanceIds.length > gameStats(state,player.id).followerLimit) return { ok: false, code: 'FOLLOWER_CAPACITY' };
      if (command.cardInstanceIds.some(id => !canPlaceFollower(player,id)) || player.followers.some(f=>!command.cardInstanceIds.includes(f.cardInstanceId)&&!canRemoveFollower(f.cardInstanceId))) return { ok: false, code: 'FOLLOWER_RESTRICTED' };
    } else if (command.type === 'REST') {
      if (command.cardInstanceIds.some(id => !player.hand.includes(id))) return { ok: false, code: 'CARD_NOT_IN_HAND' };
      if (command.cardInstanceIds.some(id => !getAction(id)?.modes?.some(m => m.playMode === 'rest'))) return { ok: false, code: 'UNSUPPORTED_CARD' };
    } else if (command.type === 'CHANT') {
      if (!player.hand.includes(command.cardInstanceId)) return { ok: false, code: 'CARD_NOT_IN_HAND' };
      const name = getCharacter(player.characterId)?.name;
      const dedicated = command.dedicated === true;
      const technique = techniqueFor(command.cardInstanceId, name, dedicated);
      if (!technique || (dedicated && !canSelectPrintedDedicated(command.cardInstanceId, name)) || (!technique.chant && !technique.optionalChant)) return { ok: false, code: 'UNSUPPORTED_CARD' };
      if (!printedTechniqueAllowed(player,technique)) return { ok: false, code: 'UNSUPPORTED_CARD' };
      if (technique.school === 'magic' && hasStatus(player, 'silenced')) return { ok: false, code: 'SILENCED' };
      if (player.chants.length >= gameStats(state,player.id).chantLimit) return { ok: false, code: 'CHANT_CAPACITY' };
    } else if (command.type === 'END_TURN') {
      if (command.discardIds.length !== Math.max(0, player.hand.length - gameStats(state,player.id).handLimit) || command.discardIds.some(id => !player.hand.includes(id))) return { ok: false, code: 'INVALID_DISCARD' };
    } else if(command.type==='PLAY_TURN_CARD'){
      if(command.cardInstanceIds.some(id=>!player.hand.includes(id)))return{ok:false,code:'CARD_NOT_IN_HAND'};const names=command.cardInstanceIds.map(id=>getAction(id)?.name);const allPotions=names.every(name=>name==='回復の薬');const attachment=command.cardInstanceIds.length===1&&['香具羅','魔導書','悪の魅力','聖光'].includes(names[0]??'');if(!allPotions&&!attachment)return{ok:false,code:'UNSUPPORTED_CARD'};if(names[0]==='悪の魅力'&&player.faction!=='EVIL'||names[0]==='聖光'&&player.faction!=='GOOD')return{ok:false,code:'UNSUPPORTED_CARD'};
    } else if (!['START_TURN', 'CHOOSE_DRAW','PASS_ACTION'].includes(command.type)) return { ok: false, code: 'WRONG_PHASE' };
  }
  try {
    const random = randomSource(entropy); const next = cloneGameState(state); const p = next.players[input.actorId]!; const start = next.events.length;
    switch (command.type) {
      case 'REVEAL_CHARACTER': revealCharacter(next,p.id,entropy.now); break;
      case 'START_TURN': {
        recordTurn(next,'TURN_STARTED',p.id,(next.turnNumber??0)+1);
        next.earlyTurnBook={actorId:p.id,closed:false};
        if((p.skipTurns??0)>0){p.skipTurns!--;completeOwnTurn(p,next);next.turnSeat=(next.turnSeat+1)%next.seatOrder.length;next.phase='turn-start';break;}
        next.turnRoll={id:`turn-${next.nextEventId++}`,actorId:p.id,kind:'recovery',remainingIds:(p.statuses??[]).filter(status=>status.timing!=='next-own-seat'&&status.timing!=='source-turn'&&status.timing!=='fixed-turns'&&status.timing!=='until-death').map(status=>status.id),hadStopped:p.statuses?.some(status=>status.kind==='stopped')??false};
        advanceTurnRolls(next,()=>{throw new EntropyError('ENTROPY_EXHAUSTED');},random,entropy.now);
        break;
      }
      case 'CHOOSE_DRAW': if (command.draw){enqueueLifecycle(next,{kind:'resume-phase',id:`resume-${next.revision}`,phase:'action'});refillHand(next, p, p.hand.length + 1, random, entropy.now);}else next.phase = 'action'; break;
      case 'ARRANGE_FOLLOWERS': {
        const old = p.followers;
        next.discard.push(...old.filter(f => !command.cardInstanceIds.includes(f.cardInstanceId)).map(f => f.cardInstanceId));
        p.followers = command.cardInstanceIds.map(id => old.find(f => f.cardInstanceId === id) ?? {cardInstanceId:id,revealed:false,placedById:p.id,placedLifeId:lifeIdentity(p)});
        p.hand = p.hand.filter(id => !command.cardInstanceIds.includes(id)); next.phase = 'hand-adjustment'; break;
      }
      case 'REST':
        recordRest(next,p.id,command.cardInstanceIds.length);payTurnCardBatch(next,p.id,command.cardInstanceIds,'rest');break;
      case 'CHANT': p.hand.splice(p.hand.indexOf(command.cardInstanceId), 1); p.chants.push({ cardInstanceId: command.cardInstanceId, revealed: false }); next.phase = 'hand-adjustment'; break;
      case 'PASS_ACTION':
        recordPass(next,p.id,'action');
        if(hasStatus(p,'stopped')){completeOwnTurn(p,next);next.turnSeat=(next.turnSeat+1)%next.seatOrder.length;next.phase='turn-start';}else next.phase='hand-adjustment';
        break;
      case 'PLAY_TURN_CARD':{
        payTurnCardBatch(next,p.id,command.cardInstanceIds,getAction(command.cardInstanceIds[0]!)!.name==='回復の薬'?'potion':'attachment');break;
      }
      case 'END_TURN':
        completeOwnTurn(p,next);
        for (const id of command.discardIds) discardPhysical(next,id,{zone:'hand',ownerId:p.id},p.id,`turn-end-${p.id}-${next.revision}`);
        enqueueLifecycle(next,{kind:'resume-phase',id:`resume-${next.revision}`,phase:'turn-start',turnSeat:(next.turnSeat+1)%next.seatOrder.length});
        if(!hasStatus(p,'stopped'))refillHand(next, p, gameStats(next,p.id).handLimit, random, entropy.now);break;
    }
    next.revision++; return { ok: true, state: next, events: structuredClone(next.events.slice(start)) };
  } catch (e) { if (e instanceof EntropyError) return { ok: false, code: 'INVALID_ENTROPY' }; throw e; }
}
