export interface OtpEmail { subject: string; text: string; html: string }

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);
}

/** Login code mail. It carries no URL so a forwarded or phished copy cannot sign anyone in by clicking. */
export function otpEmail(otp: string): OtpEmail {
  const notice = 'このコードは5分間有効です。心当たりがない場合は、このメールを破棄してください。';
  return {
    subject: '魔導戦記 ログイン確認コード',
    text: `魔導戦記のログイン確認コード: ${otp}\n\n${notice}\n`,
    html: `<p>魔導戦記のログイン確認コード</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${escapeHtml(otp)}</p><p>${escapeHtml(notice)}</p>`,
  };
}
