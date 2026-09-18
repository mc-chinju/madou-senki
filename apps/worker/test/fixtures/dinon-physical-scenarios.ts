import {getAction} from '@madou/catalog';
import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export const dinonPhysicalScenarios=['dinon-hidden','dinon-public','dinon-self','dinon-source-only','dinon-target-empty','dinon-both-empty','dinon-unequal','dinon-overflow-source','dinon-overflow-target','dinon-fate','dinon-source-refill','dinon-target-refill','dinon-zones','dinon-decline'] as const;
export type DinonPhysicalScenario=typeof dinonPhysicalScenarios[number];
export function isDinonPhysicalScenario(name:string):name is DinonPhysicalScenario{return (dinonPhysicalScenarios as readonly string[]).includes(name);}
export const dinonCard='a2-p04-r1c3' as const;
/** Initial hand-size boundary fixtures; ownership changes, optional installed zones,
 * chant and OPEN all follow actual setup and complete turn commands. */
export function makeDinonPhysicalScenario(name:DinonPhysicalScenario,players:{id:string;name:string}[],beforeStart=false){
 const zones=name==='dinon-zones';let s=createGame(players,entropy(),{startingSeat:zones?1:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];for(const [i,p] of players.entries())assignCharacter(s,p.id,['侍大将のシン','大神官ジル','黒騎士ガーウィン','魔導王ガイナス'][i]!);for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};
 const keep=[takeCard(s,a,dinonCard),takeCard(s,d,'a2-p02-r2c3')];if(name==='dinon-source-refill'||name==='dinon-target-refill')keep.push(takeCard(s,name==='dinon-source-refill'?a:b,'a2-p02-r1c1'));if(zones)keep.push(takeCard(s,a,'a2-p03-r3c1'),takeCard(s,b,'a2-p03-r2c1'),takeCard(s,b,'a2-p13-r1c1'),takeCard(s,a,'a2-p18-r3c3'),takeCard(s,b,'a2-p21-r2c2'));for(const p of players)trimHand(s,p.id,...keep);
 function size(id:string,wanted:number){const p=s.players[id]!;while(p.hand.length>wanted){const i=p.hand.findIndex(x=>!keep.includes(x));if(i<0)throw Error('DINON_INITIAL_SIZE');s.deck.push(p.hand.splice(i,1)[0]!);}while(p.hand.length<wanted){const id=s.deck.find(x=>getAction(x)!.category!=='open')!;takeCard(s,p.id,id);}}
 if(name==='dinon-source-only'||name==='dinon-both-empty')size(a,1);if(name==='dinon-target-empty'||name==='dinon-both-empty')size(b,0);if(name==='dinon-unequal'){size(a,3);size(b,4);}if(name==='dinon-overflow-source')size(b,8);if(name==='dinon-overflow-target')size(a,9);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];if(zones){takeCard(s,a,'a2-p01-r1c3');s.players[a]!.hand=s.players[a]!.hand.filter(x=>x!=='a2-p01-r1c3');s.deck.unshift('a2-p01-r1c3');}s.events=[];
 function act(actorId:string,command:GameCommand,face=1){const input={actorId,command},e={...entropy(),dice:Array(100).fill(face)},r=transition(s,input,e);if(!r.ok)throw Error(`DINON_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('DINON_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('DINON_FIXTURE_CARDS');}
 function settle(){for(let n=0;n<500;n++){const w=s.windows?.at(-1);if(!w)return;act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('DINON_FIXTURE_WINDOW');}
 function start(id:string){act(id,{type:'START_TURN'});settle();if(s.phase==='draw'){act(id,{type:'CHOOSE_DRAW',draw:false});settle();}}
 function end(id:string){if(s.phase==='action')act(id,{type:'PASS_ACTION'});if(s.phase==='withdrawal')act(id,{type:'PASS_WITHDRAWAL'});act(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>!keep.includes(x)).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});settle();}
 for(const id of [a,b,c,d]){if(zones&&(id===a||id===b))act(id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:id===a?'a2-p18-r3c3':'a2-p21-r2c2'});act(id,{type:'PASS_SETUP'});}readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));if(beforeStart)return s;
 if(zones){start(b);act(b,{type:'PLAY_TURN_CARD',cardInstanceIds:['a2-p03-r2c1']});settle();end(b);for(const id of [c,d]){start(id);end(id);}start(a);act(a,{type:'PLAY_TURN_CARD',cardInstanceIds:['a2-p03-r3c1']});settle();end(a);start(b);act(b,{type:'CHANT',cardInstanceId:'a2-p13-r1c1'});settle();end(b);for(const id of [c,d]){start(id);end(id);}}
 start(a);if(name==='dinon-public'){act(b,{type:'REVEAL_CHARACTER'});settle();}return s;
}
