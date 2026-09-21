import {expect,it} from 'vitest';
import {viewFor,type GameState, discardIds } from '../src/index.js';
import {act,finish,pass,ready,until} from './combat-helpers.js';
import {character,handCard,handCards} from './fixtures.js';
function contested(success:boolean) {
  let s=ready();character(s,'A','大神官ジル');
  const [first,second]=handCards(s,['A','A'],'踏み込み／蹴る'),maai=handCard(s,'B','間合い／休息');
  s=act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:first});s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai});
  if(success)s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:second});
  s=pass(s);return {s,first,second,maai};
}
function declineSource(s:GameState) {
  const id=s.windows!.at(-1)!.id;
  for(let n=0;s.windows!.at(-1)?.id===id&&n<10;n++){
    expect(viewFor(s,s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!).reclaim!.claims).toEqual([]);
    s=pass(JSON.parse(JSON.stringify(s)) as GameState);
  }
  return s;
}
it('contested approach saves one all-seat source disposition at a time before resuming the action',()=>{
  const p=contested(true);let s=p.s;
  expect(s.windows!.at(-1)!.kind).toBe('reclaim');expect(s.reclaimDecisions!.at(-1)!.source).toMatchObject({cardInstanceId:p.first,sourceActorId:'A',usedModeName:'advance'});
  s=declineSource(s);expect(s.reclaimDecisions!.at(-1)!.source).toMatchObject({cardInstanceId:p.maai,sourceActorId:'B',usedModeName:'distance'});
  s=declineSource(s);expect(s.windows).toEqual([]);expect(s.phase).toBe('action');expect(s.distances.A!.B).toBe('near');
  expect(Object.values(s.distanceMarkers!)[0]!.cardInstanceId).toBe(p.second);expect(discardIds(s)).toEqual(expect.arrayContaining([p.first,p.maai]));
  expect(s.reclaimDecisions).toHaveLength(2);expect(s.players.A!.reclaimUsage?.['踏み込み／蹴る']).toBeUndefined();
});
it('failed approach preserves the owned technique slot and resumes a real later kick declaration',()=>{
  const p=contested(false);let s=p.s;expect(s.windows!.at(-1)!.kind).toBe('reclaim');
  s=declineSource(s);s=declineSource(s);expect(s.phase).toBe('action');expect(s.distances.A!.B).toBe('far');
  const marker=handCard(s,'A','踏み込み／弓');s=act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:marker});s=pass(s);
  s=until(act(s,'A',{type:'ATTACK',cardInstanceId:p.second,targetIds:['B'],dedicated:false}),'reclaim');
  const d=viewFor(s,'A').reclaim!;expect(d.claims).toHaveLength(1);s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId});
  expect(finish(s).players.A!.reclaimUsage?.['踏み込み／蹴る']?.baseSpent).toBe(true);
});
it('failed withdrawal retains each payer and preserves the previous marker once',()=>{
  const p=contested(true);let s=finish(p.s);const attack=handCard(s,'A','踏み込み／弓');s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}));
  const retreat=handCard(s,'A','間合い／休息'),advance=handCard(s,'B','踏み込み／殴る');
  s=act(s,'A',{type:'WITHDRAW',targetId:'B',cardInstanceId:retreat});s=act(s,'B',{type:'PLAY_ADVANCE',cardInstanceId:advance});s=pass(s);
  expect(s.windows!.at(-1)!.kind).toBe('reclaim');s=finish(s);expect(s.distances.A!.B).toBe('near');expect(s.phase).toBe('hand-adjustment');
  expect(s.reclaimDecisions!.slice(-2).map(d=>d.source.sourceActorId).sort()).toEqual(['A','B']);
  expect(discardIds(s).filter(id=>id===advance)).toHaveLength(1);expect(Object.values(s.distanceMarkers!)[0]!.cardInstanceId).toBe(p.second);
});
it('combat maai and advance each pause before the next target and preserve one shared hit through reload',()=>{
  let s=ready();character(s,'A','侍大将のシン');const attack=handCard(s,'A','天地百撃斬');
  const [bMaai,cMaai]=handCards(s,['B','C'],'間合い／休息'),advance=handCard(s,'A','踏み込み／蹴る');
  s.players.A!.hand=s.players.A!.hand.filter(id=>id!==attack);s.players.A!.chants.push({cardInstanceId:attack,revealed:false});
  s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B','C'],dedicated:true}),'normal-defense');
  const g=s.windows!.at(-1)!.continuation.id,rolls=structuredClone(s.rolls);
  for(const [actorId,cardInstanceId] of [['B',bMaai],['C',cMaai]] as const){
    s=act(s,actorId,{type:'PLAY_MAAI',cardInstanceId});
    expect(s.windows!.at(-1)!.kind).toBe('reclaim');expect(s.resolution).toContain(cardInstanceId);expect(discardIds(s)).not.toContain(cardInstanceId);
    expect(s.reclaimDecisions!.at(-1)!.source).toMatchObject({sourceActorId:actorId,usedModeName:'distance'});
    s=declineSource(s);expect(s.groups![g]!.maai!.submissions[actorId]).toEqual([cardInstanceId]);
  }
  expect(s.windows!.at(-1)!.kind).toBe('defense-advance');s=act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:advance});
  expect(s.windows!.at(-1)!.kind).toBe('reclaim');expect(s.groups![g]!.maai!.advances).toEqual([advance]);
  s=declineSource(s);expect(s.windows!.at(-1)).toMatchObject({kind:'normal-defense',continuation:{targetId:'B'}});
  expect(s.groups![g]!.hitCursor).toBe(0);expect(s.rolls).toEqual(rolls);
  expect(discardIds(s)).toEqual(expect.arrayContaining([bMaai,cMaai,advance]));
  s=finish(s);expect(s.reclaimDecisions!.filter(d=>[bMaai,cMaai,advance].includes(d.cardInstanceId))).toHaveLength(3);
});
it('attack advance costs resolve as a saved batch before the cancellable source declaration',()=>{
  let s=ready();character(s,'A','黒騎士ガーウィン');const card=handCard(s,'A','魔空剣'),first=handCard(s,'A','踏み込み／弓'),second=handCard(s,'A','踏み込み／蹴る'),fate=handCard(s,'B','命運凶変');
  const count=s.players.A!.hand.length;s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:true,advanceCardInstanceIds:[first,second]});
  expect(s.players.A!.hand).toHaveLength(count-3);expect(s.windows!.at(-1)!.kind).toBe('reclaim');expect(s.resolution).toEqual(expect.arrayContaining([card,first,second]));
  const action=Object.values(s.actions!)[0]!,level=action.technique.effectLevel;
  s=declineSource(s);expect(s.reclaimDecisions!.at(-1)!.cardInstanceId).toBe(second);s=declineSource(s);
  expect(s.actions![action.id]!.technique.effectLevel).toBe(level);expect(s.windows!.at(-1)!.kind).toBe('declaration');
  s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:action.id});s=finish(s);
  expect(s.players.B!.damage).toBe(0);for(const id of [card,first,second])expect(discardIds(s).filter(c=>c===id)).toHaveLength(1);
  expect(s.reclaimDecisions!.filter(d=>[first,second].includes(d.cardInstanceId))).toHaveLength(2);
});
it('post-hit advance batch preserves the applied damage once while each paid source waits',()=>{
  let s=ready();character(s,'A','黒妖精のアーネス');const card=handCard(s,'A','黒翼天翔剣'),first=handCard(s,'A','踏み込み／弓'),second=handCard(s,'A','踏み込み／蹴る');
  s.players.A!.hand=s.players.A!.hand.filter(id=>id!==card);s.players.A!.chants.push({cardInstanceId:card,revealed:false});
  s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:true}),'hit-advance-choice');
  const id=s.windows!.at(-1)!.continuation.id,base=s.groups![id]!.targets[0]!.hits[0]!.damage!;
  s=act(s,'A',{type:'PAY_HIT_ADVANCES',groupId:id,cardInstanceIds:[first,second]});
  expect(s.windows!.at(-1)!.kind).toBe('reclaim');expect(s.groups![id]!.targets[0]!.hits[0]!.damage).toBe(base+10);
  s=declineSource(s);expect(s.groups![id]!.targets[0]!.hits[0]!.damage).toBe(base+10);s=declineSource(s);
  expect(s.windows!.at(-1)!.kind).toBe('hit');expect(s.groups![id]!.postHitAdvanceAmount).toBe(10);
  s=finish(s);expect(s.players.B!.damage).toBe(base+10);for(const cost of [first,second])expect(discardIds(s).filter(c=>c===cost)).toHaveLength(1);
});
it('Ida conceal-heal cost pauses before its saved declaration without a technique recovery claim or refund',()=>{
  let s=ready();character(s,'A','忍びのイダ');s.players.A!.damage=5;s.players.A!.revealed=true;
  const cost=handCard(s,'A','間合い／休息'),fate=handCard(s,'B','命運凶変');const hand=s.players.A!.hand.length;
  const option=viewFor(s,'A').abilityOptions.find(o=>o.abilityId==='c2-p04-r2c2-ab04')!;
  s=act(s,'A',{type:'USE_ABILITY',abilityId:option.abilityId,targetEventId:option.targetEventId,costCardInstanceId:cost,conceal:true});
  expect(s.windows!.at(-1)!.kind).toBe('reclaim');expect(s.resolution).toContain(cost);expect(discardIds(s)).not.toContain(cost);
  const frame=Object.values(s.abilities!)[0]!;expect(s.reclaimDecisions!.at(-1)!.source).toMatchObject({sourceActorId:'A',usedModeName:'distance',trigger:'named-card-used',eventId:frame.eventId});
  expect(s.players.A!.hand).toHaveLength(hand-1);expect(s.players.A).toMatchObject({damage:5,revealed:true});
  s=declineSource(s);expect(s.windows!.at(-1)).toMatchObject({kind:'declaration',continuation:{kind:'ability',id:frame.id}});
  expect(discardIds(s).filter(id=>id===cost)).toHaveLength(1);expect(s.players.A!.reclaimUsage?.['間合い／休息']).toBeUndefined();
  const success=finish(s);expect(success.players.A).toMatchObject({damage:3,revealed:false});expect(success.phase).toBe('hand-adjustment');
  s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:frame.id});s=finish(s);
  expect(s.players.A).toMatchObject({damage:5,revealed:true});expect(s.phase).toBe('hand-adjustment');
  expect(discardIds(s).filter(id=>id===cost)).toHaveLength(1);expect(s.reclaimDecisions!.filter(d=>d.cardInstanceId===cost)).toHaveLength(1);
});
