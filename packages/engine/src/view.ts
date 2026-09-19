import {canChooseDarkSaintIgnore} from './effects/dark-saint.js';
import {chamGiftOption} from './abilities/cham-death-gift.js';
import {sadLoveView,type SadLoveView} from './abilities/sad-love.js';
import {shadowJumpCostView} from './abilities/shadow-jump.js';
import {physicalActionCard} from './combat/action-source.js';
import {virtualBladeOptions,VIRTUAL_BLADES} from './abilities/virtual-blades.js';
import {distanceExchangeView,maaiAbilityOptions} from './abilities/distance.js';
import {allArmyOptions} from './effects/all-army.js';
import {printedCombinationOptions} from './effects/printed-combinations.js';
import {wishOptions,wishView,wishCapacityView,type WishView,type WishCapacityView} from './effects/wish.js';
import {substituteRestricted} from './effects/substitute.js';
import {peaceExpiryViews} from './abilities/peace-lifetime.js';
import {turnChoiceCardOptions} from './effects/turn-choice-cards.js';
import {turnCardOptions} from './effects/remaining-turn-cards.js';
import {anytimeCardOptions} from './effects/remaining-anytime.js';
import {reclaimView} from './reclaim.js';
import {suppressionTargetViews,type SuppressionTargetView} from './abilities/suppression-state.js';
import {gameStats} from './game-stats.js';
import {conditionalAbilitySettings,type ConditionalAbilitySetting} from './abilities/conditional-selection.js';
import {drawAbilityOptions,revealAbilityOptions} from './abilities/turn-information.js';
import {inspectionView,type InspectionView} from './abilities/private-inspection.js';
import {spiritExpiryView,type SpiritExpiryView} from './abilities/spirit-lifetime.js';
import {declarationCandidates,type DeclarationCandidate} from './abilities/declaration-candidates.js';
import {declarationSelection,type DeclarationSelectionView} from './abilities/declaration-resolution.js';
import {maaiDefenseView,type MaaiDefenseView} from './abilities/attack-properties.js';
import {beastCaptureView,hasBeastIgnore,type BeastCaptureView} from './abilities/beast-empathy.js';
import {destructionEffects} from './abilities/follower-destruction.js';
import {effectPreview,damagePreview,calculationReadiness,realTechnique,type CalculationReadiness} from './abilities/action-modifiers.js';
import {currentEffectiveTechnique,effectiveHitTechnique} from './abilities/follower-entry.js';
import {followerBundleOptions,type FollowerBundleOption} from './combat/follower-bundles.js';
import {currentHit} from './reactions/continuations.js';
import {magicGateTargets} from './lifecycle/magic-gate.js';
import {followerPlacementOptions} from './combat/follower-placement.js';
import {canSelectFollowerDedicated} from './effects/follower-descriptors.js';
import {followerAttackOptions,type FollowerAttackOption,sourceChoices,additionalAttackOptions,type AdditionalAttackOption} from './combat/legality.js';
import {advanceCards,groupDefenseOptions as availableGroupDefenses} from './combat/combination.js';
import {availableAbilities} from './abilities/advance.js';
import {ABILITIES,type AbilityOption} from './abilities/frames.js';
import {lifetimeDecisionKind,type LifetimeDecisionKind} from './combat/lifetime.js';
import {availableLifecycleAbilities,eligibleGiftRecipients} from './lifecycle/commands.js';
import type {Presence,Outcome,LifecycleDecision,LifecycleAbility} from './lifecycle/types.js';
import {hasPendingFatal} from './state.js';
import {isActive,factionObjective,initialProtection,currentDefeatCondition} from './lifecycle/objectives.js';
import type { AttackGroup, ReactionWindow } from './reactions/continuations.js';
import { passAhead } from './reactions/windows.js';
import { projectRoll, unresolvedRoll, visibleRoll } from './rolls/advance.js';
import type { PublicRollView } from './rolls/frames.js';
import { getCharacter } from '@madou/catalog';
import { hasStatus, type DerivedStats, type GameEvent, type GameState, type PlacedCard, type PlayerId, type StatusKind } from './state.js';
export type CardBackView = { position: number; face: 'back' } | { position: number; face: 'front'; cardInstanceId: string };
export type PublicStatusView = {sourceActorId?:PlayerId;sourceCardInstanceId?:string} & (
 | {kind:StatusKind;timing?:'recovery'|'deadly-recovery';recoveryModifier:number;nextCheck:number}
 | {kind:'stopped';timing:'next-own-seat';expiresOnActorId:string}
 | {kind:'stopped';timing:'source-turn';sourceActorId:string;sourceCardInstanceId:string}
 | {kind:'stopped';timing:'fixed-turns';remainingTurns:number}
 | {kind:'stat-drain';timing:'until-death';amount:number}
);
export interface LifetimeDecision {kind:LifetimeDecisionKind;actorId:PlayerId;targetId:PlayerId;sourceCardInstanceId:string;choices:('apply'|'decline')[]}

export interface PublicPlayerView {
  pendingFatal:boolean;
  skipsNextTurn:boolean;
  id: PlayerId; name: string; revealed: boolean; characterId?: string; presence:Presence;
  damage: number; handCount: number; followers: CardBackView[]; chants: CardBackView[]; chantCount: number; open: string[]; attachments: string[]; statuses:PublicStatusView[];
}
export interface LogView { count?:number; death?:GameEvent['death']; id: number; at: number; type: GameEvent['type']; actorId: PlayerId; targetId?:PlayerId; cardInstanceId?: string; characterId?: string;
  targetIds?:PlayerId[]; use?:GameEvent['use']; abilityId?:string; checkSkip?:GameEvent['checkSkip']; roll?:import('./state.js').PublicRollRecord; amount?:number; windowKind?:string; turnNumber?:number; status?:GameEvent['status']; distance?:GameEvent['distance'] }
