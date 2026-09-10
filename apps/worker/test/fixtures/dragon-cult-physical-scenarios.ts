import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const dragonCultPhysicalScenarios=['cult-setup','cult-turn','cult-equal','cult-higher','cult-morale-fail','cult-waive','cult-white-lower','cult-white-equal','cult-white-higher','cult-white-waive','cult-army','cult-ded-hand','cult-ded-field','cult-grant-hand','cult-grant-field'] as const;
export type DragonCultPhysicalScenario=typeof dragonCultPhysicalScenarios[number];
export function isDragonCultPhysicalScenario(name:string):name is DragonCultPhysicalScenario{return (dragonCultPhysicalScenarios as readonly string[]).includes(name);}
export function dragonCultPhysicalMode(name:DragonCultPhysicalScenario){const defense=!name.includes('-ded-')&&!name.includes('-grant-')&&!name.endsWith('-army'),white=name.includes('-white');return{card:'a2-p21-r3c1',name:'竜王教団',level:5,hp:0,attributes:['人','僧'],defense,army:name.endsWith('-army'),dedicated:name.includes('-ded-'),grant:name.includes('-grant-'),white,whiteLevel:name.endsWith('-lower')?6:name.endsWith('-higher')?8:7,fail:name.endsWith('-fail'),waive:name.endsWith('-waive'),attackLevel:name.endsWith('-equal')?5:name.endsWith('-higher')||name.endsWith('-fail')||name==='cult-waive'?6:4,initial:defense&&!name.endsWith('-turn')||name.endsWith('-field')};}
/** Only initial characters/training/deals are scripted; placement and effects use actual commands. */
export function makeDragonCultPhysicalScenario(name:DragonCultPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;magic?:number;owner?:string;spirit?:number;defender?:string;metal?:boolean;blessing?:boolean}={}){
 const m=dragonCultPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??(m.army?'竜皇子アスフェルト':m.grant?'魔聖母ディア':'邪祭ウーノス'),options.defender??(m.defense&&!m.white?'魔聖母ディア':'白魔術師シェリム'),'凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 if(options.level!==undefined||m.defense&&!m.white)s.players[b]!.permanent!.warrior_level=20+(options.level??m.attackLevel)-gameStats(s,b).warrior_level;
 if(options.magic!==undefined)s.players[a]!.permanent!.magic_level=20+options.magic-gameStats(s,a).magic_level;
 if(options.spirit!==undefined||m.fail||m.waive)s.players[a]!.permanent!.spirit=s.players[a]!.permanent!.spirit!+(options.spirit??0)-gameStats(s,a).spirit;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,options.metal?b:a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,m.white?'a2-p14-r1c3':'a2-p24-r1c2'),takeCard(s,b,m.white?'a2-p05-r2c3':'a2-p24-r2c1'),takeCard(s,b,'a2-p21-r2c3'),takeCard(s,b,'a2-p11-r1c3'),takeCard(s,b,'a2-p07-r1c2'),takeCard(s,d,'a2-p02-r2c3')];
 let blessing:string|undefined;if(options.blessing){blessing=takeCard(s,a,'祝福');s.players[a]!.hand=s.players[a]!.hand.filter(id=>id!==blessing);s.deck.push(blessing);}
 for(const p of players)trimHand(s,p.id,...keep);if(options.metal)trimHand(s,b,...keep.filter(id=>id!=='a2-p24-r1c2'));s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];if(blessing)s.deck=[blessing,...s.deck.filter(id=>id!==blessing)];
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
