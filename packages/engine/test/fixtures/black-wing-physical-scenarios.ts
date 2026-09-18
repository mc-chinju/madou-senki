import {getAction} from '@madou/catalog';
import {createGame,gameStats,transition,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export const blackWingCard='a2-p08-r1c1';
export const blackWingScenarios=['black-wing-ordinary','black-wing-guard','black-wing-owner-ordinary','black-wing-low','black-wing-dedicated','black-wing-same-faction','black-wing-near','black-wing-fate','black-wing-maai-one','black-wing-maai-two','black-wing-ordinary-maai-one','black-wing-ordinary-maai-two','black-wing-evade','black-wing-suppressed','black-wing-stopped','black-wing-silenced','black-wing-wrong-owner','black-wing-decline'] as const;
export type BlackWingScenario=typeof blackWingScenarios[number];
export function isBlackWingScenario(name:string):name is BlackWingScenario{return (blackWingScenarios as readonly string[]).includes(name);}
export function blackWingMode(name:BlackWingScenario){const dedicated=!['black-wing-ordinary','black-wing-guard','black-wing-owner-ordinary','black-wing-low','black-wing-decline','black-wing-ordinary-maai-one','black-wing-ordinary-maai-two'].includes(name),owner=dedicated&&name!=='black-wing-wrong-owner'||name==='black-wing-owner-ordinary',guard=name==='black-wing-guard'||name==='black-wing-owner-ordinary'||dedicated;return {dedicated,owner,guard};}
export function makeBlackWingPhysical(name:BlackWingScenario,players:{id:string;name:string}[],options:{beforeStart?:boolean;warrior?:number;spirit?:number}={}){
 const mode=blackWingMode(name),prior=['black-wing-suppressed','black-wing-stopped','black-wing-silenced'].includes(name);let s=createGame(players,entropy(),{startingSeat:prior?3:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[mode.owner?'黒妖精のアーネス':'侍大将のシン',mode.owner?'侍大将のシン':'黒騎士ガーウィン','忍びのイダ','魔導王ガイナス'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit!+=(p.id===a?(options.spirit??6):6)-gameStats(s,p.id).spirit;}
 s.players[a]!.permanent!.warrior_level!+=(options.warrior??(name==='black-wing-low'?4:mode.dedicated?0:5))-gameStats(s,a).warrior_level;
 const keep=[takeCard(s,a,blackWingCard),takeCard(s,d,'a2-p02-r2c3')];if(mode.guard)keep.push(takeCard(s,b,'a2-p22-r1c1'),takeCard(s,c,'a2-p18-r3c3'));
 if(name==='black-wing-near')keep.push(takeCard(s,a,'a2-p24-r1c3'));if(name.includes('maai-'))keep.push(takeCard(s,b,'a2-p06-r1c3'),takeCard(s,b,'a2-p07-r1c1'));if(name==='black-wing-evade')keep.push(takeCard(s,b,'a2-p05-r3c1'));if(prior)keep.push(takeCard(s,d,name==='black-wing-suppressed'?'a2-p13-r1c2':name==='black-wing-stopped'?'a2-p13-r2c1':'a2-p18-r1c1'));
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];s.events=[];
 function act(actorId:string,command:GameCommand,face=1){const input={actorId,command},e={...entropy(),dice:Array(100).fill(face)},r=transition(s,input,e);if(!r.ok)throw Error(`BLACK_WING_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('BLACK_WING_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('BLACK_WING_FIXTURE_CARDS');}
 function settle(face=1){for(let n=0;n<500;n++){const w=s.windows?.at(-1);if(!w)return;act(w.participants[w.cursor]!,{type:'PASS'},face);}throw Error('BLACK_WING_FIXTURE_LIMIT');}
 for(const id of [a,b,c,d]){if(mode.guard&&(id===b||id===c))act(id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:id===b?'a2-p22-r1c1':'a2-p18-r3c3'});act(id,{type:'PASS_SETUP'});}readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));if(options.beforeStart)return s;
 if(prior){act(d,{type:'START_TURN'});settle();act(d,{type:'CHOOSE_DRAW',draw:false});act(d,{type:'ATTACK',cardInstanceId:name==='black-wing-suppressed'?'a2-p13-r1c2':name==='black-wing-stopped'?'a2-p13-r2c1':'a2-p18-r1c1',targetIds:[a],dedicated:false});settle(6);if(s.phase==='withdrawal')act(d,{type:'PASS_WITHDRAWAL'});act(d,{type:'END_TURN',discardIds:[]});settle();}
 act(a,{type:'START_TURN'});settle(prior?6:1);if(s.phase==='draw')act(a,{type:'CHOOSE_DRAW',draw:false});
 if(name==='black-wing-same-faction'){act(c,{type:'REVEAL_CHARACTER'});settle();}if(name==='black-wing-near'){act(a,{type:'APPROACH',cardInstanceId:'a2-p24-r1c3',targetId:b});settle();}return s;
}
