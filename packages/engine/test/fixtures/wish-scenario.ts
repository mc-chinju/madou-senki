import {allCardInstanceIds,createGame,transition,viewFor,type GameState,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const wishScenarioNames=['reclaim-wish','reclaim-wish-open'] as const;
/** Initial deal/OPEN only; actual CHANT and installation prepare the public acquisition sources. */
export function makeWishScenario(players:{id:string;name:string}[],open=false):GameState{
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 assignCharacter(s,a,'侍大将のシン');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'忍びのイダ');assignCharacter(s,d,'吟遊詩人のレスター');
 const wishes=['a2-p04-r3c2','a2-p04-r3c3'].map(id=>takeCard(s,a,id));const book=takeCard(s,b,'魔導書'),chants=['天地百撃斬','天地爆砕剣'].map(name=>takeCard(s,b,name)),fate=takeCard(s,c,'命運凶変'),haja=takeCard(s,b,'賢者ハジャ');
 s.players[b]!.hand=s.players[b]!.hand.filter(id=>id!==haja);s.players[b]!.open.push(haja);trimHand(s,a,...wishes);trimHand(s,b,book,...chants);trimHand(s,c,fate);
 const act=(actorId:string,command:GameCommand)=>{const r=transition(s,{actorId,command},entropy());if(!r.ok)throw Error(`WISH_FIXTURE_${r.code}`);s=r.state;};
 for(const id of [a,b,c,d])act(id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 for(let round=0;round<3;round++){
  act(a,{type:'PASS_ACTION'});
  for(let n=0;n<4;n++){
   const current=s.seatOrder[s.turnSeat]!,keep=current===a?wishes:current===b?[book,...chants]:current===c?[fate]:[];
   act(current,{type:'END_TURN',discardIds:s.players[current]!.hand.filter(id=>!keep.includes(id)).slice(0,Math.max(0,s.players[current]!.hand.length-viewFor(s,current).self.stats.handLimit))});
   const next=s.seatOrder[s.turnSeat]!;act(next,{type:'START_TURN'});act(next,{type:'CHOOSE_DRAW',draw:false});
   if(next===b){if(round<2)act(b,{type:'CHANT',cardInstanceId:chants[round]!});else{act(b,{type:'PLAY_TURN_CARD',cardInstanceIds:[book]});for(let limit=0;s.windows?.length&&limit<100;limit++){const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}}}
   else if(next!==a)act(next,{type:'PASS_ACTION'});
  }
 }
 if(open){const id=takeCard(s,d,'a2-p01-r1c1');s.players[d]!.hand=s.players[d]!.hand.filter(x=>x!==id);for(const zone of ['hand','open','attachments'] as const){s.discard.push(...s.players[d]![zone]);s.players[d]![zone]=[];}s.discard.push(...s.players[d]!.followers.map(c=>c.cardInstanceId),...s.players[d]!.chants.map(c=>c.cardInstanceId));s.players[d]!.followers=[];s.players[d]!.chants=[];s.players[d]!.presence='dead';s.deck.unshift(id);}
 if(new Set(allCardInstanceIds(s)).size!==220||!wishes.every(id=>s.players[a]!.hand.includes(id))||s.players[b]!.chants.length!==2||!s.players[b]!.attachments.includes(book))throw Error('WISH_FIXTURE_STATE');return s;
}
