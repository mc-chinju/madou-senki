import {allCardInstanceIds,createGame,gameStats,transition,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export type DeathRewardScenario='death-reward-dia'|'death-reward-hunger'|'cham-death-gift';
export function makeDeathRewardScenario(name:DeathRewardScenario,players:{id:string;name:string}[]):GameState {
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string],cham=name==='cham-death-gift';
 assignCharacter(s,a,name==='death-reward-dia'?'魔聖母ディア':cham?'侍大将のシン':'餓狼ヨーツルム');assignCharacter(s,b,cham?'小妖精のチャム':'黒騎士ガーウィン');assignCharacter(s,c,'大神官ジル');assignCharacter(s,d,'魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,warrior_level:20,magic_level:20};s.players[a]!.damage=8;s.players[b]!.damage=gameStats(s,b).endurance-3;s.players[b]!.permanent!.spirit=(s.players[b]!.permanent!.spirit??0)+8-gameStats(s,b).spirit;
 const attack=takeCard(s,a,cham?'地槍':getAction('a2-p07-r3c3')!.name),gift=takeCard(s,b,'香具羅'),fate=takeCard(s,c,'命運凶変');trimHand(s,a,attack);trimHand(s,b,gift);trimHand(s,c,fate);
 function act(actorId:string,command:GameCommand){const input={actorId,command},r=transition(s,input,entropy());if(!r.ok)throw Error(`DEATH_REWARD_FIXTURE_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,entropy())))throw Error('DEATH_REWARD_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('DEATH_REWARD_CARDS');}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:[b],dedicated:false});
 for(let n=0;n<300;n++){const w=s.windows?.at(-1);if(cham?w?.kind==='death-gift':viewFor(s,a).abilityOptions.some(o=>o.abilityId===(name==='death-reward-dia'?'c2-p06-r1c2-ab03':'c2-p06-r2c2-ab04')))return s;if(!w)throw Error('DEATH_REWARD_WINDOW');act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('DEATH_REWARD_LIMIT');
}
