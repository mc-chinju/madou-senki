import { test, expect, type Page } from '@playwright/test';

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function readCode(page: Page, email: string): Promise<string> {
  let otp = '';
  await expect.poll(async () => {
    const response = await page.request.get(`/__test/otp?email=${encodeURIComponent(email)}`);
    if (response.ok()) otp = (await response.json()).otp;
    return otp;
  }).toMatch(/^\d{6}$/);
  return otp;
}

async function requestCode(page: Page, email: string, name: string) {
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('表示名').fill(name);
  await page.getByRole('button', { name: '確認コードを送信', exact: true }).click();
}

test('unauthenticated visitors see the login screen and cannot take a seat', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL must be configured');
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  try {
    for (const path of ['/', `/rooms/${crypto.randomUUID()}`]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'ログイン', exact: true })).toBeVisible();
    }
    const join = await page.request.post(`/api/rooms/${crypto.randomUUID()}/join`, { data: {}, headers: { Origin: baseURL } });
    expect(join.status()).toBe(401);
    expect((await page.request.post('/api/sessions', { data: { name: 'ゲスト' }, headers: { Origin: baseURL } })).status()).toBe(404);
  } finally { await context.close(); }
});

test('registers with an emailed code, keeps the saved name on return and refuses a taken name', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL must be configured');
  const id = unique();
  const email = `login-${id}@example.com`;
  const name = `登録${id}`.slice(0, 24);
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await requestCode(page, email, name);
    const codeField = page.getByLabel('確認コード');
    await expect(codeField).toBeVisible();
    await expect(codeField).toHaveAttribute('autocomplete', 'one-time-code');
    await expect(codeField).toHaveAttribute('inputmode', 'numeric');
    await expect(page.getByRole('button', { name: /^再送まで\d+秒$/ })).toBeDisabled();
    await codeField.fill(await readCode(page, email));
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await expect(page.getByRole('heading', { name: `ようこそ、${name}さん` })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'この端末で次回からすぐ入る' })).toBeVisible();
    await page.getByRole('button', { name: 'あとで', exact: true }).click();

    await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'ログイン', exact: true })).toBeVisible();
    expect((await page.request.delete(`/__test/otp?email=${encodeURIComponent(email)}`)).status()).toBe(204);
    await requestCode(page, email, '別の名前');
    await page.getByLabel('確認コード').fill(await readCode(page, email));
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await expect(page.getByRole('heading', { name: `ようこそ、${name}さん` })).toBeVisible();
  } finally { await context.close(); }

  const other = await browser.newContext({ baseURL });
  const second = await other.newPage();
  try {
    const otherEmail = `taken-${id}@example.com`;
    await second.goto('/');
    await requestCode(second, otherEmail, name);
    await second.getByLabel('確認コード').fill(await readCode(second, otherEmail));
    await second.getByRole('button', { name: 'ログイン', exact: true }).click();
    await expect(second.getByRole('alert')).toContainText('その表示名は使われています');
    await expect(second.getByLabel('メールアドレス')).toBeVisible();
  } finally { await other.close(); }
});
