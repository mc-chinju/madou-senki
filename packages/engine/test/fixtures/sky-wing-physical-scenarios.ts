import {getAction} from '@madou/catalog';
import {createGame,gameStats,transition,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export const skyWingCard='a2-p08-r1c2';
export const skyWingScenarios=['sky-wing-ordinary','sky-wing-guard','sky-wing-owner-ordinary','sky-wing-low','sky-wing-dedicated','sky-wing-post-one','sky-wing-post-two','sky-wing-defense-advance','sky-wing-near','sky-wing-fate','sky-wing-maai-one','sky-wing-maai-two','sky-wing-evade','sky-wing-suppressed','sky-wing-stopped','sky-wing-silenced','sky-wing-wrong-owner','sky-wing-decline'] as const;
export type SkyWingScenario=typeof skyWingScenarios[number];
export function isSkyWingScenario(name:string):name is SkyWingScenario{return (skyWingScenarios as readonly string[]).includes(name);}
export function skyWingMode(name:SkyWingScenario){const dedicated=!['sky-wing-ordinary','sky-wing-guard','sky-wing-owner-ordinary','sky-wing-low','sky-wing-decline'].includes(name),owner=dedicated&&name!=='sky-wing-wrong-owner'||name==='sky-wing-owner-ordinary',guard=name==='sky-wing-guard'||name==='sky-wing-owner-ordinary'||dedicated;return {dedicated,owner,guard};}
export function makeSkyWingPhysical(name:SkyWingScenario,players:{id:string;name:string}[],options:{beforeStart?:boolean;warrior?:number;spirit?:number}={}){
 const mode=skyWingMode(name),prior=['sky-wing-suppressed','sky-wing-stopped','sky-wing-silenced'].includes(name);let s=createGame(players,entropy(),{startingSeat:prior?3:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[mode.owner?'黒妖精のアーネス':'侍大将のシン',mode.owner?'侍大将のシン':'黒騎士ガーウィン','忍びのイダ','魔導王ガイナス'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit!+=(p.id===a?(options.spirit??6):6)-gameStats(s,p.id).spirit;}
 s.players[a]!.permanent!.warrior_level!+=(options.warrior??(name==='sky-wing-low'?6:mode.dedicated?0:7))-gameStats(s,a).warrior_level;
 const keep=[takeCard(s,a,skyWingCard),takeCard(s,d,'a2-p02-r2c3'),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p24-r2c1'),takeCard(s,a,'a2-p04-r2c3')];if(mode.guard)keep.push(takeCard(s,b,'a2-p22-r1c1'),takeCard(s,c,'a2-p18-r3c3'));
 if(name.includes('maai-')||name==='sky-wing-defense-advance')keep.push(takeCard(s,b,'a2-p06-r1c3'),takeCard(s,b,'a2-p07-r1c1'));if(name==='sky-wing-evade')keep.push(takeCard(s,b,'a2-p05-r3c1'));if(prior)keep.push(takeCard(s,d,name==='sky-wing-suppressed'?'a2-p13-r1c2':name==='sky-wing-stopped'?'a2-p13-r2c1':'a2-p18-r1c1'));
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];s.events=[];
 function act(actorId:string,command:GameCommand,face=1){const input={actorId,command},e={...entropy(),dice:Array(100).fill(face)},r=transition(s,input,e);if(!r.ok)throw Error(`SKY_WING_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('SKY_WING_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('SKY_WING_FIXTURE_CARDS');}
 function settle(face=1){for(let n=0;n<500;n++){const w=s.windows?.at(-1);if(!w)return;act(w.participants[w.cursor]!,{type:'PASS'},face);}throw Error('SKY_WING_FIXTURE_LIMIT');}
 for(const id of [a,b,c,d]){if(mode.guard&&(id===b||id===c))act(id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:id===b?'a2-p22-r1c1':'a2-p18-r3c3'});act(id,{type:'PASS_SETUP'});}readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));if(options.beforeStart)return s;
 if(prior){act(d,{type:'START_TURN'});settle();act(d,{type:'CHOOSE_DRAW',draw:false});act(d,{type:'ATTACK',cardInstanceId:name==='sky-wing-suppressed'?'a2-p13-r1c2':name==='sky-wing-stopped'?'a2-p13-r2c1':'a2-p18-r1c1',targetIds:[a],dedicated:false});settle(6);if(s.phase==='withdrawal')act(d,{type:'PASS_WITHDRAWAL'});act(d,{type:'END_TURN',discardIds:[]});settle();}
 act(a,{type:'START_TURN'});settle(prior?6:1);if(s.phase==='draw')act(a,{type:'CHOOSE_DRAW',draw:false});
 return s;
}
