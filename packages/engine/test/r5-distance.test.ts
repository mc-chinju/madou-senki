import {expect,it} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,closeWindow,finish,pass,ready,until,readySetup} from './combat-helpers.js';
import {character,entropy,handCard,handCards,freshGame} from './fixtures.js';
import {getAction} from '@madou/catalog';
const FLIGHT='c2-p02-r1c1-ab01';
function distanceSetup(owner:string,withdraw=false){let s=ready();character(s,withdraw?'A':'B',owner);for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};const advances=handCards(s,withdraw?['B','B','B']:['A','A','A'],'踏み込み／蹴る'),maai=handCard(s,withdraw?'A':'B','間合い／休息');handCard(s,'C','命運凶変');if(withdraw){s.distances.A!.B=s.distances.B!.A='near';const bow=handCard(s,'A','踏み込み／弓');s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:bow,targetIds:['B'],dedicated:false}));}return {s,maai,advances};}
it.each([['小妖精のチャム','c2-p01-r2c2-ab01'],['有翼人のティア',FLIGHT]] as const)('%s elected approach response needs two additional advances', (owner,abilityId)=>{
 for(const count of [1,2]){let {s,maai,advances}=distanceSetup(owner);s=act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:advances[0]});s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai,abilityId});s=closeWindow(s);s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advances[1]});expect(s.windows!.at(-1)!.participants).toEqual(['A']);if(count===2)s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advances[2]});s=finish(s);expect(s.distances.A!.B).toBe(count===2?'near':'far');expect(s.phase).toBe('action');}
});
it.each([['小妖精のチャム','c2-p01-r2c2-ab01'],['有翼人のティア',FLIGHT]] as const)('%s can attach its optional maai to initial withdrawal', (owner,abilityId)=>{
 for(const count of [1,2]){let {s,maai,advances}=distanceSetup(owner,true);s=act(s,'A',{type:'WITHDRAW',targetId:'B',cardInstanceId:maai,abilityId});s=closeWindow(s);s=act(s,'B',{type:'PLAY_ADVANCE',cardInstanceId:advances[0]});expect(s.windows!.at(-1)!.participants).toEqual(['B']);if(count===2)s=act(s,'B',{type:'PLAY_ADVANCE',cardInstanceId:advances[1]});s=finish(s);expect(s.distances.A!.B).toBe(count===1?'far':'near');}
});
it.each([false,true])('Distance withdrawal=%s declines or cancels the election without refunding maai',withdraw=>{
 for(const cancel of [false,true]){let {s,maai,advances}=distanceSetup('有翼人のティア',withdraw);const owner=withdraw?'A':'B',other=withdraw?'B':'A',kind=withdraw?'withdrawal':'approach';
  if(!withdraw)s=act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:advances.shift()});
  for(const actor of s.seatOrder.filter(id=>id!==owner))expect(viewFor(s,actor).maaiAbilityOptions).toEqual([]);
  s=act(s,owner,{type:withdraw?'WITHDRAW':'PLAY_MAAI',...(withdraw?{targetId:'B'}:{}),cardInstanceId:maai,...(cancel?{abilityId:FLIGHT}:{})});
  if(cancel){while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='C')s=pass(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(s,'C').reactionTargetAbilityId!});s=until(s,kind);}
  s=act(s,other,{type:'PLAY_ADVANCE',cardInstanceId:advances[0]});expect(viewFor(s,owner).distanceExchange).toMatchObject({requiredAdvances:1,paidAdvances:1,responseComplete:true});expect(s.windows!.at(-1)!.participants).toEqual([owner]);
  s=finish(s);expect(s.distances.A!.B).toBe('near');expect(s.discard.filter(id=>id===maai)).toHaveLength(1);expect(s.players[other]!.hand).toContain(advances[1]);
 }
});
it.each([false,true])('Distance withdrawal=%s actual ban after first advance immediately returns the response',withdraw=>{
 let {s,maai,advances}=distanceSetup('有翼人のティア',withdraw);const owner=withdraw?'A':'B',other=withdraw?'B':'A',kind=withdraw?'withdrawal':'approach';character(s,other,'破壊神ヴァンミール');s.players[other]!.revealed=true;
 if(!withdraw)s=act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:advances.shift()});
 s=until(act(s,owner,{type:withdraw?'WITHDRAW':'PLAY_MAAI',...(withdraw?{targetId:'B'}:{}),cardInstanceId:maai,abilityId:FLIGHT}),kind);
 s=act(s,other,{type:'PLAY_ADVANCE',cardInstanceId:advances[0]});expect(viewFor(s,other).distanceExchange).toMatchObject({requiredAdvances:2,paidAdvances:1,responseComplete:false});
 const ban='c2-p07-r1c2-ab03',option=viewFor(s,other).abilityOptions.find(o=>o.abilityId===ban)!;expect(option).toBeDefined();s=until(act(s,other,{type:'USE_ABILITY',abilityId:ban,targetEventId:option.targetEventId,targetIds:[owner]}),kind);
 expect(s.windows!.at(-1)!.participants).toEqual([owner]);expect(viewFor(s,other).distanceExchange).toMatchObject({requiredAdvances:1,paidAdvances:1,responseComplete:true});
 const before=JSON.stringify(s);expect(transition(s,{actorId:other,command:{type:'PLAY_ADVANCE',cardInstanceId:advances[1]!}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
 s=finish(s);expect(s.distances.A!.B).toBe('near');expect(s.players[other]!.hand).toContain(advances[1]);for(const id of [maai,...(withdraw?[advances[0]]:[])])expect(s.discard.filter(x=>x===id)).toHaveLength(1);if(!withdraw)expect(Object.values(s.distanceMarkers!)[0]!.cardInstanceId).toBe(advances[0]);
});
it('Repeated withdrawal maai starts a fresh two-advance response after actual paid history',()=>{
 let {s,advances}=distanceSetup('有翼人のティア',true);const maais=handCards(s,['A','A'],'間合い／休息'),fourth=handCard(s,'B','踏み込み／殴る');
 s=until(act(s,'A',{type:'WITHDRAW',targetId:'B',cardInstanceId:maais[0],abilityId:FLIGHT}),'withdrawal');for(const id of advances.slice(0,2))s=act(s,'B',{type:'PLAY_ADVANCE',cardInstanceId:id});
 s=act(s,'A',{type:'PLAY_MAAI',cardInstanceId:maais[1]});expect(viewFor(s,'B').distanceExchange).toMatchObject({requiredAdvances:2,paidAdvances:0,responseComplete:false});
 s=act(s,'B',{type:'PLAY_ADVANCE',cardInstanceId:advances[2]});expect(s.windows!.at(-1)!.participants).toEqual(['B']);s=act(s,'B',{type:'PLAY_ADVANCE',cardInstanceId:fourth});expect(s.windows!.at(-1)!.participants).toEqual(['A']);s=finish(s);expect(s.distances.A!.B).toBe('near');for(const id of [...maais,...advances,fourth])expect(s.discard.filter(x=>x===id)).toHaveLength(1);
});
function incoming(name='地槍',withBan=false){
 let s=ready();character(s,'B','有翼人のティア');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 if(withBan){character(s,'C','破壊神ヴァンミール');s.players.C!.revealed=true;}
 const card=handCard(s,'A',name);handCard(s,'C','命運凶変');s.distances.A!.B=s.distances.B!.A='near';
 return until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'normal-defense');
}
function use(s:GameState){const o=viewFor(s,'B').abilityOptions.find(o=>o.abilityId===FLIGHT);expect(o).toBeDefined();return act(s,'B',{type:'USE_ABILITY',abilityId:FLIGHT,targetEventId:o!.targetEventId});}
it.each(['select','decline','cancel'] as const)('Tia actual earth magic flight choice %s is saved and does not leak the unused source',choice=>{
 let s=incoming();const base=viewFor(s,'B').currentAttack!.technique.damage!;
 expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===FLIGHT)).toBe(true);
 for(const actor of ['A','C','D'])expect(JSON.stringify(viewFor(s,actor))).not.toContain(FLIGHT);
 if(choice!=='decline'){
  s=use(s);if(choice==='cancel'){const targetAbilityId=viewFor(s,'C').reactionTargetAbilityId!;s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId});s=closeWindow(s);}
  s=closeWindow(s);
  if(choice==='cancel')s=until(s,'normal-defense');
  if(choice==='select'){expect(s.groups).toEqual({});}
  else{expect(s.windows!.at(-1)!.kind).toBe('normal-defense');expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===FLIGHT)).toBe(false);}
 }
 s=finish(s);expect(s.players.B!.damage).toBe(choice==='select'?0:base);
});

