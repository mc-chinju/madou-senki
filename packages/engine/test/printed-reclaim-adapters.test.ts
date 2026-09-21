import {expect,it} from 'vitest';
import {transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,finish,pass,ready,until} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
import {gameStats} from '../src/game-stats.js';
const COURAGE='a2-p01-r3c3',CHARM='c2-p06-r1c2-ab01';
const SWORD='a2-p04-r2c1';
function discardSwordAtTurnEnd(cham=true){
  let s=ready();character(s,'A','大神官ジル');character(s,'C',cham?'小妖精のチャム':'忍びのイダ');s.players.C!.revealed=false;
  handCard(s,'A','ふぇありぃそぅど');for(const name of ['神性介入','封傷','転移','衝破'])if(s.players.A!.hand.length<=gameStats(s,'A').handLimit)handCard(s,'A',name);
  s=act(s,'A',{type:'PASS_ACTION'});const excess=s.players.A!.hand.length-gameStats(s,'A').handLimit;
  return act(s,'A',{type:'END_TURN',discardIds:[SWORD,...s.players.A!.hand.filter(id=>id!==SWORD)].slice(0,excess)});
}
it('A31 actual hand discard saves an occurrence and keeps concealed Cham in the same public reveal slot',()=>{
  let s=discardSwordAtTurnEnd();const d=s.reclaimDecisions!.at(-1)!;
  expect(d.source).toMatchObject({kind:'actual-discard',fromZone:'discard',origin:{zone:'hand',ownerId:'A'},sourceActorId:'A'});
  expect(discardIds(s)).toContain(SWORD);expect(s.resolution).not.toContain(SWORD);expect(s.turnSeat).toBe(0);
  s=pass(s);s=pass(s);expect(viewFor(s,'C').reclaim!.claims).toEqual([]);
  const w=structuredClone(s.windows!.at(-1));s=act(JSON.parse(JSON.stringify(s)) as GameState,'C',{type:'REVEAL_CHARACTER'});expect(s.windows!.at(-1)).toEqual(w);
  const c=viewFor(s,'C').reclaim!;s=act(s,'C',{type:'CHOOSE_RECLAIM',decisionId:c.decisionId,choice:'take',claimId:c.claims[0]!.claimId});
  expect(s.players.C!.hand.filter(id=>id===SWORD)).toHaveLength(1);expect(discardIds(s)).not.toContain(SWORD);expect(s.resolution).not.toContain(SWORD);
  expect(s.turnSeat).toBe(1);expect(s.players.C!.reclaimUsage?.['ふぇありぃそぅど']).toBeUndefined();
});
it('A31 concealed Cham and a non-Cham give observers the same explicit discard response schedule',()=>{
  let a=discardSwordAtTurnEnd(),b=discardSwordAtTurnEnd(false);
  for(let n=0;n<4;n++){
    for(const id of ['A','B','D'])expect(viewFor(a,id)).toEqual(viewFor(b,id));
    expect(a.windows!.at(-1)!.kind).toBe('reclaim');a=pass(a);b=pass(b);
  }
  expect(discardIds(a)).toContain(SWORD);expect(discardIds(b)).toContain(SWORD);expect(a.turnSeat).toBe(1);
});
it('A31 accepts the printed right under ability prohibition but rejects stopped Cham and stale occurrences',()=>{
  for(const kind of ['ability-disabled','stopped'] as const){
    let s=discardSwordAtTurnEnd();s=pass(s);s=pass(s);s.players.C!.statuses=[{id:'prior-status',kind,modifiers:[0],nextCheck:0}];s=act(s,'C',{type:'REVEAL_CHARACTER'});
    const d=viewFor(s,'C').reclaim!;
    if(kind==='stopped'){expect(d.claims).toEqual([]);expect(d.canDecline).toBe(true);}
    else{
      const command={type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId} as const;
      const stale=structuredClone(s);stale.discardOccurrences![0]!.stage='closed';expect(transition(stale,{actorId:'C',command},entropy()).ok).toBe(false);
      s=act(s,'C',command);expect(s.players.C!.hand).toContain(SWORD);
      expect(transition(s,{actorId:'C',command},entropy()).ok).toBe(false);
    }
  }
});
it('A31 canceled installation reaches a distinct discard occurrence and keeps the spent turn action',()=>{
  let s=ready();character(s,'A','小妖精のチャム');handCard(s,'A','ふぇありぃそぅど');const fate=handCard(s,'B','命運凶変');
  s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:SWORD});const action=viewFor(s,'A').reactionTargetActionId!;s=pass(s);
  s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:action});
  for(let n=0;!s.reclaimDecisions?.some(d=>d.source.kind==='actual-discard')&&n<100;n++)s=pass(s);
  expect(s.players.A!.attachments).not.toContain(SWORD);expect(discardIds(s)).toContain(SWORD);expect(s.resolution).not.toContain(SWORD);
  s=act(s,'A',{type:'REVEAL_CHARACTER'});const d=viewFor(s,'A').reclaim!;
  s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId});s=finish(s);
  expect(s.players.A!.hand).toContain(SWORD);expect(s.players.A!.attachments).not.toContain(SWORD);expect(s.phase).toBe('hand-adjustment');
  expect(s.reclaimDecisions!.filter(d=>d.cardInstanceId===SWORD).map(d=>d.source.kind)).toEqual(['ordinary-disposition','actual-discard']);
});
it('A31 actual death disposal records the old attachment without allowing dead Cham to reclaim',()=>{
  let s=ready();character(s,'A','小妖精のチャム');handCard(s,'A','ふぇありぃそぅど');s=finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:SWORD}));
  s=act(s,'A',{type:'END_TURN',discardIds:[]});s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});
  s.players.A!.damage=gameStats(s,'A').endurance-1;const attack=handCard(s,'B','踏み込み／弓');s=act(s,'B',{type:'ATTACK',cardInstanceId:attack,targetIds:['A'],dedicated:false});
  for(let n=0;!s.reclaimDecisions?.some(d=>d.source.kind==='actual-discard')&&n<150;n++)s=pass(s);
  expect(s.players.A!.presence).toBe('dead');expect(s.reclaimDecisions!.at(-1)!.source).toMatchObject({kind:'actual-discard',origin:{zone:'attachments',ownerId:'A'}});
  expect(s.windows!.at(-1)!.participants).not.toContain('A');expect(viewFor(s,'A').reclaim!.claims).toEqual([]);expect(discardIds(finish(s))).toContain(SWORD);
});
it('A31 death of another holder reserves the discarded sword until the original lethal attack finishes',()=>{
  let s=ready();character(s,'A','大神官ジル');character(s,'C','小妖精のチャム');handCard(s,'B','ふぇありぃそぅど');
  s.players.B!.damage=gameStats(s,'B').endurance-1;const attack=handCard(s,'A','踏み込み／弓');
  s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});const root=Object.values(s.actions!)[0]!.eventId;
  for(let n=0;!s.reclaimDecisions?.some(d=>d.source.kind==='actual-discard')&&n<150;n++)s=pass(s);
  expect(s.players.B!.presence).toBe('dead');expect(s.reclaimDecisions!.at(-1)!.source).toMatchObject({eventId:root,sourceActorId:'A',origin:{zone:'hand',ownerId:'B'}});
  while(viewFor(s,'C').reclaim!.pendingActorId!=='C')s=pass(s);
  s=act(s,'C',{type:'REVEAL_CHARACTER'});const d=viewFor(s,'C').reclaim!;
  s=act(s,'C',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId});
  expect(s.reclaimReservations).toContain(SWORD);expect(s.resolution).not.toContain(SWORD);expect(s.players.C!.hand).not.toContain(SWORD);
  s=finish(JSON.parse(JSON.stringify(s)) as GameState);expect(s.reclaimReservations).not.toContain(SWORD);expect(s.players.C!.hand.filter(id=>id===SWORD)).toHaveLength(1);
  expect(s.players.B!.presence).toBe('dead');expect(discardIds(s).filter(id=>id===attack)).toHaveLength(1);
});
it('A31 a later legal discard creates a new occurrence and rejects the first occurrence claim unchanged',()=>{
  let s=discardSwordAtTurnEnd();s=pass(s);s=pass(s);s=act(s,'C',{type:'REVEAL_CHARACTER'});const first=viewFor(s,'C').reclaim!;
  const old={type:'CHOOSE_RECLAIM',decisionId:first.decisionId,choice:'take',claimId:first.claims[0]!.claimId} as const;s=act(s,'C',old);
  s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});s=act(s,'B',{type:'PASS_ACTION'});s=act(s,'B',{type:'END_TURN',discardIds:[]});
  s=act(s,'C',{type:'START_TURN'});s=act(s,'C',{type:'CHOOSE_DRAW',draw:false});s=act(s,'C',{type:'PASS_ACTION'});
  const extra=s.players.C!.hand.length-gameStats(s,'C').handLimit;expect(extra).toBeGreaterThan(0);
  s=act(s,'C',{type:'END_TURN',discardIds:[SWORD,...s.players.C!.hand.filter(id=>id!==SWORD)].slice(0,extra)});
  expect(s.discardOccurrences).toHaveLength(2);expect(s.discardOccurrences![1]!.id).not.toBe(s.discardOccurrences![0]!.id);
  const before=JSON.stringify(s);expect(transition(s,{actorId:'C',command:old},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
  const current=viewFor(s,'C').reclaim!;s=act(s,'C',{type:'CHOOSE_RECLAIM',decisionId:current.decisionId,choice:'take',claimId:current.claims[0]!.claimId});
  expect(s.players.C!.hand.filter(id=>id===SWORD)).toHaveLength(1);expect(s.discardOccurrences!.every(d=>d.stage==='closed')).toBe(true);
});
it('A31 actual astrology discard identifies the target hand and keeps the private inspection closed after reclaim',()=>{
  let s=ready();character(s,'A','占星術師のアルセイル');character(s,'C','小妖精のチャム');handCard(s,'B','ふぇありぃそぅど');
  const option=viewFor(s,'A').abilityOptions.find(o=>o.abilityId==='c2-p04-r2c1-ab02')!;
  s=act(s,'A',{type:'USE_ABILITY',abilityId:option.abilityId,targetEventId:option.targetEventId,targetId:'B'});
  s=until(s,'private-inspection');const inspection=viewFor(s,'A').inspection!;
  s=act(s,'A',{type:'CHOOSE_INSPECTION',decisionId:inspection.decisionId,choice:'discard-one',cardInstanceId:SWORD});
  expect(s.reclaimDecisions!.at(-1)!.source).toMatchObject({sourceActorId:'A',origin:{zone:'hand',ownerId:'B'}});
  expect(viewFor(s,'A').inspection).toBeNull();s=pass(s);s=pass(s);s=act(s,'C',{type:'REVEAL_CHARACTER'});const claim=viewFor(s,'C').reclaim!;
  s=act(s,'C',{type:'CHOOSE_RECLAIM',decisionId:claim.decisionId,choice:'take',claimId:claim.claims[0]!.claimId});
  expect(s.players.C!.hand).toContain(SWORD);expect(viewFor(s,'A').inspection).toBeNull();
});
it('A31 sword install is a cancellable Cham-only physical turn card and restores warrior damage while attached',()=>{
  let s=ready();character(s,'A','小妖精のチャム');handCard(s,'A','ふぇありぃそぅど');
  const invalid=structuredClone(s);character(invalid,'A','大神官ジル');
  expect(transition(invalid,{actorId:'A',command:{type:'PLAY_TURN_CARD',cardInstanceId:SWORD}},entropy()).ok).toBe(false);
  const accepted=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:SWORD});expect(accepted.resolution).toContain(SWORD);expect(accepted.players.A!.attachments).not.toContain(SWORD);
  s=finish(accepted);expect(s.players.A!.attachments).toContain(SWORD);expect(s.phase).toBe('hand-adjustment');
  const hand=handCard(s,'A','手裏剣');s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(0,Math.max(0,s.players.A!.hand.length-gameStats(s,'A').handLimit))});
  for(let n=0;s.turnSeat!==0&&n<10;n++){const actor=s.seatOrder[s.turnSeat]!;s=act(s,actor,{type:'START_TURN'});s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});s=act(s,actor,{type:'PASS_ACTION'});s=act(s,actor,{type:'END_TURN',discardIds:[]});}
  s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});
  const without=structuredClone(s);without.players.A!.attachments=without.players.A!.attachments.filter(id=>id!==SWORD);without.players.A!.hand.push(SWORD);
  const normal=finish(act(without,'A',{type:'ATTACK',cardInstanceId:hand,targetIds:['B'],dedicated:false},Array(30).fill(1)));
  const installed=finish(act(s,'A',{type:'ATTACK',cardInstanceId:hand,targetIds:['B'],dedicated:false},Array(30).fill(1)));
  expect(normal.players.B!.damage).toBe(2);expect(installed.players.B!.damage).toBe(5);
});
it.each([['手裏剣',2],['衝破',5]] as const)('Cham mandatory restriction under ability prohibition applies to %s as %i damage', (name,damage)=>{
  let s=ready();character(s,'A','小妖精のチャム');s.players.A!.statuses=[{id:'prior-ban',kind:'ability-disabled',modifiers:[0],nextCheck:0}];
  const card=handCard(s,'A',name);s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}));
  expect(s.players.B!.damage).toBe(damage);
});
function courageWindow(mental='魔聖母ディア',abilityId=CHARM,user='大神官ジル') {
  let s=ready();character(s,'A',user);character(s,'B',mental);character(s,'C',user==='吟遊詩人のレスター'?'大神官ジル':'吟遊詩人のレスター');
  s.players.C!.revealed=false;
  const card=handCard(s,'A','勇気'),attack=handCard(s,'A','踏み込み／弓');
  s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');
  const option=viewFor(s,'B').abilityOptions.find(o=>o.abilityId===abilityId)!;
  s=act(s,'B',{type:'USE_ABILITY',abilityId,targetEventId:option.targetEventId});
  for(let n=0;s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='A'&&n<10;n++)s=pass(s);
  const targetEventId=viewFor(s,'A').reactionTargetAbilityId!;
  return {s,card,targetEventId};
}
function courageResolved() {
  const p=courageWindow();const s=until(act(p.s,'A',{type:'PLAY_ANYTIME_CARD',cardInstanceId:p.card,targetEventId:p.targetEventId}),'reclaim');
  expect(s.abilities![p.targetEventId]!.canceled).toBe(true);
  expect(s.reclaimDecisions!.at(-1)!.source.kind).toBe('courage-resolution');return s;
}
it.each(['base','printed'] as const)('Actual Lester Courage selects one of two same-seat rights: %s',right=>{
 const p=courageWindow('魔聖母ディア',CHARM,'吟遊詩人のレスター');
 let s=until(act(p.s,'A',{type:'PLAY_ANYTIME_CARD',cardInstanceId:p.card,targetEventId:p.targetEventId}),'reclaim');
 s=act(s,'A',{type:'REVEAL_CHARACTER'});
 const d=viewFor(s,'A').reclaim!;
 expect(d.claims.map(c=>c.right).sort()).toEqual(['base','printed']);
 const claim=d.claims.find(c=>c.right===right)!;
 s=act(JSON.parse(JSON.stringify(s)) as GameState,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:right==='base'?'take':'request-check',claimId:claim.claimId});
 if(right==='printed'){
  s=until(s,'reclaim');const take=viewFor(s,'A').reclaim!;
  expect(take.stage).toBe('beneficiary-choice');expect(take.claims.map(c=>c.right)).toEqual(['printed']);
  s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:take.decisionId,choice:'take',claimId:take.claims[0]!.claimId});
 }
 const before=JSON.stringify(s);
 expect(transition(s,{actorId:'A',command:{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims.find(c=>c.right!==right)!.claimId}},entropy()).ok).toBe(false);
 expect(JSON.stringify(s)).toBe(before);
 s=finish(s);expect(s.players.A!.hand.filter(id=>id===COURAGE)).toHaveLength(1);
 expect(discardIds(s)).not.toContain(COURAGE);expect(s.reclaimReservations).toEqual([]);
 expect(s.players.A!.reclaimUsage?.['勇気']?.baseSpent??false).toBe(right==='base');
 expect(s.rolls?.filter(r=>r.resume.kind==='reclaim-check').length??0).toBe(right==='printed'?1:0);
});
function toLester(s:GameState) {s=pass(s);s=pass(s);expect(viewFor(s,'C').reclaim!.pendingActorId).toBe('C');return s;}

