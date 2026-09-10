import {expect,it} from 'vitest';
import {allCardInstanceIds,gameStats,transition,viewFor,type GameCommand,type GameState} from '../src/index.js';
import {entropy} from './fixtures.js';
import {makeRitualPhysicalScenario,ritualCard} from '../../../apps/worker/test/fixtures/ritual-physical-scenarios.js';
it('actual ritual Vanmil survives Rift otherworld departure and later turns without terminal',()=>{
 let s=makeRitualPhysicalScenario('ritual-otherworld',['A','B','C','D'].map(id=>({id,name:id})));
 const spear='a2-p14-r2c2';
 function send(actorId:string,command:GameCommand,face=1){const input={actorId,command},e={...entropy(),dice:Array(100).fill(face)},r=transition(s,input,e);expect(r).toEqual(transition(JSON.parse(JSON.stringify(s)),input,e));if(!r.ok)throw Error(`${command.type}: ${r.code}`);s=r.state;expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);}
 function step(){const w=s.windows?.at(-1),id=s.seatOrder[s.turnSeat]!;
  if(w){const roll=s.rolls?.at(-1);send(w.participants[w.cursor]!,{type:'PASS'},roll?.purpose==='status-resistance'&&roll.stage==='before-roll'?6:1);}
  else if(s.phase==='action')send(id,{type:'PASS_ACTION'});
  else if(s.phase==='withdrawal')send(id,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')send(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>x!==spear).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});
  else if(s.phase==='turn-start')send(id,{type:'START_TURN'});
  else if(s.phase==='draw')send(id,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`ABSENT_PHASE_${s.phase}`);
 }
 function until(done:(s:GameState)=>boolean){for(let n=0;n<600;n++){if(done(s))return;expect(s.outcome).toBeUndefined();step();}throw Error('ABSENT_LIMIT');}
 const ownAction=(s:GameState)=>!s.windows?.length&&s.phase==='action'&&s.seatOrder[s.turnSeat]==='C';
 send('A',{type:'USE_REVIVAL_RITUAL'});until(s=>s.windows?.at(-1)?.kind==='lifecycle-boundary');
 expect(s.players.A).toMatchObject({characterId:'c2-p07-r1c2',damage:0,faction:'ヴァンミール'});expect(gameStats(s,'A').endurance).toBe(25);
 until(ownAction);for(const id of ['B','D'])expect(s.players[id]!.faction).toBe('EVIL');
 send('C',{type:'CHANT',cardInstanceId:spear});until(ownAction);
 send('C',{type:'ATTACK',cardInstanceId:spear,targetIds:['A'],dedicated:false});until(s=>!s.windows?.length);
 expect(s.players.A).toMatchObject({presence:'otherworld',characterId:'c2-p07-r1c2',damage:8});
 const away=structuredClone(s.players.A!);expect(s.rolls!.some(r=>r.purpose==='status-resistance'&&r.rollerId==='A'&&r.success===false)).toBe(true);
 expect(s.vanmilDeath).not.toBe(true);expect(s.outcome).toBeUndefined();
 until(ownAction);expect(s.players.A).toEqual(away);
 expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='A')).toEqual([]);expect(s.events.filter(e=>e.type==='GAME_COMPLETED')).toEqual([]);expect(s.vanmilDeath).not.toBe(true);
 expect(s.windows??[]).toEqual([]);expect(s.resolution).toEqual([]);expect(s.reclaimReservations).toEqual([]);
 for(const card of [ritualCard,spear])expect(s.discard.filter(id=>id===card)).toHaveLength(1);
 for(const id of s.seatOrder){const v=viewFor(JSON.parse(JSON.stringify(s)),id);expect(v.outcome).toBeNull();expect(v.players.A!.presence).toBe('otherworld');}
});
