import { test, expect } from '@playwright/test';
import type { GameState, PlayerView } from '../../packages/engine/src/index.js';
import { choose, legalCommands } from '../../packages/engine/src/bot/index.js';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';
import { origin, tableFixture } from './helpers.js';
import { BotClient } from './bot-client.js';

/** Card and character ids the viewer must not receive at this saved revision. Once the game is decided the
 *  reveal opens all of them, so the same list is read the other way round. */
function secretsFor(game: GameState, viewerId: string, decided: boolean): string[] {
  const open = game.events.filter(event => event.audience === 'public');
  const shown = new Set(open.flatMap(event => [event.cardInstanceId, event.death?.sourceCardInstanceId]));
  // Every card a public line has ever named; one line can name several at once, so the list form counts too.
  const named = new Set([...shown, ...open.flatMap(event => event.cardInstanceIds ?? [])]);
  const others = game.seatOrder.filter(id => id !== viewerId).map(id => game.players[id]!);
  return [
    // A seat reviews its own discards, so only the other seats' unseen cards stay secret from this viewer.
    ...game.discard.filter(entry => entry.ownerId !== viewerId && !shown.has(entry.cardInstanceId)).map(entry => entry.cardInstanceId),
    ...others.flatMap(p => [...p.hand, ...[...p.followers, ...p.chants].filter(card => !card.revealed).map(card => card.cardInstanceId)]),
    ...others.filter(p => !p.revealed).map(p => p.characterId),
    // The deck is secret from everyone while the table plays, and the reveal opens it once the game is
    // decided. A card the table already saw can be shuffled back under it, and the record goes on naming it
    // there, so what the deck keeps is the cards nobody has seen.
    ...(decided ? [] : game.deck.filter(id => !named.has(id))),
  ];
}

