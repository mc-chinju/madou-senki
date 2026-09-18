import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
import {makeReclaimOtherworld} from './reclaim-otherworld-scenario.js';
import {makeReclaimRevival} from './reclaim-revival-scenario.js';
export type LiaPrayerScenario='lia-prayer-revival'|'lia-prayer-otherworld'|'lia-prayer'|'lia-prayer-second'|'lia-prayer-fatal';
export function makeLiaPrayerScenario(name:LiaPrayerScenario,players:{id:string;name:string}[]):GameState {
 if(name==='lia-prayer-revival')return makeReclaimRevival(players);
 if(name==='lia-prayer-otherworld')return makeReclaimOtherworld(players);
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];assignCharacter(s,a,'侍大将のシン');assignCharacter(s,b,'リーア姫');assignCharacter(s,c,'魔導王ガイナス');assignCharacter(s,d,'黒騎士ガーウィン');for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,spirit:20};const first=takeCard(s,a,'踏み込み／弓'),second=takeCard(s,d,'黒翼飛翔剣'),prayer=takeCard(s,b,'必勝の祈り');trimHand(s,a,first);trimHand(s,d,second);trimHand(s,b,prayer);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 if(name==='lia-prayer-fatal')s.players[b]!.damage=gameStats(s,b).endurance-1;
 function act(actorId:string,command:GameCommand){const input={actorId,command},r=transition(s,input,entropy());if(!r.ok)throw Error(`PRAYER_FIXTURE_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,entropy())))throw Error('PRAYER_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('PRAYER_FIXTURE_CARDS');}
 function until(done:()=>boolean){for(let n=0;n<300;n++){if(done())return;const w=s.windows?.at(-1);if(!w)throw Error('PRAYER_FIXTURE_WINDOW');act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('PRAYER_FIXTURE_LIMIT');}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'ATTACK',cardInstanceId:first,targetIds:[name==='lia-prayer-fatal'?b:c],dedicated:false});const offered=()=>s.windows?.at(-1)?.kind==='effect-level'&&s.windows.at(-1)!.participants[s.windows.at(-1)!.cursor]===b;until(offered);if(name!=='lia-prayer-second')return s;
 act(b,{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:s.windows!.at(-1)!.continuation.id,dedicated:true});until(()=>!s.windows?.length);
 for(let n=0;n<40;n++){const actor=s.seatOrder[s.turnSeat]!;if(s.phase==='action'){if(actor===d)break;act(actor,{type:'PASS_ACTION'});}else if(s.phase==='withdrawal')act(actor,{type:'PASS_WITHDRAWAL'});else if(s.phase==='hand-adjustment'){act(actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.filter(id=>id!==prayer).slice(0,Math.max(0,s.players[actor]!.hand.length-gameStats(s,actor).handLimit))});until(()=>!s.windows?.length);}else if(s.phase==='turn-start')act(actor,{type:'START_TURN'});else if(s.phase==='draw')act(actor,{type:'CHOOSE_DRAW',draw:false});else throw Error('PRAYER_FIXTURE_TURN');}
 act(d,{type:'ATTACK',cardInstanceId:second,targetIds:[a],dedicated:false});until(offered);return s;
}
