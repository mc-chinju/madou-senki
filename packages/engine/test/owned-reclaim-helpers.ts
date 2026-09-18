import {getAction} from '@madou/catalog';
import {createGame,gameStats,viewFor,techniqueFor,type GameState} from '../src/index.js';
import {act,finish,pass,ready,until,readySetup} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';
import {makeResurrectionPhysicalScenario} from '../../../apps/worker/test/fixtures/resurrection-physical-scenarios.js';
import {legalAttackTargets} from '../src/combat/legality.js';

export interface OwnedReclaimTable {state:GameState;ownerId:string}

export function makeOwnedReclaimTable(owner:string,cardId:string,additionalIds:string[]=[],lifetime=false ):OwnedReclaimTable {
 if(!lifetime&&getAction(cardId)?.name==='復活')return {state:makeResurrectionPhysicalScenario('resurrection-ordinary',['A','B','C','D'].map(id=>({id,name:id})),{owner}),ownerId:'A'};
 if(!getAction(cardId))throw Error('UNKNOWN_OWNED_CARD');
 let s:GameState;
 if(lifetime){s=createGame(['A','B','C','D','E','F'].map(id=>({id,name:id})),entropy(),{startingSeat:0});s=readySetup(s);s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});}else s=ready();character(s,'A',owner);character(s,'C','リーア姫');character(s,'D','魔導王ガイナス');
 character(s,'B',s.players.A!.faction==='GOOD'?'魔導王ガイナス':'白魔術師シェリム');
 const profile=techniqueFor(cardId);
 const name=getAction(cardId)!.name;
 if(['神性介入','命運凶変','人質'].includes(name)){handCard(s,'B','狼牙');handCard(s,'B',name==='神性介入'?'呪歌':'剛戦斧');}
 if(['勇気','ソロモン王の護符'].includes(name)){character(s,'B','魔聖母ディア');handCard(s,'A','白輪');handCard(s,'A','白光');}
 if(getAction(cardId)!.category==='follower'){character(s,'B','破壊神ヴァンミール');handCard(s,'B','滅界');}
 if(name==='赤い水晶球'){character(s,'B','占星術師のアルセイル');handCard(s,'B','命運凶変');}
 if(name==='おまえはだまされている'){character(s,'C','黒騎士ガーウィン');s.players.B!.revealed=true;s.players.C!.revealed=true;}
 if(profile?.range==='none'&&!profile.turnEffect){handCard(s,'B','氷矢');handCard(s,'B','凍流');}
 // Arrange this exact physical copy in the initial deal; never mint a copy.
 for(const id of [cardId,...additionalIds]){
  s.deck=s.deck.filter(x=>x!==id);s.discard=s.discard.filter(x=>x!==id);
  for(const p of Object.values(s.players)){p.hand=p.hand.filter(x=>x!==id);p.open=p.open.filter(x=>x!==id);}
  s.players.A!.hand.push(id);
 }
 // Keep repeated-use scenarios alive; recovery behavior is independent of endurance.
 for(const p of Object.values(s.players))p.permanent={...p.permanent,endurance:100};
 if(lifetime){
  character(s,'E',s.players.A!.faction==='GOOD'?'餓狼ヨーツルム':'大神官ジル');character(s,'F','破壊神ヴァンミール');
  s.players.E!.permanent={endurance:100,spirit:100,magic_level:100};
  handCard(s,'E',s.players.A!.faction==='GOOD'?'餓狼':'気破');handCard(s,'F','祈願');
  if(owner==='邪祭ウーノス')handCard(s,'A',getAction('a2-p05-r1c1')!.name);
  // Fix OPEN placement before play; revival is later triggered by a real wish.
  const open='a2-p01-r1c1';for(const p of Object.values(s.players)){p.hand=p.hand.filter(id=>id!==open);p.open=p.open.filter(id=>id!==open);}
  s.discard=s.discard.filter(id=>id!==open);s.deck=s.deck.filter(id=>id!==open);s.deck.push(open);
  s.distances.E!.B=s.distances.B!.E='near';
  if(name==='おまえはだまされている')character(s,'C','リーア姫');
  s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 }
 for(const id of s.seatOrder.filter(id=>id!=='A')){s.distances.A![id]='near';s.distances[id]!.A='near';}
 return {state:s,ownerId:'A'};
}

export function currentReclaimWindow(s:GameState,ownerId:string){
 if(s.windows?.at(-1)?.kind!=='reclaim')return null;
 const choice=viewFor(s,ownerId).reclaim;
 return choice?.pendingActorId===ownerId?choice:null;
}

