import {getAction} from '@madou/catalog';
import {createGame,gameStats} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand} from './scenario-tools.js';
export const dwarfPhysicalScenarios=['dwarf-setup','dwarf-turn','dwarf-equal','dwarf-higher','dwarf-fail','dwarf-waive','dwarf-army','dwarf-ded-hand','dwarf-ded-field','dwarf-grant-hand','dwarf-grant-field'] as const;
export type DwarfPhysicalScenario=typeof dwarfPhysicalScenarios[number];
export function isDwarfPhysicalScenario(name:string):name is DwarfPhysicalScenario{return (dwarfPhysicalScenarios as readonly string[]).includes(name);}
export function dwarfPhysicalMode(name:DwarfPhysicalScenario){const defense=!name.includes('-ded-')&&!name.includes('-grant-')&&!name.endsWith('-army');return{card:'a2-p21-r2c3',name:'小人族',level:5,hp:6,attributes:['人','小','地'],defense,army:name.endsWith('-army'),dedicated:name.includes('-ded-'),grant:name.includes('-grant-'),fail:name.endsWith('-fail'),waive:name.endsWith('-waive'),boost:name.endsWith('-higher')||name.endsWith('-fail')||name.endsWith('-waive'),bow:name.endsWith('-setup')||name.endsWith('-turn'),initial:defense&&!name.endsWith('-turn')||name.endsWith('-field')};}
/** Script only initial deals and training; all placement, boosts and later stat changes use commands. */
export function makeDwarfPhysicalScenario(name:DwarfPhysicalScenario,players:{id:string;name:string}[],options:{warrior?:number;spirit?:number;owner?:string;blood?:boolean;prayer?:boolean}={}){
 const m=dwarfPhysicalMode(name),s=createGame(players,entropy(),{startingSeat:0}),[a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[options.owner??(m.grant?'魔聖母ディア':m.army?'竜皇子アスフェルト':'小人のランバ'),m.defense?'獣使いのウパニシャット':'白魔術師シェリム','凍気のアイエル','侍大将のシン'][i]!);
 const keep=[takeCard(s,a,m.card),takeCard(s,a,'a2-p24-r1c3'),takeCard(s,a,'a2-p22-r1c1'),takeCard(s,a,m.army?'a2-p05-r2c2':options.blood?'a2-p02-r1c1':options.prayer?'a2-p05-r2c3':'a2-p23-r1c1'),takeCard(s,a,'a2-p07-r1c1'),takeCard(s,b,'a2-p24-r1c2'),takeCard(s,b,'a2-p20-r3c1'),takeCard(s,b,m.defense?'a2-p05-r2c3':'a2-p20-r1c2'),takeCard(s,b,'a2-p07-r1c2'),takeCard(s,b,'a2-p11-r1c3'),takeCard(s,d,'a2-p02-r2c3')];
 if(options.blood){takeCard(s,a,'a2-p01-r1c3');s.players[a]!.hand=s.players[a]!.hand.filter(id=>id!=='a2-p01-r1c3');s.deck.push('a2-p01-r1c3');}
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];if(options.blood)s.deck=['a2-p01-r1c3',...s.deck.filter(id=>id!=='a2-p01-r1c3')];
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit=20+14-gameStats(s,p.id).spirit;}
 s.players[a]!.permanent!.warrior_level=20+(options.warrior??5)-gameStats(s,a).warrior_level;
 if(options.spirit!==undefined||m.fail||m.waive)s.players[a]!.permanent!.spirit=s.players[a]!.permanent!.spirit!+(options.spirit??0)-gameStats(s,a).spirit;
 const cursors:Record<string,number>={};s.events=s.events.flatMap(event=>{if(event.type==='CHARACTER_ASSIGNED')return[{...event,characterId:s.players[event.actorId]!.characterId}];if(event.type!=='CARD_DRAWN')return[event];const index=cursors[event.actorId]??0;cursors[event.actorId]=index+1;const cardInstanceId=s.players[event.actorId]!.hand[index];return cardInstanceId?[{...event,cardInstanceId}]:[];});return s;
}
