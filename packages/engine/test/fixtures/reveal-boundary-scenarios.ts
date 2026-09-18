import {createGame,transition,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
import {makeKiSlashPhysical} from './ki-slash-physical-scenarios.js';
export type RevealBoundaryScenario='canonical-S15-before'|'canonical-S15-after'|'canonical-S16';
export function isRevealBoundaryScenario(name:string):name is RevealBoundaryScenario{return ['canonical-S15-before','canonical-S15-after','canonical-S16'].includes(name);}
export function makeRevealBoundaryScenario(name:RevealBoundaryScenario,players:{id:string;name:string}[]){
 const zero=name==='canonical-S16',[a,b]=players.map(p=>p.id) as [string,string];let s=zero?makeKiSlashPhysical('ki-slash-ordinary',players,{spirit:0,warrior:6}):createGame(players,entropy(),{startingSeat:0});
 function act(actorId:string,command:GameCommand){const input={actorId,command},e={...entropy(),dice:Array(60).fill(1)},r=transition(s,input,e);if(!r.ok)throw Error(`REVEAL_BOUNDARY_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('REVEAL_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('REVEAL_CARDS');}
 function until(kind:string){for(let n=0;n<300;n++){const w=s.windows!.at(-1)!;if(w.kind===kind)return;act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('REVEAL_LIMIT');}
 if(!zero){for(const [i,p] of players.entries()){assignCharacter(s,p.id,['侍大将のシン','大神官ジル','黒騎士ガーウィン','魔導王ガイナス'][i]!);s.players[p.id]!.permanent={endurance:100,spirit:20,warrior_level:20};}takeCard(s,a,'a2-p24-r1c2');trimHand(s,a,'a2-p24-r1c2');for(const p of players)act(p.id,{type:'PASS_SETUP'});act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});act(a,{type:'REVEAL_CHARACTER'});}
 act(a,{type:'ATTACK',cardInstanceId:zero?'a2-p08-r3c3':'a2-p24-r1c2',targetIds:[b],dedicated:false});until(zero?'attack-abilities':'normal-defense');
 if(name==='canonical-S15-after'){act(b,{type:'START_FOLLOWERS'});until('follower-start');}return s;
}