it('A09 distinct Lester checker and original user beneficiary share one saved reservation',()=>{
  let s=toLester(courageResolved());expect(viewFor(s,'C').reclaim!.claims).toEqual([]);
  const waiting=structuredClone(s.windows!.at(-1));s=act(s,'C',{type:'REVEAL_CHARACTER'});expect(s.windows!.at(-1)).toEqual(waiting);
  const d=viewFor(s,'C').reclaim!,claim=d.claims[0]!;expect(claim.action).toBe('request-check');
  s=act(JSON.parse(JSON.stringify(s)) as GameState,'C',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'request-check',claimId:claim.claimId});
  expect(s.rolls!.at(-1)).toMatchObject({rollerId:'C',formula:'2d6',modifier:0,resume:{kind:'reclaim-check',decisionId:d.decisionId}});
  for(let n=0;s.windows!.at(-1)!.kind!=='reclaim'&&n<40;n++)s=pass(JSON.parse(JSON.stringify(s)) as GameState);
  const take=viewFor(s,'A').reclaim!;expect(take.stage).toBe('beneficiary-choice');expect(take.pendingActorId).toBe('A');
  expect(viewFor(s,'C').reclaim!.claims).toEqual([]);
  s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:take.decisionId,choice:'take',claimId:take.claims[0]!.claimId});
  expect(s.reclaimReservations).toContain(COURAGE);expect(s.players.C!.hand).not.toContain(COURAGE);
  s=finish(s);expect(s.players.A!.hand).toContain(COURAGE);expect(s.players.C!.hand).not.toContain(COURAGE);
  expect(s.players.A!.reclaimUsage?.['勇気']).toBeUndefined();expect(s.players.C!.reclaimUsage?.['勇気']).toBeUndefined();
});
it('A09 failed check consumes its one attempt but preserves later public response seats',()=>{
  let s=toLester(courageResolved());s=act(s,'C',{type:'REVEAL_CHARACTER'});
  const d=viewFor(s,'C').reclaim!,claim=d.claims[0]!;
  const command={type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'request-check',claimId:claim.claimId};
  s=act(s,'C',command);
  const before=JSON.stringify(s);expect(transition(s,{actorId:'C',command} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
  for(let n=0;s.windows!.at(-1)!.kind!=='reclaim'&&n<40;n++)s=pass(s,Array(30).fill(6));
  expect(s.rolls!.at(-1)!.success).toBe(false);expect(viewFor(s,'D').reclaim!.pendingActorId).toBe('D');
  expect(s.reclaimDecisions!.at(-1)!.checkAttempted).toBe(true);
  s=finish(s);expect(discardIds(s)).toContain(COURAGE);
  expect(s.rolls!.filter(r=>r.resume.kind==='reclaim-check')).toHaveLength(1);
});
it('A09 canceled Courage has no printed check while its paid card and refill remain',()=>{
  const p=courageWindow();let s=p.s;const fate=handCard(s,'D','命運凶変');
  s=act(s,'A',{type:'PLAY_ANYTIME_CARD',cardInstanceId:COURAGE,targetEventId:p.targetEventId});
  for(let n=0;s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='D'&&n<10;n++)s=pass(s);
  const courageAction=viewFor(s,'D').reactionTargetActionId!;
  s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:courageAction});s=finish(s);
  expect(s.reclaimDecisions?.some(d=>d.source.kind==='courage-resolution')).toBe(false);
  expect(discardIds(s)).toContain(COURAGE);expect(discardIds(s)).toContain(fate);
  expect(s.events.some(e=>e.type==='CARD_DRAWN'&&e.actorId==='A')).toBe(true);
});
it('Courage rejects EVIL, foreign physical cards, and stale ability targets without mutation',()=>{
  const p=courageWindow();
  for(const kind of ['EVIL','foreign','stale'] as const){const s=structuredClone(p.s);if(kind==='EVIL')s.players.A!.faction='EVIL';
    const before=JSON.stringify(s);const command={type:'PLAY_ANYTIME_CARD',cardInstanceId:kind==='foreign'?'a2-p01-r3c2':COURAGE,targetEventId:kind==='stale'?'stale':p.targetEventId};
    expect(transition(s,{actorId:'A',command} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
  }
});
it('Courage cancels Gadula fear but does not offer or accept cancellation of Lester poem',()=>{
  const fear=courageWindow('不死王ガドューラ','c2-p06-r1c1-ab01');
  const s=until(act(fear.s,'A',{type:'PLAY_ANYTIME_CARD',cardInstanceId:COURAGE,targetEventId:fear.targetEventId}),'reclaim');
  expect(s.abilities![fear.targetEventId]!.canceled).toBe(true);
  const poem=courageWindow('吟遊詩人のレスター','c2-p03-r2c1-ab01');
  expect(viewFor(poem.s,'A').anytimeCardOptions).toEqual([]);
  expect(transition(poem.s,{actorId:'A',command:{type:'PLAY_ANYTIME_CARD',cardInstanceId:COURAGE,targetEventId:poem.targetEventId}},entropy()).ok).toBe(false);
  expect(finish(poem.s).players.A!.hand).toContain(COURAGE);
});
it('A09 character ability prohibition does not remove the printed check but stopped Lester cannot request it',()=>{
  const original=toLester(courageResolved());
  for(const kind of ['ability-disabled','stopped'] as const){
    let s=structuredClone(original);s.players.C!.statuses=[{id:'prior-status',kind,modifiers:[0],nextCheck:0}];
    s=act(s,'C',{type:'REVEAL_CHARACTER'});const d=viewFor(s,'C').reclaim!;
    if(kind==='stopped'){expect(d.claims).toEqual([]);expect(d.canDecline).toBe(true);}
    else {expect(d.claims[0]!.action).toBe('request-check');s=act(s,'C',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'request-check',claimId:d.claims[0]!.claimId});expect(s.reclaimDecisions!.at(-1)!.stage).toBe('printed-check');}
  }
});
it('A09 successful check can be declined without any budget or recipient transfer',()=>{
  let s=act(toLester(courageResolved()),'C',{type:'REVEAL_CHARACTER'});const d=viewFor(s,'C').reclaim!;
  s=act(s,'C',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'request-check',claimId:d.claims[0]!.claimId});
  for(let n=0;s.windows!.at(-1)!.kind!=='reclaim'&&n<40;n++)s=pass(s);
  s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'decline'});s=finish(s);
  expect(discardIds(s)).toContain(COURAGE);expect(s.reclaimReservations).not.toContain(COURAGE);expect(s.players.A!.reclaimUsage?.['勇気']).toBeUndefined();
});
it('A09 reroll reactions reuse the bound check and cannot charge a second attempt',()=>{
  let s=act(toLester(courageResolved()),'C',{type:'REVEAL_CHARACTER'});const reroll=handCard(s,'D','神性介入'),d=viewFor(s,'C').reclaim!;
  s=act(s,'C',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'request-check',claimId:d.claims[0]!.claimId});
  for(let n=0;s.windows!.at(-1)!.kind!=='after-roll'&&n<40;n++)s=pass(s,Array(30).fill(6));
  const roll=s.rolls!.at(-1)!;expect(roll.success).toBe(false);
  for(let n=0;s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='D'&&n<10;n++)s=pass(s);
  s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:reroll,mode:'reroll',targetRollId:roll.id});
  for(let n=0;viewFor(s,'A').reclaim?.stage!=='beneficiary-choice'&&n<100;n++)s=pass(s);
  expect(s.rolls!.filter(r=>r.resume.kind==='reclaim-check')).toHaveLength(1);expect(s.rolls!.find(r=>r.id===roll.id)!.attempts).toHaveLength(2);
  expect(s.reclaimDecisions!.find(r=>r.id===d.decisionId)!.attemptedClaimIds).toHaveLength(1);
  const take=viewFor(s,'A').reclaim!;s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:take.claims[0]!.claimId});
  expect(finish(s).players.A!.hand).toContain(COURAGE);
});
it('A09 same-person checker and recipient may choose the printed right without spending the owned-name slot',()=>{
  const p=courageWindow('魔聖母ディア',CHARM,'吟遊詩人のレスター');
  let s=until(act(p.s,'A',{type:'PLAY_ANYTIME_CARD',cardInstanceId:COURAGE,targetEventId:p.targetEventId}),'reclaim');
  s=act(s,'A',{type:'REVEAL_CHARACTER'});const d=viewFor(s,'A').reclaim!,claim=d.claims.find(c=>c.right==='printed')!;
  expect(d.claims.some(c=>c.right==='base')).toBe(true);
  s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'request-check',claimId:claim.claimId});
  for(let n=0;s.windows!.at(-1)!.kind!=='reclaim'&&n<40;n++)s=pass(s);
  s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:claim.claimId});s=finish(s);
  expect(s.players.A!.hand.filter(id=>id===COURAGE)).toHaveLength(1);expect(s.players.A!.reclaimUsage?.['勇気']).toBeUndefined();
});
it('A09 keeps the paid source through immediate OPEN refill before canceling its target',()=>{
  const p=courageWindow();const open=handCard(p.s,'D','神々の血');p.s.players.D!.hand=p.s.players.D!.hand.filter(id=>id!==open);p.s.deck.unshift(open);
  let s=act(p.s,'A',{type:'PLAY_ANYTIME_CARD',cardInstanceId:COURAGE,targetEventId:p.targetEventId});
  expect(s.players.A!.open).toContain(open);expect(s.resolution).toContain(COURAGE);expect(s.abilities![p.targetEventId]!.canceled).toBe(false);
  s=until(JSON.parse(JSON.stringify(s)) as GameState,'reclaim');expect(s.abilities![p.targetEventId]!.canceled).toBe(true);
  expect(s.reclaimDecisions!.filter(d=>d.source.kind==='courage-resolution')).toHaveLength(1);
});

