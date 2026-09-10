import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const griffinPhysicalScenarios=['griffin-setup','griffin-turn','griffin-morale-pass','griffin-morale-fail','griffin-morale-waive','griffin-army','griffin-ded-hand','griffin-ded-field','griffin-ded-maai','griffin-grant-hand','griffin-grant-field'] as const;
export type GriffinPhysicalScenario=typeof griffinPhysicalScenarios[number];
export function isGriffinPhysicalScenario(name:string):name is GriffinPhysicalScenario{return (griffinPhysicalScenarios as readonly string[]).includes(name);}
export function griffinPhysicalMode(name:GriffinPhysicalScenario){return{card:'a2-p20-r3c1',name:'グリフォン',level:5,hp:3,attributes:['空','獣'],army:name==='griffin-army',dedicated:name.includes('-ded-'),grant:name.includes('-grant-'),morale:name.includes('-morale-'),fail:name.endsWith('-fail'),waive:name.endsWith('-waive'),maai:name.endsWith('-maai'),initial:name==='griffin-setup'||name.includes('-morale-')||name.endsWith('-field')};}
/** Only initial characters/training/deals are scripted; placement and effects use actual commands. */
export function makeGriffinPhysicalScenario(name:GriffinPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;warrior?:number;spirit?:number;owner?:string}={}){
 const m=griffinPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??(m.morale&&!m.waive||m.army?'竜皇子アスフェルト':'獣使いのウパニシャット'),options.dwarf||m.morale?'魔聖母ディア':'白魔術師シェリム','凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 if(options.level!==undefined||m.morale)s.players[b]!.permanent!.warrior_level=20+(options.level??6)-gameStats(s,b).warrior_level;
 if(options.warrior!==undefined)s.players[a]!.permanent!.warrior_level=20+options.warrior-gameStats(s,a).warrior_level;
 if(options.spirit!==undefined||m.fail||m.waive)s.players[a]!.permanent!.spirit=s.players[a]!.permanent!.spirit!+(options.spirit??0)-gameStats(s,a).spirit;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,'a2-p24-r1c2'),takeCard(s,b,'a2-p24-r2c1'),takeCard(s,b,'a2-p21-r2c3'),takeCard(s,b,'a2-p20-r1c2'),takeCard(s,b,m.maai?'a2-p07-r1c2':'a2-p11-r1c3'),takeCard(s,d,'a2-p02-r2c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
