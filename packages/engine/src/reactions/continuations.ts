export type WindowKind = 'private-inspection' | 'beast-capture' | 'follower-entry-abilities' | 'technique-double-choice' | 'hit-advance-choice' | 'attack-abilities' | 'hit-abilities' | 'ability-attack' | 'lifetime-effect-choice' | 'death-gift' | 'revival' | 're-setup' | 'lifecycle-boundary' | 'declaration' | 'before-roll' | 'after-roll' | 'effect-level' | 'damage' | 'normal-defense' | 'defense-advance' | 'approach' | 'withdrawal' | 'follower-bypass-choice' | 'follower-start' | 'hit' | 'on-hit-choice';
export type Continuation = {kind:'inspection';id:string} | {kind:'ability';id:string} | {kind:'lifecycle';id:string} | { kind: 'roll'; id: string } | { kind: 'action'; id: string } | { kind: 'group'; id: string; targetId: string | null };
export interface ReactionWindow {
  id: string; revision: number; kind: WindowKind; parentId: string | null;
  participants: string[]; cursor: number; passed: string[]; eventId: string; continuation: Continuation;
}
export interface EffectContract { conditions: ('in-hand-or-chant'|'own-action'|'normal-defense'|'priority'|'character-specific')[]; costs:{kind:'physical-card';at:'accept'}[]; timing:WindowKind[];targets:'self'|'declared-players'|'parent-action';lifetime:'instant'|'hit'|'attack-group'|'parent-event'|'persistent' }
export interface Technique {
  stopUntilSourceTurn?:boolean;mandatoryAll?:boolean;effectLevelFormula?:'d6';damageAdditive?:number;damageMultiplier?:number;
  combinable?:boolean;advanceEffectCost?:boolean;postHitAdvances?:boolean;criticalAttempts?:number;optionalDamageDouble?:boolean;randomExtraMaai?:boolean;dragonKingHit?:boolean;groupSubstitution?:boolean;deathSongResistance?:boolean;
  fixedNegate?:{automatic:boolean;shinImmune?:boolean;grantAttack?:boolean;forbiddenAttributes?:string[]};
  school: 'warrior' | 'magic'; range: 'near' | 'far' | 'none'; useLevel: number; effectLevel: number; damage: number | null;
  attributes: string[]; counter: boolean; chant: boolean; noChecks: boolean;
  defense: 'none' | 'evade' | 'teleport' | 'counter' | 'parry' | 'reflect' | 'negate' | 'fixed-negate';
  hitCount: number | 'd6'; target: 'one' | 'all'; maxTargets?: number; followerIgnore: boolean;
  reflectMagicLimit?: number; blockWarriorLimit?: number;
  relativeDefenseLimits?:{warriorOffset:number;magicOffset:number};
  damageFormula?: 'd6' | 'd6x5' | 'd6x2' | 'd6x4' | '2d6x2' | 'attacker-spirit' | 'attacker-spirit-x2' | 'attacker-magic-x2' | 'attacker-magic-x3' | 'd6-product-min10' | '2d6' | '3d6' | '4d6+1'; counterCheck?: boolean; counterNoChecks?: boolean; counterIgnoresLevel?:boolean; counterReturnFollowerIgnore?:boolean; onHitStatus?: { kind:'silenced'; modifiers:number[] };
  onHitResistance?: {
    modifiers:number[];
    statusKind?:'stopped'|'silenced'|'ability-disabled';
    failureDamage?:number;
    targetOverrides?:{characterNames:string[];modifiers:number[]}[];
  };
  lifetimeHit?:{kind:'instant-death'|'petrification'|'otherworld'|'soul-drain'|'deadly-stop'|'fixed-stop';modifier:number;optional?:boolean};
  selfCost?:{damage:number;destroyFollowers:true};
  turnEffect?:'heal-self'|'heal-near'|'revive'|'magic-gate';
  revivalConversion?:boolean;
  limitedDefenses?:('teleport'|'counter')[];
  prohibitedFactions?:('GOOD'|'EVIL'|'ヴァンミール')[];
  useLevelSource?: 'incoming-effect' | 'own-spirit' | 'own-warrior'; activationCheckModifier?: number; onHitDiscardChants?: boolean;
  maaiRequired?: number; evadeProhibited?: boolean; followerHpIgnore?: boolean;
  maaiProhibited?:boolean;counterProhibited?:boolean;optionalFollowerBypassAtOrBelowEffectLevel?:boolean;ignoreFollowerAttributes?:string[];
  destroyFollowerAttributes?: string[]; destroyFollowersAtOrBelowEffectLevel?: boolean;
  destroyAllFollowers?: boolean; destroyFollowersAtOrBelow?: number; destroyFollowerAttributesAtOrBelowEffectLevel?: string[];
  destroyFollowerExemptAttributes?:string[];destroyAllFollowersExceptAttributes?:string[];personalImmunityCharacterNames?:string[];
  characterDamageMultipliers?: { characterNames:string[]; multiplier:number }[];
  optionalChant?: boolean; chantDamageMultiplier?: number;
  characterImmunityExceptions?: { characterName:string; immunity:'spirit-techniques' }[];
  contract:EffectContract;
}
export interface ActionFrame {
  declaration?:import('../abilities/declaration-resolution.js').SavedDeclaration;
  abilityReflection?:{abilityId:import('../abilities/frames.js').AbilityId;parentGroupId:string;targetId:string;hitIndex:number};
  destructionModifiers?:import('../abilities/follower-destruction.js').SelectedDestructionModifier[];whiteSwordDamageMultiplier?:boolean;fixedReceivedEffect?:boolean;
  modifiers?:import('../abilities/action-modifiers.js').ActionModifiers;
  useLevelPrepared?:boolean;followerDedicated?:boolean;followerBundleId?:string;bundleFailed?:boolean;
  sourceZone?:'hand'|'followers'|'chant';effectLevelRollId?:string;
  effectSourceCardInstanceId?:string;
  followerOrigin?:{cardInstanceId:string;parentGroupId:string;targetId:string;hitIndex:number};
  followerTransfer?:{donorId:string;cardInstanceId:string;destinationPosition:number};
  coSource?:{cardInstanceId:string;dedicated:boolean;technique:Technique;fromChant:boolean;fromFollowers?:boolean};sourceCardInstanceIds?:string[];sourceDamageRollIds?:string[];
  valuesPrepared?:boolean;combinationBaseAdded?:boolean;advanceCosts?:string[];doubleChoice?:boolean;doubleRollId?:string;doubleApplied?:boolean;extraMaaiRollId?:string;
  fixedDefenseRollId?:string;fixedDefenseResolved?:boolean;printedGrant?:{source:'card';actorId:string;targetId:string;stage:'choice'|'child'};grantReturnActionId?:string;
  substitution?:{groupId:string;hits:{targetId:string;hitIndex:number}[];rollId?:string;resolved?:boolean};
  id: string; eventId: string; parentWindowId: string | null; actorId: string; cardInstanceId: string;
  kind: 'attack' | 'defense' | 'reaction' | 'distance' | 'lifecycle' | 'turn-technique' | 'follower-reflection' | 'ability-reflection';
  convertTargetIds?:string[];selfCostSettled?:boolean;
  lifecycleEffect?:{kind:'gift';giftCardInstanceId:string;targetId:string}|{kind:'ritual'}; targetIds: string[]; technique: Technique; groupId: string | null;
  stage: 'declaration' | 'checks' | 'check-result' | 'effect-level' | 'damage' | 'resolve';
  checks: number[]; checkSpecs?: {purpose:'activation'|'excess-level'|'teleport'|'counter';modifier:number}[]; checkRollId?:string; hitCountRollId?:string; roll: { dice: number[]; threshold: number; success: boolean } | null; canceled: boolean;
  targetAbilityId?:string; abilityReturnId?:string;
  reactionMode?: 'cancel-ability'|'cancel'|'force-fail'|'effect-plus'|'reroll'; targetActionId?: string; targetRollId?:string; reactionAmount?: number;
  reactionDedicated?: boolean;
  resume?: { groupId:string; targetId:string; hitIndex:number; preserveWindow?:boolean }; lineage?: string[];
  distanceMode?: 'approach'|'withdrawal'; distanceTargetId?: string; distanceNextActorId?: string;
  distanceAdvances?: string[]; distanceMaais?: string[];
  fromChant?: boolean; damageRollId?: string;
}
export type FollowerOutcome='morale-failed'|'passed-through'|'attribute-destroyed'|'level-destroyed'|'blocked'|'equal-destroyed'|'lower-destroyed'|'earth-nullified'|'reflected';
export type FollowerDefenseSnapshot=FollowerDefenseValues & ({source:'physical';cardInstanceId:string;position:number;identityPublic?:boolean}|{source:'virtual';sourceId:string;position:-1});
interface FollowerDefenseValues {
 ineffective?:boolean;descriptor:import('../effects/follower-descriptors.js').FollowerDescriptor;dedicated:boolean;levels:number[];
 morale?:null|{dice:number[];threshold:number;success:boolean};hitCursor:number;hits:{hitIndex:number;outcome:FollowerOutcome;hpReduction:number}[];
 defeated:boolean;revivalForbidden:boolean;
}
export interface AttackTarget {
  mentalDefenseAttempts?:import('../abilities/mental-defense.js').MentalDefenseId[];
  ignoredBeasts?:import('../abilities/beast-empathy.js').IgnoredBeast[];
  followerEntryClosed?:boolean;virtualGuardActorId?:string;surpriseActorId?:string;frozenAbilityIgnore?:boolean;physicalHumansInvalid?:boolean;
  dedicatedCardInstanceIds?:string[];followerDefense?:FollowerDefenseSnapshot[];followerGuardCursor?:number;followerIgnoreCancelled?:boolean;followersSettled?:boolean;
  pendingFollowerReflection?:{cardInstanceId:string;hitIndex:number};
  actorId: string; followerStarted: boolean; normalDefenseClosed: boolean; followerSnapshot: string[] | null;
  hits: { mentalProtectionAttempts?:import('../abilities/frames.js').AbilityId[];mentalStopReserved?:boolean;mentalStopCommitted?:boolean; bodyDamage?:{directDamage:number|null;resistanceDamage:number;total:number}; receivedDefense?:import('../abilities/received-defense.js').ReceivedDefense; frozenBeastEmpathy?:import('../abilities/beast-empathy.js').SelectedBeastEmpathy; illusionSpiritAdded?:boolean; sourceActionId?:string;sourceCardInstanceId?:string; technique?:Technique; damageMultiplier?:number; abilityBudget?:{granted:number;accepted:number;closed:boolean}; abilityInstantDeath?:boolean; index: number; defended: boolean; passedDefense?: boolean; maaiProgress?:number; damage: number | null; damageRollId?:string; hit: boolean; lineage: string[] }[];
  followerResults?: { cardInstanceId:string; morale:null|{dice:number[];threshold:number;success:boolean}; outcome:'morale-failed'|'passed-through'|'attribute-destroyed'|'level-destroyed'|'blocked'|'equal-destroyed'|'lower-destroyed';hpReduction:number }[];
  lifetimeChoice?:'apply'|'decline';pendingInstantDeath?:'instant-death'|'petrification';pendingOtherworld?:boolean;pendingStatDrain?:boolean;pendingFixedStop?:number;pendingDeadlyStop?:number;
  dragonResistanceRollId?:string;deathSongRollId?:string;techniqueHitApplied?:boolean;
  followerBypassChoice?:boolean; followerCursor?:number; followerDestroyed?:string[]; moraleRollId?:string; resistanceRollId?:string; resistanceDamage?:number; hitsApplied?:boolean; pendingDamage?:number;
}
export interface AttackGroup {
  pendingFatalIntents?:import('../lifecycle/types.js').DamageIntent[];
  selectedWind?:import('../abilities/attack-properties.js').SelectedWind;
  beastEmpathy?:import('../abilities/beast-empathy.js').SelectedBeastEmpathy;
  destructionModifiers?:import('../abilities/follower-destruction.js').SelectedDestructionModifier[];
  illusion?:{actorId:string;effectIds:import('../abilities/frames.js').AbilityEffectId[]};
  defenseTargetIds?:string[][];followerBundleId?:string;
  id: string; actionId: string; attackerId: string; technique: Technique; targets: AttackTarget[];
  hitIndices: number[]; targetCursor: number; hitCursor: number; stage: 'defense' | 'followers';
  sourceCardInstanceIds?:string[];sourceDamageRollIds?:string[];postHitAdvancePaid?:boolean;postHitAdvanceAmount?:number;
  damageRollId?:string;durationRollId?:string; abilityWindowOpened?:boolean; abilityFollowerIgnore?:string;
  maai: { hitIndex:number; submissions:Record<string,string[]>; advances:string[] } | null;
}

/** Global source/hit slot lookup; heterogeneous targets have no entries for unselected slots. */
export function currentHit(g:AttackGroup,actorId?:string){return (actorId?g.targets.filter(t=>t.actorId===actorId):g.targets).flatMap(t=>t.hits).find(h=>h.index===g.hitCursor);}
export function currentTechnique(g:AttackGroup,actorId?:string):Technique{return currentHit(g,actorId)?.technique??g.technique;}
