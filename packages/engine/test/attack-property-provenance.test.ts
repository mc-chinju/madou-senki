/** Direct helper evidence for combinations with no current canonical producer. Actual producers are in attack-property-abilities.test.ts. */
import {it,expect} from 'vitest';
import {attackPropertyTechnique,actualPropertyAttack,BLACK_BOW,LANCASTER_WIND} from '../src/abilities/attack-properties.js';
import {acceptActionModifiers,effectPreview,damagePreview,freezeEffectLevel,freezeDamage} from '../src/abilities/action-modifiers.js';
import {effectiveHitTechnique,freezeEntryModifiers} from '../src/abilities/follower-entry.js';
import {fixedReflectedTechnique} from '../src/abilities/follower-destruction.js';
import {techniqueFor} from '../src/effects/registry.js';
import type {ActionFrame,AttackGroup,AttackTarget,Technique} from '../src/reactions/continuations.js';
import {ready} from './combat-helpers.js';
import {character} from './fixtures.js';
function fixture(id=LANCASTER_WIND){const s=ready();character(s,'A',id===LANCASTER_WIND?'早駆けのランカスター':'黒妖精のアーネス');const base=techniqueFor('a2-p07-r3c3')!;
 const a:ActionFrame={id:'helper-source',eventId:'helper-event',parentWindowId:null,actorId:'A',cardInstanceId:'a2-p07-r3c3',kind:'attack',targetIds:['B'],technique:base,groupId:null,stage:'resolve',checks:[],roll:null,canceled:false};s.actions={[a.id]:a};
 const hit:AttackTarget['hits'][number]={index:0,sourceActionId:a.id,technique:structuredClone(base),defended:false,damage:10,hit:false,lineage:[]};const t:AttackTarget={actorId:'B',followerStarted:false,normalDefenseClosed:false,followerSnapshot:null,hits:[hit]};const g:AttackGroup={id:'helper-group',actionId:a.id,attackerId:'A',technique:structuredClone(base),targets:[t],hitIndices:[0],targetCursor:0,hitCursor:0,stage:'defense',maai:null};
 if(id===LANCASTER_WIND)g.selectedWind={abilityId:LANCASTER_WIND,actorId:'A'};else acceptActionModifiers(s,a).selected.push({abilityId:BLACK_BOW,actorId:'A',amount:1});return {s,a,t,g,hit};}
