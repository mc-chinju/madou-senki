import {makeR6MaaiScenario} from './r6-maai-scenarios.js';
export const evadePhysicalScenarios={
 'evade-physical-1':'a2-p05-r3c1',
 'evade-physical-2':'a2-p05-r3c2',
 'evade-physical-3':'a2-p05-r3c3',
} as const;
export type EvadePhysicalScenario=keyof typeof evadePhysicalScenarios;
export function isEvadePhysicalScenario(name:string):name is EvadePhysicalScenario{return Object.hasOwn(evadePhysicalScenarios,name);}
/** The selected defense is dealt before setup, CHANT and the complete intervening turns. */
export function makeEvadePhysicalScenario(name:EvadePhysicalScenario,players:{id:string;name:string}[],three=true){return makeR6MaaiScenario(players,three,evadePhysicalScenarios[name]);}
