import {allCardInstanceIds,createGame,gameStats,transition,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const sharedReclaimScenarioNames=['shared-a09-self','shared-budget-none','shared-budget-base','shared-budget-extra','shared-budget-both','shared-a09-hidden','shared-a09-none','shared-a09-fail','shared-a31-hidden','shared-a31-none'] as const;
export type SharedReclaimScenario=typeof sharedReclaimScenarioNames[number];
export function isSharedReclaimScenario(name:string):name is SharedReclaimScenario{return sharedReclaimScenarioNames.some(n=>n===name);}
export function makeSharedReclaimScenario(name:SharedReclaimScenario,players:{id:string;name:string}[]):GameState {
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string],courage=name.startsWith('shared-a09'),budget=name.startsWith('shared-budget');
 assignCharacter(s,a,budget?'妖精王フューリー':'大神官ジル');assignCharacter(s,b,courage?'吟遊詩人のレスター':budget?'大神官ジル':'小妖精のチャム');assignCharacter(s,c,'魔聖母ディア');assignCharacter(s,d,'魔導王ガイナス');
 if(name==='shared-a09-self'){assignCharacter(s,a,'吟遊詩人のレスター');assignCharacter(s,b,'大神官ジル');}
 if(!budget&&name.endsWith('none'))assignCharacter(s,b,'忍びのイダ');
 for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,spirit:20};if(name==='shared-a09-fail')s.players[b]!.permanent!.spirit=-20;s.players[b]!.revealed=false;
 if(budget)s.players[a]!.reclaimUsage={'踏み込み／弓':{baseSpent:name==='shared-budget-none'||name==='shared-budget-extra',extraSpentByAbility:name==='shared-budget-none'||name==='shared-budget-base'?['c2-p02-r1c2-ab03']:[]}};
 const source=takeCard(s,a,courage?'勇気':budget?'踏み込み／弓':'ふぇありぃそぅど'),attack=takeCard(s,a,'踏み込み／弓');trimHand(s,a,source,attack);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 if(!courage&&!budget)for(const name of ['神性介入','封傷','転移','衝破'])if(s.players[a]!.hand.length<=gameStats(s,a).handLimit)takeCard(s,a,name);
 function act(actorId:string,command:GameCommand){const input={actorId,command},r=transition(s,input,entropy());if(!r.ok)throw Error(`SHARED_RECLAIM_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,entropy())))throw Error('SHARED_RECLAIM_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('SHARED_RECLAIM_CARDS');}
 function until(done:()=>boolean){for(let n=0;n<300;n++){if(done())return;const w=s.windows?.at(-1);if(!w)throw Error('SHARED_RECLAIM_WINDOW');act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('SHARED_RECLAIM_LIMIT');}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 if(budget){act(a,{type:'ATTACK',cardInstanceId:source,targetIds:[c],dedicated:false});until(()=>s.windows?.at(-1)?.kind==='reclaim');return s;}
 if(!courage){act(a,{type:'PASS_ACTION'});act(a,{type:'END_TURN',discardIds:[source,...s.players[a]!.hand.filter(id=>id!==source)].slice(0,s.players[a]!.hand.length-gameStats(s,a).handLimit)});return s;}
 act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:[c],dedicated:false});until(()=>s.windows?.at(-1)?.kind==='normal-defense');const ability=viewFor(s,c).abilityOptions.find(o=>o.abilityId==='c2-p06-r1c2-ab01')!;act(c,{type:'USE_ABILITY',abilityId:ability.abilityId,targetEventId:ability.targetEventId});until(()=>s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]===a);act(a,{type:'PLAY_ANYTIME_CARD',cardInstanceId:source,targetEventId:viewFor(s,a).reactionTargetAbilityId!});until(()=>s.reclaimDecisions?.at(-1)?.source.kind==='courage-resolution');return s;
}
