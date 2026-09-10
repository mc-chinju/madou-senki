import {expect,it} from 'vitest';
import {transition,viewFor,gameStats,type GameState} from '../src/index.js';
import {act,finish,pass,ready,until} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {assignCharacter,takeCard,trimHand} from '../../../apps/worker/test/fixtures/scenario-tools.js';
function rejected(s:GameState,command:Parameters<typeof transition>[1]['command']){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId:'B',command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
it('S07 actual Lia prayer reserves once rejects same-action reuse and returns for a later independent attack',()=>{
 let s=ready();assignCharacter(s,'A','侍大将のシン');assignCharacter(s,'B','リーア姫');assignCharacter(s,'C','黒騎士ガーウィン');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,warrior_level:20};
 const first=takeCard(s,'A','a2-p24-r1c2'),second=takeCard(s,'B','a2-p24-r1c3'),prayer=takeCard(s,'B','a2-p05-r2c3');trimHand(s,'A',first);trimHand(s,'B',second,prayer);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:first,targetIds:['C'],dedicated:false}),'effect-level');
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);
 const action=Object.values(s.actions!).find(a=>a.cardInstanceId===first)!;
 const command={type:'PLAY_REACTION' as const,cardInstanceId:prayer,mode:'effect-plus' as const,targetActionId:action.id,dedicated:true};
 s=act(s,'B',command);
 for(let n=0;!s.reclaimReservations.includes(prayer)&&n<100;n++)s=pass(s);
 expect(s.reclaimReservations).toContain(prayer);expect(s.players.B!.hand).not.toContain(prayer);rejected(s,command);
 s=finish(s);expect(s.players.B!.hand.filter(id=>id===prayer)).toHaveLength(1);expect(s.reclaimReservations).not.toContain(prayer);rejected(s,command);
 s=act(s,'A',{type:'PASS_WITHDRAWAL'});s=finish(act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(gameStats(s,'A').handLimit)}));
 s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});
 s=until(act(s,'B',{type:'ATTACK',cardInstanceId:second,targetIds:['C'],dedicated:false}),'effect-level');
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);
 const later=Object.values(s.actions!).find(a=>a.cardInstanceId===second)!;expect(later.eventId).not.toBe(action.eventId);
 s=act(s,'B',{...command,targetActionId:later.id});
 for(let n=0;!s.reclaimReservations.includes(prayer)&&n<100;n++)s=pass(s);
 expect(s.reclaimReservations).toContain(prayer);s=finish(s);expect(s.players.B!.hand.filter(id=>id===prayer)).toHaveLength(1);expect(s.discard).not.toContain(prayer);
});
