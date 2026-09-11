import {getAction} from '@madou/catalog';
import {gameStats,viewFor,techniqueFor,type GameState} from '../src/index.js';
import {act,finish,pass,ready} from './combat-helpers.js';
import {character} from './fixtures.js';

export interface OwnedReclaimTable {state:GameState;ownerId:string}

export function makeOwnedReclaimTable(owner:string,cardId:string):OwnedReclaimTable {
 const s=ready();character(s,'A',owner);character(s,'C','リーア姫');character(s,'D','魔導王ガイナス');
 if(!getAction(cardId))throw Error('UNKNOWN_OWNED_CARD');
 // Arrange this exact physical copy in the initial deal; never mint a copy.
 s.deck=s.deck.filter(id=>id!==cardId);s.discard=s.discard.filter(id=>id!==cardId);
 for(const p of Object.values(s.players)){p.hand=p.hand.filter(id=>id!==cardId);p.open=p.open.filter(id=>id!==cardId);}
 s.players.A!.hand.push(cardId);return {state:s,ownerId:'A'};
}

export function currentReclaimWindow(s:GameState,ownerId:string){
 if(s.windows?.at(-1)?.kind!=='reclaim')return null;
 const choice=viewFor(s,ownerId).reclaim;
 return choice?.pendingActorId===ownerId?choice:null;
}

function nextOwnAction(table:OwnedReclaimTable,keep:string):GameState {
 let s=table.state;
 for(let n=0;n<80;n++){
  if(s.outcome)throw Error('OWNED_GAME_COMPLETE');
  if(s.windows?.length){s=pass(s);continue;}
  const actor=s.seatOrder[s.turnSeat]!;
  if(s.phase==='action'&&actor===table.ownerId)return s;
  if(s.phase==='action')s=act(s,actor,{type:'PASS_ACTION'});
  else if(s.phase==='withdrawal')s=act(s,actor,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment'){
   const hand=s.players[actor]!.hand,count=Math.max(0,hand.length-gameStats(s,actor).handLimit);
   s=finish(act(s,actor,{type:'END_TURN',discardIds:hand.filter(id=>id!==keep).slice(0,count)}));
  }else if(s.phase==='turn-start')s=act(s,actor,{type:'START_TURN'});
  else if(s.phase==='draw')s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`OWNED_PHASE_${s.phase}`);
 }
 throw Error('OWNED_ACTION_LIMIT');
}

export function playOwnedCardToDiscard(table:OwnedReclaimTable,cardId:string):GameState {
 let s=nextOwnAction(table,cardId);
 if(techniqueFor(cardId)?.chant){
  s=act(s,table.ownerId,{type:'CHANT',cardInstanceId:cardId});
  s=nextOwnAction({...table,state:s},cardId);
 }
 s=act(s,table.ownerId,{type:'ATTACK',cardInstanceId:cardId,targetIds:['B'],dedicated:false});
 for(let n=0;n<300;n++){
  const choice=currentReclaimWindow(s,table.ownerId);
  if(choice?.cardInstanceId===cardId)return s;
  if(!s.windows?.length)throw Error(`OWNED_NO_DISPOSITION_${cardId}`);
  s=pass(s);
 }
 throw Error('OWNED_DISPOSITION_LIMIT');
}
