import {makeCanonicalRecovery} from './canonical-recovery-scenario.js';
import {makeCanonicalLiaLife} from './canonical-lia-life-scenario.js';
import {isRevealBoundaryScenario,makeRevealBoundaryScenario,type RevealBoundaryScenario} from './reveal-boundary-scenarios.js';
import {makeCanonicalDefense} from './canonical-defense-scenarios.js';
import {makeS07PrayerScenario} from './s07-prayer-scenario.js';
import {isCanonicalScenario,makeCanonicalScenario,type CanonicalScenario} from './canonical-scenarios.js';
import {makeR6RollScenario} from './r6-roll-scenarios.js';
import {isAdvanceRemainingScenario,makeAdvanceRemainingScenario,type AdvanceRemainingScenario} from './advance-remaining-physical-scenarios.js';
import {isLightKingScenario,makeLightKingPhysical,type LightKingScenario} from './light-king-physical-scenarios.js';
import {isPlantBindScenario,makePlantBindPhysical,type PlantBindScenario} from './plant-bind-physical-scenarios.js';
import {isNightmareScenario,makeNightmarePhysical,type NightmareScenario} from './nightmare-physical-scenarios.js';
import {isWolfFangScenario,makeWolfFangPhysical,type WolfFangScenario} from './wolf-fang-physical-scenarios.js';
import {isStarBowScenario,makeStarBowPhysical,type StarBowScenario} from './star-bow-physical-scenarios.js';
import {isLightBowScenario,makeLightBowPhysical,type LightBowScenario} from './light-bow-physical-scenarios.js';
import {isBlastSwordScenario,makeBlastSwordPhysical,type BlastSwordScenario} from './blast-sword-physical-scenarios.js';
import {isHundredSlashScenario,makeHundredSlashPhysical,type HundredSlashScenario} from './hundred-slash-physical-scenarios.js';
import {isSlayingFistScenario,makeSlayingFistPhysical,type SlayingFistScenario} from './slaying-fist-physical-scenarios.js';
import {isWorldFistScenario,makeWorldFistPhysical,type WorldFistScenario} from './world-fist-physical-scenarios.js';
import {isWhirlwindKickScenario,makeWhirlwindKickPhysical,type WhirlwindKickScenario} from './whirlwind-kick-physical-scenarios.js';
import {isKiBurstScenario,makeKiBurstPhysical,type KiBurstScenario} from './ki-burst-physical-scenarios.js';
import {isBloodFlowScenario,makeBloodFlowPhysical,type BloodFlowScenario} from './blood-flow-physical-scenarios.js';
import {isDragonKingScenario,makeDragonKingPhysical,type DragonKingScenario} from './dragon-king-physical-scenarios.js';
import {isVoidSwordScenario,makeVoidSwordPhysical,type VoidSwordScenario} from './void-sword-physical-scenarios.js';
import {isBlackDragonScenario,makeBlackDragonPhysical,type BlackDragonScenario} from './black-dragon-physical-scenarios.js';
import {isBlackBreakScenario,makeBlackBreakPhysical,type BlackBreakScenario} from './black-break-physical-scenarios.js';
import {isBeastKingScenario,makeBeastKingPhysical,type BeastKingScenario} from './beast-king-physical-scenarios.js';
import {isKiSlashScenario,makeKiSlashPhysical,type KiSlashScenario} from './ki-slash-physical-scenarios.js';
import {isShadowCardScenario,makeShadowCardPhysical,type ShadowCardScenario} from './shadow-card-physical-scenarios.js';
import {isUraSwordScenario,makeUraSwordPhysical,type UraSwordScenario} from './ura-sword-physical-scenarios.js';
import {isShurikenScenario,makeShurikenPhysical,type ShurikenScenario} from './shuriken-physical-scenarios.js';
import {isAsfeltSwordsScenario,makeAsfeltSwordsScenario,type AsfeltSwordsScenario} from './asfelt-swords-physical-scenarios.js';
import {isSkyWingScenario,makeSkyWingPhysical,type SkyWingScenario} from './sky-wing-physical-scenarios.js';
import {isBlackWingScenario,makeBlackWingPhysical,type BlackWingScenario} from './black-wing-physical-scenarios.js';
import {isBlackBowScenario,makeBlackBowPhysical,type BlackBowScenario} from './black-bow-physical-scenarios.js';
import {isMaaiOtherScenario,makeMaaiOtherScenario,type MaaiOtherScenario} from './maai-other-physical-scenarios.js';
import {isRitualPhysicalScenario,makeRitualPhysicalScenario,type RitualPhysicalScenario} from './ritual-physical-scenarios.js';
import {isMotherTruthPhysicalScenario,makeMotherTruthPhysicalScenario,type MotherTruthPhysicalScenario} from './mother-truth-physical-scenarios.js';
import {isWishPhysicalScenario,makeWishPhysicalScenario,type WishPhysicalScenario} from './wish-physical-scenarios.js';
import {isFarseeingPhysicalScenario,makeFarseeingPhysicalScenario,type FarseeingPhysicalScenario} from './farseeing-physical-scenarios.js';
import {isDinonPhysicalScenario,makeDinonPhysicalScenario,type DinonPhysicalScenario} from './dinon-physical-scenarios.js';
import {isConversionPhysicalScenario,makeConversionPhysicalScenario,type ConversionPhysicalScenario} from './conversion-physical-scenarios.js';
import {isTrainingPhysicalScenario,makeTrainingPhysicalScenario,type TrainingPhysicalScenario} from './training-physical-scenarios.js';
import {isAttributeJewelsPhysicalScenario,makeAttributeJewelsPhysicalScenario,type AttributeJewelsPhysicalScenario} from './attribute-jewels-physical-scenarios.js';
import {isSecretBookPhysicalScenario,makeSecretBookPhysicalScenario,type SecretBookPhysicalScenario} from './secret-book-physical-scenarios.js';
import {isDeathGiftPhysicalScenario,makeDeathGiftPhysicalScenario,type DeathGiftPhysicalScenario} from './death-gift-physical-scenarios.js';
import {isDispelPhysicalScenario,makeDispelPhysicalScenario,type DispelPhysicalScenario} from './dispel-physical-scenarios.js';
import {isHostagePhysicalScenario,makeHostagePhysicalScenario,type HostagePhysicalScenario} from './hostage-physical-scenarios.js';
import {isSubstitutePhysicalScenario,makeSubstitutePhysicalScenario,type SubstitutePhysicalScenario} from './substitute-physical-scenarios.js';
import {isRevelationPhysicalScenario,makeRevelationPhysicalScenario,type RevelationPhysicalScenario} from './revelation-physical-scenarios.js';
import {isPeacePhysicalScenario,makePeacePhysicalScenario,type PeacePhysicalScenario} from './peace-physical-scenarios.js';
import {isCouragePhysicalScenario,makeCouragePhysicalScenario,type CouragePhysicalScenario} from './courage-physical-scenarios.js';
import {isAmuletPhysicalScenario,makeAmuletPhysicalScenario,type AmuletPhysicalScenario} from './amulet-physical-scenarios.js';
import {isKeilPhysicalScenario,makeKeilPhysicalScenario,type KeilPhysicalScenario} from './keil-physical-scenarios.js';
import {isTragedyPhysicalScenario,makeTragedyPhysicalScenario,type TragedyPhysicalScenario} from './tragedy-physical-scenarios.js';
import {isHajaPhysicalScenario,makeHajaPhysicalScenario,type HajaPhysicalScenario} from './haja-physical-scenarios.js';
import {isOpenBlessingPhysicalScenario,makeOpenBlessingPhysicalScenario,type OpenBlessingPhysicalScenario} from './open-blessing-physical-scenarios.js';
import {isGodsBloodPhysicalScenario,makeGodsBloodPhysicalScenario,type GodsBloodPhysicalScenario} from './gods-blood-physical-scenarios.js';
import {isDawnPhysicalScenario,makeDawnPhysicalScenario,type DawnPhysicalScenario} from './dawn-physical-scenarios.js';
import {isFusenPhysicalScenario,makeFusenPhysicalScenario,type FusenPhysicalScenario} from './fusen-physical-scenarios.js';
import {isWaterDragonPhysicalScenario,makeWaterDragonPhysicalScenario,type WaterDragonPhysicalScenario} from './water-dragon-physical-scenarios.js';
import {isGuardianPhysicalScenario,makeGuardianPhysicalScenario,type GuardianPhysicalScenario} from './guardian-physical-scenarios.js';
import {makeDeathKnightPhysicalScenario,isDeathKnightPhysicalScenario,type DeathKnightPhysicalScenario} from './death-knight-physical-scenarios.js';
import {makeWyvernPhysicalScenario,isWyvernPhysicalScenario,type WyvernPhysicalScenario} from './wyvern-physical-scenarios.js';
import {makeGroundDragonPhysicalScenario,isGroundDragonPhysicalScenario,type GroundDragonPhysicalScenario} from './ground-dragon-physical-scenarios.js';
import {makeFlameDragonPhysicalScenario,isFlameDragonPhysicalScenario,type FlameDragonPhysicalScenario} from './flame-dragon-physical-scenarios.js';
import {makeAngelPhysicalScenario,isAngelPhysicalScenario,type AngelPhysicalScenario} from './angel-physical-scenarios.js';
import {makePalaceGuardPhysicalScenario,isPalaceGuardPhysicalScenario,type PalaceGuardPhysicalScenario} from './palace-guard-physical-scenarios.js';
import {makeDevilPhysicalScenario,isDevilPhysicalScenario,type DevilPhysicalScenario} from './devil-physical-scenarios.js';
import {makeMetalGolemPhysicalScenario,isMetalGolemPhysicalScenario,type MetalGolemPhysicalScenario} from './metal-golem-physical-scenarios.js';
import {makeFairyFolkPhysicalScenario,isFairyFolkPhysicalScenario,type FairyFolkPhysicalScenario} from './fairy-folk-physical-scenarios.js';
import {makeShariaPhysicalScenario,isShariaPhysicalScenario,type ShariaPhysicalScenario} from './sharia-physical-scenarios.js';
import {makeDragonCultPhysicalScenario,isDragonCultPhysicalScenario,type DragonCultPhysicalScenario} from './dragon-cult-physical-scenarios.js';
import {makeDwarfPhysicalScenario,isDwarfPhysicalScenario,type DwarfPhysicalScenario} from './dwarf-physical-scenarios.js';
import {makeFemaleGuardPhysicalScenario,isFemaleGuardPhysicalScenario,type FemaleGuardPhysicalScenario} from './female-guard-physical-scenarios.js';
import {makeDarkSaintPhysicalScenario,isDarkSaintPhysicalScenario,type DarkSaintPhysicalScenario} from './dark-saint-physical-scenarios.js';
import {makeWingedFolkPhysicalScenario,isWingedFolkPhysicalScenario,type WingedFolkPhysicalScenario} from './winged-folk-physical-scenarios.js';
import {makeRoyalKnightsPhysicalScenario,isRoyalKnightsPhysicalScenario,type RoyalKnightsPhysicalScenario} from './royal-knights-physical-scenarios.js';
import {makeWightPhysicalScenario,isWightPhysicalScenario,type WightPhysicalScenario} from './wight-physical-scenarios.js';
import {makeFactionCastlesPhysicalScenario,isFactionCastlesPhysicalScenario,type FactionCastlesPhysicalScenario} from './faction-castles-physical-scenarios.js';
import {makeGriffinPhysicalScenario,isGriffinPhysicalScenario,type GriffinPhysicalScenario} from './griffin-physical-scenarios.js';
import {makeStoneGolemPhysicalScenario,isStoneGolemPhysicalScenario,type StoneGolemPhysicalScenario} from './stone-golem-physical-scenarios.js';
import {makeSmallAngelPhysicalScenario,isSmallAngelPhysicalScenario,type SmallAngelPhysicalScenario} from './small-angel-physical-scenarios.js';
import {makeSingingShipPhysicalScenario,isSingingShipPhysicalScenario,type SingingShipPhysicalScenario} from './singing-ship-physical-scenarios.js';
import {makeKnightOrdersPhysicalScenario,isKnightOrdersPhysicalScenario,type KnightOrdersPhysicalScenario} from './knight-orders-physical-scenarios.js';
import {makeMercenaryPhysicalScenario,isMercenaryPhysicalScenario,type MercenaryPhysicalScenario} from './mercenary-physical-scenarios.js';
import {makeZombiePhysicalScenario,isZombiePhysicalScenario,type ZombiePhysicalScenario} from './zombie-physical-scenarios.js';
import {makeCastleImpPhysicalScenario,isCastleImpPhysicalScenario,type CastleImpPhysicalScenario} from './castle-imp-physical-scenarios.js';
import {makeBorderWoodPhysicalScenario,isBorderWoodPhysicalScenario,type BorderWoodPhysicalScenario} from './border-wood-physical-scenarios.js';
import {makeSkeletonPhysicalScenario,isSkeletonPhysicalScenario,type SkeletonPhysicalScenario} from './skeleton-physical-scenarios.js';
import {makeOrcFortPhysicalScenario,isOrcFortPhysicalScenario,type OrcFortPhysicalScenario} from './orc-fort-physical-scenarios.js';
import {makeCommonFollowersPhysicalScenario,isCommonFollowersPhysicalScenario,type CommonFollowersPhysicalScenario} from './common-followers-physical-scenarios.js';
import {makeDeathSongPhysicalScenario,isDeathSongPhysicalScenario,type DeathSongPhysicalScenario} from './death-song-physical-scenarios.js';
import {makeLesterSongsPhysicalScenario,isLesterSongsPhysicalScenario,type LesterSongsPhysicalScenario} from './lester-songs-physical-scenarios.js';
import {makeMadKingPhysicalScenario,isMadKingPhysicalScenario,type MadKingPhysicalScenario} from './mad-king-physical-scenarios.js';
import {makeShockPhysicalScenario,isShockPhysicalScenario,type ShockPhysicalScenario} from './shock-physical-scenarios.js';
import {makeCloseEarthPhysicalScenario,isCloseEarthPhysicalScenario,type CloseEarthPhysicalScenario} from './close-earth-physical-scenarios.js';
import {makeSilencePhysicalScenario,isSilencePhysicalScenario,type SilencePhysicalScenario} from './silence-physical-scenarios.js';
import {makeJudgmentPhysicalScenario,isJudgmentPhysicalScenario,type JudgmentPhysicalScenario} from './judgment-physical-scenarios.js';
import {makeYotsurmMagicPhysicalScenario,isYotsurmMagicPhysicalScenario,type YotsurmMagicPhysicalScenario} from './yotsurm-magic-physical-scenarios.js';
import {makeWhiteMagicPhysicalScenario,isWhiteMagicPhysicalScenario,type WhiteMagicPhysicalScenario} from './white-magic-physical-scenarios.js';
import {makePlaguePhysicalScenario,isPlaguePhysicalScenario,type PlaguePhysicalScenario} from './plague-physical-scenarios.js';
import {makeGatePhysicalScenario,isGatePhysicalScenario,type GatePhysicalScenario} from './gate-physical-scenarios.js';
import {makePetrifyPhysicalScenario,isPetrifyPhysicalScenario,type PetrifyPhysicalScenario} from './petrify-physical-scenarios.js';
import {makeScythePhysicalScenario,isScythePhysicalScenario,type ScythePhysicalScenario} from './scythe-physical-scenarios.js';
import {makeRiftPhysicalScenario,isRiftPhysicalScenario,type RiftPhysicalScenario} from './rift-physical-scenarios.js';
import {makeDiaLifetimePhysicalScenario,isDiaLifetimePhysicalScenario,type DiaLifetimePhysicalScenario} from './dia-lifetime-physical-scenarios.js';
import {makeHealingPhysicalScenario,isHealingPhysicalScenario,type HealingPhysicalScenario} from './healing-physical-scenarios.js';
import {makePrisonPhysicalScenario,isPrisonPhysicalScenario,type PrisonPhysicalScenario} from './prison-physical-scenarios.js';
import {makeResurrectionPhysicalScenario,isResurrectionPhysicalScenario,type ResurrectionPhysicalScenario} from './resurrection-physical-scenarios.js';
import {makeCursePhysicalScenario,isCursePhysicalScenario,type CursePhysicalScenario} from './curse-physical-scenarios.js';
import {makeMekaiPhysicalScenario,isMekaiPhysicalScenario,type MekaiPhysicalScenario} from './mekai-physical-scenarios.js';
import {makeLeafDefenseScenario,isLeafDefenseScenario,type LeafDefenseScenario} from './leaf-defense-scenarios.js';
import {makeAlseilStatusScenario,isAlseilStatusScenario,type AlseilStatusScenario} from './alseil-status-scenarios.js';
import {makeWaterStatusScenario,isWaterStatusScenario,type WaterStatusScenario} from './water-status-scenarios.js';
import {makeIceWolfScenario,isIceWolfScenario,type IceWolfScenario} from './ice-wolf-scenarios.js';
import {makeIceMagicScenario,isIceMagicScenario,type IceMagicScenario} from './ice-magic-scenarios.js';
import {makeStormMagicScenario,isStormMagicScenario,type StormMagicScenario} from './storm-magic-scenarios.js';
import {makeWindMagicScenario,isWindMagicScenario,type WindMagicScenario} from './wind-magic-scenarios.js';
import {makeEarthMagicScenario,isEarthMagicScenario,type EarthMagicScenario} from './earth-magic-scenarios.js';
import {makeHeavyFireScenario,isHeavyFireScenario,type HeavyFireScenario} from './heavy-fire-scenarios.js';
import {makeFireMagicScenario,isFireMagicScenario,type FireMagicScenario} from './fire-magic-scenarios.js';
import {makeMountainBreakerScenario,isMountainBreakerScenario,type MountainBreakerScenario} from './mountain-breaker-scenarios.js';
import {makeAnnihilationAxeScenario,isAnnihilationAxeScenario,type AnnihilationAxeScenario} from './annihilation-axe-scenarios.js';
import {makeRambaAxesScenario,isRambaAxesScenario,type RambaAxesScenario} from './ramba-axes-scenarios.js';
import {makeWhiteDragonScenario,isWhiteDragonScenario,type WhiteDragonScenario} from './white-dragon-scenarios.js';
import {makeDragonSpearScenario,isDragonSpearScenario,type DragonSpearScenario} from './dragon-spear-scenarios.js';
import {makeSpearMountainScenario,isSpearMountainScenario,type SpearMountainScenario} from './spear-mountain-scenarios.js';
import {makeWolfLanceScenario,isWolfLanceScenario,type WolfLanceScenario} from './wolf-lance-scenarios.js';
import {makeBarrierPhysicalScenario,isBarrierPhysicalScenario,type BarrierPhysicalScenario} from './barrier-physical-scenarios.js';
import {makeReflectLimitScenario,isReflectLimitScenario,type ReflectLimitScenario} from './reflect-limit-scenarios.js';
import {makeIceMirrorScenario,isIceMirrorScenario,type IceMirrorScenario} from './ice-mirror-scenarios.js';
import {makeTeleportPhysicalScenario,isTeleportPhysicalScenario,type TeleportPhysicalScenario} from './teleport-physical-scenarios.js';
import {makeEvadePhysicalScenario,isEvadePhysicalScenario,type EvadePhysicalScenario} from './evade-physical-scenarios.js';
import {makeBasicAttachmentScenario,isBasicAttachmentScenario,type BasicAttachmentScenario} from './basic-attachment-scenarios.js';
import {makeR6Scenario,isR6Scenario,type R6ScenarioName} from './r6-scenarios.js';
import {makeScenarioS18} from './scenario-s18.js';
import {makeSharedReclaimScenario,isSharedReclaimScenario,type SharedReclaimScenario} from './shared-reclaim-scenarios.js';
import {makeLiaPrayerScenario,type LiaPrayerScenario} from './lia-prayer-scenarios.js';
import {makeDeathRewardScenario,type DeathRewardScenario} from './death-reward-scenarios.js';
import {makeSadLoveScenario,type SadLoveScenario} from './sad-love-scenarios.js';
import {isMandatoryFieldsScenario,makeMandatoryFieldsScenario,type MandatoryFieldsScenario} from './mandatory-fields-scenarios.js';
import {makeMandatoryRestrictionScenario,type MandatoryRestrictionScenario} from './mandatory-restriction-scenarios.js';
import {makeZanScenario,type ZanScenarioName} from './zan-scenarios.js';
import {makeShadowJumpScenario} from './shadow-jump-scenario.js';
import {isVirtualBladeScenario,makeVirtualBladeScenario,type VirtualBladeScenarioName} from './virtual-blade-scenarios.js';
import {isMaaiScenario,makeMaaiScenario,type MaaiScenarioName} from './r5-distance-scenarios.js';
import { isReclaimScenario, makeReclaimScenario, type ReclaimScenarioName } from './reclaim-scenarios.js';
import { isSuppressionScenario, makeSuppressionScenario, type SuppressionScenarioName } from './suppression-scenarios.js';
import { isConditionalScenario, makeConditionalScenario, type ConditionalScenarioName } from './conditional-ability-scenarios.js';
import { isTurnInformationScenario, makeTurnInformationScenario, type TurnInformationScenarioName } from './turn-information-scenarios.js';
import { isDeclarationScenario, makeDeclarationScenario, type DeclarationScenarioName } from './declaration-scenarios.js';
import { isMentalProtectionScenario, makeMentalProtectionScenario, type MentalProtectionScenarioName } from './mental-protection-scenarios.js';
import { isMentalDefenseScenario, makeMentalDefenseScenario, type MentalDefenseScenarioName } from './mental-defense-scenarios.js';
import { isNamedResponseScenario, makeNamedResponseScenario, type NamedResponseScenarioName } from './named-response-scenarios.js';
import { isRollingDefenseScenario, makeRollingDefenseScenario, type RollingDefenseScenarioName } from './rolling-defense-scenarios.js';
import { isReceivedDefenseScenario, makeReceivedDefenseScenario, type ReceivedDefenseScenarioName } from './received-defense-scenarios.js';
import { isAttackPropertyScenario, makeAttackPropertyScenario, type AttackPropertyScenarioName } from './attack-property-scenarios.js';
import { isBeastCaptureScenario, makeBeastCaptureScenario, type BeastCaptureScenarioName } from './beast-capture-scenarios.js';
import { isFollowerDestructionScenario, makeFollowerDestructionScenario, type FollowerDestructionScenarioName } from './follower-destruction-scenarios.js';
import { isTechniqueValueScenario, makeTechniqueValueScenario, type TechniqueValueScenarioName } from './technique-value-scenarios.js';
import { isFollowerEntryScenario, makeFollowerEntryScenario, type FollowerEntryScenarioName } from './follower-entry-scenarios.js';
import { isFollowerGroupScenario, makeFollowerGroupScenario, type FollowerGroupScenarioName } from './follower-group-scenarios.js';
import { isFollowerAttackScenario, makeFollowerAttackScenario, type FollowerAttackScenarioName } from './follower-attack-scenarios.js';
import { isFollowerScenario, makeFollowerScenario, type FollowerScenarioName } from './follower-scenarios.js';
import { isCombinationScenario, makeCombinationScenario, type CombinationScenarioName } from './combination-scenarios.js';
import { isAbilityScenario, makeAbilityScenario, type AbilityScenarioName } from './ability-scenarios.js';
import { isLifetimeScenario, makeLifetimeScenario, type LifetimeScenarioName } from './lifetime-scenarios.js';
import { isLifecycleScenario, makeLifecycleScenario, type LifecycleScenarioName } from './lifecycle-scenarios.js';
import { entropy, takeCard, trimHand, assignCharacter, readySetup } from './scenario-tools.js';
import { allCardInstanceIds, createGame, derivedStats, transition, type GameCommand, type GameState } from '@madou/engine';

