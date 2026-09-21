import {allCardInstanceIds,createGame,transition,type GameCommand,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
/** S23 is a structural zone boundary, not a claim that the initial distribution was produced by a whole match. */
export function makeR6ExhaustionScenario(players:{id:string;name:string}[]):GameState {
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];assignCharacter(s,a,'大神官ジル');assignCharacter(s,b,'吟遊詩人のレスター');assignCharacter(s,c,'魔聖母ディア');assignCharacter(s,d,'魔導王ガイナス');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 const book=takeCard(s,a,'a2-p03-r1c1');trimHand(s,a,book);const ordinary=s.deck.filter(id=>getAction(id)!.category!=='open'),open=s.deck.filter(id=>getAction(id)!.category==='open');s.deck=[ordinary[0]!];s.discard=ordinary.slice(1,3).map(cardInstanceId=>({cardInstanceId,faceUp:true}));s.players[b]!.hand.push(...ordinary.slice(3));s.players[c]!.open.push(...open);
 // The remaining OPEN cards stay public and outside this exact 1+2 draw pool.
 function act(actorId:string,command:GameCommand){const input={actorId,command},e={...entropy(),dice:Array(100).fill(3)},r=transition(s,input,e);if(!r.ok)throw Error(`S23_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('S23_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('S23_FIXTURE_CARDS');}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'PLAY_TURN_CARD',cardInstanceId:'a2-p03-r1c1'});for(let n=0;n<100;n++){if(s.windows?.at(-1)?.kind==='after-roll')return s;const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('S23_FIXTURE_ROLL');
}
