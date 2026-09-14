import {actionCards,characters} from '@madou/catalog';
import {describe,it,expect} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,ready,until,pass,finish,closeWindow as closeBoundary,passReclaims} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';
const HALF='c2-p03-r1c1-ab02',LIA='c2-p03-r1c2-ab01',SHIELD='c2-p07-r1c1-ab01',GAINAS='c2-p05-r2c2-ab02';
// Physical reaction disposal opens reclaim responses before its parent resumes.
function closeWindow(s:GameState,dice:number[]=Array(30).fill(1)){return passReclaims(closeBoundary(s,dice));}
function source(s:GameState,actor:string,id:string){return handCard(s,actor,actionCards.find(c=>c.id===id)!.name);}
function incoming(owner='c2-p03-r1c1',card='a2-p12-r2c2',targets=['B']){
 let s=ready();character(s,'B',characters.find(c=>c.id===owner)!.name);
 for(const p of Object.values(s.players))p.permanent={endurance:50,spirit:10};
 s.distances.A!.B=s.distances.B!.A='near';
 const id=source(s,'A',card);
 return until(act(s,'A',{type:'ATTACK',cardInstanceId:id,targetIds:targets,dedicated:false}),'normal-defense');
}
function use(s:GameState,id:string,actor='B'){
 const option=viewFor(s,actor).abilityOptions.find(o=>o.abilityId===id);expect(option).toBeDefined();
 expect(option).not.toHaveProperty('costCardInstanceIds');
 return act(s,actor,{type:'USE_ABILITY',abilityId:id,targetEventId:option!.targetEventId});
}
function group(s:GameState){return Object.values(s.groups!)[0]!;}
function checked(s:GameState,id:string,faces=[1,1]){
 s=closeWindow(use(s,id));expect(viewFor(s,'B').currentRoll).toMatchObject({purpose:'ability-check',formula:'2d6'});
 s=closeWindow(s,faces);return s;
}
describe('Task7s canonical received defense continuations',()=>{
 it('Lamba declares magic half without roll and settles damage once',()=>{
  let s=incoming();s=closeWindow(use(s,HALF));expect(s.rolls?.at(-1)?.purpose).not.toBe('ability-check');
  s=finish(s);expect(s.players.B!.damage).toBe(2);
 });
 it('Lia check then separate saved d6 closes exact-zero current hit',()=>{
  let s=incoming('c2-p03-r1c2');s=checked(s,LIA);
  expect(viewFor(s,'B').currentRoll).toMatchObject({modifier:-3,success:true});
  s=closeWindow(s,[4]);expect(viewFor(s,'B').currentRoll).toMatchObject({purpose:'ability-value',formula:'d6',total:4});
  s=closeWindow(JSON.parse(JSON.stringify(s)));expect(s.groups).toEqual({});expect(s.players.B!.damage).toBe(0);
 });
 it('Gainas reflects one actual magic hit without a second physical use',()=>{
  let s=incoming('c2-p05-r2c2');const before=[...s.resolution];
  s=checked(s,GAINAS);s=closeWindow(s);
  expect(s.resolution).toEqual(before);expect(Object.values(s.groups!)).toHaveLength(2);
  expect(viewFor(s,'A').currentAttack).toMatchObject({attackerId:'B',reflection:{source:'ability',actorId:'B',sourceCardInstanceId:'a2-p12-r2c2'}});
  s=finish(s);expect(s.players.A!.damage).toBe(4);expect(s.players.B!.damage).toBe(0);
 });
});
function place(s:GameState,actor:string,name:string){
 const card=handCard(s,actor,name);s.players[actor]!.hand=s.players[actor]!.hand.filter(c=>c!==card);
 s.players[actor]!.followers.push({cardInstanceId:card,revealed:false});return card;
}
function suppress(s:GameState,actor='B',kind:'stopped'|'ability-disabled'='ability-disabled'){
 s.players[actor]!.statuses=[{id:'helper-suppression',kind,modifiers:[0],nextCheck:0}];
}
function reject(s:GameState,actorId:string,command:unknown,code='ABILITY_DISABLED'){
 const before=JSON.stringify(s);expect(transition(s,{actorId,command} as any,entropy())).toEqual({ok:false,code});
 expect(JSON.stringify(s)).toBe(before);
}
function finishFailingResistance(s:GameState){
 for(let n=0;n<200&&s.windows?.length;n++){
  const roll=s.rolls?.at(-1);s=pass(s,s.windows.at(-1)!.kind==='before-roll'&&roll?.purpose==='status-resistance'?[6,6]:Array(30).fill(1));
 }
 expect(s.windows).toEqual([]);return s;
}
it.each([['a2-p17-r2c2',7,3],['a2-p14-r1c2',6,2]])('canonical magic %s damage %i behind actual SoldierHP1 floors last to %i',(card,damage,result)=>{
 let s=incoming('c2-p03-r1c1',card);const soldier=place(s,'B','兵士');
 expect(group(s).technique.damage).toBe(damage);s=closeWindow(use(s,HALF));
 s=finish(s);expect(s.players.B!.damage).toBe(result);expect(s.discard).toContain(soldier);
});
it.each([['a2-p17-r2c3',null,5],['a2-p12-r3c1',4,5]])('canonical magic %s resistance failure preserves direct %s and total %i',(card,direct,result)=>{
 let s=incoming('c2-p03-r1c1',card);s.players.B!.permanent!.spirit=0;
 expect(group(s).technique.damage).toBe(direct);s=closeWindow(use(s,HALF));
 s=finishFailingResistance(s);expect(s.players.B!.damage).toBe(result);
});
it('canonical magic null with successful resistance stays null and zero; warrior failure10 is never halved',()=>{
 let s=incoming('c2-p03-r1c1','a2-p17-r2c3');s=closeWindow(use(s,HALF));s=finish(s);
 expect(s.players.B!.damage).toBe(0);
 s=ready();character(s,'A','魔導王ガイナス');character(s,'B','小人のランバ');
 for(const p of Object.values(s.players))p.permanent={endurance:50};
 const blood=source(s,'A','a2-p09-r2c3');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==blood);s.players.A!.chants.push({cardInstanceId:blood,revealed:false});
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:blood,targetIds:['B'],dedicated:true}),'normal-defense');
 expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===HALF)).toBe(false);
 const damage=group(s).technique.damage!;s.players.B!.permanent!.spirit=0;
 s=finishFailingResistance(s);expect(s.players.B!.damage).toBe(damage+10);
});
it.each(['stopped','ability-disabled'] as const)('canonical two-target half cutoff fixes B before later helper %s while C is pending',status=>{
 let s=incoming('c2-p03-r1c1','a2-p18-r1c3',['B','C']);s=closeWindow(use(s,HALF));
 const id=group(s).id;s=until(s,'follower-start');
 while(s.groups![id]!.targets[0]!.pendingDamage===undefined)s=pass(s);
 const b=s.groups![id]!.targets[0]!,c=s.groups![id]!.targets[1]!;
 expect(b.pendingDamage).toBe(4);expect(c.pendingDamage).toBeUndefined();
 for(const viewer of s.seatOrder)expect(viewFor(s,viewer).currentAttack!.targets[0]!.hits[0]!.bodyDamage).toEqual({directDamage:4,resistanceDamage:0,total:4});
 suppress(s,'B',status);s=finish(JSON.parse(JSON.stringify(s)));
 expect([s.players.B!.damage,s.players.C!.damage]).toEqual([4,8]);
});
it.each(['stopped','ability-disabled'] as const)('helper magic half stays live through hit children before %s; fixed result never recalculates',status=>{
 let s=incoming();s=closeWindow(use(s,HALF));s=until(s,'hit');suppress(s,'B',status);
 s=finish(s);expect(s.players.B!.damage).toBe(4);
});
it('canonical Lia positive residual is fixed once after ordinary reroll choices',()=>{
 let s=incoming('c2-p03-r1c2','a2-p14-r1c3');const reroll=handCard(s,'C','神性介入');
 s=checked(s,LIA);s=closeWindow(s,[1]);
 expect(viewFor(s,'B').currentRoll).toMatchObject({formula:'d6',total:1});
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='C')s=pass(s);
 s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:reroll,mode:'reroll',targetRollId:viewFor(s,'C').reactionTargetRollId!});
 s=closeWindow(s,[2]);expect(viewFor(s,'B').currentRoll).toMatchObject({generation:1,total:2});
 s=closeWindow(JSON.parse(JSON.stringify(s)));
 expect(viewFor(s,'B').currentAttack!.technique.effectLevel).toBe(4);
 const saved=s.rolls!.filter(r=>r.purpose==='ability-value');expect(saved).toHaveLength(1);expect(saved[0]!.attempts).toHaveLength(2);
 s=finish(s);expect(s.players.B!.damage).toBe(10);
});
it('canonical Lia failed check spends attempt and force-fail result child prevents value die',()=>{
 for(const force of [false,true]){
  let s=incoming('c2-p03-r1c2');s.players.B!.permanent!.spirit=0;
  const fate=handCard(s,'C','命運凶変');s=checked(s,LIA,force?[1,1]:[6,6]);
  if(force){while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='C')s=pass(s);
   s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:viewFor(s,'C').reactionTargetRollId!});s=closeWindow(s);
  }
  s=closeWindow(s);expect(s.rolls!.filter(r=>r.purpose==='ability-value')).toHaveLength(0);
  expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===LIA)).toBe(false);
  s=finish(s);expect(s.players.B!.damage).toBe(4);
 }
});
it('canonical Lia reduction and disappearance affect only one target',()=>{
 let s=incoming('c2-p03-r1c2','a2-p18-r1c3',['B','C']);s=checked(s,LIA);s=closeWindow(s,[6]);s=closeWindow(s);
 expect(group(s).targets.map(t=>t.hits[0]!.defended)).toEqual([true,false]);
 expect(group(s).technique.effectLevel).toBe(6);s=finish(s);
 expect([s.players.B!.damage,s.players.C!.damage]).toEqual([0,8]);
});
it.each([HALF,LIA,GAINAS])('canonical %s exact binding/cost/priority rejection, cancellation and late follower entry',id=>{
 const owner=id===HALF?'c2-p03-r1c1':id===LIA?'c2-p03-r1c2':'c2-p05-r2c2';
 let s=incoming(owner);const option=viewFor(s,'B').abilityOptions.find(o=>o.abilityId===id)!;
 const command={type:'USE_ABILITY',abilityId:id,targetEventId:option.targetEventId};
 reject(s,'A',command);reject(s,'B',{...command,targetEventId:'wrong'},'INVALID_TARGET');
 reject(s,'B',{...command,costCardInstanceId:s.players.B!.hand[0]},'INVALID_COMMAND');
 reject(s,'B',{...command,abilityEffectIds:['spirit-conversion']},'INVALID_COMMAND');
 const fate=handCard(s,'C','命運凶変');s=use(s,id);
 for(const viewer of ['A','C','D'])expect(JSON.stringify(viewFor(s,viewer))).not.toContain(id);
 s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(s,'C').reactionTargetAbilityId!});
 s=closeWindow(s);s=closeWindow(s);reject(s,'B',command);
 expect(s.rolls?.some(r=>r.purpose==='ability-check')).not.toBe(true);
 s=act(s,'B',{type:'START_FOLLOWERS'});reject(s,'B',command);s=finish(s);expect(s.players.B!.damage).toBe(4);
});
function transformedIncoming(card='a2-p14-r1c1',prayerAmount=0){
 let s=ready();character(s,'A','聖騎士ランスロット');character(s,'C','リーア姫');character(s,'B','邪祭ウーノス');
 for(const p of Object.values(s.players))p.permanent={endurance:50};
 s=act(s,'C',{type:'REVEAL_CHARACTER'});
 s=act(s,'A',{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'});s=finish(s);
 expect(s.players.A!.abilityCharacterIds).toEqual(['c2-p02-r2c2','c2-p07-r1c1']);
 s=act(s,'A',{type:'PASS_ACTION'});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(5)});
 s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});
 const attack=source(s,'B',card),prayer=prayerAmount?handCard(s,'B','必勝の祈り'):undefined;
 s=act(s,'B',{type:'ATTACK',cardInstanceId:attack,targetIds:['A'],dedicated:false});
 if(prayer){
  s=until(s,'effect-level');while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);
  s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:Object.values(s.actions!).find(a=>a.kind==='attack')!.id});
  s=closeWindow(s,[prayerAmount]);s=closeWindow(s);
 }
 return until(s,'normal-defense');
}
it.each([true,false])('canonical transformed LancelotII shield check success=%s uses actual warrior threshold',success=>{
 let s=transformedIncoming();const options=viewFor(s,'A').abilityOptions.map(o=>o.abilityId);
 expect(options).toEqual(expect.arrayContaining([SHIELD,'c2-p02-r2c2-ab01']));
 s=closeWindow(use(s,SHIELD,'A'));expect(viewFor(s,'A').currentRoll).toMatchObject({modifier:-5});
 s=closeWindow(s,success?[1,1]:[6,6]);expect(viewFor(s,'A').currentRoll!.success).toBe(success);
 s=closeWindow(s);
 if(!success)expect(viewFor(s,'A').abilityOptions.map(o=>o.abilityId)).toContain('c2-p02-r2c2-ab01');
 s=finish(s);expect(s.players.A!.damage).toBe(success?0:12);
});
it('canonical transformed LancelotII shield reserves high incoming black level until inherited WhiteSilver reduction',()=>{
 let s=transformedIncoming('a2-p14-r1c1',2);
 expect(viewFor(s,'A').currentAttack!.technique.effectLevel).toBe(7);
 s=closeWindow(use(s,SHIELD,'A'));s=closeWindow(s,[1,1]);s=closeWindow(s);
 expect(group(s).targets[0]!.hits[0]!.defended).toBe(false);
 s=closeWindow(use(s,'c2-p02-r2c2-ab01','A'));expect(s.groups).toEqual({});
 expect(s.rolls!.filter(r=>r.purpose==='ability-check')).toHaveLength(1);
});
it.each(['stopped','ability-disabled'] as const)('helper Lia suppression during saved numeric children %s prevents applying reduction',status=>{
 let s=incoming('c2-p03-r1c2');s=checked(s,LIA);s=closeWindow(s,[3]);suppress(s,'B',status);
 s=closeWindow(s);expect(viewFor(s,'B').currentAttack!.technique.effectLevel).toBe(4);
 s=finish(s);expect(s.players.B!.damage).toBe(4);
});
it('helper successful shield observes later warrior change at open normal defense, and waits for unresolved children',()=>{
 let s=transformedIncoming('a2-p14-r1c3');s.players.A!.permanent!.warrior_level=-1; // helper warrior5
 s=closeWindow(use(s,SHIELD,'A'));s=closeWindow(s,[1,1]);s=closeWindow(s);
 expect(group(s).targets[0]!.hits[0]!.defended).toBe(false);
 s=use(s,'c2-p02-r2c2-ab01','A');s.players.A!.permanent!.warrior_level=0;
 expect(s.windows!.at(-1)!.kind).toBe('declaration');expect(group(s).targets[0]!.hits[0]!.defended).toBe(false);
 s=closeWindow(s);expect(s.groups).toEqual({});expect(s.players.A!.damage).toBe(0);
});
it('canonical Gainas reflection permits original attacker ordinary counter defense and preserves source privacy',()=>{
 let s=incoming('c2-p05-r2c2','a2-p14-r1c2');const negate=handCard(s,'A','結界');
 s=checked(s,GAINAS);s=closeWindow(s);
 for(const viewer of ['A','C','D']){
  expect(viewFor(s,viewer).currentAction).toMatchObject({source:'ability',kind:'ability',label:'特殊能力'});
  expect(JSON.stringify(viewFor(s,viewer))).not.toContain(GAINAS);
 }
 expect(viewFor(s,'B').currentAction).toMatchObject({abilityId:GAINAS,abilityName:'魔導王の威厳'});
 s=act(s,'A',{type:'PLAY_DEFENSE',cardInstanceId:negate,dedicated:false});s=finish(s);
 expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);
});
it('canonical dedicated counter-prohibited skeleton offers and accepts no Gainas reflection',()=>{
 let s=ready();character(s,'A','不死王ガドューラ');character(s,'B','魔導王ガイナス');
 const skeleton=handCard(s,'A','スケルトン');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:skeleton,targetIds:['B'],dedicated:true}),'normal-defense');
 expect(viewFor(s,'B').currentAttack!.defenseRestrictions.counterProhibited).toBe(true);
 expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===GAINAS)).toBe(false);
 reject(s,'B',{type:'USE_ABILITY',abilityId:GAINAS,targetEventId:s.windows!.at(-1)!.eventId});
});
it('canonical Gainas reflection lineage survives a physical mirror and bars repeat use',()=>{
 let s=incoming('c2-p05-r2c2');const mirror=handCard(s,'A','神王界');
 s=checked(s,GAINAS);s=closeWindow(s);
 s=act(s,'A',{type:'PLAY_DEFENSE',cardInstanceId:mirror,dedicated:false});s=until(s,'normal-defense');
 expect(viewFor(s,'B').currentAttack!.attackerId).toBe('A');
 expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===GAINAS)).toBe(false);
 const child=Object.values(s.groups!).at(-1)!;expect(child.targets[0]!.hits[0]!.lineage).toContain(GAINAS);
 s=finish(s);expect(s.players.A!.damage).toBe(0);expect(s.players.B!.damage).toBe(4);
});
it.each(['stopped','ability-disabled'] as const)('helper Gainas %s before commit cancels result; after commit leaves copied child intact',status=>{
 let s=incoming('c2-p05-r2c2');s=checked(s,GAINAS);suppress(s,'B',status);s=closeWindow(s);
 expect(Object.values(s.groups!)).toHaveLength(1);s=finish(s);expect(s.players.B!.damage).toBe(4);
 s=incoming('c2-p05-r2c2');s=checked(s,GAINAS);s=closeWindow(s);suppress(s,'B',status);
 expect(Object.values(s.groups!)).toHaveLength(2);s=finish(s);
 expect(s.players.A!.damage).toBe(4);expect(s.players.B!.damage).toBe(0);
});
it('canonical C10 mixed human bundle halves each magic hit and leaves warrior source unchanged',()=>{
 let s=ready();character(s,'A','魔聖母ディア');character(s,'B','小人のランバ');
 for(const p of Object.values(s.players))p.permanent={endurance:50,spirit:10};
 s.distances.A!.B=s.distances.B!.A='near';
 const cards=['兵士','闇の聖女','女性親衛隊'].map(name=>handCard(s,'A',name));
 const option=viewFor(s,'A').followerBundleOptions[0]!;
 s=act(s,'A',{type:'USE_FOLLOWER_ATTACK',abilityId:option.abilityId,targetEventId:option.targetEventId,sources:cards.map(cardInstanceId=>({cardInstanceId,dedicated:false,targetIds:['B']}))});
 s=until(s,'normal-defense');
 expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===HALF)).toBe(false);s=pass(s);
 for(const hitIndex of [1,2]){
  expect(viewFor(s,'B').currentAttack!.hitIndex).toBe(hitIndex);
  s=closeWindow(use(s,HALF));s=pass(s);
 }
 expect(group(s).targets[0]!.hits.map(h=>h.damage)).toEqual([1,6,6]);
 s=finish(s);expect(s.players.B!.damage).toBe(7);
});
it('canonical Griffin gives Lia a fresh check and die on each actual hit',()=>{
 let s=ready();character(s,'A','獣使いのウパニシャット');character(s,'B','リーア姫');
 s.players.B!.permanent={endurance:50,spirit:10};const griffin=handCard(s,'A','グリフォン');
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:griffin,targetIds:['B'],dedicated:true}),'normal-defense');
 const events:string[]=[];
 for(const hitIndex of [0,1]){
  expect(viewFor(s,'B').currentAttack!.hitIndex).toBe(hitIndex);
  events.push(viewFor(s,'B').abilityOptions.find(o=>o.abilityId===LIA)!.targetEventId);
  s=checked(s,LIA);s=closeWindow(s,[5]);s=closeWindow(s);
 }
 expect(events[0]).not.toBe(events[1]);expect(s.rolls!.filter(r=>r.purpose==='ability-check')).toHaveLength(2);
 s=finish(s);expect(s.players.B!.damage).toBe(0);
});
it('canonical failed magic stop resistance suppresses reserved half before final numeric settlement',()=>{
 let s=incoming('c2-p03-r1c1','a2-p12-r3c3');s.players.B!.permanent!.spirit=0;
 s=closeWindow(use(s,HALF));s=finishFailingResistance(s);
 expect(s.players.B!.statuses!.some(status=>status.kind==='stopped')).toBe(true);
 expect(s.players.B!.damage).toBe(4);
});
it.each([HALF,LIA,GAINAS])('canonical %s declining normal defense creates no attempt or check',id=>{
 const owner=id===HALF?'c2-p03-r1c1':id===LIA?'c2-p03-r1c2':'c2-p05-r2c2';
 let s=incoming(owner);s=act(s,'B',{type:'START_FOLLOWERS'});s=finish(s);
 expect(s.players.B!.damage).toBe(4);expect(s.rolls?.some(r=>r.purpose==='ability-check')).not.toBe(true);
});
it('helper multiple odd magic hits floor per hit, preserve zero, and ignore unrelated warrior slots',()=>{
 let s=incoming();const g=group(s),t=g.targets[0]!;
 // No current canonical source emits repeated magic hits: explicitly probe heterogeneous hit math.
 g.hitIndices=[0,1,2,3];g.technique.hitCount=4;
 t.hits=Array.from({length:4},(_,index)=>({...structuredClone(t.hits[0]!),index,damage:index===2?0:5,technique:{...structuredClone(g.technique),school:index===3?'warrior':'magic'}}));
 for(const hit of [0,1,2]){expect(viewFor(s,'B').currentAttack!.hitIndex).toBe(hit);s=closeWindow(use(s,HALF));s=pass(s);}
 expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===HALF)).toBe(false);
 s=finish(s);expect(s.players.B!.damage).toBe(9);
});
it('helper magic half runs after hit multiplier; null failure projection keeps independent damage and attribution',()=>{
 let s=incoming();const g=group(s);g.technique.dragonKingHit=true;
 s=closeWindow(use(s,HALF));s=until(s,'before-roll');s=closeWindow(s,[6,6]);s=finish(s);
 expect(s.players.B!.damage).toBe(6); // 4 × 3 then half; helper magic multiplier combination.
 s=incoming('c2-p03-r1c1','a2-p17-r2c3');s.players.B!.permanent!.spirit=0;
 const groupId=group(s).id;group(s).targets.push({...structuredClone(group(s).targets[0]!),actorId:'C'});
 s=closeWindow(use(s,HALF));
 for(let n=0;n<150&&s.groups![groupId]!.targets[0]!.pendingDamage===undefined;n++){
  const roll=s.rolls?.at(-1);s=pass(s,s.windows!.at(-1)!.kind==='before-roll'&&roll?.purpose==='status-resistance'?[6,6]:Array(30).fill(1));
 }
 const hit=viewFor(s,'A').currentAttack!.targets[0]!.hits[0]!;
 expect(hit.technique!.damage).toBeNull();expect(hit.bodyDamage).toEqual({directDamage:null,resistanceDamage:5,total:5});
 expect(s.actions![s.groups![groupId]!.actionId]!.cardInstanceId).toBe('a2-p17-r2c3');
 s=finish(s);expect(s.players.B!.damage).toBe(5);
});
it.each(['reserve-first','reduce-first'])('helper Lia composes compatible shield/robe numeric provenance in %s order',order=>{
 let s=incoming('c2-p03-r1c2','a2-p14-r1c3');
 s.players.B!.abilityCharacterIds=['c2-p02-r1c2','c2-p07-r1c1']; // hypothetical ownership composition, not transformation.
 s.players.B!.permanent!.warrior_level=0; // Lia's own current warrior3 remains authoritative.
 const reserve=()=>{s=closeWindow(use(s,'c2-p02-r1c2-ab02'));s=checked(s,SHIELD);s=closeWindow(s);};
 if(order==='reserve-first')reserve();
 s=checked(s,LIA);s=closeWindow(s,[3]);s=closeWindow(s);
 if(order==='reduce-first')s=closeWindow(use(s,'c2-p02-r1c2-ab02'));
 expect(s.groups).toEqual({});expect(s.players.B!.damage).toBe(0);
});
it('helper Gainas copies reduced received effect once without body-half or reflector boosts',()=>{
 let s=incoming('c2-p05-r2c2');s.players.B!.abilityCharacterIds=['c2-p03-r2c2','c2-p03-r1c1'];
 s=closeWindow(use(s,'c2-p03-r2c2-ab01'));s=closeWindow(use(s,HALF));
 s=checked(s,GAINAS);s=closeWindow(s);
 const child=Object.values(s.groups!).at(-1)!;
 expect(child.technique).toMatchObject({effectLevel:3,damage:4,attributes:['魔','水'],counter:true});
 expect(child.targets[0]!.hits[0]!.receivedDefense).toBeUndefined();
 expect(s.actions![child.actionId]!).toMatchObject({fixedReceivedEffect:true,checks:[],cardInstanceId:'a2-p12-r2c2'});
 s=finish(s);expect(s.players.A!.damage).toBe(4);expect(s.players.B!.damage).toBe(0);
});
it.each([HALF,LIA,GAINAS])('helper %s stopped/disabled/inactive/owner validation before offer and during declaration',id=>{
 const owner=id===HALF?'c2-p03-r1c1':id===LIA?'c2-p03-r1c2':'c2-p05-r2c2';
 for(const reason of ['stopped','ability-disabled','inactive','owner'] as const){
  let s=incoming(owner);const event=viewFor(s,'B').abilityOptions.find(o=>o.abilityId===id)!.targetEventId;
  const change=(state:GameState)=>{if(reason==='inactive')state.players.B!.presence='wandering';else if(reason==='owner')character(state,'B','侍大将のシン');else suppress(state,'B',reason);};
  const offered=structuredClone(s);change(offered);expect(viewFor(offered,'B').abilityOptions).toEqual([]);
  reject(offered,'B',{type:'USE_ABILITY',abilityId:id,targetEventId:event},reason==='stopped'?'STOPPED':reason==='inactive'?'INACTIVE_ACTOR':'ABILITY_DISABLED');
  s=use(s,id);change(s);s=closeWindow(s);
  expect(s.rolls?.some(r=>r.purpose==='ability-check')).not.toBe(true);
  if(reason!=='inactive'){s=finish(s);expect(s.players.B!.damage).toBe(4);}
 }
});
it('canonical transformed shield exact binding rejection and canceled attempt leave inherited armor available',()=>{
 let s=transformedIncoming();const option=viewFor(s,'A').abilityOptions.find(o=>o.abilityId===SHIELD)!;
 const command={type:'USE_ABILITY',abilityId:SHIELD,targetEventId:option.targetEventId};
 reject(s,'B',command);reject(s,'A',{...command,targetEventId:'wrong'},'INVALID_TARGET');
 reject(s,'A',{...command,costCardInstanceId:s.players.A!.hand[0]},'INVALID_COMMAND');
 const fate=handCard(s,'B','命運凶変');s=use(s,SHIELD,'A');
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(s,'B').reactionTargetAbilityId!});
 s=closeWindow(s);s=closeWindow(s);reject(s,'A',command);
 expect(viewFor(s,'A').abilityOptions.map(o=>o.abilityId)).toContain('c2-p02-r2c2-ab01');
 expect(s.rolls?.some(r=>r.purpose==='ability-check')).not.toBe(true);
 s=closeWindow(use(s,'c2-p02-r2c2-ab01','A'));expect(s.groups).toEqual({});
});
it('canonical failed Gainas check consumes attempt without reflecting',()=>{
 let s=incoming('c2-p05-r2c2');s.players.B!.permanent!.spirit=0;
 s=checked(s,GAINAS,[6,6]);expect(viewFor(s,'B').currentRoll!.success).toBe(false);s=closeWindow(s);
 expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===GAINAS)).toBe(false);
 expect(Object.values(s.groups!)).toHaveLength(1);s=finish(s);
 expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,4]);
});
it('canonical Gainas preserves null technique and its separate resistance effect on original attacker',()=>{
 let s=incoming('c2-p05-r2c2','a2-p17-r2c3');s.players.A!.permanent!.spirit=0;
 s=checked(s,GAINAS);s=closeWindow(s);
 const child=Object.values(s.groups!).at(-1)!;
 expect(child.technique).toMatchObject({damage:null,attributes:['魔','精'],onHitResistance:{failureDamage:10}});
 expect(child.targets[0]!.hits[0]!.damage).toBeNull();s=finishFailingResistance(s);
 expect([s.players.A!.damage,s.players.B!.damage]).toEqual([10,0]);
});
it('helper Gainas returns near warrior at changed distance without reflector on-hit boosts',()=>{
 let s=incoming('c2-p05-r2c2','a2-p08-r1c1');s.players.B!.abilityCharacterIds=['c2-p04-r2c2'];
 s=checked(s,GAINAS);s.distances.A!.B=s.distances.B!.A='far';s=closeWindow(s);
 expect(viewFor(s,'A').currentAttack!.attackerId).toBe('B');
 s=until(s,'hit-abilities');
 for(const viewer of s.seatOrder)expect(viewFor(s,viewer).abilityOptions.some(o=>o.abilityId==='c2-p04-r2c2-ab03')).toBe(false);
 s=finish(s);expect(s.players.A!.damage).toBe(7);expect(s.players.B!.damage).toBe(0);
});
it.each(['stopped','ability-disabled'] as const)('helper transformed shield %s during check children drops reservation',status=>{
 let s=transformedIncoming();s=closeWindow(use(s,SHIELD,'A'));s=closeWindow(s,[1,1]);suppress(s,'A',status);
 s=closeWindow(s);expect(group(s).targets[0]!.hits[0]!.receivedDefense!.reserved).not.toContain(SHIELD);
 s=finish(s);expect(s.players.A!.damage).toBe(12);
});
it('canonical Gainas two-target reflection consumes only his received hit and original C still lands',()=>{
 let s=incoming('c2-p05-r2c2','a2-p18-r1c3',['B','C']);s=checked(s,GAINAS);expect(viewFor(s,'B').currentRoll).toMatchObject({modifier:-5,success:true});s=closeWindow(s);
 const parent=group(s);expect(parent.targets.map(t=>t.hits[0]!.defended)).toEqual([true,false]);
 expect(Object.values(s.groups!).at(-1)!.targets.map(t=>t.actorId)).toEqual(['A']);
 s=finish(s);expect([s.players.A!.damage,s.players.B!.damage,s.players.C!.damage]).toEqual([8,0,8]);
});
it('canonical Gainas gets a fresh attempt on later Griffin hit after first failed check',()=>{
 let s=ready();character(s,'A','獣使いのウパニシャット');character(s,'B','魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:50};const griffin=handCard(s,'A','グリフォン');
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:griffin,targetIds:['B'],dedicated:true}),'normal-defense');
 s=checked(s,GAINAS,[6,6]);s=closeWindow(s);s=pass(s);
 expect(viewFor(s,'B').currentAttack!.hitIndex).toBe(1);
 s=checked(s,GAINAS);s=closeWindow(s);s=finish(s);
 expect(s.rolls!.filter(r=>r.purpose==='ability-check')).toHaveLength(2);
 expect([s.players.A!.damage,s.players.B!.damage]).toEqual([8,8]);
});

it.each([1,2])('actual transformed shield compares incoming five plus %s to warrior six',addition=>{
 let s=transformedIncoming('a2-p14-r1c1',addition);expect(viewFor(s,'A').self.stats.warrior_level).toBe(6);
 expect(viewFor(s,'A').currentAttack!.technique.effectLevel).toBe(5+addition);
 s=closeWindow(use(s,SHIELD,'A'));s=closeWindow(s,[1,1]);expect(viewFor(s,'A').currentRoll!.success).toBe(true);s=closeWindow(s);
 if(addition===2)expect(group(s).targets[0]!.hits[0]!.defended).toBe(false);
 s=finish(s);expect(s.players.A!.damage).toBe(addition===1?0:12);
});
