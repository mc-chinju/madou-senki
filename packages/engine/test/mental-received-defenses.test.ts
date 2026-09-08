import {readFileSync} from 'node:fs';
import {actionCards,characters} from '@madou/catalog';
import {describe,expect,it} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,ready,until,pass,finish,closeWindow} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';

const LESTER='c2-p03-r2c1-ab01',GAD='c2-p06-r1c1-ab01',DIA='c2-p06-r1c2-ab01';
const sources=[LESTER,GAD,DIA];
function incoming(ability=LESTER,card='a2-p18-r1c3',targets=['B','C']) {
 let s=ready();
 character(s,'A','黒妖精のアーネス');
 character(s,'B',characters.find(c=>c.id===ability.slice(0,-5))!.name);
 character(s,'C','大神官ジル');
 character(s,'D','黒騎士ガーウィン');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,magic_level:20,warrior_level:20};
 for(const id of ['B','C','D'])s.distances.A![id]=s.distances[id]!.A='near';
 const cardInstanceId=handCard(s,'A',actionCards.find(c=>c.id===card)!.name);
 s=act(s,'A',{type:'ATTACK',cardInstanceId,targetIds:targets,dedicated:false});
 return until(s,'normal-defense');
}
function use(s:GameState,id=LESTER,actor='B') {
 const option=viewFor(s,actor).abilityOptions.find(o=>o.abilityId===id);
 expect(option).toBeDefined();
 expect(option).not.toHaveProperty('costCardInstanceIds');
 return act(s,actor,{type:'USE_ABILITY',abilityId:id,targetEventId:option!.targetEventId});
}
function rolled(s:GameState,id:string,faces:number[]) {
 s=closeWindow(use(s,id));
 expect(s.windows!.at(-1)!.kind).toBe('before-roll');
 return closeWindow(s,faces);
}
function result(s:GameState,id:string,faces:number[]) {return closeWindow(rolled(s,id,faces));}
function group(s:GameState){return Object.values(s.groups!)[0]!;}
function reject(s:GameState,actorId:string,command:unknown,code:string) {
 const before=JSON.stringify(s);
 expect(transition(s,{actorId,command} as any,entropy())).toEqual({ok:false,code});
 expect(JSON.stringify(s)).toBe(before);
}

