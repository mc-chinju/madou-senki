import {expect,it} from 'vitest';
import {gameStats,transition,viewFor,type GameState} from '../src/index.js';
import {act,pass,closeWindow} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {makeSkyWingPhysical,skyWingCard as CARD,skyWingMode} from './fixtures/sky-wing-physical-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id})),costs=['a2-p24-r1c3','a2-p24-r2c1'];
function until(s:GameState,done:(s:GameState)=>boolean){for(let n=0;n<500;n++){if(done(s))return s;s=pass(s);}throw Error('SKY_WING_LIMIT');}
function settle(s:GameState){return until(s,s=>!s.windows?.length);}
function cmd(dedicated=false,targetIds=['B']){return {type:'ATTACK',cardInstanceId:CARD,targetIds,dedicated};}
function reject(s:GameState,id:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId:id,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
function chant(s:GameState){s=act(s,'A',{type:'CHANT',cardInstanceId:CARD,dedicated:false});expect(s.players.A!.chants.map(c=>c.cardInstanceId)).toContain(CARD);reject(s,'A',cmd(false));reject(s,'A',cmd(true));for(let n=0;n<300;n++){const id=s.seatOrder[s.turnSeat]!,w=s.windows?.at(-1);if(w){s=pass(s,[6,6]);continue;}if(s.phase==='action'&&id==='A')return s;if(s.phase==='action')s=act(s,id,{type:'PASS_ACTION'});else if(s.phase==='withdrawal')s=act(s,id,{type:'PASS_WITHDRAWAL'});else if(s.phase==='hand-adjustment')s=act(s,id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>!costs.includes(x)&&x!=='a2-p04-r2c3').slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});else if(s.phase==='turn-start')s=act(s,id,{type:'START_TURN'});else if(s.phase==='draw')s=act(s,id,{type:'CHOOSE_DRAW',draw:false});else throw Error(`SKY_WING_PHASE_${s.phase}`);}throw Error('SKY_WING_TURN_LIMIT');}
it('actual hit advance payment reopens every active seat before damage is applied',()=>{
 let s=chant(makeSkyWingPhysical('sky-wing-post-one',players));
 s=until(act(s,'A',cmd(true)),s=>s.windows?.at(-1)?.kind==='hit-advance-choice');
 const groupId=s.windows!.at(-1)!.continuation.id;
 s=act(s,'A',{type:'PAY_HIT_ADVANCES',groupId,cardInstanceIds:[costs[0]!]});
 s=until(s,s=>s.windows?.at(-1)?.kind==='hit');
 const windowId=s.windows!.at(-1)!.id;
 expect(s.windows!.at(-1)!.participants).toEqual(['A','B','C','D']);
 for(const actor of ['A','B','C','D']){
  const window=s.windows!.at(-1)!;
  expect(window.id).toBe(windowId);expect(window.participants[window.cursor]).toBe(actor);
  expect(s.players.B!.damage).toBe(0);
  reject(s,'A',{type:'PAY_HIT_ADVANCES',groupId,cardInstanceIds:[]});
  s=pass(s);
 }
 s=settle(s);expect(s.players.B!.damage).toBe(20);
 expect(s.discard.filter(id=>id===costs[0])).toHaveLength(1);
});