function maaiIncoming(owner:string,withBan=false){let s=ready();character(s,'B',owner);if(withBan){character(s,'A','破壊神ヴァンミール');s.players.A!.revealed=true;}for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};const source=handCard(s,'A','踏み込み／弓'),maai=handCard(s,'B','間合い／休息'),advances=handCards(s,['A','A'],'踏み込み／蹴る');handCard(s,'C','命運凶変');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B'],dedicated:false}),'normal-defense');return {s,maai,advances};}
it.each([['小妖精のチャム','c2-p01-r2c2-ab01'],['有翼人のティア','c2-p02-r1c1-ab01']] as const)('%s elected maai survives one advance and fails after exactly two', (owner,abilityId)=>{
 for(const count of [1,2]){let {s,maai,advances}=maaiIncoming(owner);const distances=structuredClone(s.distances);s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai,abilityId});s=until(s,'defense-advance');const group=Object.values(s.groups!)[0]!.id;
  s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advances[0]});s=until(s,'defense-advance');expect(s.groups![group]!.maai!.advances).toEqual([advances[0]]);
  if(count===2)s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advances[1]});s=finish(s);expect(s.players.B!.damage).toBe(count===1?0:4);expect(s.distances).toEqual(distances);
 }
});
it.each(['小妖精のチャム','早駆けのランカスター'])('Declined maai ability on %s leaves one ordinary maai canceled by one advance',owner=>{let {s,maai,advances}=maaiIncoming(owner);s=until(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai}),'defense-advance');s=finish(act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advances[0]}));expect(s.players.B!.damage).toBe(4);});
it('Lancaster can elect uncancelable maai only against an actual returned counter to his attack',()=>{
 let s=ready();character(s,'A','早駆けのランカスター');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};s.distances.A!.B=s.distances.B!.A='near';const bow=handCard(s,'A','踏み込み／弓'),counter=handCard(s,'B','妖撃破山剣'),maai=handCard(s,'A','間合い／休息');
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:bow,targetIds:['B'],dedicated:false}),'normal-defense');s=until(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false}),'normal-defense');expect(viewFor(s,'A').currentAttack!.attackerId).toBe('B');expect(viewFor(s,'A').maaiAbilityOptions.map(o=>o.abilityId)).toEqual(['c2-p02-r2c1-ab03']);
 s=act(s,'A',{type:'PLAY_MAAI',cardInstanceId:maai,abilityId:'c2-p02-r2c1-ab03'});s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);
 const ordinary=maaiIncoming('早駆けのランカスター');expect(viewFor(ordinary.s,'B').maaiAbilityOptions).toEqual([]);const before=JSON.stringify(ordinary.s);expect(transition(ordinary.s,{actorId:'B',command:{type:'PLAY_MAAI',cardInstanceId:ordinary.maai,abilityId:'c2-p02-r2c1-ab03'}},entropy()).ok).toBe(false);expect(JSON.stringify(ordinary.s)).toBe(before);
});
it('Maai rejects foreign source and foreign actor before physical payment',()=>{
 const {s,maai}=maaiIncoming('有翼人のティア');for(const [actorId,abilityId] of [['B','c2-p01-r2c2-ab01'],['A',FLIGHT]] as const){const before=JSON.stringify(s);expect(transition(s,{actorId:actorId!,command:{type:'PLAY_MAAI',cardInstanceId:maai,abilityId}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
});
it('Paid maai retains original owner life across a structural later-life boundary',()=>{
 let {s,maai}=maaiIncoming('有翼人のティア');const life=s.players.B!.lifeId??'initial-life:B';s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai,abilityId:FLIGHT});s.players.B!.lifeId='structural-new-life';s=until(s,'reclaim');expect(s.reclaimDecisions!.at(-1)!.source).toMatchObject({cardInstanceId:maai,sourceLifeId:life});expect(Object.values(s.groups!)[0]!.targets[0]!.hits[0]!.maaiElection).toBeUndefined();s=finish(s);expect(s.discard.filter(id=>id===maai)).toHaveLength(1);
});
it('Canceled maai ability retains the physical payment and needs only one advance',()=>{
 let {s,maai,advances}=maaiIncoming('小妖精のチャム');s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai,abilityId:'c2-p01-r2c2-ab01'});expect(s.resolution).toContain(maai);
 s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:viewFor(s,'C').reactionTargetAbilityId!});s=until(s,'defense-advance');expect(s.discard).toContain(maai);s=finish(act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advances[0]}));expect(s.players.B!.damage).toBe(4);expect(s.discard.filter(id=>id===maai)).toHaveLength(1);
});
it('Actual suppression after the first paid advance lowers the live threshold without refund or second payment',()=>{
 let {s,maai,advances}=maaiIncoming('有翼人のティア',true);s=until(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai,abilityId:FLIGHT}),'defense-advance');s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advances[0]});
 s=until(s,'defense-advance');
 const ban='c2-p07-r1c2-ab03',o=viewFor(s,'A').abilityOptions.find(o=>o.abilityId===ban)!;expect(o).toBeDefined();s=act(s,'A',{type:'USE_ABILITY',abilityId:ban,targetEventId:o.targetEventId,targetIds:['B']});s=finish(s);
 expect(s.players.B!.damage).toBe(4);expect(s.discard).toEqual(expect.arrayContaining([maai,advances[0]]));expect(s.players.A!.hand).toContain(advances[1]);
});
it.each([1,2])('Unequal target elections share exactly %s actual advances',count=>{
 let s=ready();character(s,'A','小人のランバ');character(s,'B','小妖精のチャム');character(s,'C','有翼人のティア');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 const source=handCard(s,'A','地槍'),maais=handCards(s,['B','C'],'間合い／休息'),advances=handCards(s,['A','A'],'踏み込み／蹴る'),distances=structuredClone(s.distances);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B','C'],dedicated:true}),'normal-defense');s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maais[0],abilityId:'c2-p01-r2c2-ab01'});s=until(s,'normal-defense');expect(viewFor(s,'C').activeWindow!.pendingActorId).toBe('C');s=until(act(s,'C',{type:'PLAY_MAAI',cardInstanceId:maais[1]}),'defense-advance');
 s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advances[0]});s=until(s,'defense-advance');expect(viewFor(s,'A').maaiDefense!.targets.map(t=>t.effective)).toEqual([1,0]);if(count===2)s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advances[1]});s=finish(s);
 expect([s.players.B!.damage,s.players.C!.damage]).toEqual([count===1?0:9,9]);expect(s.distances).toEqual(distances);for(const id of advances.slice(0,count))expect(s.discard.filter(x=>x===id)).toHaveLength(1);
});
it('The next actual Griffin hit starts with fresh maai election and advance history',()=>{
 let s=ready();character(s,'A','獣使いのウパニシャット');character(s,'B','小妖精のチャム');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};const source=handCard(s,'A','グリフォン'),maais=handCards(s,['B','B'],'間合い／休息'),advances=handCards(s,['A','A'],'踏み込み／蹴る');
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B'],dedicated:true}),'normal-defense');s=until(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maais[0],abilityId:'c2-p01-r2c2-ab01'}),'defense-advance');s=until(act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advances[0]}),'defense-advance');s=pass(s);expect(viewFor(s,'B').currentAttack!.hitIndex).toBe(1);expect(viewFor(s,'B').maaiAbilityOptions).toHaveLength(1);expect(viewFor(s,'B').maaiDefense!.sharedAdvances).toBe(0);
 s=until(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maais[1]}),'defense-advance');s=finish(act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advances[1]}));expect(s.players.B!.damage).toBe(8);
});
it('Actual chanted Shin simultaneous hits reset both target exchange and elected ability',()=>{
 let s=ready();character(s,'A','侍大将のシン');character(s,'B','小妖精のチャム');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 const source=handCard(s,'A','天地百撃斬'),maai=handCard(s,'B','間合い／休息'),advance=handCard(s,'A','踏み込み／蹴る');
 for(const p of Object.values(s.players))while(p.hand.length<5){const i=s.deck.findIndex(id=>getAction(id)!.category!=='open');p.hand.push(s.deck.splice(i,1)[0]!);}
 s=act(s,'A',{type:'CHANT',cardInstanceId:source});
 for(const actor of ['A','B','C','D']){if(actor!=='A'){s=act(s,actor,{type:'START_TURN'});s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});s=act(s,actor,{type:'PASS_ACTION'});}s=finish(act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.filter(id=>id!==maai&&id!==advance).slice(0,Math.max(0,s.players[actor]!.hand.length-5))}));}
 s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});s=until(act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B','C'],dedicated:true}),'damage');s=closeWindow(s,[3]);s=until(s,'normal-defense');
 const damage=viewFor(s,'B').currentAttack!.technique.damage!;
 s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai,abilityId:'c2-p01-r2c2-ab01'});s=until(s,'normal-defense');s=pass(s);s=until(act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advance}),'defense-advance');s=pass(s);
 expect(viewFor(s,'B').currentAttack!.hitIndex).toBe(1);expect(viewFor(s,'B').maaiAbilityOptions).toHaveLength(1);expect(viewFor(s,'B').maaiDefense).toMatchObject({sharedAdvances:0,targets:[{submitted:0,effective:0,advanceFactor:1},{submitted:0,effective:0,advanceFactor:1}]});
 s=finish(s);expect([s.players.B!.damage,s.players.C!.damage]).toEqual([damage*2,damage*3]);
});
it('Tia earth immunity rejects stale hit and a foreign actor without paying or rolling',()=>{
 const s=incoming(),event=viewFor(s,'B').abilityOptions.find(o=>o.abilityId===FLIGHT)?.targetEventId;expect(event).toBeDefined();
 for(const [actorId,targetEventId] of [['A',event!],['B','stale-hit']]){const before=JSON.stringify(s);expect(transition(s,{actorId:actorId!,command:{type:'USE_ABILITY',abilityId:FLIGHT,targetEventId:targetEventId!}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
});
it('Tia flight does not offer earth immunity for a real ordinary warrior attack',()=>{
 let s=incoming('黒翼飛翔剣');expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===FLIGHT)).toBe(false);s=finish(s);expect(s.players.B!.damage).toBe(7);
});

it('Tia earth predicate excludes a structural warrior-earth source',()=>{const s=incoming();const g=Object.values(s.groups!)[0]!;g.technique.school='warrior';g.technique.attributes=['戦','地'];expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===FLIGHT)).toBe(false);});

