import {expect,it} from 'vitest';
import {getAction,getCharacter} from '@madou/catalog';
import {gameStats,transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,ready,until} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
const TRAGEDY='a2-p01-r2c3',KEIL='a2-p01-r3c1',AMULET='a2-p01-r3c2',HOSTAGE='a2-p02-r2c2';
function initial(card:string,attacker='c2-p05-r2c2',target='c2-p02-r2c2',technique=card===KEIL?'天地爆砕剣':'天地百撃斬'){
 let s=ready();character(s,'A',getCharacter(attacker)!.name);character(s,'B',getCharacter(target)!.name);s.players.A!.revealed=true;s.players.B!.revealed=false;
 s.players.A!.permanent={warrior_level:20};s.players.B!.permanent={endurance:100};s.players.C!.permanent={endurance:100};handCard(s,'B',getAction(card)!.name);const attack=handCard(s,'A',technique);s=act(s,'A',{type:'CHANT',cardInstanceId:attack});
 for(let n=0;n<4;n++){const id=s.seatOrder[s.turnSeat]!;s=act(s,id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(c=>c!==card).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});const next=s.seatOrder[s.turnSeat]!;s=act(s,next,{type:'START_TURN'});s=act(s,next,{type:'CHOOSE_DRAW',draw:false});if(next!=='A')s=act(s,next,{type:'PASS_ACTION'});}
 return s;
}
function attack(s:GameState){const card=s.players.A!.chants[0]!.cardInstanceId,multi=s.players.A!.characterId==='c2-p01-r2c1'||getAction(card)!.name==='天地爆砕剣';s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:multi?['B','C']:['B'],dedicated:s.players.A!.characterId==='c2-p01-r2c1'});for(let n=0;n<100;n++){if(s.windows?.at(-1)?.kind==='attack-abilities')break;s=pass(s,[3,...Array(30).fill(1)]);}expect(Object.values(s.groups!)[0]!.targets.map(t=>t.hits.length)).toEqual(getAction(card)!.name==='天地爆砕剣'?[1,1]:multi?[3,3]:[3]);s=act(s,'B',{type:'REVEAL_CHARACTER'});return s;}
function priority(s:GameState,actorId:string){for(let n=0;n<20;n++){const w=s.windows!.at(-1)!;if(w.participants[w.cursor]===actorId)return s;s=pass(s);}throw Error('NO_PRIORITY');}
function play(s:GameState,actorId:string,id:string,targetId?:string){for(let n=0;n<100;n++){const o=viewFor(s,actorId).anytimeCardOptions.find(o=>o.cardInstanceId===id&&(!targetId||o.targetId===targetId));if(o)return act(s,actorId,{type:'PLAY_ANYTIME_CARD',cardInstanceId:id,targetEventId:o.targetEventId,...(targetId?{targetId}:{})});s=pass(s);}throw Error('NO_CARD_OPPORTUNITY');}

