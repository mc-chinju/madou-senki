import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {gameStats,transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,closeWindow,finish,pass,ready,until} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
import {completeArmyProfile,armyBottomFor} from '../src/effects/all-army.js';
const ARMY='a2-p05-r2c2';
function prepared(follower='a2-p20-r3c1'){const s=ready();for(const p of Object.values(s.players))p.permanent={endurance:100};handCard(s,'A',getAction(ARMY)!.name);handCard(s,'A',getAction(follower)!.name);return {s,command:{type:'PLAY_ALL_ARMY',cardInstanceId:ARMY,followerCardInstanceId:follower,targetIds:['B']}};}
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s);expect(transition(s,{actorId,command} as any,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
it('actual Griffon pays both cards, declares parent then follower, checks morale and resolves two ordinary hits',()=>{
 let {s,command}=prepared();const before=s.players.A!.hand.length,deck=[...s.deck];s=act(s,'A',command);expect(s.players.A!.hand).toHaveLength(before-2);expect(s.resolution).toEqual(expect.arrayContaining([ARMY,command.followerCardInstanceId]));expect(s.deck).toEqual(deck);expect(viewFor(s,'A').currentAction).toMatchObject({cardInstanceId:ARMY});
 s=closeWindow(s);expect(viewFor(s,'A').currentAction).toMatchObject({cardInstanceId:command.followerCardInstanceId});s=closeWindow(s);expect(s.rolls!.at(-1)!.purpose).toBe('follower-morale');s=closeWindow(s,[1,1]);expect(s.rolls!.at(-1)!.threshold).toBe(gameStats(s,'A').spirit);s=finish(s);expect(s.players.B!.damage).toBe(16);expect(discardIds(s)).toEqual(expect.arrayContaining([ARMY,command.followerCardInstanceId]));expect(s.phase).toBe('withdrawal');expect(Object.keys(s.actions!)).toEqual([]);
});
it.each(['parent','follower','morale'])('Fate at %s cancels only its accepted declaration/check and consumes both cards without an attack',stage=>{
 let {s,command}=prepared();const fate=handCard(s,'B','命運凶変');s=act(s,'A',command);if(stage!=='parent')s=closeWindow(s);if(stage==='morale')s=closeWindow(s);s=pass(s);
 s=act(s,'B',stage==='morale'?{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:viewFor(s,'B').reactionTargetRollId!}:{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:viewFor(s,'B').reactionTargetActionId!});s=finish(s);expect(s.players.B!.damage).toBe(0);expect(discardIds(s)).toEqual(expect.arrayContaining([ARMY,command.followerCardInstanceId]));expect(s.players.A!.hand).not.toContain(command.followerCardInstanceId);expect(s.phase).toBe('withdrawal');expect(s.reclaimDecisions!.filter(d=>d.cardInstanceId===command.followerCardInstanceId).every(d=>d.source.kind==='ordinary-disposition'&&d.source.trigger==='named-card-used')).toBe(true);
});
it('failed morale cannot reselect, preserves a frozen result and creates no follower-death recovery',()=>{
 let {s,command}=prepared();s.players.A!.permanent={endurance:100,spirit:-20};s=closeWindow(closeWindow(act(s,'A',command)));s=closeWindow(s,[1,1]);expect(s.rolls!.at(-1)!.success).toBe(false);const roll=structuredClone(s.rolls!.at(-1)!);s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.rolls!.find(r=>r.id===roll.id)!.threshold).toBe(0);reject(s,'A',command);expect(discardIds(s).filter(id=>id===ARMY)).toHaveLength(1);
});
it('real approach allows a non-morale Wood Golem bottom and it never becomes a placed follower',()=>{
 let {s,command}=prepared('a2-p19-r2c3');reject(s,'A',command);const advance=handCard(s,'A','踏み込み／弓');s=finish(act(s,'A',{type:'APPROACH',cardInstanceId:advance,targetId:'B'}));s=finish(act(s,'A',command));expect(s.players.B!.damage).toBe(5);expect(s.players.A!.followers).toEqual([]);expect(s.rolls?.filter(r=>r.purpose==='follower-morale')??[]).toEqual([]);
});
it('rejects placed/foreign/nonfollower sources, duplicate follower inputs and invalid targets before payment',()=>{
 const {s,command}=prepared();reject(s,'A',{...command,followerCardInstanceId:ARMY});reject(s,'A',{...command,followerCardInstanceIds:[command.followerCardInstanceId]});reject(s,'A',{...command,targetIds:['A']});reject(s,'B',command);
 const placed=structuredClone(s);placed.players.A!.hand=placed.players.A!.hand.filter(id=>id!==command.followerCardInstanceId);placed.players.A!.followers.push({cardInstanceId:command.followerCardInstanceId,revealed:false});reject(placed,'A',command);
 const foreign=structuredClone(s);foreign.players.A!.hand=foreign.players.A!.hand.filter(id=>id!==command.followerCardInstanceId);foreign.players.B!.hand.push(command.followerCardInstanceId);reject(foreign,'A',command);
});
it('declining All Army leaves both source cards and the ordinary action unchanged until explicit pass',()=>{let {s,command}=prepared();const before=[...s.players.A!.hand];expect(viewFor(s,'A').allArmyOptions.some(o=>o.followerCardInstanceId===command.followerCardInstanceId)).toBe(true);s=act(s,'A',{type:'PASS_ACTION'});expect(s.players.A!.hand).toEqual(before);expect(s.resolution).toEqual([]);});
it('Upa using All Army still rolls the printed Griffon morale and gains no dedicated permission',()=>{let {s,command}=prepared();character(s,'A','獣使いのウパニシャット');s=closeWindow(closeWindow(act(s,'A',command)));expect(s.rolls!.at(-1)!.purpose).toBe('follower-morale');expect(s.rolls!.at(-1)!.modifier).toBe(0);});
it('an incomplete bottom cannot acquire inferred distance, school, level or damage',()=>{
 const complete=getAction('a2-p20-r3c1')!.stats!.attack as Record<string,unknown>;expect(completeArmyProfile(complete)).toBe(true);
 for(const missing of ['attributes','level','damage','additional']){const invalid={...complete};delete invalid[missing];expect(completeArmyProfile(invalid)).toBe(false);}
 for(const attributes of [['遠','格'],['戦','格'],['近','遠','戦'],['遠','戦','魔']])expect(completeArmyProfile({...complete,attributes})).toBe(false);
 for(const value of [null,NaN,'unknown']){expect(completeArmyProfile({...complete,level:value})).toBe(false);expect(completeArmyProfile({...complete,damage:value})).toBe(false);}
 expect(armyBottomFor('a2-p21-r1c1')!.followerIgnore).toBe(true);expect(armyBottomFor('a2-p22-r3c2')!.maaiRequired).toBe(2);expect(armyBottomFor('a2-p22-r3c3')!.maaiProhibited).toBe(true);
});
it('Fairy bottom freezes its actual random use level before generating ordinary excess-level checks',()=>{
 let {s,command}=prepared('a2-p21-r3c3');s.players.A!.permanent={endurance:100,spirit:20};s=closeWindow(closeWindow(act(s,'A',command)));s=closeWindow(s,[1,1]);s=closeWindow(s,[6]);expect(s.rolls!.at(-1)!.purpose).toBe('technique-value');s=closeWindow(s);expect(s.rolls!.at(-1)!.purpose).toBe('excess-level');expect(Object.values(s.actions!).find(a=>a.allArmyParentId)!.technique.useLevel).toBe(9);s=finish(s);expect(s.players.B!.damage).toBe(5);
});
it('All Army applies ordinary black/white restrictions and silence before either source is paid',()=>{
 let {s,command}=prepared('a2-p21-r3c1');character(s,'A','妖精王フューリー');reject(s,'A',command);
 ({s,command}=prepared('a2-p20-r1c3'));character(s,'A','不死王ガドューラ');s.distances.A!.B='near';s.distances.B!.A='near';reject(s,'A',command);
 ({s,command}=prepared('a2-p22-r2c3'));s.players.A!.statuses=[{id:'prior-silence',kind:'silenced',modifiers:[0],nextCheck:0}];reject(s,'A',command);
});
it('the dependent follower cannot be targeted by a named anytime card until its parent grants the attack',()=>{
 let {s,command}=prepared();handCard(s,'B','人質');s=act(s,'A',command);s=pass(s);expect(viewFor(s,'B').anytimeCardOptions.some(o=>o.cardInstanceId==='a2-p02-r2c2')).toBe(false);s=closeWindow(s);s=pass(s);expect(viewFor(s,'B').anytimeCardOptions.some(o=>o.cardInstanceId==='a2-p02-r2c2')).toBe(true);
});
it('the printed Earth Dragon all-target requirement cannot be reduced and reaches every legal target',()=>{
 let {s,command}=prepared('a2-p22-r2c3');character(s,'C','忍びのイダ');character(s,'D','獣使いのウパニシャット');s.players.A!.permanent={endurance:100,spirit:20};const option=viewFor(s,'A').allArmyOptions.find(o=>o.followerCardInstanceId===command.followerCardInstanceId)!;expect(option.targetMode).toBe('mandatory-all');reject(s,'A',command);s=finish(act(s,'A',{...command,targetIds:option.legalTargetIds}));for(const id of option.legalTargetIds)expect(s.players[id]!.damage).toBe(8);
});
it('an actual returned counter resumes the second Griffon hit and completes the same parent once',()=>{
 let {s,command}=prepared();character(s,'B','早駆けのランカスター');const counter=handCard(s,'B','閃光槍');s=until(act(s,'A',command),'normal-defense');s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:true}));expect(s.players.A!.damage).toBe(7);expect(s.players.B!.damage).toBe(8);expect(Object.keys(s.actions!)).toEqual([]);expect(discardIds(s).filter(id=>id===ARMY)).toHaveLength(1);
});
it('a prior real Peace binds to All Army and expires after its morale and entire attack',()=>{
 let s=ready();for(const p of Object.values(s.players))p.permanent={endurance:100};handCard(s,'A',getAction('a2-p02-r1c1')!.name);handCard(s,'B',getAction(ARMY)!.name);handCard(s,'B','グリフォン');const option=viewFor(s,'A').anytimeCardOptions.find(o=>o.cardInstanceId==='a2-p02-r1c1'&&o.targetId==='B')!,base=gameStats(s,'B').spirit;s=finish(act(s,'A',{type:'PLAY_ANYTIME_CARD',cardInstanceId:'a2-p02-r1c1',targetId:'B',targetEventId:option.targetEventId}));s=act(s,'A',{type:'PASS_ACTION'});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(gameStats(s,'A').handLimit)});s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});s=act(s,'B',{type:'PLAY_ALL_ARMY',cardInstanceId:ARMY,followerCardInstanceId:'a2-p20-r3c1',targetIds:['A']});expect(viewFor(s,'A').peaceExpiries).toEqual([{targetId:'B',timing:'current-action'}]);s=finish(s);expect(s.rolls!.find(r=>r.purpose==='follower-morale')!.threshold).toBe(12);expect(gameStats(s,'B').spirit).toBe(base);expect(viewFor(s,'A').peaceExpiries).toEqual([]);
});
