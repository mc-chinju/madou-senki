import {createGame,transition,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export function makeS07PrayerScenario(players:{id:string;name:string}[]){
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b]=players.map(p=>p.id) as [string,string];
 for(const [i,p] of players.entries()){assignCharacter(s,p.id,['侍大将のシン','リーア姫','黒騎士ガーウィン','魔導王ガイナス'][i]!);s.players[p.id]!.permanent={endurance:100,spirit:20,warrior_level:20};}
 takeCard(s,a,'a2-p24-r1c2');takeCard(s,b,'a2-p24-r1c3');takeCard(s,b,'a2-p05-r2c3');trimHand(s,a,'a2-p24-r1c2');trimHand(s,b,'a2-p24-r1c3','a2-p05-r2c3');
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e={...entropy(),dice:Array(50).fill(1)},r=transition(s,input,e);if(!r.ok)throw Error(`S07_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('S07_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('S07_CARDS');}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});return s;
}