it('Tragedy fails all three unresolved hits of the actual public Gainas attack',()=>{
 let s=attack(initial(TRAGEDY));s=play(s,'B',TRAGEDY);s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBe(0);expect(s.discard).toContain(TRAGEDY);
});
it.each(['c2-p02-r2c2','c2-p03-r1c2'])('Keil protects only the selected %s of a real two-target attack and grows only Lancelot',target=>{
 let s=attack(initial(KEIL,'c2-p05-r2c2',target));s=play(s,'B',KEIL,'B');s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBeGreaterThan(0);expect(s.players.B!.permanent?.spirit??0).toBe(target==='c2-p02-r2c2'?1:0);
});
it('Hostage from EVIL fails all six unresolved hits of the selected GOOD attack',()=>{
 let s=attack(initial(HOSTAGE,'c2-p01-r2c1','c2-p05-r2c1'));s=finish(play(s,'B',HOSTAGE));expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBe(0);
});
it.each([TRAGEDY,KEIL,HOSTAGE])('declining %s leaves its physical card untouched and the six-hit attack resolves',id=>{
 let s=initial(id,id===HOSTAGE?'c2-p01-r2c1':'c2-p05-r2c2',id===HOSTAGE?'c2-p05-r2c1':'c2-p02-r2c2');s=finish(attack(s));expect(s.players.B!.hand).toContain(id);expect(s.players.B!.damage).toBeGreaterThan(0);expect(s.players.C!.damage).toBe(id===TRAGEDY?0:id===KEIL?15:21);
});
it.each([TRAGEDY,KEIL,HOSTAGE])('Fate cancels accepted %s without refunding refill or growing Keil',id=>{
 let s=initial(id,id===HOSTAGE?'c2-p01-r2c1':'c2-p05-r2c2',id===HOSTAGE?'c2-p05-r2c1':'c2-p02-r2c2');const fate=handCard(s,'C','命運凶変'),size=s.players.B!.hand.length;
 s=play(attack(s),'B',id,id===KEIL?'B':undefined);expect(s.players.B!.hand).toHaveLength(size);s=priority(s,'C');const target=viewFor(s,'C').reactionTargetActionId!;
 s=finish(act(s,'C',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:target}));expect(s.players.B!.damage).toBeGreaterThan(0);expect(s.players.C!.damage).toBe(id===TRAGEDY?0:id===KEIL?15:21);expect(s.players.B!.permanent?.spirit??0).toBe(0);expect(s.discard).toContain(id);
});
it.each(['c2-p03-r2c1-ab01','c2-p06-r1c1-ab01','c2-p06-r1c2-ab01'])('Amulet cancels only the current actual mental ability %s',abilityId=>{
 let s=ready();character(s,'B',getCharacter(abilityId.slice(0,-5))!.name);handCard(s,'A',getAction(AMULET)!.name);const arrow=handCard(s,'A','踏み込み／弓');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:arrow,targetIds:['B'],dedicated:false}),'normal-defense');const o=viewFor(s,'B').abilityOptions.find(o=>o.abilityId===abilityId)!;
 s=act(s,'B',{type:'USE_ABILITY',abilityId,targetEventId:o.targetEventId});s=play(s,'A',AMULET);s=finish(s);expect(s.rolls?.filter(r=>r.purpose==='ability-check')??[]).toHaveLength(0);expect(s.discard).toContain(AMULET);
});
it('wrong faction, hidden named attacker, foreign source and stale event all reject without payment',()=>{
 let s=attack(initial(TRAGEDY));s=priority(s,'B');const event=Object.values(s.groups!)[0]!.actionId;s.players.A!.revealed=false;
 for(const c of [{cardInstanceId:TRAGEDY,targetEventId:event},{cardInstanceId:HOSTAGE,targetEventId:event},{cardInstanceId:TRAGEDY,targetEventId:'old'}]){const before=JSON.stringify(s);expect(transition(s,{actorId:'B',command:{type:'PLAY_ANYTIME_CARD',...c}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
});

it('Keil protects every remaining hit of the actual three-hit Gainas attack',()=>{let s=attack(initial(KEIL,'c2-p05-r2c2','c2-p02-r2c2','天地百撃斬'));s=finish(play(s,'B',KEIL,'B'));expect(s.players.B!.damage).toBe(0);expect(s.players.B!.permanent?.spirit).toBe(1);});
it('public Cham cancels Hostage under ability suppression and Fate cannot cancel the printed card response',()=>{
 let s=initial(HOSTAGE,'c2-p01-r2c1','c2-p05-r2c1');character(s,'C','小妖精のチャム');s.players.C!.revealed=false;s.players.C!.statuses=[{id:'prior',kind:'ability-disabled',modifiers:[0],nextCheck:0}];const fate=handCard(s,'D','命運凶変');
 s=play(attack(s),'B',HOSTAGE);s=priority(s,'C');expect(viewFor(s,'C').abilityOptions.some(o=>o.name==='人質を中止する')).toBe(false);s=act(s,'C',{type:'REVEAL_CHARACTER'});
 const o=viewFor(s,'C').abilityOptions.find(o=>o.name==='人質を中止する')!;expect(o).toBeDefined();s=act(s,'C',{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId});s=priority(s,'D');
 const source=Object.values(s.abilities!).find(f=>f.printedCardResponse)!;expect(viewFor(s,'D').reactionTargetAbilityId).toBeNull();
 const before=JSON.stringify(s);for(const c of [{mode:'cancel-ability',targetAbilityId:source.id},{mode:'cancel',targetActionId:source.id}])expect(transition(s,{actorId:'D',command:{type:'PLAY_REACTION',cardInstanceId:fate,...c}} as any,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
 s=finish(s);expect(s.players.B!.damage).toBeGreaterThan(0);expect(s.discard).toContain(HOSTAGE);expect(s.players.D!.hand).toContain(fate);
});
it('Keil protection declared before the attack group persists into only its selected target',()=>{
 let s=initial(KEIL);s.players.B!.revealed=true;const card=s.players.A!.chants[0]!.cardInstanceId;
 s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B','C'],dedicated:false});s=finish(play(s,'B',KEIL,'B'));
 expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBe(15);expect(s.players.B!.permanent?.spirit).toBe(1);
});
it('Tragedy from a third party cancels only remaining targets after the first target damage was settled into the group',()=>{
 let s=initial(TRAGEDY,'c2-p05-r2c2','c2-p02-r2c2','天地爆砕剣');handCard(s,'D',getAction(TRAGEDY)!.name);s=attack(s);
 for(let n=0;n<150;n++){const w=s.windows?.at(-1);if(Object.values(s.groups??{})[0]?.targets.find(t=>t.actorId==='B')?.pendingDamage===15&&w?.kind==='hit'&&w.continuation.kind==='group'&&w.continuation.targetId==='C')break;s=pass(s);}
 expect(Object.values(s.groups!)[0]!.targets.find(t=>t.actorId==='B')!.pendingDamage).toBe(15);s=finish(play(s,'D',TRAGEDY));expect(s.players.B!.damage).toBe(15);expect(s.players.C!.damage).toBe(0);
});
it('Fate cancels the Amulet child while its immediate OPEN refill and the original mental ability remain',()=>{
 let s=ready();character(s,'B','魔聖母ディア');handCard(s,'A',getAction(AMULET)!.name);const fate=handCard(s,'C','命運凶変'),open=handCard(s,'D',getAction('a2-p01-r1c1')!.name);s.players.D!.hand=s.players.D!.hand.filter(id=>id!==open);s.deck.unshift(open);character(s,'D','忍びのイダ');s.players.D!.presence='dead';
 const arrow=handCard(s,'A','踏み込み／弓');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:arrow,targetIds:['B'],dedicated:false}),'normal-defense');const o=viewFor(s,'B').abilityOptions.find(o=>o.abilityId==='c2-p06-r1c2-ab01')!;
 s=act(s,'B',{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId});s=play(s,'A',AMULET);expect(s.players.A!.open).toContain(open);expect(s.windows!.at(-1)!.kind).toBe('before-roll');s=until(s,'revival');s=act(s,'D',{type:'CHOOSE_REVIVAL',revive:false});s=priority(s,'C');const target=viewFor(s,'C').reactionTargetActionId!;
 s=finish(act(s,'C',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:target}));expect(s.players.A!.open).toContain(open);expect(s.rolls?.filter(r=>r.purpose==='ability-check')).toHaveLength(1);expect(s.discard).toContain(AMULET);
});

it.each(['c2-p02-r2c2','c2-p03-r1c2'])('Keil legally protects late-revealed %s in one actual Shin two-target three-hit trajectory',target=>{
 let s=initial(KEIL,'c2-p01-r2c1',target,'天地百撃斬');handCard(s,'C',getAction(KEIL)!.name);const source=s.players.A!.chants[0]!.cardInstanceId;
 s=act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B','C'],dedicated:true});for(let n=0;n<100&&!Object.keys(s.groups??{}).length;n++)s=pass(s,[3,...Array(30).fill(1)]);
 s=until(s,'follower-start');const g=Object.values(s.groups!)[0]!;expect(g.targets.map(t=>t.hits.length)).toEqual([3,3]);expect(g.targets[0]!.followerStarted).toBe(true);expect(s.players.B!.revealed).toBe(false);
 s=act(s,'B',{type:'REVEAL_CHARACTER'});expect(Object.values(s.groups!)[0]!.targets[0]!.hits.every(h=>!h.hit&&!h.defended)).toBe(true);
 s=play(s,'C',KEIL,'B');s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.players.C!.damage).toBe(21);expect(s.players.B!.permanent?.spirit??0).toBe(target==='c2-p02-r2c2'?1:0);
});
