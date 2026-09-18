import {getAction} from '@madou/catalog';
import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export const teleportPhysicalScenarios={'teleport-physical-1':'a2-p06-r1c1','teleport-physical-2':'a2-p06-r1c2'} as const;
export type TeleportPhysicalScenario=keyof typeof teleportPhysicalScenarios;
export function isTeleportPhysicalScenario(name:string):name is TeleportPhysicalScenario{return Object.hasOwn(teleportPhysicalScenarios,name);}
/** Initial allocations followed only by actual setup/turn/attack commands. B has spirit6. */
export function makeTeleportPhysicalScenario(name:TeleportPhysicalScenario,players:{id:string;name:string}[],mental=false){
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];assignCharacter(s,a,'侍大将のシン');assignCharacter(s,b,'餓狼ヨーツルム');assignCharacter(s,c,'大神官ジル');assignCharacter(s,d,'魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};s.players[b]!.permanent!.spirit=20+6-gameStats(s,b).spirit;
 const attack=takeCard(s,a,mental?'a2-p17-r1c2':'踏み込み／弓'),card=takeCard(s,b,teleportPhysicalScenarios[name]),spare=takeCard(s,b,card==='a2-p06-r1c1'?'a2-p06-r1c2':'a2-p06-r1c1'),evade=takeCard(s,b,'見切る'),fate=takeCard(s,c,'命運凶変');trimHand(s,a,attack);trimHand(s,b,card,spare,evade);trimHand(s,c,fate);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e=entropy(),r=transition(s,input,e);if(!r.ok)throw Error(`TELEPORT_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('TELEPORT_FIXTURE_JSON');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('TELEPORT_FIXTURE_IDS');}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:[b],dedicated:false});for(let n=0;n<300;n++){const w=s.windows!.at(-1)!;if(w.kind==='normal-defense')return s;act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('TELEPORT_FIXTURE_WINDOW');
}
