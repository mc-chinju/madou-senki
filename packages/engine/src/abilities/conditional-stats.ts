import {sadLoveAuraActive,ARNES} from './sad-love-state.js';
import {getCharacter} from '@madou/catalog';
import type {GameState,PlayerState} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import {conditionalActive,conditionalSelection} from './conditional-selection.js';
import {TIA_SPIRIT,LIA_AURA,ARNES_SPIRIT,DRAGON_MORALE,ASFELT_TRUTH,UPA_BEAST,GARWIN_RIVAL,DIA_CAPACITY} from './conditional-sources.js';
import {combatStatContext,type StatProvenance} from './stat-context.js';
import type {ActionFrame} from '../reactions/continuations.js';
import {actualPropertyAttack} from './attack-properties.js';
function publicPerson(s:GameState,id:string):boolean{return Object.values(s.players).some(p=>isActive(p)&&p.revealed&&p.characterId===id);}
function publicLancelot(s:GameState):boolean{return publicPerson(s,'c2-p02-r2c2')||publicPerson(s,'c2-p07-r1c1');}
function publicMale(s:GameState,id:string):boolean{const p=s.players[id];return !!p&&isActive(p)&&p.revealed&&getCharacter(p.characterId)?.sex==='男';}
export function conditionalStatAdditions(s:GameState,p:PlayerState,provenance?:StatProvenance):{spirit:number;handLimit:number;moraleBonus:number}{
 let spirit=0,handLimit=0,moraleBonus=0;
 if(sadLoveAuraActive(s,p)&&publicPerson(s,ARNES))spirit++;
 const context=combatStatContext(s,provenance);
 if(conditionalActive(p,TIA_SPIRIT,s)&&publicPerson(s,'c2-p03-r2c1'))spirit++;
 if(conditionalActive(p,LIA_AURA,s)&&publicLancelot(s))spirit+=2;
 if(isActive(p)&&p.revealed)for(const source of Object.values(s.players))if(source.id!==p.id&&source.revealed&&conditionalActive(source,LIA_AURA,s)&&conditionalSelection(source,LIA_AURA)!.targetIds.includes(p.id))spirit++;
 const attacking=context?.attackerId===p.id;
 const defending=context?.targetIds.includes(p.id);
 const opponents=attacking?context!.targetIds:defending?[context!.attackerId]:[];
 if(conditionalActive(p,ARNES_SPIRIT,s)&&opponents.some(id=>publicMale(s,id)))spirit+=2;
 if(conditionalActive(p,ASFELT_TRUTH,s)&&p.faction==='GOOD')spirit++;
 if(conditionalActive(p,UPA_BEAST,s)&&attacking)spirit++;
 if(conditionalActive(p,GARWIN_RIVAL,s)&&p.faction==='EVIL'&&publicLancelot(s))spirit+=2;
 if(conditionalActive(p,DIA_CAPACITY,s)&&p.revealed)handLimit+=2;
 if(conditionalActive(p,DRAGON_MORALE,s)&&context?.moraleFollowerCardInstanceId){
  const g=context.groupId?s.groups?.[context.groupId]:undefined;
  const follower=g?.targets.find(t=>t.actorId===p.id)?.followerDefense?.find(d=>d.source!=='virtual'&&d.cardInstanceId===context.moraleFollowerCardInstanceId);
  if(follower?.source!=='virtual'&&follower?.descriptor.attributes.includes('竜'))moraleBonus+=2;
 }
 return {spirit,handLimit,moraleBonus};
}
/** Whole-source damage/effect clauses are evaluated only for the real technique producer. */
export function conditionalTechniqueAdditions(s:GameState,a:Pick<ActionFrame,'actorId'|'kind'|'technique'|'canceled'|'fixedReceivedEffect'|'followerOrigin'>,targetId?:string):{effect:number;damage:number}{
 let effect=0,damage=0;const p=s.players[a.actorId];if(!p||a.fixedReceivedEffect||a.followerOrigin)return {effect,damage};
 const technique=['attack','defense','turn-technique'].includes(a.kind)&&a.technique.attributes.some(x=>x==='戦'||x==='魔');
 if(technique&&conditionalActive(p,UPA_BEAST,s)&&a.technique.school==='warrior')damage++;
 const target=targetId?s.players[targetId]:undefined;
 if(technique&&actualPropertyAttack(a)&&conditionalActive(p,ASFELT_TRUTH,s)&&p.faction==='GOOD'&&target&&isActive(target)&&target.revealed&&['c2-p05-r2c2','c2-p05-r1c1'].includes(target.characterId)){effect++;damage+=2;}
 return {effect,damage};
}
