import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlayerView } from '@madou/engine';
import { expect, test } from 'vitest';
import { EndgameRevealPanel } from '../src/game/EndgameRevealPanel.js';

/** The seats the panel branches on: one that came out in the open, one that never did, and one whose person
 *  the catalog does not carry. */
function view(reveal: PlayerView['reveal']): PlayerView {
  return {
    reveal,
    seatOrder: ['a', 'b', 'c'],
    players: { a: { name: '葵', revealed: true }, b: { name: '楓', revealed: false }, c: { name: '椿', revealed: true } },
  } as unknown as PlayerView;
}
const seat = (characterId: string, hand: string[]) => ({ characterId, hand, followers: [], chants: [] });

test('the panel stays shut while the game is still being played', () => {
  expect(renderToStaticMarkup(createElement(EndgameRevealPanel, { view: view(null), onInspect: () => {} }))).toBe('');
});

test('a decided game names each seat, marks the one that never showed itself, and splits the pile', () => {
  const html = renderToStaticMarkup(createElement(EndgameRevealPanel, {
    view: view({
      players: { a: seat('c2-p01-r1c1', ['a2-p09-r1c1']), b: seat('c2-p01-r1c2', []), c: seat('c2-p99-r9c9', []) },
      deck: ['a2-p04-r2c3'],
      discard: [{ cardInstanceId: 'a2-p08-r2c1', ownerId: 'a', faceUp: true }, { cardInstanceId: 'a2-p04-r3c1', faceUp: false }],
    }),
    onInspect: () => {},
  }));

  expect(html).toContain('全員の手の内');
  // Both people are named whether or not the game ever showed them; the tag is what tells the two apart.
  expect(html).toContain('白魔術師シェリム');
  expect(html).toContain('大神官ジル');
  // A person the catalog cannot name still gets a seat, and the line says so rather than going blank.
  expect(html).toContain('不明な人物');
  expect(html.match(/最後まで非公開/g)).toHaveLength(1);
  // A hand played down to nothing still gets its row, rather than the row leaving with the cards: 「なし」
  // alone would be satisfied by the empty 従者 row next to it, so the rows themselves are counted.
  expect(html).toContain('雷斬剣');
  expect(html.match(/<dt>手札<\/dt>/g)).toHaveLength(3);
  // The pile is split by owner: one line under the seat that discarded it, one for the card nobody owned.
  expect(html).toContain('捨て札 1枚（捨てた順）');
  // A seat that discarded nothing keeps the bare label: no count, and no order to name for an empty pile.
  expect(html.match(/<dt>捨て札<\/dt>/g)).toHaveLength(2);
  expect(html).toContain('獣王剣');
  expect(html).toContain('どの席のものでもない捨て札 1枚');
  expect(html).toContain('山札 1枚（上から順）');
});
