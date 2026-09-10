import {expect,it} from 'vitest';
import {transition,viewFor,gameStats,type GameState} from '../src/index.js';
import {act,finish,pass,ready} from './combat-helpers.js';
import {entropy,handCard} from './fixtures.js';
import {assignCharacter,takeCard,trimHand} from '../../../apps/worker/test/fixtures/scenario-tools.js';
const SWORD='a2-p04-r2c1';
function rejected(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
it.each(['foreign-owner','other-turn','spent-action'] as const)('Fairy Sword %s cannot install or spend the physical source',mode=>{
 let s=ready();assignCharacter(s,'A',mode==='foreign-owner'?'大神官ジル':'小妖精のチャム');takeCard(s,'A',SWORD);trimHand(s,'A',SWORD);
 if(mode==='spent-action')s=act(s,'A',{type:'PASS_ACTION'});
 if(mode==='other-turn'){s=act(s,'A',{type:'PASS_ACTION'});s=finish(act(s,'A',{type:'END_TURN',discardIds:[]}));}
 rejected(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:SWORD});expect(s.players.A!.hand).toContain(SWORD);expect(s.players.A!.attachments).not.toContain(SWORD);
});
it('Fairy Sword public Cham may decline the actual foreign hand discard without installing or taking it',()=>{
 let s=ready();assignCharacter(s,'A','大神官ジル');assignCharacter(s,'C','小妖精のチャム');takeCard(s,'A',SWORD);s=act(s,'C',{type:'REVEAL_CHARACTER'});
 for(const name of ['神性介入','封傷','転移','衝破'])if(s.players.A!.hand.length<=gameStats(s,'A').handLimit)handCard(s,'A',name);
 s=act(s,'A',{type:'PASS_ACTION'});const excess=s.players.A!.hand.length-gameStats(s,'A').handLimit;expect(excess).toBeGreaterThan(0);
 s=act(s,'A',{type:'END_TURN',discardIds:[SWORD,...s.players.A!.hand.filter(id=>id!==SWORD)].slice(0,excess)});
 while(viewFor(s,'C').reclaim?.pendingActorId!=='C')s=pass(s);
 const decision=viewFor(s,'C').reclaim!;expect(decision.claims).toHaveLength(1);expect(decision.canDecline).toBe(true);
 expect(viewFor(s,'B').reclaim!.claims).toEqual([]);
 s=finish(act(s,'C',{type:'CHOOSE_RECLAIM',decisionId:decision.decisionId,choice:'decline'}));
 expect(s.discard.filter(id=>id===SWORD)).toHaveLength(1);expect(s.players.C!.hand).not.toContain(SWORD);expect(s.players.C!.attachments).not.toContain(SWORD);expect(s.turnSeat).toBe(1);expect(s.reclaimReservations??[]).not.toContain(SWORD);
 rejected(s,'C',{type:'CHOOSE_RECLAIM',decisionId:decision.decisionId,choice:'take',claimId:decision.claims[0]!.claimId});
});
