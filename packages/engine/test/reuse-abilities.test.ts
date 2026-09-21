import {techniqueFor} from '../src/effects/registry.js';
import {legalAttackTargets} from '../src/combat/legality.js';
import {expect,it} from 'vitest';
import {getAction,getCharacter} from '@madou/catalog';
import {gameStats,viewFor,transition,type GameState, discardIds } from '../src/index.js';
import {act,finish,pass,ready,until} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';
const rows=[
 ['c2-p02-r1c2-ab03','踏み込み／弓','extra'],['c2-p02-r2c2-ab04','破山剣','unlimited'],
 ['c2-p03-r1c1-ab04','踏み込み／斧','extra'],['c2-p03-r2c1-ab04','魔詩','unlimited'],
 ['c2-p04-r1c1-ab03','氷矢','extra'],['c2-p04-r1c2-ab04','歌う船','unlimited'],
 ['c2-p05-r1c2-ab04','グリフォン','unlimited'],['c2-p06-r1c1-ab04','スケルトン','unlimited'],
 ['c2-p06-r2c1-ab03','炎矢','extra'],['c2-p06-r2c2-ab03','狼牙','unlimited'],
] as const;
// Used only by parameterized tests so the evidence extractor can resolve every case.
const recoveryCases=[
 ['c2-p02-r1c2-ab03','踏み込み／弓','extra'],['c2-p02-r2c2-ab04','破山剣','unlimited'],
 ['c2-p03-r1c1-ab04','踏み込み／斧','extra'],['c2-p03-r2c1-ab04','魔詩','unlimited'],
 ['c2-p04-r1c1-ab03','氷矢','extra'],['c2-p04-r1c2-ab04','歌う船','unlimited'],
 ['c2-p05-r1c2-ab04','グリフォン','unlimited'],['c2-p06-r1c1-ab04','スケルトン','unlimited'],
 ['c2-p06-r2c1-ab03','炎矢','extra'],['c2-p06-r2c2-ab03','狼牙','unlimited'],
] as const;
function source(id:string,name:string,revealed=true){let s=ready();character(s,'A',getCharacter(id.split('-ab')[0]!)!.name);s.players.A!.revealed=revealed;for(const p of Object.values(s.players))p.permanent={warrior_level:20,magic_level:20,spirit:20,endurance:100};s.distances.A!.B='near';s.distances.B!.A='near';const card=handCard(s,'A',name);handCard(s,'B','命運凶変');const actual=name==='月の竪琴'?handCard(s,'A','魔詩'):card,t=techniqueFor(actual,getCharacter(s.players.A!.characterId)!.name,getAction(card)!.category==='follower')!,targets=t.mandatoryAll?legalAttackTargets(s,'A',t):['B'];s=until(act(s,'A',{type:'ATTACK',cardInstanceId:actual,targetIds:targets,dedicated:getAction(card)!.category==='follower',...(name==='月の竪琴'?{combinationCardInstanceIds:[card]}:{})}),'reclaim');return {s,card};}
it.each(recoveryCases)('%s offers only its complete printed recovery package',(id,name,right)=>{const {s}=source(id,name);expect(viewFor(s,'A').reclaim!.claims.map(c=>c.right)).toEqual(expect.arrayContaining([right]));});

