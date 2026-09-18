import {getAction} from '@madou/catalog';
import {createGame,gameStats,transition,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const maaiOtherCards=['a2-p06-r1c3','a2-p06-r2c1','a2-p06-r2c2','a2-p06-r2c3','a2-p06-r3c1','a2-p06-r3c2','a2-p06-r3c3'] as const;
export type MaaiOtherCard=typeof maaiOtherCards[number];
export type MaaiOtherMode='rest'|'rest-cap'|'defense'|'mental'|'additional'|'advance'|'approach'|'withdrawal'|'prohibited';
export type MaaiOtherScenario=`maai-other-${1|2|3|4|5|6|7}-${'rest'|'defense'}`;
export const maaiOtherScenarios=maaiOtherCards.flatMap((_,i)=>[`maai-other-${i+1}-rest`,`maai-other-${i+1}-defense`] as MaaiOtherScenario[]);
export function isMaaiOtherScenario(name:string):name is MaaiOtherScenario{return maaiOtherScenarios.includes(name as MaaiOtherScenario);}
export const maaiOtherSecond='a2-p07-r1c1',maaiOtherBow='a2-p24-r2c2',maaiOtherAdvance='a2-p24-r1c3';
export function makeMaaiOtherPhysical(card:MaaiOtherCard,mode:MaaiOtherMode,players:{id:string;name:string}[],beforeStart=false){
 let s=createGame(players,entropy(),{startingSeat:3});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string],rest=mode.startsWith('rest'),owner=rest||mode==='withdrawal'?a:b;
 for(const [i,p] of players.entries())assignCharacter(s,p.id,['侍大将のシン','黒騎士ガーウィン','忍びのイダ','魔導王ガイナス'][i]!);
 for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};
 const attack=mode==='mental'?'a2-p17-r1c1':mode==='additional'?'a2-p08-r1c1':mode==='prohibited'?'a2-p15-r2c2':maaiOtherBow;
 const keep=[takeCard(s,owner,card),takeCard(s,d,'a2-p24-r1c2'),takeCard(s,d,'a2-p02-r2c3')];
 if(rest||mode==='additional')keep.push(takeCard(s,owner,maaiOtherSecond));
 if(mode==='rest')keep.push(takeCard(s,a,'a2-p04-r2c3'));
 if(mode==='rest-cap')for(const id of ['a2-p07-r1c2','a2-p07-r1c3','a2-p07-r2c1'])keep.push(takeCard(s,a,id));
 if(!rest)keep.push(takeCard(s,a,attack));
 if(['advance','approach','withdrawal'].includes(mode))keep.push(takeCard(s,a,maaiOtherAdvance));
 if(mode==='withdrawal')keep.push(takeCard(s,b,'a2-p24-r2c1'));
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];s.events=[];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e={...entropy(),dice:Array(100).fill(1)},r=transition(s,input,e);if(!r.ok)throw Error(`MAAI_OTHER_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('MAAI_OTHER_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('MAAI_OTHER_CARDS');}
 function settle(){for(let n=0;n<500;n++){const w=s.windows?.at(-1);if(!w)return;act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('MAAI_OTHER_WINDOW');}
 for(const id of [a,b,c,d])act(id,{type:'PASS_SETUP'});act(d,{type:'START_TURN'});act(d,{type:'CHOOSE_DRAW',draw:false});act(d,{type:'ATTACK',cardInstanceId:'a2-p24-r1c2',targetIds:[rest?a:b],dedicated:false});settle();act(d,{type:'PASS_WITHDRAWAL'});act(d,{type:'END_TURN',discardIds:[]});settle();if(beforeStart)return s;
 act(a,{type:'START_TURN'});settle();act(a,{type:'CHOOSE_DRAW',draw:false});
 if(mode==='withdrawal'){act(a,{type:'APPROACH',cardInstanceId:maaiOtherAdvance,targetId:b});settle();act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:[b],dedicated:false});settle();}
 else if(!rest&&mode!=='approach'){act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:[b],dedicated:false});for(let n=0;n<400&&s.windows?.at(-1)?.kind!=='normal-defense';n++){const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}}
 return s;
}
export function makeMaaiOtherScenario(name:MaaiOtherScenario,players:{id:string;name:string}[]){const parts=name.split('-');return makeMaaiOtherPhysical(maaiOtherCards[Number(parts[2])-1]!,parts[3] as 'rest'|'defense',players);}
