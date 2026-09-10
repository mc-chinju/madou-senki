import {getAction} from '@madou/catalog';
import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const annihilationAxeScenarios=['annihilation-ordinary','annihilation-dedicated','annihilation-chanted-dedicated'] as const;
export type AnnihilationAxeScenario=typeof annihilationAxeScenarios[number];
export function isAnnihilationAxeScenario(name:string):name is AnnihilationAxeScenario{return (annihilationAxeScenarios as readonly string[]).includes(name);}
/** All modes begin before actual CHANT; tests execute required or optional preparation and the full intervening turn order. */
export function makeAnnihilationAxeScenario(_name:AnnihilationAxeScenario,players:{id:string;name:string}[],options:{level?:number;owner?:string;followers?:boolean}={}){
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];assignCharacter(s,a,options.owner??'小人のランバ');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'大神官ジル');assignCharacter(s,d,'魔導王ガイナス');for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};const stats=gameStats(s,a);s.players[a]!.permanent!.warrior_level=20+(options.level??7)-stats.warrior_level;s.players[a]!.permanent!.spirit=20+6-stats.spirit;
 const axe=takeCard(s,a,'a2-p11-r3c3'),fate=takeCard(s,c,'命運凶変'),evade=takeCard(s,b,'見切る'),guard=options.followers?takeCard(s,b,'水竜'):null,skeleton=options.followers?takeCard(s,c,'スケルトン'):null;for(const id of [a,b,c,d])trimHand(s,id,axe,fate,evade,...(guard?[guard]:[]),...(skeleton?[skeleton]:[]));s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e=entropy(),r=transition(s,input,e);if(!r.ok)throw Error(`ANNIHILATION_AXE_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('ANNIHILATION_AXE_JSON');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('ANNIHILATION_AXE_IDS');}
 for(const id of [a,b,c,d]){const follower=id===b?guard:id===c?skeleton:null;if(follower)act(id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:follower});act(id,{type:'PASS_SETUP'});}act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});return s;
}
