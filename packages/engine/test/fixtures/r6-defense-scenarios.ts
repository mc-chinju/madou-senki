import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export type DefenseScenario='s06'|'s08'|'s09'|'s09-parry'|'s10'|'s10-seven';
/** Initial allocations only; every attack, failed teleport and prayer value is produced by commands. */
export function makeR6DefenseScenario(players:{id:string;name:string}[],mode:DefenseScenario):GameState{
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 assignCharacter(s,a,mode.startsWith('s09')?'竜皇子アスフェルト':'侍大将のシン');assignCharacter(s,b,'黒騎士ガーウィン');assignCharacter(s,c,'大神官ジル');assignCharacter(s,d,'魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};
 if(mode.startsWith('s09')||mode.startsWith('s10'))s.players[b]!.permanent!.warrior_level=(s.players[b]!.permanent!.warrior_level??0)+(mode==='s09-parry'?5:4)-gameStats(s,b).warrior_level;
 if(mode==='s08')s.players[b]!.permanent!.spirit=(s.players[b]!.permanent!.spirit??0)+6-gameStats(s,b).spirit;
 const attack=takeCard(s,a,mode==='s06'?'a2-p16-r1c1':mode.startsWith('s09')?'a2-p08-r1c3':mode==='s08'?'踏み込み／弓':'黒翼飛翔剣');
 const counter=takeCard(s,b,mode==='s09-parry'?'受け流し':mode==='s08'?'閃光槍':'妖撃破山剣'),teleport=mode==='s08'?takeCard(s,b,'転移'):null,prayer=mode.startsWith('s10')?takeCard(s,b,'必勝の祈り'):null;
 trimHand(s,a,attack);trimHand(s,b,counter,...(teleport?[teleport]:[]),...(prayer?[prayer]:[]));s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand,dice=Array(100).fill(1)){const input={actorId,command},e={...entropy(),dice},r=transition(s,input,e);if(!r.ok)throw Error(`S06_10_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('S06_10_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('S06_10_CARDS');}
 function until(done:()=>boolean,dice=Array(100).fill(1)){for(let n=0;n<300;n++){if(done())return;const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'},dice);}throw Error('S06_10_WINDOW');}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:mode.startsWith('s09')?[b,c]:[b],dedicated:mode.startsWith('s09')});until(()=>s.windows?.at(-1)?.kind==='normal-defense');
 if(mode==='s08'){act(b,{type:'PLAY_DEFENSE',cardInstanceId:teleport!,dedicated:false});until(()=>s.windows?.at(-1)?.kind==='normal-defense',[6,6]);}
 if(mode==='s10-seven'){act(b,{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});until(()=>s.windows?.at(-1)?.kind==='effect-level'&&s.windows.at(-1)!.participants[s.windows.at(-1)!.cursor]===b);const defense=Object.values(s.actions!).find(x=>x.kind==='defense')!;act(b,{type:'PLAY_REACTION',cardInstanceId:prayer!,mode:'effect-plus',targetActionId:defense.id});until(()=>s.windows?.at(-1)?.kind==='damage'&&s.windows.at(-1)!.continuation.id===defense.id,[2]);}
 return s;
}