function elect(s:GameState,right:string){const d=viewFor(s,'A').reclaim!,claim=d.claims.find(c=>c.right===right)!;expect(claim).toBeDefined();return act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:claim.claimId});}
it.each(recoveryCases)('%s declines without auto-recovery',(id,name)=>{let {s,card}=source(id,name);s=finish(pass(s));expect(discardIds(s)).toContain(card);expect(s.players.A!.hand).not.toContain(card);expect(s.players.A!.reclaimUsage).toBeUndefined();});
it.each(recoveryCases)('%s cancellation consumes its selected attempt without a physical clone',(id,name,right)=>{let {s,card}=source(id,name);s=elect(s,right);expect(s.resolution).toContain(card);expect(s.reclaimReservations).not.toContain(card);const f=Object.values(s.abilities!).find(a=>a.context.kind==='reclaim')!;expect(f.abilityId).toBe(id);s=pass(s);const fate=s.players.B!.hand.find(id=>getAction(id)!.name==='命運凶変')!;s=finish(act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:f.id}));expect(discardIds(s)).toContain(card);expect(s.players.A!.hand).not.toContain(card);expect(s.players.A!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);if(right==='extra')expect(s.players.A!.reclaimUsage?.[name]?.extraSpentByAbility).toEqual([id]);expect(s.reclaimDecisions!.find(d=>d.cardInstanceId===card)!.attemptedClaimIds).toHaveLength(1);});
it.each(recoveryCases)('%s saves and resumes one recovery declaration',(id,name,right)=>{let {s,card}=source(id,name);s=elect(s,right);const f=Object.values(s.abilities!).find(a=>a.context.kind==='reclaim')!;expect(f.context).toMatchObject({cardInstanceId:card,sourceCharacterId:id.split('-ab')[0]});expect(viewFor(s,'A').reclaim!.stage).toBe('ability-declaration');s=finish(s);expect(s.players.A!.hand.filter(x=>x===card)).toHaveLength(1);expect(discardIds(s)).not.toContain(card);expect(s.players.A!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);expect(Object.values(s.abilities!)).toEqual([]);});

it.each([
 ['c2-p03-r2c1-ab04','月の竪琴'],['c2-p03-r2c1-ab04','呪歌'],['c2-p04-r1c2-ab04','飛竜'],
 ['c2-p06-r1c1-ab04','ゾンビー'],['c2-p06-r1c1-ab04','ワイト'],['c2-p06-r1c1-ab04','デス・ナイト'],
 ['c2-p06-r2c2-ab03','妖獣'],['c2-p06-r2c2-ab03','餓狼'],
])('%s includes named member %s after its actual use',(id,name)=>{let {s,card}=source(id,name);s=finish(elect(s,'unlimited'));expect(s.players.A!.hand).toContain(card);});
it.each(recoveryCases)('%s excludes an unrelated physical name',(id)=>{const {s}=source(id,'衝破');expect(viewFor(s,'A').reclaim!.claims.filter(c=>c.right==='extra'||c.right==='unlimited')).toEqual([]);});
function nextOwn(s:GameState,keep:string){for(let n=0;n<4;n++){const actor=s.seatOrder[s.turnSeat]!;if(s.phase==='withdrawal')s=act(s,actor,{type:'PASS_WITHDRAWAL'});if(s.phase==='action')s=act(s,actor,{type:'PASS_ACTION'});s=finish(act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.filter(id=>id!==keep).slice(0,Math.max(0,s.players[actor]!.hand.length-gameStats(s,actor).handLimit))}));const next=s.seatOrder[s.turnSeat]!;s=act(s,next,{type:'START_TURN'});s=act(s,next,{type:'CHOOSE_DRAW',draw:false});}return s;}
it('S24 extra recovery permits base plus extra but never a third same-name return',()=>{let {s,card}=source(rows[0][0],rows[0][1]);s=finish(elect(s,'base'));s=nextOwn(s,card);s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'reclaim');expect(viewFor(s,'A').reclaim!.claims.map(c=>c.right)).toEqual(['extra']);s=finish(elect(s,'extra'));s=nextOwn(s,card);s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'reclaim');expect(viewFor(s,'A').reclaim!.claims).toEqual([]);s=finish(s);expect(discardIds(s)).toContain(card);});
it('S24 unlimited recovery leaves base slot intact and is finite per event',()=>{let {s,card}=source(rows[1][0],rows[1][1]);s=finish(elect(s,'unlimited'));s=nextOwn(s,card);s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'reclaim');expect(viewFor(s,'A').reclaim!.claims.map(c=>c.right)).toEqual(['base','unlimited']);s=finish(elect(s,'unlimited'));expect(s.players.A!.hand.filter(id=>id===card)).toHaveLength(1);expect(s.players.A!.reclaimUsage).toBeUndefined();});
it.each([rows[0],rows[1]])('Suppression blocks extra and unlimited but preserves budget and ordinary right: %s',(id,name)=>{let {s,card}=source(id,name);s.players.A!.statuses=[{id:'prior-ban',kind:'ability-disabled',modifiers:[0],nextCheck:0}];expect(viewFor(s,'A').reclaim!.claims.map(c=>c.right)).toEqual(['base']);s=finish(elect(s,'base'));expect(s.players.A!.hand).toContain(card);expect(s.players.A!.reclaimUsage?.[name]?.extraSpentByAbility).toEqual([]);});
it('Reveal requirement is checked at declaration and resolution without auto-reveal',()=>{let {s,card}=source(rows[1][0],rows[1][1]);s.players.A!.revealed=false;expect(viewFor(s,'A').reclaim!.claims.map(c=>c.right)).toEqual(['base']);s=act(s,'A',{type:'REVEAL_CHARACTER'});s=elect(s,'unlimited');s.players.A!.revealed=false;s=finish(s);expect(discardIds(s)).toContain(card);expect(s.players.A!.revealed).toBe(false);});
it('Ramba extra follower recovery needs an actual placed follower death, not its attack use',()=>{let s=ready();character(s,'A','小人のランバ');character(s,'B','侍大将のシン');s.players.A!.revealed=false;for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};s.distances.A!.B='near';s.distances.B!.A='near';const card=handCard(s,'A','小人族'),attack=handCard(s,'B','妖撃破山剣');s=act(s,'A',{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[card]});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(5)});s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});s=until(act(s,'B',{type:'ATTACK',cardInstanceId:attack,targetIds:['A'],dedicated:false}),'reclaim');expect(viewFor(s,'A').reclaim!.cardInstanceId).toBe(card);s=finish(elect(s,'extra'));expect(s.players.A!.hand).toContain(card);const used=source('c2-p03-r1c1-ab04','小人族');expect(viewFor(used.s,'A').reclaim!.claims).toEqual([]);});

