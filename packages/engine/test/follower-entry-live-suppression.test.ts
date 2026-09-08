import {it,expect} from 'vitest';
import {act,ready,until,closeWindow,pass,finish} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';
import {viewFor,transition,type GameState} from '../src/index.js';
it('Lester live suppression through actual Ida shadow child restores remaining target evade',()=>{
 let s=ready(); character(s,'A','吟遊詩人のレスター'); character(s,'B','忍びのイダ');
 // Documented training prerequisite: ordinary 地裂 use Lv6 versus trained magic6.
 s.players.A!.permanent={magic_level:1};
 const attack=handCard(s,'A','地裂'), seal=handCard(s,'B','錯乱'), evade=handCard(s,'C','見切る');
 s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B','C'],dedicated:false});
 s=until(s,'attack-abilities');
 let o=viewFor(s,'A').abilityOptions.find(o=>o.abilityId==='c2-p03-r2c1-ab02')!;
 s=act(s,'A',{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId,abilityEffectIds:['spirit-conversion']});
 s=closeWindow(s);s=until(s,'normal-defense');
 const parentId=Object.keys(s.groups!)[0]!;
 o=viewFor(s,'B').abilityOptions.find(o=>o.abilityId==='c2-p04-r2c2-ab01')!;
 s=act(s,'B',{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId});
 s=closeWindow(s);s=closeWindow(s,[1,1]);s=closeWindow(s);s=closeWindow(s,[6,6]);s=closeWindow(s);
 expect(s.windows!.at(-1)!.kind).toBe('ability-attack');
 s=act(s,'B',{type:'ATTACK',cardInstanceId:seal,targetIds:['A'],dedicated:false});
 for(let n=0;n<150;n++){
  const w=s.windows!.at(-1)!;
  if(w.kind==='normal-defense'&&w.continuation.kind==='group'&&w.continuation.id===parentId&&w.continuation.targetId==='C')break;
  // Only the real seal's on-hit resistance fails; declaration/excess checks succeed.
  const r=s.rolls?.at(-1);
  const dice=w.kind==='before-roll'&&r?.purpose==='status-resistance'?[6,6]:Array(30).fill(1);
  s=pass(s,dice);
 }
 expect(s.players.A!.statuses?.some(t=>t.kind==='ability-disabled')).toBe(true);
 expect(s.windows!.at(-1)).toMatchObject({kind:'normal-defense',continuation:{id:parentId,targetId:'C'}});
 expect(s.players.A!.statuses).toEqual(expect.arrayContaining([expect.objectContaining({kind:'ability-disabled',sourceActorId:'B',sourceCardInstanceId:seal})]));
 expect(s.groups![parentId]!.targets.find(t=>t.actorId==='C')!.followerSnapshot).toBeNull();
 expect(viewFor(s,'C').currentAttack).toMatchObject({technique:{attributes:['魔','地']},defenseRestrictions:{evadeProhibited:false}});
 expect(viewFor(s,'C').currentAction).toMatchObject({cardInstanceId:attack,technique:{school:'magic',attributes:['魔','地']}});
 s=act(s,'C',{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false});
 s=finish(s);
 expect(s.players.C!.damage).toBe(0);
 expect(s.discard).toContain(evade);
});

function convertedAttack(name='地裂',targets=['B','C']) {
 let s=ready();character(s,'A','吟遊詩人のレスター');
 // Fixture training permits the printed Lv6 source; qualification is saved at use.
 s.players.A!.permanent={magic_level:1};
 const source=handCard(s,'A',name);
 s=act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:targets,dedicated:false});
 s=until(s,'attack-abilities');
 const option=viewFor(s,'A').abilityOptions.find(o=>o.abilityId==='c2-p03-r2c1-ab02')!;
 s=act(s,'A',{type:'USE_ABILITY',abilityId:option.abilityId,targetEventId:option.targetEventId,abilityEffectIds:['spirit-conversion']});
 s=closeWindow(s);return until(s,'normal-defense');
}
function restrict(s:GameState,kind:'stopped'|'ability-disabled') {
 s.players.A!.statuses=[{id:'live-source-fixture',kind,modifiers:[0],nextCheck:0}];
}
it.each(['stopped','ability-disabled'] as const)('pre-snapshot %s removes only added spirit and reactivation preserves original qualification',kind=>{
 let s=convertedAttack();
 const group=Object.values(s.groups!)[0]!;
 const savedHits=JSON.stringify(group.targets.map(t=>t.hits));
 restrict(s,kind);
 const before=JSON.stringify(s),inactive=viewFor(s,'B');
 expect(inactive.currentAction).toMatchObject({technique:{attributes:['魔','地']}});
 expect(inactive.currentAttack).toMatchObject({defenseRestrictions:{evadeProhibited:false}});
 expect(inactive.currentAttack!.targets.every(t=>t.hits.every(h=>!h.technique!.attributes.includes('精')))).toBe(true);
 expect(JSON.stringify(s)).toBe(before); // Projection is pure, including hidden/other target views.
 s.players.A!.statuses=[];s.players.A!.permanent={magic_level:-5};
 expect(viewFor(s,'B').currentAttack).toMatchObject({technique:{attributes:['魔','地','精']},defenseRestrictions:{evadeProhibited:true}});
 expect(JSON.stringify(group.targets.map(t=>t.hits))).toBe(savedHits);
 s=finish(s);
});
it('printed spirit remains intrinsic after conversion source is disabled and still prohibits evasion',()=>{
 let s=convertedAttack('気斬',['B']);
 restrict(s,'ability-disabled');
 const evade=handCard(s,'B','見切る');
 expect(viewFor(s,'B').currentAttack).toMatchObject({defenseRestrictions:{evadeProhibited:true}});
 expect(viewFor(s,'B').currentAction!.source).toBe('card');
 expect(viewFor(s,'B').currentAttack!.technique.attributes.filter(a=>a==='精')).toHaveLength(1);
 const before=JSON.stringify(s);
 expect(transition(s,{actorId:'B',command:{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false}},entropy())).toEqual({ok:false,code:'ILLEGAL_DEFENSE'});
 expect(JSON.stringify(s)).toBe(before);
 s=finish(s);
});
it('source suppression preserves an already-frozen target while removing conversion from the next unfrozen target',()=>{
 let s=until(convertedAttack(),'follower-start');
 const groupId=Object.keys(s.groups!)[0]!;
 const first=s.groups![groupId]!.targets[0]!;
 expect(first.actorId).toBe('B');expect(first.followerDefense).toEqual([]);
 const frozen=JSON.stringify(first);
 restrict(s,'ability-disabled');
 const view=viewFor(s,'B');
 expect(view.currentAttack!.technique.attributes).toContain('精');
 expect(view.currentAttack!.targets.find(t=>t.actorId==='B')!.hits[0]!.technique!.attributes).toContain('精');
 expect(view.currentAttack!.targets.find(t=>t.actorId==='C')!.hits[0]!.technique!.attributes).not.toContain('精');
 expect(JSON.stringify(s.groups![groupId]!.targets[0])).toBe(frozen);
 s=closeWindow(s);s=until(s,'follower-entry-abilities');s=until(s,'follower-start');
 expect(s.groups![groupId]!.targets[0]!.hits[0]!.technique!.attributes).toContain('精');
 expect(s.groups![groupId]!.targets[1]!.hits[0]!.technique!.attributes).not.toContain('精');
 s=finish(s);
});
