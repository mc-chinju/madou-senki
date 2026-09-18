import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const flameDragonPhysicalScenarios=['flame-dragon-setup','flame-dragon-turn','flame-dragon-equal','flame-dragon-higher','flame-dragon-morale-fail','flame-dragon-fire-low','flame-dragon-fire-equal','flame-dragon-fire-high','flame-dragon-fire-fail','flame-dragon-sky','flame-dragon-destroy','flame-dragon-army','flame-dragon-grant-hand','flame-dragon-grant-field'] as const;
export type FlameDragonPhysicalScenario=typeof flameDragonPhysicalScenarios[number];
export function isFlameDragonPhysicalScenario(name:string):name is FlameDragonPhysicalScenario{return (flameDragonPhysicalScenarios as readonly string[]).includes(name);}
export function flameDragonPhysicalMode(name:FlameDragonPhysicalScenario){const army=name.endsWith('-army'),grant=name.includes('-grant-'),sky=name.endsWith('-sky'),destroy=name.endsWith('-destroy'),fire=name.includes('-fire-'),low=name.endsWith('-low')||name.endsWith('-fire-fail'),high=name.endsWith('-high'),defense=!army&&!grant;return{card:'a2-p22-r2c2',name:'炎竜',level:6,hp:7,attributes:['竜','獣','炎','空'],defense,army,grant,sky,destroy,fire,low,high,fail:name.endsWith('-fail'),attackLevel:name.endsWith('-equal')?6:name.endsWith('-higher')?7:5,initial:defense&&!name.endsWith('-turn')||name.endsWith('-field')};}
/** Only initial characters/training/deals are scripted; placement and effects use actual commands. */
export function makeFlameDragonPhysicalScenario(name:FlameDragonPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;warrior?:number;magic?:number;spirit?:number;owner?:string}={}){
 const m=flameDragonPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??(m.grant?'獣使いのウパニシャット':'竜皇子アスフェルト'),m.sky?'有翼人のティア':m.destroy?'占星術師のアルセイル':m.fire&&!m.low?'爆炎のフレイアード':m.defense?'魔聖母ディア':'黒騎士ガーウィン','凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 if(options.level!==undefined||m.defense)s.players[b]!.permanent!.warrior_level=20+(options.level??m.attackLevel)-gameStats(s,b).warrior_level;
 if(options.warrior!==undefined)s.players[a]!.permanent!.warrior_level=20+options.warrior-gameStats(s,a).warrior_level;
 if(options.magic!==undefined)s.players[a]!.permanent!.magic_level=20+options.magic-gameStats(s,a).magic_level;
 if(options.spirit!==undefined||m.fail)s.players[a]!.permanent!.spirit=s.players[a]!.permanent!.spirit!+(options.spirit??0)-gameStats(s,a).spirit;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,'a2-p24-r1c2'),takeCard(s,b,m.high?'a2-p05-r2c3':'a2-p24-r2c1'),takeCard(s,b,m.sky?'a2-p15-r1c3':m.destroy?'a2-p13-r1c2':m.fire?'a2-p16-r1c2':'a2-p21-r2c3'),takeCard(s,b,'a2-p07-r1c2'),takeCard(s,b,'a2-p11-r1c3'),takeCard(s,d,'a2-p02-r2c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