it('Tia flight defeats real earth magic before an actually placed follower is exposed',()=>{
 let s=freshGame();character(s,'A','魔導王ガイナス');character(s,'B','有翼人のティア');for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};
 const card=handCard(s,'A','地槍'),soldier=handCard(s,'B','兵士');
 for(const actor of s.seatOrder){if(actor==='B')s=act(s,actor,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:soldier});s=act(s,actor,{type:'PASS_SETUP'});}s=readySetup(s);
 s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'normal-defense');
 const followers=structuredClone(s.players.B!.followers);expect(followers).toHaveLength(1);s=finish(use(s));expect(s.players.B!.followers).toEqual(followers);expect(s.players.B!.damage).toBe(0);expect(s.discard).not.toContain(soldier);
});

it('Tia flight protects only her target in a real dedicated multi-target earth attack',()=>{
 let s=ready();character(s,'A','小人のランバ');character(s,'B','有翼人のティア');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};const card=handCard(s,'A','地槍');
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B','C'],dedicated:true}),'normal-defense');s=finish(use(s));expect([s.players.B!.damage,s.players.C!.damage]).toEqual([0,9]);
});
it('A real Vanmil ban during the pending flight declaration keeps the original earth hit live',()=>{
 let s=use(incoming('地槍',true));const ban='c2-p07-r1c2-ab03',option=viewFor(s,'C').abilityOptions.find(o=>o.abilityId===ban)!;expect(option).toBeDefined();
 s=act(s,'C',{type:'USE_ABILITY',abilityId:ban,targetEventId:option.targetEventId,targetIds:['B']});s=closeWindow(s);s=until(s,'normal-defense');expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===FLIGHT)).toBe(false);s=finish(s);expect(s.players.B!.damage).toBe(6);
});

