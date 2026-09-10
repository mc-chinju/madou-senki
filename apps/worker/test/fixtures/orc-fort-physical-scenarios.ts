import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const orcFortPhysicalScenarios=['orc-setup','orc-turn','fort-setup','fort-turn','orc-grant-hand','orc-grant-field'] as const;
export type OrcFortPhysicalScenario=typeof orcFortPhysicalScenarios[number];
export function isOrcFortPhysicalScenario(name:string):name is OrcFortPhysicalScenario{return (orcFortPhysicalScenarios as readonly string[]).includes(name);}
export function orcFortPhysicalMode(name:OrcFortPhysicalScenario){const orc=name.startsWith('orc');return{card:orc?'a2-p19-r1c2':'a2-p19-r1c3',name:orc?'オーク':'砦',level:3,hp:orc?0:2,attributes:orc?['怪','人']:['建'],grant:name.includes('-grant-'),initial:name.endsWith('-setup')||name.endsWith('-field')};}
/** Every scenario starts in real initial placement; tests issue all placement and turn commands. */
export function makeOrcFortPhysicalScenario(name:OrcFortPhysicalScenario,players:{id:string;name:string}[],options:{dwarf?:boolean;level?:number;owner?:string}={}){
 const m=orcFortPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.dwarf?'魔導王ガイナス':options.owner??'魔聖母ディア',options.dwarf?'魔聖母ディア':'白魔術師シェリム','凍気のアイエル','侍大将のシン'][i]!);for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}if(options.level!==undefined)s.players[b]!.permanent!.warrior_level=20+options.level-gameStats(s,b).warrior_level;
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,'a2-p24-r1c2'),takeCard(s,b,'a2-p24-r2c1'),takeCard(s,b,'a2-p21-r2c3'),takeCard(s,d,'a2-p02-r2c3')];for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];return s;
}
