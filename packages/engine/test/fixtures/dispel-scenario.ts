import {createGame,transition,type GameState,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export function makeDispelScenario(players:{id:string;name:string}[]):GameState {
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 assignCharacter(s,a,'侍大将のシン');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'忍びのイダ');assignCharacter(s,d,'獣使いのウパニシャット');
 const source=takeCard(s,a,'呪払'),attack=takeCard(s,a,'踏み込み／弓'),wood=takeCard(s,b,'ウッドゴーレム'),other=takeCard(s,b,'グリフォン'),fate=takeCard(s,b,'命運凶変');trimHand(s,a,source,attack);trimHand(s,b,wood,other,fate);
 const act=(actorId:string,command:GameCommand)=>{const r=transition(s,{actorId,command},entropy());if(!r.ok)throw Error(`DISPEL_FIXTURE_${r.code}`);s=r.state;};
 for(const id of [a,b,c,d]){if(id===b)for(const cardInstanceId of [wood,other])act(b,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId});act(id,{type:'PASS_SETUP'});}readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));
 act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});return s;
}
