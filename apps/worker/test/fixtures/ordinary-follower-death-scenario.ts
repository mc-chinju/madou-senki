import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export function makeOrdinaryFollowerDeathScenario(players:{id:string;name:string}[]){
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b]=players.map(p=>p.id) as [string,string],cardName='女神官のシャリア';
 assignCharacter(s,a,'大神官ジル');assignCharacter(s,b,'侍大将のシン');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,warrior_level:20};s.distances[a]![b]='near';s.distances[b]![a]='near';
 const card=takeCard(s,a,cardName),attack=takeCard(s,b,'妖撃破山剣');
 for(const p of players)trimHand(s,p.id,card,attack);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e=entropy(),r=transition(s,input,e);if(!r.ok)throw Error(`ORDINARY_FOLLOWER_DEATH_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('ORDINARY_FOLLOWER_DEATH_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('ORDINARY_FOLLOWER_DEATH_CARDS');}
 function pass(){const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));
 act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[card]});
 act(a,{type:'END_TURN',discardIds:s.players[a]!.hand.slice(0,Math.max(0,s.players[a]!.hand.length-gameStats(s,a).handLimit))});while(s.windows?.length)pass();
 act(b,{type:'START_TURN'});act(b,{type:'CHOOSE_DRAW',draw:false});act(b,{type:'ATTACK',cardInstanceId:attack,targetIds:[a],dedicated:false});
 for(let n=0;n<300;n++){if(s.windows?.at(-1)?.kind==='normal-defense')return s;pass();}throw Error('ORDINARY_FOLLOWER_DEATH_DEFENSE');
}