it('A09 nested reroll failure restores only the unanswered recovery suffix after save-load',()=>{
 let s=act(toLester(courageResolved()),'C',{type:'REVEAL_CHARACTER'});
 const reroll=handCard(s,'D','神性介入'),d=viewFor(s,'C').reclaim!,windowId=s.windows!.at(-1)!.id;
 expect(s.windows!.at(-1)!.cursor).toBe(2);
 s=act(s,'C',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'request-check',claimId:d.claims[0]!.claimId});
 for(let n=0;s.windows!.at(-1)!.kind!=='after-roll'&&n<40;n++)s=pass(s,Array(30).fill(6));
 const rollId=s.rolls!.at(-1)!.id;
 for(let n=0;s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='D'&&n<10;n++)s=pass(s);
 s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:reroll,mode:'reroll',targetRollId:rollId});
 for(let n=0;s.windows!.at(-1)?.id!==windowId&&n<150;n++){
  s=JSON.parse(JSON.stringify(s));s=pass(s,Array(30).fill(6));
 }
 expect(s.rolls!.find(r=>r.id===rollId)).toMatchObject({success:false});
 expect(s.rolls!.find(r=>r.id===rollId)!.attempts).toHaveLength(2);
 expect(s.windows!.at(-1)).toMatchObject({id:windowId,participants:['A','B','C','D'],cursor:3});
 for(const id of s.seatOrder)expect(viewFor(s,id).reclaim).toMatchObject({decisionId:d.decisionId,pendingActorId:'D',stage:'responses'});
 for(const actorId of ['A','B','C']){
  const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));
  expect(transition(s,{actorId,command:{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'decline'}},entropy()).ok).toBe(false);
  expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);
 }
 s=pass(JSON.parse(JSON.stringify(s)));
 expect(s.reclaimDecisions!.find(x=>x.id===d.decisionId)!.stage).toBe('closed');
 s=finish(s);expect(discardIds(s).filter(id=>id===COURAGE)).toHaveLength(1);
 expect(s.rolls!.filter(r=>r.resume.kind==='reclaim-check')).toHaveLength(1);
});

