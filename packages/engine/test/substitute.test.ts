import {getAction,getCharacter} from '@madou/catalog';
import {expect,it} from 'vitest';
import {gameStats,transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,ready,until,closeWindow} from './combat-helpers.js';
import {character,entropy,handCard,freshGame} from './fixtures.js';
const SUBSTITUTE='a2-p02-r2c1';
function incoming(){let s=ready();character(s,'C','黒騎士ガーウィン');handCard(s,'C','身代わり');const card=handCard(s,'A','踏み込み／弓');s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=until(s,'attack-abilities');s=pass(s);s=pass(s);return s;}
function take(s:GameState,index?:number){const o=viewFor(s,'C').anytimeCardOptions.find(o=>o.cardInstanceId===SUBSTITUTE&&(index===undefined||o.hitIndex===index))!;expect(o).toBeDefined();return act(s,'C',{type:'PLAY_ANYTIME_CARD',cardInstanceId:SUBSTITUTE,targetEventId:o.targetEventId,targetId:o.targetId,groupId:o.groupId,hitIndex:o.hitIndex});}
it('one physical Substitute receives only the selected hit, refills once and defers body damage until the original attack ends',()=>{
 let s=incoming();const count=s.players.C!.hand.length;s=take(s);expect(s.players.C!.hand).toHaveLength(count);s=until(s,'normal-defense');expect(s.windows!.at(-1)!.participants).toEqual(['C']);expect(s.players.C!.damage).toBe(0);expect(s.discard).toContain(SUBSTITUTE);s=finish(s);expect(s.players.C!.damage).toBe(4);expect(s.players.B!.damage).toBe(0);expect(s.phase).toBe('withdrawal');
});
it('decline leaves the card and original recipient unchanged',()=>{let s=incoming();s=finish(s);expect(s.players.C!.hand).toContain(SUBSTITUTE);expect(s.players.B!.damage).toBe(4);expect(s.players.C!.damage).toBe(0);});
it('the substitute rejects ordinary defense, maai, followers and own anytime responses without charging cards',()=>{
 let s=incoming();const evade=handCard(s,'C','見切る'),maai=handCard(s,'C','間合い／休息'),fate=handCard(s,'C','命運凶変');s=until(take(s),'normal-defense');
 for(const command of [{type:'PLAY_DEFENSE',cardInstanceId:evade,dedicated:false},{type:'PLAY_MAAI',cardInstanceId:maai},{type:'START_FOLLOWERS'},{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:Object.values(s.actions!).find(a=>a.kind==='attack')!.id}]){const before=JSON.stringify(s);expect(transition(s,{actorId:'C',command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
 expect(viewFor(s,'C').legalChoices).not.toContain('START_FOLLOWERS');expect(viewFor(s,'C').anytimeCardOptions).toEqual([]);
});
it('the substitute may use a real hand counter and the counter resumes the selected hit exactly once',()=>{
 let s=incoming();const counter=handCard(s,'C','閃光槍');s=until(take(s),'normal-defense');s=act(s,'C',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});s=finish(s);expect(s.players.A!.damage).toBe(5);expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBe(0);
});
it('Fate cancellation leaves the original hit live while preserving payment and refill',()=>{
 let s=incoming();const fate=handCard(s,'D','命運凶変'),count=s.players.C!.hand.length;s=take(s);const child=viewFor(s,'D').reactionTargetActionId!;s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:child});s=finish(s);expect(s.players.C!.hand).toHaveLength(count);expect(s.players.C!.damage).toBe(0);expect(s.players.B!.damage).toBe(4);expect(s.discard).toContain(SUBSTITUTE);
});

function multi(withFollower=false,receiverFollower=false){
 let s=freshGame();character(s,'A','侍大将のシン');character(s,'B','黒騎士ガーウィン');character(s,'C','忍びのイダ');for(const p of Object.values(s.players))p.permanent={endurance:100};
 const attack=handCard(s,'A','天地百撃斬'),wood=handCard(s,'B','ウッドゴーレム'),metal=handCard(s,'C','メタルゴーレム');handCard(s,'C','身代わり');
 for(const id of s.seatOrder){if(id==='C'&&receiverFollower)s=act(s,id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:metal});if(id==='B'&&withFollower)s=act(s,id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:wood});s=act(s,id,{type:'PASS_SETUP'});}
 s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});s=act(s,'A',{type:'CHANT',cardInstanceId:attack});
 for(let n=0;n<4;n++){const id=s.seatOrder[s.turnSeat]!;s=act(s,id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>x!==SUBSTITUTE).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});const next=s.seatOrder[s.turnSeat]!;s=act(s,next,{type:'START_TURN'});s=act(s,next,{type:'CHOOSE_DRAW',draw:false});if(next!=='A')s=act(s,next,{type:'PASS_ACTION'});}
 s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B','C'],dedicated:true});for(let n=0;n<100&&!Object.keys(s.groups??{}).length;n++)s=pass(s,[3,...Array(40).fill(1)]);expect(Object.values(s.groups!)[0]!.targets.map(t=>t.hits.length)).toEqual([3,3]);return {s,wood};
}
it('an actual two-target three-hit attack transfers exactly B hit2 to C while preserving C own three hits and simultaneous damage',()=>{
 let {s}=multi();s=pass(s);s=pass(s);s=take(s,1);s=until(s,'normal-defense');s=pass(s);for(let n=0;n<100&&Object.keys(s.groups!).length>1;n++)s=pass(s);
 expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBe(0);s=finish(s);expect(s.players.B!.damage).toBe(14);expect(s.players.C!.damage).toBe(28);
});
it('substitution after real follower destruction keeps its three reductions and transfers only the residual hit damage',()=>{
 let {s,wood}=multi(true);s=until(s,'hit');s=pass(s);s=pass(s);s=take(s,1);s=finish(s);expect(s.discard).toContain(wood);expect(s.players.B!.damage).toBe(4);expect(s.players.C!.damage).toBe(23);
});
it('near attack range and newly public same-faction eligibility are not reapplied to the substitute',()=>{
 let s=ready();character(s,'C','聖騎士ランスロット');handCard(s,'C','身代わり');const approach=handCard(s,'A','踏み込み／弓'),attack=handCard(s,'A','踏み込み／蹴る');s=act(s,'A',{type:'APPROACH',cardInstanceId:approach,targetId:'B'});s=finish(s);s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'attack-abilities');const expected=Object.values(s.groups!)[0]!.targets[0]!.hits[0]!.damage;s=pass(s);s=pass(s);s=until(take(s),'normal-defense');expect(s.distances.A!.C).toBe('far');s=act(s,'C',{type:'REVEAL_CHARACTER'});s=finish(s);expect(s.players.C!.damage).toBe(expected);expect(s.players.B!.damage).toBe(0);
});
it('the substitute can elect its own actual mental defense without granting ordinary defenses',()=>{
 let s=incoming();character(s,'C',getCharacter('c2-p03-r2c1')!.name);s=until(take(s),'normal-defense');s=act(s,'C',{type:'REVEAL_CHARACTER'});const o=viewFor(s,'C').abilityOptions.find(o=>o.abilityId==='c2-p03-r2c1-ab01')!;expect(o).toBeDefined();s=act(s,'C',{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId});s=finish(s);expect(s.players.C!.damage).toBe(0);expect(s.players.B!.damage).toBe(0);
});
it('foreign, stale, self and wrong-hit bindings reject without payment or draw',()=>{
 const s=incoming(),o=viewFor(s,'C').anytimeCardOptions.find(o=>o.cardInstanceId===SUBSTITUTE)!,command={type:'PLAY_ANYTIME_CARD',cardInstanceId:SUBSTITUTE,targetEventId:o.targetEventId,targetId:o.targetId,groupId:o.groupId,hitIndex:o.hitIndex};
 for(const c of [{...command,targetId:'C'},{...command,targetEventId:'old'},{...command,groupId:'old'},{...command,hitIndex:99}]){const before=JSON.stringify(s);expect(transition(s,{actorId:'C',command:c} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
 expect(transition(s,{actorId:'D',command} as never,entropy()).ok).toBe(false);
});

it('receiver followers defend its own original hits but never the one substituted residual hit',()=>{
 let {s}=multi(true,true);s=until(s,'hit');s=pass(s);s=pass(s);s=finish(take(s,1));expect(s.players.B!.damage).toBe(4);expect(s.players.C!.damage).toBe(8);
});
it('a third party may still use actual Tragedy against the original attack during substitute response',()=>{
 let s=ready();character(s,'A','魔導王ガイナス');s.players.A!.revealed=true;handCard(s,'C','身代わり');const tragedy=handCard(s,'D','アレキサンドリア城の悲劇'),arrow=handCard(s,'A','踏み込み／弓');
 s=act(s,'A',{type:'ATTACK',cardInstanceId:arrow,targetIds:['B'],dedicated:false});s=until(s,'attack-abilities');const root=Object.values(s.actions!)[0]!.id;s=pass(s);s=pass(s);s=until(take(s),'normal-defense');s=until(s,'hit');while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='D')s=pass(s);
 const o=viewFor(s,'D').anytimeCardOptions.find(o=>o.cardInstanceId===tragedy)!;expect(o.targetEventId).toBe(root);s=act(s,'D',{type:'PLAY_ANYTIME_CARD',cardInstanceId:tragedy,targetEventId:o.targetEventId});s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBe(0);
});
it('the receiver evaluates its own water immunity after transfer',()=>{
 let s=ready();character(s,'C',getCharacter('c2-p04-r1c1')!.name);handCard(s,'C','身代わり');const arrow=handCard(s,'A','氷矢');s=act(s,'A',{type:'ATTACK',cardInstanceId:arrow,targetIds:['B'],dedicated:false});s=until(s,'attack-abilities');s=pass(s);s=pass(s);s=until(take(s),'normal-defense');s=act(s,'C',{type:'REVEAL_CHARACTER'});
 const o=viewFor(s,'C').abilityOptions.find(o=>o.abilityId==='c2-p04-r1c1-ab01')!;expect(o).toBeDefined();s=act(s,'C',{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId});s=finish(s);expect(s.players.C!.damage).toBe(0);expect(s.players.B!.damage).toBe(0);
});

it('actual OPEN during substitute refill suspends its saved binding and resumes that same target hit',()=>{
 let s=incoming();const open=handCard(s,'D',getAction('a2-p01-r1c1')!.name);s.players.D!.hand=s.players.D!.hand.filter(id=>id!==open);s.deck.unshift(open);character(s,'D','忍びのイダ');s.players.D!.presence='dead';const count=s.players.C!.hand.length;
 s=take(s);expect(s.windows!.at(-1)!.kind).toBe('before-roll');const binding=Object.values(s.actions!).find(a=>a.cardInstanceId===SUBSTITUTE)!.substituteBinding;expect(binding).toMatchObject({targetId:'B',hitIndex:0});expect(s.players.C!.open).toContain(open);
 s=until(s,'revival');s=act(s,'D',{type:'CHOOSE_REVIVAL',revive:false});s=until(s,'normal-defense');expect(viewFor(s,'C').currentAttack!.substitution).toEqual({originalTargetId:'B',originalHitIndex:0});s=finish(s);expect(s.players.C!.hand).toHaveLength(count);expect(s.players.C!.damage).toBe(4);expect(s.players.B!.damage).toBe(0);
});

it.each([true,false])('black-wing hit cost selected=%s is shared with the original attack after substitution',pay=>{
 let s=ready();character(s,'A','黒妖精のアーネス');character(s,'C','黒騎士ガーウィン');s.players.C!.permanent={endurance:100};const card=handCard(s,'A','黒翼天翔剣'),cost=handCard(s,'A','踏み込み／弓');handCard(s,'C','身代わり');s=act(s,'A',{type:'CHANT',cardInstanceId:card});
 for(let n=0;n<4;n++){const id=s.seatOrder[s.turnSeat]!;s=act(s,id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>x!==cost&&x!==SUBSTITUTE).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});const next=s.seatOrder[s.turnSeat]!;s=act(s,next,{type:'START_TURN'});s=act(s,next,{type:'CHOOSE_DRAW',draw:false});if(next!=='A')s=act(s,next,{type:'PASS_ACTION'});}
 s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:true});s=until(s,'attack-abilities');s=pass(s);s=pass(s);s=take(s);s=until(s,'hit-advance-choice');const child=s.windows!.at(-1)!.continuation.id;
 if(pay)s=act(s,'A',{type:'PAY_HIT_ADVANCES',groupId:child,cardInstanceIds:[cost]});else s=pass(s);
 for(const g of Object.values(s.groups!))expect(g.postHitAdvancePaid).toBe(true);
 s=finish(s);expect(s.players.C!.damage).toBe(pay?20:15);expect(s.players.B!.damage).toBe(0);expect(s.players.A!.hand.includes(cost)).toBe(!pay);
});

it('substitute own fatal response stays publicly irrevocable until all original target damage settles',()=>{
 let s=ready();character(s,'A','黒妖精のアーネス');character(s,'C','不死王ガドューラ');for(const p of Object.values(s.players))p.permanent={endurance:100,magic_level:20};handCard(s,'C','身代わり');const card=handCard(s,'A',getAction('a2-p18-r1c3')!.name);
 s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B','D'],dedicated:false});s=until(s,'attack-abilities');s=pass(s);s=pass(s);s=until(take(s),'normal-defense');s=act(s,'C',{type:'REVEAL_CHARACTER'});
 const o=viewFor(s,'C').abilityOptions.find(o=>o.abilityId==='c2-p06-r1c1-ab01')!;s=act(s,'C',{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId});s=closeWindow(s);s=closeWindow(s,[6,6]);s=closeWindow(s);
 expect(viewFor(s,'D').players.A!.pendingFatal).toBe(true);expect(s.players.A!.presence).toBe('active');expect(s.players.D!.damage).toBe(0);s=until(s,'death-gift');expect(s.players.D!.damage).toBe(8);expect(s.players.A!.presence).toBe('pending-death');s=finish(s);expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')).toHaveLength(1);
});