export interface PlayerView {
  sadLove:SadLoveView|null;
 shadowJumpCost:ReturnType<typeof shadowJumpCostView>;
 virtualBladeOptions:ReturnType<typeof virtualBladeOptions>;
  turnChoiceCardOptions:ReturnType<typeof turnChoiceCardOptions>;
  turnCardOptions:ReturnType<typeof turnCardOptions>;
  anytimeCardOptions:ReturnType<typeof anytimeCardOptions>;
  reclaim:ReturnType<typeof reclaimView>;
  reservedCards:string[];
  conditionalAbilities:ConditionalAbilitySetting[];
  allArmyOptions:ReturnType<typeof allArmyOptions>;
  printedCombinationOptions:ReturnType<typeof printedCombinationOptions>;
  wish:WishView|null;wishCapacity:WishCapacityView|null;wishOptions:ReturnType<typeof wishOptions>;
  inspection:InspectionView|null;inspectionHistory:InspectionView[];peaceExpiries:ReturnType<typeof peaceExpiryViews>;
  spiritExpiry:SpiritExpiryView|null;
  drawAbilityOptions:{abilityId:string;name:string}[];
  revealAbilityOptions:{abilityId:string;name:string}[];
  declarationCandidates:DeclarationCandidate[];
  declarationSelection:DeclarationSelectionView|null;
  distanceExchange:ReturnType<typeof distanceExchangeView>;maaiAbilityOptions:ReturnType<typeof maaiAbilityOptions>;maaiDefense:MaaiDefenseView|null;
  beastCapture:BeastCaptureView|null;
  followerBundleOptions:FollowerBundleOption[];
  followerBundle:null|{bundleId:string;actorId:string;stage:'grant'|'prepare'|'defense';currentSourceIndex:number|null;sources:{cardInstanceId:string;sourceZone:'hand'|'followers';dedicated:boolean;targetIds:string[];stage:'reserved'|'declaration'|'checks'|'check-result'|'effect-level'|'damage'|'resolve'|'failed';technique:{calculation?:CalculationReadiness;range:string;school:string;attributes:string[];useLevel:number;effectLevel:number;damage:number|null;hitCount:number|string};damageRollId?:string;effectLevelRollId?:string}[]};
  followerAttackOptions:FollowerAttackOption[];
  followerDefenseOptions:{cardInstanceId:string}[];
  followerPlacementOptions:{placeableCardInstanceIds:string[];removableCardInstanceIds:string[]};
  magicGateTargets:{actorId:string;positions:number[]}[];
  additionalAttackOptions:AdditionalAttackOption[];
  combinationOptions:{cardInstanceId:string;coSources:{cardInstanceId:string;dedicated:boolean;techniqueVariant?:import('@madou/protocol').TechniqueVariant}[]}[];
  advanceCostOptions:{cardInstanceId:string;advanceCardInstanceIds:string[]}[];
  groupDefenseOptions:{cardInstanceId:string;groupId:string;targetIds:string[]}[];
  techniqueDecision:null|{kind:'damage-double';actionId:string;actorId:string;sourceCardInstanceId:string}|{kind:'hit-advance';groupId:string;actorId:string;sourceCardInstanceId:string;cardInstanceIds:string[]};
  additionalAttack:null|{shadowJump?:true;source:'card'|'ability';actorId:string;targetId:string;sourceCardInstanceId?:string};
  followerEntry:null|{groupId:string;targetId:string;attackerId:string;reason:'before-follower-snapshot';virtualGuardSelected:boolean};
  followerDefenseResults:{targetId:string;source:'physical'|'virtual';position:number;cardInstanceId?:string;hits:{hitIndex:number;outcome:import('./reactions/continuations.js').FollowerOutcome;hpReduction:number}[]}[];
  virtualFollowerDefense:{source:'virtual';sourceId:string;targetId:string;position:-1;name:string;levels:number[];hp:number;attributes:string[];moraleRequired:false;cancelIgnore:true;hits:{hitIndex:number;outcome:string;hpReduction:number}[]}[];
  suppressionTargets:SuppressionTargetView[];
  abilityOptions:AbilityOption[];reactionTargetAbilityId:string|null;
  lifetimeDecision:LifetimeDecision|null;
  outcome:Outcome|null; individualResults:Record<string,'won'>; lifecycleDecision:LifecycleDecision|null; lifecycleAbilities:LifecycleAbility[];
  rulesetVersion: string; revision: number; phase: GameState['phase']; seatOrder: PlayerId[]; turnSeat: number;
  pending: { kind: 'initial-followers'; round: number; participantIds: PlayerId[]; readyIds: PlayerId[] } | null;
  deckCount: number; discardCount: number; distances: GameState['distances']; distanceMarkers: { a:PlayerId;b:PlayerId;ownerId:PlayerId;cardInstanceId:string }[]; players: Record<PlayerId, PublicPlayerView>;
  self: { currentObjective:import('./lifecycle/types.js').CurrentObjective;protection:import('./lifecycle/types.js').Protection;defeatCondition:string; id: PlayerId; characterId: string; faction: string; objective: string; damage: number; stats: DerivedStats; hand: string[]; followers: PlacedCard[]; chants: PlacedCard[] };
  activeWindow: { windowId:string; windowRevision:number; kind:string; pendingActorId:PlayerId; reason:string; participantIds:PlayerId[]; passedActorIds:PlayerId[]; passAhead:boolean } | null;
  standingPassActorIds: PlayerId[];
  actionCalculation:null|{actionId:string;actorId:string;cardInstanceId:string|null;abilityName?:string;effectLevel:number;damage:number|null;calculation:CalculationReadiness};
  currentAction: null|{source:'ability';technique?:{calculation?:CalculationReadiness;school?:string;range:string;attributes:string[];useLevel:number;effectLevel?:number;damage?:number|null;hitCount?:number};actionId:string;kind:string;actorId:PlayerId;targetIds:PlayerId[];stage:string;label:string;abilityId?:string;abilityName?:string;abilityEffectIds?:import('./abilities/frames.js').AbilityEffectId[]}|{ source:'card'|'follower';sourceZone?:'hand'|'followers'|'chant';coSourceZone?:'hand'|'followers'|'chant';coSourceCardInstanceId?:string;actionId:string;kind:string;actorId:PlayerId;cardInstanceId:string;targetIds:PlayerId[];stage:string;technique:{calculation?:CalculationReadiness;school?:string;range:string;attributes:string[];useLevel:number;effectLevel?:number;damage?:number|null;hitCount?:number} };
  currentAttack: null|{substitution?:{originalTargetId:string;originalHitIndex:number};reflection?:{source:'ability';actorId:string;sourceCardInstanceId:string};groupId:string;actionId:string;attackerId:PlayerId;targetIds:PlayerId[];hitIndex:number;targetId:PlayerId|null;reason:string;technique:{effectLevel:number;damage:number|null;attributes:string[];destructionEffects:string[];beastIgnore:boolean};defenseRestrictions:{maaiProhibited:boolean;evadeProhibited:boolean;counterProhibited:boolean;maaiBundleSize?:number;limitedDefenses?:('teleport'|'counter')[]};targets:{actorId:PlayerId;hits:{bodyDamage?:{directDamage:number|null;resistanceDamage:number;total:number};index:number;defended:boolean;hit:boolean;sourceCardInstanceId?:string;technique?:{effectLevel:number;damage:number|null;attributes:string[];destructionEffects:string[];beastIgnore:boolean};damageRollId?:string}[]}[]};
  currentRoll:PublicRollView|null;recentRolls:PublicRollView[];reactionTargetRollId:string|null;
  reactionTargetActionId:string|null;legalChoices: string[]; logs: LogView[]; privateLogs: LogView[];
}
function publicCards(cards: PlacedCard[]): CardBackView[] {
  return cards.map((card, position) => card.revealed ? { position, face: 'front', cardInstanceId: card.cardInstanceId } : { position, face: 'back' });
}
function logView(event: GameEvent, viewerId: PlayerId): LogView {
  const result: LogView = { id: event.id, at: event.at, type: event.type, actorId: event.actorId };
  // Public record types: each lists exactly the fields it may carry.
  const identityVisible=!event.concealed||event.actorId===viewerId;
  if((event.type==='TURN_STARTED'||event.type==='TURN_ENDED')&&event.turnNumber!==undefined)result.turnNumber=event.turnNumber;
  if(event.type==='REST'&&event.count!==undefined)result.count=event.count;
  if(event.type==='CARD_PLAYED'){result.cardInstanceId=event.cardInstanceId!;result.use=event.use!;if(event.targetIds)result.targetIds=[...event.targetIds];}
  if((event.type==='ABILITY_DECLARED'||event.type==='ABILITY_CANCELED')&&identityVisible){result.abilityId=event.abilityId!;if(event.targetIds)result.targetIds=[...event.targetIds];}
  // The attack itself is public even when its ability name is not; the target is what makes the line readable.
  if(event.type==='ATTACK_DECLARED'){if(event.targetIds)result.targetIds=[...event.targetIds];if(identityVisible)result.abilityId=event.abilityId!;}
  // Needing no check is visible at the table (G03 判定の公開範囲); only the ability behind it can be concealed.
  if(event.type==='CHECK_SKIPPED'){result.checkSkip=event.checkSkip!;if(identityVisible&&event.abilityId)result.abilityId=event.abilityId;}
  // Faces, total, rerolls, forced failure and the outcome are public; only the threshold belongs to a revealed seat (G03 判定の公開範囲).
  if(event.type==='ROLL_RESOLVED'&&event.roll){const r=event.roll;result.roll={rollId:r.rollId,kind:r.kind,faces:[...r.faces],total:r.total,attempt:r.attempt,...(r.forcedFailure?{forcedFailure:true as const}:{}),...(identityVisible&&r.threshold!==undefined?{threshold:r.threshold}:{}),...(r.success!==undefined?{success:r.success}:{})};}
  if(event.type==='DAMAGE_APPLIED'&&event.amount!==undefined)result.amount=event.amount;
  if(event.type==='STATUS_CHANGED'&&event.status)result.status={...event.status};
  if(event.type==='DISTANCE_CHANGED'){result.targetId=event.targetId!;result.distance=event.distance!;}
  if(event.type==='PASSED')result.windowKind=event.windowKind!;
  if(event.type==='PLAYER_DIED'&&event.death)result.death={cause:event.death.cause,eventId:event.death.eventId,...(event.death.sourceActorId?{sourceActorId:event.death.sourceActorId}:{}),...(event.death.sourceCardInstanceId?{sourceCardInstanceId:event.death.sourceCardInstanceId}:{})};
  if((event.type==='WISH_ACQUIRED'||event.type==='FOLLOWER_DESTROYED'||event.type==='CHARACTER_INSPECTED'||event.type==='CARD_GIFTED'||event.type==='BEAST_CAPTURED')&&event.targetId)result.targetId=event.targetId;
  if(event.type==='BEAST_CAPTURED'&&event.audience==='public'&&event.count!==undefined)result.count=event.count;
  // Explicit event-type allowlist prevents future private payload additions leaking via public events.
  if ((event.type==='WISH_ACQUIRED'&&event.cardInstanceId)||event.type==='WISH_DISCARDED'||event.type==='FOLLOWER_DESTROYED' || event.type === 'OPEN' || event.type === 'CARD_DRAWN' || (event.type==='CARD_GIFTED'||event.type==='BEAST_CAPTURED')&&event.audience!=='public') result.cardInstanceId = event.cardInstanceId!;
  if (event.type==='CHARACTER_INSPECTED'&&event.audience!=='public'||event.type === 'CHARACTER_REVEALED' || event.type === 'CHARACTER_ASSIGNED' || event.type==='CHARACTER_TRANSFORMED' || event.type==='PLAYER_REVIVED') result.characterId = event.characterId!;
  return result;
}
/** Follow only the persisted active parent chain; reaction frames need not own a group. */
function publicAttackContext(state: GameState): { group: AttackGroup; targetId: PlayerId | null } | undefined {
  let window: ReactionWindow | undefined = state.windows?.at(-1);
  const visitedWindows = new Set<string>();
  while (window && !visitedWindows.has(window.id)) {
    visitedWindows.add(window.id);
    const continuation = window.continuation;
    let actionId: string | undefined;
    if (continuation.kind === 'group') {
      const group = state.groups?.[continuation.id];
      if (group) return { group, targetId: continuation.targetId };
    } else if (continuation.kind === 'roll') {
      const resume = state.rolls?.find(roll => roll.id === continuation.id)?.resume;
      if (resume && 'groupId' in resume) {
        const group = state.groups?.[resume.groupId];
        if (group) return { group, targetId: resume.targetId };
      }
      if (resume && 'actionId' in resume) actionId = resume.actionId;
    } else actionId = continuation.id;
    const visitedActions = new Set<string>();
    while (actionId && !visitedActions.has(actionId)) {
      visitedActions.add(actionId);
      const action = state.actions?.[actionId];
      if (!action) break;
      const group = action.groupId ? state.groups?.[action.groupId] : undefined;
      if (group) return { group, targetId: action.actorId };
      actionId = action.targetActionId;
    }
    const parentId: string | null = window.parentId;
    window = parentId ? state.windows?.find(parent => parent.id === parentId) : undefined;
  }
  return undefined;
}
/** Public paid technique under an interrupting ability, reaction or roll. */
function publicCalculationAction(state:GameState):import('./reactions/continuations.js').ActionFrame|undefined {
 let window=state.windows?.at(-1);const seen=new Set<string>();
 while(window&&!seen.has(window.id)){
  seen.add(window.id);const c=window.continuation;
  let actionId:string|undefined;let abilityId:string|undefined;
  if(c.kind==='action')actionId=c.id;
  if(c.kind==='ability')abilityId=c.id;
  if(c.kind==='roll'){const resume=state.rolls?.find(r=>r.id===c.id)?.resume;if(resume&&'actionId' in resume)actionId=resume.actionId;if(resume?.kind==='ability')abilityId=resume.abilityId;}
  if(c.kind==='group'){const g=state.groups?.[c.id];if(g)actionId=currentHit(g,c.targetId??undefined)?.sourceActionId??g.actionId;}
  const ability=abilityId?state.abilities?.[abilityId]:undefined;if(ability?.context.kind==='action')actionId=ability.context.actionId;
  const action=actionId?state.actions?.[actionId]:undefined;
  if(action&&realTechnique(action)&&!action.bundleFailed)return action;
  window=state.windows?.find(w=>w.id===window!.parentId);
 }
}
export function viewFor(state: GameState, viewerId: PlayerId): PlayerView {
  if (!Object.hasOwn(state.players, viewerId)) throw new Error('UNKNOWN_VIEWER');
  const self = state.players[viewerId]!;
  const active=state.windows?.at(-1);const hasPriority=active?.participants[active.cursor]===viewerId;
  const roll=visibleRoll(state);const rollResume=roll?.resume;
  const rollAction=rollResume&&'actionId' in rollResume?state.actions?.[rollResume.actionId]:undefined;
  const attackContext=publicAttackContext(state);
  const activeContinuation=active?.continuation.kind==='action'?state.actions?.[active.continuation.id]:undefined;
  const activeGroup=attackContext?.group;
  const activeAbility=active?.continuation.kind==='ability'?state.abilities?.[active.continuation.id]:undefined;
  const rollAbility=rollResume?.kind==='ability'?state.abilities?.[rollResume.abilityId]:undefined;
  const projectedAbility=activeAbility??(!activeContinuation?rollAbility:undefined);
  const currentTarget=activeGroup?.targets.find(t=>t.actorId===attackContext?.targetId);
  const currentSourceHit=activeGroup?(active?.kind==='hit-abilities'?currentTarget?.hits.find(h=>!h.defended&&h.abilityBudget&&!h.abilityBudget.closed):activeGroup.stage==='followers'?currentTarget?.hits.find(h=>!h.defended):currentHit(activeGroup,attackContext?.targetId??undefined)):undefined;
  const projectedAction=activeContinuation??rollAction??(activeGroup?state.actions?.[currentSourceHit?.sourceActionId??activeGroup.actionId]:undefined);
  const activeTechnique=activeGroup?(currentTarget&&currentSourceHit?effectiveHitTechnique(state,activeGroup,currentTarget,currentSourceHit):currentEffectiveTechnique(state,activeGroup,attackContext?.targetId??undefined)):undefined;
  const shadowJumpCost=shadowJumpCostView(state,viewerId);
  const stopped=hasStatus(self,'stopped');
  const canCancelReaction=hasPriority&&!stopped&&activeContinuation?.kind==='reaction'&&activeContinuation.cardInstanceId==='a2-p02-r2c3'&&self.revealed&&getCharacter(self.characterId)?.name==='占星術師のアルセイル';
  const distanceChoice=activeContinuation?.kind==='distance'?(activeContinuation.distanceMode==='approach'?(viewerId===activeContinuation.actorId?'PLAY_ADVANCE':'PLAY_MAAI'):(viewerId===activeContinuation.actorId?'PLAY_MAAI':'PLAY_ADVANCE')):undefined;
  let legalChoices=hasPriority?['PASS',...(canChooseDarkSaintIgnore(state,viewerId)?['CHOOSE_DARK_SAINT_IGNORE']:[]),...(active!.kind==='on-hit-choice'&&!hasPendingFatal(state,viewerId)?['DISCARD_HIT_CHANTS']:[]),...(active!.kind==='follower-bypass-choice'?['CHOOSE_FOLLOWER_BYPASS']:[]),...(active!.kind==='normal-defense'?[...(!stopped&&!activeTechnique?.maaiProhibited?['PLAY_MAAI']:[]),...(!stopped?['PLAY_DEFENSE']:[]),'START_FOLLOWERS']:[]),...(active!.kind==='defense-advance'&&!stopped?['PLAY_ADVANCE']:[]),...(distanceChoice&&!stopped?[distanceChoice]:[]),...(active!.kind==='declaration'||active!.kind==='before-roll'||active!.kind==='after-roll'||active!.kind==='effect-level')&&!stopped?['PLAY_REACTION']:[],...(canCancelReaction?['CANCEL_REACTION']:[])]:[];
  if(!active){const current=state.seatOrder[state.turnSeat]===viewerId;if(state.phase==='setup'){legalChoices=[...(!self.revealed?['REVEAL_CHARACTER']:[]),...(state.pending?.participantIds.includes(viewerId)&&!state.pending.readyIds.includes(viewerId)?['PLACE_INITIAL_FOLLOWER','PASS_SETUP']:[])];}else if(current){if(state.phase==='turn-start')legalChoices=['START_TURN'];else if(state.phase==='draw')legalChoices=['CHOOSE_DRAW'];else if(state.phase==='action')legalChoices=[...(!stopped?['ATTACK','APPROACH','CHANT','ARRANGE_FOLLOWERS','REST','PLAY_TURN_CARD','PLAY_TURN_TECHNIQUE']:[]),'PASS_ACTION'];else if(state.phase==='withdrawal')legalChoices=[...(!stopped?['WITHDRAW']:[]),'PASS_WITHDRAWAL'];else if(state.phase==='hand-adjustment')legalChoices=['END_TURN'];}}
  if(substituteRestricted(state,viewerId))legalChoices=legalChoices.filter(c=>!['START_FOLLOWERS','PLAY_MAAI','PLAY_REACTION','CANCEL_REACTION','PLAY_GROUP_DEFENSE'].includes(c));
  const anytimeOptions=active?.kind==='wish'||active?.kind==='wish-capacity'?[]:anytimeCardOptions(state,viewerId);if(anytimeOptions.length)legalChoices.push('PLAY_ANYTIME_CARD');
  const groupDefenseOptions=substituteRestricted(state,viewerId)?[]:availableGroupDefenses(state,viewerId);
  if(groupDefenseOptions.length)legalChoices.push('PLAY_GROUP_DEFENSE');
  const bundleOptions=followerBundleOptions(state,viewerId);if(bundleOptions.length)legalChoices.push('USE_FOLLOWER_ATTACK');
  const choices=sourceChoices(state,viewerId);
  const techniqueDecision:PlayerView['techniqueDecision']=hasPriority&&active?.kind==='technique-double-choice'&&activeContinuation?{kind:'damage-double',actionId:activeContinuation.id,actorId:viewerId,sourceCardInstanceId:physicalActionCard(activeContinuation)}:hasPriority&&active?.kind==='hit-advance-choice'&&activeGroup?{kind:'hit-advance',groupId:activeGroup.id,actorId:viewerId,sourceCardInstanceId:physicalActionCard(state.actions![activeGroup.actionId]!),cardInstanceIds:advanceCards(state,viewerId)}:null;
  if(techniqueDecision)legalChoices=[techniqueDecision.kind==='damage-double'?'CHOOSE_DAMAGE_DOUBLE':'PAY_HIT_ADVANCES','PASS'];
  const additionalAttack:PlayerView['additionalAttack']=active?.kind==='ability-attack'?activeContinuation?.printedGrant?{source:'card',actorId:activeContinuation.actorId,targetId:activeContinuation.printedGrant.targetId,sourceCardInstanceId:physicalActionCard(activeContinuation)}:activeAbility?{...(activeAbility.shadowJump?{shadowJump:true as const}:{}),source:'ability',actorId:activeAbility.actorId,targetId:activeAbility.targetIds[0]!}:null:null;
  const lifetimeDecision:LifetimeDecision|null=hasPriority&&active!.kind==='lifetime-effect-choice'&&activeGroup&&active!.continuation.kind==='group'?{kind:lifetimeDecisionKind(activeGroup),actorId:viewerId,targetId:active!.continuation.targetId!,sourceCardInstanceId:physicalActionCard(state.actions![activeGroup.actionId]!),choices:['apply','decline']}:null;
  if(lifetimeDecision)legalChoices=['CHOOSE_LIFETIME_EFFECT','PASS'];
  const lifecycleTask=active?.continuation.kind==='lifecycle'?state.lifecycle?.find(t=>t.id===active.continuation.id):undefined;
  const lifecycleActor=active?.participants[active.cursor];
  let lifecycleDecision:LifecycleDecision|null=null;
  const chamGift=chamGiftOption(state,viewerId);
  if(lifecycleTask&&lifecycleActor&&['death-gift','revival','re-setup','lifecycle-boundary'].includes(active!.kind)){lifecycleDecision={...(chamGift?{chamGift}:{}),kind:active!.kind as LifecycleDecision['kind'],actorId:lifecycleActor,eligibleTargetIds:lifecycleTask.kind==='death-batch'?eligibleGiftRecipients(state,lifecycleTask.id,lifecycleActor):state.seatOrder.filter(id=>id!==lifecycleActor&&isActive(state.players[id]!)),...(lifecycleTask.kind==='fusen'?{sourceCardInstanceId:lifecycleTask.sourceCardInstanceId}:{})};if(hasPriority){if(active!.kind==='revival')legalChoices=['CHOOSE_REVIVAL','PASS'];else if(active!.kind==='re-setup')legalChoices=['PLACE_INITIAL_FOLLOWER','PASS_SETUP'];else if(active!.kind==='death-gift')legalChoices=['PASS',...(chamGift?['CHAM_DEATH_GIFT']:[]),...(self.hand.some(id=>id===(self.faction==='EVIL'?'a2-p02-r3c2':self.faction==='GOOD'?'a2-p02-r3c3':''))?['PLAY_DEATH_GIFT']:[])];}}
  const beastCapture=beastCaptureView(state,viewerId);if(beastCapture)legalChoices=['CHOOSE_BEAST_CAPTURE','PASS'];
  const conditionalAbilities=active?.kind==='wish'||active?.kind==='wish-capacity'?[]:conditionalAbilitySettings(state,viewerId);if(conditionalAbilities.some(o=>o.canActivate||o.canDeactivate))legalChoices.push('SET_CONDITIONAL_ABILITY');
  const abilityOptions=['reclaim','wish','wish-capacity'].includes(active?.kind??'')?[]:availableAbilities(state,viewerId);if(abilityOptions.length)legalChoices.push('USE_ABILITY');
  if(shadowJumpCost?.cardInstanceIds.length)legalChoices.push('PAY_SHADOW_JUMP');
  if(hasPriority&&active?.kind==='ability-attack'&&!stopped)legalChoices.push('ATTACK');
  const lifecycleAbilities=['reclaim','wish','wish-capacity'].includes(active?.kind??'')?[]:availableLifecycleAbilities(state,viewerId);if(lifecycleAbilities.length)legalChoices.push('USE_LIFECYCLE_ABILITY');
  if(isActive(self)&&!stopped&&!state.outcome&&state.phase!=='setup'&&(!active||hasPriority)){if(self.characterId==='c2-p06-r1c2'&&self.hand.includes('a2-p05-r1c1'))legalChoices.push('TRANSFER_RITUAL');if(!active&&state.phase==='action'&&state.seatOrder[state.turnSeat]===viewerId&&self.characterId==='c2-p05-r1c1'&&self.hand.includes('a2-p05-r1c1'))legalChoices.push('USE_REVIVAL_RITUAL');}
  if(!isActive(self)&&!hasPriority)legalChoices=[];
  if(state.outcome)legalChoices=[];
  if(isActive(self)&&!state.outcome&&!self.revealed&&!legalChoices.includes('REVEAL_CHARACTER'))legalChoices.unshift('REVEAL_CHARACTER');
  if(active?.kind==='private-inspection')legalChoices=hasPriority?['CHOOSE_INSPECTION','PASS',...(!self.revealed?['REVEAL_CHARACTER']:[])]:!self.revealed&&isActive(self)?['REVEAL_CHARACTER']:[];
  if(active?.kind==='wish'||active?.kind==='wish-capacity')legalChoices=hasPriority?[active.kind==='wish'?'CHOOSE_WISH':'CHOOSE_WISH_CAPACITY']:[];
  if(active?.kind==='reclaim')legalChoices=[...(hasPriority?['CHOOSE_RECLAIM','PASS']:[]),...(!self.revealed&&isActive(self)?['REVEAL_CHARACTER']:[])];
  // Passing needs no priority on a public window; only the interventions below it still do (G03).
  if(active&&isActive(self)&&!state.outcome){
    const standing=state.standingPasses?.actorIds.includes(viewerId)??false;
    if(passAhead(active)&&active.participants.includes(viewerId)&&!active.passed.includes(viewerId)){
      if(!legalChoices.includes('PASS'))legalChoices.push('PASS');
      if(!standing)legalChoices.push('PASS_ACTION_THROUGH');
    }
    // Taking the action back is offered on every window, including the ones this seat is not asked in (G03).
    if(standing&&!legalChoices.includes('CANCEL_PASS_THROUGH'))legalChoices.push('CANCEL_PASS_THROUGH');
  }
  const calculationSource=publicCalculationAction(state)??(projectedAction&&realTechnique(projectedAction)?projectedAction:undefined);
  const actionCalculation:PlayerView['actionCalculation']=calculationSource?{actionId:calculationSource.id,actorId:calculationSource.actorId,cardInstanceId:calculationSource.cardInstanceId,...(calculationSource.source?.kind==='ability'?{abilityName:VIRTUAL_BLADES[calculationSource.source.abilityId].name}:{}),effectLevel:effectPreview(state,calculationSource),damage:damagePreview(state,calculationSource),calculation:calculationReadiness(calculationSource)}:null;
  let currentAction:PlayerView['currentAction']=null;if(projectedAction){const technique:Extract<NonNullable<PlayerView['currentAction']>,{source:'card'|'follower'}>['technique']={school:projectedAction.technique.school,range:projectedAction.technique.range,attributes:[...projectedAction.technique.attributes],useLevel:projectedAction.technique.useLevel};if(realTechnique(projectedAction)){technique.calculation=calculationReadiness(projectedAction);if(['effect-level','damage','resolve'].includes(projectedAction.stage))technique.effectLevel=effectPreview(state,projectedAction);if(['damage','resolve'].includes(projectedAction.stage))technique.damage=damagePreview(state,projectedAction);}else {
    // Copied reflections already own frozen values; eligibility must not hide them or recompute printed modifiers.
    if(['damage','resolve'].includes(projectedAction.stage))technique.effectLevel=projectedAction.technique.effectLevel;
    if(projectedAction.stage==='resolve')technique.damage=projectedAction.technique.damage;
  }if(projectedAction.stage==='resolve'&&typeof projectedAction.technique.hitCount==='number')technique.hitCount=projectedAction.technique.hitCount;currentAction=projectedAction.source?.kind==='ability'?{source:'ability',actionId:projectedAction.id,kind:projectedAction.kind,actorId:projectedAction.actorId,targetIds:[...projectedAction.targetIds],stage:projectedAction.stage,label:VIRTUAL_BLADES[projectedAction.source.abilityId].name,abilityId:projectedAction.source.abilityId,abilityName:VIRTUAL_BLADES[projectedAction.source.abilityId].name,technique}:{...(projectedAction.sourceZone?{sourceZone:projectedAction.sourceZone}:{}),...(projectedAction.coSource?{coSourceZone:projectedAction.coSource.fromFollowers?'followers':projectedAction.coSource.fromChant?'chant':'hand'}:{}),source:projectedAction.followerOrigin?'follower':'card',...(projectedAction.coSource?{coSourceCardInstanceId:projectedAction.coSource.cardInstanceId}:{}),actionId:projectedAction.id,kind:projectedAction.kind,actorId:projectedAction.actorId,cardInstanceId:physicalActionCard(projectedAction),targetIds:[...projectedAction.targetIds],stage:projectedAction.stage,technique};}
  if(currentAction?.technique&&activeGroup&&projectedAction?.id===(currentSourceHit?.sourceActionId??activeGroup.actionId)){const current=activeTechnique!;currentAction.technique.school=current.school;currentAction.technique.attributes=[...current.attributes];}
  if(projectedAction?.abilityReflection){
    const visible=projectedAction.actorId===viewerId||state.players[projectedAction.actorId]!.revealed;
    const id=projectedAction.abilityReflection.abilityId,name=ABILITIES[id].name;
    currentAction={source:'ability',actionId:projectedAction.id,kind:'ability',actorId:projectedAction.actorId,targetIds:[...projectedAction.targetIds],stage:'child-attack',label:visible?name:'特殊能力',...(visible?{abilityId:id,abilityName:name}:{})};
  }
  if(projectedAbility){const visible=projectedAbility.actorId===viewerId||state.players[projectedAbility.actorId]!.revealed;const name=ABILITIES[projectedAbility.abilityId].name;currentAction={source:'ability',actionId:projectedAbility.id,kind:'ability',actorId:projectedAbility.actorId,targetIds:!visible&&projectedAbility.context.kind==='conditional-stat'?[]:[...projectedAbility.targetIds],stage:projectedAbility.stage,label:visible?name:'特殊能力',...(visible?{abilityId:projectedAbility.abilityId,abilityName:name,...(projectedAbility.abilityEffectIds?{abilityEffectIds:[...projectedAbility.abilityEffectIds]}:{})}:{})};}
  const entryWindow=state.windows?.find(w=>w.kind==='follower-entry-abilities'&&w.continuation.kind==='group'&&w.continuation.id===activeGroup?.id);
  const followerEntry:PlayerView['followerEntry']=entryWindow&&activeGroup&&currentTarget?{groupId:activeGroup.id,targetId:currentTarget.actorId,attackerId:activeGroup.attackerId,reason:'before-follower-snapshot',virtualGuardSelected:!!currentTarget.virtualGuardActorId}:null;
  const followerDefenseResults:PlayerView['followerDefenseResults']=activeGroup?.targets.flatMap(t=>(t.followerDefense??[]).filter(d=>d.hits.length>0).map(d=>({targetId:t.actorId,source:d.source,position:d.position,...(d.source==='physical'&&(viewerId===t.actorId||d.identityPublic)?{cardInstanceId:d.cardInstanceId}:{}),hits:d.hits.map(h=>({...h}))})))??[];
  const virtualFollowerDefense:PlayerView['virtualFollowerDefense']=activeGroup?.targets.flatMap(t=>(t.followerDefense??[]).flatMap(d=>d.source==='virtual'?[{source:'virtual' as const,sourceId:d.sourceId,targetId:t.actorId,position:-1 as const,name:'女性親衛隊',levels:[...d.levels],hp:d.descriptor.hp,attributes:[...d.descriptor.attributes],moraleRequired:false as const,cancelIgnore:true as const,hits:d.hits.map(h=>({...h}))}]:[]))??[];
  const bundle=Object.values(state.followerBundles??{}).at(-1);
  const followerBundle:PlayerView['followerBundle']=bundle?{bundleId:bundle.id,actorId:bundle.actorId,stage:bundle.stage,currentSourceIndex:bundle.stage==='grant'?null:bundle.stage==='prepare'?bundle.cursor:currentSourceHit?.sourceActionId?bundle.actionIds.indexOf(currentSourceHit.sourceActionId):null,sources:bundle.actionIds.map((id,index)=>{const a=state.actions![id]!;return {cardInstanceId:physicalActionCard(a),sourceZone:a.sourceZone as 'hand'|'followers',dedicated:!!a.followerDedicated,targetIds:[...a.targetIds],stage:a.bundleFailed?'failed':bundle.stage==='grant'||bundle.stage==='prepare'&&index>bundle.cursor?'reserved':a.stage,technique:{calculation:calculationReadiness(a),range:a.technique.range,school:a.technique.school,attributes:[...a.technique.attributes],useLevel:a.technique.useLevel,effectLevel:effectPreview(state,a),damage:damagePreview(state,a),hitCount:a.technique.hitCount},...(a.damageRollId?{damageRollId:a.damageRollId}:{}),...(a.effectLevelRollId?{effectLevelRollId:a.effectLevelRollId}:{})};})}:null;
  const currentAttack:PlayerView['currentAttack']=activeGroup?{...(activeGroup.substituteOrigin?{substitution:{originalTargetId:activeGroup.substituteOrigin.targetId,originalHitIndex:activeGroup.substituteOrigin.hitIndex}}:{}),...(state.actions![activeGroup.actionId]!.abilityReflection?{reflection:{source:'ability' as const,actorId:activeGroup.attackerId,sourceCardInstanceId:state.actions![activeGroup.actionId]!.effectSourceCardInstanceId!}}:{}),groupId:activeGroup.id,actionId:activeGroup.actionId,attackerId:activeGroup.attackerId,targetIds:activeGroup.targets.map(target=>target.actorId),hitIndex:currentSourceHit?.index??activeGroup.hitCursor,targetId:attackContext!.targetId,reason:active!.kind,technique:{effectLevel:activeTechnique!.effectLevel,damage:activeTechnique!.damage,attributes:[...activeTechnique!.attributes],destructionEffects:destructionEffects(activeTechnique!),beastIgnore:hasBeastIgnore(activeTechnique!)},defenseRestrictions:{...(activeTechnique!.maaiAtomic?{maaiBundleSize:Math.max(1,(activeTechnique!.maaiRequired??1)-(currentSourceHit?.maaiProgress??0))}:{}),maaiProhibited:!!activeGroup.substituteOrigin||!!activeTechnique!.maaiProhibited,evadeProhibited:!!activeGroup.substituteOrigin||!!activeTechnique!.evadeProhibited||activeTechnique!.attributes.includes('精'),counterProhibited:!!activeTechnique!.counterProhibited,...(activeGroup.substituteOrigin?{limitedDefenses:activeTechnique!.limitedDefenses&&!activeTechnique!.limitedDefenses.includes('counter')?[]:['counter' as const]}:activeTechnique!.limitedDefenses?{limitedDefenses:[...activeTechnique!.limitedDefenses]}:{})},targets:activeGroup.targets.map(target=>({actorId:target.actorId,hits:target.hits.map(hit=>{const technique=effectiveHitTechnique(state,activeGroup,target,hit);return {...(hit.bodyDamage?{bodyDamage:{...hit.bodyDamage}}:{}),index:hit.index,defended:hit.defended,hit:hit.hit,...(hit.sourceCardInstanceId?{sourceCardInstanceId:hit.sourceCardInstanceId}:{}),technique:{effectLevel:technique.effectLevel,damage:hit.damage,attributes:[...technique.attributes],destructionEffects:destructionEffects(technique),beastIgnore:hasBeastIgnore(technique)},...(hit.damageRollId?{damageRollId:hit.damageRollId}:{})};})}))}:null;
  const players: Record<PlayerId, PublicPlayerView> = {};
  for (const id of state.seatOrder) {
    const p = state.players[id]!;
    const view: PublicPlayerView = { pendingFatal:hasPendingFatal(state,p.id),skipsNextTurn:(p.skipTurns??0)>0,id: p.id, name: p.name, presence:p.presence??'active', revealed: p.revealed, damage: p.damage, handCount: p.hand.length,
      followers: publicCards(p.followers), chants: publicCards(p.chants), chantCount: p.chants.length, open: [...p.open], attachments: [...p.attachments], statuses:(p.statuses??[]).map(status=>status.timing==='next-own-seat'?{kind:'stopped' as const,timing:'next-own-seat' as const,expiresOnActorId:status.expiresOnActorId}:({... (status.sourceActorId?{sourceActorId:status.sourceActorId}:{}),...(status.sourceCardInstanceId?{sourceCardInstanceId:status.sourceCardInstanceId}:{}),...(status.timing==='source-turn'?{kind:'stopped' as const,timing:'source-turn' as const,sourceActorId:status.sourceActorId,sourceCardInstanceId:status.sourceCardInstanceId}:status.timing==='fixed-turns'?{kind:'stopped' as const,timing:'fixed-turns' as const,remainingTurns:status.remainingTurns}:status.timing==='until-death'?{kind:'stat-drain' as const,timing:'until-death' as const,amount:status.amount}:{kind:status.kind,...(status.timing?{timing:status.timing}:{}),recoveryModifier:status.modifiers[Math.min(status.nextCheck,status.modifiers.length-1)]??0,nextCheck:status.nextCheck})})) };
    if (p.revealed) view.characterId = p.characterId;
    players[id] = view;
  }
  return {shadowJumpCost,allArmyOptions:allArmyOptions(state,viewerId),printedCombinationOptions:printedCombinationOptions(state,viewerId),wish:wishView(state,viewerId),wishCapacity:wishCapacityView(state,viewerId),wishOptions:wishOptions(state,viewerId), turnChoiceCardOptions:turnChoiceCardOptions(state,viewerId),turnCardOptions:turnCardOptions(state,viewerId),anytimeCardOptions:anytimeOptions,reservedCards:state.reclaimReservations.filter(id=>state.reclaim?.[id]?.ownerId===viewerId),reclaim:reclaimView(state,viewerId),suppressionTargets:suppressionTargetViews(state,viewerId),sadLove:sadLoveView(state,viewerId),conditionalAbilities,inspection:inspectionView(state,viewerId),inspectionHistory:structuredClone((state.inspectionHistory??[]).filter(d=>d.actorId===viewerId)),peaceExpiries:peaceExpiryViews(state),spiritExpiry:spiritExpiryView(self,state),drawAbilityOptions:drawAbilityOptions(state,viewerId),revealAbilityOptions:revealAbilityOptions(state,viewerId),declarationCandidates:declarationCandidates(state,viewerId),declarationSelection:declarationSelection(state,viewerId),distanceExchange:distanceExchangeView(state),virtualBladeOptions:virtualBladeOptions(state,viewerId),maaiAbilityOptions:maaiAbilityOptions(state,viewerId),maaiDefense:maaiDefenseView(state,effectiveHitTechnique),beastCapture,followerEntry,followerDefenseResults,virtualFollowerDefense,followerBundleOptions:bundleOptions,followerBundle,followerAttackOptions:followerAttackOptions(state,viewerId),followerDefenseOptions:!substituteRestricted(state,viewerId)&&hasPriority&&active?.kind==='normal-defense'?self.followers.filter(f=>canSelectFollowerDedicated(f.cardInstanceId,self.characterId)).map(f=>({cardInstanceId:f.cardInstanceId})):[],followerPlacementOptions:followerPlacementOptions(self),magicGateTargets:magicGateTargets(state,viewerId),additionalAttackOptions:additionalAttackOptions(state,viewerId),...choices,groupDefenseOptions,techniqueDecision,additionalAttack,abilityOptions,reactionTargetAbilityId:activeAbility?.stage==='declaration'&&!activeAbility.printedCardResponse&&!activeAbility.canceled?activeAbility.id:null,lifetimeDecision,outcome:state.outcome?structuredClone(state.outcome):null,individualResults:{...state.individualResults},lifecycleDecision,lifecycleAbilities, rulesetVersion: state.rulesetVersion, revision: state.revision, phase: state.phase, seatOrder: [...state.seatOrder], turnSeat: state.turnSeat,
    pending: state.pending ? { kind: state.pending.kind, round: state.pending.round, participantIds: [...state.pending.participantIds], readyIds: [...state.pending.readyIds] } : null,
    deckCount: state.deck.length, discardCount: state.discard.length, distances: Object.fromEntries(state.seatOrder.map(a => [a, Object.fromEntries(state.seatOrder.filter(b => a !== b).map(b => [b, state.distances[a]![b]!]))])), distanceMarkers:Object.values(state.distanceMarkers??{}).map(marker=>({...marker})), players,
    activeWindow:active?{windowId:active.id,windowRevision:active.revision,kind:active.kind,pendingActorId:active.participants[active.cursor]!,reason:active.kind,participantIds:[...active.participants],passedActorIds:[...active.passed],passAhead:passAhead(active)}:null,standingPassActorIds:[...(state.standingPasses?.actorIds??[])],actionCalculation,currentAction,currentAttack,reactionTargetActionId:projectedAbility?null:activeContinuation?.id??rollAction?.id??(activeGroup?.actionId??null),currentRoll:roll?projectRoll(state,roll,viewerId):null,recentRolls:(state.rolls??[]).slice(-30).map(frame=>projectRoll(state,frame,viewerId)),reactionTargetRollId:unresolvedRoll(state)?.id??null,legalChoices,
    self: { currentObjective:structuredClone(self.currentObjective??factionObjective(self.faction)),protection:structuredClone(self.protection??initialProtection(self.characterId)),defeatCondition:currentDefeatCondition(self),id: self.id, characterId: self.characterId, faction: self.faction, objective: self.objective, damage: self.damage, stats: gameStats(state,self.id), hand: [...self.hand],
      followers: self.followers.map(c => ({ cardInstanceId: c.cardInstanceId, revealed: c.revealed })), chants: self.chants.map(c => ({ cardInstanceId: c.cardInstanceId, revealed: c.revealed })) },
    logs: state.events.filter(e => e.audience === 'public').map(e => logView(e, viewerId)),
    privateLogs: state.events.filter(e => e.audience !== 'public' && e.audience.playerId === viewerId).map(e => logView(e, viewerId)) };
}