test('another seat can trace the whole bot game in the public record while its socket never carries secrets', async ({ browser, request }) => {
  test.setTimeout(20 * 60 * 1000);
  const table = await tableFixture(browser, request, undefined, 4);
  try {
    expect((await request.post(`/__test/rooms/${table.roomId}/entropy`, { data: { seed: 4 } })).status()).toBe(204);
    const watcher = table.pages[1]!, watcherId = table.sessions[1]!.id;
    /** Every snapshot of a game the watcher's socket carried, with the strings it names read off once: the
     *  sweep below asks after one card at a time, and a frame holds every card the seat may see. The room
     *  snapshots that come before the table is dealt carry no game, so there is nothing in them to sweep. */
    const frames: { revision: number; text: string; names: Set<string> | null }[] = [];
    let latest: RoomView | null = null;
    watcher.on('websocket', socket => socket.on('framereceived', frame => {
      const text = String(frame.payload), message = JSON.parse(text);
      if (message.type !== 'snapshot') return;
      latest = message.view;
      const revision = message.view?.game?.revision;
      // Reading the strings off pairs the quotes, which only holds while none of them is escaped; a frame
      // that carries an escaped quote is read the slow way instead of being read wrong.
      if (revision !== undefined) frames.push({ revision, text, names: text.includes('\\"') ? null : new Set(text.match(/"[^"]*"/g) ?? []) });
    }));
    for (const page of table.pages) {
      await page.goto(table.url);
      await page.getByRole('button', { name: '準備完了', exact: true }).click();
    }
    await table.pages[0]!.getByRole('button', { name: '対戦を始める', exact: true }).click();
    for (const page of table.pages) await expect(page.getByRole('region', { name: '自分の手札', exact: true })).toBeVisible();
    const bots = await Promise.all(table.contexts.map(async context => {
      const bot = new BotClient(origin, (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; '), table.roomId);
      await bot.connect();
      return bot;
    }));
    let steps = 0, audited = 0, widenings = 0, narrowedAt: number | null = null;
    const record = watcher.getByRole('region', { name: '戦記の全件' });
    const filter = watcher.getByLabel('絞り込み');
    const toLatest = watcher.getByRole('button', { name: /^最新へ/ });
    // A reader who follows the record is shown its end, whatever the filter they read it through keeps. So
    // when they widen the filter again, the lines it had been hiding are not arrivals: they were already
    // there. This only says anything while the table is still playing — once the game is over, no line the
    // filter hid can arrive after the reader was last shown the end, and any rule at all would pass.
    // Reading one other seat is what makes the point: a reader's own passes run all through the record, so
    // 「自分に関係する」 keeps a line from nearly every window and the end of it never falls far behind.
    const narrow = async () => {
      await filter.selectOption(`seat:${table.sessions[0]!.id}`);
      // Following means there is nothing to catch up on; the mark is written from here as the table plays on.
      await expect(toLatest).toHaveCount(0);
    };
    const widen = async () => {
      // A reader can only come back to the end of a record they can leave, so one seat's lines have to fill
      // more than the panel first. Until they do, the reader stays at the end and the round waits.
      if (await record.evaluate(element => element.scrollHeight - element.clientHeight) < 48) return false;
      // Nothing may arrive between the reader leaving the end and widening, or an arrival would be counted
      // and rightly so. The bots are idle inside this step, so the wait is only for the last snapshot.
      const game = await (await request.get(`/__test/rooms/${table.roomId}/game`)).json() as GameState;
      await expect.poll(() => (latest as RoomView | null)?.game?.revision).toBe(game.revision);
      await record.evaluate(element => { element.scrollTop = 0; });
      await expect(toLatest, 'the reader has to leave the followed end for 「新着」 to mean anything').toBeVisible();
      await filter.selectOption('all');
      // Down to a single line: a record the reader was shown the end of has no arrivals in it at all.
      await expect(toLatest).toHaveText('最新へ');
      await toLatest.click();
      await expect(toLatest).toHaveCount(0);
      widenings++;
      return true;
    };
    /** Every snapshot is swept, not a sample of them: a leak the socket carried for one revision is a leak.
     *  The secrets of a revision are read from the server as the table reaches it, so each frame is judged by
     *  the state it was sent from — a card that is public now may have been in a hand when the frame went out.
     *  決着後の全公開 is the same sweep read the other way round: everything the socket refused all game has to
     *  arrive in the snapshot that carries the outcome, and not one line before it. */
    const secretsAt = new Map<number, string[]>();
    const audit = async () => {
      const game = await (await request.get(`/__test/rooms/${table.roomId}/game`)).json() as GameState;
      await expect.poll(() => (latest as RoomView | null)?.game?.revision).toBe(game.revision);
      const decided = !!game.outcome;
      const secrets = secretsFor(game, watcherId, decided);
      if (decided) expect(secrets.length, 'a decided game still has something left to open').toBeGreaterThan(0);
      secretsAt.set(game.revision, secrets);
      expect((latest as RoomView | null)!.game!.discardCount).toBe(game.discard.length);
      while (audited < frames.length) {
        const frame = frames[audited]!;
        const known = secretsAt.get(frame.revision);
        expect(known, `revision ${frame.revision} never came back from the server`).toBeDefined();
        const sent = JSON.parse(frame.text).view.game as PlayerView;
        expect(sent).not.toHaveProperty('discard');
        // The line above only ever says the pile is not at the top of the view. Before the outcome that is the
        // whole claim, and the sweep below carries it; after it the pile has moved under `reveal`, so the same
        // line would pass on a snapshot that shipped nothing at all. Name where it went instead.
        const open = decided && frame.revision === game.revision;
        if (open) {
          // The deck is left out of the sweep below, because a decided game opens it while the sweep reads the
          // cards nobody saw. So what says it arrived at all is named here, beside the pile. Two empty decks
          // would agree without the reveal carrying anything, so the length is asked for first.
          expect(game.deck.length, 'the table has to leave cards undrawn for the line below to say anything').toBeGreaterThan(0);
          expect(sent.reveal!.deck).toEqual(game.deck);
          expect(sent.reveal!.discard.map(entry => entry.cardInstanceId)).toEqual(game.discard.map(entry => entry.cardInstanceId));
        } else expect(sent.reveal).toBeNull();
        for (const secret of known!) {
          const carried = frame.names ? frame.names.has(`"${secret}"`) : frame.text.includes(`"${secret}"`);
          expect(carried, `revision ${frame.revision}: ${secret}`).toBe(open);
        }
        audited++;
      }
    };
    // The deal is the most secret the table ever is, so the sweep starts before the first seat acts.
    await audit();
    while (steps < 5000) {
      const views = bots.map(bot => bot.view());
      if (views[0]?.outcome) break;
      let acted = false;
      for (const [index, bot] of bots.entries()) {
        const view = views[index] as PlayerView | null;
        if (!view || legalCommands(view).length === 0) continue;
        const result = await bot.send(choose(view, 4));
        expect(result.ok, `seat ${index} step ${steps} ${result.code}`).toBe(true);
        acted = true; steps++;
        await audit();
        // Rounds of it at least thirty of the table's steps apart, so the lines the filter hides do arrive in
        // between. A round that cannot be finished yet holds the reader where they are and tries again later.
        if (steps >= 50 && steps % 10 === 0) {
          if (narrowedAt === null) { await narrow(); narrowedAt = steps; }
          else if (steps - narrowedAt >= 30 && await widen()) narrowedAt = null;
        }
        break;
      }
      if (!acted) await new Promise(resolve => setTimeout(resolve, 50));
    }
    // The filter is remembered for this table, so a round the game ended in the middle of would follow the
    // reader through the reload below and read the rest of the test through one seat.
    await filter.selectOption('all');
    expect(bots[0]!.view()?.outcome).toBeDefined();
    await audit();
    // Not one snapshot of the table's whole game went unread, and every step sent at least one.
    expect(audited).toBe(frames.length);
    expect(audited).toBeGreaterThanOrEqual(steps);
    // A table too short to reach them would leave the filter unmeasured while still reading as a pass.
    expect(widenings, 'the table has to play long enough to widen the filter twice').toBeGreaterThanOrEqual(2);
    bots.forEach(bot => bot.close());

    await watcher.reload();
    await record.evaluate(element => { element.scrollTop = 0; });
    await expect(watcher.getByRole('button', { name: '最新へ', exact: true })).toBeVisible();
    // A snapshot carries only the newest window, so the whole game is reached by reading back page by page.
    const older = watcher.getByRole('button', { name: '過去の記録を読む', exact: true });
    await expect.poll(async () => {
      if (await older.count()) await older.click({ timeout: 5000 }).catch(() => {});
      return record.getByText('これが戦記の最初です').count();
    }, { timeout: 120_000 }).toBeGreaterThan(0);
    // Reading the past back is not an arrival, so nothing the reader already saw is announced as new.
    await expect(watcher.getByRole('button', { name: '最新へ', exact: true })).toBeVisible();
    const firstTurn = record.getByRole('region', { name: /^1手番 / });
    await firstTurn.scrollIntoViewIfNeeded();
    await expect(firstTurn).toBeVisible();
    // L1: an attack names the seat it points at and closes with how it ended; L2 keeps the roll's outcome on the line.
    for (const text of [/さんへ攻撃を宣言しました/, /への攻撃(（[^）]+）)?(が命中しました|は防がれました|は不発に終わりました|は無効化されました)/, /(\d+|（合計\d+）)を出しました/, /ダメージを受けました/, /でパスしました/]) await expect(record.getByText(text).first()).toBeAttached();
    await watcher.screenshot({ path: '.cache/e2e-results/public-record-first-turn.png', fullPage: false });
    await watcher.getByRole('button', { name: '最新へ', exact: true }).click();
    await expect(watcher.getByRole('button', { name: '最新へ', exact: true })).toHaveCount(0);
  } finally { await table.close(); }
});
