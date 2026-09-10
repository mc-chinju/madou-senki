import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const singingShipPhysicalScenarios=['ship-setup','ship-turn','ship-earth','ship-earth-rear','ship-earth-ignore','ship-army','ship-ded-hand','ship-ded-field'] as const;
export type SingingShipPhysicalScenario=typeof singingShipPhysicalScenarios[number];
export function isSingingShipPhysicalScenario(name:string):name is SingingShipPhysicalScenario{return (singingShipPhysicalScenarios as readonly string[]).includes(name);}
export function singingShipPhysicalMode(name:SingingShipPhysicalScenario){return{card:'a2-p20-r2c1',name:'歌う船',level:4,hp:2,attributes:['船','空'],army:name==='ship-army',dedicated:name.includes('ded-'),initial:name!=='ship-turn'&&name!=='ship-army'&&name!=='ship-ded-hand',earth:name.includes('earth'),rear:name.endsWith('rear'),ignore:name.endsWith('ignore')};}
/** Only initial characters/training/deals are scripted; placement and effects use actual commands. */
export function makeSingingShipPhysicalScenario(name:SingingShipPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;magic?:number;owner?:string}={}){
 const m=singingShipPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??'竜皇子アスフェルト',options.dwarf?'魔聖母ディア':m.ignore?'有翼人のティア':m.earth?'小人のランバ':'白魔術師シェリム','凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 if(options.level!==undefined)s.players[b]!.permanent!.warrior_level=20+options.level-gameStats(s,b).warrior_level;
 if(options.magic!==undefined)s.players[a]!.permanent!.magic_level=20+options.magic-gameStats(s,a).magic_level;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,m.earth?'a2-p16-r2c3':'a2-p24-r1c2'),takeCard(s,b,'a2-p24-r2c1'),takeCard(s,b,'a2-p21-r2c3'),takeCard(s,b,'a2-p11-r1c3'),takeCard(s,b,'a2-p07-r1c2'),takeCard(s,d,'a2-p02-r2c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
