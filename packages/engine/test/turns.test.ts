import {discardIds, moveToDiscard } from '../src/index.js';
import { closeWindow, finish } from './combat-helpers.js';
import { expect, it } from 'vitest';
import * as engine from '../src/index.js';
import { entropy, freshGame, handCard } from './fixtures.js';
function started() { let s = freshGame(); for (const actorId of s.seatOrder) { const r = engine.transition(s, { actorId, command: { type: 'PASS_SETUP' } }, entropy()); if (!r.ok) throw Error(r.code); s = r.state; } return s; }
function step(s: engine.GameState, actorId: string, command: unknown) { return engine.transition(s, { actorId, command } as engine.GameInput, entropy()); }
it('exposes no active window during setup and after setup', () => {
  expect((engine as any).activeWindowRef?.(freshGame())).toBeNull();
  expect((engine as any).activeWindowRef?.(started())).toBeNull();
});
it('offers optional draw, rests once, adjusts hand and advances seat', () => {
  let s = started(); const rest = handCard(s, 'A', '間合い／休息'); s.players.A!.damage = 3;
  let r = step(s, 'B', { type: 'START_TURN' }); expect(r).toEqual({ ok: false, code: 'NOT_YOUR_TURN' });
  r = step(s, 'A', { type: 'START_TURN' }); expect(r.ok).toBe(true); if (!r.ok) return; s = r.state;
  expect(s.phase).toBe('draw');
  r = step(s, 'A', { type: 'CHOOSE_DRAW', draw: false }); expect(r.ok).toBe(true); if (!r.ok) return; s = r.state;
  r = step(s, 'A', { type: 'REST', cardInstanceIds: [rest] }); expect(r.ok).toBe(true); if (!r.ok) return; s = r.state;
  s=finish(s);expect(s.players.A!.damage).toBe(2); expect(discardIds(s)).toContain(rest); expect(s.phase).toBe('hand-adjustment');
  expect(step(s, 'A', { type: 'REST', cardInstanceIds: [rest] })).toEqual({ ok: false, code: 'WRONG_PHASE' });
  r = step(s, 'A', { type: 'END_TURN', discardIds: s.players.A!.hand.slice(5) }); expect(r.ok).toBe(true); if (!r.ok) return;
  expect(r.state.turnSeat).toBe(1); expect(r.state.phase).toBe('turn-start'); expect(engine.allCardInstanceIds(r.state).sort()).toEqual(engine.allCardInstanceIds(s).sort());
});
it('does not expose hidden chant faces and restores optional draw', () => {
  let s = started(); const id = handCard(s, 'A', '天地百撃斬');
  for (const command of [{ type: 'START_TURN' }, { type: 'CHOOSE_DRAW', draw: false }, { type: 'CHANT', cardInstanceId: id }]) {
    const r = step(s, 'A', command); expect(r.ok).toBe(true); if (!r.ok) return;
    expect(r).toEqual(step(JSON.parse(JSON.stringify(s)), 'A', command)); s = r.state;
  }
  expect(s.players.A!.chants).toEqual([{ cardInstanceId: id, revealed: false }]);
  expect(engine.viewFor(s, 'B').players.A!.chants).toEqual([{ position: 0, face: 'back' }]);
});
it('checks every recovery status, repeats last modifier, and skips action while stopped', () => {
  const s = started(); const p = s.players.A!;
  (p as any).statuses = [{ id: 'stop-1', kind: 'stopped', modifiers: [-3, -2, -1], nextCheck: 1 }, { id: 'silence-1', kind: 'silenced', modifiers: [-2, -1], nextCheck: 1 }];
  const r = engine.transition(s, { actorId: 'A', command: { type: 'START_TURN' } } as any, { ...entropy(), dice: [6, 6, 1, 1] });
  expect(r.ok).toBe(true); if (!r.ok) return;
  let resolved=closeWindow(r.state,[6,6]);resolved=closeWindow(resolved);resolved=closeWindow(resolved,[1,1]);resolved=closeWindow(resolved);
  expect(resolved.turnSeat).toBe(1); expect((resolved.players.A as any).statuses).toEqual([{ id: 'stop-1', kind: 'stopped', modifiers: [-3, -2, -1], nextCheck: 2 }]);
});
it('refills immediately on clearing last stopped status and still offers optional draw', () => {
  const s = started(); const p = s.players.A!;
  (p as any).statuses = [{ id: 'stop-1', kind: 'stopped', modifiers: [-1], nextCheck: 1 }];
  for(const __discarded of [...p.hand.splice(2)])moveToDiscard(s,__discarded,{faceUp:true});
  const r = engine.transition(s, { actorId: 'A', command: { type: 'START_TURN' } } as any, { ...entropy(), dice: [1, 1] });
  expect(r.ok).toBe(true); if (!r.ok) return;
  const resolved=finish(r.state);expect(resolved.players.A!.hand).toHaveLength(5); expect(resolved.phase).toBe('draw');
});
it('reorders hidden followers as a whole normal action and refuses silence chanting', () => {
  let s = started(); const a = handCard(s, 'A', 'ゴブリン'); const b = handCard(s, 'A', 'オーク');
  for (const command of [{ type: 'START_TURN' }, { type: 'CHOOSE_DRAW', draw: false }, { type: 'ARRANGE_FOLLOWERS', cardInstanceIds: [a,b] }]) {
    const r = step(s, 'A', command); expect(r.ok).toBe(true); if (!r.ok) return; s = r.state;
  }
  expect(s.players.A!.followers).toEqual([{ cardInstanceId: a, revealed: false,placedById:'A',placedLifeId:s.players.A!.lifeId??'initial-life:A' }, { cardInstanceId: b, revealed: false,placedById:'A',placedLifeId:s.players.A!.lifeId??'initial-life:A' }]);
  expect(engine.viewFor(s, 'B').players.A!.followers).toEqual([{ position: 0, face: 'back' }, { position: 1, face: 'back' }]);
});

it('plays bounded printed turn cards and allows the optional no-action choice',()=>{let s=started();const potion=handCard(s,'A','回復の薬');s.players.A!.damage=5;for(const command of [{type:'START_TURN'},{type:'CHOOSE_DRAW',draw:false}]){const r=step(s,'A',command);expect(r.ok).toBe(true);if(!r.ok)return;s=r.state;}let r=engine.transition(s,{actorId:'A',command:{type:'PLAY_TURN_CARD',cardInstanceIds:[potion]}} as any,{...entropy(),dice:[4]});expect(r.ok).toBe(true);if(!r.ok)return;s=finish(closeWindow(r.state,[4]));expect(s.players.A!.damage).toBe(1);expect(discardIds(s)).toContain(potion);expect(s.phase).toBe('hand-adjustment');
  let next=started();for(const command of [{type:'START_TURN'},{type:'CHOOSE_DRAW',draw:false},{type:'PASS_ACTION'}]){const result=step(next,'A',command);expect(result.ok).toBe(true);if(!result.ok)return;next=result.state;}expect(next.phase).toBe('hand-adjustment');
  let attached=started();const card=handCard(attached,'A','香具羅');const before=engine.derivedStats(attached.players.A!).warrior_level;for(const command of [{type:'START_TURN'},{type:'CHOOSE_DRAW',draw:false},{type:'PLAY_TURN_CARD',cardInstanceIds:[card]}]){const result=step(attached,'A',command);expect(result.ok).toBe(true);if(!result.ok)return;attached=result.state;}attached=finish(attached);expect(attached.players.A!.attachments).toContain(card);expect(engine.derivedStats(attached.players.A!).warrior_level).toBe(before+1);});
