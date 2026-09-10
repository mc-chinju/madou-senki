import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const royalKnightsPhysicalScenarios=['royal-knights-setup','royal-knights-turn','royal-knights-equal','royal-knights-higher','royal-knights-fail','royal-knights-waive','royal-knights-counterban','royal-knights-ignore','royal-knights-army','royal-knights-ded-hand','royal-knights-ded-field','royal-knights-grant-hand','royal-knights-grant-field'] as const;
export type RoyalKnightsPhysicalScenario=typeof royalKnightsPhysicalScenarios[number];
export function isRoyalKnightsPhysicalScenario(name:string):name is RoyalKnightsPhysicalScenario{return (royalKnightsPhysicalScenarios as readonly string[]).includes(name);}
export function royalKnightsPhysicalMode(name:RoyalKnightsPhysicalScenario){const defense=!name.includes('-ded-')&&!name.includes('-grant-')&&!name.endsWith('-army');return{card:'a2-p21-r1c2',name:'王立騎士団',level:5,hp:0,attributes:['人','騎'],defense,army:name.endsWith('-army'),dedicated:name.includes('-ded-'),grant:name.includes('-grant-'),fail:name.endsWith('-fail'),waive:name.endsWith('-waive'),counterban:name.endsWith('-counterban'),ignore:name.endsWith('-ignore'),attackLevel:name.endsWith('-equal')?5:name.endsWith('-higher')?6:4,initial:defense&&!name.endsWith('-turn')||name.endsWith('-field')};}
/** Only initial characters/training/deals are scripted; placement and effects use actual commands. */
export function makeRoyalKnightsPhysicalScenario(name:RoyalKnightsPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;warrior?:number;spirit?:number;owner?:string}={}){
 const m=royalKnightsPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??(m.grant?'魔聖母ディア':m.army?'竜皇子アスフェルト':'リーア姫'),m.counterban||m.ignore?'不死王ガドューラ':m.defense?'魔聖母ディア':'白魔術師シェリム','凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 if(options.level!==undefined||m.defense)s.players[b]!.permanent!.warrior_level=20+(options.level??m.attackLevel)-gameStats(s,b).warrior_level;
 if(options.warrior!==undefined)s.players[a]!.permanent!.warrior_level=20+options.warrior-gameStats(s,a).warrior_level;
 if(options.spirit!==undefined||m.fail||m.waive)s.players[a]!.permanent!.spirit=s.players[a]!.permanent!.spirit!+(options.spirit??0)-gameStats(s,a).spirit;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,'a2-p24-r1c2'),takeCard(s,b,'a2-p24-r2c1'),takeCard(s,b,m.counterban?'a2-p19-r2c1':m.ignore?'a2-p21-r1c1':'a2-p21-r2c3'),takeCard(s,b,'a2-p07-r1c2'),takeCard(s,b,'a2-p11-r1c3'),takeCard(s,d,'a2-p02-r2c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
