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

/** The table plays on until the newest window of the record no longer reaches back to what has happened so
 *  far. Whatever a seat is to keep knowing has to survive this; anything read off the record will not. */
export function pastTheWindow(s:engine.GameState,actorId='C'):engine.GameState{
 const next=structuredClone(s);
 for(let n=0;n<engine.LOG_WINDOW;n++)next.events.push({id:next.nextEventId++,at:0,type:'REST',actorId,audience:'public',count:1});
 return next;
}

/** A snapshot carries only the newest window of the record, so reading it whole walks back page by page.
 *  `sinceId` stops the walk once older lines appear, for when only what a step just added is being read. */
export function wholeRecord(s:engine.GameState,viewerId:string,sinceId=0):engine.LogView[]{
 const logs:engine.LogView[]=[];let beforeId:number|undefined;
 for(;;){
  const page=engine.logPage(s,viewerId,{...(beforeId===undefined?{}:{beforeId}),limit:engine.LOG_PAGE_MAX});
  const kept=page.logs.filter(log=>log.id>sinceId);
  logs.unshift(...kept);
  if(!page.logs.length||kept.length<page.logs.length||page.logs[0]!.id===page.logStart)return logs;
  beforeId=page.logs[0]!.id;
 }
}
