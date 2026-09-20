import {passReclaims} from './combat-helpers.js';
import {actionCards} from '@madou/catalog';
import {describe,it,expect} from 'vitest';
import {transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,ready,until,pass,finish,closeWindow} from './combat-helpers.js';
import {character,handCard,handCards,entropy} from './fixtures.js';
const WIND='c2-p02-r2c1-ab01',BOW='c2-p03-r2c2-ab03';
function priority(s:GameState,actor='A'){for(let n=0;n<30;n++){const w=s.windows!.at(-1)!;if(w.participants[w.cursor]===actor)return s;s=pass(s);}throw Error('PRIORITY');}
function attack(id=WIND,cardName=id===WIND?'黒翼飛翔剣':'黒流弓',targets=['B'],dedicated=false){let s=ready();character(s,'A',id===WIND?'早駆けのランカスター':'黒妖精のアーネス');for(const p of Object.values(s.players))p.permanent={endurance:50,spirit:10};s.distances.A!.B=s.distances.B!.A='near';const card=handCard(s,'A',cardName);return act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:targets,dedicated});}
function boundary(s:GameState,id:string){return priority(until(s,id===WIND?'attack-abilities':'effect-level'));}
function use(s:GameState,id:string,actor='A'){s=priority(s,actor);const o=viewFor(s,actor).abilityOptions.find(o=>o.abilityId===id);expect(o).toBeDefined();expect(o).not.toHaveProperty('costCardInstanceIds');expect(o).not.toHaveProperty('effectOptions');return act(s,actor,{type:'USE_ABILITY',abilityId:id,targetEventId:o!.targetEventId});}
function reject(s:GameState,actorId:string,command:unknown,code='ABILITY_DISABLED'){const before=JSON.stringify(s);expect(transition(s,{actorId,command} as any,entropy())).toEqual({ok:false,code});expect(JSON.stringify(s)).toBe(before);}
function main(s:GameState){return Object.values(s.actions!).find(a=>a.kind==='attack')!;}
function maais(s:GameState,owner:string,count:number){const ids=s.deck.filter(id=>actionCards.find(c=>c.id===id)?.modes?.some(m=>m.playMode==='distance')).slice(0,count);expect(ids).toHaveLength(count);s.deck=s.deck.filter(id=>!ids.includes(id));s.players[owner]!.hand.push(...ids);return ids;}
function selected(id=WIND,card?:string,targets=['B'],dedicated=false){let s=boundary(attack(id,card,targets,dedicated),id);s=use(s,id);return closeWindow(s);}

