import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const godsBloodPhysicalScenarios=['blood-draw','blood-book','blood-transfer','blood-death','blood-warrior','blood-magic','blood-spirit'] as const;
export type GodsBloodPhysicalScenario=typeof godsBloodPhysicalScenarios[number];
export function isGodsBloodPhysicalScenario(name:string):name is GodsBloodPhysicalScenario{return (godsBloodPhysicalScenarios as readonly string[]).includes(name);}
/** Initial characters, training, hand and next deck card only; all OPEN and later ownership changes are commands. */
export function makeGodsBloodPhysicalScenario(name:GodsBloodPhysicalScenario,players:{id:string;name:string}[]){
 const s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];for(const [i,p] of players.entries())assignCharacter(s,p.id,['黒騎士ガーウィン','占星術師のアルセイル','大神官ジル','魔導王ガイナス'][i]!);
 const blood=takeCard(s,a,'a2-p01-r1c3'),keep=[takeCard(s,a,'a2-p03-r1c1'),takeCard(s,a,'a2-p24-r1c2'),takeCard(s,a,'a2-p18-r1c3'),takeCard(s,b,'a2-p04-r3c2'),takeCard(s,b,'a2-p24-r2c2'),takeCard(s,b,'a2-p02-r2c3')];s.players[a]!.hand=s.players[a]!.hand.filter(id=>id!==blood);for(const p of players)trimHand(s,p.id,...keep);
 s.deck=[blood,...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};if(p.id===a){p.permanent.warrior_level=20+(name==='blood-spirit'?0:2)-gameStats(s,a).warrior_level;p.permanent.magic_level=20+5-gameStats(s,a).magic_level;p.permanent.spirit=20+6-gameStats(s,a).spirit;}}
 if(name==='blood-death')s.players[a]!.damage=gameStats(s,a).endurance-4;
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const i=cursors[event.actorId]??0;cursors[event.actorId]=i+1;const cardInstanceId=s.players[event.actorId]!.hand[i];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
