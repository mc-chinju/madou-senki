import {createGame,transition,viewFor,type GameState,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export function makeInformationAnytimeScenario(name:'reclaim-peace'|'reclaim-revelation',players:{id:string;name:string}[]):GameState {
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 assignCharacter(s,a,'大神官ジル');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'忍びのイダ');assignCharacter(s,d,'獣使いのウパニシャット');
 const source=takeCard(s,a,name==='reclaim-peace'?'a2-p02-r1c1':'a2-p02-r1c2'),follower=takeCard(s,b,'グリフォン'),chant=takeCard(s,b,'天地百撃斬');trimHand(s,a,source);trimHand(s,b,follower,chant);
 const act=(actorId:string,command:GameCommand)=>{const r=transition(s,{actorId,command},entropy());if(!r.ok)throw Error(`INFORMATION_FIXTURE_${r.code}`);s=r.state;};
 for(const id of [a,b,c,d]){if(id===b)act(b,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:follower});act(id,{type:'PASS_SETUP'});}
 act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'PASS_ACTION'});
 for(let n=0;n<4;n++){const id=s.seatOrder[s.turnSeat]!;act(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>x!==source&&x!==chant).slice(0,Math.max(0,s.players[id]!.hand.length-viewFor(s,id).self.stats.handLimit))});const next=s.seatOrder[s.turnSeat]!;act(next,{type:'START_TURN'});act(next,{type:'CHOOSE_DRAW',draw:false});if(next===b)act(b,{type:'CHANT',cardInstanceId:chant});else if(next!==a)act(next,{type:'PASS_ACTION'});}
 if(!s.players[a]!.hand.includes(source)||!s.players[b]!.followers.length||!s.players[b]!.chants.length)throw Error('INFORMATION_FIXTURE_ZONES');return s;
}
