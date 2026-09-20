import {expect,it} from 'vitest';
import {transition,viewFor,gameStats,type GameState, discardIds } from '../src/index.js';
import {act,finish,pass,ready,until} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';

function prepared(name='大神官ジル') {
  const s=ready();character(s,'A',name);s.players.A!.revealed=false;s.players.A!.damage=1;
  const cardId=handCard(s,'A','封傷');return {s,cardId};
}
function resolve(s:GameState,cardId:string) {
  return until(act(s,'A',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:cardId,targetIds:['A'],dedicated:false}),'reclaim');
}
function sameOutsiders(a:GameState,b:GameState) {
  for(const id of ['B','C','D'])expect(viewFor(a,id)).toEqual(viewFor(b,id));
}

it('Hidden owned versus unowned name has the same empty-or-private opportunity envelope',()=>{
  const owner=prepared(),unowned=prepared('占星術師のアルセイル');
  let a=resolve(owner.s,owner.cardId),b=resolve(unowned.s,unowned.cardId);
  sameOutsiders(a,b);
  expect(viewFor(a,'A').reclaim!.claims).toHaveLength(1);
  expect(viewFor(b,'A').reclaim!.claims).toHaveLength(0);
  for(let n=0;n<4;n++) {
    a=JSON.parse(JSON.stringify(a)) as GameState;b=JSON.parse(JSON.stringify(b)) as GameState;
    sameOutsiders(a,b);
    expect(a.resolution).toContain(owner.cardId);expect(b.resolution).toContain(owner.cardId);
    a=pass(a);b=pass(b);sameOutsiders(a,b);
  }
  expect(discardIds(a)).toContain(owner.cardId);expect(discardIds(b)).toContain(owner.cardId);
  expect(a.phase).toBe('hand-adjustment');expect(b.phase).toBe('hand-adjustment');
});

it('Suppression and spent history never erase a public recovery response slot',()=>{
  const p=prepared();let a=resolve(p.s,p.cardId);
  const modified=structuredClone(p.s);modified.players.A!.statuses=[{id:'ban',kind:'ability-disabled',modifiers:[0],nextCheck:0}];
  modified.players.A!.reclaimUsage={'封傷':{baseSpent:true,extraSpentByAbility:[]}};
  let b=resolve(modified,p.cardId);
  // The unrelated public prohibition is itself visible, so compare only the recovery contract.
  for(let n=0;n<4;n++) {
    for(const id of ['B','C','D']) {
      expect(viewFor(a,id).activeWindow).toEqual(viewFor(b,id).activeWindow);
      expect(viewFor(a,id).reclaim).toEqual(viewFor(b,id).reclaim);
    }
    a=pass(a);b=pass(b);
  }
  expect(a.reclaimDecisions!.at(-1)!.stage).toBe('closed');expect(b.reclaimDecisions!.at(-1)!.stage).toBe('closed');
});

