import {allCardInstanceIds,createGame,transition,type GameCommand,type GameState} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export type MandatoryFieldsScenario='mandatory-cham-warrior'|'mandatory-cham-magic'|'mandatory-conversion-asfelt'|'mandatory-conversion-garwin';
export function isMandatoryFieldsScenario(name:string):name is MandatoryFieldsScenario{return ['mandatory-cham-warrior','mandatory-cham-magic','mandatory-conversion-asfelt','mandatory-conversion-garwin'].includes(name);}
export function makeMandatoryFieldsScenario(name:MandatoryFieldsScenario,players:{id:string;name:string}[]):GameState {
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string],cham=name.startsWith('mandatory-cham-');
 assignCharacter(s,a,cham?'小妖精のチャム':'侍大将のシン');assignCharacter(s,b,name==='mandatory-conversion-asfelt'?'竜皇子アスフェルト':'黒騎士ガーウィン');assignCharacter(s,c,'白魔術師シェリム');assignCharacter(s,d,'忍びのイダ');
 if(cham){for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};}else s.players[b]!.revealed=true;
 const card=takeCard(s,a,cham?name==='mandatory-cham-warrior'?'手裏剣':'妖獣':'a2-p04-r1c1');trimHand(s,a,card);
 function act(actorId:string,command:GameCommand){const input={actorId,command},r=transition(s,input,entropy());if(!r.ok)throw Error(`MANDATORY_FIELDS_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,entropy())))throw Error('MANDATORY_FIELDS_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('MANDATORY_FIELDS_CARDS');}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 if(cham)act(a,{type:'ATTACK',cardInstanceId:card,targetIds:[b],dedicated:false});else{act(a,{type:'PLAY_TURN_CARD',cardInstanceId:'a2-p04-r1c1',targetId:b});for(let i=0;i<150;i++){const w=s.windows?.at(-1);if(w?.kind==='before-roll')return s;if(!w)throw Error('MANDATORY_FIELDS_WINDOW');act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('MANDATORY_FIELDS_LIMIT');}
 return s;
}
