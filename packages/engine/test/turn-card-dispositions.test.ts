import {expect,it} from 'vitest';
import {transition,viewFor} from '../src/index.js';
import {act,finish,pass,passReclaims,closeWindow,ready,until} from './combat-helpers.js';
import {character,handCard,handCards,entropy} from './fixtures.js';
it.each(['rest','potion'] as const)('%s batch cancels only one physical child, preserves paid sources, and resumes each disposition once',kind=>{
 let s=ready();s.players.A!.damage=8;const [first,second]=handCards(s,['A','A'],kind==='rest'?'間合い／休息':'回復の薬');const fate=handCard(s,'B','命運凶変');
 const count=s.players.A!.hand.length;
 s=act(s,'A',kind==='rest'?{type:'REST',cardInstanceIds:[first,second]}:{type:'PLAY_TURN_CARD',cardInstanceIds:[first,second]});
 expect(s.windows!.at(-1)!.kind).toBe('declaration');expect(s.players.A!.damage).toBe(8);expect(s.players.A!.hand).toHaveLength(count-2);
 expect(s.resolution).toEqual(expect.arrayContaining([first,second]));const firstAction=viewFor(s,'A').reactionTargetActionId!;
 s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:firstAction});
 for(let n=0;n<82;n++){const current=viewFor(s,'A').currentAction;if(current?.source==='card'&&current.cardInstanceId===second)break;if(n>80)throw Error('NEXT_CARD');s=pass(s);}
 expect(s.players.A!.damage).toBe(8);expect(s.discard.filter(id=>id===first)).toHaveLength(1);expect(s.resolution).toContain(second);
 expect(s.rolls?.filter(r=>r.purpose==='potion-recovery')??[]).toHaveLength(0);
 if(kind==='potion'){
  s=closeWindow(s,[4]);expect(s.rolls!.at(-1)).toMatchObject({purpose:'potion-recovery',formula:'d6',faces:[4]});
  s=closeWindow(JSON.parse(JSON.stringify(s)));
 }else s=closeWindow(JSON.parse(JSON.stringify(s)));
 expect(s.windows!.at(-1)!.kind).toBe('reclaim');expect(s.players.A!.damage).toBe(kind==='rest'?7:4);
 s=passReclaims(s);expect(s.windows).toEqual([]);expect(s.phase).toBe('hand-adjustment');
 for(const id of [first,second])expect(s.discard.filter(c=>c===id)).toHaveLength(1);
 expect(s.reclaimDecisions!.filter(d=>d.cardInstanceId===second)).toHaveLength(1);
 expect(s.players.A!.reclaimUsage?.['間合い／休息']).toBeUndefined();
});
it.each(['香具羅','魔導書','悪の魅力','聖光'])('%s installs only after a real declaration and cancellation leaves no attachment',name=>{
 let s=ready();character(s,'A',name==='悪の魅力'?'黒騎士ガーウィン':'大神官ジル');const card=handCard(s,'A',name),fate=handCard(s,'B','命運凶変');
 s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});expect(s.windows!.at(-1)!.kind).toBe('declaration');expect(s.players.A!.attachments).not.toContain(card);expect(s.resolution).toContain(card);
 const success=finish(s);expect(success.players.A!.attachments.filter(id=>id===card)).toHaveLength(1);expect(success.phase).toBe('hand-adjustment');
 const target=viewFor(s,'A').reactionTargetActionId!;s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:target});s=finish(s);
 expect(s.players.A!.attachments).not.toContain(card);expect(s.discard.filter(id=>id===card)).toHaveLength(1);expect(s.phase).toBe('hand-adjustment');
});
it('potion and rest cannot mix or repeat a physical source and rejected batches leave the entire hand unchanged',()=>{
 const s=ready();const rest=handCard(s,'A','間合い／休息'),potion=handCard(s,'A','回復の薬');
 for(const type of ['REST','PLAY_TURN_CARD'] as const)for(const cardInstanceIds of [[rest,potion],[potion,potion]]){
  const before=JSON.stringify(s);expect(transition(s,{actorId:'A',command:type==='REST'?{type:'REST',cardInstanceIds}:{type:'PLAY_TURN_CARD',cardInstanceIds}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
 }
});
it('successful potion siblings share their paid parent but store independent numeric rolls before each physical disposal',()=>{
 let s=ready();s.players.A!.damage=8;const cards=handCards(s,['A','A'],'回復の薬');
 s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:cards});const root=Object.values(s.actions!)[0]!.eventId;
 for(const [index,amount] of [2,5].entries()){
  s=closeWindow(JSON.parse(JSON.stringify(s)),[amount]);const roll=s.rolls!.at(-1)!;
  expect(roll).toMatchObject({eventId:root,purpose:'potion-recovery',faces:[amount],total:amount});
  expect(s.resolution).toContain(cards[index]);s=closeWindow(s);expect(s.windows!.at(-1)!.kind).toBe('reclaim');
  expect(s.players.A!.damage).toBe(index===0?6:1);s=passReclaims(s);
 }
 expect(s.rolls!.filter(r=>r.purpose==='potion-recovery').map(r=>r.faces)).toEqual([[2],[5]]);
 expect(s.phase).toBe('hand-adjustment');expect(s.resolution).toEqual([]);
});