export function nextOwnAction(table:OwnedReclaimTable,keep:string):GameState {
 let s=table.state;
 for(let n=0;n<300;n++){
  if(s.outcome)throw Error('OWNED_GAME_COMPLETE');
  if(s.windows?.length){s=pass(s);continue;}
  const actor=s.seatOrder[s.turnSeat]!;
  if(s.phase==='action'&&actor===table.ownerId)return s;
  if(s.phase==='action')s=act(s,actor,{type:'PASS_ACTION'});
  else if(s.phase==='withdrawal')s=act(s,actor,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment'){
   const hand=s.players[actor]!.hand,count=Math.max(0,hand.length-gameStats(s,actor).handLimit);
   s=finish(act(s,actor,{type:'END_TURN',discardIds:hand.filter(id=>getAction(id)!.name!==getAction(keep)!.name&&!['氷矢','凍流','狼牙','剛戦斧','呪歌','白輪','白光','命運凶変','滅界','気破','餓狼','祈願',getAction('a2-p05-r1c1')!.name].includes(getAction(id)!.name)).slice(0,count)}));
  }else if(s.phase==='turn-start')s=act(s,actor,{type:'START_TURN'});
  else if(s.phase==='draw')s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`OWNED_PHASE_${s.phase}`);
 }
 throw Error('OWNED_ACTION_LIMIT');
}

export function playOwnedCardToDiscard(table:OwnedReclaimTable,cardId:string):GameState {
 let s=nextOwnAction(table,cardId);
 if(getAction(cardId)!.category!=='follower'&&techniqueFor(cardId)?.chant){
  s=act(s,table.ownerId,{type:'CHANT',cardInstanceId:cardId});
  s=nextOwnAction({...table,state:s},cardId);
 }
 const profile=techniqueFor(cardId);
 const name=getAction(cardId)!.name;
 if(getAction(cardId)!.category==='follower'){
  s=act(s,table.ownerId,{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[cardId]});
  s=nextOwnAction({state:s,ownerId:'B'},cardId);
  s=act(s,'B',{type:'CHANT',cardInstanceId:'a2-p13-r2c3'});
  s=nextOwnAction({state:s,ownerId:'B'},cardId);
  s=act(s,'B',{type:'ATTACK',cardInstanceId:'a2-p13-r2c3',targetIds:[table.ownerId],dedicated:false});
 }else if(name==='赤い水晶球'){
  // A successful attachment stays in play. Only an actual canceled use disposes it here.
  s=act(s,table.ownerId,{type:'PLAY_TURN_CARD',cardInstanceId:cardId});
  const source=s.windows!.at(-1)!.continuation.id;
  while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);
  s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:source});
 }else if(['勇気','ソロモン王の護符'].includes(name)){
  const incoming=s.players[table.ownerId]!.hand.find(id=>['白輪','白光'].includes(getAction(id)!.name))!;
  s=until(act(s,table.ownerId,{type:'ATTACK',cardInstanceId:incoming,targetIds:['B'],dedicated:false}),'normal-defense');
  if(!s.players.B!.revealed)s=act(s,'B',{type:'REVEAL_CHARACTER'});
  const ability=viewFor(s,'B').abilityOptions.find(o=>o.abilityId==='c2-p06-r1c2-ab01')!;
  s=act(s,'B',{type:'USE_ABILITY',abilityId:ability.abilityId,targetEventId:ability.targetEventId});
  for(let n=0;n<300;n++){
   const option=viewFor(s,table.ownerId).anytimeCardOptions.find(o=>o.cardInstanceId===cardId);
   if(option){s=act(s,table.ownerId,{type:'PLAY_ANYTIME_CARD',cardInstanceId:cardId,targetEventId:option.targetEventId});break;}
   s=pass(s);
  }
 }else if(['神性介入','命運凶変','人質'].includes(name)){
  s=nextOwnAction({state:s,ownerId:'B'},cardId);
  const incoming=s.players.B!.hand.find(id=>['狼牙',name==='神性介入'?'呪歌':'剛戦斧'].includes(getAction(id)!.name))!;
  s=act(s,'B',{type:'ATTACK',cardInstanceId:incoming,targetIds:[table.ownerId],dedicated:false});
  for(let n=0;n<300;n++){
   const v=viewFor(s,table.ownerId),w=s.windows?.at(-1);
   if(name==='人質'){const option=v.anytimeCardOptions.find(o=>o.cardInstanceId===cardId);if(option){s=act(s,table.ownerId,{type:'PLAY_ANYTIME_CARD',cardInstanceId:cardId,targetEventId:option.targetEventId});break;}}
   else if(w?.participants[w.cursor]===table.ownerId&&w.kind===(name==='神性介入'?'after-roll':'declaration')){
    s=act(s,table.ownerId,name==='神性介入'?{type:'PLAY_REACTION',cardInstanceId:cardId,mode:'reroll',targetRollId:w.continuation.id}:{type:'PLAY_REACTION',cardInstanceId:cardId,mode:'cancel',targetActionId:w.continuation.id});break;
   }
   s=pass(s);
  }
 }else if(name==='おまえはだまされている'||name==='遠見の水晶球'){
  const target=name==='おまえはだまされている'?s.seatOrder.find(id=>id!==table.ownerId&&s.players[id]!.faction==='EVIL')!:'B';
  s=act(s,table.ownerId,{type:'PLAY_TURN_CARD',cardInstanceId:cardId,targetId:target});
 }else if(profile?.range==='none'&&!profile.turnEffect){
  s=nextOwnAction({state:s,ownerId:'B'},cardId);
  const incoming=s.players.B!.hand.find(id=>['氷矢','凍流'].includes(getAction(id)!.name));
  if(!incoming)throw Error('OWNED_INCOMING_MISSING');
  s=until(act(s,'B',{type:'ATTACK',cardInstanceId:incoming,targetIds:[table.ownerId],dedicated:false}),'normal-defense');
  s=act(s,table.ownerId,{type:'PLAY_DEFENSE',cardInstanceId:cardId,dedicated:false});
 }else if(profile?.turnEffect){
  s=act(s,table.ownerId,{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:cardId,targetIds:[profile.turnEffect==='revive'?s.seatOrder.find(id=>s.players[id]!.presence==='dead')!:table.ownerId],dedicated:false});
 }else{
  const targets=profile?legalAttackTargets(s,table.ownerId,profile):['B'];
  s=act(s,table.ownerId,{type:'ATTACK',cardInstanceId:cardId,targetIds:profile?.mandatoryAll?targets:targets.slice(0,1),dedicated:false});
 }
 for(let n=0;n<300;n++){
  const choice=currentReclaimWindow(s,table.ownerId);
  if(choice?.cardInstanceId===cardId)return s;
  if(name==='赤い水晶球'){
   const other=currentReclaimWindow(s,'B');
   const base=other?.cardInstanceId==='a2-p02-r2c3'?other.claims.find(c=>c.right==='base'):undefined;
   if(base){s=act(s,'B',{type:'CHOOSE_RECLAIM',decisionId:other!.decisionId,choice:'take',claimId:base.claimId});continue;}
  }
  if(!s.windows?.length)throw Error(`OWNED_NO_DISPOSITION_${cardId}`);
  s=pass(s);
 }
 throw Error('OWNED_DISPOSITION_LIMIT');
}

