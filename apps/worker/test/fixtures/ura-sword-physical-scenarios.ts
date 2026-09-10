import {getAction} from '@madou/catalog';
import {createGame,gameStats,transition,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const uraSwordCard='a2-p08-r3c1';
export const uraSwordScenarios=['ura-sword-ordinary', 'ura-sword-guard', 'ura-sword-owner-ordinary', 'ura-sword-owner-hit', 'ura-sword-low', 'ura-sword-dedicated', 'ura-sword-far', 'ura-sword-fate', 'ura-sword-maai', 'ura-sword-evade', 'ura-sword-suppressed', 'ura-sword-stopped', 'ura-sword-silenced', 'ura-sword-wrong-owner', 'ura-sword-decline', 'ura-sword-critical-one', 'ura-sword-critical-two', 'ura-sword-instant', 'ura-sword-cancel', 'ura-sword-reroll', 'ura-sword-nonconsecutive'] as const;
export type UraSwordScenario=typeof uraSwordScenarios[number];
export function isUraSwordScenario(name:string):name is UraSwordScenario{return (uraSwordScenarios as readonly string[]).includes(name);}
export function uraSwordMode(name:UraSwordScenario){const dedicated=!['ura-sword-ordinary','ura-sword-guard','ura-sword-owner-ordinary','ura-sword-owner-hit','ura-sword-low','ura-sword-decline'].includes(name),owner=dedicated&&name!=='ura-sword-wrong-owner'||name==='ura-sword-owner-ordinary'||name==='ura-sword-owner-hit',guard=name==='ura-sword-guard'||name==='ura-sword-owner-ordinary'||dedicated;return {dedicated,owner,guard};}
export function makeUraSwordPhysical(name:UraSwordScenario,players:{id:string;name:string}[],options:{beforeStart?:boolean;warrior?:number;spirit?:number;approachTarget?:string;incoming?:boolean}={}){
 const mode=uraSwordMode(name),prior=['ura-sword-suppressed','ura-sword-stopped','ura-sword-silenced'].includes(name);let s=createGame(players,entropy(),{startingSeat:prior?3:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[mode.owner?'忍びのイダ':'侍大将のシン',mode.owner?'侍大将のシン':'黒騎士ガーウィン','黒妖精のアーネス','魔導王ガイナス'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit!+=(p.id===a?(options.spirit??6):6)-gameStats(s,p.id).spirit;}
 s.players[a]!.permanent!.warrior_level!+=(options.warrior??(name==='ura-sword-low'?4:mode.dedicated?0:5))-gameStats(s,a).warrior_level;
 const keep=[takeCard(s,a,uraSwordCard),takeCard(s,d,'a2-p02-r2c3')];if(options.incoming)keep.push(takeCard(s,b,'a2-p24-r1c2'));if(mode.guard)keep.push(takeCard(s,b,'a2-p22-r1c1'),takeCard(s,c,'a2-p18-r3c3'));
 keep.push(takeCard(s,a,'a2-p24-r1c3'),takeCard(s,c,'a2-p02-r1c3'));if(name==='ura-sword-maai')keep.push(takeCard(s,b,'a2-p06-r1c3'),takeCard(s,b,'a2-p07-r1c1'));if(name==='ura-sword-evade')keep.push(takeCard(s,b,'a2-p05-r3c1'));if(prior)keep.push(takeCard(s,d,name==='ura-sword-suppressed'?'a2-p13-r1c2':name==='ura-sword-stopped'?'a2-p13-r2c1':'a2-p18-r1c1'));
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];s.events=[];
 function act(actorId:string,command:GameCommand,face=1){const input={actorId,command},e={...entropy(),dice:Array(100).fill(face)},r=transition(s,input,e);if(!r.ok)throw Error(`URA_SWORD_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('URA_SWORD_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('URA_SWORD_FIXTURE_CARDS');}
 function settle(face=1){for(let n=0;n<500;n++){const w=s.windows?.at(-1);if(!w)return;act(w.participants[w.cursor]!,{type:'PASS'},face);}throw Error('URA_SWORD_FIXTURE_LIMIT');}
 for(const id of [a,b,c,d]){if(mode.guard&&(id===b||id===c))act(id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:id===b?'a2-p22-r1c1':'a2-p18-r3c3'});act(id,{type:'PASS_SETUP'});}if(options.beforeStart)return s;
 if(prior){act(d,{type:'START_TURN'});settle();act(d,{type:'CHOOSE_DRAW',draw:false});act(d,{type:'ATTACK',cardInstanceId:name==='ura-sword-suppressed'?'a2-p13-r1c2':name==='ura-sword-stopped'?'a2-p13-r2c1':'a2-p18-r1c1',targetIds:[a],dedicated:false});settle(6);if(s.phase==='withdrawal')act(d,{type:'PASS_WITHDRAWAL'});act(d,{type:'END_TURN',discardIds:[]});settle();}
 act(a,{type:'START_TURN'});settle(prior?6:1);if(s.phase==='draw')act(a,{type:'CHOOSE_DRAW',draw:false});
 if(name!=='ura-sword-far'&&name!=='ura-sword-stopped'){act(a,{type:'APPROACH',cardInstanceId:'a2-p24-r1c3',targetId:options.approachTarget??b});settle();}return s;
}
