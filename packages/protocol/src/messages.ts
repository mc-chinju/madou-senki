export type ConditionalAbilityId = 'c2-p02-r1c1-ab04'|'c2-p03-r1c2-ab03'|'c2-p03-r2c2-ab04'|'c2-p04-r1c2-ab03'|'c2-p04-r1c2-ab05'|'c2-p05-r1c2-ab01'|'c2-p05-r2c1-ab05'|'c2-p06-r1c2-ab02';
export type AbilityEffectId='spirit-conversion'|'human-invalidation'|'arnes-suppression';
/** Player identity comes from the server session, never these commands. */
export type TechniqueVariant = 'one-hit' | 'two-hit' | 'lancelot-1' | 'lancelot-2';

export interface CoSourceChoice {cardInstanceId:string;dedicated:boolean;techniqueVariant?:TechniqueVariant}
export type FollowerAbilityId = 'c2-p05-r1c2-ab02' | 'c2-p06-r1c2-ab04';
export interface FollowerAttackSourceChoice {cardInstanceId:string;dedicated:boolean;targetIds:string[]}
export type GameCommand =
  | {type:'SET_CONDITIONAL_ABILITY';abilityId:ConditionalAbilityId;targetEventId:string;enabled:boolean;targetIds?:string[]}
  | {type:'CHOOSE_INSPECTION';decisionId:string;choice:'finish'|'discard-one'|'discard-all';cardInstanceId?:string}
  | {type:'CHOOSE_BEAST_CAPTURE';groupId:string;windowId:string;cardInstanceIds:string[]}
  | {type:'USE_FOLLOWER_ATTACK';abilityId:FollowerAbilityId;targetEventId:string;sources:FollowerAttackSourceChoice[]}
  | {type:'CHOOSE_DAMAGE_DOUBLE';actionId:string;attempt:boolean}
  | {type:'PAY_HIT_ADVANCES';groupId:string;cardInstanceIds:string[]}
  | {type:'PLAY_GROUP_DEFENSE'; declarationAbilityIds?:string[];cardInstanceId:string;groupId:string;dedicated:true}
  | {type:'USE_ABILITY';abilityId:string;targetEventId:string;targetId?:string;costCardInstanceId?:string;conceal?:boolean;abilityEffectIds?:AbilityEffectId[]}
  | {type:'PLAY_REACTION';cardInstanceId:string;mode:'cancel-ability';targetAbilityId:string}
  | {type:'PLAY_TURN_TECHNIQUE'; declarationAbilityIds?:string[];cardInstanceId:string;targetIds:string[];dedicated:boolean;convertTargetIds?:string[];followerTransfer?:{targetPosition:number;destinationPosition:number;replacementCardInstanceId?:string}}
  | {type:'CHOOSE_LIFETIME_EFFECT';choice:'apply'|'decline'}
  | {type:'PLAY_DEATH_GIFT';cardInstanceId:string;giftCardInstanceId:string;targetId:string}
  | {type:'CHOOSE_REVIVAL';revive:boolean}
  | {type:'USE_LIFECYCLE_ABILITY';ability:'lancelot-transform'|'vanmil-subordinates'|'arseil-conspiracy'}
  | {type:'TRANSFER_RITUAL';targetId:string}
  | {type:'USE_REVIVAL_RITUAL'}
  | { type: 'PLACE_INITIAL_FOLLOWER'; cardInstanceId: string }
  | { type: 'PASS_SETUP' }
  | { type: 'REVEAL_CHARACTER'; abilityId?:'c2-p04-r2c1-ab03' }
  | { type: 'START_TURN' }
  | { type: 'PASS' }
  | { type: 'START_FOLLOWERS'; dedicatedCardInstanceIds?:string[] }
  | { type: 'DISCARD_HIT_CHANTS'; discard: boolean }
  | { type: 'CHOOSE_FOLLOWER_BYPASS'; ignore: boolean }
  | { type: 'ATTACK'; declarationAbilityIds?:string[]; cardInstanceId: string; targetIds: string[]; dedicated: boolean; techniqueVariant?: TechniqueVariant; coSource?:CoSourceChoice; advanceCardInstanceIds?:string[] }
  | { type: 'PLAY_DEFENSE'; declarationAbilityIds?:string[]; cardInstanceId: string; dedicated: boolean; coSource?:CoSourceChoice }
  | { type: 'PLAY_REACTION'; cardInstanceId: string; mode: 'cancel' | 'force-fail' | 'effect-plus'; targetActionId: string; dedicated?: boolean }
  | { type: 'PLAY_REACTION'; cardInstanceId: string; mode: 'reroll' | 'force-fail'; targetRollId: string }
  | { type: 'CANCEL_REACTION'; targetActionId: string }
  | { type: 'APPROACH'; targetId: string; cardInstanceId: string }
  | { type: 'WITHDRAW'; targetId: string; cardInstanceId: string }
  | { type: 'PLAY_MAAI'; cardInstanceId: string }
  | { type: 'PLAY_ADVANCE'; cardInstanceId: string }
  | { type: 'PLAY_TURN_CARD'; cardInstanceIds: string[] }
  | { type: 'PASS_ACTION' }
  | { type: 'PASS_WITHDRAWAL' }
  | { type: 'CHOOSE_DRAW'; draw: boolean; abilityId?:string }
  | { type: 'REST'; cardInstanceIds: string[] }
  | { type: 'ARRANGE_FOLLOWERS'; cardInstanceIds: string[] }
  | { type: 'CHANT'; cardInstanceId: string; dedicated?: boolean }
  | { type: 'END_TURN'; discardIds: string[] };

export interface CommandEnvelope {
  protocolVersion: 1;
  commandId: string;
  expectedRevision: number;
  windowId?: string;
  windowRevision?: number;
  command: GameCommand;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'INVALID_COMMAND' | 'INVALID_ENVELOPE' };

/** Public-safe wire codes only. Add future engine/transport codes explicitly. */
export type PublicServerErrorCode = 'INVALID_COMMAND' | 'INVALID_ENVELOPE' | 'ROOM_UNAVAILABLE' | 'NOT_SEATED' | 'READ_ONLY_CONNECTION' | 'STALE_REVISION' | 'STALE_WINDOW' | 'COMMAND_ID_REUSED' | 'INVALID_ACTION' | 'MESSAGE_TOO_LARGE' | 'INTERNAL_ERROR';

export type ServerMessage<View> =
  | { type: 'snapshot'; revision: number; view: View }
  | { type: 'ack'; commandId: string; revision: number }
  | { type: 'error'; commandId?: string; code: PublicServerErrorCode };
