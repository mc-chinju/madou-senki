import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand,type GameState} from '@madou/engine';
import {makeR6CombinedDeathScenario} from './r6-combined-death-scenario.js';
import {makeR6CombinedSuppressionScenario} from './r6-combined-suppression-scenario.js';
import {makeR6BoundaryScenario} from './r6-boundary-scenarios.js';
import {makeR6MaaiScenario} from './r6-maai-scenarios.js';
import {makeR6DefenseScenario} from './r6-defense-scenarios.js';
import {makeR6RollScenario} from './r6-roll-scenarios.js';
import {makeR6OtherworldScenario} from './r6-otherworld-scenario.js';
import {makeR6ExtinctionScenario} from './r6-extinction-scenario.js';
import {makeR6WanderingScenario} from './r6-wandering-scenario.js';
import {makeR6ExhaustionScenario} from './r6-exhaustion-scenario.js';
import {makeR6RefillScenario} from './r6-refill-scenario.js';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export const r6ScenarioNames=['r6-combined-counter-death','r6-s20-hit','r6-s20-minus2','r6-s20-minus1','r6-s20-recovered','r6-s21','r6-s21-control','r6-s22','r6-s22-choice','r6-s23','r6-s26-attack','r6-s26-revive','r6-s26-return','r6-s27','r6-s30-first','r6-s30-second','r6-s01-s02-s05','r6-s03-s04','r6-s06','r6-s08','r6-s09','r6-s10','r6-s10-seven','r6-s11','r6-s12','r6-s14','r6-s17','r6-combined-death','r6-combined-suppression','r6-combined-revived'] as const;
export type R6ScenarioName=typeof r6ScenarioNames[number];
export function isR6Scenario(name:string):name is R6ScenarioName{return r6ScenarioNames.some(n=>n===name);}
export function makeR6Scenario(name:R6ScenarioName,players:{id:string;name:string}[]):GameState {
 if(name==='r6-combined-counter-death')return makeR6CombinedDeathScenario(players,true);
 if(name==='r6-combined-death')return makeR6CombinedDeathScenario(players);
 if(name==='r6-combined-suppression'||name==='r6-combined-revived')return makeR6CombinedSuppressionScenario(players,name==='r6-combined-revived');
 if(name==='r6-s14'||name==='r6-s17')return makeR6BoundaryScenario(players,name==='r6-s17');
 if(name==='r6-s11'||name==='r6-s12')return makeR6MaaiScenario(players,name==='r6-s12');
 if(name==='r6-s06'||name==='r6-s08'||name==='r6-s09'||name==='r6-s10'||name==='r6-s10-seven')return makeR6DefenseScenario(players,name==='r6-s06'?'s06':name==='r6-s08'?'s08':name==='r6-s09'?'s09':name==='r6-s10'?'s10':'s10-seven');
 if(name==='r6-s01-s02-s05'||name==='r6-s03-s04')return makeR6RollScenario(players,name==='r6-s01-s02-s05');
 if(name==='r6-s30-first'||name==='r6-s30-second')return makeR6OtherworldScenario(players,name==='r6-s30-second');
 if(name==='r6-s27')return makeR6ExtinctionScenario(players);
 if(name==='r6-s26-attack'||name==='r6-s26-revive'||name==='r6-s26-return')return makeR6WanderingScenario(players,name==='r6-s26-attack'?'attack':name==='r6-s26-revive'?'revive':'return');
 if(name==='r6-s23')return makeR6ExhaustionScenario(players);
 if(name==='r6-s22'||name==='r6-s22-choice')return makeR6RefillScenario(players,name==='r6-s22-choice');
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string],s21=name==='r6-s21'||name==='r6-s21-control';assignCharacter(s,a,s21?'侍大将のシン':'吟遊詩人のレスター');assignCharacter(s,b,name==='r6-s21'?'白魔術師シェリム':'黒騎士ガーウィン');assignCharacter(s,c,'大神官ジル');assignCharacter(s,d,'魔導王ガイナス');for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};s.players[b]!.permanent!.spirit=(s.players[b]!.permanent!.spirit??0)+6-gameStats(s,b).spirit;s.players[b]!.revealed=false;
 const attack=takeCard(s,a,s21?getAction('a2-p14-r1c2')!.name:'魔詩'),maai=takeCard(s,b,'間合い／休息'),advance=takeCard(s,a,'踏み込み／蹴る');trimHand(s,a,attack,advance);trimHand(s,b,maai);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand,dice=Array(100).fill(1)){const input={actorId,command},e={...entropy(),dice},r=transition(s,input,e);if(!r.ok)throw Error(`R6_FIXTURE_${name}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('R6_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('R6_FIXTURE_CARDS');}
 function until(done:()=>boolean,dice=Array(100).fill(1)){for(let n=0;n<300;n++){if(done())return;const w=s.windows?.at(-1);if(!w)throw Error('R6_FIXTURE_WINDOW');act(w.participants[w.cursor]!,{type:'PASS'},dice);}throw Error('R6_FIXTURE_LIMIT');}
 function close(dice:number[]){const id=s.windows!.at(-1)!.id;until(()=>s.windows?.at(-1)?.id!==id,dice);}
 function nextStart(){for(let n=0;n<50;n++){const actor=s.seatOrder[s.turnSeat]!;if(s.phase==='turn-start'){if(actor===b)return;act(actor,{type:'START_TURN'});}else if(s.phase==='action')act(actor,{type:'PASS_ACTION'});else if(s.phase==='withdrawal')act(actor,{type:'PASS_WITHDRAWAL'});else if(s.phase==='hand-adjustment'){act(actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.slice(0,Math.max(0,s.players[actor]!.hand.length-gameStats(s,actor).handLimit))});until(()=>!s.windows?.length);}else if(s.phase==='draw')act(actor,{type:'CHOOSE_DRAW',draw:false});else throw Error('R6_FIXTURE_TURN');}throw Error('R6_FIXTURE_TURN_LIMIT');}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:[b],dedicated:false});until(()=>s.windows?.at(-1)?.kind==='normal-defense');if(s21)return s;
 act(b,{type:'PLAY_MAAI',cardInstanceId:maai});until(()=>s.windows?.at(-1)?.kind!=='reclaim');act(a,{type:'PLAY_ADVANCE',cardInstanceId:advance});until(()=>s.windows?.at(-1)?.kind==='before-roll'&&s.rolls?.at(-1)?.purpose==='status-resistance');if(name==='r6-s20-hit')return s;
 close([3,4]);close([1,1]);until(()=>!s.windows?.length);nextStart();act(b,{type:'START_TURN'});if(name==='r6-s20-minus2')return s;
 close([3,4]);close([1,1]);until(()=>!s.windows?.length);nextStart();act(b,{type:'START_TURN'});if(name==='r6-s20-minus1')return s;
 close([2,3]);close([1,1]);until(()=>!s.windows?.length);return s;
}
