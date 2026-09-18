import {allCardInstanceIds,createGame,gameStats,transition,viewFor,type GameCommand} from '@madou/engine';
import {getAction,getCharacter} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const namedDeathScenarioNames=['reclaim-named-death-ship','reclaim-named-death-dragon','reclaim-named-death-griffin','reclaim-named-death-skeleton','reclaim-named-death-zombie','reclaim-named-death-wight','reclaim-named-death-knight'] as const;
export type NamedDeathScenario=typeof namedDeathScenarioNames[number];
export type NamedDeathNegativeScenario=`${NamedDeathScenario}-cancel`|`${NamedDeathScenario}-ban`;
export const namedDeathAllScenarioNames=[...namedDeathScenarioNames,...namedDeathScenarioNames.flatMap(name=>[`${name}-cancel`,`${name}-ban`] as const)];
export const namedDeathCases:Record<NamedDeathScenario,readonly [string,string]>={
 'reclaim-named-death-ship':['c2-p04-r1c2-ab04','歌う船'], 'reclaim-named-death-dragon':['c2-p04-r1c2-ab04','飛竜'],
 'reclaim-named-death-griffin':['c2-p05-r1c2-ab04','グリフォン'], 'reclaim-named-death-skeleton':['c2-p06-r1c1-ab04','スケルトン'],
 'reclaim-named-death-zombie':['c2-p06-r1c1-ab04','ゾンビー'], 'reclaim-named-death-wight':['c2-p06-r1c1-ab04','ワイト'], 'reclaim-named-death-knight':['c2-p06-r1c1-ab04','デス・ナイト'],
};
export function isNamedDeathScenario(name:string):name is NamedDeathScenario|NamedDeathNegativeScenario{return namedDeathAllScenarioNames.some(n=>n===name);}
export function makeNamedDeathScenario(name:NamedDeathScenario|NamedDeathNegativeScenario,players:{id:string;name:string}[]){
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b]=players.map(p=>p.id) as [string,string], [ability,cardName]=namedDeathCases[name.replace(/-(cancel|ban)$/,'') as NamedDeathScenario];
 assignCharacter(s,a,getCharacter(ability.split('-ab')[0]!)!.name);assignCharacter(s,b,'侍大将のシン');s.players[a]!.revealed=true;
 if(name.endsWith('-ban')){assignCharacter(s,players[2]!.id,'破壊神ヴァンミール');s.players[players[2]!.id]!.revealed=true;}
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,warrior_level:20};s.distances[a]![b]='near';s.distances[b]![a]='near';
 const card=takeCard(s,a,cardName),attack=takeCard(s,b,'妖撃破山剣'),prayer=cardName==='飛竜'?takeCard(s,b,'必勝の祈り'):undefined;
 const fate=name.endsWith('-cancel')?takeCard(s,b,'命運凶変'):undefined;
 for(const p of players)trimHand(s,p.id,card,attack,...(prayer?[prayer]:[]),...(fate?[fate]:[]));
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e=entropy(),r=transition(s,input,e);if(!r.ok)throw Error(`NAMED_DEATH_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('NAMED_DEATH_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('NAMED_DEATH_CARDS');}
 function pass(){const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});
 act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[card]});
 act(a,{type:'END_TURN',discardIds:s.players[a]!.hand.slice(0,Math.max(0,s.players[a]!.hand.length-gameStats(s,a).handLimit))});while(s.windows?.length)pass();
 act(b,{type:'START_TURN'});act(b,{type:'CHOOSE_DRAW',draw:false});act(b,{type:'ATTACK',cardInstanceId:attack,targetIds:[a],dedicated:false});
 if(prayer){for(let n=0;n<150;n++){if(s.windows?.at(-1)?.kind==='effect-level'&&viewFor(s,b).activeWindow?.pendingActorId===b)break;pass();}const action=Object.values(s.actions!).find(x=>x.cardInstanceId===attack)!;act(b,{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:action.id});}
 for(let n=0;n<300;n++){if(s.windows?.at(-1)?.kind==='normal-defense')return s;pass();}throw Error('NAMED_DEATH_DEFENSE');
}
