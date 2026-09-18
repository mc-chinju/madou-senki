import {createGame,transition} from '@madou/engine';
import {getCharacter} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
/** Initial allocation only; claim, cancellation and Dawn resolution are produced by commands. */
export function makeCanonicalRecovery(players:{id:string;name:string}[]){
 let s=createGame(players,entropy(),{startingSeat:0});
 function act(actorId:string,command:Parameters<typeof transition>[1]['command']){const r=transition(s,{actorId,command},entropy());if(!r.ok)throw Error(r.code);s=r.state;}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});
 const [a,b,,d]=players.map(p=>p.id) as [string,string,string,string];
 act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 assignCharacter(s,a,getCharacter('c2-p02-r1c2')!.name);assignCharacter(s,b,'黒騎士ガーウィン');s.players[a]!.revealed=true;
 for(const p of Object.values(s.players))p.permanent={warrior_level:20,endurance:100};
 const bow=takeCard(s,a,'踏み込み／弓'),fate=takeCard(s,b,'命運凶変'),dawn=takeCard(s,d,'大陸の夜明け');
 s.players[d]!.hand=s.players[d]!.hand.filter(id=>id!==dawn);
 trimHand(s,a,bow);trimHand(s,b,fate);s.deck.unshift(dawn);s.discard.push(s.deck.pop()!);
 return s;
}
