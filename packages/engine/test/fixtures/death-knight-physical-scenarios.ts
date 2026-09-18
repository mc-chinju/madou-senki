import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const deathKnightPhysicalScenarios=['death-knight-setup','death-knight-turn','death-knight-equal','death-knight-higher','death-knight-morale-fail','death-knight-waive','death-knight-white','death-knight-destroy','death-knight-army','death-knight-ded-hand','death-knight-ded-field'] as const;
export type DeathKnightPhysicalScenario=typeof deathKnightPhysicalScenarios[number];
export function isDeathKnightPhysicalScenario(name:string):name is DeathKnightPhysicalScenario{return (deathKnightPhysicalScenarios as readonly string[]).includes(name);}
export function deathKnightPhysicalMode(name:DeathKnightPhysicalScenario){const army=name.endsWith('-army'),dedicated=name.includes('-ded-'),white=name.endsWith('-white'),destroy=name.endsWith('-destroy'),waive=name.endsWith('-waive'),defense=!army&&!dedicated;return{card:'a2-p22-r3c2',name:'デス・ナイト',level:7,hp:0,attributes:['死','騎'],defense,army,dedicated,white,destroy,waive,fail:name.endsWith('-fail'),attackLevel:name.endsWith('-equal')||waive?7:name.endsWith('-higher')?8:6,initial:defense&&!name.endsWith('-turn')||name.endsWith('-field')};}
/** Only initial characters/training/deals are scripted; placement and effects use actual commands. */
export function makeDeathKnightPhysicalScenario(name:DeathKnightPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;warrior?:number;magic?:number;spirit?:number;owner?:string}={}){
 const m=deathKnightPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??(m.waive||!m.defense?'不死王ガドューラ':'竜皇子アスフェルト'),m.destroy?'占星術師のアルセイル':m.white?'白魔術師シェリム':m.defense?'魔聖母ディア':'黒騎士ガーウィン','凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 if(options.level!==undefined||m.defense)s.players[b]!.permanent!.warrior_level=20+(options.level??m.attackLevel)-gameStats(s,b).warrior_level;
 if(options.warrior!==undefined)s.players[a]!.permanent!.warrior_level=20+options.warrior-gameStats(s,a).warrior_level;
 if(options.magic!==undefined)s.players[a]!.permanent!.magic_level=20+options.magic-gameStats(s,a).magic_level;
 if(options.spirit!==undefined||m.fail||m.waive)s.players[a]!.permanent!.spirit=s.players[a]!.permanent!.spirit!+(options.spirit??0)-gameStats(s,a).spirit;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,m.defense?'a2-p24-r1c2':'a2-p07-r1c3'),takeCard(s,b,'a2-p24-r2c1'),takeCard(s,b,m.destroy?'a2-p13-r1c2':m.white?'a2-p14-r1c3':'a2-p21-r2c3'),takeCard(s,b,m.defense?'a2-p22-r1c3':'a2-p07-r1c2'),takeCard(s,b,'a2-p11-r1c3'),takeCard(s,d,'a2-p02-r2c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