it('Inherited protagonist survives actual Lancelot II transformation without resetting usage',()=>{let {s,card}=source(rows[1][0],rows[1][1]);s=finish(elect(s,'base'));character(s,'C','リーア姫');s=act(s,'C',{type:'REVEAL_CHARACTER'});s=finish(act(s,'A',{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'}));expect(s.players.A!.characterId).toBe('c2-p07-r1c1');expect(s.players.A!.abilityCharacterIds).toContain('c2-p02-r2c2');s=nextOwn(s,card);s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'reclaim');expect(viewFor(s,'A').reclaim!.claims.map(c=>c.right)).toEqual(['unlimited']);s=finish(elect(s,'unlimited'));expect(s.players.A!.reclaimUsage?.['破山剣']?.baseSpent).toBe(true);expect(s.players.A!.hand).toContain(card);});

it('named recovery excludes an actual All Army morale failure',()=>{let s=ready();character(s,'A','獣使いのウパニシャット');s.players.A!.revealed=true;s.players.A!.permanent={spirit:-20};handCard(s,'A','全軍突撃せよ');const follower=handCard(s,'A','グリフォン');s=act(s,'A',{type:'PLAY_ALL_ARMY',cardInstanceId:'a2-p05-r2c2',followerCardInstanceId:follower,targetIds:['B']});s=until(s,'reclaim');expect(viewFor(s,'A').reclaim!.cardInstanceId).toBe(follower);expect(viewFor(s,'A').reclaim!.claims).toEqual([]);expect(s.reclaimDecisions!.at(-1)!.source).toMatchObject({usedModeName:'failed-morale'});s=finish(s);expect(discardIds(s)).toContain(follower);});
it('a suppressed accepted extra declaration ends its one response without refunding its selected budget',()=>{let {s,card}=source(rows[0][0],rows[0][1]);s=elect(s,'extra');s.players.A!.statuses=[{id:'ban-after-accept',kind:'ability-disabled',modifiers:[0],nextCheck:0}];s=finish(s);expect(discardIds(s)).toContain(card);expect(s.players.A!.reclaimUsage?.[rows[0][1]]).toEqual({baseSpent:false,extraSpentByAbility:[rows[0][0]]});});
it('all-pass hidden extra and no-right worlds preserve the same public recovery envelope',()=>{let a=source(rows[0][0],rows[0][1]).s,b=source(rows[4][0],rows[0][1]).s;a.players.A!.revealed=false;b.players.A!.revealed=false;for(let n=0;n<4;n++){for(const actor of ['B','C','D'])expect(viewFor(a,actor)).toEqual(viewFor(b,actor));a=pass(a);b=pass(b);}expect(discardIds(a)).toEqual(discardIds(b));});

it.each([
 ['c2-p02-r2c2-ab04','破山剣'],['c2-p03-r2c1-ab04','魔詩'],
 ['c2-p04-r1c2-ab04','歌う船'],['c2-p05-r1c2-ab04','グリフォン'],
 ['c2-p06-r1c1-ab04','スケルトン'],['c2-p06-r2c2-ab03','狼牙'],
] as const)('%s requires actual reveal before unlimited recovery of %s',(id,name)=>{
 let {s,card}=source(id,name,false);
 expect(s.players.A!.revealed).toBe(false);
 expect(viewFor(s,'A').reclaim!.claims.some(c=>c.right==='unlimited')).toBe(false);
 const decisionId=viewFor(s,'A').reclaim!.decisionId;
 s=act(s,'A',{type:'REVEAL_CHARACTER'});
 expect(s.players.A!.revealed).toBe(true);
 expect(viewFor(s,'A').reclaim!.decisionId).toBe(decisionId);
 expect(viewFor(s,'A').reclaim!.claims.some(c=>c.right==='unlimited')).toBe(true);
 s=elect(s,'unlimited');
 expect(Object.values(s.abilities!).find(a=>a.context.kind==='reclaim')!.abilityId).toBe(id);
 s=finish(s);
 expect(s.players.A!.hand.filter(x=>x===card)).toHaveLength(1);
 expect(discardIds(s)).not.toContain(card);
 expect(s.players.A!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);
});

it.each([
 ['c2-p02-r2c2-ab04','破山剣'],['c2-p03-r2c1-ab04','魔詩'],
 ['c2-p04-r1c2-ab04','歌う船'],['c2-p05-r1c2-ab04','グリフォン'],
 ['c2-p06-r1c1-ab04','スケルトン'],['c2-p06-r2c2-ab03','狼牙'],
] as const)('%s cannot retry canceled unlimited recovery of %s in the same response',(id,name)=>{
 let {s,card}=source(id,name);
 const d=viewFor(s,'A').reclaim!,claim=d.claims.find(c=>c.right==='unlimited')!,windowId=s.windows!.at(-1)!.id;
 const take={type:'CHOOSE_RECLAIM' as const,decisionId:d.decisionId,choice:'take' as const,claimId:claim.claimId};
 s=act(s,'A',take);
 const frame=Object.values(s.abilities!).find(a=>a.context.kind==='reclaim')!;
 s=pass(s);
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:s.players.B!.hand.find(c=>getAction(c)!.name==='命運凶変')!,mode:'cancel-ability',targetAbilityId:frame.id});
 for(let n=0;n<300;n++){
  const decision=s.reclaimDecisions!.find(x=>x.id===d.decisionId)!;
  if(s.windows?.at(-1)?.id===windowId&&decision.stage==='responses'&&decision.cursor>0)break;
  s=pass(s);
 }
 s=JSON.parse(JSON.stringify(s));
 const decision=s.reclaimDecisions!.find(x=>x.id===d.decisionId)!;
 expect(s.windows!.at(-1)!.id).toBe(windowId);
 expect(decision.stage).toBe('responses');expect(decision.cursor).toBe(1);
 expect(decision.attemptedClaimIds).toEqual([claim.claimId]);expect(decision.resolvedClaimIds).toContain(claim.claimId);
 for(const actorId of ['A','B']){
  const before=JSON.stringify(s),views=s.seatOrder.map(p=>viewFor(s,p));
  expect(transition(s,{actorId,command:take},entropy()).ok).toBe(false);
  expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(p=>viewFor(s,p))).toEqual(views);
 }
 s=finish(s);
 expect(s.players.A!.hand).not.toContain(card);expect(discardIds(s).filter(x=>x===card)).toHaveLength(1);
 expect(s.reclaimDecisions!.find(x=>x.id===d.decisionId)!.attemptedClaimIds).toEqual([claim.claimId]);
 expect(s.players.A!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);
});

it.each([
 ['c2-p02-r2c2-ab04','破山剣'],['c2-p03-r2c1-ab04','魔詩'],
 ['c2-p04-r1c2-ab04','歌う船'],['c2-p05-r1c2-ab04','グリフォン'],
 ['c2-p06-r1c1-ab04','スケルトン'],['c2-p06-r2c2-ab03','狼牙'],
] as const)('%s does not reclaim voluntarily discarded %s as an actual use',(id,name)=>{
 let s=ready();character(s,'A',getCharacter(id.split('-ab')[0]!)!.name);s.players.A!.revealed=true;
 const card=handCard(s,'A',name),limit=gameStats(s,'A').handLimit;
 while(s.players.A!.hand.length<=limit)s.players.A!.hand.push(s.deck.shift()!);
 s=act(s,'A',{type:'PASS_ACTION'});
 const excess=s.players.A!.hand.length-limit;
 s=act(s,'A',{type:'END_TURN',discardIds:[card,...s.players.A!.hand.filter(c=>c!==card)].slice(0,excess)});
 for(let n=0;s.windows?.length&&n<150;n++){
  const d=viewFor(s,'A').reclaim;
  if(d?.cardInstanceId===card)expect(d.claims).toEqual([]);
  s=pass(JSON.parse(JSON.stringify(s)));
 }
 expect(s.windows??[]).toEqual([]);expect(discardIds(s).filter(c=>c===card)).toHaveLength(1);
 expect(s.players.A!.hand).not.toContain(card);expect(s.players.A!.reclaimUsage).toBeUndefined();
 expect(s.reclaimDecisions?.filter(d=>d.cardInstanceId===card&&d.source.kind==='ordinary-disposition')??[]).toEqual([]);
});

it.each([
 ['c2-p04-r1c2-ab04','歌う船'],['c2-p04-r1c2-ab04','飛竜'],
 ['c2-p05-r1c2-ab04','グリフォン'],
 ['c2-p06-r1c1-ab04','スケルトン'],['c2-p06-r1c1-ab04','ゾンビー'],['c2-p06-r1c1-ab04','ワイト'],['c2-p06-r1c1-ab04','デス・ナイト'],
] as const)('%s recovers actually placed and combat-killed %s once after the parent',(id,name)=>{
 let s=ready();character(s,'A',getCharacter(id.split('-ab')[0]!)!.name);character(s,'B','侍大将のシン');s.players.A!.revealed=true;
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,warrior_level:20};
 s.distances.A!.B='near';s.distances.B!.A='near';
 const card=handCard(s,'A',name),attack=handCard(s,'B','妖撃破山剣');
 const prayer=name==='飛竜'?handCard(s,'B','必勝の祈り'):undefined;
 s=act(s,'A',{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[card]});
 s=finish(act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(0,Math.max(0,s.players.A!.hand.length-gameStats(s,'A').handLimit))}));
 s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});
 s=act(s,'B',{type:'ATTACK',cardInstanceId:attack,targetIds:['A'],dedicated:false});
 if(prayer){
  s=until(s,'effect-level');while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);
  const action=Object.values(s.actions!).find(a=>a.cardInstanceId===attack)!;
  s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:action.id});
 }
 for(let n=0;viewFor(s,'A').reclaim?.cardInstanceId!==card&&n<300;n++)s=pass(s);
 const d=viewFor(s,'A').reclaim!;
 expect(d.cardInstanceId).toBe(card);expect(s.players.A!.followers).toEqual([]);
 expect(s.reclaimDecisions!.find(x=>x.id===d.decisionId)!.source).toMatchObject({sourceActorId:'A',trigger:'follower-died'});
 expect(d.claims.map(c=>c.right)).toContain('unlimited');
 s=elect(JSON.parse(JSON.stringify(s)),'unlimited');
 for(let n=0;!s.reclaimReservations.includes(card)&&n<150;n++)s=pass(JSON.parse(JSON.stringify(s)));
 expect(s.reclaimReservations).toContain(card);expect(s.players.A!.hand).not.toContain(card);expect(discardIds(s)).not.toContain(card);
 s=finish(JSON.parse(JSON.stringify(s)));
 expect(s.players.A!.hand.filter(c=>c===card)).toHaveLength(1);expect(discardIds(s)).not.toContain(card);expect(s.players.A!.followers).toEqual([]);
 expect(s.players.A!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);
});