import {makeReclaimExit} from './reclaim-exit-scenario.js';
import {makeReclaimWandering} from './reclaim-wandering-scenario.js';
export type ScenarioName = 'fury-royal-reflection' | 'reclaim-exit' | 'reclaim-wandering' | 'canonical-recovery-dawn' | 'canonical-vanmil-death' | 'canonical-lia-life' | RevealBoundaryScenario | 'canonical-S09' | 'canonical-S10' | 'canonical-S07' | CanonicalScenario | 'r6-s02-cancel-child' | AdvanceRemainingScenario | LightKingScenario | PlantBindScenario | NightmareScenario | WolfFangScenario | StarBowScenario | LightBowScenario | BlastSwordScenario | HundredSlashScenario | SlayingFistScenario | WorldFistScenario | WhirlwindKickScenario | KiBurstScenario | BloodFlowScenario | DragonKingScenario | VoidSwordScenario | BlackDragonScenario | BlackBreakScenario | BeastKingScenario | KiSlashScenario | ShadowCardScenario | UraSwordScenario | ShurikenScenario | AsfeltSwordsScenario | SkyWingScenario | BlackWingScenario | BlackBowScenario | MaaiOtherScenario | RitualPhysicalScenario | MotherTruthPhysicalScenario | WishPhysicalScenario | FarseeingPhysicalScenario | DinonPhysicalScenario | ConversionPhysicalScenario | TrainingPhysicalScenario | AttributeJewelsPhysicalScenario | SecretBookPhysicalScenario | DeathGiftPhysicalScenario | DispelPhysicalScenario | HostagePhysicalScenario | SubstitutePhysicalScenario | RevelationPhysicalScenario | PeacePhysicalScenario | CouragePhysicalScenario | AmuletPhysicalScenario | KeilPhysicalScenario | TragedyPhysicalScenario | HajaPhysicalScenario | OpenBlessingPhysicalScenario | GodsBloodPhysicalScenario | DawnPhysicalScenario | FusenPhysicalScenario | WaterDragonPhysicalScenario | GuardianPhysicalScenario | DeathKnightPhysicalScenario | WyvernPhysicalScenario | GroundDragonPhysicalScenario | FlameDragonPhysicalScenario | AngelPhysicalScenario | PalaceGuardPhysicalScenario | DevilPhysicalScenario | MetalGolemPhysicalScenario | FairyFolkPhysicalScenario | ShariaPhysicalScenario | DragonCultPhysicalScenario | DwarfPhysicalScenario | FemaleGuardPhysicalScenario | DarkSaintPhysicalScenario | WingedFolkPhysicalScenario | RoyalKnightsPhysicalScenario | WightPhysicalScenario | FactionCastlesPhysicalScenario | GriffinPhysicalScenario | StoneGolemPhysicalScenario | SmallAngelPhysicalScenario | SingingShipPhysicalScenario | KnightOrdersPhysicalScenario | MercenaryPhysicalScenario | ZombiePhysicalScenario | CastleImpPhysicalScenario | BorderWoodPhysicalScenario | SkeletonPhysicalScenario | OrcFortPhysicalScenario | CommonFollowersPhysicalScenario | DeathSongPhysicalScenario | LesterSongsPhysicalScenario | MadKingPhysicalScenario | ShockPhysicalScenario | CloseEarthPhysicalScenario | SilencePhysicalScenario | JudgmentPhysicalScenario | YotsurmMagicPhysicalScenario | WhiteMagicPhysicalScenario | PlaguePhysicalScenario | GatePhysicalScenario | PetrifyPhysicalScenario | ScythePhysicalScenario | RiftPhysicalScenario | DiaLifetimePhysicalScenario | HealingPhysicalScenario | PrisonPhysicalScenario | ResurrectionPhysicalScenario | CursePhysicalScenario | MekaiPhysicalScenario | LeafDefenseScenario | AlseilStatusScenario | WaterStatusScenario | IceWolfScenario | IceMagicScenario | StormMagicScenario | WindMagicScenario | EarthMagicScenario | HeavyFireScenario | FireMagicScenario | MountainBreakerScenario | AnnihilationAxeScenario | RambaAxesScenario | WhiteDragonScenario | DragonSpearScenario | SpearMountainScenario | WolfLanceScenario | BarrierPhysicalScenario | ReflectLimitScenario | IceMirrorScenario | TeleportPhysicalScenario | EvadePhysicalScenario | BasicAttachmentScenario | R6ScenarioName | 'scenario-s18' | 'scenario-s18-between' | SharedReclaimScenario | LiaPrayerScenario | DeathRewardScenario | SadLoveScenario | MandatoryFieldsScenario | MandatoryRestrictionScenario | ZanScenarioName | 'shadow-jump' | VirtualBladeScenarioName | MaaiScenarioName | ReclaimScenarioName | SuppressionScenarioName | ConditionalScenarioName | TurnInformationScenarioName | DeclarationScenarioName | MentalProtectionScenarioName | MentalDefenseScenarioName | NamedResponseScenarioName | RollingDefenseScenarioName | ReceivedDefenseScenarioName | AttackPropertyScenarioName | BeastCaptureScenarioName | FollowerDestructionScenarioName | TechniqueValueScenarioName | FollowerEntryScenarioName | FollowerGroupScenarioName | FollowerAttackScenarioName | FollowerScenarioName | CombinationScenarioName | AbilityScenarioName | LifetimeScenarioName | LifecycleScenarioName | 'setup' | 'combat' | 'combat-ready' | 'chanted-ready' | 'dedicated-defense' | 'optional-chant-ready' | 'lance-variant-ready' | 'lancelot-variant-ready' | 'dedicated-chant-defense' | 'magic-bypass' | 'magic-dedicated-defense' | 'magic-restricted-defense' | 'roll-check' | 'roll-recovery' | 'roll-damage' | 'nightmare-damage' | 'stopped-defense' | 'stopped-reveal' | 'silenced-chant' | 'reflected-stop-withdrawal' | 'ability-disabled-defense' | 'third-party-interrupt' | 'prayer-effect-level' | 'follower-defense-started' | 'multi-target-multi-hit';

