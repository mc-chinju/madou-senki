import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const skeletonPhysicalScenarios=['skeleton-defense-turn','skeleton-defense-equal','skeleton-defense-revive','skeleton-defense-mixed','skeleton-defense-destroy','skeleton-attack-hand','skeleton-attack-field','skeleton-army','skeleton-attack-maai'] as const;
export type SkeletonPhysicalScenario=typeof skeletonPhysicalScenarios[number];
export function isSkeletonPhysicalScenario(name:string):name is SkeletonPhysicalScenario{return (skeletonPhysicalScenarios as readonly string[]).includes(name);}
export function skeletonPhysicalMode(name:SkeletonPhysicalScenario){return{defense:name.includes('-defense-'),initial:name.includes('-defense-')&&!name.endsWith('-turn')||name.endsWith('-field'),army:name==='skeleton-army',mixed:name.endsWith('-mixed'),destroy:name.endsWith('-destroy'),maai:name.endsWith('-maai'),level:name.endsWith('-equal')?3:4};}
/** Characters, training and deals are initial preconditions. All placement and action commands occur in tests. */
export function makeSkeletonPhysicalScenario(name:SkeletonPhysicalScenario,players:{id:string;name:string}[],options:{level?:number;warrior?:number;owner?:string}={}){
 const m=skeletonPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??(m.defense?'白魔術師シェリム':'不死王ガドューラ'),m.defense?'魔聖母ディア':'白魔術師シェリム','凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 s.players[b]!.permanent!.warrior_level=20+(options.level??m.level)-gameStats(s,b).warrior_level;
 if(options.warrior!==undefined)s.players[a]!.permanent!.warrior_level=20+options.warrior-gameStats(s,a).warrior_level;
 const keep=[takeCard(s,a,'a2-p19-r2c1'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p05-r2c2'),
 ...[m.defense?'a2-p21-r2c3':'a2-p11-r1c3',m.defense?'a2-p21-r2c1':'a2-p07-r1c2',m.destroy?'a2-p12-r1c1':'a2-p20-r1c2','a2-p24-r2c1','a2-p24-r1c2'].map(id=>takeCard(s,b,id)),takeCard(s,d,'a2-p02-r2c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];return s;
}
