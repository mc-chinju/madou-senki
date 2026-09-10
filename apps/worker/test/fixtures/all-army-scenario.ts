import {createGame,transition,type GameState} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export function makeAllArmyScenario(players:{id:string;name:string}[],fail=false):GameState{
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 assignCharacter(s,a,'侍大将のシン');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'忍びのイダ');assignCharacter(s,d,'獣使いのウパニシャット');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:p.id===a&&fail?-20:20};
 const army=takeCard(s,a,'a2-p05-r2c2'),follower=takeCard(s,a,'a2-p20-r3c1'),fate=takeCard(s,c,'命運凶変');trimHand(s,a,army,follower);trimHand(s,c,fate);
 const act=(actorId:string,command:import('@madou/protocol').GameCommand)=>{const r=transition(s,{actorId,command},entropy());if(!r.ok)throw Error(`ARMY_FIXTURE_${r.code}`);s=r.state;};
 for(const id of [a,b,c,d])act(id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});return s;
}
