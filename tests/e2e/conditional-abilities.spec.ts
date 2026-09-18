import { expect, test, type Locator } from '@playwright/test';
import { allCardInstanceIds, type GameState } from '../../packages/engine/src/index.js';
import type { RoomView } from '../../apps/worker/src/rooms/types.js';
import { conditionalScenarioNames, type ConditionalScenarioName } from '../../packages/engine/test/fixtures/conditional-ability-scenarios.js';
import { observe, passUntil, tableFixture,storedDiscard} from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
const entries: Record<ConditionalScenarioName, { name: string; id: string; seat: number }> = {
  'conditional-tia-public': { name: 'ティアがんばる', id: 'c2-p02-r1c1-ab04', seat: 0 },
  'conditional-tia-hidden': { name: 'ティアがんばる', id: 'c2-p02-r1c1-ab04', seat: 0 },
  'conditional-lia-public': { name: 'この世界に愛を', id: 'c2-p03-r1c2-ab03', seat: 0 },
  'conditional-lia-hidden': { name: 'この世界に愛を', id: 'c2-p03-r1c2-ab03', seat: 0 },
  'conditional-lia-lance-ii': { name: 'この世界に愛を', id: 'c2-p03-r1c2-ab03', seat: 0 },
  'conditional-arnes-attack': { name: '男ごときが', id: 'c2-p03-r2c2-ab04', seat: 0 },
  'conditional-arnes-defense': { name: '男ごときが', id: 'c2-p03-r2c2-ab04', seat: 1 },
  'conditional-asfelt-dragon': { name: '竜皇子', id: 'c2-p04-r1c2-ab03', seat: 1 },
  'conditional-asfelt-truth': { name: '真実', id: 'c2-p04-r1c2-ab05', seat: 0 },
  'conditional-upa-attack': { name: '獣性', id: 'c2-p05-r1c2-ab01', seat: 0 },
  'conditional-garwin-rival': { name: '我がライバル', id: 'c2-p05-r2c1-ab05', seat: 0 },
  'conditional-dia-public': { name: '闇の聖女達の情報', id: 'c2-p06-r1c2-ab02', seat: 0 },
  'conditional-dia-hidden': { name: '闇の聖女達の情報', id: 'c2-p06-r1c2-ab02', seat: 0 },
};
function setting(table: Table, views: Map<string, RoomView>, entry: typeof entries[ConditionalScenarioName]) {
  return views.get(table.sessions[entry.seat]!.id)!.game!.conditionalAbilities.find(option => option.abilityId === entry.id)!;
}
function panel(table: Table, entry: typeof entries[ConditionalScenarioName]) {
  return table.pages[entry.seat]!.getByRole('region', { name: '継続する特殊能力' }).getByRole('group', { name: entry.name, exact: true });
}
async function click(table: Table, views: Map<string, RoomView>, button: Locator) {
  const revision = views.get(table.sessions[0]!.id)!.revision;
  await button.click(); await expect.poll(() => views.get(table.sessions[0]!.id)?.revision).toBeGreaterThan(revision);
}
async function activate(table: Table, views: Map<string, RoomView>, entry: typeof entries[ConditionalScenarioName]) {
  const choice = panel(table, entry);
  if (entry.name === 'この世界に愛を') await choice.getByRole('checkbox', { name: '楓', exact: true }).check();
  await click(table, views, choice.getByRole('button', { name: '使用する設定を宣言', exact: true }));
  await passUntil(table, views, () => setting(table, views, entry).enabled, 500);
}
for (const scenario of conditionalScenarioNames.slice(0, 1)) test(`${scenario}: actual ON/OFF controls survive reload and remain private`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, scenario);
  try {
    const views = await observe(table); const entry = entries[scenario]; const choice = panel(table, entry);
    await expect(choice).toContainText('使用しない設定です。');
    expect(setting(table, views, entry).enabled).toBe(false);
    await activate(table, views, entry);
    await table.pages[entry.seat]!.reload(); await expect(choice).toContainText('使用する設定を保持しています。');
    for (const [seat, page] of table.pages.entries()) if (seat !== entry.seat) {
      expect(views.get(table.sessions[seat]!.id)!.game!.conditionalAbilities.some(option => option.abilityId === entry.id)).toBe(false);
      await expect(page.getByRole('region', { name: '継続する特殊能力' }).getByRole('group', { name: entry.name, exact: true })).toHaveCount(0);
    }
    await passUntil(table, views, () => setting(table, views, entry).canDeactivate, 500);
    await click(table, views, choice.getByRole('button', { name: '使用しない設定に戻す', exact: true }));
    await expect(choice).toContainText('使用しない設定です。');
    const state = await (await request.get(`/__test/rooms/${table.roomId}/game`)).json() as GameState;
    const cards = allCardInstanceIds(state); expect(cards).toHaveLength(220); expect(new Set(cards).size).toBe(220);
  } finally { await table.close(); }
});

