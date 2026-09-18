import {createGame,gameStats,transition,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export function makeCanonicalDefense(players:{id:string;name:string}[],mode:'S09'|'S10'){
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c]=players.map(p=>p.id) as [string,string,string];
 for(const [i,p] of players.entries()){assignCharacter(s,p.id,[mode==='S09'?'小人のランバ':'黒妖精のアーネス',mode==='S09'?'侍大将のシン':'聖騎士ランスロット','魔導王ガイナス','魔聖母ディア'][i]!);s.players[p.id]!.permanent={endurance:100,spirit:20,warrior_level:20};}
 if(mode==='S09')s.players[b]!.permanent!.warrior_level!+=5-gameStats(s,b).warrior_level;
 const attack=takeCard(s,a,mode==='S09'?'a2-p11-r3c2':'a2-p07-r3c3'),counter=takeCard(s,b,mode==='S09'?'a2-p12-r1c3':'a2-p11-r1c2');const prayer=mode==='S10'?takeCard(s,b,'a2-p05-r2c3'):null;
 trimHand(s,a,attack);trimHand(s,b,counter,...(prayer?[prayer]:[]));s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e={...entropy(),dice:Array(50).fill(1)},r=transition(s,input,e);if(!r.ok)throw Error(`CANONICAL_${mode}_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('CANONICAL_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('CANONICAL_CARDS');}
 for(const p of players)act(p.id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'ATTACK',cardInstanceId:attack,targetIds:mode==='S09'?[b,c]:[b],dedicated:mode==='S09'});
 for(let n=0;n<300;n++){const w=s.windows!.at(-1)!;if(w.kind==='normal-defense')return s;act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('CANONICAL_DEFENSE_LIMIT');
}
