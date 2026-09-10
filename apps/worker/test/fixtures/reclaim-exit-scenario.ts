import {allCardInstanceIds,createGame,transition,type GameCommand} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';

export function makeReclaimExit(players:{id:string;name:string}[]){
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 assignCharacter(s,a,'邪祭ウーノス');assignCharacter(s,b,'占星術師のアルセイル');assignCharacter(s,c,'侍大将のシン');assignCharacter(s,d,'魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};
 const ritual=takeCard(s,a,'a2-p05-r1c1'),fate=takeCard(s,b,'命運凶変');
 for(const id of s.seatOrder)trimHand(s,id,ritual,fate);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand){
  const input={actorId,command},e=entropy(),r=transition(s,input,e);
  if(!r.ok)throw Error(`RECLAIM_EXIT_${command.type}_${r.code}`);
  if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('RECLAIM_EXIT_REPLAY');
  s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('RECLAIM_EXIT_CARDS');
 }
 for(const p of players)act(p.id,{type:'PASS_SETUP'});
 act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(b,{type:'REVEAL_CHARACTER'});
 return s;
}
