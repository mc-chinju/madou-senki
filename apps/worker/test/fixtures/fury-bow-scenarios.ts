import {allCardInstanceIds,createGame,transition,type GameCommand,type GameState} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';

/** Prior deal/training only; one actual bow declaration reaches the unselected effect window. */
export function makeFuryBowScenario(players:{id:string;name:string}[]):GameState {
 let state=createGame(players,entropy(),{startingSeat:0});
 const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 function act(actorId:string,command:GameCommand){const input={actorId,command},random=entropy(),result=transition(state,input,random);if(!result.ok)throw Error(`FURY_FIXTURE_${result.code}`);if(JSON.stringify(result)!==JSON.stringify(transition(JSON.parse(JSON.stringify(state)),input,random)))throw Error('FURY_FIXTURE_REPLAY');state=result.state;const cards=allCardInstanceIds(state);if(cards.length!==220||new Set(cards).size!==220)throw Error('FURY_FIXTURE_CARDS');}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});
 act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 assignCharacter(state,a,'妖精王フューリー');assignCharacter(state,b,'黒騎士ガーウィン');assignCharacter(state,c,'リーア姫');assignCharacter(state,d,'忍びのイダ');
 for(const p of Object.values(state.players))p.permanent={spirit:20,endurance:100};
 const bow=takeCard(state,a,'踏み込み／弓'),god=takeCard(state,c,'神性介入'),fate=takeCard(state,c,'命運凶変');trimHand(state,a,bow);trimHand(state,c,god,fate);state.events=[];
 act(a,{type:'ATTACK',cardInstanceId:bow,targetIds:[b],dedicated:false});
 for(let i=0;i<300;i++){const w=state.windows?.at(-1);if(w?.kind==='effect-level')return state;if(!w)throw Error('FURY_FIXTURE_NO_WINDOW');act(w.participants[w.cursor]!,{type:'PASS'});}
 throw Error('FURY_FIXTURE_LIMIT');
}
