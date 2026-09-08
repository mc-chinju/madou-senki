import { expect, it } from 'vitest';
import { allCardInstanceIds, transition, viewFor } from '../src/index.js';
import { entropy, freshGame, loadFixture } from './fixtures.js';
it('loads a new copy of the actual four-player JSON fixture for save/resume', () => {
  const s = loadFixture('basic-four-player'); expect(s).toEqual(freshGame());
  expect(viewFor(s, 'A').self.hand).toHaveLength(5); expect(viewFor(s, 'A').players.B!.handCount).toBe(5);
  expect(transition(s, { actorId: s.pending!.actorId, command: { type: 'PASS_SETUP' } }, entropy())).toEqual(transition(freshGame(), { actorId: 'A', command: { type: 'PASS_SETUP' } }, entropy()));
  s.deck.reverse(); s.players.A!.hand.pop(); expect(loadFixture('basic-four-player')).toEqual(freshGame());
  expect(allCardInstanceIds(loadFixture('basic-four-player'))).toHaveLength(220);
});
