import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {gameStats,transition,viewFor,type GameState} from '../src/index.js';
import {act,closeWindow,finish,pass,ready,until} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
const SPIRIT='a2-p05-r1c3',HARP='a2-p05-r2c1';
function prepared(spell='魔詩',components=[SPIRIT,HARP]){const s=ready();character(s,'A','大神官ジル');for(const p of Object.values(s.players))p.permanent={endurance:100};for(const id of components)handCard(s,'A',getAction(id)!.name);const card=handCard(s,'A',spell);return {s,command:{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false,combinationCardInstanceIds:components}};}
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s);expect(transition(s,{actorId,command} as any,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
it('two actual printed components are paid without refill and independently declared before the same mental attack',()=>{
 let {s,command}=prepared();const before=s.players.A!.hand.length,spirit=gameStats(s,'A').spirit,deck=[...s.deck];s=act(s,'A',command);expect(s.players.A!.hand).toHaveLength(before-3);expect(s.deck).toEqual(deck);expect(gameStats(s,'A').spirit).toBe(spirit+2);
 expect(s.resolution).toEqual(expect.arrayContaining([command.cardInstanceId,SPIRIT,HARP]));s=until(s,'attack-abilities');const g=Object.values(s.groups!)[0]!;expect(g.technique.effectLevel).toBe(7);expect(g.targets[0]!.hits[0]!.damage).toBe(9);s=finish(s);expect(s.players.B!.damage).toBe(9);expect(gameStats(s,'A').spirit).toBe(spirit+2);s=act(s,'A',{type:'PASS_WITHDRAWAL'});expect(gameStats(s,'A').spirit).toBe(spirit);
});
it.each([SPIRIT,HARP])('Fate cancels only printed component %s, keeps every paid source and resumes the parent once',cancel=>{
 let {s,command}=prepared();const spirit=gameStats(s,'A').spirit,fate=handCard(s,'B','命運凶変');s=act(s,'A',command);
 for(let n=0;n<100;n++){const w=s.windows!.at(-1)!,a=s.actions?.[w.continuation.id];if(a?.cardInstanceId===cancel&&w.kind==='declaration'&&w.participants[w.cursor]==='B')break;s=pass(s);}
 const child=viewFor(s,'B').reactionTargetActionId!;s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:child});s=until(s,'attack-abilities');const g=Object.values(s.groups!)[0]!;expect(g.technique.effectLevel).toBe(cancel===HARP?5:7);expect(g.targets[0]!.hits[0]!.damage).toBe(cancel===HARP?5:9);expect(gameStats(s,'A').spirit).toBe(spirit+(cancel===SPIRIT?0:2));s=finish(s);for(const id of [SPIRIT,HARP,command.cardInstanceId])expect(s.discard.filter(x=>x===id)).toHaveLength(1);
});
it('canceling the original attack ends its declared spirit bonus without returning either physical source',()=>{
 let {s,command}=prepared('踏み込み／弓',[SPIRIT]);const spirit=gameStats(s,'A').spirit,fate=handCard(s,'B','命運凶変');s=act(s,'A',command);
 for(let n=0;n<100;n++){const w=s.windows!.at(-1)!,a=s.actions?.[w.continuation.id];if(a?.cardInstanceId===command.cardInstanceId&&w.kind==='declaration'&&w.participants[w.cursor]==='B')break;s=pass(s);}
 s=finish(act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:viewFor(s,'B').reactionTargetActionId!}));expect(s.players.B!.damage).toBe(0);expect(gameStats(s,'A').spirit).toBe(spirit);expect(s.discard).toEqual(expect.arrayContaining([SPIRIT,command.cardInstanceId]));
});
it('Harp preserves printed null damage rather than creating four damage',()=>{
 let {s,command}=prepared(getAction('a2-p18-r1c1')!.name,[HARP]);s=act(s,'A',command);s=until(s,'attack-abilities');const g=Object.values(s.groups!)[0]!;expect(g.technique.damage).toBeNull();expect(g.targets[0]!.hits[0]!.damage).toBeNull();expect(g.technique.effectLevel).toBeGreaterThan(2);
});
it('rejects nonmental Harp, duplicate or foreign components, arbitrary IDs and late additions atomically',()=>{
 const {s,command}=prepared('踏み込み／弓',[SPIRIT,HARP]);reject(s,'A',command);
 const noEffectLevel=handCard(s,'A','魅了');reject(s,'A',{...command,cardInstanceId:noEffectLevel,combinationCardInstanceIds:[HARP]});
 for(const components of [[SPIRIT,SPIRIT],['a2-p05-r2c2'],[HARP,'foreign']])reject(s,'A',{...command,combinationCardInstanceIds:components});
 const foreign=structuredClone(s);foreign.players.A!.hand=foreign.players.A!.hand.filter(x=>x!==SPIRIT);foreign.players.B!.hand.push(SPIRIT);reject(foreign,'A',{...command,combinationCardInstanceIds:[SPIRIT]});
 const paid=act(s,'A',{...command,combinationCardInstanceIds:[SPIRIT]});reject(paid,'A',{type:'PLAY_ANYTIME_CARD',cardInstanceId:HARP,targetEventId:paid.windows!.at(-1)!.eventId});
});
it('declining the components keeps both in hand while the ordinary mental attack resolves',()=>{let {s,command}=prepared();const {combinationCardInstanceIds,...attack}=command;s=finish(act(s,'A',attack));expect(s.players.A!.hand).toEqual(expect.arrayContaining(combinationCardInstanceIds));expect(s.players.B!.damage).toBe(5);});
it('spirit remains for actual returned counter checks and expires only after withdrawal',()=>{
 let {s,command}=prepared('踏み込み／弓',[SPIRIT]);const counter=handCard(s,'B','閃光槍'),spirit=gameStats(s,'A').spirit;s=until(act(s,'A',command),'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});
 for(let n=0;n<150;n++){const w=s.windows!.at(-1)!,g=w.continuation.kind==='group'?s.groups![w.continuation.id]:undefined;if(g?.attackerId==='B'&&w.kind==='normal-defense')break;s=pass(s);}
 expect(gameStats(s,'A').spirit).toBe(spirit+2);s=finish(s);expect(s.players.A!.damage).toBe(5);expect(gameStats(s,'A').spirit).toBe(spirit+2);s=act(s,'A',{type:'PASS_WITHDRAWAL'});expect(gameStats(s,'A').spirit).toBe(spirit);
});
it('a legal counter accepts spirit at its declaration while an ordinary evade rejects the same component',()=>{
 let s=ready();for(const p of Object.values(s.players))p.permanent={endurance:100};const attack=handCard(s,'A','踏み込み／弓'),counter=handCard(s,'B','閃光槍'),evade=handCard(s,'B','見切る');handCard(s,'B',getAction(SPIRIT)!.name);const spirit=gameStats(s,'B').spirit;s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');
 reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false,combinationCardInstanceIds:[SPIRIT]});s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false,combinationCardInstanceIds:[SPIRIT]});expect(gameStats(s,'B').spirit).toBe(spirit+2);s=finish(s);expect(gameStats(s,'B').spirit).toBe(spirit+2);s=act(s,'A',{type:'PASS_WITHDRAWAL'});expect(gameStats(s,'B').spirit).toBe(spirit);
});
it('a real approach has no retroactive bonus, then the accepted combination lasts through a real withdrawal',()=>{
 let {s,command}=prepared('踏み込み／蹴る',[SPIRIT]);const advance=handCard(s,'A','踏み込み／弓'),distance=handCard(s,'A','間合い／休息'),spirit=gameStats(s,'A').spirit;s=finish(act(s,'A',{type:'APPROACH',cardInstanceId:advance,targetId:'B'}));expect(gameStats(s,'A').spirit).toBe(spirit);expect(s.distances.A!.B).toBe('near');
 s=finish(act(s,'A',command));expect(gameStats(s,'A').spirit).toBe(spirit+2);s=act(s,'A',{type:'WITHDRAW',cardInstanceId:distance,targetId:'B'});expect(gameStats(s,'A').spirit).toBe(spirit+2);s=finish(s);expect(s.distances.A!.B).toBe('far');expect(gameStats(s,'A').spirit).toBe(spirit);
});
it('failed attack checks end the spirit benefit while their frozen threshold stays unchanged',()=>{
 let {s,command}=prepared('魔詩',[SPIRIT]);const spirit=gameStats(s,'A').spirit;s.players.A!.permanent={...s.players.A!.permanent,magic_level:-10};s=act(s,'A',command);s=until(s,'before-roll');s=closeWindow(s,[6,6]);const roll=structuredClone(s.rolls!.at(-1)!);expect(roll.threshold).toBe(spirit+2);s=finish(s);expect(s.rolls!.find(r=>r.id===roll.id)!.threshold).toBe(roll.threshold);expect(gameStats(s,'A').spirit).toBe(spirit);
});
it('Harp adds four to the numeric zero of actual Ida mental blade without changing its printed damage formula',()=>{
 let {s,command}=prepared(getAction('a2-p08-r3c3')!.name,[HARP]);character(s,'A','忍びのイダ');s.players.A!.permanent={endurance:100,spirit:-20};s=until(act(s,'A',{...command,dedicated:true}),'attack-abilities');const g=Object.values(s.groups!)[0]!;expect(g.technique.effectLevel).toBe(9);expect(g.targets[0]!.hits[0]!.damage).toBe(4);expect(gameStats(s,'A').spirit).toBe(0);
});
it('spirit is retained throughout one actual two-target three-hit Shin attack and never carries into the next turn',()=>{
 let {s}=prepared('天地百撃斬',[SPIRIT]);character(s,'A','侍大将のシン');character(s,'C','忍びのイダ');const card=handCard(s,'A','天地百撃斬');s=act(s,'A',{type:'CHANT',cardInstanceId:card});
 for(let n=0;n<4;n++){const owner=s.seatOrder[s.turnSeat]!;s=act(s,owner,{type:'END_TURN',discardIds:s.players[owner]!.hand.filter(id=>id!==SPIRIT).slice(0,Math.max(0,s.players[owner]!.hand.length-gameStats(s,owner).handLimit))});const next=s.seatOrder[s.turnSeat]!;s=act(s,next,{type:'START_TURN'});s=act(s,next,{type:'CHOOSE_DRAW',draw:false});if(n<3)s=act(s,next,{type:'PASS_ACTION'});}
 const spirit=gameStats(s,'A').spirit;s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B','C'],dedicated:true,combinationCardInstanceIds:[SPIRIT]});
 for(let n=0;n<300&&s.windows?.length;n++){expect(gameStats(s,'A').spirit).toBe(spirit+2);s=pass(s,[3,...Array(30).fill(1)]);}expect(s.players.B!.damage).toBe(21);expect(s.players.C!.damage).toBe(21);s=act(s,'A',{type:'PASS_WITHDRAWAL'});expect(gameStats(s,'A').spirit).toBe(spirit);s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(gameStats(s,'A').handLimit)});expect(s.combinationSpirit).toEqual([]);
});