/** Test-only reproducible production states, shared by real DO and browser fixtures. */
export function makeScenario(name: ScenarioName, players: { id: string; name: string }[]): GameState {
  if(name==='canonical-recovery-dawn')return makeCanonicalRecovery(players);
  if(name==='canonical-lia-life'||name==='canonical-vanmil-death')return makeCanonicalLiaLife(players,name==='canonical-vanmil-death');
  if(isRevealBoundaryScenario(name))return makeRevealBoundaryScenario(name,players);
  if(name==='canonical-S09'||name==='canonical-S10')return makeCanonicalDefense(players,name==='canonical-S09'?'S09':'S10');
  if(name==='canonical-S07')return makeS07PrayerScenario(players);
  if(isCanonicalScenario(name))return makeCanonicalScenario(name,players);
  if(name==='r6-s02-cancel-child')return makeR6RollScenario(players,true,true);
  if(isAdvanceRemainingScenario(name))return makeAdvanceRemainingScenario(name,players);
  if(isLightKingScenario(name))return makeLightKingPhysical(name,players);
  if(isPlantBindScenario(name))return makePlantBindPhysical(name,players);
  if(isNightmareScenario(name))return makeNightmarePhysical(name,players);
  if(isWolfFangScenario(name))return makeWolfFangPhysical(name,players);
  if(isStarBowScenario(name))return makeStarBowPhysical(name,players);
  if(isLightBowScenario(name))return makeLightBowPhysical(name,players);
  if(isBlastSwordScenario(name))return makeBlastSwordPhysical(name,players);
  if(isHundredSlashScenario(name))return makeHundredSlashPhysical(name,players);
  if(isSlayingFistScenario(name))return makeSlayingFistPhysical(name,players);
  if(isWorldFistScenario(name))return makeWorldFistPhysical(name,players);
  if(isWhirlwindKickScenario(name))return makeWhirlwindKickPhysical(name,players);
  if(isKiBurstScenario(name))return makeKiBurstPhysical(name,players);
  if(isBloodFlowScenario(name))return makeBloodFlowPhysical(name,players);
  if(isDragonKingScenario(name))return makeDragonKingPhysical(name,players);
  if(isVoidSwordScenario(name))return makeVoidSwordPhysical(name,players);
  if(isBlackDragonScenario(name))return makeBlackDragonPhysical(name,players);
  if(isBlackBreakScenario(name))return makeBlackBreakPhysical(name,players);
  if(isBeastKingScenario(name))return makeBeastKingPhysical(name,players);
  if(isKiSlashScenario(name))return makeKiSlashPhysical(name,players);
  if(isShadowCardScenario(name))return makeShadowCardPhysical(name,players);
  if(isUraSwordScenario(name))return makeUraSwordPhysical(name,players);
  if(isShurikenScenario(name))return makeShurikenPhysical(name,players);
  if(isAsfeltSwordsScenario(name))return makeAsfeltSwordsScenario(name,players);
  if(isSkyWingScenario(name))return makeSkyWingPhysical(name,players);
  if(isBlackWingScenario(name))return makeBlackWingPhysical(name,players);
  if(isBlackBowScenario(name))return makeBlackBowPhysical(name,players);
  if(isMaaiOtherScenario(name))return makeMaaiOtherScenario(name,players);
  if(isRitualPhysicalScenario(name))return makeRitualPhysicalScenario(name,players);
  if(isMotherTruthPhysicalScenario(name))return makeMotherTruthPhysicalScenario(name,players);
  if(isWishPhysicalScenario(name))return makeWishPhysicalScenario(name,players);
  if(isFarseeingPhysicalScenario(name))return makeFarseeingPhysicalScenario(name,players);
  if(isDinonPhysicalScenario(name))return makeDinonPhysicalScenario(name,players);
  if(isConversionPhysicalScenario(name))return makeConversionPhysicalScenario(name,players);
  if(isTrainingPhysicalScenario(name))return makeTrainingPhysicalScenario(name,players);
  if(isAttributeJewelsPhysicalScenario(name))return makeAttributeJewelsPhysicalScenario(name,players);
  if(isSecretBookPhysicalScenario(name))return makeSecretBookPhysicalScenario(name,players);
  if(isDeathGiftPhysicalScenario(name))return makeDeathGiftPhysicalScenario(name,players);
  if(isDispelPhysicalScenario(name))return makeDispelPhysicalScenario(name,players);
  if(isHostagePhysicalScenario(name))return makeHostagePhysicalScenario(name,players);
  if(isSubstitutePhysicalScenario(name))return makeSubstitutePhysicalScenario(name,players);
  if(isRevelationPhysicalScenario(name))return makeRevelationPhysicalScenario(name,players);
  if(isPeacePhysicalScenario(name))return makePeacePhysicalScenario(name,players);
  if(isCouragePhysicalScenario(name))return makeCouragePhysicalScenario(name,players);
  if(isAmuletPhysicalScenario(name))return makeAmuletPhysicalScenario(name,players);
  if(isKeilPhysicalScenario(name))return makeKeilPhysicalScenario(name,players);
  if(isTragedyPhysicalScenario(name))return makeTragedyPhysicalScenario(name,players);
  if(isHajaPhysicalScenario(name))return makeHajaPhysicalScenario(name,players);
  if(isOpenBlessingPhysicalScenario(name))return makeOpenBlessingPhysicalScenario(name,players);
  if(isGodsBloodPhysicalScenario(name))return makeGodsBloodPhysicalScenario(name,players);
  if(isDawnPhysicalScenario(name))return makeDawnPhysicalScenario(name,players);
  if(isFusenPhysicalScenario(name))return makeFusenPhysicalScenario(name,players);
  if(isWaterDragonPhysicalScenario(name))return makeWaterDragonPhysicalScenario(name,players);
  if(isGuardianPhysicalScenario(name))return makeGuardianPhysicalScenario(name,players);
  if(isDeathKnightPhysicalScenario(name))return makeDeathKnightPhysicalScenario(name,players);
  if(isWyvernPhysicalScenario(name))return makeWyvernPhysicalScenario(name,players);
  if(isGroundDragonPhysicalScenario(name))return makeGroundDragonPhysicalScenario(name,players);
  if(isFlameDragonPhysicalScenario(name))return makeFlameDragonPhysicalScenario(name,players);
  if(isAngelPhysicalScenario(name))return makeAngelPhysicalScenario(name,players);
  if(isPalaceGuardPhysicalScenario(name))return makePalaceGuardPhysicalScenario(name,players);
  if(isDevilPhysicalScenario(name))return makeDevilPhysicalScenario(name,players);
  if(isMetalGolemPhysicalScenario(name))return makeMetalGolemPhysicalScenario(name,players);
  if(name==='fury-royal-reflection')return makeFairyFolkPhysicalScenario('fairy-grant-hand',players,{defender:'妖精王フューリー',royal:true});
  if(isFairyFolkPhysicalScenario(name))return makeFairyFolkPhysicalScenario(name,players);
  if(isShariaPhysicalScenario(name))return makeShariaPhysicalScenario(name,players);
  if(isDragonCultPhysicalScenario(name))return makeDragonCultPhysicalScenario(name,players);
  if(isDwarfPhysicalScenario(name))return makeDwarfPhysicalScenario(name,players);
  if(isFemaleGuardPhysicalScenario(name))return makeFemaleGuardPhysicalScenario(name,players);
  if(isDarkSaintPhysicalScenario(name))return makeDarkSaintPhysicalScenario(name,players);
  if(isWingedFolkPhysicalScenario(name))return makeWingedFolkPhysicalScenario(name,players);
  if(isRoyalKnightsPhysicalScenario(name))return makeRoyalKnightsPhysicalScenario(name,players);
 if (isWightPhysicalScenario(name)) return makeWightPhysicalScenario(name,players);
  if (isFactionCastlesPhysicalScenario(name)) return makeFactionCastlesPhysicalScenario(name,players);
  if (isGriffinPhysicalScenario(name)) return makeGriffinPhysicalScenario(name,players);
  if (isStoneGolemPhysicalScenario(name)) return makeStoneGolemPhysicalScenario(name,players);
  if (isSmallAngelPhysicalScenario(name)) return makeSmallAngelPhysicalScenario(name,players);
  if (isSingingShipPhysicalScenario(name)) return makeSingingShipPhysicalScenario(name,players);
  if (isKnightOrdersPhysicalScenario(name)) return makeKnightOrdersPhysicalScenario(name,players);
  if (isMercenaryPhysicalScenario(name)) return makeMercenaryPhysicalScenario(name,players);
  if (isZombiePhysicalScenario(name)) return makeZombiePhysicalScenario(name,players);
  if (isCastleImpPhysicalScenario(name)) return makeCastleImpPhysicalScenario(name,players);
  if (isBorderWoodPhysicalScenario(name)) return makeBorderWoodPhysicalScenario(name,players);
  if (isSkeletonPhysicalScenario(name)) return makeSkeletonPhysicalScenario(name,players);
  if (isOrcFortPhysicalScenario(name)) return makeOrcFortPhysicalScenario(name,players);
  if (isCommonFollowersPhysicalScenario(name)) return makeCommonFollowersPhysicalScenario(name,players);
  if (isDeathSongPhysicalScenario(name)) return makeDeathSongPhysicalScenario(name,players);
  if (isLesterSongsPhysicalScenario(name)) return makeLesterSongsPhysicalScenario(name,players);
  if (isMadKingPhysicalScenario(name)) return makeMadKingPhysicalScenario(name,players);
  if (isShockPhysicalScenario(name)) return makeShockPhysicalScenario(name,players);
  if (isCloseEarthPhysicalScenario(name)) return makeCloseEarthPhysicalScenario(name,players);
  if (isSilencePhysicalScenario(name)) return makeSilencePhysicalScenario(name,players);
  if (isJudgmentPhysicalScenario(name)) return makeJudgmentPhysicalScenario(name,players);
  if (isYotsurmMagicPhysicalScenario(name)) return makeYotsurmMagicPhysicalScenario(name,players);
  if (isWhiteMagicPhysicalScenario(name)) return makeWhiteMagicPhysicalScenario(name,players);
  if (isPlaguePhysicalScenario(name)) return makePlaguePhysicalScenario(name,players);
  if (isGatePhysicalScenario(name)) return makeGatePhysicalScenario(name,players);
  if (isPetrifyPhysicalScenario(name)) return makePetrifyPhysicalScenario(name,players);
  if (isScythePhysicalScenario(name)) return makeScythePhysicalScenario(name,players);
  if (isRiftPhysicalScenario(name)) return makeRiftPhysicalScenario(name,players);
  if (isDiaLifetimePhysicalScenario(name)) return makeDiaLifetimePhysicalScenario(name,players);
  if (isHealingPhysicalScenario(name)) return makeHealingPhysicalScenario(name,players);
  if (isPrisonPhysicalScenario(name)) return makePrisonPhysicalScenario(name,players);
  if (isResurrectionPhysicalScenario(name)) return makeResurrectionPhysicalScenario(name,players);
  if (isCursePhysicalScenario(name)) return makeCursePhysicalScenario(name,players);
  if (isMekaiPhysicalScenario(name)) return makeMekaiPhysicalScenario(name,players);
  if (isLeafDefenseScenario(name)) return makeLeafDefenseScenario(name,players);
  if (isAlseilStatusScenario(name)) return makeAlseilStatusScenario(name,players);
  if (isWaterStatusScenario(name)) return makeWaterStatusScenario(name,players);
  if (isIceWolfScenario(name)) return makeIceWolfScenario(name,players);
  if (isIceMagicScenario(name)) return makeIceMagicScenario(name,players);
  if (isStormMagicScenario(name)) return makeStormMagicScenario(name,players);
  if (isWindMagicScenario(name)) return makeWindMagicScenario(name,players);
  if (isEarthMagicScenario(name)) return makeEarthMagicScenario(name,players);
  if (isHeavyFireScenario(name)) return makeHeavyFireScenario(name,players);
  if (isFireMagicScenario(name)) return makeFireMagicScenario(name,players);
  if (isMountainBreakerScenario(name)) return makeMountainBreakerScenario(name,players);
  if (isAnnihilationAxeScenario(name)) return makeAnnihilationAxeScenario(name,players);
  if (isRambaAxesScenario(name)) return makeRambaAxesScenario(name,players);
  if (isWhiteDragonScenario(name)) return makeWhiteDragonScenario(name,players);
  if (isDragonSpearScenario(name)) return makeDragonSpearScenario(name,players);
  if (isSpearMountainScenario(name)) return makeSpearMountainScenario(name,players);
  if (isWolfLanceScenario(name)) return makeWolfLanceScenario(name,players);
  if (isBarrierPhysicalScenario(name)) return makeBarrierPhysicalScenario(name,players);
  if (isReflectLimitScenario(name)) return makeReflectLimitScenario(name,players);
  if (isIceMirrorScenario(name)) return makeIceMirrorScenario(name,players);
  if (isTeleportPhysicalScenario(name)) return makeTeleportPhysicalScenario(name,players);
  if (isEvadePhysicalScenario(name)) return makeEvadePhysicalScenario(name,players);
  if (isBasicAttachmentScenario(name)) return makeBasicAttachmentScenario(name,players);
  if (isR6Scenario(name)) return makeR6Scenario(name,players);
  if (name==='scenario-s18'||name==='scenario-s18-between') return makeScenarioS18(players,name==='scenario-s18-between');
  if (isSharedReclaimScenario(name)) return makeSharedReclaimScenario(name,players);
  if (name==='reclaim-exit') return makeReclaimExit(players);
  if (name==='reclaim-wandering') return makeReclaimWandering(players);
  if (name==='lia-prayer-revival'||name==='lia-prayer-otherworld'||name==='lia-prayer'||name==='lia-prayer-second'||name==='lia-prayer-fatal') return makeLiaPrayerScenario(name,players);
  if (name==='death-reward-dia'||name==='death-reward-hunger'||name==='cham-death-gift') return makeDeathRewardScenario(name,players);
  if (name==='sad-love'||name==='sad-love-lethal'||name==='sad-love-aura') return makeSadLoveScenario(name,players);
  if (isMandatoryFieldsScenario(name)) return makeMandatoryFieldsScenario(name,players);
  if (name==='mandatory-fury'||name==='mandatory-fury-counter') return makeMandatoryRestrictionScenario(name,players);
  if (name==='zan'||name==='zan-maai') return makeZanScenario(name,players);
  if (name==='shadow-jump') return makeShadowJumpScenario(players);
  if (isVirtualBladeScenario(name)) return makeVirtualBladeScenario(name,players);
  if (isMaaiScenario(name)) return makeMaaiScenario(name,players);
  if (isReclaimScenario(name)) return makeReclaimScenario(name, players);
  if (isSuppressionScenario(name)) return makeSuppressionScenario(name, players);
  if (isConditionalScenario(name)) return makeConditionalScenario(name, players);
  if (isTurnInformationScenario(name)) return makeTurnInformationScenario(name, players);
  if (isDeclarationScenario(name)) return makeDeclarationScenario(name, players);
  if (isMentalProtectionScenario(name)) return makeMentalProtectionScenario(name, players);
  if (isMentalDefenseScenario(name)) return makeMentalDefenseScenario(name, players);
  if (isNamedResponseScenario(name)) return makeNamedResponseScenario(name, players);
  if (isRollingDefenseScenario(name)) return makeRollingDefenseScenario(name, players);
  if (isReceivedDefenseScenario(name)) return makeReceivedDefenseScenario(name, players);
  if (isAttackPropertyScenario(name)) return makeAttackPropertyScenario(name, players);
  if (isBeastCaptureScenario(name)) return makeBeastCaptureScenario(name, players);
  if (isFollowerDestructionScenario(name)) return makeFollowerDestructionScenario(name, players);
  if (isTechniqueValueScenario(name)) return makeTechniqueValueScenario(name, players);
  if (isFollowerEntryScenario(name)) return makeFollowerEntryScenario(name, players);
  if (isFollowerGroupScenario(name)) return makeFollowerGroupScenario(name, players);
  if (isFollowerAttackScenario(name)) return makeFollowerAttackScenario(name, players);
  if (isFollowerScenario(name)) return makeFollowerScenario(name, players);
  if (isCombinationScenario(name)) return makeCombinationScenario(name, players);
  if (isAbilityScenario(name)) return makeAbilityScenario(name, players);
  if (isLifetimeScenario(name)) return makeLifetimeScenario(name, players);
  if (isLifecycleScenario(name)) return makeLifecycleScenario(name, players);
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c] = players.map(player => player.id) as [string, string, string];
  const act = (actorId: string, command: GameCommand, dice = entropy().dice) => {
    const outcome = transition(state, { actorId, command }, { ...entropy(), dice });
    if (!outcome.ok) throw Error(`FIXTURE_${outcome.code}`);
    state = outcome.state;
    if (allCardInstanceIds(state).length !== 220 || new Set(allCardInstanceIds(state)).size !== 220) throw Error('FIXTURE_CARD_CONSERVATION');
  };
  if (name === 'setup') return state;
  readySetup(()=>state,id=>act(id,{type:'PASS_SETUP'}));
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  assignCharacter(state, a, '侍大将のシン'); assignCharacter(state, b, '黒騎士ガーウィン');
  if (name === 'reflected-stop-withdrawal') {
    const attack = takeCard(state, a, '狂王陣');
    const reflect = takeCard(state, b, '神王界');
    const distance = takeCard(state, a, '間合い／休息');
    trimHand(state, a, attack, distance);
    state.distances[a]![b] = state.distances[b]![a] = 'near';
    state.events = [];
    act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: false });
    for (let i = 0; state.windows?.at(-1)?.kind !== 'normal-defense' && i < 200; i++) {
      const window = state.windows?.at(-1); if (!window) throw Error('FIXTURE_MISSING_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    act(b, { type: 'PLAY_DEFENSE', cardInstanceId: reflect, dedicated: false });
    for (let i = 0; state.windows?.length && i < 200; i++) {
      const window = state.windows.at(-1)!;
      const resistance = state.rolls?.at(-1)?.purpose === 'status-resistance';
      act(window.participants[window.cursor]!, { type: 'PASS' }, Array(100).fill(resistance ? 6 : 1));
    }
    if (state.phase !== 'withdrawal' || !state.players[a]!.statuses?.some(status => status.kind === 'stopped')) throw Error('FIXTURE_REFLECTED_STOP_MISSING');
    return state;
  }
  // Stored-state precondition for reveal availability; the separate stopped-defense fixture proves infliction.
  if (name === 'stopped-reveal') {
    state.players[b]!.statuses = [{ id: 'fixture-prior-stop', kind: 'stopped', modifiers: [-1], nextCheck: 1 }];
    const follower = takeCard(state, b, '兵士');
    state.players[b]!.hand = state.players[b]!.hand.filter(id => id !== follower);
    state.players[b]!.followers.push({ cardInstanceId: follower, revealed: false });
  }
  if (name === 'stopped-defense' || name === 'ability-disabled-defense' || name === 'silenced-chant') {
    const silenced = name === 'silenced-chant';
    const stopped = name === 'stopped-defense';
    assignCharacter(state, a, stopped ? '魔聖母ディア' : silenced ? '白魔術師シェリム' : '占星術師のアルセイル');
    assignCharacter(state, b, silenced ? '侍大将のシン' : '白魔術師シェリム'); assignCharacter(state, c, '黒騎士ガーウィン');
    const source = takeCard(state, a, stopped ? '悪夢' : silenced ? '沈黙' : '錯乱');
    takeCard(state, b, '白光'); takeCard(state, b, '神性介入'); takeCard(state, b, '転移');
    if (stopped) {
      const follower = takeCard(state, b, '兵士');
      state.players[b]!.hand = state.players[b]!.hand.filter(id => id !== follower);
      state.players[b]!.followers.push({ cardInstanceId: follower, revealed: false });
    }
    if (silenced) { takeCard(state, b, '氷狼乱舞陣'); takeCard(state, b, '天地百撃斬'); }
    const bow = takeCard(state, c, '踏み込み／弓');
    state.events = [];
    act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b], dedicated: !stopped && !silenced });
    for (let i = 0; state.windows?.length && i < 200; i++) {
      const window = state.windows.at(-1)!;
      const resistance = state.rolls?.at(-1)?.purpose === 'status-resistance';
      act(window.participants[window.cursor]!, { type: 'PASS' }, Array(100).fill(resistance ? 6 : 1));
    }
    if (!state.players[b]!.statuses?.some(status => status.kind === (stopped ? 'stopped' : silenced ? 'silenced' : 'ability-disabled'))) throw Error('FIXTURE_STATUS_NOT_APPLIED');
    act(a, { type: 'PASS_WITHDRAWAL' });
    const end = (id: string) => act(id, { type: 'END_TURN', discardIds: state.players[id]!.hand.slice(0, Math.max(0, state.players[id]!.hand.length - derivedStats(state.players[id]!).handLimit)) });
    end(a); act(b, { type: 'START_TURN' });
    for (let i = 0; state.windows?.length && i < 200; i++) {
      const window = state.windows.at(-1)!;
      act(window.participants[window.cursor]!, { type: 'PASS' }, Array(100).fill(6));
    }
    if (silenced) { act(b, { type: 'CHOOSE_DRAW', draw: false }); return state; }
    if (!stopped) { act(b, { type: 'CHOOSE_DRAW', draw: false }); act(b, { type: 'PASS_ACTION' }); end(b); }
    act(c, { type: 'START_TURN' }); act(c, { type: 'CHOOSE_DRAW', draw: false });
    act(c, { type: 'ATTACK', cardInstanceId: bow, targetIds: [b], dedicated: false });
    for (let i = 0; state.windows?.at(-1)?.kind !== 'normal-defense' && i < 200; i++) {
      const window = state.windows?.at(-1); if (!window) throw Error('FIXTURE_MISSING_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    if (state.windows?.at(-1)?.kind !== 'normal-defense') throw Error('FIXTURE_DID_NOT_CONVERGE');
    return state;
  }
  if (name === 'dedicated-defense') { assignCharacter(state, b, '忍びのイダ'); takeCard(state, b, '手裏剣'); }
  if (name === 'optional-chant-ready') { assignCharacter(state, a, '早駆けのランカスター'); takeCard(state, a, '竜殺天空槍'); }
  if (name === 'lance-variant-ready') { assignCharacter(state, a, '早駆けのランカスター'); takeCard(state, a, '連槍撃'); }
  if (name === 'lancelot-variant-ready') {
    assignCharacter(state, a, '聖騎士ランスロット2');
    const card = takeCard(state, a, '光竜破山剣');
    state.players[a]!.hand = state.players[a]!.hand.filter(id => id !== card);
    state.players[a]!.chants.push({ cardInstanceId: card, revealed: false });
  }
  if (name === 'dedicated-chant-defense') {
    assignCharacter(state, b, '侍大将のシン');
    const card = takeCard(state, b, '天地爆砕剣');
    state.players[b]!.hand = state.players[b]!.hand.filter(id => id !== card);
    state.players[b]!.chants.push({ cardInstanceId: card, revealed: false });
  }
  if (name === 'magic-bypass') {
    assignCharacter(state, a, '凍気のアイエル');
    for (const [owner, followerName] of [[b, 'ゴブリン'], [c, '兵士']] as const) {
      const card = takeCard(state, owner, followerName);
      state.players[owner]!.hand = state.players[owner]!.hand.filter(id => id !== card);
      state.players[owner]!.followers.push({ cardInstanceId: card, revealed: false });
    }
  }
  if (name === 'magic-dedicated-defense') { assignCharacter(state, b, '白魔術師シェリム'); takeCard(state, b, '白光'); }
  if (name === 'magic-restricted-defense') {
    assignCharacter(state, a, '吟遊詩人のレスター'); assignCharacter(state, b, '白魔術師シェリム');
    for (const card of ['見切る', '手裏剣', '転移', '白光']) takeCard(state, b, card);
  }
  if (name === 'roll-damage') { assignCharacter(state, a, '吟遊詩人のレスター'); takeCard(state, a, '神性介入'); }
  if (name === 'nightmare-damage') { assignCharacter(state, a, '魔聖母ディア'); takeCard(state, a, '神性介入'); }
  if (name === 'roll-recovery') {
    state.players[a]!.statuses = [{ id: 'fixture-silence', kind: 'silenced', modifiers: [-2, -1], nextCheck: 1 }];
    state.phase = 'turn-start'; state.events = []; act(a, { type: 'START_TURN' }); return state;
  }
  const attack = takeCard(state, a, name === 'nightmare-damage' ? '悪夢' : name === 'roll-check' ? '炎流' : name === 'magic-restricted-defense' || name === 'roll-damage' ? '呪歌' : name === 'magic-bypass' ? '凍流' : name === 'multi-target-multi-hit' || name === 'chanted-ready' ? '天地百撃斬' : '踏み込み／弓');
  if (name === 'roll-check') {
    const intervention = takeCard(state, a, '神性介入'); trimHand(state, a, attack, intervention);
    const fate = takeCard(state, c, '命運凶変'); trimHand(state, c, fate);
    const blessing = takeCard(state, a, '神々の血');
    state.players[a]!.hand = state.players[a]!.hand.filter(id => id !== blessing); state.deck.unshift(blessing);
  }
  let prayer: string | undefined;
  if (name === 'third-party-interrupt') {
    const reaction = takeCard(state, c, '命運凶変'); trimHand(state, c, reaction);
    const blessing = takeCard(state, c, '祝福');
    state.players[c]!.hand = state.players[c]!.hand.filter(id => id !== blessing); state.deck.unshift(blessing);
  }
  if (name === 'prayer-effect-level') { prayer = takeCard(state, a, '必勝の祈り'); trimHand(state, a, prayer, attack); }
  if (name === 'follower-defense-started' || name === 'multi-target-multi-hit') {
    const follower = takeCard(state, b, '兵士');
    state.players[b]!.hand = state.players[b]!.hand.filter(id => id !== follower);
    state.players[b]!.followers.push({ cardInstanceId: follower, revealed: false });
  }
  if (name === 'follower-defense-started' || name === 'combat') takeCard(state, b, '見切る');
  if (name === 'multi-target-multi-hit' || name === 'chanted-ready') {
    state.players[a]!.hand = state.players[a]!.hand.filter(id => id !== attack);
    state.players[a]!.chants.push({ cardInstanceId: attack, revealed: false });
  }
  // Fixture rearrangement is not an actual deal; discard obsolete private assignment/draw associations.
  state.events = [];
  if (name === 'combat-ready' || name === 'chanted-ready' || name === 'optional-chant-ready' || name === 'lance-variant-ready' || name === 'lancelot-variant-ready') return state;
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: name === 'multi-target-multi-hit' || name === 'magic-bypass' ? [b, c] : [b], dedicated: name === 'multi-target-multi-hit' || name === 'magic-bypass' || name === 'magic-restricted-defense' || name === 'roll-damage' || name === 'nightmare-damage' }, [3]);
  if (name === 'third-party-interrupt') { act(a, { type: 'PASS' }); act(b, { type: 'PASS' }); return state; }
  const desired = name === 'roll-check' || name === 'roll-damage' || name === 'nightmare-damage' ? 'after-roll' : prayer ? 'effect-level' : name === 'magic-bypass' ? 'follower-bypass-choice' : 'normal-defense';
  for (let i = 0; i < 200 && state.windows?.at(-1)?.kind !== desired; i++) {
    const window = state.windows?.at(-1); if (!window) throw Error('FIXTURE_MISSING_WINDOW');
    act(window.participants[window.cursor]!, { type: 'PASS' }, name === 'roll-check' ? [6, 6] : name === 'multi-target-multi-hit' ? Array(100).fill(3) : entropy().dice);
  }
  if (state.windows?.at(-1)?.kind !== desired) throw Error('FIXTURE_DID_NOT_CONVERGE');
  if (name === 'follower-defense-started') {
    act(b, { type: 'START_FOLLOWERS' });
    for (let i = 0; i < 100 && state.windows?.at(-1)?.kind !== 'follower-start'; i++) {
      const window = state.windows?.at(-1); if (!window) throw Error('FIXTURE_MISSING_FOLLOWER_ENTRY');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    if (state.windows?.at(-1)?.kind !== 'follower-start') throw Error('FIXTURE_FOLLOWER_ENTRY_NOT_CLOSED');
  }
  return state;
}
