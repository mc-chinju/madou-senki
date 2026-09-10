import {getAction} from '@madou/catalog';
import {createGame,transition,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const advanceRemainingCards=['a2-p23-r3c3','a2-p24-r1c1','a2-p24-r3c1','a2-p24-r3c2','a2-p24-r3c3','a2-p25-r1c1','a2-p25-r1c2'] as const;
export type AdvanceRemainingScenario=`advance-remaining-${1|2|3|4|5|6|7}-${'attack'|'approach'|'advance'|'cancel'}`;
export const advanceRemainingScenarios=advanceRemainingCards.flatMap((_,i)=>['attack','approach','advance','cancel'].map(mode=>`advance-remaining-${i+1}-${mode}` as AdvanceRemainingScenario));
export function isAdvanceRemainingScenario(name:string):name is AdvanceRemainingScenario{return advanceRemainingScenarios.includes(name as AdvanceRemainingScenario);}
export function makeAdvanceRemainingScenario(name:AdvanceRemainingScenario,players:{id:string;name:string}[]){
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b]=players.map(p=>p.id) as [string,string],card=advanceRemainingCards[Number(name.split('-')[2])-1]!;
 for(const [i,p] of players.entries()){assignCharacter(s,p.id,['侍大将のシン','黒騎士ガーウィン','魔聖母ディア','魔導王ガイナス'][i]!);s.players[p.id]!.permanent={endurance:100,spirit:20,warrior_level:20};}
 const keep=[takeCard(s,a,card),takeCard(s,a,'a2-p24-r1c2'),takeCard(s,a,'a2-p07-r3c3'),takeCard(s,b,'a2-p07-r1c1')];
 for(const p of players)trimHand(s,p.id,...keep);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e={...entropy(),dice:Array(60).fill(1)},r=transition(s,input,e);if(!r.ok)throw Error(`ADVANCE_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('ADVANCE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('ADVANCE_CARDS');}
 function until(done:()=>boolean){for(let n=0;n<300;n++){if(done())return;const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('ADVANCE_WINDOW');}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 if(name.endsWith('-attack')){act(a,{type:'APPROACH',targetId:b,cardInstanceId:'a2-p24-r1c2'});until(()=>!s.windows?.length);}
 if(name.endsWith('-advance')){act(a,{type:'ATTACK',targetIds:[b],cardInstanceId:'a2-p07-r3c3',dedicated:false});until(()=>s.windows?.at(-1)?.kind==='normal-defense');}
 return s;
}