it.each([[false,'decline'],[false,'pass'],[true,'decline'],[true,'pass']] as const)('A09 beneficiary decline self=%s command=%s preserves all later public seats',(self,mode)=>{
 let s:GameState;
 if(self){const p=courageWindow('魔聖母ディア',CHARM,'吟遊詩人のレスター');s=until(act(p.s,'A',{type:'PLAY_ANYTIME_CARD',cardInstanceId:p.card,targetEventId:p.targetEventId}),'reclaim');s=act(s,'A',{type:'REVEAL_CHARACTER'});}
 else s=act(toLester(courageResolved()),'C',{type:'REVEAL_CHARACTER'});
 const checker=self?'A':'C',d=viewFor(s,checker).reclaim!,claim=d.claims.find(c=>c.right==='printed')!,original=structuredClone(s.windows!.at(-1)!);
 s=act(s,checker,{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'request-check',claimId:claim.claimId});
 for(let n=0;viewFor(s,'A').reclaim?.stage!=='beneficiary-choice'&&n<60;n++)s=pass(s);
 expect(viewFor(s,'A').reclaim!.stage).toBe('beneficiary-choice');
 s=JSON.parse(JSON.stringify(s));
 s=mode==='pass'?pass(s):act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'decline'});
 for(let i=original.cursor+1;i<original.participants.length;i++){
  expect(s.windows!.at(-1)).toMatchObject({id:original.id,participants:original.participants,cursor:i});
  expect(viewFor(s,original.participants[i]!).reclaim).toMatchObject({decisionId:d.decisionId,stage:'responses',pendingActorId:original.participants[i],canDecline:true});
  expect(s.resolution).toContain(COURAGE);
  s=pass(JSON.parse(JSON.stringify(s)));
 }
 expect(s.reclaimDecisions!.find(x=>x.id===d.decisionId)!.stage).toBe('closed');
 s=finish(s);expect(discardIds(s).filter(id=>id===COURAGE)).toHaveLength(1);
 expect(s.reclaimReservations).not.toContain(COURAGE);
 expect(s.players.A!.reclaimUsage?.['勇気']).toBeUndefined();
});
