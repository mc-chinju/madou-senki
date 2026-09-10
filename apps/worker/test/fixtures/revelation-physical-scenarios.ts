import {getAction} from '@madou/catalog';
import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
import {makeR6OtherworldScenario} from './r6-otherworld-scenario.js';
export const revelationPhysicalScenarios=['revelation-zones','revelation-self','revelation-hand','revelation-combat','revelation-canceled','revelation-otherworld','revelation-history','revelation-pass','revelation-evil'] as const;
export type RevelationPhysicalScenario=typeof revelationPhysicalScenarios[number];
export function isRevelationPhysicalScenario(name:string):name is RevelationPhysicalScenario{return (revelationPhysicalScenarios as readonly string[]).includes(name);}
export function revelationTarget(name:RevelationPhysicalScenario){return name==='revelation-self'?3:name==='revelation-hand'?2:1;}
/** Arrange initial deals/training only; all followers/chants and the otherworld state have actual command producers. */
export function makeRevelationPhysicalScenario(name:RevelationPhysicalScenario,players:{id:string;name:string}[]){
 if(name==='revelation-otherworld')return makeR6OtherworldScenario(players);
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];for(const [i,p] of players.entries())assignCharacter(s,p.id,['魔導王ガイナス','聖騎士ランスロット','大神官ジル',name==='revelation-evil'?'黒騎士ガーウィン':'侍大将のシン'][i]!);for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:2};
 const followers=['市民','兵士'].map(id=>takeCard(s,b,id)),chants=['a2-p13-r1c1','a2-p14-r2c2'].map(id=>takeCard(s,b,id)),bow=takeCard(s,a,'a2-p24-r1c2'),fate=takeCard(s,c,'a2-p02-r2c3'),card=takeCard(s,d,'a2-p02-r1c2');for(const p of players)trimHand(s,p.id,...followers,...chants,bow,fate,card);const haja=takeCard(s,b,'a2-p01-r2c2');s.players[b]!.hand=s.players[b]!.hand.filter(id=>id!==haja);s.deck=[haja,...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 // Discard createGame logs for the pre-arranged deal; retain every actual setup/turn event below.
 s.events=[];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e=entropy(),r=transition(s,input,e);if(!r.ok)throw Error(`REVELATION_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('REVELATION_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('REVELATION_FIXTURE_CARDS');}
 function settle(){for(let n=0;n<300;n++){const w=s.windows?.at(-1);if(!w)return;act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('REVELATION_FIXTURE_WINDOW');}
 function start(id:string){act(id,{type:'START_TURN'});settle();act(id,{type:'CHOOSE_DRAW',draw:false});settle();}
 function end(id:string){if(s.phase==='action')act(id,{type:'PASS_ACTION'});if(s.phase==='withdrawal')act(id,{type:'PASS_WITHDRAWAL'});act(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>![...chants,bow,fate,card].includes(x)).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});settle();}
 for(const id of [a,b,c,d]){if(id===b)for(const cardInstanceId of followers)act(b,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId});act(id,{type:'PASS_SETUP'});}if(!s.players[b]!.open.includes(haja))throw Error('REVELATION_FIXTURE_HAJA');start(a);
 for(const cardInstanceId of chants){end(a);for(const id of [b,c,d]){start(id);if(id===b)act(b,{type:'CHANT',cardInstanceId});end(id);}start(a);}
 if(s.players[b]!.followers.length!==2||s.players[b]!.chants.length!==2)throw Error('REVELATION_FIXTURE_ZONES');return s;
}
