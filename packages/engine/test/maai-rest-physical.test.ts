import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,passReclaims,ready,until} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {assignCharacter,takeCard,trimHand} from './fixtures/scenario-tools.js';

function prepared(card:string,owner='A'){
 const s=ready();assignCharacter(s,'A','侍大将のシン');assignCharacter(s,'B','黒騎士ガーウィン');
 assignCharacter(s,'C','魔聖母ディア');assignCharacter(s,'D','魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,warrior_level:20};
 s.players.A!.damage=5;s.players.B!.damage=3;
 takeCard(s,owner,card);trimHand(s,owner,card);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 return s;
}
function rejected(s:GameState,actorId:string,command:unknown){
 const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));
 expect(transition(s,{actorId,command} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);
 expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);
}

it.each(['a2-p07-r1c1','a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1','a2-p07-r2c2','a2-p07-r2c3','a2-p07-r3c1','a2-p07-r3c2'])('Physical %s rest heals only its user by one and consumes the ordinary action',card=>{
 let s=prepared(card);const otherDamage=s.players.B!.damage;
 rejected(s,'B',{type:'REST',cardInstanceIds:[card]});
 rejected(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});
 s=act(s,'A',{type:'REST',cardInstanceIds:[card]});
 expect(s.players.A!.damage).toBe(5);expect(s.resolution).toContain(card);expect(s.players.A!.hand).not.toContain(card);
 rejected(s,'A',{type:'PLAY_MAAI',cardInstanceId:card});
 s=finish(s);expect(s.players.A!.damage).toBe(4);expect(s.players.B!.damage).toBe(otherDamage);
 expect(s.phase).toBe('hand-adjustment');expect(s.discard.filter(id=>id===card)).toHaveLength(1);
 rejected(s,'A',{type:'REST',cardInstanceIds:[card]});rejected(s,'A',{type:'PASS_ACTION'});
 expect(s.players.A!.reclaimUsage?.['間合い／休息']).toBeUndefined();
});

it.each(['a2-p07-r1c1','a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1','a2-p07-r2c2','a2-p07-r2c3','a2-p07-r3c1','a2-p07-r3c2'])('Physical %s rest combines distinct copies and heals their count without accepting a duplicate',card=>{
 let s=prepared(card);const second=card==='a2-p07-r1c1'?'a2-p07-r1c2':'a2-p07-r1c1';
 takeCard(s,'A',second);trimHand(s,'A',card,second);
 rejected(s,'A',{type:'REST',cardInstanceIds:[card,card]});
 s=act(s,'A',{type:'REST',cardInstanceIds:[card,second]});
 expect(s.resolution).toEqual(expect.arrayContaining([card,second]));
 expect(s.players.A!.damage).toBe(5);
 s=finish(s);expect(s.players.A!.damage).toBe(3);expect(s.players.B!.damage).toBe(3);
 expect(s.phase).toBe('hand-adjustment');
 for(const id of [card,second])expect(s.discard.filter(value=>value===id)).toHaveLength(1);
});

it.each(['a2-p07-r1c1','a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1','a2-p07-r2c2','a2-p07-r2c3','a2-p07-r3c1','a2-p07-r3c2'])('Physical %s maai evades an actual incoming hit without applying rest healing',card=>{
 let s=prepared(card,'B');const attack=takeCard(s,'A','踏み込み／弓');trimHand(s,'A',attack);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');
 rejected(s,'B',{type:'REST',cardInstanceIds:[card]});
 s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:card}));
 expect(s.windows!.at(-1)!.kind).toBe('defense-advance');
 expect(s.players.B!.damage).toBe(3);s=finish(s);
 expect(s.players.B!.damage).toBe(3);expect(s.players.A!.damage).toBe(5);
 expect(s.discard.filter(id=>id===card)).toHaveLength(1);expect(s.phase).toBe('withdrawal');
 expect(s.players.B!.reclaimUsage?.['間合い／休息']).toBeUndefined();
});

it.each(['a2-p07-r1c1','a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1','a2-p07-r2c2','a2-p07-r2c3','a2-p07-r3c1','a2-p07-r3c2'])('Physical %s canceled rest remains paid while the second batch copy heals once',card=>{
 let s=prepared(card);const second=card==='a2-p07-r1c1'?'a2-p07-r1c2':'a2-p07-r1c1';
 takeCard(s,'A',second);trimHand(s,'A',card,second);const fate=takeCard(s,'B','命運凶変');trimHand(s,'B',fate);
 s=act(s,'A',{type:'REST',cardInstanceIds:[card,second]});const action=s.windows!.at(-1)!.continuation.id;
 s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:action});
 s=finish(s);expect(s.players.A!.damage).toBe(4);expect(s.players.B!.damage).toBe(3);
 for(const id of [card,second,fate])expect(s.discard.filter(value=>value===id)).toHaveLength(1);
 expect(s.phase).toBe('hand-adjustment');expect(s.windows).toEqual([]);
});
