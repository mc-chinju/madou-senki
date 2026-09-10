import {describe,expect,it} from 'vitest';
import {allCardInstanceIds,transition} from '../src/index.js';
import {act,finish} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {makeOwnedReclaimTable,playOwnedCardToDiscard,currentReclaimWindow} from './owned-reclaim-helpers.js';

const OWNED_TECHNIQUE_CASES: [string,string,string][] = [['白魔術師シェリム','白輪','a2-p14-r1c3']];

describe('owned technique base recovery',()=>{
 it.each(OWNED_TECHNIQUE_CASES)('%s owned technique %s (%s) normalized-name-once-game',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId);let s=playOwnedCardToDiscard(table,cardId);
  const first=currentReclaimWindow(s,table.ownerId)!;expect(first.cardInstanceId).toBe(cardId);
  const claim=first.claims.find(c=>c.right==='base')!;expect(claim).toBeDefined();expect(s.resolution).toContain(cardId);
  const command={type:'CHOOSE_RECLAIM',decisionId:first.decisionId,choice:'take',claimId:claim.claimId} as const;
  const before=JSON.stringify(s);expect(transition(s,{actorId:'B',command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
  s=finish(act(s,table.ownerId,command));expect(s.players[table.ownerId]!.hand.filter(id=>id===cardId)).toHaveLength(1);
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent).toBe(true);expect(s.reclaimReservations).not.toContain(cardId);
  s=playOwnedCardToDiscard({...table,state:s},cardId);const second=currentReclaimWindow(s,table.ownerId)!;
  expect(second.cardInstanceId).toBe(cardId);expect(second.claims.some(c=>c.right==='base')).toBe(false);
  const repeated=JSON.stringify(s);expect(transition(s,{actorId:table.ownerId,command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(repeated);
  s=finish(s);expect(s.discard.filter(id=>id===cardId)).toHaveLength(1);expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 });
 it.each(OWNED_TECHNIQUE_CASES)('%s owned technique %s (%s) actual-use-disposition',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId),s=playOwnedCardToDiscard(table,cardId),choice=currentReclaimWindow(s,table.ownerId)!;
  expect(choice.cardInstanceId).toBe(cardId);expect(choice.claims.some(c=>c.right==='base')).toBe(true);
  expect(s.reclaimDecisions!.find(d=>d.id===choice.decisionId)!.source).toMatchObject({kind:'ordinary-disposition',trigger:'technique-resolved',sourceActorId:table.ownerId,cardInstanceId:cardId});
  expect(s.players.B!.damage).toBe(10);expect(s.players[table.ownerId]!.hand).not.toContain(cardId);expect(s.resolution).toContain(cardId);
 });
 it.each(OWNED_TECHNIQUE_CASES)('%s owned technique %s (%s) optional-decline',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId);let s=playOwnedCardToDiscard(table,cardId);const choice=currentReclaimWindow(s,table.ownerId)!;
  expect(choice.claims.some(c=>c.right==='base')).toBe(true);
  s=finish(act(s,table.ownerId,{type:'CHOOSE_RECLAIM',decisionId:choice.decisionId,choice:'decline'}));
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);expect(s.players[table.ownerId]!.hand).not.toContain(cardId);expect(s.discard.filter(id=>id===cardId)).toHaveLength(1);
 });
});
