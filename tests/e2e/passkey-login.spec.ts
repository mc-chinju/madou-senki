import { test, expect } from '@playwright/test';
import { signIn } from './helpers.js';

test('registers a passkey, signs out, returns without email and is refused after deleting it', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL must be configured');
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const name = `鍵${Date.now().toString(36)}`;
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
      protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });

    await signIn(context, name);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: `ようこそ、${name}さん` })).toBeVisible();
    await page.getByRole('button', { name: 'パスキーを追加', exact: true }).click();
    const stored = page.getByRole('list', { name: '登録済みパスキー' }).getByRole('listitem');
    await expect(stored).toHaveCount(1);
    expect((await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials).toHaveLength(1);

    // The login screen's Conditional UI request is answered at once by the virtual authenticator
    // (automatic presence), so logging out lands back in the lobby without email.
    await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
    await expect(page.getByRole('heading', { name: `ようこそ、${name}さん` })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'この端末で次回からすぐ入る' })).toHaveCount(0);

    await page.getByRole('button', { name: /^パスキー「.+」を削除$/ }).click();
    await expect(stored).toHaveCount(0);
    await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'ログイン', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'パスキーでログイン', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('パスキーでログインできませんでした');
    await expect(page.getByRole('heading', { name: 'ログイン', exact: true })).toBeVisible();
  } finally { await context.close(); }
});
