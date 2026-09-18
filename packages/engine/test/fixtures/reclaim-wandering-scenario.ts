import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
/** Actual dedicated multi-target Black Bow: Lancelot counter reservation followed by protected Lia death. */
export function makeReclaimWandering(players:{id:string;name:string}[]):GameState{
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];assignCharacter(s,a,'黒妖精のアーネス');assignCharacter(s,b,'聖騎士ランスロット');assignCharacter(s,c,'リーア姫');assignCharacter(s,d,'魔導王ガイナス');for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,spirit:20};
 s.players[c]!.damage=gameStats(s,c).endurance-1;for(const target of [b,c]){s.distances[a]![target]='near';s.distances[target]![a]='near';}
 const sword=takeCard(s,a,'a2-p07-r3c3'),counter=takeCard(s,b,'妖撃破山剣');trimHand(s,a,sword);trimHand(s,b,counter);trimHand(s,c);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand,dice=Array(100).fill(1)){const input={actorId,command},e={...entropy(),dice},r=transition(s,input,e);if(!r.ok)throw Error(`COMBINED_DEATH_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('COMBINED_DEATH_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('COMBINED_DEATH_CARDS');}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false}); act(a,{type:'ATTACK',cardInstanceId:sword,targetIds:[b,c],dedicated:true});for(let n=0;n<300;n++){const w=s.windows!.at(-1)!;if(w.kind==='normal-defense')return s;act(w.participants[w.cursor]!,{type:'PASS'},w.kind==='damage'?[3]:Array(100).fill(1));}throw Error('COMBINED_DEATH_WINDOW');
}
