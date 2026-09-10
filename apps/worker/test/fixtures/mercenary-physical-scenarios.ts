import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const mercenaryPhysicalScenarios=['mercenary-setup','mercenary-turn','mercenary-grant-hand','mercenary-grant-field','mercenary-army'] as const;
export type MercenaryPhysicalScenario=typeof mercenaryPhysicalScenarios[number];
export function isMercenaryPhysicalScenario(name:string):name is MercenaryPhysicalScenario{return (mercenaryPhysicalScenarios as readonly string[]).includes(name);}
export function mercenaryPhysicalMode(name:MercenaryPhysicalScenario){return{card:'a2-p20-r1c1',name:'傭兵',level:4,hp:0,attributes:['人'],attackLevel:3,attackDamage:4,attackAttributes:['近','戦','剣'],grant:name.includes('-grant-'),army:name.endsWith('-army'),initial:name.endsWith('-setup')||name.endsWith('-field')};}
/** Every scenario starts in real initial placement; tests issue all placement and turn commands. */
export function makeMercenaryPhysicalScenario(name:MercenaryPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;owner?:string;warrior?:number}={}){
 const m=mercenaryPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.dwarf?'魔導王ガイナス':options.owner??'魔聖母ディア',options.dwarf?'魔聖母ディア':'白魔術師シェリム','凍気のアイエル','侍大将のシン'][i]!);for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}if(options.level!==undefined)s.players[b]!.permanent!.warrior_level=20+options.level-gameStats(s,b).warrior_level;
 if(options.warrior!==undefined)s.players[a]!.permanent!.warrior_level=20+options.warrior-gameStats(s,a).warrior_level;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,'a2-p24-r1c2'),takeCard(s,b,'a2-p24-r2c1'),takeCard(s,b,'a2-p21-r2c3'),takeCard(s,d,'a2-p02-r2c3')];for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];// The scripted deal replaces createGame's random initial deal before any commands.
 // Keep the initial private log consistent with those preconditions.
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED'&&event.actorId)return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN'||!event.actorId)return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
