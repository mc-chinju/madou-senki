import {expect,it} from 'vitest';
import {gameStats,transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {act,finish,pass,until} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {makeBasicAttachmentScenario} from './fixtures/basic-attachment-scenarios.js';
const rows=[['basic-attachment-warrior','a2-p03-r2c1','warrior_level'],['basic-attachment-magic','a2-p03-r3c1','magic_level'],['basic-attachment-evil','a2-p03-r3c2','spirit'],['basic-attachment-good','a2-p03-r3c3','spirit']] as const;
const players=['A','B','C','D'].map(id=>({id,name:id}));
function rejected(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}

it.each(rows)('%s installs exact %s on its user and increases only %s by one after resolution',(scenario,card,stat)=>{
 let s=makeBasicAttachmentScenario(scenario,players);const before=gameStats(s,'A'),others=gameStats(s,'B');
 rejected(s,'B',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});rejected(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card,card]});
 s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});expect(gameStats(s,'A')).toEqual(before);expect(s.resolution).toContain(card);expect(s.players.A!.hand).not.toContain(card);
 s=finish(s);expect(gameStats(s,'A')).toEqual({...before,[stat]:before[stat]+1});expect(gameStats(s,'B')).toEqual(others);
 expect(s.players.A!.attachments.filter(id=>id===card)).toHaveLength(1);expect(discardIds(s)).not.toContain(card);expect(s.resolution).not.toContain(card);expect(s.phase).toBe('hand-adjustment');
 for(const actor of s.seatOrder)expect(viewFor(s,actor).players.A!.attachments).toContain(card);
 expect(viewFor(s,'A').self.stats[stat]).toBe(before[stat]+1);
 rejected(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});rejected(s,'A',{type:'PASS_ACTION'});
});

it.each(rows)('%s cancellation discards exact %s without adding %s or reopening the action',(scenario,card,stat)=>{
 let s=makeBasicAttachmentScenario(scenario,players);const before=gameStats(s,'A');
 s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});const action=s.windows!.at(-1)!.continuation.id;s=pass(s);
 s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:action});s=finish(s);
 expect(gameStats(s,'A')[stat]).toBe(before[stat]);expect(s.players.A!.attachments).not.toContain(card);
 expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);expect(s.players.A!.hand).not.toContain(card);expect(s.phase).toBe('hand-adjustment');
});

it.each(rows)('%s actual later opponent Wish takes %s into hand and removes its installed %s bonus',(scenario,card,stat)=>{
 let s=makeBasicAttachmentScenario(scenario,players);const before=gameStats(s,'A'),recipient=gameStats(s,'B');
 s=finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]}));expect(gameStats(s,'A')[stat]).toBe(before[stat]+1);
 s=finish(act(s,'A',{type:'END_TURN',discardIds:[]}));s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});
 s=until(act(s,'B',{type:'PLAY_TURN_CARD',cardInstanceId:'a2-p04-r3c2',mode:'wish'}),'wish');
 const decision=viewFor(s,'B').wish!;expect(decision.publicSources).toEqual(expect.arrayContaining([expect.objectContaining({cardInstanceId:card,ownerId:'A',zone:'attachments'})]));
 s=finish(act(s,'B',{type:'CHOOSE_WISH',decisionId:decision.decisionId,source:{kind:'public',cardInstanceId:card}}));
 expect(s.players.A!.attachments).not.toContain(card);expect(s.players.B!.attachments).not.toContain(card);expect(s.players.B!.hand.filter(id=>id===card)).toHaveLength(1);
 expect(gameStats(s,'A')).toEqual(before);expect(gameStats(s,'B')).toEqual(recipient);expect(discardIds(s)).not.toContain(card);expect(s.phase).toBe('hand-adjustment');
});

it.each([['basic-attachment-evil','a2-p03-r3c2','GOOD'],['basic-attachment-good','a2-p03-r3c3','EVIL']] as const)('%s rejects %s used by the opposite %s faction without paying',(scenario,card,faction)=>{
 const s=makeBasicAttachmentScenario(scenario,players,true);expect(s.players.A!.faction).toBe(faction);
 rejected(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[card]});expect(s.players.A!.hand).toContain(card);expect(s.players.A!.attachments).not.toContain(card);
});
