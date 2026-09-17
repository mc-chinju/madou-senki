import { expect, test, type Locator } from '@playwright/test';
import { getAction } from '../../packages/catalog/src/index.js';
import { declarationScenarioSpecs, type DeclarationScenarioName } from '../../apps/worker/test/fixtures/declaration-scenarios.js';
import { observe, passUntil, tableFixture,storedDiscard} from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
function game(table: Table, views: Views, seat = 0) { return views.get(table.sessions[seat]!.id)!.game!; }
async function click(table: Table, views: Views, seat: number, button: Locator) {
  const owner = table.sessions[0]!.id;
  const revision = views.get(owner)!.revision;
  await button.click();
  await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
}
async function reload(table: Table, views: Views, seat = 0) {
  const before = structuredClone(game(table, views, seat));
  await table.pages[seat]!.reload();
  await expect(table.pages[seat]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
  expect(game(table, views, seat)).toEqual(before);
}
async function consumed(table: Table, views: Views, source: string, seat: number) {
  const done = game(table, views, seat);
  expect((await storedDiscard()).filter(id => id === source)).toHaveLength(1);
  expect(done.self.hand).not.toContain(source);
  expect(done.self.chants.map(card => card.cardInstanceId)).not.toContain(source);
  expect(done.self.followers.map(card => card.cardInstanceId)).not.toContain(source);
}
const cases = [
  { scenario: 'declare-shelim-waive', abilities: ['大魔術師'], effect: 7, damage: 10 },
  { scenario: 'declare-shelim-all', abilities: ['強化詠唱'], effect: 7, damage: 10, multiple: true },
  { scenario: 'declare-gil-range', abilities: ['拳圧'], effect: 4, damage: 38 },
  { scenario: 'declare-gil-counter', abilities: ['気闘術の奥義', '拳圧'], effect: 6, damage: 6 },
  { scenario: 'declare-shin-waive', abilities: ['居合抜き'], effect: 7, damage: 12 },
  { scenario: 'declare-shin-counter', abilities: ['ツバメ返し'], effect: 6, damage: 10 },
  { scenario: 'declare-shin-both', abilities: ['ツバメ返し', '居合抜き'], effect: 7, damage: 12 },
  { scenario: 'declare-fury-element', abilities: ['精霊を統べるもの'], effect: 8, damage: 15 },
  { scenario: 'declare-garwin-sword', abilities: ['剣匠'], effect: 5, damage: 7 },
  { scenario: 'declare-garwin-all', abilities: ['衝撃波'], effect: 7, damage: 12, multiple: true },
  { scenario: 'declare-garwin-follower-hand', abilities: ['剣匠'], effect: 6, damage: 14 },
  { scenario: 'declare-garwin-follower-placed', abilities: ['剣匠'], effect: 6, damage: 14 },
  { scenario: 'declare-gainas-waive', abilities: ['実力'], effect: 7, damage: 12 },
  { scenario: 'declare-gainas-all', abilities: ['黒龍の剣'], effect: 6, damage: 10, multiple: true },
  { scenario: 'declare-vanmil-warrior', abilities: ['破壊の神'], effect: 7, damage: 24, multiple: true },
  { scenario: 'declare-vanmil-magic', abilities: ['破壊の神'], effect: 10, damage: 15, multiple: true },
  { scenario: 'declare-vanmil-null', abilities: ['破壊の神'], effect: 10, damage: null, multiple: true },
] satisfies { scenario: DeclarationScenarioName; abilities: string[]; effect: number; damage: number | null; multiple?: boolean }[];
async function select(table: Table, views: Views, scenario: DeclarationScenarioName, multiple = false) {
  const spec = declarationScenarioSpecs[scenario];
  const defense = 'defense' in spec && spec.defense;
  const seat = defense ? 1 : 0;
  const owner = game(table, views, seat).self;
  const source = [...owner.hand, ...owner.chants.map(card => card.cardInstanceId), ...owner.followers.map(card => card.cardInstanceId)].find(id => getAction(id)?.name === spec.card)!;
  expect(source).toBeTruthy();
  const follower = getAction(source)?.category === 'follower';
  const page = table.pages[seat]!;
  let panel: Locator;
  let button: Locator;
  if (defense) {
    panel = page.getByRole('complementary', { name: '現在の判断' });
    await panel.getByRole('combobox', { name: '使うカード', exact: true }).selectOption(source);
    button = panel.getByRole('button', { name: '防御する', exact: true });
  } else if (follower) {
    panel = page.getByRole('region', { name: '従者による攻撃' });
    await panel.getByRole('combobox', { name: '攻撃に使う従者' }).selectOption(source);
    await panel.getByRole('checkbox', { name: '専用の攻撃として使う', exact: true }).check();
    button = panel.getByRole('button', { name: '従者で攻撃する', exact: true });
  } else {
    const chanted = 'chanted' in spec && spec.chanted;
    const zone = page.getByRole('region', { name: chanted ? '自分の詠唱' : '自分の手札' });
    await zone.getByRole('button', { name: chanted ? `${spec.card}を選ぶ` : spec.card, exact: true }).click();
    panel = page.getByRole('region', { name: '操作の確認' });
    for (const target of multiple ? [1, 2] : [1]) {
      await page.getByRole('region', { name: '参加者の公開状態' }).getByRole('article').filter({ has: page.getByRole('heading', { name: table.sessions[target]!.name, exact: true }) }).getByRole('checkbox', { name: '対象に選ぶ' }).check();
    }
    button = page.getByRole('button', { name: '攻撃を確認して実行', exact: true });
  }
  return { panel, button, source, seat, defense, follower };
}
for (const entry of cases) test(`${entry.scenario} selects the whole ability through the correct source controls`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table);
    const selected = await select(table, views, entry.scenario, 'multiple' in entry && entry.multiple);
    await expect(selected.button).toBeDisabled();
    for (const ability of entry.abilities) {
      const field = selected.panel.getByRole('checkbox', { name: ability, exact: false });
      await expect(field).not.toBeChecked();
      await field.check();
    }
    if (selected.follower) await selected.panel.getByRole('radio', { name: table.sessions[1]!.name, exact: true }).check();
    await expect(selected.button).toBeEnabled();
    await click(table, views, selected.seat, selected.button);
    expect(game(table, views, selected.seat).declarationSelection?.abilities.map(ability => ability.name)).toEqual(entry.abilities);
    await expect(table.pages[selected.seat]!.getByRole('region', { name: '選択した能力の進行' })).toBeVisible();
    for (let seat = 0; seat < 4; seat++) if (seat !== selected.seat) {
      expect(game(table, views, seat).declarationSelection).toBeNull();
      if (!game(table, views, selected.seat).players[table.sessions[selected.seat]!.id]!.revealed) {
        for (const ability of game(table, views, selected.seat).declarationSelection!.abilities) expect(JSON.stringify(game(table, views, seat))).not.toContain(ability.abilityId);
      }
      await expect(table.pages[seat]!.getByRole('region', { name: '選択した能力の進行' })).toHaveCount(0);
    }
    await reload(table, views, selected.seat);
    const attacker = table.sessions[selected.seat]!.id;
    await passUntil(table, views, state => state.currentAttack?.attackerId === attacker && state.activeWindow?.kind === 'normal-defense', 500);
    expect(game(table, views).currentAttack!.technique).toMatchObject({ effectLevel: entry.effect, damage: entry.damage });
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    const targets = selected.defense ? [0] : 'multiple' in entry && entry.multiple ? [1, 2] : [1];
    for (const seat of targets) expect(done.players[table.sessions[seat]!.id]!.damage).toBe(entry.damage ?? 0);
    if (selected.defense) expect(done.players[table.sessions[1]!.id]!.damage).toBe(0);
    if (entry.scenario === 'declare-shin-both') expect(done.recentRolls.filter(roll => roll.purpose === 'ability-check')).toHaveLength(2);
    await consumed(table, views, selected.source, selected.seat);
  } finally { await table.close(); }
});
for (const entry of [
  { scenario: 'declare-shelim-hidden-all', name: '強化詠唱' },
  { scenario: 'declare-garwin-unchanted-all', name: '衝撃波' },
  { scenario: 'declare-gainas-below', name: '黒龍の剣' },
] as const) test(`${entry.scenario} shows no unavailable expansion and does not submit an illegal target set`, async ({ browser, request }) => {
  const table = await tableFixture(browser, request, entry.scenario);
  try {
    const views = await observe(table);
    const selected = await select(table, views, entry.scenario, true);
    await expect(selected.panel.getByRole('checkbox', { name: entry.name })).toHaveCount(0);
    if (entry.scenario === 'declare-garwin-unchanted-all') await expect(selected.panel).toContainText('この札は先に詠唱する必要があります。');
    await expect(selected.button).toBeDisabled();
    expect(game(table, views).self.hand.includes(selected.source) || game(table, views).self.chants.some(card => card.cardInstanceId === selected.source)).toBe(true);
  } finally { await table.close(); }
});
for (const scenario of ['declare-shelim-waive', 'declare-shin-both', 'declare-vanmil-warrior'] as const) test(`${scenario} loses a necessary grant to Fate and resumes without refund`, async ({ browser, request }) => {
  const entry = cases.find(entry => entry.scenario === scenario)!;
  const table = await tableFixture(browser, request, scenario);
  try {
    const views = await observe(table);
    const selected = await select(table, views, scenario, 'multiple' in entry && entry.multiple);
    for (const ability of entry.abilities) await selected.panel.getByRole('checkbox', { name: ability, exact: false }).check();
    await click(table, views, selected.seat, selected.button);
    await passUntil(table, views, state => !!state.reactionTargetAbilityId && state.activeWindow?.pendingActorId === table.sessions[3]!.id, 500);
    const reaction = table.pages[3]!.getByRole('complementary', { name: '現在の判断' });
    await reaction.getByRole('combobox', { name: '割り込み効果', exact: true }).selectOption('cancel-ability');
    await reaction.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    await click(table, views, 3, reaction.getByRole('button', { name: '割り込みを使う', exact: true }));
    await reload(table, views, selected.seat);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[0]!.id]!.damage).toBe(0);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(selected.defense ? 6 : 0);
    expect(done.players[table.sessions[2]!.id]!.damage).toBe(0);
    await consumed(table, views, selected.source, selected.seat);
  } finally { await table.close(); }
});
test('Yotsurm displays a pending bound and rolls effect and damage separately', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'declare-yotsurm');
  try {
    const views = await observe(table);
    const selected = await select(table, views, 'declare-yotsurm');
    await expect(selected.button).toBeEnabled();
    await selected.panel.getByRole('checkbox', { name: '野獣', exact: false }).check();
    await expect(selected.panel).toContainText('効果Lvの上限 13（出目によって確定）');
    await expect(selected.panel).toContainText('効果Lvとは別に振る');
    await click(table, views, 0, selected.button);
    await passUntil(table, views, state => state.activeWindow?.kind === 'normal-defense', 500);
    const technique = structuredClone(game(table, views).currentAttack!.technique);
    expect(technique.effectLevel).toBeGreaterThanOrEqual(8);
    expect(technique.effectLevel).toBeLessThanOrEqual(13);
    expect(technique.damage).toBeGreaterThanOrEqual(7);
    expect(technique.damage).toBeLessThanOrEqual(12);
    const rolls = game(table, views).recentRolls.filter(roll => roll.purpose === 'ability-value');
    expect(rolls).toHaveLength(2);
    expect(rolls[0]!.rollId).not.toBe(rolls[1]!.rollId);
    expect(technique.effectLevel).toBe(7 + rolls[0]!.total!);
    expect(technique.damage).toBe(6 + rolls[1]!.total!);
    await reload(table, views);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    expect(done.players[table.sessions[1]!.id]!.damage).toBe(technique.damage);
    await consumed(table, views, selected.source, 0);
  } finally { await table.close(); }
});

