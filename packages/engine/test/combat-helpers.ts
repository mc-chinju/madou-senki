import { expect } from 'vitest';
import * as engine from '../src/index.js';
import { character, entropy, freshGame } from './fixtures.js';
export function act(s:engine.GameState,actorId:string,command:unknown,dice:number[]=[]){const r=engine.transition(s,{actorId,command} as engine.GameInput,{...entropy(),dice});expect(r).toEqual(engine.transition(JSON.parse(JSON.stringify(s)),{actorId,command} as engine.GameInput,{...entropy(),dice}));if(!r.ok)throw Error(r.code);expect(engine.allCardInstanceIds(r.state).sort()).toEqual(engine.allCardInstanceIds(s).sort());expect(engine.allCardInstanceIds(r.state)).toHaveLength(220);expect(new Set(engine.allCardInstanceIds(r.state)).size).toBe(220);return r.state;}
/** Ready every remaining seat through the concurrent setup rounds (G10) and leave setup. */
export function readySetup(s:engine.GameState){for(let round=0;round<6&&s.pending;round++)for(const id of engine.pendingSetupSeats(s))s=act(s,id,{type:'PASS_SETUP'});return s;}
export function ready(){let s=freshGame();s=readySetup(s);s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});character(s,'A','侍大将のシン');character(s,'B','黒騎士ガーウィン');return s;}
export function pass(s:engine.GameState,dice:number[]=Array(30).fill(1)){const w=s.windows?.at(-1);if(!w)throw Error('NO_WINDOW');return act(s,w.participants[w.cursor]!,{type:'PASS'},dice);}
export function until(s:engine.GameState,kind:string){for(let n=0;n<150;n++){if(s.windows?.at(-1)?.kind===kind)return s;s=pass(s);}throw Error('DID_NOT_CONVERGE');}
export function finish(s:engine.GameState){for(let n=0;n<300;n++){if(!s.windows?.length)return s;s=pass(s);}throw Error('DID_NOT_CONVERGE');}
/** Explicitly pass only the physical source responses added by a payment. */
export function passReclaims(s:engine.GameState){for(let n=0;n<150;n++){if(s.windows?.at(-1)?.kind!=='reclaim')return s;s=pass(s);}throw Error('RECLAIM_DID_NOT_CONVERGE');}

/** Close exactly the current boundary, preserving any newly opened child/result window. */
export function closeWindow(s:engine.GameState,dice:number[]=Array(30).fill(1)){const id=s.windows?.at(-1)?.id;if(!id)throw Error('NO_WINDOW');while(s.windows?.at(-1)?.id===id)s=pass(s,dice);return s;}
