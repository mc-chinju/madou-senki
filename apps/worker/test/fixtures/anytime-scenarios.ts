import {makeSubstituteScenario} from './substitute-scenario.js';
import {makeDispelScenario} from './dispel-scenario.js';
import {makeInformationAnytimeScenario} from './information-anytime-scenarios.js';
import {getAction} from '@madou/catalog';
import {createGame,transition,viewFor,type GameState,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const anytimeScenarioNames=['reclaim-substitute-open','reclaim-substitute','reclaim-dispel','reclaim-peace','reclaim-revelation','reclaim-tragedy','reclaim-keil','reclaim-hostage','reclaim-amulet'] as const;
export function makeAnytimeScenario(name:typeof anytimeScenarioNames[number],players:{id:string;name:string}[]):GameState {
 if(name==='reclaim-substitute'||name==='reclaim-substitute-open')return makeSubstituteScenario(players,name==='reclaim-substitute-open');
 if(name==='reclaim-dispel')return makeDispelScenario(players);
 if(name==='reclaim-peace'||name==='reclaim-revelation')return makeInformationAnytimeScenario(name,players);
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 const amulet=name==='reclaim-amulet',hostage=name==='reclaim-hostage',keil=name==='reclaim-keil';
 assignCharacter(s,a,hostage||amulet?'侍大将のシン':'魔導王ガイナス');assignCharacter(s,b,amulet?'魔聖母ディア':hostage?'黒騎士ガーウィン':'聖騎士ランスロット');assignCharacter(s,c,hostage?'小妖精のチャム':'忍びのイダ');assignCharacter(s,d,'大神官ジル');
 s.players[a]!.revealed=true;s.players[b]!.revealed=true;s.players[a]!.permanent={warrior_level:20};s.players[b]!.permanent={endurance:100};s.players[c]!.permanent={endurance:100};
 const response=takeCard(s,amulet?a:b,amulet?'a2-p01-r3c2':hostage?'a2-p02-r2c2':keil?'a2-p01-r3c1':'a2-p01-r2c3');const fate=takeCard(s,c,'命運凶変');const attack=takeCard(s,a,amulet?'踏み込み／弓':keil?'天地爆砕剣':'天地百撃斬');
 trimHand(s,a,attack,...(amulet?[response]:[]));trimHand(s,b,...(!amulet?[response]:[]));trimHand(s,c,fate);
 const act=(actorId:string,command:GameCommand,dice=Array(100).fill(1))=>{const r=transition(s,{actorId,command},{...entropy(),dice});if(!r.ok)throw Error(`ANYTIME_FIXTURE_${r.code}`);s=r.state;};
 const pass=()=>{const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'},[3,...Array(100).fill(1)]);};
 for(const id of [a,b,c,d])act(id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 if(!amulet){act(a,{type:'CHANT',cardInstanceId:attack});for(let n=0;n<4;n++){const id=s.seatOrder[s.turnSeat]!;act(id,{type:'END_TURN',discardIds:s.players[id]!.hand.slice(viewFor(s,id).self.stats.handLimit)});const next=s.seatOrder[s.turnSeat]!;act(next,{type:'START_TURN'});act(next,{type:'CHOOSE_DRAW',draw:false});if(next!==a)act(next,{type:'PASS_ACTION'});}}
 if(hostage)s.players[c]!.statuses=[{id:'prior-ban',kind:'ability-disabled',modifiers:[0],nextCheck:0}];
 act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:hostage||keil?[b,c]:[b],dedicated:hostage});
 for(let n=0;n<100&&s.windows?.at(-1)?.kind!==(amulet?'normal-defense':'attack-abilities');n++)pass();
 if(amulet){const o=viewFor(s,b).abilityOptions.find(o=>o.abilityId==='c2-p06-r1c2-ab01')!;act(b,{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId});}
 const owner=amulet?a:b;for(let n=0;n<100&&!viewFor(s,owner).anytimeCardOptions.some(o=>o.cardInstanceId===response);n++)pass();
 if(!viewFor(s,owner).anytimeCardOptions.some(o=>o.cardInstanceId===response)||getAction(response)?.category!=='anytime')throw Error('ANYTIME_FIXTURE_NO_RESPONSE');return s;
}
