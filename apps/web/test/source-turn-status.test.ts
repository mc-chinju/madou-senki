import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { StatusList } from '../src/game/StatusList.js';

test('Water Dragon stop expires at the source turn instead of promising a victim recovery check', () => {
  const player = { id: 'B', name: '楓', revealed: false, presence: 'active' as const, pendingFatal: false, damage: 0, handCount: 5, followers: [], chants: [], chantCount: 0, open: [], attachments: [], skipsNextTurn: false,
    statuses: [{ kind: 'stopped' as const, timing: 'source-turn' as const, sourceActorId: 'A', sourceCardInstanceId: 'a2-p23-r1c1' }] };
  const html = renderToStaticMarkup(createElement(StatusList, { player }));
  expect(html).toContain('水竜'); expect(html).toContain('使用者の次の手番'); expect(html).toContain('回復判定はありません');
  expect(html).not.toContain('次の回復判定'); expect(html).not.toContain('NaN');
});
