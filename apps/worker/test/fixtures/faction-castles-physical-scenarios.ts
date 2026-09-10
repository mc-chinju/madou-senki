import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const factionCastlesPhysicalScenarios=['alkemia-setup','alkemia-turn','gainas-setup','gainas-turn','alkemia-convert','gainas-convert','gainas-dedicated'] as const;
export type FactionCastlesPhysicalScenario=typeof factionCastlesPhysicalScenarios[number];
export function isFactionCastlesPhysicalScenario(name:string):name is FactionCastlesPhysicalScenario{return (factionCastlesPhysicalScenarios as readonly string[]).includes(name);}
export function factionCastlesPhysicalMode(name:FactionCastlesPhysicalScenario){const good=name.startsWith('alkemia');return{card:good?'a2-p20-r3c2':'a2-p20-r3c3',name:good?'アルケミア城':'ガイナス城',good,faction:good?'GOOD':'EVIL',owner:good?'有翼人のティア':'占星術師のアルセイル',level:5,hp:5,attributes:['建','城'],convert:name.endsWith('convert'),conversion:good?'a2-p04-r1c2':'a2-p04-r1c1',dedicated:name.endsWith('dedicated'),initial:!name.endsWith('turn')};}
/** Only initial character/deal/stat preconditions; placement and faction changes use commands. */
export function makeFactionCastlesPhysicalScenario(name:FactionCastlesPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;owner?:string;spirit?:number}={}){
 const m=factionCastlesPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??m.owner,options.owner==='魔聖母ディア'?'魔導王ガイナス':m.convert&&m.good?'聖騎士ランスロット':'魔聖母ディア','凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 if(options.level!==undefined||m.dedicated)s.players[b]!.permanent!.warrior_level=20+(options.level??6)-gameStats(s,b).warrior_level;
 if(options.spirit!==undefined||m.convert)s.players[a]!.permanent!.spirit=s.players[a]!.permanent!.spirit!+(options.spirit??0)-gameStats(s,a).spirit;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,'a2-p23-r1c1'),takeCard(s,a,'a2-p05-r2c2'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,'a2-p24-r1c2'),takeCard(s,b,'a2-p24-r2c1'),takeCard(s,b,'a2-p21-r2c3'),takeCard(s,b,m.conversion),takeCard(s,d,'a2-p02-r2c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