it.each([false,true])('Lancaster returned counter elected=%s controls real advance opportunity and payment',elected=>{
 let s=ready();character(s,'A','早駆けのランカスター');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};s.distances.A!.B=s.distances.B!.A='near';
 const bow=handCard(s,'A','踏み込み／弓'),counter=handCard(s,'B','妖撃破山剣'),maai=handCard(s,'A','間合い／休息'),advances=handCards(s,['B','B'],'踏み込み／蹴る');
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:bow,targetIds:['B'],dedicated:false}),'normal-defense');s=until(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false}),'normal-defense');
 expect(viewFor(s,'A').currentAttack!.attackerId).toBe('B');const damage=viewFor(s,'A').currentAttack!.technique.damage!;expect(damage).toBeGreaterThan(0);
 s=act(s,'A',{type:'PLAY_MAAI',cardInstanceId:maai,...(elected?{abilityId:'c2-p02-r2c1-ab03'}:{})});
 let advanceWindows=0;
 for(let n=0;s.windows?.length&&n<300;n++){
  if(s.windows.at(-1)!.kind==='defense-advance'){advanceWindows++;expect(elected).toBe(false);s=act(s,'B',{type:'PLAY_ADVANCE',cardInstanceId:advances[0]!});}
  else {if(elected){const before=JSON.stringify(s);expect(transition(s,{actorId:'B',command:{type:'PLAY_ADVANCE',cardInstanceId:advances[0]!}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}s=pass(s);}
 }
 expect(s.windows??[]).toHaveLength(0);expect(advanceWindows).toBe(elected?0:1);expect(s.players.A!.damage).toBe(elected?0:damage);expect(s.players.B!.damage).toBe(0);
 expect(s.discard.filter(id=>id===maai)).toHaveLength(1);expect(s.players.B!.hand).toContain(advances[1]!);expect(s.players.B!.hand.includes(advances[0]!)).toBe(elected);
});
