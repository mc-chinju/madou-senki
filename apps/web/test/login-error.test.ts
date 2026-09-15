import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from '../src/login-error.js';

describe('login error messages', () => {
  it('maps Better Auth and Worker codes to Japanese without echoing server text', () => {
    expect(loginErrorMessage({ status: 400, code: 'INVALID_OTP', message: 'Invalid OTP' })).toBe('確認コードが正しくありません');
    expect(loginErrorMessage({ status: 400, code: 'OTP_EXPIRED' })).toContain('有効期限');
    expect(loginErrorMessage({ status: 403, code: 'TOO_MANY_ATTEMPTS' })).toContain('上限');
    expect(loginErrorMessage({ status: 502, error: 'EMAIL_SEND_FAILED' })).toContain('メールを送信できませんでした');
    expect(loginErrorMessage({ status: 400, code: 'DISPLAY_NAME_TAKEN' })).toContain('表示名は使われています');
  });

  it('treats any 429 as rate limiting and falls back to a generic message', () => {
    expect(loginErrorMessage({ status: 429, message: 'Too many requests. Please try again later.' })).toContain('しばらく待って');
    expect(loginErrorMessage({ status: 429, error: 'RATE_LIMITED' })).toContain('しばらく待って');
    expect(loginErrorMessage({ status: 500, message: 'internal detail' })).toBe('ログインできませんでした。もう一度お試しください');
    expect(loginErrorMessage(null)).toBe('ログインできませんでした。もう一度お試しください');
  });
});