describe('C03 complete mental received defenses',()=>{
 it('preserves the exact three adopted source records',()=>{
  const records=JSON.parse(readFileSync(new URL('./fixtures/mental-received-defense-sources.json',import.meta.url),'utf8'));
  for(const record of records)expect(characters.find(c=>c.id===record.characterId)!.abilities.find(a=>a.id===record.ability.id)).toMatchObject(record.ability);
 });
 it.each(sources)('%s ordinary success leaves every declared target hit intact',id=>{
  let s=incoming(id);s=result(s,id,[1,2]);
  expect(s.rolls!.at(-1)).toMatchObject({rollerId:'A',purpose:'ability-check',success:true,faces:[1,2],modifier:-1});
  expect(group(s).targets[0]!.hits[0]!.defended).toBe(false);
  s=finish(s);expect(s.players.B!.damage).toBeGreaterThan(0);expect(s.players.C!.damage).toBe(s.players.B!.damage);
 });
 it.each(sources)('%s ordinary failure cancels only own target without stop',id=>{
  let s=incoming(id);s.players.A!.permanent!.spirit=-20;s=result(s,id,[2,3]);
  expect(group(s).targets[0]!.hits[0]!.defended).toBe(true);
  expect(s.players.A!.statuses??[]).toEqual([]);
  s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBeGreaterThan(0);
 });
 it.each(sources)('%s successful doubles cancel and save separate attacker seat clock',id=>{
  let s=incoming(id);s=result(s,id,[2,2]);
  expect(s.rolls!.at(-1)!.success).toBe(true);
  expect(s.players.A!.statuses).toEqual([expect.objectContaining({kind:'stopped',timing:'next-own-seat',sourceActorId:'B',sourceAbilityId:id,expiresOnActorId:'A'})]);
  expect(s.players.A!.statuses![0]).not.toHaveProperty('sourceCardInstanceId');
  for(const viewer of s.seatOrder)expect(viewFor(s,viewer).players.A!.statuses).toEqual([{kind:'stopped',timing:'next-own-seat',expiresOnActorId:'A'}]);
  s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBeGreaterThan(0);
 });
 it.each([LESTER,DIA])('%s sixes replace exact private objective and protection',id=>{
  let s=incoming(id);s=result(s,id,[6,6]);
  const expected=id===LESTER?['EVIL']:['GOOD','ヴァンミール'];
  expect(s.players.A!.faction).toBe(s.players.B!.faction);
  expect(s.players.A!.currentObjective).toMatchObject({kind:'extinction',enemyFactions:expected});
  expect(viewFor(s,'A').self.objective).toBe(id===LESTER?'EVILの全滅':'ディアと敵対するものの全滅');
  expect(viewFor(s,'A').self).toMatchObject({currentObjective:{enemyFactions:expected},protection:{characterIds:[id===LESTER?'c2-p03-r1c2':'c2-p06-r1c2']},defeatCondition:id===LESTER?'リーア姫の死亡':'愛しいディアの死亡'});
  for(const viewer of ['B','C','D'])expect(viewFor(s,viewer).players.A).not.toHaveProperty('currentObjective');
 });
 it('Gadyoora sixes save irrevocable fatal intent until other target damage and G15 death gift',()=>{
  let s=incoming(GAD);s.players.A!.permanent!.spirit=0;s=result(s,GAD,[6,6]);
  expect(s.rolls!.at(-1)!.success).toBe(false);
  expect(s.players.A!.presence).toBe('active');
  expect(group(s).pendingFatalIntents).toEqual([expect.objectContaining({targetId:'A',sourceActorId:'B',instantDeath:true,cause:'instant-death'})]);
  expect(group(s).pendingFatalIntents![0]).not.toHaveProperty('sourceCardInstanceId');
  for(const viewer of s.seatOrder)expect(viewFor(s,viewer).players.A!.pendingFatal).toBe(true);
  expect(s.outcome).toBeUndefined();
  s=until(s,'death-gift');
  expect(s.players.A!.presence).toBe('pending-death');expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBeGreaterThan(0);
  expect(s.discard.filter(id=>id==='a2-p18-r1c3')).toHaveLength(1);
  expect(viewFor(s,'C').players.A!.pendingFatal).toBe(false);
  s=finish(s);
  expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')).toHaveLength(1);
  expect(s.events.find(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')!.death).toMatchObject({sourceActorId:'B',cause:'instant-death'});
  expect(s.events.find(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')!.death).not.toHaveProperty('sourceCardInstanceId');
 });
});

function priority(s:GameState,actor:string){while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!==actor)s=pass(s);return s;}
function turn(s:GameState,actor:string){
 s=act(s,actor,{type:'START_TURN'});s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});
 s=act(s,actor,{type:'PASS_ACTION'});return act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.slice(5)});
}
it.each([LESTER,DIA])('%s fixed-faction block retains old objective and protection but still stops',id=>{
 let s=incoming(id);character(s,'A',id===LESTER?'魔導王ガイナス':'侍大将のシン');
 const before=structuredClone(s.players.A!);
 s=result(s,id,[6,6]);
 expect(s.players.A!).toMatchObject({faction:before.faction,objective:before.objective,currentObjective:before.currentObjective,protection:before.protection});
 expect(s.players.A!.statuses![0]!.kind).toBe('stopped');
 expect(group(s).targets[0]!.hits[0]!.defended).toBe(true);
});
it('Lester same-faction allowed conversion still replaces the old protection',()=>{
 let s=incoming(LESTER);character(s,'A','大神官ジル');
 s.players.A!.protection={characterIds:['c2-p05-r2c2']}; // alternate pre-existing replacement, not a source activation
 s=result(s,LESTER,[6,6]);
 expect(s.players.A!.protection!.characterIds).toEqual(['c2-p03-r1c2']);
});
it('Dia snapshots enemy factions at conversion and does not follow later allegiance changes',()=>{
 let s=incoming(DIA);s=result(s,DIA,[6,6]);
 const saved=structuredClone(s.players.A!.currentObjective);
 s.players.B!.faction='ヴァンミール'; // explicit alternate later allegiance boundary
 s=finish(s);expect(s.players.A!.currentObjective).toEqual(saved);
 expect(s.players.A!.faction).toBe('EVIL');
});
it('actual Fate cancellation spends the entire Griffin target group; later group is fresh',()=>{
 let s=ready();character(s,'A','獣使いのウパニシャット');character(s,'B','吟遊詩人のレスター');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 const griffin=handCard(s,'A','グリフォン'),fate=handCard(s,'C','命運凶変');
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:griffin,targetIds:['B'],dedicated:true}),'normal-defense');
 const event=viewFor(s,'B').abilityOptions.find(o=>o.abilityId===LESTER)!.targetEventId;
 s=use(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(s,'C').reactionTargetAbilityId!});
 s=closeWindow(s);s=closeWindow(s);
 expect(s.rolls??[]).toEqual([]);
 reject(s,'B',{type:'USE_ABILITY',abilityId:LESTER,targetEventId:event},'ABILITY_DISABLED');
 s=pass(s);expect(viewFor(s,'B').currentAttack!.hitIndex).toBe(1);
 expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===LESTER)).toBe(false);
 s=finish(s);expect(s.players.B!.damage).toBe(16);
 s=act(s,'A',{type:'PASS_WITHDRAWAL'});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(5)});
 for(const id of ['B','C','D'])s=turn(s,id);
 s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});
 const sword=handCard(s,'A','白光');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:sword,targetIds:['B'],dedicated:false}),'normal-defense');
 expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===LESTER)).toBe(true);
 reject(s,'B',{type:'USE_ABILITY',abilityId:LESTER,targetEventId:event},'INVALID_TARGET');
});
it.each(['first','second'])('actual Griffin cancels only unprocessed own hits when selected on %s hit',when=>{
 let s=ready();character(s,'A','獣使いのウパニシャット');character(s,'B','吟遊詩人のレスター');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 const griffin=handCard(s,'A','グリフォン');
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:griffin,targetIds:['B'],dedicated:true}),'normal-defense');
 if(when==='second')s=pass(s);
 s=result(s,LESTER,[2,2]);s=finish(s);
 expect(s.players.B!.damage).toBe(when==='first'?0:8);
});
it.each([['active',false],['otherworld',false],['active',true]] as const)('attacker next-seat clock traverses %s / skipped %s without recovery', (presence,skip)=>{
 let s=finish(result(incoming(),LESTER,[2,2]));
 s=act(s,'A',{type:'PASS_WITHDRAWAL'});
 expect(s.turnSeat).toBe(1);expect(s.players.A!.statuses).toHaveLength(1);
 s=turn(s,'B');expect(s.players.A!.statuses).toHaveLength(1);
 s=turn(s,'C');
 if(presence==='otherworld')s.players.A!.presence='otherworld'; // alternate seat arrival branch
 if(skip)s.players.A!.skipTurns=1; // alternate skip-turn state
 s=turn(s,'D');
 expect(s.players.A!.statuses).toEqual([]);
 expect(s.rolls!.filter(r=>r.purpose==='status-recovery')).toEqual([]);
 if(skip){s=act(s,'A',{type:'START_TURN'});expect(s.turnSeat).toBe(1);}
 if(presence==='otherworld')expect(s.turnSeat).toBe(1);
});
it('actual force-failure persists across a reroll that removes doubles',()=>{
 let s=incoming();const fate=handCard(s,'C','命運凶変'),reroll=handCard(s,'D','神性介入');
 s=rolled(s,LESTER,[6,6]);const rollId=s.rolls!.at(-1)!.id;
 s=priority(s,'C');s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:rollId});
 s=closeWindow(s);s=priority(s,'D');
 s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:reroll,mode:'reroll',targetRollId:rollId});s=closeWindow(s,[1,2]);
 s=closeWindow(s);
 expect(s.rolls!.find(r=>r.id===rollId)).toMatchObject({faces:[1,2],success:false});
 expect(s.players.A!.statuses??[]).toEqual([]);expect(s.players.A!.faction).toBe('EVIL');
 s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBe(8);
});
it.each(['counter','mirror','majesty'])('actual %s returned attack cannot use mental defense',route=>{
 let s=incoming(LESTER,'a2-p12-r2c2',['B']);character(s,'A','吟遊詩人のレスター');
 if(route==='majesty'){
  character(s,'B','魔導王ガイナス');
  s=use(s,'c2-p05-r2c2-ab02');s=closeWindow(s);s=closeWindow(s,[1,2]);s=closeWindow(s);
 }else{
  const defense=handCard(s,'B',route==='counter'?actionCards.find(c=>c.id==='a2-p10-r3c3')!.name:'神王界');
  s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:defense,dedicated:false});
 }
 s=until(s,'normal-defense');
 expect(viewFor(s,'A').currentAttack!.attackerId).toBe('B');
 expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===LESTER)).toBe(false);
 s=finish(s);
});
it.each(['stopped','ability-disabled','inactive','ownership'])('helper %s before final roll apply cancels all uncommitted clauses',change=>{
 let s=rolled(incoming(GAD),GAD,[6,6]);
 if(change==='inactive')s.players.B!.presence='otherworld';
 else if(change==='ownership')character(s,'B','小人のランバ');
 else s.players.B!.statuses=[{id:'helper-disable',kind:change as 'stopped'|'ability-disabled',modifiers:[0],nextCheck:0}];
 s=closeWindow(s);
 expect(s.players.A!.statuses??[]).toEqual([]);
 expect(group(s).pendingFatalIntents).toBeUndefined();
 expect(group(s).targets[0]!.hits[0]!.defended).toBe(false);
});
it('helper later suppression cannot revoke committed fatal intent or own-target cancellation',()=>{
 let s=result(incoming(GAD),GAD,[6,6]);
 s.players.B!.statuses=[{id:'helper-disable',kind:'ability-disabled',modifiers:[0],nextCheck:0}];
 s=until(s,'death-gift');expect(s.players.A!.presence).toBe('pending-death');expect(s.players.C!.damage).toBe(8);
 s=finish(s);expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')).toHaveLength(1);
});
it('hidden source identity stays private through attacker roll and committed stop',()=>{
 let s=rolled(incoming(),LESTER,[2,2]);
 for(const actor of ['A','C','D']){
  const view=viewFor(s,actor),wire=JSON.stringify(view);
  expect(wire).not.toContain(LESTER);expect(wire).not.toContain('吟遊詩人のレスター');
  expect(view.currentRoll!.faces).toEqual([2,2]);
  if(actor!=='A')expect(view.currentRoll).not.toHaveProperty('success');
 }
 s=closeWindow(s);
 for(const actor of ['A','C','D']){
  const wire=JSON.stringify(viewFor(s,actor));
  expect(wire).not.toContain(LESTER);expect(wire).not.toContain('sourceAbilityId');expect(wire).not.toContain('mentalDefenseAttempts');
 }
});
it('declaration validates stale binding and rejects forged costs atomically',()=>{
 const s=incoming(),event=viewFor(s,'B').abilityOptions.find(o=>o.abilityId===LESTER)!.targetEventId;
 reject(s,'B',{type:'USE_ABILITY',abilityId:LESTER,targetEventId:'stale'},'INVALID_TARGET');
 reject(s,'B',{type:'USE_ABILITY',abilityId:LESTER,targetEventId:event,costCardInstanceId:s.players.B!.hand[0]},'INVALID_COMMAND');
 reject(s,'C',{type:'USE_ABILITY',abilityId:LESTER,targetEventId:event},'ABILITY_DISABLED');
});
it('helper fatal source cannot accept outstanding optional technique choices while declared damage continues',()=>{
 let s=incoming(GAD);const g=group(s);
 // Independent optional source branches with no canonical EarthRift combination.
 g.technique.postHitAdvances=true;g.technique.optionalFollowerBypassAtOrBelowEffectLevel=true;
 g.technique.lifetimeHit={kind:'instant-death',modifier:0,optional:true};
 const soldier=handCard(s,'C','兵士');s.players.C!.hand=s.players.C!.hand.filter(id=>id!==soldier);s.players.C!.followers.push({cardInstanceId:soldier,revealed:false});
 s=result(s,GAD,[6,6]);
 for(let n=0;n<150&&s.windows?.at(-1)?.kind!=='death-gift';n++){
  expect(['hit-advance-choice','follower-bypass-choice','lifetime-effect-choice']).not.toContain(s.windows!.at(-1)!.kind);
  expect(viewFor(s,'A').abilityOptions).toEqual([]);s=pass(s);
 }
 expect(s.windows!.at(-1)!.kind).toBe('death-gift');
 expect(s.players.C!.presence).toBe('active');expect(s.players.C!.damage).toBe(7);
});
it('Gadyoora fatal batch allows actual death gift once before disposal',()=>{
 let s=incoming(GAD);const gift=handCard(s,'A','「これで勝ったと思うなよ」'),card=handCard(s,'A','香具羅');
 s=result(s,GAD,[6,6]);s=until(s,'death-gift');
 s=act(s,'A',{type:'PLAY_DEATH_GIFT',cardInstanceId:gift,giftCardInstanceId:card,targetId:'D'});
 s=closeWindow(s);expect(s.players.D!.hand).toContain(card);
 s=finish(s);expect(s.discard.filter(id=>id===gift)).toHaveLength(1);expect(s.discard).not.toContain(card);
 expect(s.discard.filter(id=>id==='a2-p18-r1c3')).toHaveLength(1);
});
it('Gadyoora actual fatal disposal followed by Fusen revival restores saved identity once',()=>{
 let s=incoming(GAD);
 s=result(s,GAD,[6,6]);s=until(s,'death-gift');s=finish(s);
 const identity=structuredClone(s.players.A!.deathIdentity!);
 expect(s.players.A!.presence).toBe('dead');expect(s.turnSeat).toBe(1);
 // Arrange the actual open card as the next draw after all source commands.
 const fusen=handCard(s,'B',actionCards.find(c=>c.id==='a2-p01-r1c1')!.name);
 s.players.B!.hand=s.players.B!.hand.filter(id=>id!==fusen);s.deck.unshift(fusen);
 s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:true});
 s=until(s,'before-roll');s=closeWindow(s,[1]);s=closeWindow(s);
 expect(s.windows!.at(-1)!.kind).toBe('revival');
 s=act(s,'A',{type:'CHOOSE_REVIVAL',revive:true});
 while(s.windows?.at(-1)?.kind==='re-setup')s=act(s,s.windows.at(-1)!.participants[0]!,{type:'PASS_SETUP'});
 s=finish(s);expect(s.players.A!.presence).toBe('active');expect(s.players.A!.statuses).toEqual([]);
 expect(s.players.A!).toMatchObject(identity);
 expect(s.events.filter(e=>e.type==='PLAYER_REVIVED'&&e.actorId==='A')).toHaveLength(1);
 expect(s.discard.filter(id=>id==='a2-p18-r1c3')).toHaveLength(1);
});
it('helper Lester EVIL allegiance still stores the explicit EVIL extinction objective',()=>{
 let s=incoming();s.players.B!.faction='EVIL';s=result(s,LESTER,[6,6]);
 expect(s.players.A!).toMatchObject({faction:'EVIL',objective:'EVILの全滅',currentObjective:{enemyFactions:['EVIL']}});
 s=finish(s);expect(s.outcome).toBeUndefined();
});
it('helper dead attacker seat expires the stop independently of defender and other stops',()=>{
 let s=finish(result(incoming(),LESTER,[2,2]));s=act(s,'A',{type:'PASS_WITHDRAWAL'});
 s.players.A!.presence='dead';
 s.players.A!.statuses!.push({id:'other-period',kind:'stopped',timing:'fixed-turns',remainingTurns:2});
 for(const id of ['B','C','D'])s=turn(s,id);
 expect(s.players.A!.statuses).toEqual([{id:'other-period',kind:'stopped',timing:'fixed-turns',remainingTurns:2}]);
 expect(s.turnSeat).toBe(1);
});
it('actual printed-counter-capable ordinary attack still offers all three mental packages',()=>{
 for(const id of sources){const s=incoming(id,'a2-p10-r3c3',['B']);expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===id)).toBe(true);}
});
it('actual physical Royal Guard reflection cannot trigger mental defense',()=>{
 let s=incoming(LESTER,'a2-p09-r1c2',['B']);character(s,'A','吟遊詩人のレスター');
 const royal=handCard(s,'B','王立騎士団');s.players.B!.hand=s.players.B!.hand.filter(id=>id!==royal);s.players.B!.followers.push({cardInstanceId:royal,revealed:false});
 s=pass(s);
 for(let n=0;n<100&&!(s.windows?.at(-1)?.kind==='normal-defense'&&viewFor(s,'A').currentAttack!.attackerId==='B');n++)s=pass(s);
 expect(viewFor(s,'A').currentAttack!.attackerId).toBe('B');expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===LESTER)).toBe(false);
 s=finish(s);
});
it('actual Dia replacement survives old Gainas death; Dia death causes wandering and Fusen revival returns the new identity',async()=>{
 const {createGame,derivedStats}=await import('../src/index.js');
 let s=createGame(['A','B','C','D','E','F'].map(id=>({id,name:id})),entropy(),{startingSeat:0});
 for(const id of s.seatOrder)s=act(s,id,{type:'PASS_SETUP'});
 for(const [id,name] of [['A','黒妖精のアーネス'],['B','魔聖母ディア'],['C','魔導王ガイナス'],['D','侍大将のシン'],['E','黒騎士ガーウィン'],['F','吟遊詩人のレスター']])character(s,id!,name!);
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,magic_level:20};
 // Alternate pre-existing E protection replacement keeps an opposing survivor
 // during this lifecycle probe; no ability acquisition is attributed to it.
 s.players.E!.protection={characterIds:['c2-p03-r1c2']};
 s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});
 const earth=handCard(s,'A',actionCards.find(c=>c.id==='a2-p18-r1c3')!.name);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:earth,targetIds:['B','D'],dedicated:false}),'normal-defense');
 s=finish(result(s,DIA,[6,6]));const converted=structuredClone(s.players.A!.currentObjective);
 s=act(s,'A',{type:'PASS_WITHDRAWAL'});
 s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});
 s.players.C!.damage=derivedStats(s.players.C!).endurance-1;
 const first=handCard(s,'B','白光');s=finish(act(s,'B',{type:'ATTACK',cardInstanceId:first,targetIds:['C'],dedicated:false}));
 expect(s.players.C!.presence).toBe('dead');expect(s.players.A!.presence).toBe('active');
 s=act(s,'B',{type:'PASS_WITHDRAWAL'});s=act(s,'B',{type:'END_TURN',discardIds:s.players.B!.hand.slice(5)});
 expect(s.turnSeat).toBe(3);
 s=act(s,'D',{type:'START_TURN'});s=act(s,'D',{type:'CHOOSE_DRAW',draw:false});
 s.players.B!.damage=derivedStats(s.players.B!).endurance-1;
 const second=handCard(s,'D',actionCards.find(c=>c.id==='a2-p12-r2c2')!.name);
 s=finish(act(s,'D',{type:'ATTACK',cardInstanceId:second,targetIds:['B'],dedicated:false}));
 expect(s.players.B!.presence).toBe('dead');expect(s.players.A!.presence).toBe('wandering');expect(s.outcome).toBeUndefined();
 s=act(s,'D',{type:'PASS_WITHDRAWAL'});
 const fusen=handCard(s,'D',actionCards.find(c=>c.id==='a2-p01-r1c1')!.name);
 s.players.D!.hand=s.players.D!.hand.filter(id=>id!==fusen);
 while(s.players.D!.hand.length>4)s.deck.push(s.players.D!.hand.pop()!);
 s.deck.unshift(fusen);
 s=act(s,'D',{type:'END_TURN',discardIds:[]});
 for(let n=0;n<100&&!(s.windows?.at(-1)?.kind==='revival'&&s.windows.at(-1)!.participants[0]==='B');n++)s=pass(s);
 s=act(s,'B',{type:'CHOOSE_REVIVAL',revive:true});
 for(let n=0;n<150&&s.windows?.length;n++){
  const w=s.windows.at(-1)!;
  s=w.kind==='re-setup'?act(s,w.participants[0]!,{type:'PASS_SETUP'}):pass(s);
 }
 expect(s.players.A!.presence).toBe('active');expect(s.players.A!.currentObjective).toEqual(converted);
 expect(s.players.A!.protection).toMatchObject({characterIds:['c2-p06-r1c2']});
 expect(viewFor(s,'A').self.defeatCondition).toBe('愛しいディアの死亡');
 expect(s.players.C!.presence).toBe('dead');
});
it.each([LESTER,DIA])('%s actual converted attacker death and revival retain the replacement identity',async id=>{
 const {derivedStats}=await import('../src/index.js');
 let s=finish(result(incoming(id),id,[6,6]));
 const replacement={faction:s.players.A!.faction,objective:s.players.A!.objective,currentObjective:structuredClone(s.players.A!.currentObjective),protection:structuredClone(s.players.A!.protection)};
 s=act(s,'A',{type:'PASS_WITHDRAWAL'});s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});
 s.players.A!.damage=derivedStats(s.players.A!).endurance-1;
 const card=handCard(s,'B','白光');s=finish(act(s,'B',{type:'ATTACK',cardInstanceId:card,targetIds:['A'],dedicated:false}));
 expect(s.players.A!.presence).toBe('dead');expect(s.players.A!.deathIdentity).toMatchObject(replacement);
 s=act(s,'B',{type:'PASS_WITHDRAWAL'});s=act(s,'B',{type:'END_TURN',discardIds:s.players.B!.hand.slice(5)});
 const fusen=handCard(s,'C',actionCards.find(c=>c.id==='a2-p01-r1c1')!.name);
 s.players.C!.hand=s.players.C!.hand.filter(id=>id!==fusen);s.deck.unshift(fusen);
 s=act(s,'C',{type:'START_TURN'});s=act(s,'C',{type:'CHOOSE_DRAW',draw:true});
 s=until(s,'before-roll');s=closeWindow(s,[1]);s=closeWindow(s);s=act(s,'A',{type:'CHOOSE_REVIVAL',revive:true});
 while(s.windows?.at(-1)?.kind==='re-setup')s=act(s,s.windows.at(-1)!.participants[0]!,{type:'PASS_SETUP'});
 s=finish(s);expect(s.players.A!.presence).toBe('active');expect(s.players.A!).toMatchObject(replacement);
 expect(s.players.A!.protection!.characterIds).not.toContain('c2-p05-r2c2');
});
it('unselected mental package never applies when ordinary defense is declined',()=>{
 let s=incoming(GAD);s=finish(s);
 expect(s.players.A!.statuses??[]).toEqual([]);expect(s.players.A!.presence).toBe('active');
 expect((s.rolls??[]).filter(r=>r.purpose==='ability-check')).toEqual([]);expect(s.players.B!.damage).toBe(8);
});
it('actual reroll introduces sixes and commits the final saved faces once',()=>{
 let s=incoming(DIA);const reroll=handCard(s,'C','神性介入');s=rolled(s,DIA,[1,2]);
 const rollId=s.rolls!.at(-1)!.id;s=priority(s,'C');
 s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:reroll,mode:'reroll',targetRollId:rollId});
 s=closeWindow(s,[6,6]);s=closeWindow(s);
 expect(s.rolls!.find(r=>r.id===rollId)).toMatchObject({faces:[6,6],success:true});
 expect(s.players.A!.objective).toBe('ディアと敵対するものの全滅');
 expect(s.players.A!.statuses).toHaveLength(1);
 s=finish(s);expect(s.players.A!.statuses).toHaveLength(1);expect(s.discard.filter(id=>id===reroll)).toHaveLength(1);
});
it('helper unlabelled explicit objective still displays its actual enemy factions',async()=>{
 const {replaceAllegiance}=await import('../src/index.js');const s=incoming();
 expect(replaceAllegiance(s.players.A!,'EVIL',{kind:'extinction',enemyFactions:['EVIL']},{characterIds:[]})).toBe(true);
 expect(viewFor(s,'A').self.objective).toBe('EVILの全滅');
});

