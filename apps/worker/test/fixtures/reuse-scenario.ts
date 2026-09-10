import {createGame,transition,type GameState} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export function makeReuseScenario(players:{id:string;name:string}[],unlimited:boolean):GameState{
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];assignCharacter(s,a,unlimited?'聖騎士ランスロット':'妖精王フューリー');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'忍びのイダ');assignCharacter(s,d,'獣使いのウパニシャット');s.players[a]!.revealed=true;for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};s.distances[a]![b]='near';s.distances[b]![a]='near';
 const attack=takeCard(s,a,unlimited?'破山剣':'踏み込み／弓'),fate=takeCard(s,b,'命運凶変');trimHand(s,a,attack);trimHand(s,b,fate);
 const act=(actorId:string,command:import('@madou/protocol').GameCommand)=>{const r=transition(s,{actorId,command},entropy());if(!r.ok)throw Error(`REUSE_FIXTURE_${r.code}`);s=r.state;};for(const id of [a,b,c,d])act(id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});return s;
}
