import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { OwnDiscardDialog } from '../src/game/OwnDiscardDialog.js';

const render = (ids: string[], open = true) => renderToStaticMarkup(createElement(OwnDiscardDialog, { ids, open, onClose: () => {}, onInspect: () => {} }));

test('the closed dialog renders nothing and the open one counts what the seat let go', () => {
  expect(render([], false)).toBe('');
  const empty = render([]);
  expect(empty).toContain('（0枚）');
  expect(empty).toContain('まだありません。');
  expect(empty).not.toContain('同名をまとめる');
});

test('the newest discard is listed first and every name opens the card', () => {
  const html = render(['a2-p09-r1c1', 'a2-p08-r2c1']);
  expect(html).toContain('（2枚）');
  expect(html.indexOf('雷斬剣')).toBeLessThan(html.indexOf('獣王剣'));
  expect(html).toContain('aria-label="獣王剣の詳細を見る"');
  expect(html).toContain('aria-pressed="true">新しい順');
});
