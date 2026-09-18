import {createGame,transition,viewFor,type GameState} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
/** Initial deal and prior death only; the suspended refill and inspection use actual commands. */
export function makeSwordShuffleScenario(players:{id:string;name:string}[],inspection=true,dawn=true):GameState{
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 assignCharacter(s,a,'占星術師のアルセイル');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'小妖精のチャム');assignCharacter(s,d,'忍びのイダ');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 const revelation=takeCard(s,a,'a2-p02-r1c2'),sword=takeCard(s,b,'a2-p04-r2c1'),fusen=takeCard(s,d,'a2-p01-r1c1'),day=takeCard(s,d,'a2-p01-r1c2');trimHand(s,a,revelation);trimHand(s,b,sword);
 const act=(actorId:string,command:import('@madou/protocol').GameCommand)=>{const r=transition(s,{actorId,command},entropy());if(!r.ok)throw Error(`SWORD_SHUFFLE_FIXTURE_${r.code}`);s=r.state;};
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 s.players[d]!.presence='dead';s.players[d]!.revealed=true;s.discard.push(...s.players[d]!.hand.filter(id=>id!==fusen&&id!==day));s.players[d]!.hand=[];
 if(dawn)s.deck=[fusen,day,...s.deck];else{s.discard.push(day,...s.deck);s.deck=[fusen];}
 if(!inspection)return s;
 const o=viewFor(s,a).anytimeCardOptions.find(o=>o.cardInstanceId===revelation&&o.targetId===b)!;act(a,{type:'PLAY_ANYTIME_CARD',cardInstanceId:revelation,targetId:b,targetEventId:o.targetEventId});
 for(let n=0;n<60;n++){const w=s.windows!.at(-1)!;if(w.kind==='before-roll'&&w.participants[w.cursor]===a)break;act(w.participants[w.cursor]!,{type:'PASS'});}
 const star=viewFor(s,a).abilityOptions.find(o=>o.abilityId==='c2-p04-r2c1-ab02')!;act(a,{type:'USE_ABILITY',abilityId:star.abilityId,targetId:b,targetEventId:star.targetEventId});
 for(let n=0;n<120&&s.windows?.at(-1)?.kind!=='private-inspection';n++){const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}
 if(s.windows?.at(-1)?.kind!=='private-inspection')throw Error('SWORD_SHUFFLE_INSPECTION_MISSING');return s;
}
