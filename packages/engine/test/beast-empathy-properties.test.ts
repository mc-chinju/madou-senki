/** Direct internal probes below are helper evidence, not fabricated printed producers. */
import {it,expect} from 'vitest';
import {ready,act,until} from './combat-helpers.js';
import {character,handCard} from './fixtures.js';
import {viewFor,allCardInstanceIds} from '../src/index.js';
import {settleDamage,stableOutcome} from '../src/lifecycle/advance.js';
import {BEAST_EMPATHY,liveBeastSelection,saveBeastCapture} from '../src/abilities/beast-empathy.js';
import {resolveFollowerSnapshot} from '../src/combat/followers.js';
import type {AttackTarget} from '../src/reactions/continuations.js';
function scenario(){let s=ready();character(s,'A','獣使いのウパニシャット');const beast=handCard(s,'B','グリフォン');s.players.B!.hand=s.players.B!.hand.filter(id=>id!==beast);s.players.B!.followers.push({cardInstanceId:beast,revealed:false});const source=handCard(s,'A','黒翼飛翔剣');s=act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B'],dedicated:false});s=until(s,'attack-abilities');const o=viewFor(s,'A').abilityOptions.find(o=>o.abilityId===BEAST_EMPATHY)!;s=act(s,'A',{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId});s=until(s,'follower-start');return {s,beast,g:Object.values(s.groups!)[0]!};}
it('helper unknown explicit hit source never falls back to first source; fixed, pure defense and other actor excluded',()=>{
 const {s,g}=scenario();const h=g.targets[0]!.hits[0]!,base=h.technique!,a=s.actions![g.actionId]!;
 expect(liveBeastSelection(s,g,h,base)).toBeDefined();h.sourceActionId='missing';expect(liveBeastSelection(s,g,h,base)).toBeUndefined();delete h.sourceActionId;
 for(const patch of [{fixedReceivedEffect:true},{kind:'defense' as const,technique:{...a.technique,defense:'evade' as const}},{actorId:'B'}]){const state=structuredClone(s);Object.assign(state.actions![g.actionId]!,patch);expect(liveBeastSelection(state,g,h,base)).toBeUndefined();}
});
it.each(['ineffective','morale-failed','spirit-pass','virtual'] as const)('helper actual traversal never captures %s source',mode=>{
 const {s,g}=scenario(),t=g.targets[0]!,d=t.followerDefense![0]!;
 if(mode==='ineffective')d.ineffective=true;
 if(mode==='morale-failed')d.morale={dice:[6,6],threshold:0,success:false};
 if(mode==='spirit-pass'){d.descriptor.spiritPass=true;t.hits[0]!.technique!.attributes.push('精');delete t.hits[0]!.frozenBeastEmpathy;delete t.hits[0]!.technique!.ignoreFollowerAttributes;}
 if(mode==='virtual'){const {cardInstanceId,position,...rest}=d as Extract<typeof d,{source:'physical'}>;t.followerDefense![0]={...rest,source:'virtual',sourceId:'virtual-beast',position:-1};}
 expect(resolveFollowerSnapshot(s,g,t,()=>1)).toBe(true);expect(t.ignoredBeasts).toBeUndefined();expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);
});
it('helper simultaneous owner pending death prevents saved acquisition; actual reflected death separately covered',()=>{
 const {s,g}=scenario(),t=g.targets[0]!;expect(resolveFollowerSnapshot(s,g,t,()=>1)).toBe(true);t.hits[0]!.hit=true;t.pendingDamage=7;
 settleDamage(s,[{targetId:'B',damage:7,cause:'attack',eventId:g.actionId},{targetId:'A',damage:100,cause:'self-damage',eventId:g.actionId}],1000);expect(s.players.A!.presence).toBe('pending-death');saveBeastCapture(s,g);expect(s.lifecycle!.map(t=>t.kind)).toEqual(['death-batch']);
});
it('helper recorded source/hit evidence is immutable after traversal and zero damage cannot earn',()=>{
 const {s,g}=scenario(),t=g.targets[0]!;expect(resolveFollowerSnapshot(s,g,t,()=>1)).toBe(true);const records=structuredClone(t.ignoredBeasts);t.hits[0]!.lineage.push('later-lineage');expect(t.ignoredBeasts).toEqual(records);
 t.hits[0]!.hit=true;t.hits[0]!.damage=0;saveBeastCapture(s,g);expect(s.lifecycle?.some(t=>t.kind==='beast-capture')??false).toBe(false);
 t.hits[0]!.damage=7;saveBeastCapture(s,g);const task=s.lifecycle!.at(-1)!;expect(task.kind).toBe('beast-capture');if(task.kind!=='beast-capture')throw Error('CAPTURE');const saved=structuredClone(task);t.ignoredBeasts![0]!.hits[0]!.lineage.push('mutated-parent');delete s.groups![g.id];delete s.actions![g.actionId];expect(task).toEqual(saved);stableOutcome(s,1000);expect(s.outcome).toBeUndefined();
});
it('helper frozen first target and live later target diverge under suppression without mutating frozen snapshot',()=>{
 const {s,g}=scenario();const first=g.targets[0]!;const later:AttackTarget={actorId:'C',followerStarted:false,normalDefenseClosed:false,followerSnapshot:null,hits:[{...structuredClone(first.hits[0]!),technique:structuredClone(g.technique)}]};delete later.hits[0]!.frozenBeastEmpathy;g.targets.push(later);const before=JSON.stringify(first);s.players.A!.statuses=[{id:'helper-source-change',kind:'ability-disabled',modifiers:[0],nextCheck:0}];const v=viewFor(s,'D');expect(v.currentAttack!.targets.map(t=>t.hits[0]!.technique!.beastIgnore)).toEqual([true,false]);expect(JSON.stringify(first)).toBe(before);
});
