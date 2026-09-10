import {allCardInstanceIds,createGame,transition,type GameCommand,type GameState} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const virtualBladeScenarioNames=['virtual-blade-ice','virtual-blade-fire'] as const;
export type VirtualBladeScenarioName=typeof virtualBladeScenarioNames[number];
export function isVirtualBladeScenario(name:string):name is VirtualBladeScenarioName{return (virtualBladeScenarioNames as readonly string[]).includes(name);}
export function makeVirtualBladeScenario(name:VirtualBladeScenarioName,players:{id:string;name:string}[]):GameState{
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];assignCharacter(s,a,name==='virtual-blade-ice'?'凍気のアイエル':'爆炎のフレイアード');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'リーア姫');assignCharacter(s,d,'忍びのイダ');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};if(name==='virtual-blade-ice')s.players[a]!.permanent!.magic_level=-3;
 const fate=takeCard(s,c,'命運凶変');trimHand(s,c,fate);s.distances[a]![b]=s.distances[b]![a]='near';
 function act(actorId:string,command:GameCommand){const input={actorId,command},r=transition(s,input,entropy());if(!r.ok)throw Error(`BLADE_FIXTURE_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,entropy())))throw Error('BLADE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('BLADE_CARDS');}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'REVEAL_CHARACTER'});return s;
}
