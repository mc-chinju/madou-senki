export type RollPurpose = 'faction-change'|'card-inspection'|'training'|'extra-draw'| 'technique-check' | 'technique-value' | 'hit-resistance' | 'ability-check' | 'ability-value' | 'stop-duration' | 'revival' | 'activation' | 'use' | 'excess-level' | 'teleport' | 'counter' | 'status-resistance' | 'follower-morale' | 'status-recovery' | 'attack-hit-count' | 'attack-damage' | 'prayer-addition' | 'potion-recovery';
export type RollFormula = 'd6-product-min10' | 'd6' | '2d6' | '3d6' | '4d6+1' | 'd6x2' | 'd6x4' | 'd6x5' | '2d6x2';
export type RollResume = {kind:'turn-card';actionId:string} | {kind:'reclaim-check';decisionId:string} | {kind:'technique';actionId:string} | {kind:'ability';abilityId:string} | {kind:'revival';lifecycleId:string;targetId:string} | {
    kind: 'action-check';
    actionId: string;
} | {
    kind: 'action-value';
    actionId: string;
    value: 'declaration-effect' | 'hit-count' | 'damage' | 'effect-level' | 'ability-damage';
} | {
    kind: 'prayer';
    actionId: string;
} | {
    kind: 'follower';
    groupId: string;
    targetId: string;
    cardInstanceId: string;
} | {
    kind: 'hit';
    groupId: string;
    targetId: string;
} | {
    kind: 'recovery';
    turnId: string;
    statusId: string;
} | {
    kind: 'potion';
    turnId: string;
    cardInstanceId: string;
};
export interface RollAttempt {
    generation: number;
    faces: number[];
    total: number;
    success?: boolean;
}
export interface RollFrame {
    excludeSourceAbilityId?:string;
    id: string;
    eventId: string;
    rollerId: string;
    purpose: RollPurpose;
    kind: 'check' | 'numeric';
    formula: RollFormula;
    stage: 'before-roll' | 'after-roll' | 'applied';
    generation: number;
    faces: number[];
    modifier: number;
    total: number | null;
    threshold?: number;
    success?: boolean;
    forcedFailure: boolean;
    attempts: RollAttempt[];
    resume: RollResume;
    checkBase?: 'spirit' | 'morale' | 'fixed'|'warrior'|'magic';
    comparison?:'greater-than';
}
export interface TurnRollContinuation {
    id: string;
    actorId: string;
    kind: 'recovery' | 'potion';
    remainingIds: string[];
    hadStopped: boolean;
}
/** Explicit wire projection: modifier is printed/formula-only, never a derived hidden bonus. */
export interface PublicRollView {
    comparison?:'greater-than';
    rollId: string;
    eventId: string;
    purpose: RollPurpose;
    rollerId: string;
    kind: 'check' | 'numeric';
    formula: RollFormula;
    stage: RollFrame['stage'];
    generation: number;
    faces: number[];
    modifier: number;
    total: number | null;
    forcedFailure: boolean;
    threshold?: number;
    success?: boolean;
    attempts: RollAttempt[];
}
