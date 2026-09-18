import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const wingedFolkPhysicalScenarios=['winged-setup','winged-turn','winged-equal','winged-higher','winged-morale-fail','winged-waive','winged-earth','winged-earth-fail','winged-earth-waive','winged-earth-rear','winged-earth-ignore','winged-army','winged-ded-hand','winged-ded-field','winged-grant-hand','winged-grant-field'] as const;
export type WingedFolkPhysicalScenario=typeof wingedFolkPhysicalScenarios[number];
export function isWingedFolkPhysicalScenario(name:string):name is WingedFolkPhysicalScenario{return (wingedFolkPhysicalScenarios as readonly string[]).includes(name);}
export function wingedFolkPhysicalMode(name:WingedFolkPhysicalScenario){const defense=!name.includes('-ded-')&&!name.includes('-grant-')&&!name.endsWith('-army');return{card:'a2-p21-r1c3',name:'有翼族',level:5,hp:0,attributes:['人','空','翼'],defense,army:name.endsWith('-army'),dedicated:name.includes('-ded-'),grant:name.includes('-grant-'),earth:name.includes('-earth'),rear:name.endsWith('-rear'),ignore:name.endsWith('-ignore'),fail:name.endsWith('-fail'),waive:name.endsWith('-waive'),attackLevel:name.endsWith('-equal')?5:name.endsWith('-higher')||name==='winged-waive'?6:4,initial:defense&&!name.endsWith('-turn')||name.endsWith('-field')};}
/** Only initial characters/training/deals are scripted; placement and effects use actual commands. */
export function makeWingedFolkPhysicalScenario(name:WingedFolkPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;magic?:number;owner?:string;spirit?:number;defender?:string}={}){
 const m=wingedFolkPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??(m.ignore||m.army?'竜皇子アスフェルト':m.grant?'魔聖母ディア':'有翼人のティア'),options.defender??(options.dwarf||m.defense&&!m.earth?'魔聖母ディア':m.ignore?'有翼人のティア':m.earth?'小人のランバ':'白魔術師シェリム'),'凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 if(options.level!==undefined||m.defense&&!m.earth)s.players[b]!.permanent!.warrior_level=20+(options.level??m.attackLevel)-gameStats(s,b).warrior_level;
 if(options.magic!==undefined)s.players[a]!.permanent!.magic_level=20+options.magic-gameStats(s,a).magic_level;
 if(options.spirit!==undefined||m.fail||m.waive)s.players[a]!.permanent!.spirit=s.players[a]!.permanent!.spirit!+(options.spirit??0)-gameStats(s,a).spirit;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,m.earth?'a2-p16-r2c3':'a2-p24-r1c2'),takeCard(s,b,'a2-p24-r2c1'),takeCard(s,b,'a2-p21-r2c3'),takeCard(s,b,'a2-p11-r1c3'),takeCard(s,b,'a2-p07-r1c2'),takeCard(s,d,'a2-p02-r2c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
