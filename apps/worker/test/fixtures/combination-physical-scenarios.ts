import {getAction,getCharacter} from '@madou/catalog';
import {createGame,gameStats,transition,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export const combinationSpirit='a2-p05-r1c3',combinationHarp='a2-p05-r2c1',combinationPoem='a2-p17-r1c1',combinationBow='a2-p24-r1c2',combinationCounter='a2-p10-r3c3';
export type CombinationPhysicalScenario='both'|'spirit'|'harp'|'decline'|'null'|'zero'|'cancel-spirit'|'cancel-harp'|'cancel-parent'|'check-pass'|'check-fail'|'counter-give'|'counter-return'|'multi'|'approach'|'invalid'|'next';
export function makeCombinationPhysicalScenario(name:CombinationPhysicalScenario,players:{id:string;name:string}[]){
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[name==='zero'?getCharacter('c2-p04-r2c2')!.name:name==='multi'?'侍大将のシン':'大神官ジル','黒騎士ガーウィン',name==='zero'?'邪祭ウーノス':'忍びのイダ','魔導王ガイナス'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit!+=(p.id===a&&name==='zero'?0:6)-gameStats(s,p.id).spirit;}
 if(name.startsWith('check-'))s.players[a]!.permanent!.magic_level!+=4-gameStats(s,a).magic_level;
 const attack=name==='null'?'a2-p18-r1c1':name==='zero'?'a2-p08-r3c3':name==='multi'?'a2-p10-r1c3':name.includes('counter')||name==='next'||name==='invalid'?combinationBow:combinationPoem;
 const keep=[takeCard(s,a,attack),takeCard(s,name==='counter-give'?b:a,combinationSpirit),takeCard(s,a,combinationHarp),takeCard(s,d,'a2-p02-r2c3')];
 if(name.includes('counter'))keep.push(takeCard(s,b,combinationCounter),takeCard(s,b,'a2-p05-r3c1'));
 if(name==='approach')keep.push(takeCard(s,a,combinationBow),takeCard(s,a,'a2-p07-r1c1'));
 if(name==='next')keep.push(takeCard(s,a,'a2-p24-r2c2'));
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];s.events=[];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e={...entropy(),dice:Array(100).fill(1)},r=transition(s,input,e);if(!r.ok)throw Error(`COMBO_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('COMBO_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('COMBO_FIXTURE_CARDS');}
 function settle(){for(let n=0;n<500;n++){const w=s.windows?.at(-1);if(!w)return;act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('COMBO_FIXTURE_WINDOW');}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 if(name==='multi'){act(a,{type:'CHANT',cardInstanceId:attack});settle();for(let n=0;n<4;n++){const id=s.seatOrder[s.turnSeat]!;act(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>!keep.includes(x)).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});settle();const next=s.seatOrder[s.turnSeat]!;act(next,{type:'START_TURN'});settle();act(next,{type:'CHOOSE_DRAW',draw:false});if(n<3)act(next,{type:'PASS_ACTION'});}}
 return {s,attack};
}
