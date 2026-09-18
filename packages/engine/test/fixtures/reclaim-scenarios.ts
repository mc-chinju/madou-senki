import {makeOrdinaryFollowerDeathScenario} from './ordinary-follower-death-scenario.js';
import {namedDeathAllScenarioNames,isNamedDeathScenario,makeNamedDeathScenario} from './named-follower-death-scenario.js';
import {makeReclaimCrystalScenario} from './reclaim-crystal-scenario.js';
import {makeReuseScenario} from './reuse-scenario.js';
import {makeSwordShuffleScenario} from './sword-shuffle-scenario.js';
import {makePrintedCombinationScenario} from './printed-combination-scenario.js';
import {makeAllArmyScenario} from './all-army-scenario.js';
import {wishScenarioNames,makeWishScenario} from './wish-scenario.js';
import {anytimeScenarioNames,makeAnytimeScenario} from './anytime-scenarios.js';
import {actionCards,getCharacter} from '@madou/catalog';
import {allCardInstanceIds,createGame,transition,viewFor,type GameCommand,type GameState} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export const reclaimScenarioNames=['reclaim-ordinary-follower-death',...namedDeathAllScenarioNames,'reclaim-crystals','reclaim-crystals-second','reclaim-extra','reclaim-unlimited','reclaim-sword-dawn','reclaim-sword-rebuild','reclaim-all-army','reclaim-all-army-fail','reclaim-printed-combinations','reclaim-printed-counter',...wishScenarioNames,...anytimeScenarioNames,'reclaim-owned','reclaim-unowned','reclaim-courage','reclaim-courage-fail','reclaim-distance','reclaim-sword-discard','reclaim-sword-install','reclaim-rest','reclaim-potion','reclaim-early','reclaim-choices'] as const;
export type ReclaimScenarioName=typeof reclaimScenarioNames[number];
export function isReclaimScenario(name:string):name is ReclaimScenarioName {return reclaimScenarioNames.some(n=>n===name);}
/** Deal, characters and prior stat changes are fixture input. Attack and mental declaration use actual commands; Courage and recovery stay live. */
export function makeReclaimScenario(name:ReclaimScenarioName,players:{id:string;name:string}[]):GameState {
  if(name==='reclaim-ordinary-follower-death')return makeOrdinaryFollowerDeathScenario(players);
  if(isNamedDeathScenario(name))return makeNamedDeathScenario(name,players);
  if(name==='reclaim-crystals'||name==='reclaim-crystals-second')return makeReclaimCrystalScenario(players,name==='reclaim-crystals-second');
  if(name==='reclaim-extra'||name==='reclaim-unlimited')return makeReuseScenario(players,name==='reclaim-unlimited');
  if(name==='reclaim-sword-dawn'||name==='reclaim-sword-rebuild')return makeSwordShuffleScenario(players,true,name==='reclaim-sword-dawn');
  if(name==='reclaim-all-army'||name==='reclaim-all-army-fail')return makeAllArmyScenario(players,name==='reclaim-all-army-fail');
  if(name==='reclaim-printed-combinations'||name==='reclaim-printed-counter')return makePrintedCombinationScenario(players,name==='reclaim-printed-counter');
  if(name==='reclaim-wish'||name==='reclaim-wish-open')return makeWishScenario(players,name==='reclaim-wish-open');
  if(anytimeScenarioNames.includes(name as typeof anytimeScenarioNames[number]))return makeAnytimeScenario(name as typeof anytimeScenarioNames[number],players);
  if(players.length!==4)throw Error('RECLAIM_FIXTURE_FOUR_SEATS');
  let game=createGame(players,entropy(),{startingSeat:0});
  const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
  const courage=name.startsWith('reclaim-courage'),distance=name==='reclaim-distance',sword=name.startsWith('reclaim-sword'),install=name==='reclaim-sword-install';
  const early=name==='reclaim-early',choices=name==='reclaim-choices';
  assignCharacter(game,a,choices?'占星術師のアルセイル':early?'聖騎士ランスロット':install?'小妖精のチャム':(name==='reclaim-owned'||courage||distance||sword)?'大神官ジル':'白魔術師シェリム');
  assignCharacter(game,b,choices?getCharacter('c2-p04-r1c2')!.name:courage?'魔聖母ディア':'占星術師のアルセイル');assignCharacter(game,c,courage?'吟遊詩人のレスター':sword&&!install?'小妖精のチャム':'忍びのイダ');assignCharacter(game,d,'黒騎士ガーウィン');
  const heal=takeCard(game,a,early?'修行（戦士技）':courage?'勇気':distance?'踏み込み／蹴る':sword?'ふぇありぃそぅど':'封傷'),fate=takeCard(game,b,distance?'間合い／休息':'命運凶変');
  const utility=name==='reclaim-rest'||name==='reclaim-potion';
  const utilityName=name==='reclaim-rest'?'間合い／休息':'回復の薬';
  const utilityCards=utility?actionCards.filter(c=>c.name===utilityName).slice(0,2).map(c=>takeCard(game,a,c.id)):[];
  const earlyCards=early?['a2-p03-r1c1','a2-p03-r1c2','a2-p03-r1c3','a2-p03-r2c2','a2-p03-r2c3'].map(id=>takeCard(game,a,id)):[];
  const choiceCards=choices?['a2-p04-r1c1','a2-p04-r1c2','a2-p04-r1c3','a2-p04-r2c2','a2-p05-r1c2'].map(id=>takeCard(game,a,id)):[];
  if(choices){game.players[a]!.permanent={spirit:20};game.players[b]!.permanent={spirit:-20};game.players[b]!.revealed=true;}
  const attack=courage?takeCard(game,a,'踏み込み／弓'):undefined;
  if(courage)game.players[c]!.permanent={...game.players[c]!.permanent,spirit:name==='reclaim-courage-fail'?-20:20};
  if(name==='reclaim-sword-discard'){for(const card of ['神性介入','転移'])if(game.players[a]!.hand.length<=5)takeCard(game,a,card);}else trimHand(game,a,...(choices?[]:[heal]),...choiceCards,...earlyCards,...utilityCards,...(attack?[attack]:[]));trimHand(game,b,fate);game.players[a]!.damage=utility?8:2;
  const act=(actorId:string,command:GameCommand)=>{const r=transition(game,{actorId,command},entropy());if(!r.ok)throw Error(`RECLAIM_FIXTURE_${r.code}`);game=r.state;};
  readySetup(()=>game,id=>act(id,{type:'PASS_SETUP'}));
  act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
  if(courage){
    act(a,{type:'ATTACK',cardInstanceId:attack!,targetIds:[b],dedicated:false});
    for(let n=0;game.windows?.at(-1)?.kind!=='normal-defense'&&n<100;n++){const w=game.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}
    const option=viewFor(game,b).abilityOptions.find(o=>o.abilityId==='c2-p06-r1c2-ab01')!;
    act(b,{type:'USE_ABILITY',abilityId:option.abilityId,targetEventId:option.targetEventId});
    for(let n=0;game.windows!.at(-1)!.participants[game.windows!.at(-1)!.cursor]!==a&&n<10;n++){const w=game.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}
    if(!viewFor(game,a).anytimeCardOptions.length)throw Error('COURAGE_FIXTURE_DECLARATION');
  }
  if(game.reclaimDecisions?.length||allCardInstanceIds(game).length!==220||new Set(allCardInstanceIds(game)).size!==220)throw Error('RECLAIM_FIXTURE_STATE');
  return game;
}
