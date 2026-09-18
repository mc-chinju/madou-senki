import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { viewFor } from '@madou/engine';
import { act, finish, ready } from '../../../packages/engine/test/combat-helpers.js';
import { character, handCard } from '../../../packages/engine/test/fixtures.js';
import { Board } from '../src/game/Board.js';

/** Board only ever attaches an explicitly chosen maai ability to WITHDRAW; the returned-counter one is never offered there. */
function withdrawalBoard(name: string) {
  let state = ready();
  character(state, 'A', name);
  const card = handCard(state, 'A', '白光');
  state = finish(act(state, 'A', { type: 'ATTACK', cardInstanceId: card, targetIds: ['B'], dedicated: false }));
  expect(state.phase).toBe('withdrawal');
  const game = viewFor(state, 'A');
  const room = { status: 'playing', game, members: [{ id: 'A' }], closeVotes: [] };
  return { game, html: renderToStaticMarkup(createElement(Board, { room: room as never, actorId: 'A', disabled: false, send: () => true })) };
}

test('the withdrawal maai ability selector offers only distance abilities, never the returned-counter one', () => {
  for (const [name, abilityId, label] of [['有翼人のティア', 'c2-p02-r1c1-ab01', '飛翔'], ['小妖精のチャム', 'c2-p01-r2c2-ab01', 'ぶーんぶーん']] as const) {
    const { game, html } = withdrawalBoard(name);
    expect(game.maaiAbilityOptions.map(option => option.abilityId)).toEqual([abilityId]);
    expect(html).toContain('離脱の間合いに添える能力');
    expect(html).toContain(`<option value="${abilityId}">${label}</option>`);
    expect(html).toContain('使わない</option>');
    expect(html).not.toContain('c2-p02-r2c1-ab03');
  }
});

test('Lancaster gets no withdrawal ability selector, so its returned-counter ability can never reach a WITHDRAW command', () => {
  const { game, html } = withdrawalBoard('早駆けのランカスター');
  expect(game.maaiAbilityOptions).toEqual([]);
  expect(html).not.toContain('離脱の間合いに添える能力');
  expect(html).not.toContain('c2-p02-r2c1-ab03');
  expect(html).toContain('離脱');
});
