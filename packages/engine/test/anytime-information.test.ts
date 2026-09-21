import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {gameStats,transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,finish,pass,ready,until,closeWindow} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
const PEACE='a2-p02-r1c1',REVELATION='a2-p02-r1c2';
function play(s:GameState,actorId:string,card:string,targetId:string){const o=viewFor(s,actorId).anytimeCardOptions.find(o=>o.cardInstanceId===card&&o.targetId===targetId)!;expect(o).toBeDefined();return act(s,actorId,{type:'PLAY_ANYTIME_CARD',cardInstanceId:card,targetEventId:o.targetEventId,targetId});}
it('Revelation outside combat privately snapshots all three zones, keeps their order and restores the interrupted action phase',()=>{
 let s=ready();handCard(s,'A',getAction(REVELATION)!.name);const follower=handCard(s,'B','グリフォン'),chant=handCard(s,'B','氷矢');s.players.B!.hand=s.players.B!.hand.filter(id=>id!==follower&&id!==chant);s.players.B!.followers=[{cardInstanceId:follower,revealed:false}];s.players.B!.chants=[{cardInstanceId:chant,revealed:false}];const original=structuredClone(s.players.B!);
 s=until(play(s,'A',REVELATION,'B'),'private-inspection');const d=viewFor(s,'A').inspection!;expect(d.zone).toBe('all');expect(d.cards.map(c=>c.cardInstanceId)).toEqual([...original.hand,follower,chant]);expect(d).not.toHaveProperty('characterId');expect(viewFor(s,'C').inspection).toBeNull();
 expect(transition(s,{actorId:'C',command:{type:'CHOOSE_INSPECTION',decisionId:d.decisionId,choice:'finish'}},entropy()).ok).toBe(false);
 s=act(s,'A',{type:'CHOOSE_INSPECTION',decisionId:d.decisionId,choice:'finish'});s=finish(s);expect(s.phase).toBe('action');expect(s.players.B).toEqual(original);expect(viewFor(s,'A').inspectionHistory).toHaveLength(1);expect(viewFor(s,'C').inspectionHistory).toEqual([]);
});
it.each([PEACE,REVELATION])('Fate cancellation of %s outside combat keeps refill and original phase, without effect',id=>{
 let s=ready();handCard(s,'A',getAction(id)!.name);const fate=handCard(s,'B','命運凶変'),hand=s.players.A!.hand.length,spirit=gameStats(s,'B').spirit;s=play(s,'A',id,'B');const target=viewFor(s,'B').reactionTargetActionId!;
 s=finish(act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:target}));expect(s.phase).toBe('action');expect(s.players.A!.hand).toHaveLength(hand);expect(gameStats(s,'B').spirit).toBe(spirit);expect(s.inspections??[]).toHaveLength(0);expect(discardIds(s)).toContain(id);
});
it('Peace replaces base spirit with 12 plus existing modifiers until the next own main action actually ends',()=>{
 let s=ready();handCard(s,'A',getAction(PEACE)!.name);s.players.B!.permanent={spirit:2};const original=gameStats(s,'B').spirit;s=finish(play(s,'A',PEACE,'B'));expect(gameStats(s,'B').spirit).toBe(14);expect(viewFor(s,'C').peaceExpiries).toEqual([{targetId:'B',timing:'next-own-action'}]);
 s=act(s,'A',{type:'PASS_ACTION'});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(gameStats(s,'A').handLimit)});s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});expect(gameStats(s,'B').spirit).toBe(14);
 s=act(s,'B',{type:'PASS_ACTION'});expect(gameStats(s,'B').spirit).toBe(original);expect(viewFor(s,'C').peaceExpiries).toEqual([]);
});
it('Peace during an existing attack preserves an already frozen roll and expires only after the whole attack',()=>{
 let s=ready();character(s,'A','大神官ジル');s.players.A!.permanent={magic_level:-20};handCard(s,'B',getAction(PEACE)!.name);character(s,'B','リーア姫');const arrow=handCard(s,'A','氷矢');s=act(s,'A',{type:'ATTACK',cardInstanceId:arrow,targetIds:['C'],dedicated:false});s=until(s,'after-roll');const roll=s.rolls!.at(-1)!,threshold=roll.threshold;
 s=pass(s);s=play(s,'B',PEACE,'A');s=closeWindow(s);while(s.windows?.at(-1)?.kind==='reclaim')s=pass(s);expect(gameStats(s,'A').spirit).toBe(12);expect(s.rolls!.find(r=>r.id===roll.id)!.threshold).toBe(threshold);s=finish(s);expect(s.players.A!.spiritReplacements?.filter(r=>r.sourceCardInstanceId===PEACE)??[]).toHaveLength(0);
});
it('Peace survives an actual returned counter and expires after its enclosing attack chain',()=>{
 let s=ready();character(s,'C','大神官ジル');handCard(s,'C',getAction(PEACE)!.name);const arrow=handCard(s,'A','踏み込み／弓'),counter=handCard(s,'B','閃光槍');const base=gameStats(s,'A').spirit;
 s=act(s,'A',{type:'ATTACK',cardInstanceId:arrow,targetIds:['B'],dedicated:false});s=pass(s);s=pass(s);s=play(s,'C',PEACE,'A');s=until(s,'normal-defense');expect(gameStats(s,'A').spirit).toBe(12);
 s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});for(let n=0;n<100&&Object.keys(s.groups??{}).length<2;n++)s=pass(s);expect(Object.keys(s.groups!)).toHaveLength(2);expect(gameStats(s,'A').spirit).toBe(12);
 s=finish(s);expect(s.players.A!.damage).toBe(5);expect(gameStats(s,'A').spirit).toBe(base);expect(viewFor(s,'D').peaceExpiries).toEqual([]);
});
it('Revelation acknowledges a saved interrupt and resumes the same original attack without spending its action twice',()=>{
 let s=ready();handCard(s,'B',getAction(REVELATION)!.name);const arrow=handCard(s,'A','踏み込み／弓');s=act(s,'A',{type:'ATTACK',cardInstanceId:arrow,targetIds:['C'],dedicated:false});s=pass(s);const parent=s.windows!.at(-1)!.id;
 s=until(play(s,'B',REVELATION,'C'),'private-inspection');const d=viewFor(s,'B').inspection!;s=act(s,'B',{type:'CHOOSE_INSPECTION',decisionId:d.decisionId,choice:'finish'});while(s.windows?.at(-1)?.kind==='reclaim')s=pass(s);expect(s.windows!.at(-1)!.id).toBe(parent);
 s=finish(s);expect(s.players.C!.damage).toBe(4);expect(viewFor(s,'B').inspectionHistory).toHaveLength(1);expect(viewFor(s,'A').inspectionHistory).toEqual([]);
});
it('utility anytime eligibility rejects wrong faction, self Peace, inactive target and stale context without mutation',()=>{
 let s=ready();handCard(s,'A',getAction(PEACE)!.name);handCard(s,'A',getAction(REVELATION)!.name);const o=viewFor(s,'A').anytimeCardOptions.find(o=>o.cardInstanceId===PEACE)!;
 for(const c of [{cardInstanceId:PEACE,targetId:'A',targetEventId:o.targetEventId},{cardInstanceId:PEACE,targetId:'B',targetEventId:'old'},{cardInstanceId:REVELATION,targetId:'missing',targetEventId:o.targetEventId}]){const before=JSON.stringify(s);expect(transition(s,{actorId:'A',command:{type:'PLAY_ANYTIME_CARD',...c}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
 character(s,'A','黒騎士ガーウィン');expect(viewFor(s,'A').anytimeCardOptions.some(o=>o.cardInstanceId===PEACE)).toBe(false);s.players.B!.presence='otherworld';expect(viewFor(s,'A').anytimeCardOptions.some(o=>o.targetId==='B')).toBe(false);
});
