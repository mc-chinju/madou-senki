import {makeR6RollScenario} from './r6-roll-scenarios.js';
export type CanonicalScenario='canonical-S01'|'canonical-S04';
export function isCanonicalScenario(name:string):name is CanonicalScenario{return name==='canonical-S01'||name==='canonical-S04';}
/** Plan names reuse the actual setup/poem/resistance pathway, without injecting a roll. */
export function makeCanonicalScenario(name:CanonicalScenario,players:{id:string;name:string}[]){return makeR6RollScenario(players,name==='canonical-S01');}
