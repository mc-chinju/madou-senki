import {enqueueLifecycle} from '../lifecycle/events.js';
import {gameStats} from '../game-stats.js';
import {settleDamage} from '../lifecycle/advance.js';
import {completeOwnTurn} from '../state.js';
import {isActive} from '../lifecycle/objectives.js';
import type { GameState } from '../state.js';
import { EntropyError, refillHand } from '../setup.js';
import { beginRoll } from './advance.js';
import { moveToDiscard } from '../discard.js';
import type { RollFrame } from './frames.js';
export function advanceTurnRolls(s: GameState, dice: () => number, random: () => number, now: number): void {
    const turn = s.turnRoll!;
    const p = s.players[turn.actorId]!;
    if(!isActive(p)){completeOwnTurn(p,s);s.turnSeat=(s.turnSeat+1)%s.seatOrder.length;s.phase='turn-start';delete s.turnRoll;return;}
    while (turn.remainingIds.length) {
        const id = turn.remainingIds[0]!;
        if (turn.kind === 'recovery') {
            const status = p.statuses?.find(status => status.id === id);
            if (!status||status.timing==='next-own-seat'||status.timing==='source-turn'||status.timing==='fixed-turns'||status.timing==='until-death') {
                turn.remainingIds.shift();
                continue;
            }
            const modifier = status.modifiers[Math.min(status.nextCheck, status.modifiers.length - 1)];
            if (modifier === undefined || !Number.isFinite(modifier) || !Number.isInteger(status.nextCheck) || status.nextCheck < 0)
                throw new EntropyError('INVALID_STATUS');
            beginRoll(s, { eventId: turn.id, rollerId: p.id, purpose: 'status-recovery', formula: '2d6', check: { modifier }, resume: { kind: 'recovery', turnId: turn.id, statusId: id } }, dice);
        }
        else
            beginRoll(s, { eventId: turn.id, rollerId: p.id, purpose: 'potion-recovery', formula: 'd6', resume: { kind: 'potion', turnId: turn.id, cardInstanceId: id } }, dice);
        return;
    }
    if (turn.kind === 'potion')
        s.phase = 'hand-adjustment';
    else if (p.statuses?.some(status => status.kind === 'stopped')) {
        completeOwnTurn(p,s);
        s.turnSeat = (s.turnSeat + 1) % s.seatOrder.length;
        s.phase = 'turn-start';
    }
    else {
        if (turn.hadStopped){
            enqueueLifecycle(s,{kind:'resume-phase',id:`resume-${turn.id}`,phase:'draw'});
            refillHand(s, p, gameStats(s,p.id).handLimit, random, now);
        }else s.phase = 'draw';
    }
    delete s.turnRoll;
}
export function resumeTurnRoll(s: GameState, frame: RollFrame, dice: () => number, random: () => number, now: number): void {
    const turn = s.turnRoll!;
    const p = s.players[turn.actorId]!;
    if (frame.resume.kind === 'recovery') {
        const id = frame.resume.statusId;
        const effect = p.statuses?.find(status => status.id === id);
        if (effect&&effect.timing!=='next-own-seat'&&effect.timing!=='source-turn'&&effect.timing!=='fixed-turns'&&effect.timing!=='until-death') {
            effect.nextCheck++;
            if(effect.timing==='deadly-recovery'&&!frame.success)settleDamage(s,[{targetId:p.id,damage:0,instantDeath:true,cause:'instant-death',...(effect.sourceActorId?{sourceActorId:effect.sourceActorId}:{}),...(effect.sourceCardInstanceId?{sourceCardInstanceId:effect.sourceCardInstanceId}:{}),eventId:frame.eventId}],now);
            if (frame.success)
                p.statuses = p.statuses!.filter(status => status.id !== id);
        }
    }
    else if (frame.resume.kind === 'potion') {
        if(isActive(p))p.damage = Math.max(0, p.damage - frame.total!);
        const id = frame.resume.cardInstanceId;
        const index = s.resolution.indexOf(id);
        if (index >= 0) {
            s.resolution.splice(index, 1);
            // The potion was named in public when it was used.
            moveToDiscard(s, id, { ownerId: p.id, faceUp: true });
        }
    }
    else
        throw Error('INVALID_CONTINUATION');
    turn.remainingIds.shift();
    advanceTurnRolls(s, dice, random, now);
}
