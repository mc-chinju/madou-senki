import {currentEffectiveTechnique} from '../abilities/follower-entry.js';
import type {GameState} from '../state.js';
import {currentHit} from '../reactions/continuations.js';
import type { Technique } from '../reactions/continuations.js';
export type CounterOutcome='illegal'|'cancel'|'return'|'block';
export function counterOutcome(incoming:Technique,counter:Technique,distance:'near'|'far'):CounterOutcome{
  if(counter.effectLevel<incoming.effectLevel)return'illegal';
  if(counter.effectLevel===incoming.effectLevel)return'cancel';
  return counter.range==='far'||distance==='near'?'return':'block';
}

/** Only printed relative references follow this technique's final effect level. */
export function freezeRelativeDefenseLimits(technique:Technique):void {
  const relative=technique.relativeDefenseLimits;
  if(!relative)return;
  technique.blockWarriorLimit=technique.effectLevel+relative.warriorOffset;
  technique.reflectMagicLimit=technique.effectLevel+relative.magicOffset;
}

/** Shared acceptance/candidate checks for the current received hit. */
export function defenseLegality(
  state:GameState,technique:Technique,group:import('../reactions/continuations.js').AttackGroup,actorId:string,cardInstanceId:string,
):'ILLEGAL_DEFENSE'|'DEFENSE_WINDOW_CLOSED'|'ALREADY_USED'|undefined {
  const incoming=currentEffectiveTechnique(state,group,actorId);
  const target=group.targets.find(t=>t.actorId===actorId);
  if(!target||target.followerStarted)return 'DEFENSE_WINDOW_CLOSED';
  if(technique.defense==='none'||
    technique.defense==='evade'&&(incoming.attributes.includes('精')||incoming.evadeProhibited)||
    technique.defense==='counter'&&!technique.counterIgnoresLevel&&technique.effectLevel<incoming.effectLevel||
    technique.defense==='negate'&&incoming.school!=='magic'||
    technique.defense==='parry'&&incoming.school!=='warrior'||
    technique.defense==='reflect'&&incoming.effectLevel>(incoming.school==='magic'?technique.reflectMagicLimit??-1:technique.blockWarriorLimit??-1))return 'ILLEGAL_DEFENSE';
  if(technique.fixedNegate?.forbiddenAttributes?.some(attribute=>incoming.attributes.includes(attribute)))return 'ILLEGAL_DEFENSE';
  if(incoming.limitedDefenses&&!incoming.limitedDefenses.includes(technique.defense as 'teleport'|'counter'))return 'ILLEGAL_DEFENSE';
  if(incoming.counterProhibited&&(technique.counter||technique.attributes.includes('反')))return 'ILLEGAL_DEFENSE';
  if(technique.defense==='reflect'&&currentHit(group,actorId)!.lineage.includes(cardInstanceId))return 'ALREADY_USED';
}