it('structural pending target and hit inputs share one advance payment without altering defended or finalized damage',()=>{
 let s=chant(makeSkyWingPhysical('sky-wing-post-one',players));
 s=until(act(s,'A',cmd(true)),s=>s.windows?.at(-1)?.kind==='hit-advance-choice');
 const groupId=s.windows!.at(-1)!.continuation.id,g=s.groups![groupId]!,template=structuredClone(g.targets[0]!);
 // Explicit resolver inputs: these extra targets/hits are not claimed as a physical producer.
 const hit=structuredClone(template.hits[0]!);
 g.targets[0]!.hits=[{...hit,damage:30,damageMultiplier:2},{...hit,index:1,damage:15},{...hit,index:2,damage:15,defended:true}];
 g.targets.push({...structuredClone(template),actorId:'C',hits:[{...hit,damage:45,damageMultiplier:3}]});
 g.targets.push({...structuredClone(template),actorId:'D',hitsApplied:true,pendingDamage:15,hits:[{...hit,damage:15,hit:true}]});
 s=act(JSON.parse(JSON.stringify(s)),'A',{type:'PAY_HIT_ADVANCES',groupId,cardInstanceIds:[costs[0]!]});
 expect(s.groups![groupId]!.targets.map(t=>t.hits.map(h=>h.damage))).toEqual([[40,20,15],[60],[15]]);
 expect(s.groups![groupId]!.targets[2]!.pendingDamage).toBe(15);
 expect(s.groups![groupId]).toMatchObject({postHitAdvancePaid:true,postHitAdvanceAmount:5});
 reject(s,'A',{type:'PAY_HIT_ADVANCES',groupId,cardInstanceIds:[costs[1]!]});
 expect(s.players.A!.hand).toContain(costs[1]);
});
it.each(['sky-wing-ordinary','sky-wing-guard','sky-wing-owner-ordinary','sky-wing-dedicated','sky-wing-near','sky-wing-suppressed','sky-wing-silenced'] as const)('%s actual CHANT and intervening turns retain mandatory preparation then ordinary7 twelve versus elected Arness8 fifteen',name=>{
 let s=makeSkyWingPhysical(name,players);const m=skyWingMode(name),damage=m.dedicated?15:12;reject(s,'A',cmd(false));reject(s,'A',cmd(m.dedicated));s=chant(s);if(name==='sky-wing-near'){s=settle(act(s,'A',{type:'APPROACH',cardInstanceId:costs[0]!,targetId:'B'}));expect(s.distances.A!.B).toBe('near');}if(name==='sky-wing-suppressed')expect(s.players.A!.statuses?.some(x=>x.kind==='ability-disabled')).toBe(true);if(name==='sky-wing-silenced')expect(s.players.A!.statuses?.some(x=>x.kind==='silenced')).toBe(true);
 const hand=[...s.players.A!.hand],deck=[...s.deck],followers=structuredClone(s.players.B!.followers),rolls=s.rolls?.length??0;reject(s,'A',cmd(m.dedicated,['B','C']));s=act(s,'A',cmd(m.dedicated));expect(s.players.A!.hand).toEqual(hand);expect(s.players.A!.chants).toEqual([]);expect(s.deck).toEqual(deck);expect(s.resolution).toContain(CARD);s=until(s,s=>s.windows?.at(-1)?.kind==='attack-abilities');const g=Object.values(s.groups!).at(-1)!;expect(g.technique).toMatchObject({school:'warrior',range:'far',useLevel:7,effectLevel:m.dedicated?8:7,damage,attributes:['戦','剣','詠'],chant:true,noChecks:m.dedicated,followerIgnore:m.dedicated,maaiRequired:2,target:'one'});expect(g.targets.map(t=>t.actorId)).toEqual(['B']);expect(g.targets[0]!.hits.map(h=>h.damage)).toEqual([damage]);s=settle(s);
 expect(s.players.B!.damage).toBe(m.guard&&!m.dedicated?7:damage);expect(s.players.C!.damage).toBe(0);if(m.dedicated){expect(s.players.B!.followers).toEqual(followers);expect(s.players.B!.followers[0]!.revealed).toBe(false);}else if(m.guard){expect(s.players.B!.followers).toEqual([]);expect(s.discard).toContain('a2-p22-r1c1');}expect(s.discard.filter(id=>id===CARD)).toHaveLength(1);expect(s.players.A!.hand).toEqual(hand);expect(s.rolls?.length??0).toBe(rolls);expect(s.phase).toBe('withdrawal');
});
it.each([[3,3,true],[3,4,false]] as const)('ordinary warrior6 after real CHANT needs one spirit6 check roll%s plus%s success%s',(x,y,success)=>{let s=chant(makeSkyWingPhysical('sky-wing-low',players));s=act(s,'A',cmd());s=until(s,s=>s.windows?.at(-1)?.kind==='before-roll');s=closeWindow(s,[x,y]);expect(s.rolls!.at(-1)).toMatchObject({purpose:'excess-level',threshold:6,total:x+y,success});s=settle(s);expect(s.players.B!.damage).toBe(success?12:0);expect(s.rolls!.filter(r=>r.purpose==='excess-level')).toHaveLength(1);expect(s.discard).toContain(CARD);});
it('dedicated actual Arness warrior0 spirit0 still CHANTs and waits full turn order but skips all seven use checks',()=>{let s=makeSkyWingPhysical('sky-wing-dedicated',players,{warrior:0,spirit:0});reject(s,'A',cmd(true));s=chant(s);expect(gameStats(s,'A').warrior_level).toBe(0);expect(gameStats(s,'A').spirit).toBe(0);s=settle(act(s,'A',cmd(true)));expect(s.rolls?.length??0).toBe(0);expect(s.players.B!.damage).toBe(15);});
it.each([0,1,2])('actual post-hit optional batch of%s physical advances adds five each exactly once without refill or source return',count=>{
 let s=chant(makeSkyWingPhysical('sky-wing-post-two',players));reject(s,'A',{type:'PAY_HIT_ADVANCES',groupId:'missing',cardInstanceIds:costs});s=act(s,'A',cmd(true));s=until(s,s=>s.windows?.at(-1)?.kind==='hit-advance-choice');const id=s.windows!.at(-1)!.continuation.id,hand=[...s.players.A!.hand],deck=[...s.deck],selected=costs.slice(0,count);expect(s.players.B!.damage).toBe(0);expect(viewFor(s,'A').techniqueDecision).toMatchObject({kind:'hit-advance',groupId:id,cardInstanceIds:expect.arrayContaining(costs)});for(const list of [[costs[0],costs[0]],['a2-p04-r2c3'],['a2-p02-r2c3'],['missing']])reject(s,'A',{type:'PAY_HIT_ADVANCES',groupId:id,cardInstanceIds:list});reject(s,'B',{type:'PAY_HIT_ADVANCES',groupId:id,cardInstanceIds:[]});reject(s,'A',{type:'PAY_HIT_ADVANCES',groupId:'wrong',cardInstanceIds:[]});
 s=act(s,'A',{type:'PAY_HIT_ADVANCES',groupId:id,cardInstanceIds:selected});expect(s.players.A!.hand).toEqual(hand.filter(id=>!selected.includes(id)));expect(s.deck).toEqual(deck);reject(s,'A',{type:'PAY_HIT_ADVANCES',groupId:id,cardInstanceIds:[]});s=settle(s);expect(s.players.B!.damage).toBe(15+5*count);for(const cost of costs){expect(s.players.A!.hand.includes(cost)).toBe(!selected.includes(cost));expect(s.discard.filter(id=>id===cost)).toHaveLength(selected.includes(cost)?1:0);}expect(s.discard.filter(id=>id===CARD)).toHaveLength(1);expect(s.players.B!.followers[0]!.revealed).toBe(false);
});
it('actual defense advance payment cancels MAAI but cannot pay the later hit bonus again and a separate physical card adds only five',()=>{
 let s=chant(makeSkyWingPhysical('sky-wing-defense-advance',players));s=until(act(s,'A',cmd(true)),s=>s.windows?.at(-1)?.kind==='normal-defense');s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p06-r1c3'});s=until(s,s=>s.windows?.at(-1)?.kind!=='reclaim');s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'});s=until(s,s=>s.windows?.at(-1)?.kind==='defense-advance');s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:costs[0]!});s=until(s,s=>s.windows?.at(-1)?.kind==='hit-advance-choice');const id=s.windows!.at(-1)!.continuation.id;expect(viewFor(s,'A').techniqueDecision!.kind).toBe('hit-advance');expect(s.players.A!.hand).not.toContain(costs[0]);reject(s,'A',{type:'PAY_HIT_ADVANCES',groupId:id,cardInstanceIds:[costs[0]]});s=settle(act(s,'A',{type:'PAY_HIT_ADVANCES',groupId:id,cardInstanceIds:[costs[1]!]}));expect(s.players.B!.damage).toBe(20);for(const card of [...costs,CARD,'a2-p06-r1c3','a2-p07-r1c1'])expect(s.discard.filter(id=>id===card)).toHaveLength(1);expect(s.distances.A!.B).toBe('far');
});
it.each(['sky-wing-maai-one','sky-wing-maai-two','sky-wing-evade'] as const)('%s actual defense retains two MAAI requirement while a fully evaded target offers no post-hit payment',name=>{let s=chant(makeSkyWingPhysical(name,players));s=until(act(s,'A',cmd(true)),s=>s.windows?.at(-1)?.kind==='normal-defense');const evade=name==='sky-wing-evade',two=name==='sky-wing-maai-two';s=act(s,'B',evade?{type:'PLAY_DEFENSE',cardInstanceId:'a2-p05-r3c1',dedicated:false}:{type:'PLAY_MAAI',cardInstanceId:'a2-p06-r1c3'});if(!evade){s=until(s,s=>s.windows?.at(-1)?.kind!=='reclaim');expect(viewFor(s,'B').maaiDefense!.targets[0]).toMatchObject({submitted:1,remaining:1});if(two)s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'});}let choices=0;for(let n=0;n<300&&s.windows?.length;n++){if(s.windows.at(-1)!.kind==='hit-advance-choice')choices++;s=pass(s);}expect(choices).toBe(two||evade?0:1);expect(s.players.B!.damage).toBe(two||evade?0:15);for(const cost of costs)expect(s.players.A!.hand).toContain(cost);expect(s.players.B!.followers[0]!.revealed).toBe(false);});
it('fate actual chanted declaration cancellation prevents hit payment and consumes prepared source once',()=>{let s=chant(makeSkyWingPhysical('sky-wing-fate',players));s=act(s,'A',cmd(true));const id=s.windows!.at(-1)!.continuation.id;s=until(s,s=>s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]==='D');s=settle(act(s,'D',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id}));expect(s.players.B!.damage).toBe(0);for(const cost of costs)expect(s.players.A!.hand).toContain(cost);expect(s.players.A!.chants).toEqual([]);expect(s.discard.filter(x=>x===CARD)).toHaveLength(1);});
it('wrong owner after actual preparation rejects dedicated and forged targets but may resolve ordinary mode',()=>{let s=chant(makeSkyWingPhysical('sky-wing-wrong-owner',players,{warrior:7}));reject(s,'A',cmd(true));for(const ids of [[],['A'],['B','B'],['missing'],['B','C']])reject(s,'A',cmd(false,ids));reject(s,'B',cmd());s=settle(act(s,'A',cmd()));expect(s.players.B!.damage).toBe(7);expect(s.discard).toContain(CARD);});
it('stopped actual Hypnosis failed recovery skips owner turn and forbids both attack modes and CHANT',()=>{const s=makeSkyWingPhysical('sky-wing-stopped',players);expect(s.seatOrder[s.turnSeat]).not.toBe('A');reject(s,'A',cmd(false));reject(s,'A',cmd(true));reject(s,'A',{type:'CHANT',cardInstanceId:CARD,dedicated:true});expect(s.players.A!.hand).toContain(CARD);});
it('decline actual nonattack mode refusals preserve physical unprepared Sword when main is passed',()=>{let s=makeSkyWingPhysical('sky-wing-decline',players);reject(s,'A',{type:'REST',cardInstanceIds:[CARD]});reject(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[CARD]});s=act(s,'A',{type:'PASS_ACTION'});expect(s.players.A!.hand).toContain(CARD);expect(s.players.A!.chants).toEqual([]);});
