import { expect, test, type Locator } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

const BAN = 'c2-p07-r1c2-ab03', BLESS = 'c2-p03-r1c2-ab04';
type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
async function click(table: Table, views: Views, button: Locator) {
  const owner = table.sessions[0]!.id; const revision = views.get(owner)!.revision;
  await button.click();
  await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
}
async function toLiaTurn(table: Table, views: Views) {
  const owner = table.sessions[0]!.id;
  for (const index of [0, 1]) {
    const page = table.pages[index]!;
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    if (views.get(owner)!.game!.phase === 'turn-start') {
      await click(table, views, button('手番を始める'));
      await passUntil(table, views, game => !game.activeWindow);
      await click(table, views, button('カードを引かない'));
      await passUntil(table, views, game => !game.activeWindow);
    }
    if (views.get(owner)!.game!.phase === 'action') await click(table, views, button('行動を終える'));
    if (views.get(owner)!.game!.phase === 'withdrawal') await click(table, views, button('離脱しない'));
    const own = views.get(table.sessions[index]!.id)!.game!.self;
    const required = Math.max(0, own.hand.length - own.stats.handLimit);
    const cards = page.getByRole('region', { name: '自分の手札' }).locator('button.card-face');
    for (let i = 0; i < required; i++) await cards.nth(i).click();
    await click(table, views, button(`選んだ${required}枚を捨てて手番を終える`));
    await passUntil(table, views, game => !game.activeWindow);
  }
  await click(table, views, table.pages[2]!.getByRole('button', { name: '手番を始める', exact: true }));
  await passUntil(table, views, game => !game.activeWindow);
  await click(table, views, table.pages[2]!.getByRole('button', { name: 'カードを引かない', exact: true }));
  await passUntil(table, views, game => !game.activeWindow);
}

test('ritual-born Vanmil designates multiple public names, and Blessing survives reload with its actual roll', async ({ browser, request }, testInfo) => {
  test.setTimeout(90000);
  const table = await tableFixture(browser, request, 'suppression-blessing');
  try {
    const views = await observe(table); const [a, b, c] = table.sessions.map(session => session.id);
    const panel = table.pages[0]!.getByRole('region', { name: '能力の禁止と祝福' });
    expect(views.get(a!)!.game!.abilityOptions.find(o=>o.abilityId===BAN)!.targetIds).toEqual(table.sessions.map(session=>session.id));
    await expect(panel.getByRole('checkbox',{name:'凛',exact:true})).toBeVisible();
    await click(table,views,table.pages[2]!.getByRole('button',{name:'正体を公開',exact:true}));await passUntil(table,views,g=>!g.activeWindow);
    for(const page of table.pages)await page.reload();
    expect(views.get(a!)!.game!.abilityOptions.find(o=>o.abilityId===BAN)!.targetIds).toEqual(table.sessions.filter((_,i)=>i!==2).map(session=>session.id));
    await expect(panel.getByRole('checkbox',{name:'凛',exact:true})).toHaveCount(0);
    await expect(panel.getByRole('button', { name: '神と人の差を使う', exact: true })).toBeDisabled();
    await panel.getByRole('checkbox', { name: '楓', exact: true }).check();
    await panel.getByRole('checkbox', { name: '蓮', exact: true }).check();
    await click(table, views, panel.getByRole('button', { name: '神と人の差を使う', exact: true }));
    await table.pages[0]!.reload();
    await expect(table.pages[0]!.getByRole('region', { name: '現在の行動' })).toContainText('神と人の差');
    await passUntil(table, views, game => !game.activeWindow);
    for(const page of table.pages)await page.reload();
    await expect(panel).toContainText('楓：指定済み・適用状況は非公開');
    await expect(panel).toContainText('蓮：指定済み・適用状況は非公開');
    const targetPanel = table.pages[1]!.getByRole('region', { name: '能力の禁止と祝福' });
    await expect(targetPanel).toContainText('楓：指定済み・特殊能力を使用できません');
    expect(views.get(a!)!.game!.players[b!]!.characterId).toBeUndefined();
    await table.pages[1]!.reload();
    await expect(targetPanel).toContainText('特殊能力を使用できません');
    await toLiaTurn(table, views);
    const blessing = table.pages[2]!.getByRole('region', { name: '能力の禁止と祝福' });
    await expect(blessing).toContainText('精神力−5');
    await blessing.getByLabel('祝福する対象').selectOption(b!);
    await click(table, views, blessing.getByRole('button', { name: '祝福を使う', exact: true }));
    const rolled = await passUntil(table, views, game => game.currentRoll?.stage === 'after-roll' && game.currentRoll.purpose === 'ability-check');
    const faces = rolled.currentRoll!.faces; expect(faces).toHaveLength(2);
    await table.pages[2]!.reload();
    await expect(table.pages[2]!.getByRole('region', { name: 'サイコロの結果' })).toBeVisible();
    expect(views.get(c!)!.game!.currentRoll!.faces).toEqual(faces);
    await passUntil(table, views, game => !game.activeWindow);
    await expect(targetPanel).toContainText('ヴァンミール由来の禁止は解除されています');
    expect(views.get(c!)!.game!.abilityOptions.some(option => option.abilityId === BLESS)).toBe(false);
    await table.pages[1]!.reload();
    await expect(targetPanel).toContainText('ヴァンミール由来の禁止は解除されています');
    const path = testInfo.outputPath('suppression.png');
    await table.pages[1]!.screenshot({ path, fullPage: true });
    await testInfo.attach('suppression after Blessing', { path, contentType: 'image/png' });
  } finally { await table.close(); }
});

