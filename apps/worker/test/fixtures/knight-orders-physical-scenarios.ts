import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const knightOrdersPhysicalScenarios=['black-knights-setup','black-knights-turn','holy-knights-setup','holy-knights-turn','black-knights-army','holy-knights-army','black-knights-ded-hand','black-knights-ded-field','holy-knights-ded-hand','holy-knights-ded-field','black-knights-sword','holy-knights-inherited'] as const;
export type KnightOrdersPhysicalScenario=typeof knightOrdersPhysicalScenarios[number];
export function isKnightOrdersPhysicalScenario(name:string):name is KnightOrdersPhysicalScenario{return (knightOrdersPhysicalScenarios as readonly string[]).includes(name);}
export function knightOrdersPhysicalMode(name:KnightOrdersPhysicalScenario){const black=name.startsWith('black'),inherited=name.endsWith('inherited'),sword=name.endsWith('sword');return{card:black?'a2-p20-r1c2':'a2-p20-r1c3',name:black?'黒騎士団':'聖騎士団',black,inherited,sword,level:4,hp:5,attributes:['人','騎'],attackLevel:4,attackDamage:black?5:4,attackAttributes:black?['近','戦','剣']:['近','戦','剣','白'],owner:black?'黒騎士ガーウィン':inherited?'聖騎士ランスロット2':'聖騎士ランスロット',dedicated:name.includes('-ded-')||sword||inherited,army:name.endsWith('army'),initial:name.endsWith('setup')||name.endsWith('field')||inherited};}
/** Characters/training/deals are initial preconditions; every placement/action is a real later command. */
export function makeKnightOrdersPhysicalScenario(name:KnightOrdersPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;warrior?:number;owner?:string}={}){
 const m=knightOrdersPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??m.owner,options.dwarf?'魔聖母ディア':m.black?'白魔術師シェリム':'魔導王ガイナス','凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 if(options.level!==undefined)s.players[b]!.permanent!.warrior_level=20+options.level-gameStats(s,b).warrior_level;
 if(options.warrior!==undefined)s.players[a]!.permanent!.warrior_level=20+options.warrior-gameStats(s,a).warrior_level;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':m.sword?'a2-p05-r2c3':'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,'a2-p24-r1c2'),takeCard(s,b,'a2-p24-r2c1'),takeCard(s,b,'a2-p21-r2c3'),takeCard(s,b,'a2-p11-r1c3'),takeCard(s,d,'a2-p02-r2c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
