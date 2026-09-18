import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const waterDragonPhysicalScenarios=['water-dragon-setup', 'water-dragon-turn', 'water-dragon-equal', 'water-dragon-higher', 'water-dragon-morale-fail', 'water-dragon-sky', 'water-dragon-destroy', 'water-dragon-army', 'water-dragon-grant-hand', 'water-dragon-grant-field', 'water-dragon-army-block', 'water-dragon-army-hp', 'water-dragon-army-maai', 'water-dragon-army-mirror', 'water-dragon-army-skip', 'water-dragon-army-dead', 'water-dragon-army-wander', 'water-dragon-army-overlap'] as const;
export type WaterDragonPhysicalScenario=typeof waterDragonPhysicalScenarios[number];
export function isWaterDragonPhysicalScenario(name:string):name is WaterDragonPhysicalScenario{return (waterDragonPhysicalScenarios as readonly string[]).includes(name);}
export function waterDragonPhysicalMode(name:WaterDragonPhysicalScenario){const army=name.includes('-army'),grant=name.includes('-grant-'),sky=name.endsWith('-sky'),destroy=name.endsWith('-destroy'),defense=!army&&!grant,block=name.endsWith('-block'),hp=name.endsWith('-hp'),dead=name.endsWith('-dead'),wander=name.endsWith('-wander'),skip=name.endsWith('-skip'),overlap=name.endsWith('-overlap'),mirror=name.endsWith('-mirror')||dead,maai=name.endsWith('-maai')||skip;
 const pair=block?['a2-p22-r3c3']:hp?['a2-p20-r2c3','a2-p20-r3c1']:undefined;
 return{pair,block,hp,dead,wander,skip,overlap,mirror,maai,card:'a2-p23-r1c1',name:'水竜',level:7,hpValue:4,attributes:['竜','獣','水','空'],defense,army,grant,sky,destroy,fail:name.endsWith('-fail'),attackLevel:name.endsWith('-equal')?7:name.endsWith('-higher')?8:6,initial:defense&&!name.endsWith('-turn')||name.endsWith('-field')};}
/** Only initial characters/training/deals are scripted; placement and effects use actual commands. */
export function makeWaterDragonPhysicalScenario(name:WaterDragonPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;warrior?:number;magic?:number;spirit?:number;owner?:string;pair?:string[]}={}){
 const m=waterDragonPhysicalMode(name),pair=options.pair??m.pair,s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??(m.grant?'獣使いのウパニシャット':m.overlap?'白魔術師シェリム':'竜皇子アスフェルト'),m.sky?'有翼人のティア':m.destroy?'占星術師のアルセイル':m.skip?'魔導王ガイナス':m.wander?'侍大将のシン':m.defense?'魔聖母ディア':'黒騎士ガーウィン',m.wander?'魔導王ガイナス':m.dead?'魔聖母ディア':'凍気のアイエル',m.wander?'魔聖母ディア':'侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 if(options.level!==undefined||m.defense)s.players[b]!.permanent!.warrior_level=20+(options.level??m.attackLevel)-gameStats(s,b).warrior_level;
 if(options.warrior!==undefined)s.players[a]!.permanent!.warrior_level=20+options.warrior-gameStats(s,a).warrior_level;
 if(options.magic!==undefined)s.players[a]!.permanent!.magic_level=20+options.magic-gameStats(s,a).magic_level;
 if(options.spirit!==undefined||m.fail)s.players[a]!.permanent!.spirit=s.players[a]!.permanent!.spirit!+(options.spirit??0)-gameStats(s,a).spirit;
 if(m.dead)s.players[a]!.damage=gameStats(s,a).endurance-5;
 if(m.wander)s.players[c]!.damage=gameStats(s,c).endurance-5;
 if(m.overlap)s.players[c]!.permanent!.spirit=s.players[c]!.permanent!.spirit!-gameStats(s,c).spirit;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':'a2-p22-r3c3'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,pair?.[0]??'a2-p24-r1c2'),takeCard(s,b,pair?.[1]??'a2-p24-r2c1'),takeCard(s,b,m.sky?'a2-p15-r1c3':m.destroy?'a2-p13-r1c2':m.skip?'a2-p09-r2c2':m.overlap?'a2-p15-r2c2':'a2-p21-r2c3'),takeCard(s,b,'a2-p07-r1c2'),takeCard(s,b,'a2-p11-r1c3'),takeCard(s,d,'a2-p02-r2c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
