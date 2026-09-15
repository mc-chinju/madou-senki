import { useEffect, useState, type FormEvent } from 'react';
import { AccountPanel } from '../account/AccountPanel.js';
import { api, getRooms, type ListedRoom, type Session } from '../session.js';

export function Lobby({ session, offerPasskey = false }: { session: Session; offerPasskey?: boolean }) {
  const [rooms, setRooms] = useState<ListedRoom[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { void getRooms().then(result => setRooms(result.rooms), reason => setError(reason instanceof Error ? reason.message : '卓一覧を取得できません')); }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const data = new FormData(event.currentTarget);
    try { const result = await api<{ roomId: string }>('/api/rooms', { method: 'POST', body: JSON.stringify({ title: data.get('title'), capacity: Number(data.get('capacity')), visibility: data.get('visibility'), rulesetId: 'second-online-v0.1-provisional' }) }); location.assign(`/rooms/${encodeURIComponent(result.roomId)}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '卓を作成できません'); setBusy(false); }
  }
  return <main id="main-content" className="page lobby-page">
    <section className="hero"><p className="eyebrow">2nd edition · online prototype</p><h1>ようこそ、{session.name}さん</h1><p>仲間の卓へ着席するか、新しい卓を用意してください。</p></section>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <div className="lobby-grid"><section className="panel" aria-labelledby="open-rooms"><h2 id="open-rooms">募集中の卓</h2>
      <div className="room-list">{rooms.length ? rooms.map(room => <article className="room-card" key={room.roomId}><div><h3>{room.title}</h3><p>{room.occupied} / {room.capacity}人 · 2nd</p></div><a className="button secondary" href={`/rooms/${encodeURIComponent(room.roomId)}`}>卓を見る</a></article>) : <p className="muted">現在、公開募集中の卓はありません。</p>}</div>
    </section><section className="panel"><h2>新しい卓</h2><form onSubmit={create} className="stack"><label>卓名<input name="title" required maxLength={60} defaultValue={`${session.name}の卓`} /></label><label>人数<select name="capacity" defaultValue="4">{Array.from({length:7},(_,i)=><option key={i+4}>{i+4}</option>)}</select></label><fieldset><legend>公開範囲</legend><label className="inline"><input type="radio" name="visibility" value="public" defaultChecked /> 公開</label><label className="inline"><input type="radio" name="visibility" value="private" /> 招待限定</label></fieldset><button disabled={busy}>{busy ? '作成中…' : '卓を作る'}</button></form></section></div>
    <AccountPanel offerPasskey={offerPasskey} />
  </main>;
}
