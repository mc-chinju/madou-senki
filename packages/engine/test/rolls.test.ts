import {closeWindow,passReclaims} from './combat-helpers.js';
import { expect, it } from 'vitest';
import * as engine from '../src/index.js';
import { act, finish, pass, ready, until } from './combat-helpers.js';
import { character, entropy, handCard } from './fixtures.js';
import { parseGameCommand } from '@madou/protocol';

function checkState(owner='黒騎士ガーウィン'){let s=ready();const card=handCard(s,'A','天地百撃斬');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==card);s.players.A!.chants.push({cardInstanceId:card,revealed:false});character(s,'A',owner);s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false},[1]);return until(s,'before-roll');}
function closeAndDeclineDispositions(s:engine.GameState,dice:number[]=[]){const id=s.windows!.at(-1)!.id;while(s.windows?.at(-1)?.id===id)s=pass(s,dice);return passReclaims(s);}
function publicRoll(s:engine.GameState,viewer='A'){return (engine.viewFor(s,viewer) as any).currentRoll;}

it('persists a check before entropy, freezes its threshold only on closing before-roll, and hides concealed stats',()=>{
 let s=checkState();expect(publicRoll(s)).toMatchObject({kind:'check',stage:'before-roll',faces:[],total:null});
 const before=engine.derivedStats(s.players.A!).spirit;const attached=handCard(s,'A','神々の血');s.players.A!.open.push(attached);s.players.A!.hand=s.players.A!.hand.filter(id=>id!==attached);
 s=closeAndDeclineDispositions(s,[2,3]);expect(publicRoll(s)).toMatchObject({stage:'after-roll',faces:[2,3],total:5,threshold:engine.derivedStats(s.players.A!).spirit-2});
 // G03 判定の公開範囲: others read the outcome, only the roller's seat reads the threshold.
 expect(publicRoll(s,'B')).not.toHaveProperty('threshold');expect(publicRoll(s,'B').success).toBe(true);expect(publicRoll(s).threshold).toBe(before-1);
});
it('rerolls complete 2d6 after a cancelable child, keeping the original attempt and force failure latch',()=>{
 let s=checkState();const god=handCard(s,'B','神性介入');const fate=handCard(s,'A','命運凶変');s=closeAndDeclineDispositions(s,[1,1]);const id=publicRoll(s)?.rollId;expect(id).toBeTypeOf('string');
 s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:id});s=closeAndDeclineDispositions(s);expect(publicRoll(s).forcedFailure).toBe(true);s=pass(s);
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:id});expect(publicRoll(s).faces).toEqual([1,1]);s=closeAndDeclineDispositions(s,[2,3]);expect(publicRoll(s)).toMatchObject({rollId:id,faces:[2,3],forcedFailure:true,success:false,generation:1});expect(publicRoll(s).attempts).toHaveLength(2);s=finish(s);expect(s.players.B!.damage).toBe(0);
});
it('rejects invalid roll targets and mixed protocol keys before paying',()=>{
 expect(parseGameCommand({type:'PLAY_REACTION',cardInstanceId:'a2-p02-r1c3',mode:'reroll',targetRollId:'roll-1'}).ok).toBe(true);
 expect(parseGameCommand({type:'PLAY_REACTION',cardInstanceId:'a2-p02-r1c3',mode:'reroll',targetRollId:'roll-1',targetActionId:'a-1'}).ok).toBe(false);
 let s=checkState();const god=handCard(s,'A','神性介入');s=closeAndDeclineDispositions(s,[1,1]);const before=JSON.stringify(s);const result=engine.transition(s,{actorId:'A',command:{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:'missing'}} as any,entropy());expect(result).toEqual({ok:false,code:'INVALID_TARGET'});expect(JSON.stringify(s)).toBe(before);
});
it('pauses potion recovery until its numeric result is final and routes a public PASS while action phase is pending',()=>{
 let s=ready();const potion=handCard(s,'A','回復の薬');s.players.A!.damage=9;s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[potion]},[4]);s=closeWindow(s,[4]);expect(s.players.A!.damage).toBe(9);expect(publicRoll(s)).toMatchObject({purpose:'potion-recovery',total:4,stage:'after-roll'});s=closeAndDeclineDispositions(s);s=passReclaims(s);expect(s.players.A!.damage).toBe(5);expect(s.discard).toContain(potion);expect(s.phase).toBe('hand-adjustment');
});
it('processes both turn recovery statuses even when the first stop check fails, advancing each once',()=>{
 let s=ready();s.phase='turn-start';s.players.A!.statuses=[{id:'stop',kind:'stopped',modifiers:[-2],nextCheck:1},{id:'silence',kind:'silenced',modifiers:[0],nextCheck:1}];s=act(s,'A',{type:'START_TURN'},[6,6,1,1]);expect(publicRoll(s)).toMatchObject({purpose:'status-recovery',stage:'before-roll'});s=closeAndDeclineDispositions(s,[6,6]);expect(s.players.A!.statuses![0]!).toMatchObject({nextCheck:1});s=closeAndDeclineDispositions(s);expect(s.turnSeat).toBe(0);s=closeAndDeclineDispositions(s,[1,1]);s=closeAndDeclineDispositions(s);expect(s.players.A!.statuses).toEqual([{id:'stop',kind:'stopped',modifiers:[-2],nextCheck:2}]);expect(s.turnSeat).toBe(1);
});
it('defers random hit count until value confirmation and shares the rerolled count across all targets',()=>{
 let s=ready();const card=handCard(s,'A','天地百撃斬');const god=handCard(s,'A','神性介入');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==card);s.players.A!.chants.push({cardInstanceId:card,revealed:false});
 const declared=engine.transition(s,{actorId:'A',command:{type:'ATTACK',cardInstanceId:card,targetIds:['B','C'],dedicated:true}},{...entropy(),dice:[]});expect(declared.ok).toBe(true);if(!declared.ok)return;s=declared.state;s=until(s,'damage');s=closeAndDeclineDispositions(s,[2]);expect(publicRoll(s)).toMatchObject({purpose:'attack-hit-count',total:2});expect(Object.values(s.groups??{})).toHaveLength(0);
 s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:publicRoll(s).rollId});s=closeAndDeclineDispositions(s,[3]);s=closeAndDeclineDispositions(s);const group=Object.values(s.groups!)[0]!;expect(group.targets.map(t=>t.hits.length)).toEqual([3,3]);
});
it('reveals on a silence hit, pauses resistance before status or damage, then applies a forced failed result once',()=>{
 let s=ready();character(s,'A','白魔術師シェリム');const card=handCard(s,'A','沈黙');s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=until(s,'hit');s=closeAndDeclineDispositions(s,[6,6]);expect(s.players.B!.revealed).toBe(true);expect(publicRoll(s)).toMatchObject({purpose:'status-resistance',stage:'before-roll'});expect(s.players.B!.statuses??[]).toEqual([]);expect(engine.viewFor(s,'A').currentAttack).not.toBeNull();s=closeAndDeclineDispositions(s,[6,6]);expect(s.players.B!.statuses??[]).toEqual([]);s=closeAndDeclineDispositions(s);expect(s.players.B!.statuses).toHaveLength(1);s=finish(s);expect(s.players.B!.statuses).toHaveLength(1);
});
it('holds follower cards and per-hit HP until one final morale result, then preserves the simultaneous snapshot',()=>{
 let s=ready();const card=handCard(s,'A','天地百撃斬');const follower=handCard(s,'B','王立騎士団');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==card);s.players.A!.chants.push({cardInstanceId:card,revealed:false});s.players.B!.hand=s.players.B!.hand.filter(id=>id!==follower);s.players.B!.followers=[{cardInstanceId:follower,revealed:false}];s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:true});s=until(s,'damage');s=closeAndDeclineDispositions(s,[2]);s=closeAndDeclineDispositions(s);s=until(s,'follower-start');s=closeAndDeclineDispositions(s,[6,6]);expect(publicRoll(s)).toMatchObject({purpose:'follower-morale',stage:'before-roll'});let target=Object.values(s.groups!)[0]!.targets[0]!;expect(target.hits.map(h=>h.damage)).toEqual([7,7]);expect(s.players.B!.followers.map(f=>f.cardInstanceId)).toContain(follower);s=closeAndDeclineDispositions(s,[6,6]);expect(s.discard).not.toContain(follower);s=closeAndDeclineDispositions(s);target=Object.values(s.groups!)[0]!.targets[0]!;expect(target.followerResults).toHaveLength(1);expect(target.hits.map(h=>h.damage)).toEqual([7,7]);s=finish(s);expect(s.players.B!.damage).toBe(14);expect(s.rolls!.filter(r=>r.purpose==='follower-morale')).toHaveLength(1);
});
it('keeps the legacy action check result and stage usable during the roll continuation',()=>{let s=checkState();s=closeAndDeclineDispositions(s,[2,3]);expect(Object.values(s.actions!)[0]).toMatchObject({stage:'check-result',roll:{dice:[2,3],threshold:5,success:true}});});
it('keeps dedicated prayer reserved through later child cleanup until the original event finishes',()=>{
 let s=ready();character(s,'B','リーア姫');character(s,'A','忍びのイダ');const attack=handCard(s,'A','手裏剣');const prayer=handCard(s,'B','必勝の祈り');const god=handCard(s,'A','神性介入');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['C'],dedicated:true});s=until(s,'effect-level');s=pass(s);const parent=Object.values(s.actions!)[0]!.id;s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:parent,dedicated:true});s=closeAndDeclineDispositions(s,[2]);s=closeAndDeclineDispositions(s);expect(s.reclaimReservations).toContain(prayer);s=until(s,'damage');s=closeAndDeclineDispositions(s,[1]);s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:publicRoll(s).rollId});s=closeAndDeclineDispositions(s,[3]);expect(s.reclaimReservations).toContain(prayer);expect(s.players.B!.hand).not.toContain(prayer);s=finish(s);expect(s.players.B!.hand).toContain(prayer);
});
it.each([
 ['狼牙','餓狼ヨーツルム',false,'2d6',[1,2],[4,5],9],
 ['狼牙','餓狼ヨーツルム',true,'3d6',[1,2,3],[3,4,5],12],
 ['光竜破山剣','聖騎士ランスロット',true,'4d6+1',[1,1,1,1],[2,3,4,5],15],
 ['呪歌','吟遊詩人のレスター',false,'d6x2',[1],[5],10],
 ['呪歌','吟遊詩人のレスター',true,'d6x4',[1],[5],20],
 ['手裏剣','忍びのイダ',true,'d6x5',[1],[5],25],
] as const)('rerolls the entire %s/%s/%s formula and shares only its finalized value', (name,owner,dedicated,formula,initial,rerolled,total)=>{
 let s=ready();character(s,'A',owner);if(name==='狼牙'&&!dedicated)s.distances.A!.B=s.distances.B!.A='near';const card=handCard(s,'A',name);const god=handCard(s,'A','神性介入');if(name==='光竜破山剣'){s.players.A!.hand=s.players.A!.hand.filter(id=>id!==card);s.players.A!.chants=[{cardInstanceId:card,revealed:false}];}
 const targets=dedicated&&name!=='狼牙'?['B','C']:['B'];s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:targets,dedicated});s=until(s,'damage');s=closeAndDeclineDispositions(s,[...initial]);const id=publicRoll(s).rollId;expect(publicRoll(s)).toMatchObject({purpose:'attack-damage',formula,faces:[...initial]});expect(Object.values(s.groups??{})).toHaveLength(0);
 s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:id});s=closeAndDeclineDispositions(s,[...rerolled]);expect(publicRoll(s)).toMatchObject({rollId:id,formula,faces:[...rerolled],total});s=closeAndDeclineDispositions(s);const group=Object.values(s.groups!)[0]!;expect(group.targets.map(t=>t.hits[0]!.damage)).toEqual(targets.map(()=>total));expect(group.targets.flatMap(t=>t.hits.map(h=>h.damageRollId))).toEqual(targets.map(()=>id));s=finish(s);expect(targets.map(id=>s.players[id]!.damage)).toEqual(targets.map(()=>total));expect(s.randomRolls!.at(-1)).toMatchObject({id,faces:[...rerolled],total});expect(s.rolls!.find(r=>r.id===id)!.attempts.map(a=>a.faces)).toEqual([[...initial],[...rerolled]]);
});
it('cancels a declared reroll without consuming dice, retaining paid cards, exact over-limit refill and OPEN replacements',()=>{
 let s=checkState();const god=handCard(s,'A','神性介入');const fate=handCard(s,'B','命運凶変');while(s.players.A!.hand.length<8){const id=s.deck.shift()!;s.players.A!.hand.push(id);}const blood=handCard(s,'D','神々の血');s.players.D!.hand=s.players.D!.hand.filter(id=>id!==blood);s.deck.unshift(blood);s=closeAndDeclineDispositions(s,[1,1]);const id=publicRoll(s).rollId;const before=s.players.A!.hand.length;const threshold=publicRoll(s).threshold;
 s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:id});expect(s.players.A!.hand).toHaveLength(before);expect(s.players.A!.open).toContain(blood);expect(publicRoll(s).threshold).toBe(threshold);expect(engine.viewFor(s,'A').reactionTargetRollId).toBeNull();const child=Object.values(s.actions!).find(a=>a.cardInstanceId===god)!;
 const invalid=engine.transition(s,{actorId:'B',command:{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:id}},{...entropy(),dice:[]});expect(invalid).toEqual({ok:false,code:'INVALID_TARGET'});
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:child.id});s=closeAndDeclineDispositions(s);s=closeAndDeclineDispositions(s);expect(publicRoll(s)).toMatchObject({rollId:id,generation:0,faces:[1,1]});expect(publicRoll(s).attempts).toHaveLength(1);expect(s.discard).toEqual(expect.arrayContaining([god,fate]));expect(s.windows!.at(-1)!.passed).toEqual([]);
});
it('canceled force-fail leaves normal success and a later reroll retains both complete attempts',()=>{
 let s=checkState();const fate=handCard(s,'A','命運凶変');const god=handCard(s,'B','神性介入');character(s,'B','占星術師のアルセイル');s.players.B!.revealed=true;s=closeAndDeclineDispositions(s,[1,1]);const id=publicRoll(s).rollId;s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:id});const child=Object.values(s.actions!).find(a=>a.cardInstanceId===fate)!;s=act(s,'B',{type:'CANCEL_REACTION',targetActionId:child.id});s=closeAndDeclineDispositions(s);expect(publicRoll(s)).toMatchObject({success:true,forcedFailure:false});s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:id});s=closeAndDeclineDispositions(s,[2,2]);expect(publicRoll(s)).toMatchObject({faces:[2,2],success:true,forcedFailure:false});
});
it('rejects old, before-roll, numeric-force-fail and wrong physical mode targets without cost',()=>{
 let s=checkState('大神官ジル');const god=handCard(s,'A','神性介入');const fate=handCard(s,'A','命運凶変');const beforeId=publicRoll(s).rollId;
 function rejectAt(state:engine.GameState,command:unknown){const snapshot=JSON.stringify(state);expect(engine.transition(state,{actorId:'A',command} as any,entropy()).ok).toBe(false);expect(JSON.stringify(state)).toBe(snapshot);}
 rejectAt(s,{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:beforeId});s=closeAndDeclineDispositions(s,[1,1]);rejectAt(s,{type:'PLAY_REACTION',cardInstanceId:fate,mode:'reroll',targetRollId:beforeId});rejectAt(s,{type:'PLAY_REACTION',cardInstanceId:god,mode:'force-fail',targetRollId:beforeId});s=closeAndDeclineDispositions(s);s=closeAndDeclineDispositions(s,[1,1]);expect(publicRoll(s).rollId).not.toBe(beforeId);rejectAt(s,{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:beforeId});s=until(s,'damage');s=closeAndDeclineDispositions(s,[2]);rejectAt(s,{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:publicRoll(s).rollId});s=closeAndDeclineDispositions(s);rejectAt(s,{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:beforeId});
});
it('waived checks create no selectable roll and cannot be forced to fail by action alias',()=>{
 let s=ready();character(s,'A','忍びのイダ');const card=handCard(s,'A','手裏剣');const fate=handCard(s,'A','命運凶変');s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:true});const actionId=Object.values(s.actions!)[0]!.id;s=until(s,'effect-level');expect(s.rolls??[]).toEqual([]);expect(publicRoll(s)).toBeNull();expect(engine.transition(s,{actorId:'A',command:{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetActionId:actionId}},entropy())).toEqual({ok:false,code:'INVALID_TARGET'});
});
it('a front morale success blocks before a concealed rear follower is examined',()=>{
 let s=ready();const card=handCard(s,'A','踏み込み／弓');const front=handCard(s,'B','グリフォン');const rear=handCard(s,'B','炎竜');s.players.B!.hand=s.players.B!.hand.filter(id=>id!==front&&id!==rear);s.players.B!.followers=[{cardInstanceId:front,revealed:false},{cardInstanceId:rear,revealed:false}];s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=until(s,'follower-start');s=closeAndDeclineDispositions(s);s=closeAndDeclineDispositions(s,[1,1]);s=closeAndDeclineDispositions(s);expect(Object.values(s.groups!)[0]!.targets[0]!.followerResults).toHaveLength(1);expect(s.players.B!.followers.find(f=>f.cardInstanceId===rear)!.revealed).toBe(false);s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.rolls!.filter(r=>r.purpose==='follower-morale')).toHaveLength(1);expect(JSON.stringify(engine.viewFor(s,'A'))).not.toContain(rear);
});
it('persists bounded public history without leaking concealed status sources, stats or raw resume frames',()=>{
 let s=ready();s.phase='turn-start';s.players.A!.statuses=Array.from({length:31},(_,i)=>({id:`private-effect-${i}`,kind:'silenced' as const,modifiers:[0],nextCheck:1}));s=act(s,'A',{type:'START_TURN'});s=finish(s);expect(s.rolls).toHaveLength(31);const view=engine.viewFor(s,'B');expect(view.recentRolls).toHaveLength(30);expect(view.currentRoll).toBeNull();expect(view.recentRolls[0]!.rollId).toBe(s.rolls![1]!.id);expect(JSON.stringify(view)).not.toContain('private-effect-');for(const r of view.recentRolls){expect(r).not.toHaveProperty('threshold');expect(r).not.toHaveProperty('resume');expect(r).toHaveProperty('success');expect(r.attempts[0]).toHaveProperty('success');}// G03 判定の公開範囲: revealing later does not reopen a roll thrown while hidden, so the history keeps its reading.
 s.players.A!.revealed=true;expect(engine.viewFor(s,'B').recentRolls[0]).toMatchObject({success:true});expect(engine.viewFor(s,'B').recentRolls[0]).not.toHaveProperty('threshold');
 expect(engine.viewFor(s,'B').recentRolls[0]).not.toHaveProperty('modifier');expect(engine.viewFor(s,'A').recentRolls[0]).toMatchObject({threshold:8,success:true});

});
it('reads a roll thrown in the open in the open, and keeps a hidden one hidden after a later reveal',()=>{
 let s=ready();s.players.A!.revealed=true;s.phase='turn-start';s.players.A!.statuses=[{id:'open',kind:'silenced' as const,modifiers:[0],nextCheck:1}];
 s=act(s,'A',{type:'START_TURN'});
 // The threshold is fixed when the before-roll window closes; thrown in the open, it reaches the table with it.
 s=finish(s);
 expect(engine.viewFor(s,'B').recentRolls.at(-1)).toMatchObject({threshold:expect.any(Number),modifier:expect.any(Number)});
 expect(engine.viewFor(s,'B').logs.filter(log=>log.type==='ROLL_RESOLVED').at(-1)!.roll).toMatchObject({threshold:expect.any(Number)});
});
it('rejects new turn actions while recovery is pending and refills only after every stopped status clears',()=>{
 let s=ready();s.phase='turn-start';s.players.A!.statuses=[{id:'s1',kind:'stopped',modifiers:[0],nextCheck:1},{id:'s2',kind:'stopped',modifiers:[0],nextCheck:1}];s.discard.push(...s.players.A!.hand.splice(2));s=act(s,'A',{type:'START_TURN'});expect(engine.transition(s,{actorId:'A',command:{type:'START_TURN'}},entropy())).toEqual({ok:false,code:'WRONG_PHASE'});s=closeAndDeclineDispositions(s,[1,1]);s=closeAndDeclineDispositions(s);expect(s.players.A!.hand).toHaveLength(2);s=closeAndDeclineDispositions(s,[1,1]);s=closeAndDeclineDispositions(s);expect(s.players.A!.hand).toHaveLength(5);expect(s.players.A!.statuses).toEqual([]);expect(s.phase).toBe('draw');
});
it('preserves the incoming public attack during a teleport check continuation',()=>{
 let s=ready();const card=handCard(s,'A','踏み込み／弓');const teleport=handCard(s,'B','転移');s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');const group=engine.viewFor(s,'B').currentAttack!.groupId;s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:teleport,dedicated:false});s=until(s,'before-roll');expect(engine.viewFor(s,'A').currentAction).toMatchObject({actorId:'B',kind:'defense'});expect(engine.viewFor(s,'A').currentAttack).toMatchObject({groupId:group,targetId:'B'});
});
it.each([false,true])('only Lia dedicated prayer gets immediate anytime-card replacement (dedicated=%s)',dedicated=>{
 let s=ready();if(dedicated)character(s,'A','リーア姫');const card=handCard(s,'A','踏み込み／弓');const prayer=handCard(s,'A','必勝の祈り');s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=until(s,'effect-level');const before=s.players.A!.hand.length;const parent=Object.values(s.actions!)[0]!.id;s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:parent,dedicated});expect(s.players.A!.hand).toHaveLength(before-(dedicated?0:1));expect(Object.values(s.actions!).find(a=>a.cardInstanceId===prayer)!.reactionAmount).toBeUndefined();s=closeAndDeclineDispositions(s,[2]);expect(Object.values(s.actions!).find(a=>a.id===parent)!.technique.effectLevel).toBe(3);s=closeAndDeclineDispositions(s);expect(Object.values(s.actions!).find(a=>a.id===parent)!.technique.effectLevel).toBe(5);
});
it('keeps the counter parent event identity through returned-attack morale, preventing same-source reuse',()=>{
 let s=ready();character(s,'B','白魔術師シェリム');s.distances.A!.B=s.distances.B!.A='near';const attack=handCard(s,'A','踏み込み／弓');const counter=handCard(s,'B','妖撃破山剣');const follower=handCard(s,'A','王立騎士団');const god=handCard(s,'B','神性介入');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==follower);s.players.A!.followers=[{cardInstanceId:follower,revealed:false}];s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});s=until(s,'before-roll');s=closeAndDeclineDispositions(s,[1,1]);const eventId=publicRoll(s).eventId;s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:publicRoll(s).rollId});s=closeAndDeclineDispositions(s,[1,1]);s=closeAndDeclineDispositions(s);s=until(s,'follower-start');s=closeAndDeclineDispositions(s);expect(publicRoll(s)).toMatchObject({purpose:'follower-morale',eventId});s=closeAndDeclineDispositions(s,[1,1]);handCard(s,'B','神性介入');s=pass(s);const snapshot=JSON.stringify(s);expect(engine.transition(s,{actorId:'B',command:{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:publicRoll(s).rollId}},entropy())).toEqual({ok:false,code:'ALREADY_USED'});expect(JSON.stringify(s)).toBe(snapshot);
});
it('rerolls prayer addition before modifying the parent effect level',()=>{
 let s=ready();const attack=handCard(s,'A','踏み込み／弓');const prayer=handCard(s,'A','必勝の祈り');const god=handCard(s,'A','神性介入');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'effect-level');const parent=Object.values(s.actions!)[0]!.id;s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:parent});s=closeAndDeclineDispositions(s,[1]);expect(s.actions![parent]!.technique.effectLevel).toBe(3);s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:publicRoll(s).rollId});s=closeAndDeclineDispositions(s,[6]);expect(s.actions![parent]!.technique.effectLevel).toBe(3);s=closeAndDeclineDispositions(s);expect(s.actions![parent]!.technique.effectLevel).toBe(9);expect(s.rolls!.find(r=>r.purpose==='prayer-addition')!.attempts.map(a=>a.total)).toEqual([1,6]);
});
it('keeps turn recovery forced failure after another player rerolls, without refill or replay',()=>{
 let s=ready();s.phase='turn-start';s.players.A!.statuses=[{id:'stopped',kind:'stopped',modifiers:[0],nextCheck:1}];s.discard.push(...s.players.A!.hand.splice(2));const fate=handCard(s,'B','命運凶変');const god=handCard(s,'C','神性介入');s=act(s,'A',{type:'START_TURN'});s=closeAndDeclineDispositions(s,[1,1]);const id=publicRoll(s).rollId;
 // The stopped roller is no longer a respondent on their own public windows (G03).
 expect(s.windows!.at(-1)!.participants).toEqual(['B','C','D']);
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:id});s=closeAndDeclineDispositions(s);s=pass(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:id});s=closeAndDeclineDispositions(s,[2,2]);s=closeAndDeclineDispositions(s);expect(s.players.A!.statuses).toEqual([{id:'stopped',kind:'stopped',modifiers:[0],nextCheck:2}]);expect(s.players.A!.hand).toHaveLength(2);expect(s.turnSeat).toBe(1);expect(s.rolls!.at(-1)).toMatchObject({id,faces:[2,2],success:false,forcedFailure:true,stage:'applied'});
});
it('a canceled random attack spends its source without creating an effect roll',()=>{
 let s=ready();character(s,'A','忍びのイダ');const attack=handCard(s,'A','手裏剣');const fate=handCard(s,'A','命運凶変');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:true});const parent=Object.values(s.actions!)[0]!.id;s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:parent});s=closeAndDeclineDispositions(s);s=closeAndDeclineDispositions(s);expect(s.rolls??[]).toEqual([]);expect(s.players.B!.damage).toBe(0);expect(s.discard).toEqual(expect.arrayContaining([attack,fate]));
});
it('does not allow a stopped Arseil to cancel a reaction during turn recovery',()=>{
 let s=ready();character(s,'C','占星術師のアルセイル');s.players.C!.revealed=true;s.players.C!.statuses=[{id:'stop-c',kind:'stopped',modifiers:[0],nextCheck:1}];s.players.A!.statuses=[{id:'silence-a',kind:'silenced',modifiers:[0],nextCheck:1}];s.phase='turn-start';const fate=handCard(s,'B','命運凶変');s=act(s,'A',{type:'START_TURN'});s=closeAndDeclineDispositions(s,[1,1]);s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:publicRoll(s).rollId});const child=Object.values(s.actions!)[0]!.id;const snapshot=JSON.stringify(s);expect(engine.transition(s,{actorId:'C',command:{type:'CANCEL_REACTION',targetActionId:child}},entropy())).toEqual({ok:false,code:'STOPPED'});expect(JSON.stringify(s)).toBe(snapshot);expect(engine.viewFor(s,'C').legalChoices).not.toContain('CANCEL_REACTION');
});
it('retains the incoming attack through prayer on a defense, its God child, and JSON restoration', () => {
  let state = ready();
  const bow = handCard(state, 'A', '踏み込み／弓');
  const teleport = handCard(state, 'B', '転移');
  const prayer = handCard(state, 'B', '必勝の祈り');
  const god = handCard(state, 'A', '神性介入');
  state = act(state, 'A', { type: 'ATTACK', cardInstanceId: bow, targetIds: ['B'], dedicated: false });
  state = until(state, 'normal-defense');
  const incomingId = engine.viewFor(state, 'B').currentAttack!.groupId;
  state = act(state, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: teleport, dedicated: false });
  state = until(state, 'effect-level');
  const defenseId = Object.values(state.actions!).find(action => action.cardInstanceId === teleport)!.id;
  state = pass(state); // Prayer's owner receives priority in the defense effect-level window.
  state = act(state, 'B', { type: 'PLAY_REACTION', cardInstanceId: prayer, mode: 'effect-plus', targetActionId: defenseId });
  state = closeAndDeclineDispositions(state, [1]);
  const prayerRollId = publicRoll(state).rollId;
  const expectedAttack = {
    groupId: incomingId, attackerId: 'A', targetIds: ['B'], targetId: 'B', hitIndex: 0,
    technique: { effectLevel: 3, damage: 4 },
    defenseRestrictions: { maaiProhibited: false, evadeProhibited: false, counterProhibited: false },
  };
  function assertPublicParent(snapshot: engine.GameState, targetRollId: string | null) {
    for (const viewerId of ['A', 'B', 'C']) {
      const view = engine.viewFor(snapshot, viewerId);
      expect(view).toEqual(engine.viewFor(JSON.parse(JSON.stringify(snapshot)), viewerId));
      expect(view.currentAttack).toMatchObject(expectedAttack);
      expect(view.currentRoll).toMatchObject({ rollId: prayerRollId, purpose: 'prayer-addition' });
      expect(view.reactionTargetRollId).toBe(targetRollId);
      expect(view.legalChoices).not.toContain('PLAY_DEFENSE');
      if (viewerId !== 'B') {
        expect(view.players.B).not.toHaveProperty('characterId');
        expect(view.players.B).not.toHaveProperty('hand');
        expect(view.recentRolls.find(roll => roll.rollerId === 'B' && roll.kind === 'check')).not.toHaveProperty('threshold');
      }
    }
  }
  assertPublicParent(state, prayerRollId);
  state = act(state, 'A', { type: 'PLAY_REACTION', cardInstanceId: god, mode: 'reroll', targetRollId: prayerRollId });
  const childId = Object.values(state.actions!).find(action => action.cardInstanceId === god)!.id;
  assertPublicParent(state, null);
  expect(engine.viewFor(state, 'B').reactionTargetActionId).toBe(childId);
  state = closeAndDeclineDispositions(state, [4]);
  assertPublicParent(state, prayerRollId);
  expect(publicRoll(state).total).toBe(4);
});