describe('Task7q real canonical attack property packages',()=>{
 it('Lancaster Wind is not offered for an actual magic attack',()=>{
  const s=boundary(attack(WIND,'風矢'),WIND);
  expect(main(s).technique.school).toBe('magic');
  expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===WIND)).toBe(false);
 });
 it.each([WIND,BOW])('select/decline/cancel/spent/late %s are explicit, private and atomic',id=>{
  for(const choice of ['select','decline','cancel']){
   let s=boundary(attack(id),id);const event=viewFor(s,'A').abilityOptions.find(o=>o.abilityId===id)!.targetEventId;
   for(const viewer of ['B','C','D']){const wire=JSON.stringify(viewFor(s,viewer));expect(wire).not.toContain(id);expect(wire).not.toContain(id===WIND?'瞬風':'黒弓');}
   reject(s,'B',{type:'USE_ABILITY',abilityId:id,targetEventId:event});reject(s,'A',{type:'USE_ABILITY',abilityId:id,targetEventId:'wrong'},'INVALID_TARGET');
   reject(s,'A',{type:'USE_ABILITY',abilityId:id,targetEventId:event,abilityEffectIds:['spirit-conversion']},'INVALID_COMMAND');
   if(choice!=='decline'){
    const fate=choice==='cancel'?handCard(s,'B','命運凶変'):null;s=use(s,id);
    for(const viewer of ['B','C','D'])expect(JSON.stringify(viewFor(s,viewer))).not.toContain(id);
    if(fate){s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(s,'B').reactionTargetAbilityId!});s=closeWindow(s);}
    s=closeWindow(s);s=priority(s);reject(s,'A',{type:'USE_ABILITY',abilityId:id,targetEventId:event});
   }
   s=until(s,'normal-defense');reject(s,'A',{type:'USE_ABILITY',abilityId:id,targetEventId:event});
   if(id===BOW){expect(viewFor(s,'B').currentAttack).toMatchObject({technique:{effectLevel:choice==='select'?6:5,damage:choice==='select'?12:10},defenseRestrictions:{evadeProhibited:choice==='select'}});const evade=handCard(s,'B','見切る');if(choice==='select')reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false},'ILLEGAL_DEFENSE');else{s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false});s=finish(s);expect(s.players.B!.damage).toBe(0);}}
   else expect(viewFor(s,'B').maaiDefense!.targets[0]!.required).toBe(choice==='select'?3:2);
  }
 });
 it('actual BlackWing native two plus Wind needs third; shared advance preserves paid progress/reload',()=>{
  let s=until(selected(),'normal-defense');const cards=maais(s,'B',4),advance=handCard(s,'A','踏み込み／蹴る');const distances=structuredClone(s.distances);
  const check=(carried:number,submitted:number,effective:number,remaining:number,sharedAdvances=0)=>{const v=viewFor(s,'A').maaiDefense!;expect(v).toMatchObject({sharedAdvances,targets:[{actorId:'B',required:3,carried,submitted,effective,remaining}]});expect(v).toEqual(viewFor(JSON.parse(JSON.stringify(s)),'C').maaiDefense);};
  check(0,0,0,3);s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:cards[0]}));check(0,1,1,2);s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:cards[1]}));check(0,2,2,1);expect(s.windows!.at(-1)!.kind).toBe('normal-defense');s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:cards[2]}));check(0,3,3,0);expect(s.windows!.at(-1)!.kind).toBe('defense-advance');s=passReclaims(act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advance}));check(0,3,2,1,1);s=pass(s);check(2,0,2,1);s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:cards[3]}));check(2,1,3,0);s=pass(s);expect(viewFor(s,'B').maaiDefense).toBeNull();expect(s.players.B!.damage).toBe(0);expect(s.distances).toEqual(distances);for(const id of [...cards,advance])expect(discardIds(s).filter(c=>c===id)).toHaveLength(1);
 });
 it('actual Lancaster dedicated SkySpear shared advance affects B/C independently',()=>{
  let s=until(selected(WIND,'竜殺天空槍',['B','C'],true),'normal-defense');const b=maais(s,'B',3),c=maais(s,'C',3),advance=handCard(s,'A','踏み込み／蹴る');const distances=structuredClone(s.distances);
  expect(viewFor(s,'A').currentAttack!.technique).toMatchObject({effectLevel:7,damage:15});
  for(const [actor,cards] of [['B',b],['C',c]] as const)for(const card of cards.slice(0,2))s=passReclaims(act(s,actor,{type:'PLAY_MAAI',cardInstanceId:card}));
  s=passReclaims(act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advance}));expect(viewFor(s,'C').maaiDefense).toMatchObject({sharedAdvances:1,responding:true,targets:[{actorId:'B',required:2,submitted:2,effective:1,remaining:1},{actorId:'C',required:2,submitted:2,effective:1,remaining:1}]});s=pass(s);
  s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:b[2]}));s=passReclaims(act(s,'C',{type:'PLAY_MAAI',cardInstanceId:c[2]}));s=pass(s);expect([s.players.B!.damage,s.players.C!.damage]).toEqual([0,0]);expect(s.distances).toEqual(distances);expect(discardIds(s).filter(id=>id===advance)).toHaveLength(1);
 });
 it.each(['before-effect','before-damage','after-damage'])('helper source suppression at %s fixes Bow numeric parts independently',cutoff=>{
  let s=selected(BOW);if(cutoff!=='before-effect')s=until(s,'damage');if(cutoff==='after-damage')s=until(s,'normal-defense');s.players.A!.statuses=[{id:'helper-seal',kind:'ability-disabled',modifiers:[0],nextCheck:0}];s=until(s,'normal-defense');expect(viewFor(s,'B').currentAttack).toMatchObject({technique:{effectLevel:cutoff==='before-effect'?5:6,damage:cutoff==='after-damage'?12:10},defenseRestrictions:{evadeProhibited:false}});const evade=handCard(s,'B','見切る');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false});s=finish(s);expect(s.players.B!.damage).toBe(0);
 });
 it.each([[WIND,'黒流弓'],[BOW,'黒翼飛翔剣']] as const)('wrong property school/owner cannot offer %s on %s',(id,card)=>{
  let s=boundary(attack(id,card),id);if(id===WIND){character(s,'A','黒妖精のアーネス');}expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===id)).toBe(false);
 });
});
function place(s:GameState,actor:string,name:string){const id=handCard(s,actor,name);s.players[actor]!.hand=s.players[actor]!.hand.filter(c=>c!==id);s.players[actor]!.followers.push({cardInstanceId:id,revealed:false});return id;}
function shadowChild(s:GameState,actor:string,seal:string,parentId:string,nextTarget:string){
 s=use(s,'c2-p04-r2c2-ab01',actor);s=closeWindow(s);s=closeWindow(s,[1,1]);s=closeWindow(s);s=closeWindow(s,[6,6]);s=closeWindow(s);expect(s.windows!.at(-1)!.kind).toBe('ability-attack');s=act(s,actor,{type:'ATTACK',cardInstanceId:seal,targetIds:['A'],dedicated:false});
 for(let n=0;n<150;n++){const w=s.windows!.at(-1)!;if(w.kind==='normal-defense'&&w.continuation.id===parentId&&w.continuation.kind==='group'&&w.continuation.targetId===nextTarget)return s;const r=s.rolls?.at(-1);s=pass(s,w.kind==='before-roll'&&r?.purpose==='status-resistance'?[6,6]:Array(30).fill(1));}throw Error('SHADOW_RESUME');
}
it('actual Arnes dedicated BlackFlowBow → Ida Shadow → Confusion opens later evade with fixed 6/12',()=>{
 let s=selected(BOW,'黒流弓',['B','C'],true);character(s,'B','忍びのイダ');s.players.A!.permanent={endurance:50};const seal=handCard(s,'B','錯乱'),evade=handCard(s,'C','見切る');s=until(s,'normal-defense');expect(viewFor(s,'B').currentAttack!.defenseRestrictions.evadeProhibited).toBe(true);const g=Object.values(s.groups!)[0]!;
 s=shadowChild(s,'B',seal,g.id,'C');expect(s.players.A!.statuses).toEqual(expect.arrayContaining([expect.objectContaining({kind:'ability-disabled',sourceActorId:'B',sourceCardInstanceId:seal})]));expect(s.groups![g.id]!.targets[0]!.hits[0]!.defended).toBe(true);expect(viewFor(s,'C').currentAttack).toMatchObject({technique:{effectLevel:6,damage:12},defenseRestrictions:{evadeProhibited:false}});s=act(s,'C',{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false});s=finish(s);expect(s.players.C!.damage).toBe(0);expect(discardIds(s)).toContain(evade);
});
it('actual Lancaster SkySpear → Ida Shadow → Confusion removes live +1 for later target',()=>{
 let s=selected(WIND,'竜殺天空槍',['B','C'],true);character(s,'B','忍びのイダ');s.players.A!.permanent={endurance:50};const seal=handCard(s,'B','錯乱');s=until(s,'normal-defense');const g=Object.values(s.groups!)[0]!;expect(viewFor(s,'B').maaiDefense!.targets.map(t=>t.required)).toEqual([2,2]);s=shadowChild(s,'B',seal,g.id,'C');expect(viewFor(s,'C').maaiDefense!.targets.map(t=>t.required)).toEqual([1,1]);const [maai]=maais(s,'C',1);s=passReclaims(act(s,'C',{type:'PLAY_MAAI',cardInstanceId:maai}));s=pass(s);expect(s.players.C!.damage).toBe(0);expect(s.groups?.[g.id]).toBeUndefined();
});
it.each([WIND,BOW])('actual Royal Guard reflects selected %s property once and preserves original source after helper suppression',id=>{
 let s=selected(id,'踏み込み／弓');const card=main(s).cardInstanceId;character(s,'B',id===WIND?'早駆けのランカスター':'黒妖精のアーネス');const guard=place(s,'B','王立騎士団');s=until(s,'follower-start');for(let n=0;n<80&&Object.keys(s.groups!).length<2;n++)s=pass(s);const child=Object.values(s.groups!).find(g=>g.attackerId==='B')!;expect(child).toBeDefined();expect(s.actions![child.actionId]).toMatchObject({fixedReceivedEffect:true,cardInstanceId:guard,effectSourceCardInstanceId:card});expect(child.technique).toMatchObject(id===WIND?{effectLevel:3,maaiRequired:2}:{effectLevel:4,damage:6,evadeProhibited:true});
 for(const actor of ['A','B'])s.players[actor]!.statuses=[{id:'helper-after-copy',kind:'ability-disabled',modifiers:[0],nextCheck:0}];s=until(s,'normal-defense');expect(viewFor(s,'A').abilityOptions).toEqual([]);if(id===WIND){expect(viewFor(s,'A').maaiDefense!.targets[0]!.required).toBe(2);const cards=maais(s,'A',2);s=passReclaims(act(s,'A',{type:'PLAY_MAAI',cardInstanceId:cards[0]}));expect(s.windows!.at(-1)!.kind).toBe('normal-defense');s=passReclaims(act(s,'A',{type:'PLAY_MAAI',cardInstanceId:cards[1]}));s=pass(s);}else{const evade=handCard(s,'A','見切る');reject(s,'A',{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false},'ILLEGAL_DEFENSE');s=finish(s);expect(s.players.A!.damage).toBe(6);}s=finish(s);expect(s.players.B!.damage).toBe(0);
});
it('actual Lancaster legal counter return offers Wind only after a return exists',()=>{
 let s=ready();character(s,'B','早駆けのランカスター');s.distances.A!.B=s.distances.B!.A='near';const source=handCard(s,'A','踏み込み／弓'),counter=handCard(s,'B','妖撃破山剣');s=act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===WIND)).toBe(false);s=until(s,'attack-abilities');s=use(s,WIND,'B');s=until(s,'normal-defense');expect(viewFor(s,'A').maaiDefense).toMatchObject({attackerId:'B',targets:[{actorId:'A',required:2}]});s=finish(s);
});
it.each([WIND,BOW])('actual pure evade/parry cannot select %s; hidden hand does not affect public windows',id=>{
 for(const defenseName of ['見切る','受け流し']){let s=attack();character(s,'B',id===WIND?'早駆けのランカスター':'黒妖精のアーネス');const defense=handCard(s,'B',defenseName);s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:defense,dedicated:false});s=priority(until(s,'effect-level'),'B');expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===id)).toBe(false);s=finish(s);expect(s.players.B!.damage).toBe(0);}
 let s=boundary(attack(id),id);const empty=structuredClone(s);empty.deck.push(...empty.players.A!.hand);empty.players.A!.hand=[];expect(viewFor(s,'B').activeWindow).toEqual(viewFor(empty,'B').activeWindow);expect(viewFor(s,'A').abilityOptions).toEqual(viewFor(empty,'A').abilityOptions);
});
it('actual printed StarFlowBow no-evade and native maai survive disabled BlackBow',()=>{
 // Printed mandatory chant and use Lv7 are preserved; success rolls cover the two excess checks.
 let s=ready();character(s,'A','黒妖精のアーネス');const source=handCard(s,'A','星流弓');s.players.A!.hand=s.players.A!.hand.filter(c=>c!==source);s.players.A!.chants.push({cardInstanceId:source,revealed:false});s=act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B'],dedicated:false});s=boundary(s,BOW);s=use(s,BOW);s=closeWindow(s);s.players.A!.statuses=[{id:'helper-seal',kind:'ability-disabled',modifiers:[0],nextCheck:0}];s=until(s,'normal-defense');expect(viewFor(s,'B').currentAttack).toMatchObject({technique:{effectLevel:7,damage:10},defenseRestrictions:{evadeProhibited:true}});expect(viewFor(s,'B').maaiDefense!.targets[0]!.required).toBe(2);const evade=handCard(s,'B','見切る');reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false},'ILLEGAL_DEFENSE');
});
it('actual Arnes cannot use a prospective Bow package to bypass mandatory chant or invent counter declaration',()=>{
 let s=ready();character(s,'A','黒妖精のアーネス');const star=handCard(s,'A','星流弓');const before=JSON.stringify(s);const r=transition(s,{actorId:'A',command:{type:'ATTACK',cardInstanceId:star,targetIds:['B'],dedicated:false}},entropy());expect(r).toEqual({ok:false,code:'CHANT_REQUIRED'});expect(JSON.stringify(s)).toBe(before);
 s=attack();character(s,'B','黒妖精のアーネス');const bow=handCard(s,'B','黒流弓');s=until(s,'normal-defense');reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:bow,dedicated:false},'ILLEGAL_DEFENSE');
});
it('actual ordinary Heavenly Hundred Slash Wind resets submitted/carried progress for each hit',()=>{
 let s=ready();character(s,'A','早駆けのランカスター');const card=handCard(s,'A','天地百撃斬');s.players.A!.hand=s.players.A!.hand.filter(c=>c!==card);s.players.A!.chants.push({cardInstanceId:card,revealed:false});s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=until(s,'damage');s=closeWindow(s,[2]);s=until(s,'attack-abilities');s=use(s,WIND);s=until(s,'normal-defense');const cards=maais(s,'B',4);const g=Object.values(s.groups!)[0]!;
 for(let i=0;i<2;i++){expect(viewFor(s,'B').maaiDefense).toMatchObject({hitIndex:i,targets:[{hitIndex:i,carried:0,submitted:0,required:2,remaining:2}]});for(const card of cards.slice(i*2,i*2+2))s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:card}));s=pass(s);if(i===0)expect(s.groups![g.id]!.targets[0]!.hits.map(h=>h.defended)).toEqual([true,false]);}expect(s.players.B!.damage).toBe(0);expect(viewFor(s,'B').maaiDefense).toBeNull();
});
it('helper source suppression between partial maai submissions uses current native requirement without refund',()=>{
 let s=until(selected(),'normal-defense');const cards=maais(s,'B',2);s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:cards[0]}));s.players.A!.statuses=[{id:'helper-partial-seal',kind:'ability-disabled',modifiers:[0],nextCheck:0}];expect(viewFor(s,'B').maaiDefense!.targets[0]).toMatchObject({required:2,submitted:1,remaining:1});s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:cards[1]}));expect(s.windows!.at(-1)!.kind).toBe('defense-advance');s=pass(s);expect(s.players.B!.damage).toBe(0);for(const card of cards)expect(discardIds(s).filter(c=>c===card)).toHaveLength(1);
});
it('actual SkySpear completed maai for B survives C Shadow→Confusion while later D needs native one',()=>{
 let s=selected(WIND,'竜殺天空槍',['B','C','D'],true);character(s,'C','忍びのイダ');s.players.A!.permanent={endurance:50};const seal=handCard(s,'C','錯乱');s=until(s,'normal-defense');const g=Object.values(s.groups!)[0]!,cards=maais(s,'B',2);for(const card of cards)s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:card}));s=shadowChild(s,'C',seal,g.id,'D');expect(viewFor(s,'D').maaiDefense).toMatchObject({targetId:'D',targets:[{actorId:'B',required:1,submitted:2,effective:2,remaining:0},{actorId:'C',closed:true},{actorId:'D',required:1,remaining:1}]});const [d]=maais(s,'D',1);s=passReclaims(act(s,'D',{type:'PLAY_MAAI',cardInstanceId:d}));s=pass(s);expect([s.players.B!.damage,s.players.D!.damage]).toEqual([0,0]);for(const card of cards)expect(discardIds(s).filter(c=>c===card)).toHaveLength(1);
});
it.each([WIND,BOW])('accepted %s declaration revalidates before application on disabled, stopped, inactive, changed owner',id=>{
 for(const reason of ['ability-disabled','stopped','inactive','owner']){let s=boundary(attack(id),id);s=use(s,id);if(reason==='inactive')s.players.A!.presence='wandering';else if(reason==='owner')character(s,'A','黒騎士ガーウィン');else s.players.A!.statuses=[{id:'helper-declaration-change',kind:reason as 'ability-disabled'|'stopped',modifiers:[0],nextCheck:0}];s=closeWindow(s);if(reason==='inactive')s.players.A!.presence='active';s=until(s,'normal-defense');expect(viewFor(s,'B').maaiDefense!.targets[0]!.required).toBe(id===WIND?2:1);if(id===BOW)expect(viewFor(s,'B').currentAttack).toMatchObject({technique:{effectLevel:5,damage:10},defenseRestrictions:{evadeProhibited:false}});}
});
it('actual Vanmil transformation has neither Wind nor BlackBow inheritance',()=>{
 let s=ready();character(s,'A','邪祭ウーノス');handCard(s,'A','復活の儀式');s=act(s,'A',{type:'USE_REVIVAL_RITUAL'});s=finish(s);expect(s.players.A!.abilityCharacterIds).toEqual(['c2-p07-r1c2']);s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(5)});for(const actor of ['B','C','D']){s=act(s,actor,{type:'START_TURN'});s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});s=act(s,actor,{type:'PASS_ACTION'});s=act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.slice(5)});}s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});const card=handCard(s,'A','黒流弓');s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=until(s,'effect-level');expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===BOW)).toBe(false);s=until(s,'attack-abilities');expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===WIND)).toBe(false);s=finish(s);
});
