import { useEffect, useState, type FormEvent } from 'react';
import { sendLoginCode, signInWithPasskey, verifyLoginCode } from '../auth-client.js';
import { loginErrorMessage } from '../login-error.js';
import { getCurrentSession, type Session } from '../session.js';

const RESEND_SECONDS = 60;

/** Email + display name, then a single 6-digit field. The copy never says whether the email is registered. */
export function LoginScreen({ startupError, onSignedIn }: { startupError: string; onSignedIn: (session: Session, viaCode: boolean) => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [code, setCode] = useState('');
  const [error, setError] = useState(startupError); const [busy, setBusy] = useState(false); const [cooldown, setCooldown] = useState(0);

  useEffect(() => { if (cooldown <= 0) return; const timer = setTimeout(() => setCooldown(value => value - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);

  async function finish(viaCode: boolean) {
    try { onSignedIn(await getCurrentSession(), viaCode); }
    catch (reason) { setBusy(false); setError(reason instanceof Error ? reason.message : 'ログイン状態を確認できません'); }
  }

  // Conditional UI: a saved passkey is offered from the email field's autofill.
  useEffect(() => {
    let active = true;
    void (async () => {
      if (typeof PublicKeyCredential === 'undefined' || !await PublicKeyCredential.isConditionalMediationAvailable?.()) return;
      const { data } = await signInWithPasskey(true);
      if (active && data) await finish(false);
    })();
    return () => { active = false; };
  }, []);

  async function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setBusy(true); setError('');
    const { error: failure } = await sendLoginCode(email.trim());
    setBusy(false);
    if (failure) { setError(loginErrorMessage(failure)); return; }
    setStep('code'); setCode(''); setCooldown(RESEND_SECONDS);
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const { error: failure } = await verifyLoginCode(email.trim(), code, name);
    if (!failure) { await finish(true); return; }
    setBusy(false); setError(loginErrorMessage(failure));
    if (failure.code === 'DISPLAY_NAME_TAKEN' || failure.code === 'INVALID_DISPLAY_NAME') setStep('email');
  }
  async function passkey() {
    setBusy(true); setError('');
    const { data } = await signInWithPasskey();
    if (data) { await finish(false); return; }
    setBusy(false); setError('パスキーでログインできませんでした。確認コードでログインしてください');
  }
  const resendLabel = cooldown > 0 ? `再送まで${cooldown}秒` : null;

  return <main id="main-content" className="page narrow"><section className="panel name-entry">
    <p className="eyebrow">2nd edition</p><h1>ログイン</h1>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {step === 'email'
      ? <form className="stack" onSubmit={event => void send(event)}>
        <p>メールアドレスに届く6桁の確認コードでログインします。はじめての方はここで登録されます。</p>
        <label>メールアドレス<input name="email" type="email" required maxLength={254} autoComplete="username webauthn" value={email} onChange={event => setEmail(event.target.value)} autoFocus /></label>
        <label>表示名（初回のみ）<input name="name" maxLength={24} autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} /></label>
        <p className="hint">卓で他の参加者に見える名前です。登録済みの方は入力しても変わりません。</p>
        <button disabled={busy || cooldown > 0}>{resendLabel ?? '確認コードを送信'}</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void passkey()}>パスキーでログイン</button>
      </form>
      : <form className="stack" onSubmit={event => void verify(event)}>
        <p role="status">{email.trim()} に確認コードを送りました。有効期限は5分です。</p>
        <label>確認コード<input name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} autoFocus /></label>
        <button disabled={busy || code.length !== 6}>ログイン</button>
        <div className="button-row">
          <button type="button" className="secondary" disabled={busy || cooldown > 0} onClick={() => void send()}>{resendLabel ?? 'コードを再送'}</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => { setStep('email'); setCode(''); setError(''); }}>別のメールアドレスを使用する</button>
        </div>
      </form>}
  </section></main>;
}
