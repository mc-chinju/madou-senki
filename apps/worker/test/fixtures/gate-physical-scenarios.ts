import {getAction} from '@madou/catalog';
import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const gatePhysicalScenarios=['gate-physical-empty','gate-physical-spare','gate-physical-full','gate-physical-incompatible'] as const;
export type GatePhysicalScenario=typeof gatePhysicalScenarios[number];
export function isGatePhysicalScenario(name:string):name is GatePhysicalScenario{return gatePhysicalScenarios.some(x=>x===name);}
export const GATE='a2-p17-r3c3';
export function makeGatePhysicalScenario(name:GatePhysicalScenario,players:{id:string;name:string}[],options:{level?:number;donorSaint?:boolean}={}){
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];for(const [i,p] of players.entries())assignCharacter(s,p.id,['白魔術師シェリム','魔導王ガイナス','侍大将のシン','邪祭ウーノス'][i]!);for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+6-gameStats(s,p.id).spirit;}s.players[a]!.permanent!.magic_level=20+(options.level??5)-gameStats(s,a).magic_level;
 const ownCount=name.endsWith('-empty')?0:name.endsWith('-spare')?1:2,front=takeCard(s,b,options.donorSaint?'闇の聖女':name.endsWith('-incompatible')?'ガイナス城':'兵士'),rear=takeCard(s,b,'ゴブリン'),own=ownCount?[takeCard(s,a,'闇の聖女'),...(ownCount===2?[takeCard(s,a,'市民')]:[])]:[],keep=[takeCard(s,a,GATE),front,rear,...own,takeCard(s,d,'命運凶変'),takeCard(s,c,'メタルゴーレム')];for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e={...entropy(),dice:Array(100).fill(1)},r=transition(s,input,e);if(!r.ok)throw Error(`GATE_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('GATE_JSON');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('GATE_IDS');}
 for(const p of players){for(const cardInstanceId of p.id===a?own:p.id===b?[front,rear]:[])act(p.id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId});act(p.id,{type:'PASS_SETUP'});}act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});return s;
}
