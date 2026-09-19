import { expect, test } from '@playwright/test';
import { getAction } from '../../packages/catalog/src/index.js';
import { finishSetup, observe, readySetup, tableFixture } from './helpers.js';

/** G10: seats place in any order inside a round; the refill and the next round follow the last ready. */
test('later seats place and ready before the first seat, and a refilled seat places again in round 2', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'setup');
  try {
    const views = await observe(table);
    const hand = (seat: number) => views.get(table.sessions[seat]!.id)!.game!.self.hand;
    const followerIn = (seat: number) => hand(seat).find(id => getAction(id)?.category === 'follower');
    const holders = [0, 1, 2, 3].filter(seat => followerIn(seat));
    expect(holders.length, '配置できる席が2つ以上ある想定').toBeGreaterThanOrEqual(2);
    const first = holders[0]!, last = holders.at(-1)!;

    const revision = (seat: number) => views.get(table.sessions[seat]!.id)!.revision;
    async function commit(seat: number, act: () => Promise<void>) {
      const before = revision(seat);
      await act();
      await expect.poll(() => revision(seat)).toBeGreaterThan(before);
    }
    async function place(seat: number, cardInstanceId: string) {
      const page = table.pages[seat]!;
      const index = hand(seat).indexOf(cardInstanceId);
      const placed = views.get(table.sessions[seat]!.id)!.game!.self.followers.length;
      await page.getByRole('region', { name: '自分の手札', exact: true }).getByRole('article').nth(index).getByRole('button').first().click();
      await commit(seat, () => page.getByRole('button', { name: '従者を置く', exact: true }).click());
      await expect.poll(() => views.get(table.sessions[seat]!.id)!.game!.self.followers.length).toBe(placed + 1);
    }
    const ready = (seat: number) => commit(seat, () => finishSetup(table.pages[seat]!));

    // Finishing with a placeable follower in hand is final, so the first press only asks inside the bar (no browser dialog).
    const bar = table.pages[first]!.getByRole('region', { name: '現在できる操作' });
    await bar.getByRole('button', { name: '配置を終える', exact: true }).click();
    await expect(bar.getByRole('alert')).toContainText('まだ置ける従者があります');
    await bar.getByRole('button', { name: 'やめる', exact: true }).click();
    await expect(bar.getByRole('alert')).toHaveCount(0);
    expect(views.get(table.sessions[first]!.id)!.game!.pending!.readyIds).toEqual([]);

    // The last seat commits and finishes while the first seat has not touched its hand.
    await place(last, followerIn(last)!);
    await ready(last);
    await expect(table.pages[first]!.getByRole('region', { name: '初期配置の進行' })).toContainText('初期配置 ラウンド1');
    await expect(table.pages[first]!.getByRole('region', { name: '初期配置の進行' })).toContainText('全員の準備完了を待っています');
    await expect(table.pages[last]!.getByRole('region', { name: '初期配置の進行' })).toContainText('準備完了しました');

    await place(first, followerIn(first)!);
    for (const seat of [0, 1, 2, 3]) if (!views.get(table.sessions[seat]!.id)!.game!.pending!.readyIds.includes(table.sessions[seat]!.id)) await ready(seat);

    // Both placing seats refilled and may place again; nobody else is asked.
    await expect.poll(() => views.get(table.sessions[first]!.id)!.game!.pending?.round).toBe(2);
    const round2 = views.get(table.sessions[first]!.id)!.game!.pending!.participantIds;
    expect(round2).toEqual(expect.arrayContaining([table.sessions[first]!.id, table.sessions[last]!.id]));
    await expect(table.pages[first]!.getByRole('region', { name: '初期配置の進行' })).toContainText('補充で引いた従者があれば置けます');
    expect(hand(first)).toHaveLength(5);

    const drawn = followerIn(first);
    if (drawn) await place(first, drawn);
    await readySetup(table);
    await expect(table.pages[first]!.getByRole('button', { name: '手番を始める', exact: true }).or(table.pages[first]!.getByRole('heading', { name: '戦場' }))).toBeVisible();
    await expect.poll(() => views.get(table.sessions[first]!.id)!.game!.phase).toBe('turn-start');
  } finally { await table.close(); }
});
