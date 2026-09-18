import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand,type GameState} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export type SadLoveScenario='sad-love'|'sad-love-lethal'|'sad-love-aura';
export function makeSadLoveScenario(name:SadLoveScenario,players:{id:string;name:string}[]):GameState {
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];assignCharacter(s,a,'侍大将のシン');assignCharacter(s,b,'黒妖精のアーネス');assignCharacter(s,c,'獣使いのウパニシャット');assignCharacter(s,d,'破壊神ヴァンミール');s.players[b]!.revealed=true;s.players[d]!.revealed=true;for(const p of Object.values(s.players))p.permanent={endurance:100};if(name==='sad-love-lethal')s.players[c]!.damage=gameStats(s,c).endurance-1;
 const attack=takeCard(s,a,'手裏剣'),fate=takeCard(s,d,'命運凶変');trimHand(s,a,attack);trimHand(s,d,fate);
 function act(actorId:string,command:GameCommand){const input={actorId,command},r=transition(s,input,entropy());if(!r.ok)throw Error(`LOVE_FIXTURE_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,entropy())))throw Error('LOVE_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('LOVE_FIXTURE_CARDS');}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});if(name==='sad-love-aura')return s;
 act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:[b],dedicated:false});for(let n=0;n<200;n++){const w=s.windows?.at(-1);if(w?.kind==='attack-abilities'&&w.participants[w.cursor]===c)return s;if(!w)throw Error('LOVE_FIXTURE_WINDOW');act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('LOVE_FIXTURE_LIMIT');
}