it('helper heterogeneous Wind qualifies each actual source and never falls back for missing/foreign/pure-defense/fixed sources',()=>{
 const {s,a,t,g,hit}=fixture();const magic:Technique={...a.technique,school:'magic',attributes:['魔']};
 for(const [name,patch,base,required] of [
  ['valid',{},a.technique,2],['magic',{},magic,1],['foreign',{actorId:'B'},a.technique,1],['pure-defense',{kind:'defense',technique:{...a.technique,defense:'parry'}},a.technique,1],['fixed',{fixedReceivedEffect:true},a.technique,1],['canceled',{canceled:true},a.technique,1],
 ] as const){const source={...a,...patch,id:name} as ActionFrame;s.actions![name]=source;const h={...hit,sourceActionId:name,technique:base};expect(attackPropertyTechnique(s,g,t,h,base).maaiRequired??1).toBe(required);}
 expect(attackPropertyTechnique(s,g,t,{...hit,sourceActionId:'missing'},a.technique).maaiRequired).toBeUndefined();
});
it('helper saved random additional maai remains additive and selected Wind never mutates printed requirement',()=>{
 const {s,t,g,hit}=fixture();const base={...hit.technique!,maaiRequired:5};expect(attackPropertyTechnique(s,g,t,hit,base).maaiRequired).toBe(6);expect(base.maaiRequired).toBe(5);s.players.A!.statuses=[{id:'helper',kind:'ability-disabled',modifiers:[0],nextCheck:0}];expect(attackPropertyTechnique(s,g,t,hit,base).maaiRequired).toBe(5);
});
it.each([LANCASTER_WIND,BLACK_BOW])('helper %s source ownership, active status and stopped status revalidate without fabricating inheritance',id=>{
 for(const mode of ['owner','disabled','stopped','inactive']){const {s,t,g,hit}=fixture(id);if(mode==='owner')character(s,'A','聖騎士ランスロット2');else if(mode==='inactive')s.players.A!.presence='pending-death';else s.players.A!.statuses=[{id:'helper',kind:mode==='disabled'?'ability-disabled':'stopped',modifiers:[0],nextCheck:0}];const result=attackPropertyTechnique(s,g,t,hit,hit.technique!);expect(result.maaiRequired).toBeUndefined();expect(result.evadeProhibited).toBeUndefined();}
});
it.each([LANCASTER_WIND,BLACK_BOW])('helper %s freezes per target, keeping one snapshot immutable and later target live',id=>{
 const {s,t,g,hit}=fixture(id);const later=structuredClone(t);later.actorId='C';g.targets.push(later);freezeEntryModifiers(s,g,t);t.followerDefense=[];const expected=id===LANCASTER_WIND?{maaiRequired:2}:{evadeProhibited:true};expect(effectiveHitTechnique(s,g,t,hit)).toMatchObject(expected);expect(effectiveHitTechnique(s,g,t,hit)).toMatchObject(expected);
 s.players.A!.statuses=[{id:'helper',kind:'ability-disabled',modifiers:[0],nextCheck:0}];expect(effectiveHitTechnique(s,g,t,hit)).toMatchObject(expected);expect(effectiveHitTechnique(s,g,later,later.hits[0]!)).not.toMatchObject(expected);
 const copied=fixedReflectedTechnique(effectiveHitTechnique(s,g,t,hit),hit.damage);expect(copied).toMatchObject(expected);expect(copied).not.toHaveProperty('selectedWind');expect(copied).not.toHaveProperty('modifiers');
});
it('helper BlackBow intrinsic no-evade survives suppression while selected numeric contributions disappear',()=>{
 const {s,a,t,g,hit}=fixture(BLACK_BOW);hit.technique!.evadeProhibited=true;s.players.A!.statuses=[{id:'helper',kind:'ability-disabled',modifiers:[0],nextCheck:0}];expect(effectiveHitTechnique(s,g,t,hit).evadeProhibited).toBe(true);expect(effectPreview(s,a)).toBe(5);expect(damagePreview(s,a)).toBe(10);
});
it('helper BlackBow damage addition precedes printed/chant multipliers; null remains null',()=>{
 const {s,a}=fixture(BLACK_BOW);a.technique.damageAdditive=3;a.technique.damageMultiplier=2;a.fromChant=true;a.technique.chantDamageMultiplier=2;expect(damagePreview(s,a)).toBe(60);expect(effectPreview(s,a)).toBe(6);freezeEffectLevel(s,a);freezeDamage(s,a);s.players.A!.statuses=[{id:'helper',kind:'ability-disabled',modifiers:[0],nextCheck:0}];expect(effectPreview(s,a)).toBe(6);expect(damagePreview(s,a)).toBe(60);
 const second=fixture(BLACK_BOW);second.a.technique.damage=null;expect(damagePreview(second.s,second.a)).toBeNull();
});
it('helper BlackBow counter classification is supported, but no current Arnes bow card legally declares a counter',()=>{
 const {s,a,t,g,hit}=fixture(BLACK_BOW);a.kind='defense';a.technique.defense='counter';expect(actualPropertyAttack(a)).toBe(true);expect(attackPropertyTechnique(s,g,t,hit,hit.technique!).evadeProhibited).toBe(true);a.technique.defense='reflect';expect(actualPropertyAttack(a)).toBe(false);expect(attackPropertyTechnique(s,g,t,hit,hit.technique!).evadeProhibited).toBeUndefined();
});
