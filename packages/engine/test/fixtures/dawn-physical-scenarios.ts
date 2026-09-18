import {getAction} from '@madou/catalog';
import {makeFusenPhysicalScenario} from './fusen-physical-scenarios.js';
import {makeR6OtherworldScenario} from './r6-otherworld-scenario.js';
import {takeCard,trimHand} from './scenario-tools.js';
export const dawnPhysicalScenarios=['dawn-deaths','dawn-return','dawn-empty'] as const;
export type DawnPhysicalScenario=typeof dawnPhysicalScenarios[number];
export function isDawnPhysicalScenario(name:string):name is DawnPhysicalScenario{return (dawnPhysicalScenarios as readonly string[]).includes(name);}
/** Existing actual death/rift/installation timelines; arrange only the next draw and source hand. */
export function makeDawnPhysicalScenario(name:DawnPhysicalScenario,players:{id:string;name:string}[]){
 const s=name==='dawn-return'?makeR6OtherworldScenario(players):makeFusenPhysicalScenario(name==='dawn-empty'?'fusen-empty':'fusen-book',players),source=players[name==='dawn-return'?2:0]!.id;
 const book=takeCard(s,source,'a2-p03-r1c1'),dawn=takeCard(s,source,'a2-p01-r1c2');s.players[source]!.hand=s.players[source]!.hand.filter(id=>id!==dawn);trimHand(s,source,book);
 s.deck=[dawn,...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];return s;
}
