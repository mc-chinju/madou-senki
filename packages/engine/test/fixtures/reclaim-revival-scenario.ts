import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export function makeReclaimRevival(players:{id:string;name:string}[]){
 let s=createGame(players,entropy(),{startingSeat:0});
 const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 assignCharacter(s,a,'侍大将のシン');assignCharacter(s,b,'リーア姫');assignCharacter(s,c,'魔導王ガイナス');assignCharacter(s,d,'黒騎士ガーウィン');
 for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,spirit:20};
 for(const id of [b,c])s.players[id]!.damage=gameStats(s,id).endurance-1;
 const sword=takeCard(s,a,'天地百撃斬'),prayer=takeCard(s,b,'必勝の祈り'),gift=takeCard(s,c,'「これで勝ったと思うなよ」'),transfer=takeCard(s,c,'香具羅'),fate=takeCard(s,a,'命運凶変'),fusen=takeCard(s,d,'a2-p01-r1c1');
 s.players[d]!.hand=s.players[d]!.hand.filter(id=>id!==fusen);
 for(const id of s.seatOrder)trimHand(s,id,sword,prayer,gift,transfer,fate);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 // A chant refill, D short-hand refill and B prayer refill precede the death-gift child.
 s.deck.splice(3,0,fusen);
 for(const id of s.seatOrder)act(id,{type:'PASS_SETUP'});
 act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'CHANT',cardInstanceId:sword});
 for(let n=0;n<200;n++){
  const id=s.seatOrder[s.turnSeat]!;
  if(s.windows?.length)pass();
  else if(s.phase==='action'){if(id===a)break;act(id,{type:'PASS_ACTION'});}
  else if(s.phase==='withdrawal')act(id,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')act(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>![prayer,gift,transfer,fate].includes(x)).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});
  else if(s.phase==='turn-start')act(id,{type:'START_TURN'});
  else if(s.phase==='draw')act(id,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`REVIVAL_TURN_${s.phase}`);
 }
 act(a,{type:'ATTACK',cardInstanceId:sword,targetIds:[b,c],dedicated:true});
 for(let n=0;n<200;n++){const w=s.windows!.at(-1)!;if(w.kind==='effect-level'&&w.participants[w.cursor]===b)break;pass();}

 function act(actorId:string,command:GameCommand){
  const input={actorId,command},e=entropy(),r=transition(s,input,e);
  if(!r.ok)throw Error(`RECLAIM_REVIVAL_${command.type}_${r.code}`);
  if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('RECLAIM_REVIVAL_REPLAY');
  s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('RECLAIM_REVIVAL_CARDS');
 }
 function pass(){const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}
 return s;
}
