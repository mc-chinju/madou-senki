import { useEffect, useState } from 'react';
import { addPasskey, deletePasskey, listPasskeys, signOut } from '../auth-client.js';

interface StoredPasskey { id: string; name?: string | null | undefined; createdAt?: Date | string | null | undefined }

/** Passkeys for this account and logout. After a code login the panel first offers to register this device. */
export function AccountPanel({ offerPasskey }: { offerPasskey: boolean }) {
  const [passkeys, setPasskeys] = useState<StoredPasskey[]>([]); const [offer, setOffer] = useState(offerPasskey);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await listPasskeys();
    setPasskeys((data ?? []) as StoredPasskey[]);
  }
  useEffect(() => { void refresh(); }, []);

  async function add() {
    setBusy(true); setError('');
    const { error: failure } = await addPasskey();
    setBusy(false);
    if (failure) {
      setError(failure.status === 401 || failure.status === 403
        ? 'パスキーを追加するには、確認コードでログインし直してください'
        : 'パスキーを登録できませんでした');
      return;
    }
    setOffer(false); await refresh();
  }
  async function remove(id: string) {
    setBusy(true); setError('');
    const { error: failure } = await deletePasskey(id);
    setBusy(false);
    if (failure) { setError('パスキーを削除できませんでした'); return; }
    await refresh();
  }
  async function logout() {
    setBusy(true);
    await signOut();
    location.assign('/');
  }

  return <>
    {offer ? <section className="panel quiet" aria-labelledby="passkey-offer"><h2 id="passkey-offer">この端末で次回からすぐ入る</h2>
      <p>パスキーを登録すると、次回はメールを待たずにログインできます。</p>
      <div className="button-row"><button disabled={busy} onClick={() => void add()}>パスキーを登録</button><button className="secondary" disabled={busy} onClick={() => setOffer(false)}>あとで</button></div>
    </section> : null}
    <section className="panel quiet" aria-labelledby="account-heading"><h2 id="account-heading">アカウント</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <h3>パスキー</h3>
      {passkeys.length
        ? <ul className="member-list" aria-label="登録済みパスキー">{passkeys.map(key => <li key={key.id}><span>{key.name || 'パスキー'}</span><span className="muted">{key.createdAt ? new Date(key.createdAt).toLocaleDateString('ja-JP') : ''}</span><button className="secondary" disabled={busy} aria-label={`パスキー「${key.name || 'パスキー'}」を削除`} onClick={() => void remove(key.id)}>削除</button></li>)}</ul>
        : <p className="muted">登録済みのパスキーはありません。</p>}
      <div className="button-row"><button className="secondary" disabled={busy} onClick={() => void add()}>パスキーを追加</button><button className="secondary" disabled={busy} onClick={() => void logout()}>ログアウト</button></div>
    </section>
  </>;
}
