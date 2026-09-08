import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlayerView } from '@madou/engine';
import { expect, test } from 'vitest';
import { ResultPanel } from '../src/game/ResultPanel.js';

test('a stalemate result is identified as an unprogressable draw', () => {
  const view = {
    outcome: { kind: 'draw', reason: 'stalemate', winnerIds: [], results: { a: 'draw', b: 'draw' } },
    individualResults: {},
    seatOrder: ['a', 'b'],
    players: {
      a: { name: '葵' },
      b: { name: '楓' },
    },
  } as unknown as PlayerView;

  expect(renderToStaticMarkup(createElement(ResultPanel, { view }))).toContain('進行不能による引き分け');
});
