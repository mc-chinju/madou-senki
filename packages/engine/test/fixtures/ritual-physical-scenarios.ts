import {getAction,getCharacter} from '@madou/catalog';
import {allCardInstanceIds,createGame,gameStats,transition,viewFor,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export const ritualPhysicalScenarios=['ritual-basic','ritual-subordinates','ritual-conspiracy','ritual-both','ritual-fate','ritual-decline','ritual-gift-hidden','ritual-gift-public','ritual-gift-start','ritual-gift-draw','ritual-gift-end','ritual-gift-window','ritual-gift-suppressed','ritual-gift-stopped','ritual-gift-hidden-target','ritual-gift-dead-target','ritual-wrong-owner'] as const;
export type RitualPhysicalScenario=typeof ritualPhysicalScenarios[number]|'ritual-terminal'|'ritual-terminal-subordinates'|'ritual-otherworld'|'ritual-history'|'ritual-disabled'|'ritual-stopped';
export function isRitualPhysicalScenario(name:string):name is RitualPhysicalScenario{return name==='ritual-disabled'||name==='ritual-stopped'||name==='ritual-history'||name==='ritual-otherworld'||name==='ritual-terminal'||name==='ritual-terminal-subordinates'||(ritualPhysicalScenarios as readonly string[]).includes(name);}
export const ritualCard='a2-p05-r1c1' as const;
export function makeRitualPhysicalScenario(name:RitualPhysicalScenario,players:{id:string;name:string}[],beforeStart=false,terminal=false){
 terminal=terminal||name==='ritual-otherworld'||name==='ritual-terminal'||name==='ritual-terminal-subordinates';
 const gift=name.includes('gift'),dead=name==='ritual-gift-dead-target',prior=dead||name==='ritual-gift-suppressed'||name==='ritual-gift-stopped';
 let s=createGame(players,entropy(),{startingSeat:prior?3:0});
 const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,getCharacter(['c2-p05-r1c1','c2-p06-r1c2','c2-p04-r2c1','c2-p06-r2c2','c2-p05-r2c2','c2-p04-r2c1'][i]!)!.name);
 if(terminal||name==='ritual-history')assignCharacter(s,c,'早駆けのランカスター');
 if(name==='ritual-disabled'||name==='ritual-stopped')assignCharacter(s,d,'侍大将のシン');
 // Only initial deal and non-Uonos combat strength are arranged. Damage,
 // follower placement, attachment and suppression below come from commands.
 for(const id of [b,c,d])s.players[id]!.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};
 s.players[b]!.permanent!.spirit!+=6-gameStats(s,b).spirit;
 if(dead)s.players[a]!.permanent={endurance:4-gameStats(s,a).endurance};
 const source=name==='ritual-wrong-owner'?c:gift?b:a;
 const keep=[takeCard(s,source,ritualCard),takeCard(s,d,'a2-p02-r2c3')];
 if(terminal)keep.push(takeCard(s,c,'a2-p11-r1c1'));
 if(name==='ritual-otherworld')keep.push(takeCard(s,c,'a2-p14-r2c2'));
 if(name==='ritual-disabled'||name==='ritual-stopped')keep.push(takeCard(s,d,name==='ritual-disabled'?'a2-p13-r1c2':'a2-p13-r2c1'));
 if(name==='ritual-history')keep.push(takeCard(s,a,'a2-p13-r3c2'),takeCard(s,a,'a2-p24-r1c1'));
 if(!gift&&name!=='ritual-wrong-owner')keep.push(...(name==='ritual-history'?[]:[takeCard(s,a,'a2-p18-r3c3')]),takeCard(s,a,'a2-p03-r3c1'),takeCard(s,a,'a2-p21-r2c2'),takeCard(s,d,'a2-p24-r1c2'));
 if(dead)keep.push(takeCard(s,d,'a2-p24-r1c2'));
 if(prior&&!dead)keep.push(takeCard(s,d,name==='ritual-gift-stopped'?'a2-p13-r2c1':'a2-p13-r1c2'));
 for(const p of players)trimHand(s,p.id,...keep);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];s.events=[];
 function act(actorId:string,command:GameCommand,face=1){const input={actorId,command},e={...entropy(),dice:Array(100).fill(face)},r=transition(s,input,e);if(!r.ok)throw Error(`RITUAL_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('RITUAL_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('RITUAL_FIXTURE_CARDS');}
 function settle(face=1){for(let n=0;n<500;n++){const w=s.windows?.at(-1);if(!w)return;act(w.participants[w.cursor]!,{type:'PASS'},face);}throw Error('RITUAL_FIXTURE_LIMIT');}
 function start(id:string){act(id,{type:'START_TURN'});settle();if(s.phase==='draw'){act(id,{type:'CHOOSE_DRAW',draw:false});settle();}}
 function end(id:string){if(s.phase==='action')act(id,{type:'PASS_ACTION'});if(s.phase==='withdrawal')act(id,{type:'PASS_WITHDRAWAL'});act(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>!keep.includes(x)).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});settle();}
 for(const id of players.map(p=>p.id)){if(id===a&&!gift&&name!=='ritual-wrong-owner'&&name!=='ritual-history')act(id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:'a2-p18-r3c3'});act(id,{type:'PASS_SETUP'});}readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));
 if(beforeStart)return s;
 if(dead){start(d);act(d,{type:'ATTACK',cardInstanceId:'a2-p24-r1c2',targetIds:[a],dedicated:false});settle();if(s.players[a]!.presence!=='dead')throw Error('RITUAL_NO_DEAD_TARGET');return s;}
 if(prior){start(d);act(d,{type:'ATTACK',cardInstanceId:name==='ritual-gift-stopped'?'a2-p13-r2c1':'a2-p13-r1c2',targetIds:[b],dedicated:false});settle(6);end(d);}
 if(gift){
  if(name!=='ritual-gift-hidden-target'){act(a,{type:'REVEAL_CHARACTER'});settle();}
  if(name==='ritual-gift-public'){act(b,{type:'REVEAL_CHARACTER'});settle();}
  if(name==='ritual-gift-start')return s;
  act(a,{type:'START_TURN'});settle();if(name==='ritual-gift-draw')return s;
  act(a,{type:'CHOOSE_DRAW',draw:false});settle();
  if(name==='ritual-gift-end')act(a,{type:'PASS_ACTION'});
  if(name==='ritual-gift-window'){act(a,{type:'USE_ABILITY',abilityId:'c2-p05-r1c1-ab01',targetId:c,targetEventId:viewFor(s,a).abilityOptions.find(o=>o.abilityId==='c2-p05-r1c1-ab01')!.targetEventId});for(let n=0;n<100&&s.windows?.at(-1)?.participants[s.windows.at(-1)!.cursor]!==b;n++){const w=s.windows!.at(-1)!;act(w.participants[w.cursor]!,{type:'PASS'});}}
  return s;
 }
 start(a);if(name==='ritual-wrong-owner')return s;
 act(a,{type:'USE_ABILITY',abilityId:'c2-p05-r1c1-ab01',targetId:c,targetEventId:viewFor(s,a).abilityOptions.find(o=>o.abilityId==='c2-p05-r1c1-ab01')!.targetEventId});settle();
 act(a,{type:'PLAY_TURN_CARD',cardInstanceIds:['a2-p03-r3c1']});settle();end(a);
 for(const id of [b,c]){start(id);end(id);}start(d);act(d,{type:'ATTACK',cardInstanceId:'a2-p24-r1c2',targetIds:[a],dedicated:false});settle();end(d);for(const p of players.slice(4)){start(p.id);end(p.id);}start(a);act(a,{type:'ARRANGE_FOLLOWERS',cardInstanceIds:['a2-p21-r2c2']});settle();end(a);for(const p of players.slice(1)){start(p.id);if(p.id===d&&(name==='ritual-disabled'||name==='ritual-stopped'))return s;end(p.id);}start(a);return s;
}
