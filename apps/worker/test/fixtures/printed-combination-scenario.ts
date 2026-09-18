import {createGame,transition,type GameState} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export function makePrintedCombinationScenario(players:{id:string;name:string}[],counter=false):GameState{
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];assignCharacter(s,a,'大神官ジル');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'忍びのイダ');assignCharacter(s,d,'獣使いのウパニシャット');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 const attack=takeCard(s,a,counter?'踏み込み／弓':'魔詩'),spirit=takeCard(s,counter?b:a,'a2-p05-r1c3'),harp=takeCard(s,a,'a2-p05-r2c1'),response=takeCard(s,b,'閃光槍'),fate=takeCard(s,c,'命運凶変');trimHand(s,a,attack,harp,...(counter?[]:[spirit]));trimHand(s,b,response,...(counter?[spirit]:[]));trimHand(s,c,fate);
 const act=(actorId:string,command:import('@madou/protocol').GameCommand)=>{const r=transition(s,{actorId,command},entropy());if(!r.ok)throw Error(`COMBINATION_FIXTURE_${r.code}`);s=r.state;};readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 if(counter){act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:[b],dedicated:false});for(let n=0;s.windows?.at(-1)?.kind!=='normal-defense'&&n<100;n++){const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}}
 return s;
}
