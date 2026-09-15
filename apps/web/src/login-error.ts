/** Error shape from the Better Auth client (`{ data, error }`) and from the Worker's own JSON errors. */
export interface AuthClientError { status?: number; code?: string | undefined; error?: string | undefined; message?: string | undefined }

const messages: Record<string, string> = {
  INVALID_OTP: '確認コードが正しくありません',
  OTP_EXPIRED: '確認コードの有効期限が切れました。コードを再送してください',
  TOO_MANY_ATTEMPTS: '確認コードの入力回数が上限に達しました。コードを再送してください',
  RATE_LIMITED: '試行回数が多すぎます。しばらく待ってからお試しください',
  EMAIL_SEND_FAILED: 'メールを送信できませんでした。時間をおいてもう一度お試しください',
  AUTH_UNAVAILABLE: 'ログインを一時的に利用できません。時間をおいてもう一度お試しください',
  DISPLAY_NAME_TAKEN: 'その表示名は使われています。別の表示名でコードを送り直してください',
  INVALID_DISPLAY_NAME: '初めての方は表示名（24文字以内）を入力して、コードを送り直してください',
  INVALID_EMAIL: 'メールアドレスを確認してください',
};

export function loginErrorMessage(error: AuthClientError | null | undefined): string {
  const code = error?.code ?? error?.error;
  if (code && messages[code]) return messages[code];
  if (error?.status === 429) return messages.RATE_LIMITED!;
  return 'ログインできませんでした。もう一度お試しください';
}
