import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const zombiePhysicalScenarios=['zombie-defense-turn','zombie-defense-equal','zombie-defense-revive','zombie-defense-mixed','zombie-defense-destroy','zombie-attack-hand','zombie-attack-field','zombie-army','zombie-attack-maai'] as const;
export type ZombiePhysicalScenario=typeof zombiePhysicalScenarios[number];
export function isZombiePhysicalScenario(name:string):name is ZombiePhysicalScenario{return (zombiePhysicalScenarios as readonly string[]).includes(name);}
export function zombiePhysicalMode(name:ZombiePhysicalScenario){return{defense:name.includes('-defense-'),initial:name.includes('-defense-')&&!name.endsWith('-turn')||name.endsWith('-field'),army:name==='zombie-army',mixed:name.endsWith('-mixed'),destroy:name.endsWith('-destroy'),maai:name.endsWith('-maai'),level:name.endsWith('-equal')?4:5};}
/** Characters, training and deals are initial preconditions. All placement and action commands occur in tests. */
export function makeZombiePhysicalScenario(name:ZombiePhysicalScenario,players:{id:string;name:string}[],options:{level?:number;warrior?:number;owner?:string}={}){
 const m=zombiePhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??(m.defense?'白魔術師シェリム':'不死王ガドューラ'),m.defense?'魔聖母ディア':'白魔術師シェリム','凍気のアイエル','侍大将のシン'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 s.players[b]!.permanent!.warrior_level=20+(options.level??m.level)-gameStats(s,b).warrior_level;
 if(options.warrior!==undefined)s.players[a]!.permanent!.warrior_level=20+options.warrior-gameStats(s,a).warrior_level;
 const keep=[takeCard(s,a,'a2-p19-r3c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p05-r2c2'),
 ...[m.defense?'a2-p21-r2c3':'a2-p11-r1c3',m.defense?'a2-p22-r1c3':'a2-p07-r1c2',m.destroy?'a2-p12-r1c1':'a2-p21-r2c1','a2-p24-r2c1','a2-p24-r1c2'].map(id=>takeCard(s,b,id)),takeCard(s,d,'a2-p02-r2c3')];
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];// The scripted deal replaces createGame's random initial deal before any commands.
 // Keep the initial private log consistent with those preconditions.
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED'&&event.actorId)return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN'||!event.actorId)return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