test('Fate cancels a multiple-target declaration without returning that public opportunity', async ({ browser, request }) => {
  const table = await tableFixture(browser, request, 'suppression-blessing');
  try {
    const views = await observe(table); const a = table.sessions[0]!.id, d = table.sessions[3]!.id;
    const original = views.get(a)!.game!.abilityOptions.find(option => option.abilityId === BAN)!;
    const panel = table.pages[0]!.getByRole('region', { name: '能力の禁止と祝福' });
    await panel.getByRole('checkbox', { name: '楓', exact: true }).check();
    await panel.getByRole('checkbox', { name: '蓮', exact: true }).check();
    await click(table, views, panel.getByRole('button', { name: '神と人の差を使う', exact: true }));
    await passUntil(table, views, game => game.activeWindow?.pendingActorId === d);
    await table.pages[3]!.getByLabel('割り込み効果').selectOption('cancel-ability');
    await table.pages[3]!.getByRole('combobox', { name: '使うカード', exact: true }).selectOption('a2-p02-r2c3');
    await click(table, views, table.pages[3]!.getByRole('button', { name: '割り込みを使う', exact: true }));
    await passUntil(table, views, game => !game.activeWindow);
    expect(views.get(a)!.game!.suppressionTargets).toEqual([]);
    expect(views.get(a)!.game!.abilityOptions.some(option => option.abilityId === BAN && option.targetEventId === original.targetEventId)).toBe(false);
    await table.pages[0]!.reload();
    await expect(table.pages[0]!.getByRole('region', { name: '自分の手札' })).toBeVisible();
    expect(views.get(a)!.game!.suppressionTargets).toEqual([]);
    expect(views.get(d)!.game!.self.hand).not.toContain('a2-p02-r2c3');
  } finally { await table.close(); }
});

test('Vanmil can still end his unused main action after actual next-turn ban and all-seat reload',async({browser,request})=>{
  const table=await tableFixture(browser,request,'suppression-next-action');
  try{
    const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[0]!;
    expect(views.get(a)!.game!.phase).toBe('action');
    const panel=page.getByRole('region',{name:'能力の禁止と祝福'});
    await panel.getByRole('checkbox',{name:'楓',exact:true}).check();await click(table,views,panel.getByRole('button',{name:'神と人の差を使う',exact:true}));
    await passUntil(table,views,g=>!g.activeWindow);
    for(const [seat,p] of table.pages.entries()){await p.reload();const g=views.get(table.sessions[seat]!.id)!.game!;expect(g.phase).toBe('action');expect(g.suppressionTargets.map(d=>d.targetId)).toEqual([b]);}
    expect(views.get(a)!.game!.legalChoices).toContain('PASS_ACTION');
    await click(table,views,page.getByRole('button',{name:'行動を終える',exact:true}));
    for(const [seat,p] of table.pages.entries()){await p.reload();expect(views.get(table.sessions[seat]!.id)!.game!.phase).toBe('hand-adjustment');}
  }finally{await table.close();}
});
