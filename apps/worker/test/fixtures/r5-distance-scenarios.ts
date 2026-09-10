/** The shared received-defense fixture executes setup and the actual Earth Spear attack. */
export const distanceReceivedSources={
 'r5-distance-earth':{defender:'有翼人のティア',card:'地槍'},
} as const;
export const maaiScenarioNames=['r5-distance-cham','r5-distance-tia','r5-distance-lancaster','r5-distance-approach','r5-distance-withdrawal'] as const;
export type MaaiScenarioName=typeof maaiScenarioNames[number];
export function isMaaiScenario(name:string):name is MaaiScenarioName{return (maaiScenarioNames as readonly string[]).includes(name);}
/** Actual setup, attack and (Lancaster only) returned counter; no election is preselected. */
export function makeMaaiScenario(name:MaaiScenarioName,players:{id:string;name:string}[]):GameState {
 if(name==='r5-distance-approach'||name==='r5-distance-withdrawal')return makeExchangeScenario(name,players);
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string],countered=name==='r5-distance-lancaster';
 function act(actorId:string,command:GameCommand){const input={actorId,command},random=entropy(),r=transition(s,input,random);if(!r.ok)throw Error(`MAAI_FIXTURE_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,random)))throw Error('MAAI_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('MAAI_CARDS');}
 assignCharacter(s,a,countered?'早駆けのランカスター':'侍大将のシン');assignCharacter(s,b,countered?'黒騎士ガーウィン':name==='r5-distance-cham'?'小妖精のチャム':'有翼人のティア');assignCharacter(s,c,'リーア姫');assignCharacter(s,d,'忍びのイダ');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 const attack=takeCard(s,a,'踏み込み／弓'),counter=countered?takeCard(s,b,'妖撃破山剣'):undefined,defender=countered?a:b,attacker=countered?b:a,maai=takeCard(s,defender,'間合い／休息'),fate=takeCard(s,c,'命運凶変');
 const advances=actionCards.filter(card=>card.name==='踏み込み／蹴る').slice(0,2).map(card=>takeCard(s,attacker,card.id));
 trimHand(s,a,attack,...(countered?[maai]:advances));trimHand(s,b,...(counter?[counter,...advances]:[maai]));trimHand(s,c,fate);
 for(const p of players)act(p.id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});s.distances[a]![b]=s.distances[b]![a]='near';s.events=[];
 act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:[b],dedicated:false});
 function defense(){for(let i=0;i<300;i++){const w=s.windows?.at(-1);if(w?.kind==='normal-defense')return;if(!w)throw Error('MAAI_WINDOW');act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('MAAI_LIMIT');}
 defense();if(counter){act(b,{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});defense();}return s;
}
import {actionCards} from '@madou/catalog';
import {allCardInstanceIds,createGame,transition,type GameCommand,type GameState} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';

function makeExchangeScenario(name:'r5-distance-approach'|'r5-distance-withdrawal',players:{id:string;name:string}[]):GameState {
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string],withdraw=name.endsWith('withdrawal'),owner=withdraw?a:b,other=withdraw?b:a;
 assignCharacter(s,a,withdraw?'有翼人のティア':'侍大将のシン');assignCharacter(s,b,withdraw?'黒騎士ガーウィン':'小妖精のチャム');assignCharacter(s,c,'リーア姫');assignCharacter(s,d,'忍びのイダ');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 const maai=takeCard(s,owner,'間合い／休息'),advances=actionCards.filter(c=>c.name==='踏み込み／蹴る').slice(0,3).map(c=>takeCard(s,other,c.id)),bow=withdraw?takeCard(s,a,'踏み込み／弓'):undefined,fate=takeCard(s,c,'命運凶変');trimHand(s,owner,maai,...(bow?[bow]:[]));trimHand(s,other,...advances);trimHand(s,c,fate);
 function act(actorId:string,command:GameCommand){const input={actorId,command},r=transition(s,input,entropy());if(!r.ok)throw Error(`DISTANCE_EXCHANGE_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,entropy())))throw Error('EXCHANGE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('EXCHANGE_CARDS');}
 if(withdraw)s.distances[a]![b]=s.distances[b]![a]='near';for(const p of players)act(p.id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});s.events=[];
 if(!withdraw)act(a,{type:'APPROACH',targetId:b,cardInstanceId:advances[0]!});else {act(a,{type:'ATTACK',targetIds:[b],cardInstanceId:bow!,dedicated:false});for(let i=0;i<300&&s.windows?.length;i++){const w=s.windows.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}if(s.windows?.length||s.phase!=='withdrawal')throw Error('EXCHANGE_WITHDRAWAL');}return s;
}
