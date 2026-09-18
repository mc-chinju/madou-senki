import {createGame,transition,viewFor,type GameState,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export function makeSubstituteScenario(players:{id:string;name:string}[],refillOpen=false):GameState {
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 assignCharacter(s,a,'侍大将のシン');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'忍びのイダ');assignCharacter(s,d,'獣使いのウパニシャット');
 for(const p of Object.values(s.players))p.permanent={endurance:100};
 const attack=takeCard(s,a,'天地百撃斬'),source=takeCard(s,c,'身代わり'),evade=takeCard(s,c,'見切る'),maai=takeCard(s,c,'間合い／休息'),counter=takeCard(s,c,'閃光槍'),fate=takeCard(s,d,'命運凶変');trimHand(s,a,attack);trimHand(s,c,source,evade,maai,counter);trimHand(s,d,fate);
 const act=(actorId:string,command:GameCommand,dice=Array(100).fill(1))=>{const r=transition(s,{actorId,command},{...entropy(),dice});if(!r.ok)throw Error(`SUBSTITUTE_FIXTURE_${r.code}`);s=r.state;};
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'CHANT',cardInstanceId:attack});
 for(let n=0;n<4;n++){const id=s.seatOrder[s.turnSeat]!;act(id,{type:'END_TURN',discardIds:s.players[id]!.hand.slice(viewFor(s,id).self.stats.handLimit)});const next=s.seatOrder[s.turnSeat]!;act(next,{type:'START_TURN'});act(next,{type:'CHOOSE_DRAW',draw:false});if(next!==a)act(next,{type:'PASS_ACTION'});}
 act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:[b,c],dedicated:true});
 for(let n=0;n<100&&!Object.keys(s.groups??{}).length;n++){const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'},[3,...Array(100).fill(1)]);}
 for(let n=0;n<20&&!viewFor(s,c).anytimeCardOptions.some(o=>o.cardInstanceId===source);n++){const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}
 if(refillOpen){const open=takeCard(s,d,'a2-p01-r1c1');s.players[d]!.hand=s.players[d]!.hand.filter(id=>id!==open);s.discard.push(...s.players[d]!.hand);s.players[d]!.hand=[];s.players[d]!.presence='dead';s.deck.unshift(open);}
 if(!viewFor(s,c).anytimeCardOptions.some(o=>o.cardInstanceId===source&&o.hitIndex===1))throw Error('SUBSTITUTE_FIXTURE_NO_HIT');return s;
}
