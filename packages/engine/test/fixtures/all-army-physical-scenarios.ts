import {getAction} from '@madou/catalog';
import {createGame,gameStats,transition,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const armyPhysicalCard='a2-p05-r2c2';
export type ArmyPhysicalScenario='griffon'|'morale-fail'|'upa'|'wood'|'soldier'|'female'|'fairy'|'earth'|'dwarf'|'parent'|'child'|'force'|'reroll'|'placed'|'foreign'|'decline'|'stopped'|'suppressed'|'silenced';
export function makeArmyPhysicalScenario(name:ArmyPhysicalScenario,players:{id:string;name:string}[],beforeStart=false){
 const prior=['stopped','suppressed','silenced'].includes(name);let s=createGame(players,entropy(),{startingSeat:prior?3:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[name==='upa'?'獣使いのウパニシャット':'侍大将のシン','黒騎士ガーウィン','忍びのイダ','魔導王ガイナス'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit!+=6-gameStats(s,p.id).spirit;}
 if(name==='fairy'||name==='dwarf')s.players[a]!.permanent!.warrior_level!+=(name==='fairy'?5:4)-gameStats(s,a).warrior_level;
 const follower=name==='wood'?'a2-p19-r2c3':name==='soldier'?'a2-p18-r3c3':name==='female'?'a2-p21-r2c2':name==='fairy'?'a2-p21-r3c3':name==='earth'||name==='silenced'?'a2-p22-r2c3':name==='dwarf'?'a2-p21-r2c3':'a2-p20-r3c1';
 const keep=[takeCard(s,a,armyPhysicalCard),takeCard(s,name==='foreign'?b:a,follower),takeCard(s,d,'a2-p02-r2c3'),takeCard(s,c,'a2-p02-r1c3')];
 if(name==='wood'||name==='soldier')keep.push(takeCard(s,a,'a2-p24-r1c2'));
 if(name==='earth')keep.push(takeCard(s,b,'a2-p18-r3c3'));
 if(prior)keep.push(takeCard(s,d,name==='stopped'?'a2-p13-r2c1':name==='suppressed'?'a2-p13-r1c2':'a2-p18-r1c1'));
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];s.events=[];
 function act(actorId:string,command:GameCommand,face=1){const input={actorId,command},e={...entropy(),dice:Array(100).fill(face)},r=transition(s,input,e);if(!r.ok)throw Error(`ARMY_PHYSICAL_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('ARMY_PHYSICAL_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('ARMY_PHYSICAL_FIXTURE_CARDS');}
 function settle(face=1){for(let n=0;n<500;n++){const w=s.windows?.at(-1);if(!w)return;act(w.participants[w.cursor]!,{type:'PASS'},face);}throw Error('ARMY_PHYSICAL_FIXTURE_LIMIT');}
 for(const id of [a,b,c,d]){if(name==='placed'&&id===a)act(id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:follower});if(name==='earth'&&id===b)act(id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:'a2-p18-r3c3'});act(id,{type:'PASS_SETUP'});}if(beforeStart)return {s,follower};
 if(prior){act(d,{type:'START_TURN'});settle();act(d,{type:'CHOOSE_DRAW',draw:false});act(d,{type:'ATTACK',cardInstanceId:name==='stopped'?'a2-p13-r2c1':name==='suppressed'?'a2-p13-r1c2':'a2-p18-r1c1',targetIds:[a],dedicated:false});settle(6);if(s.phase==='withdrawal')act(d,{type:'PASS_WITHDRAWAL'});act(d,{type:'END_TURN',discardIds:[]});settle();}
 act(a,{type:'START_TURN'});settle(prior?6:1);if(s.phase==='draw')act(a,{type:'CHOOSE_DRAW',draw:false});return {s,follower};
}
