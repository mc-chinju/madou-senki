import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {gameStats,transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,passReclaims,ready,until} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {assignCharacter,takeCard,trimHand} from '../../../apps/worker/test/fixtures/scenario-tools.js';

// Printed values and actual owners are explicit; this table is not inferred from runtime factories.
const rows=[
 ['a2-p23-r1c2','near',1,1,'格','大神官ジル','a2-p23-r1c3'],
 ['a2-p23-r1c3','near',1,1,'格','大神官ジル','a2-p23-r1c2'],
 ['a2-p23-r2c1','near',1,1,'格','大神官ジル','a2-p23-r1c2'],
 ['a2-p23-r2c2','near',1,1,'格','大神官ジル','a2-p23-r1c2'],
 ['a2-p23-r2c3','near',1,2,'格','大神官ジル','a2-p23-r3c1'],
 ['a2-p23-r3c1','near',1,2,'格','大神官ジル','a2-p23-r2c3'],
 ['a2-p23-r3c2','near',1,2,'格','大神官ジル','a2-p23-r2c3'],
 ['a2-p24-r1c2','far',3,4,'弓','妖精王フューリー','a2-p24-r1c3'],
 ['a2-p24-r1c3','far',3,4,'弓','妖精王フューリー','a2-p24-r1c2'],
 ['a2-p24-r2c1','far',3,4,'弓','妖精王フューリー','a2-p24-r1c2'],
 ['a2-p24-r2c2','far',3,4,'弓','妖精王フューリー','a2-p24-r1c2'],
 ['a2-p24-r2c3','far',3,4,'弓','妖精王フューリー','a2-p24-r1c2'],
 ['a2-p25-r1c3','near',3,4,'斧','小人のランバ','a2-p25-r2c1'],
 ['a2-p25-r2c1','near',3,4,'斧','小人のランバ','a2-p25-r1c3'],
] as const;
function prepared(card:string,owner='侍大将のシン'){
 const s=ready();assignCharacter(s,'A',owner);assignCharacter(s,'B','黒騎士ガーウィン');assignCharacter(s,'C','魔聖母ディア');assignCharacter(s,'D','魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,warrior_level:20};
 takeCard(s,'A',card);trimHand(s,'A',card);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];return s;
}
function rejected(s:GameState,actorId:string,command:unknown){
 const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));
 expect(transition(s,{actorId,command} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);
 expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);
}
function approachWithAnother(s:GameState,card:string){
 const marker=card==='a2-p24-r1c2'?'a2-p24-r1c3':'a2-p24-r1c2';takeCard(s,'A',marker);trimHand(s,'A',card,marker);
 return finish(act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:marker}));
}

it.each(rows)('Physical %s attack uses its printed range level damage and warrior attribute', (card,range,level,damage,attribute)=>{
 for(const deficit of [0,1]){
  let s=prepared(card);s.players.A!.permanent!.warrior_level!+=level-deficit-gameStats(s,'A').warrior_level;
  expect(gameStats(s,'A').warrior_level).toBe(level-deficit);
  if(range==='near'){
   rejected(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});
   s=approachWithAnother(s,card);
  }
  const distances=structuredClone(s.distances);
  s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});
  const action=Object.values(s.actions!)[0]!;
  expect(action.technique).toMatchObject({range,useLevel:level,effectLevel:level,damage,school:'warrior',attributes:[range==='near'?'近':'遠','戦',attribute]});
  expect(action.checks).toHaveLength(deficit);
  s=finish(s);expect(s.players.B!.damage).toBe(damage);expect(s.players.A!.damage).toBe(0);
  expect(s.rolls?.filter(r=>r.purpose==='excess-level')??[]).toHaveLength(deficit);
  expect(s.distances).toEqual(distances);expect(s.phase).toBe('withdrawal');
  expect(s.discard.filter(id=>id===card)).toHaveLength(1);
  rejected(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:card});
 }
});

it.each(rows)('Physical %s approach becomes one near marker without also attacking',card=>{
 let s=prepared(card);s=finish(act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:card}));
 expect(s.distances.A!.B).toBe('near');expect(s.distances.B!.A).toBe('near');expect(s.phase).toBe('action');
 expect(Object.values(s.distanceMarkers!)).toEqual([{a:'A',b:'B',ownerId:'A',cardInstanceId:card}]);
 expect(s.players.B!.damage).toBe(0);expect(s.players.A!.hand).not.toContain(card);expect(s.discard).not.toContain(card);
 rejected(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});
 rejected(s,'A',{type:'APPROACH',targetId:'C',cardInstanceId:card});
});

it.each(rows)('Physical %s advance cancels actual combat maai with one payment and no distance movement',card=>{
 let s=prepared(card);const attack=takeCard(s,'A','a2-p07-r3c3'),maai=takeCard(s,'B','a2-p07-r1c1');trimHand(s,'A',card,attack);trimHand(s,'B',maai);const distances=structuredClone(s.distances);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');
 s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai}));
 s=passReclaims(act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:card}));
 rejected(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:card});
 s=finish(s);expect(s.players.B!.damage).toBe(10);expect(s.distances).toEqual(distances);
 expect(Object.values(s.distanceMarkers??{})).toEqual([]);
 expect(s.discard.filter(id=>id===card)).toHaveLength(1);expect(s.players.A!.reclaimUsage?.[getAction(card)!.name]).toBeUndefined();
});

it.each(rows)('Physical %s owned attack retains its base recovery after a same-name advance was discarded', (card,range,_level,damage,_attribute,owner,spare)=>{
 let s=prepared(card,owner);takeCard(s,'A',spare);trimHand(s,'A',card,spare);const maai=takeCard(s,'B','a2-p07-r1c1');trimHand(s,'B',maai);
 const name=getAction(card)!.name;expect(getAction(spare)!.name).toBe(name);
 s=act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:spare});s=act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai});
 s=until(s,'reclaim');expect(viewFor(s,'A').reclaim!.cardInstanceId).toBe(spare);
 expect(viewFor(s,'A').reclaim!.claims).toEqual([]);s=finish(s);
 expect(s.players.A!.reclaimUsage?.[name]).toBeUndefined();expect(s.discard).toContain(spare);
 if(range==='near')s=approachWithAnother(s,card);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'reclaim');
 expect(s.players.B!.damage).toBe(damage);const d=viewFor(s,'A').reclaim!,claim=d.claims.find(c=>c.right==='base');
 expect(d.cardInstanceId).toBe(card);expect(claim).toBeDefined();
 s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:claim!.claimId});s=finish(s);
 expect(s.players.A!.hand.filter(id=>id===card)).toHaveLength(1);expect(s.discard).not.toContain(card);
 expect(s.players.A!.reclaimUsage?.[name]?.baseSpent).toBe(true);expect(s.phase).toBe('withdrawal');
 rejected(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});
});