it('Reloaded recovery rejects stale wrong actor and duplicate take unchanged',()=>{
  const p=prepared();let s=resolve(p.s,p.cardId);const view=viewFor(s,'A').reclaim!;
  const take={type:'CHOOSE_RECLAIM',decisionId:view.decisionId,choice:'take',claimId:view.claims[0]!.claimId};
  for(const [actorId,command] of [['B',take],['A',{...take,decisionId:'stale'}],['A',{...take,claimId:'forged'}],['A',{type:'PASS_ACTION'}]] as const) {
    const before=JSON.stringify(s);
    expect(transition(s,{actorId,command} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  }
  s=act(JSON.parse(JSON.stringify(s)) as GameState,'A',take);
  const before=JSON.stringify(s);
  expect(transition(s,{actorId:'A',command:take} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);
  expect(JSON.stringify(s)).toBe(before);
});

it('Revealing during recovery preserves the answered prefix and the current chooser',()=>{
  const p=prepared();let s=resolve(p.s,p.cardId);s=pass(s);
  const before=structuredClone(s.windows!.at(-1)!);
  s=act(s,'A',{type:'REVEAL_CHARACTER'});
  expect(s.windows!.at(-1)).toEqual(before);
  expect(s.reclaimDecisions!.at(-1)!.cursor).toBe(1);
  expect(viewFor(s,'B').reclaim).toMatchObject({pendingActorId:'B',canDecline:true,claims:[]});
});

it('A follower bundle persists the public source order until every physical disposition is answered',()=>{
  let s=ready();character(s,'A','魔聖母ディア');
  const first=handCard(s,'A','兵士'),second=handCard(s,'A','黒騎士団');
  s.distances.A!.B='near';s.distances.B!.A='near';s.players.B!.permanent={endurance:100};
  const option=viewFor(s,'A').followerBundleOptions[0]!;
  s=act(s,'A',{type:'USE_FOLLOWER_ATTACK',abilityId:option.abilityId,targetEventId:option.targetEventId,sources:[{cardInstanceId:first,dedicated:false,targetIds:['B']},{cardInstanceId:second,dedicated:false,targetIds:['B']}]});
  s=until(s,'reclaim');expect(viewFor(s,'A').reclaim!.cardInstanceId).toBe(first);
  const decision=s.reclaimDecisions!.at(-1)!.id;
  for(let n=0;n<4;n++){s=JSON.parse(JSON.stringify(s)) as GameState;s=pass(s);}
  expect(s.reclaimDecisions!.find(d=>d.id===decision)!.stage).toBe('closed');
  expect(viewFor(s,'A').reclaim!.cardInstanceId).toBe(second);expect(s.resolution).toContain(second);
  expect(s.phase).toBe('combat');
  for(let n=0;n<4;n++)s=pass(s);
  expect(discardIds(s)).toEqual(expect.arrayContaining([first,second]));
  expect(s.followerBundles).toEqual({});expect(s.actions).toEqual({});expect(s.phase).toBe('withdrawal');
});

it('All-pass zero base extra and combined private histories preserve every public bow transition',()=>{
 const fury='c2-p02-r1c2-ab03',name='踏み込み／弓';
 let initial=ready();character(initial,'A','妖精王フューリー');initial.players.A!.revealed=false;
 for(const p of Object.values(initial.players))p.permanent={spirit:20,endurance:100};
 const card=handCard(initial,'A',name);
 // Prior private budgets are fixture inputs; the attack and all response decisions are live.
 let worlds=[[true,[fury]],[false,[fury]],[true,[]],[false,[]]].map(([base,extra])=>{const s=structuredClone(initial);s.players.A!.reclaimUsage={[name]:{baseSpent:base as boolean,extraSpentByAbility:extra as string[]}};return s;});
 const compare=()=>{for(const other of worlds.slice(1))sameOutsiders(worlds[0]!,other);};compare();
 worlds=worlds.map(s=>act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}));
 let recoverySeats=0;
 for(let i=0;i<300;i++){
  compare();const w=worlds[0]!.windows?.at(-1);if(!w)break;
  if(w.kind==='reclaim'){
   recoverySeats++;for(const s of worlds)expect(s.resolution).toContain(card);
   if(w.participants[w.cursor]==='A')expect(worlds.map(s=>viewFor(s,'A').reclaim!.claims.map(c=>c.right))).toEqual([[],['base'],['extra'],['base','extra']]);
  }
  worlds=worlds.map(s=>pass(JSON.parse(JSON.stringify(s)) as GameState));
 }
 compare();expect(recoverySeats).toBe(4);
 for(const s of worlds){expect(s.windows).toEqual([]);expect(s.phase).toBe('withdrawal');expect(discardIds(s)).toContain(card);}
});


it.each(['A','B','C','D'] as const)('Actual source %s starts clockwise recovery and reveal never repeats an answered seat',(owner)=>{
 let s=ready();
 while(s.seatOrder[s.turnSeat]!==owner){
  const actor=s.seatOrder[s.turnSeat]!;
  s=act(s,actor,{type:'PASS_ACTION'});
  s=finish(act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.slice(0,Math.max(0,s.players[actor]!.hand.length-gameStats(s,actor).handLimit))}));
  const next=s.seatOrder[s.turnSeat]!;
  s=act(s,next,{type:'START_TURN'});s=act(s,next,{type:'CHOOSE_DRAW',draw:false});
 }
 character(s,owner,'大神官ジル');s.players[owner]!.revealed=false;s.players[owner]!.damage=1;
 const card=handCard(s,owner,'封傷');
 s=until(act(s,owner,{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:card,targetIds:[owner],dedicated:false}),'reclaim');
 const start=s.seatOrder.indexOf(owner),order=[...s.seatOrder.slice(start),...s.seatOrder.slice(0,start)];
 const decisionId=viewFor(s,owner).reclaim!.decisionId,windowId=s.windows!.at(-1)!.id;
 expect(s.windows!.at(-1)!.participants).toEqual(order);
 expect(viewFor(s,owner).reclaim!.claims.map(c=>c.right)).toEqual(['base']);
 for(let i=0;i<order.length;i++){
  s=JSON.parse(JSON.stringify(s));
  if(i===1){const before=structuredClone(s.windows!.at(-1)!);s=act(s,owner,{type:'REVEAL_CHARACTER'});expect(s.windows!.at(-1)).toEqual(before);}
  expect(s.windows!.at(-1)!.id).toBe(windowId);
  expect(s.windows!.at(-1)!.cursor).toBe(i);
  for(const viewer of s.seatOrder)expect(viewFor(s,viewer).reclaim!.pendingActorId).toBe(order[i]);
  expect(viewFor(s,order[i]!).reclaim!.canDecline).toBe(true);
  if(i>0)expect(viewFor(s,order[i]!).reclaim!.claims).toEqual([]);
  s=pass(s);
 }
 expect(s.reclaimDecisions!.find(d=>d.id===decisionId)!.stage).toBe('closed');
 expect(discardIds(s).filter(c=>c===card)).toHaveLength(1);
 expect(s.players[owner]!.hand).not.toContain(card);
 expect(s.phase).toBe('hand-adjustment');
});
