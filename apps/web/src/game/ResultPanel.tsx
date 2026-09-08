import type { PlayerView } from '@madou/engine';

export const presenceLabels: Record<PlayerView['players'][string]['presence'], string> = {
  active: '参加中', 'pending-death': '死亡処理中', dead: '死亡', wandering: '流浪', otherworld: '異界', exited: '退場',
};
const resultLabels = { won: '勝利', lost: '敗北', draw: '引き分け' } as const;
const reasonLabels = {
  objectives: '勝利条件が満たされました。',
  'mutual-extinction': '双方が同時に全滅し、勝者なしの引き分けとなりました。',
  stalemate: '進行不能による引き分け',
  'vanmil-death': 'ヴァンミールの死亡による特別な勝利条件で決着しました。',
} as const;
export function ResultPanel({ view }: { view: PlayerView }) {
  const result = view.outcome;
  if (!result) {
    const winners = Object.keys(view.individualResults);
    return winners.length ? <section className="panel" aria-label="個人の勝利"><h2>個人の勝利</h2>
      <p>{winners.map(id => view.players[id]?.name ?? '参加者').join('、')}さんが勝利して退場しました。他の参加者の対戦は続きます。</p>
    </section> : null;
  }
  return <section className="panel game-result" aria-label="対戦結果"><h2>{result.kind === 'draw' ? '引き分け' : '対戦終了'}</h2>
    <p role="status">{reasonLabels[result.reason]}</p>
    <ul>{view.seatOrder.map(id => <li key={id}><strong>{view.players[id]?.name}</strong> · {resultLabels[result.results[id] ?? 'lost']}</li>)}</ul>
    <p>結果はこの卓に保存されています。</p><a className="button" href="/">卓一覧へ戻る</a>
  </section>;
}
