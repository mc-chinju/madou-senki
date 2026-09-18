import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const openBlessingPhysicalScenarios=['open-blessing-placement','open-blessing-defense','open-blessing-morale','open-blessing-transfer','open-blessing-irremovable','open-blessing-army','open-blessing-death'] as const;
export type OpenBlessingPhysicalScenario=typeof openBlessingPhysicalScenarios[number];
export function isOpenBlessingPhysicalScenario(name:string):name is OpenBlessingPhysicalScenario{return (openBlessingPhysicalScenarios as readonly string[]).includes(name);}
export function openBlessingMode(name:OpenBlessingPhysicalScenario){const defense=name.endsWith('-defense')||name.endsWith('-morale'),irremovable=name.endsWith('-irremovable');return{defense,irremovable,initial:defense?['a2-p20-r3c1']:['a2-p18-r3c3','a2-p20-r2c3'],third:irremovable?'a2-p21-r2c1':'a2-p20-r3c1'};}
/** Only initial deal, training, prior damage and draw order; effects and placement use commands. */
export function makeOpenBlessingPhysicalScenario(name:OpenBlessingPhysicalScenario,players:{id:string;name:string}[],otherFollower=false){
 const m=openBlessingMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];for(const [i,p] of players.entries())assignCharacter(s,p.id,['黒騎士ガーウィン','魔聖母ディア','大神官ジル','侍大将のシン'][i]!);
 const blessing=takeCard(s,a,'a2-p01-r2c1'),keep=['a2-p18-r3c3','a2-p20-r2c3','a2-p20-r3c1','a2-p21-r2c1','a2-p05-r2c2'].map(id=>takeCard(s,a,id));keep.push(...['a2-p21-r2c3','a2-p04-r3c2','a2-p15-r2c2'].map(id=>takeCard(s,b,id)));if(otherFollower)keep.push(takeCard(s,c,'a2-p22-r2c3'));s.players[a]!.hand=s.players[a]!.hand.filter(id=>id!==blessing);for(const p of players)trimHand(s,p.id,...keep);
 const ordinary=s.deck.filter(id=>getAction(id)!.category!=='open'),prefix=ordinary.slice(0,m.initial.length+(otherFollower?1:0));s.deck=[...prefix,blessing,...ordinary.slice(m.initial.length+(otherFollower?1:0)),...s.deck.filter(id=>getAction(id)!.category==='open')];
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+(p.id===a&&name==='open-blessing-morale'?0:6)-gameStats(s,p.id).spirit;}s.players[b]!.permanent!.warrior_level=20+6-gameStats(s,b).warrior_level;
 if(name==='open-blessing-death')s.players[a]!.damage=gameStats(s,a).endurance-2;
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const i=cursors[event.actorId]??0;cursors[event.actorId]=i+1;const cardInstanceId=s.players[event.actorId]!.hand[i];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