test('Magic Gate selects its declaration ability and transfers the exact public position after reconnect', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'declare-shelim-gate');
  try {
    const views = await observe(table);
    const panel = table.pages[0]!.getByRole('region', { name: '魔招門による従者の取得' });
    await panel.getByRole('combobox', { name: '取得する従者', exact: true }).selectOption(`${table.sessions[1]!.id}:0`);
    await panel.getByRole('combobox', { name: '取得した従者の配置先', exact: true }).selectOption('0');
    const ability = panel.getByRole('checkbox', { name: '大魔術師', exact: false });
    await expect(ability).not.toBeChecked();
    await ability.check();
    await click(table, views, 0, panel.getByRole('button', { name: '魔招門を使う', exact: true }));
    expect(game(table, views).declarationSelection?.abilities.map(ability => ability.name)).toEqual(['大魔術師']);
    await reload(table, views);
    const done = await passUntil(table, views, state => !state.activeWindow, 500);
    const donor = table.expected!.players[table.sessions[1]!.id]!.followers[0]!.cardInstanceId;
    expect(done.self.followers[0]!.cardInstanceId).toBe(donor);
    expect(done.players[table.sessions[1]!.id]!.followers).toEqual([]);
    await consumed(table, views, 'a2-p17-r3c3', 0);
  } finally { await table.close(); }
});

test('changing a card mode clears the optional declaration selection', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'declare-shelim-waive');
  try {
    const views = await observe(table);
    const selected = await select(table, views, 'declare-shelim-waive');
    await selected.panel.getByRole('checkbox', { name: '大魔術師', exact: false }).check();
    await expect(selected.button).toBeEnabled();
    await selected.panel.getByRole('checkbox', { name: '専用技として使う', exact: true }).check();
    await selected.panel.getByRole('checkbox', { name: '専用技として使う', exact: true }).uncheck();
    await expect(selected.panel.getByRole('checkbox', { name: '大魔術師', exact: false })).not.toBeChecked();
    await expect(selected.button).toBeDisabled();
    expect(game(table, views).declarationSelection).toBeNull();
  } finally { await table.close(); }
});
