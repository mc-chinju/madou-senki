import {createGame,transition,gameStats,allCardInstanceIds} from '@madou/engine';
import {assignCharacter,entropy,takeCard} from './scenario-tools.js';
/** Initial deal, prior damage/training and faction boundary only; no ban, lease, death or revival is injected. */
export function makeCanonicalLiaLife(players:{id:string;name:string}[],vanmilDeath=false){
 let s=createGame(players,entropy(),{startingSeat:0});
 function act(actorId:string,command:Parameters<typeof transition>[1]['command']){const r=transition(s,{actorId,command},entropy());if(!r.ok)throw Error(r.code);s=r.state;}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});
 const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});
 assignCharacter(s,a,'破壊神ヴァンミール');assignCharacter(s,b,'竜皇子アスフェルト');assignCharacter(s,c,'リーア姫');assignCharacter(s,d,'邪祭ウーノス');s.players[a]!.revealed=true;
 s.players[b]!.faction='GOOD';s.players[b]!.currentObjective={kind:'extinction',enemyFactions:['EVIL']};s.players[b]!.permanent={...s.players[b]!.permanent,spirit:2};const damaged=vanmilDeath?a:c;s.players[damaged]!.damage=gameStats(s,damaged).endurance-1;
 const attack=takeCard(s,d,'踏み込み／弓'),revival=takeCard(s,d,'復活'),extra=s.players[d]!.hand.filter(id=>id!==attack&&id!==revival);s.players[d]!.hand=s.players[d]!.hand.filter(id=>id===attack||id===revival);s.deck.push(...extra);
 const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('LIA_LIFE_CARDS');return s;
}
