import type {GameState, PlayerState} from '../state.js';

export const VANMIL_BAN = 'c2-p07-r1c2-ab03';
export const LIA_BLESSING = 'c2-p03-r1c2-ab04';
export const SUPPRESSION_ABILITIES = {
  [VANMIL_BAN]: {name:'神と人の差', kind:'suppression'},
  [LIA_BLESSING]: {name:'祝福', kind:'suppression'},
} as const;
export const isSuppressionAbility = (id: string): id is keyof typeof SUPPRESSION_ABILITIES =>
  id === VANMIL_BAN || id === LIA_BLESSING;
const EXEMPT = new Set(['c2-p03-r1c2', 'c2-p07-r1c1']);

export interface SuppressionDesignation {
  id:string; sourceActorId:string; sourceCharacterId:string;
  sourceAbilityId:typeof VANMIL_BAN; targetId:string; eventId:string;
}
export interface BlessingLease {
  id:string; sourceActorId:string; sourceCharacterId:'c2-p03-r1c2';
  sourceLifeId:string; targetId:string; eventId:string;
}
export interface SuppressionContext {
  kind:'suppression'; sourceCharacterId:string; sourceLifeId:string; opportunityId:string;
}
/** Deterministic legacy identity; reading a view never mutates a stored game. */
export function lifeIdentity(p:PlayerState):string { return p.lifeId ?? `initial-life:${p.id}`; }
function liveLease(s:GameState, lease:BlessingLease):boolean {
  const p=s.players[lease.sourceActorId];
  return !!p && p.characterId===lease.sourceCharacterId && lifeIdentity(p)===lease.sourceLifeId
    && !['pending-death','dead','exited'].includes(p.presence ?? 'active');
}
export function cleanBlessingLeases(s:GameState):void {
  if(s.blessingLeases) s.blessingLeases=s.blessingLeases.filter(lease=>liveLease(s,lease));
}
export function vanmilSuppressed(s:GameState, actorId:string):boolean {
  const p=s.players[actorId];
  return !!p && !EXEMPT.has(p.characterId)
    && !!s.suppressionDesignations?.some(d=>d.targetId===actorId)
    && !s.blessingLeases?.some(lease=>lease.targetId===actorId && liveLease(s,lease));
}
/** Deliberately uses public identity only, including after private inspection. */
export function publicSuppressionTargets(s:GameState):string[] {
  return s.seatOrder.filter(id=>{
    const p=s.players[id]!;
    return (p.presence??'active')==='active' && !(p.revealed && EXEMPT.has(p.characterId));
  });
}
export interface SuppressionTargetView {
  targetId:string; designated:true; applicability:'private'|'suppressed'|'relieved'|'exempt';
}
export function suppressionTargetViews(s:GameState, viewerId:string):SuppressionTargetView[] {
  return s.seatOrder.filter(id=>s.suppressionDesignations?.some(d=>d.targetId===id)).map(targetId=>{
    const p=s.players[targetId]!;
    return {targetId, designated:true, applicability:targetId!==viewerId&&!p.revealed?'private':
      EXEMPT.has(p.characterId)?'exempt':vanmilSuppressed(s,targetId)?'suppressed':'relieved'};
  });
}
