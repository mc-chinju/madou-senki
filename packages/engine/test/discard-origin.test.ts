import {expect,it} from 'vitest';
import {discardIds,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,passReclaims,ready,until} from './combat-helpers.js';
import {character,handCard,handCards} from './fixtures.js';

/** One pile entry, so a case can read the seat that let the card go and the face it left with. */
const entry=(s:GameState,id:string)=>s.discard.find(e=>e.cardInstanceId===id);

it('remembers the seat for a used card and for a card dropped from hand, and only shows the used one',()=>{
  let s=ready();const rest=handCard(s,'A','間合い／休息');
  s=finish(act(s,'A',{type:'REST',cardInstanceIds:[rest]}));
  expect(entry(s,rest)).toEqual({cardInstanceId:rest,ownerId:'A',faceUp:true});
  handCard(s,'A','兵士');handCard(s,'A','市民');
  const dropped=s.players.A!.hand.slice(5);expect(dropped).toHaveLength(2);
  s=finish(act(s,'A',{type:'END_TURN',discardIds:dropped}));
  for(const id of dropped)expect(entry(s,id)).toEqual({cardInstanceId:id,ownerId:'A',faceUp:false});
});

it('drops a follower placed face down without showing it, and a revealed one face up',()=>{
  let s=ready();const hidden=handCard(s,'A','兵士'),shown=handCard(s,'A','市民');
  s.players.A!.hand=s.players.A!.hand.filter(id=>id!==hidden&&id!==shown);
  s.players.A!.followers=[{cardInstanceId:hidden,revealed:false},{cardInstanceId:shown,revealed:true}];
  s=finish(act(s,'A',{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[]}));
  expect(entry(s,hidden)).toEqual({cardInstanceId:hidden,ownerId:'A',faceUp:false});
  expect(entry(s,shown)).toEqual({cardInstanceId:shown,ownerId:'A',faceUp:true});
});

it('leaves a dead seat owning the hand it lost, face down',()=>{
  let s=ready();character(s,'A','大神官ジル');s.players.A!.damage=9;
  const kill=handCard(s,'A','滅界');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==kill);
  s.players.A!.chants=[{cardInstanceId:kill,revealed:false}];
  const lost=[...s.players.B!.hand];
  s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:kill,targetIds:['B'],dedicated:false}));
  expect(s.players.B!.presence).toBe('dead');
  for(const id of lost)expect(entry(s,id)).toMatchObject({ownerId:'B',faceUp:false});
});

// The live attribution is completeAction's disposal, which reads distancePayments; finalizeDistance's
// own branch never runs today (see c1de19bc), so this watches the path a game actually takes.
it('gives the maai to the seat that paid it, not to the seat that approached',()=>{
  let s=ready();const [advance,second]=handCards(s,['A','A'],'踏み込み／殴る') as [string,string];const maai=handCard(s,'B','間合い／休息');
  s=act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:advance});
  s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:maai}));
  s=passReclaims(act(s,'A',{type:'PLAY_ADVANCE',cardInstanceId:second}));
  s=finish(act(s,'B',{type:'PASS'}));
  expect(entry(s,maai)).toEqual({cardInstanceId:maai,ownerId:'B',faceUp:true});
  expect(entry(s,advance)).toEqual({cardInstanceId:advance,ownerId:'A',faceUp:true});
  expect(viewFor(s,'B').self.discardedCardInstanceIds).toContain(maai);
  expect(viewFor(s,'A').self.discardedCardInstanceIds).not.toContain(maai);
});

// 魔招門 moves the placed card itself, so `placedById` still names the donor after the transfer. The
// pile follows the board the follower died on; only the reclaim right stays with the seat that placed it.
it('gives a transferred follower to the board it died on, not to the seat that placed it',()=>{
  let s=ready();character(s,'A','白魔術師シェリム');
  const follower=handCard(s,'B','兵士');s.players.B!.hand=s.players.B!.hand.filter(id=>id!==follower);
  s.players.B!.followers=[{cardInstanceId:follower,revealed:false,placedById:'B',placedLifeId:'initial-life:B'}];
  const gate=handCard(s,'A','魔招門');
  s=finish(act(s,'A',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:gate,targetIds:['B'],dedicated:false,followerTransfer:{targetPosition:0,destinationPosition:0}}));
  expect(s.players.A!.followers[0]).toMatchObject({cardInstanceId:follower,placedById:'B'});
  s=finish(act(s,'A',{type:'END_TURN',discardIds:[]}));
  s.phase='action';s.distances.B!.A='near';s.distances.A!.B='near';
  s=act(s,'B',{type:'ATTACK',cardInstanceId:handCard(s,'B','踏み込み／槍'),targetIds:['A'],dedicated:false});
  while(s.windows!.at(-1)!.kind!=='follower-start')s=pass(s);
  s=finish(pass(s));
  expect(entry(s,follower)).toEqual({cardInstanceId:follower,ownerId:'A',faceUp:true});
  expect(viewFor(s,'A').self.discardedCardInstanceIds).toContain(follower);
  expect(viewFor(s,'B').self.discardedCardInstanceIds).not.toContain(follower);
});

it('takes a reclaimed card back out of the pile',()=>{
  let s=ready();character(s,'A','大神官ジル');s.players.A!.damage=3;
  s=finish(act(s,'A',{type:'REST',cardInstanceIds:[handCard(s,'A','間合い／休息')]}));
  s.phase='action';
  const card=handCard(s,'A','封傷');
  s=until(act(s,'A',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:card,targetIds:['A'],dedicated:false}),'reclaim');
  const view=()=>s.reclaimDecisions!.at(-1)!;
  s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:view().id,claimId:`${view().id}-A-base`,choice:'take'});
  while(s.windows?.length)s=pass(s);
  expect(s.players.A!.hand).toContain(card);
  expect(discardIds(s)).not.toContain(card);
});