function dedicatedIdaWithChantedTarget() {
 let s=ready();
 character(s,'A','忍びのイダ');character(s,'B','不死王ガドューラ');
 character(s,'C','大神官ジル');character(s,'D','黒騎士ガーウィン');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 const shuriken=handCard(s,'A','手裏剣'),chant=handCard(s,'C',actionCards.find(c=>c.id==='a2-p14-r2c3')!.name);
 s.players.C!.hand=s.players.C!.hand.filter(id=>id!==chant);
 s.players.C!.chants.push({cardInstanceId:chant,revealed:false});
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:shuriken,targetIds:['B','C'],dedicated:true}),'normal-defense');
 return {s,shuriken,chant};
}
it('fix I1 actual Ida dedicated Shuriken retains C chant and damage before Gadyoora fatal settlement',()=>{
 let {s,shuriken,chant}=dedicatedIdaWithChantedTarget();
 expect(group(s).technique).toMatchObject({onHitDiscardChants:true,target:'all',damage:5});
 s=result(s,GAD,[6,6]);
 expect(viewFor(s,'A').players.A!.pendingFatal).toBe(true);
 for(let n=0;n<150&&s.windows?.at(-1)?.kind!=='death-gift';n++){
  expect(s.windows!.at(-1)!.kind).not.toBe('on-hit-choice');
  expect(viewFor(s,'A').legalChoices).not.toContain('DISCARD_HIT_CHANTS');
  s=pass(s);
 }
 expect(s.windows!.at(-1)!.kind).toBe('death-gift');
 expect(s.players.A!.presence).toBe('pending-death');
 expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBe(5);
 expect(s.players.C!.chants).toEqual([{cardInstanceId:chant,revealed:false}]);
 expect(s.discard.filter(id=>id===shuriken)).toHaveLength(1);
 reject(s,'A',{type:'DISCARD_HIT_CHANTS',discard:true},'INACTIVE_ACTOR');
 s=finish(s);
 expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')).toHaveLength(1);
 expect(s.players.C!.chants).toEqual([{cardInstanceId:chant,revealed:false}]);
 expect(s.discard.filter(id=>id===shuriken)).toHaveLength(1);
});
it('fix I1 leaves nonfatal stopped Ida on-hit choice semantics unchanged',()=>{
 let {s,chant}=dedicatedIdaWithChantedTarget();s=result(s,GAD,[2,2]);
 s=until(s,'on-hit-choice');
 expect(s.players.A!.statuses!.some(status=>status.kind==='stopped')).toBe(true);
 expect(viewFor(s,'A').players.A!.pendingFatal).toBe(false);
 expect(viewFor(s,'A').legalChoices).toContain('DISCARD_HIT_CHANTS');
 s=act(s,'A',{type:'DISCARD_HIT_CHANTS',discard:true});
 expect(s.players.C!.damage).toBe(5);expect(s.players.C!.chants).toEqual([]);
 expect(s.discard.filter(id=>id===chant)).toHaveLength(1);
});
it('fix I1 helper old saved on-hit window with fatal intent hides and atomically rejects discard',()=>{
 let {s,chant}=dedicatedIdaWithChantedTarget();s=until(s,'on-hit-choice');
 // Compatibility boundary: reproduce the old saved window with an already
 // committed fatal intent. The canonical new path above must never open it.
 const g=group(s);
 g.pendingFatalIntents=[{targetId:'A',damage:0,instantDeath:true,cause:'instant-death',sourceActorId:'B',groupId:g.id,actionId:g.actionId,eventId:g.actionId}];
 expect(viewFor(s,'A').legalChoices).not.toContain('DISCARD_HIT_CHANTS');
 reject(s,'A',{type:'DISCARD_HIT_CHANTS',discard:true},'STOPPED');
 s=pass(s);
 expect(s.windows!.at(-1)!.kind).toBe('death-gift');
 expect(s.players.C!.damage).toBe(5);
 expect(s.players.C!.chants).toEqual([{cardInstanceId:chant,revealed:false}]);
});
