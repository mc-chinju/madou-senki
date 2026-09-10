import {actionCards} from '@madou/catalog';
import {expect,it} from 'vitest';
import {viewFor,transition,gameStats,allCardInstanceIds,type GameState} from '../src/index.js';
import {act,closeWindow,finish,pass,until,ready} from './combat-helpers.js';
import {entropy,character,handCard} from './fixtures.js';
import {makeSwordShuffleScenario} from '../../../apps/worker/test/fixtures/sword-shuffle-scenario.js';
const SWORD='a2-p04-r2c1',DAWN='a2-p01-r1c2';
it.each([true,false])('real astrology discard suspends the already queued refill, dawn=%s, until a hidden Cham elects reservation',dawn=>{
 let s=makeSwordShuffleScenario(['A','B','C','D'].map(id=>({id,name:id})),false,dawn);const o=viewFor(s,'A').anytimeCardOptions.find(o=>o.cardInstanceId==='a2-p02-r1c2'&&o.targetId==='B')!;
 s=act(s,'A',{type:'PLAY_ANYTIME_CARD',cardInstanceId:o.cardInstanceId,targetId:'B',targetEventId:o.targetEventId});expect(s.rolls!.at(-1)!.purpose).toBe('revival');
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='A')s=pass(s);
 const star=viewFor(s,'A').abilityOptions.find(o=>o.abilityId==='c2-p04-r2c1-ab02')!;expect(star).toBeDefined();s=act(s,'A',{type:'USE_ABILITY',abilityId:star.abilityId,targetId:'B',targetEventId:star.targetEventId});s=until(s,'private-inspection');
 const inspection=viewFor(s,'A').inspection!;s=act(s,'A',{type:'CHOOSE_INSPECTION',decisionId:inspection.decisionId,choice:'discard-one',cardInstanceId:SWORD});
 expect(s.lifecycle!.some(t=>t.kind==='draw'&&t.actorId==='A')).toBe(true);expect(s.reclaimDecisions!.at(-1)!.source).toMatchObject({kind:'actual-discard',origin:{zone:'hand',ownerId:'B'}});expect(s.discard).toContain(SWORD);expect(s.resolution).not.toContain(SWORD);const deck=[...s.deck],discard=[...s.discard];
 while(viewFor(s,'C').reclaim?.pendingActorId!=='C')s=pass(s);expect(s.deck).toEqual(deck);expect(s.discard).toEqual(discard);expect(viewFor(s,'C').reclaim!.claims).toEqual([]);
 const waiting=structuredClone(s.windows!.at(-1));s=act(s,'C',{type:'REVEAL_CHARACTER'});expect(s.windows!.at(-1)).toEqual(waiting);const d=viewFor(s,'C').reclaim!,command={type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId} as const;s=act(s,'C',command);
 expect(s.reclaimReservations).toContain(SWORD);expect(s.discard).not.toContain(SWORD);expect(s.resolution).not.toContain(SWORD);expect(s.players.C!.hand).not.toContain(SWORD);expect(s.deck).toEqual(deck);
 const assertProtected=()=>{const reserved=s.reclaimReservations.includes(SWORD);expect([...s.reclaimReservations,...s.players.C!.hand].filter(id=>id===SWORD)).toHaveLength(1);expect(s.deck).not.toContain(SWORD);expect(s.discard).not.toContain(SWORD);expect(s.resolution).not.toContain(SWORD);for(const p of Object.values(s.players))if(reserved||p.id!=='C')expect(p.hand).not.toContain(SWORD);expect(allCardInstanceIds(s).sort()).toEqual(actionCards.map(c=>c.id).sort());};
 const rejectDuplicate=()=>{
  const before=JSON.stringify(s);let consumed=0;
  // Validation scans the raw arrays; numeric accesses on the proxy measure consumption.
  const traced=(values:number[])=>new Proxy(values,{get(target,key,receiver){if(key==='some')return target.some.bind(target);if(typeof key==='string'&&/^\d+$/.test(key))consumed++;return Reflect.get(target,key,receiver);}});
  const supplied=entropy();expect(transition(s,{actorId:'C',command},{...supplied,dice:traced([1,1,1]),random:traced(supplied.random)}).ok).toBe(false);
  expect(consumed).toBe(0);expect(JSON.stringify(s)).toBe(before);assertProtected();
 };
 assertProtected();rejectDuplicate();
 for(let n=0;n<200;n++){assertProtected();if(viewFor(s,'A').inspection?.zone==='all')break;s=pass(JSON.parse(JSON.stringify(s)));}
 assertProtected();rejectDuplicate();
 expect(viewFor(s,'A').inspection?.zone).toBe('all');if(!dawn)expect(s.deck.length).toBeGreaterThan(0);if(dawn)expect(s.players.A!.open).toContain(DAWN);expect(s.deck).not.toContain(SWORD);expect(s.players.A!.hand).not.toContain(SWORD);const last=viewFor(s,'A').inspection!;s=finish(act(s,'A',{type:'CHOOSE_INSPECTION',decisionId:last.decisionId,choice:'finish'}));expect(s.players.C!.hand.filter(id=>id===SWORD)).toHaveLength(1);expect(s.players.C!.reclaimUsage?.['ふぇありぃそぅど']).toBeUndefined();expect(s.discardOccurrences).toHaveLength(1);
});
it('real install then opponent Wish and discard returns the sword to living Cham without restoring its installed effect',()=>{
 let s=ready();character(s,'A','小妖精のチャム');character(s,'C','忍びのイダ');character(s,'D','侍大将のシン');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};handCard(s,'A','ふぇありぃそぅど');const attack=handCard(s,'A','手裏剣'),wish=handCard(s,'B','祈願');for(const name of ['封傷','神性介入','転移','衝破'])if(s.players.B!.hand.length<6)handCard(s,'B',name);
 const end=(s:GameState)=>{const actor=s.seatOrder[s.turnSeat]!;return finish(act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.filter(id=>id!==attack&&id!==SWORD).slice(0,Math.max(0,s.players[actor]!.hand.length-gameStats(s,actor).handLimit))}));};
 const start=(s:GameState)=>{const actor=s.seatOrder[s.turnSeat]!;return act(act(s,actor,{type:'START_TURN'}),actor,{type:'CHOOSE_DRAW',draw:false});};
 s=finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:SWORD}));expect(s.players.A!.attachments).toContain(SWORD);s=start(end(s));s=until(act(s,'B',{type:'PLAY_TURN_CARD',cardInstanceId:wish,mode:'wish'}),'wish');s=finish(act(s,'B',{type:'CHOOSE_WISH',decisionId:viewFor(s,'B').wish!.decisionId,source:{kind:'public',cardInstanceId:SWORD}}));expect(s.players.A!.attachments).not.toContain(SWORD);expect(s.discardOccurrences??[]).toEqual([]);
 const excess=s.players.B!.hand.length-gameStats(s,'B').handLimit;expect(excess).toBeGreaterThan(0);s=act(s,'B',{type:'END_TURN',discardIds:[SWORD,...s.players.B!.hand.filter(id=>id!==SWORD)].slice(0,excess)});while(viewFor(s,'A').reclaim?.pendingActorId!=='A')s=pass(s);s=act(s,'A',{type:'REVEAL_CHARACTER'});const d=viewFor(s,'A').reclaim!;s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId});expect(s.players.A!.hand).toContain(SWORD);expect(s.players.A!.attachments).not.toContain(SWORD);
 for(let n=0;s.turnSeat!==0&&n<4;n++){s=start(s);s=end(act(s,s.seatOrder[s.turnSeat]!,{type:'PASS_ACTION'}));}s=start(s);const half=finish(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}));expect(half.players.B!.damage).toBe(2);
 s=finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:SWORD}));s=end(s);for(let n=0;s.turnSeat!==0&&n<4;n++){s=start(s);s=end(act(s,s.seatOrder[s.turnSeat]!,{type:'PASS_ACTION'}));}s=start(s);const full=finish(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}));expect(full.players.B!.damage).toBe(5);expect(full.players.A!.attachments).toContain(SWORD);
});
