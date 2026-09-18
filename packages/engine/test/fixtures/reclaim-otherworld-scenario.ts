import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';

export function makeReclaimOtherworld(players:{id:string;name:string}[]){
 let s=createGame(players,entropy(),{startingSeat:0});
 const [a,b]=players.map(p=>p.id) as [string,string];
 assignCharacter(s,a,'白魔術師シェリム');assignCharacter(s,b,'リーア姫');
 for(const p of Object.values(s.players))p.permanent={endurance:100};
 s.players[a]!.permanent!.magic_level=20;
 s.players[b]!.permanent!.spirit=-gameStats(s,b).spirit;
 const rift=takeCard(s,a,'a2-p14-r2c2'),prayer=takeCard(s,b,'a2-p05-r2c3');
 for(const p of players)trimHand(s,p.id,rift,prayer);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand){
  const input={actorId,command},e=entropy(),r=transition(s,input,e);
  if(!r.ok)throw Error(`OTHERWORLD_${command.type}_${r.code}`);
  if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('OTHERWORLD_REPLAY');
  s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('OTHERWORLD_CARDS');
 }
 function pass(){const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});
 act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'CHANT',cardInstanceId:rift});
 for(let n=0;n<200;n++){
  const actor=s.seatOrder[s.turnSeat]!;
  if(s.windows?.length)pass();
  else if(s.phase==='action'){if(actor===a)break;act(actor,{type:'PASS_ACTION'});}
  else if(s.phase==='withdrawal')act(actor,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')act(actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.filter(id=>id!==prayer).slice(0,Math.max(0,s.players[actor]!.hand.length-gameStats(s,actor).handLimit))});
  else if(s.phase==='turn-start')act(actor,{type:'START_TURN'});
  else if(s.phase==='draw')act(actor,{type:'CHOOSE_DRAW',draw:false});
  else throw Error('OTHERWORLD_PHASE');
 }
 act(a,{type:'ATTACK',cardInstanceId:rift,targetIds:[b],dedicated:false});
 for(let n=0;n<200;n++){
  const w=s.windows?.at(-1);
  if(w?.kind==='effect-level'&&w.participants[w.cursor]===b)return s;
  pass();
 }
 throw Error('OTHERWORLD_WINDOW');
}