/** Return the support attack once, so a second real follower death can be exercised. */
export function finishOwnedResolution(s:GameState):GameState {
 for(let n=0;n<500;n++){
  if(!s.windows?.length)return s;
  const choice=currentReclaimWindow(s,'B');
  const base=choice?.cardInstanceId==='a2-p13-r2c3'?choice.claims.find(c=>c.right==='base'):undefined;
  s=base?act(s,'B',{type:'CHOOSE_RECLAIM',decisionId:choice!.decisionId,choice:'take',claimId:base.claimId}):pass(s);
 }
 throw Error('OWNED_FINISH_LIMIT');
}

/** Lethal attack support is arranged before the first reclaim; no post-use fixture mutation. */
export function killOwnedLifetimePlayer(s:GameState,targetId:string):GameState {
 const card=s.players.E!.hand.find(id=>['気破','餓狼'].includes(getAction(id)!.name))!;
 s=nextOwnAction({state:s,ownerId:'E'},card);
 if(techniqueFor(card)?.chant){s=act(s,'E',{type:'CHANT',cardInstanceId:card});s=nextOwnAction({state:s,ownerId:'E'},card);}
 s=act(s,'E',{type:'ATTACK',cardInstanceId:card,targetIds:[targetId],dedicated:getAction(card)!.name==='気破'});
 for(let n=0;n<500;n++){
  if(!s.windows?.length)return s;
  const choice=currentReclaimWindow(s,'E'),base=choice?.claims.find(c=>c.right==='base');
  s=base?act(s,'E',{type:'CHOOSE_RECLAIM',decisionId:choice!.decisionId,choice:'take',claimId:base.claimId}):pass(s);
 }
 throw Error('OWNED_DEATH_LIMIT');
}
export function reviveOwnedLifetimePlayer(s:GameState,targetId:string):GameState {
 const wish=s.players.F!.hand.find(id=>getAction(id)!.name==='祈願')!;
 s=nextOwnAction({state:s,ownerId:'F'},wish);
 s=until(act(s,'F',{type:'PLAY_TURN_CARD',cardInstanceId:wish,mode:'wish'}),'wish');
 s=act(s,'F',{type:'CHOOSE_WISH',decisionId:viewFor(s,'F').wish!.decisionId,source:{kind:'deck',cardName:getAction('a2-p01-r1c1')!.name}});
 for(let n=0;n<500;n++){
  const w=s.windows?.at(-1);if(!w)return s;
  if(w.kind==='revival'&&w.participants[w.cursor]===targetId)s=act(s,targetId,{type:'CHOOSE_REVIVAL',revive:true});
  else if(w.kind==='re-setup')s=act(s,w.participants[w.cursor]!,{type:'PASS_SETUP'});
  else s=pass(s);
 }
 throw Error('OWNED_REVIVAL_LIMIT');
}
