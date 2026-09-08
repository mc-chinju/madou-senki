import type { GameState } from '../state.js';
export function setPairDistance(state:GameState,a:string,b:string,distance:'near'|'far'):void{state.distances[a]![b]=distance;state.distances[b]![a]=distance;}
export function pairDistance(state:GameState,a:string,b:string):'near'|'far'{return state.distances[a]![b]!;}
