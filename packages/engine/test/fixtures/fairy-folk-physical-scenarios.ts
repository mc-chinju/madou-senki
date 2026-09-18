import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const fairyFolkPhysicalScenarios=['fairy-setup','fairy-turn','fairy-equal','fairy-higher','fairy-morale-fail','fairy-fury-fail','fairy-magic-lower','fairy-magic-equal','fairy-magic-higher','fairy-magic-fail','fairy-army','fairy-ded-hand','fairy-ded-field','fairy-grant-hand','fairy-grant-field'] as const;
export type FairyFolkPhysicalScenario=typeof fairyFolkPhysicalScenarios[number];
export function isFairyFolkPhysicalScenario(name:string):name is FairyFolkPhysicalScenario{return (fairyFolkPhysicalScenarios as readonly string[]).includes(name);}
export function fairyFolkPhysicalMode(name:FairyFolkPhysicalScenario){const defense=!name.includes('-ded-')&&!name.includes('-grant-')&&!name.endsWith('-army'),magic=name.includes('-magic');return{card:'a2-p21-r3c3',name:'妖精族',level:5,hp:0,attributes:['人','白'],defense,army:name.endsWith('-army'),dedicated:name.includes('-ded-'),grant:name.includes('-grant-'),magic,magicLevel:name.endsWith('-higher')?7:name.endsWith('-equal')?6:5,fail:name.endsWith('-fail'),attackLevel:name.endsWith('-equal')?5:name.endsWith('-higher')?6:4,initial:defense&&!name.endsWith('-turn')||name.endsWith('-field')};}
/** Only initial characters/training/deals are scripted; placement and effects use actual commands. */
export function makeFairyFolkPhysicalScenario(name:FairyFolkPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;magic?:number;owner?:string;spirit?:number;defender?:string;warrior?:number;royal?:boolean;earth?:boolean}={}){
 const m=fairyFolkPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??(m.army?'竜皇子アスフェルト':m.grant?'魔聖母ディア':'妖精王フューリー'),options.defender??(m.defense&&!m.magic?'魔聖母ディア':'白魔術師シェリム'),'凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 if(options.level!==undefined||m.defense&&!m.magic)s.players[b]!.permanent!.warrior_level=20+(options.level??m.attackLevel)-gameStats(s,b).warrior_level;
 if(options.magic!==undefined)s.players[a]!.permanent!.magic_level=20+options.magic-gameStats(s,a).magic_level;
 if(options.spirit!==undefined||m.fail)s.players[a]!.permanent!.spirit=s.players[a]!.permanent!.spirit!+(options.spirit??0)-gameStats(s,a).spirit;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,m.magic?m.magicLevel===5?'a2-p14-r1c2':'a2-p14-r1c3':'a2-p24-r1c2'),takeCard(s,b,m.magic?'a2-p05-r2c3':'a2-p24-r2c1'),takeCard(s,b,options.royal?'a2-p21-r1c2':options.earth?'a2-p18-r1c3':'a2-p21-r2c3'),takeCard(s,b,'a2-p11-r1c3'),takeCard(s,b,'a2-p07-r1c2'),takeCard(s,d,'a2-p02-r2c3'),takeCard(s,c,'a2-p02-r1c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 if(options.warrior!==undefined)s.players[a]!.permanent!.warrior_level=20+options.warrior-gameStats(s,a).warrior_level;
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
