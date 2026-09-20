import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { OwnDiscardDialog } from '../src/game/OwnDiscardDialog.js';

const render = (ids: string[], count = ids.length, open = true) => renderToStaticMarkup(createElement(OwnDiscardDialog, { ids, count, open, onClose: () => {}, onInspect: () => {} }));

test('an empty list still says how much of the pile the header was counting', () => {
  expect(render([], 0, false)).toBe('');
  const empty = render([], 3);
  expect(empty).toContain('捨て札 3枚のうち、自分が捨てた 0枚です。');
  expect(empty).toContain('まだありません。');
  expect(empty).not.toContain('同名をまとめる');
});

test('the newest discard is listed first and every name opens the card', () => {
  const html = render(['a2-p09-r1c1', 'a2-p08-r2c1'], 7);
  expect(html).toContain('捨て札 7枚のうち、自分が捨てた 2枚です。');
  expect(html.indexOf('雷斬剣')).toBeLessThan(html.indexOf('獣王剣'));
  expect(html).toContain('aria-label="獣王剣の詳細を見る"');
  expect(html).toContain('aria-pressed="true">新しい順');
});

test('without a single pair the grouped view stays unavailable and the newest order stands', () => {
  const html = render(['a2-p09-r1c1', 'a2-p08-r2c1'], 7);
  expect(html).toContain('disabled=""');
  expect(html).toContain('aria-label="同名をまとめる（同じ名前の札がまだありません）"');
  expect(html).toContain('aria-pressed="true">新しい順');
  expect(html).not.toContain('1枚');
});

test('a pair unlocks the grouped view', () => {
  const html = render(['a2-p04-r2c3', 'a2-p08-r2c1', 'a2-p04-r3c1'], 9);
  expect(html).toContain('>同名をまとめる<');
  expect(html).not.toContain('disabled=""');
  // The newest order is still what opens; the grouped count only appears once that view is chosen.
  expect(html).toContain('自分が捨てた 3枚です。');
});
