import {createGame,transition,type GameCommand,type GameState} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export type MandatoryRestrictionScenario='mandatory-fury'|'mandatory-fury-counter';
export function makeMandatoryRestrictionScenario(name:MandatoryRestrictionScenario,players:{id:string;name:string}[]):GameState {
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string],fury=name==='mandatory-fury'?a:b;
 assignCharacter(s,a,'侍大将のシン');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'破壊神ヴァンミール');assignCharacter(s,d,'忍びのイダ');assignCharacter(s,fury,'妖精王フューリー');for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};
 const cards=['妖獣','呪殺','血流','黒翼飛翔剣','狂王陣'].map(card=>takeCard(s,fury,card));trimHand(s,fury,...cards);const attack=name==='mandatory-fury-counter'?takeCard(s,a,'地槍'):undefined;if(attack)trimHand(s,a,attack);
 function act(actorId:string,command:GameCommand){const r=transition(s,{actorId,command},entropy());if(!r.ok)throw Error(`MANDATORY_FIXTURE_${r.code}`);s=r.state;}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 if(attack){act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:[b],dedicated:false});for(let i=0;i<200;i++){const w=s.windows?.at(-1);if(w?.kind==='normal-defense')return s;if(!w)throw Error('MANDATORY_WINDOW');act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('MANDATORY_LIMIT');}
 return s;
}
