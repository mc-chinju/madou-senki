import type { PublicPlayerView } from '@madou/engine';

type PendingPlayer = Pick<PublicPlayerView, 'id' | 'name' | 'pendingFatal'>;
export function PendingFatalNotice({ players }: { players: PendingPlayer[] }) {
  const pending = players.filter(player => player.pendingFatal);
  if (!pending.length) return null;
  return <section className="panel" aria-label="保留中の死亡効果" aria-live="polite" aria-atomic="true">
    <h2>保留中の死亡効果</h2>
    <ul>{pending.map(player => <li key={player.id}>{player.name}さんへの死亡効果が確定しています。</li>)}</ul>
    <p>宣言済みの攻撃を解決した後、死亡時の処理へ進みます。</p>
  </section>;
}
