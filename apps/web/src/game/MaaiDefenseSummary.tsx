import type { PlayerView } from '@madou/engine';

export function MaaiDefenseSummary({ progress, names }: { progress: PlayerView['maaiDefense']; names: Record<string, string> }) {
  if (!progress) return null;
  return <section className="panel" aria-label="間合いの状況">
    <h2>間合いの状況</h2>
    <div aria-live="polite" aria-atomic="true">
      <p>{progress.responding ? `${names[progress.attackerId] ?? '攻撃者'}さんの踏み込みの判断待ち` : `${names[progress.targetId ?? ''] ?? '防御者'}さんの防御`}</p>
      {progress.responding ? <p>今回の踏み込み{progress.sharedAdvances}枚は全対象で共有します。</p> : null}
      <ul>{progress.targets.map(target => <li key={`${target.actorId}:${target.hitIndex}`}>
        <strong>{names[target.actorId] ?? '参加者'}さん・{target.hitIndex + 1}発目</strong>
        {target.closed ? <p>この発の通常防御は終了しています。</p> : target.prohibited ? <p>間合いで回避できません。</p> : <>
          <p>必要{target.required}枚・有効{target.effective}枚・あと{target.remaining}枚</p>
          {target.advanceFactor===2?<p>間合い1枚を打ち消すには踏み込み2枚が必要です。</p>:target.advanceFactor===null?<p>この間合いは踏み込みで打ち消せません。</p>:null}
          <p>前の応酬から有効な間合い{target.carried}枚、今回出した間合い{target.submitted}枚。</p>
          {target.remaining === 0 ? <p>踏み込みの応答が終わるまで、回避はまだ確定していません。</p> : null}
        </>}
      </li>)}</ul>
    </div>
    <p>踏み込みが打ち消すのは今回出した間合いです。使用した札は戻らず、距離関係も変わりません。</p>
  </section>;
}
