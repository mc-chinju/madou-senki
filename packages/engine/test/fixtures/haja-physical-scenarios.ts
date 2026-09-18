import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const hajaPhysicalScenarios=['haja-draw','haja-book','haja-chants','haja-transfer','haja-return','haja-death'] as const;
export type HajaPhysicalScenario=typeof hajaPhysicalScenarios[number];
export function isHajaPhysicalScenario(name:string):name is HajaPhysicalScenario{return (hajaPhysicalScenarios as readonly string[]).includes(name);}
/** Initial characters, hand, prior damage and deck order; every chant/ownership change is a command. */
export function makeHajaPhysicalScenario(name:HajaPhysicalScenario,players:{id:string;name:string}[],drawOpen=true){
 const s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];for(const [i,p] of players.entries())assignCharacter(s,p.id,['黒騎士ガーウィン','占星術師のアルセイル','大神官ジル','魔導王ガイナス'][i]!);
 const haja=takeCard(s,a,'a2-p01-r2c2'),keep=['a2-p13-r1c1','a2-p14-r2c2','a2-p13-r2c3','a2-p03-r1c1','a2-p04-r3c3'].map(id=>takeCard(s,a,id));keep.push(...['a2-p04-r3c2','a2-p24-r2c2','a2-p02-r2c3'].map(id=>takeCard(s,b,id)));s.players[a]!.hand=s.players[a]!.hand.filter(id=>id!==haja);for(const p of players)trimHand(s,p.id,...keep);
 const ordinary=s.deck.filter(id=>getAction(id)!.category!=='open'),open=s.deck.filter(id=>getAction(id)!.category==='open');s.deck=drawOpen?[haja,...ordinary,...open]:[...ordinary,...open,haja];for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};if(name==='haja-death')s.players[a]!.damage=gameStats(s,a).endurance-4;
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const i=cursors[event.actorId]??0;cursors[event.actorId]=i+1;const cardInstanceId=s.players[event.actorId]!.hand[i];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
