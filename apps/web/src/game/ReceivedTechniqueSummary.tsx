import type { PlayerView } from '@madou/engine';
import { getAction } from '@madou/catalog';

/** Received numbers are authoritative per-target projections, never browser recalculations. */
export function ReceivedTechniqueSummary({ attack, names }: { attack: PlayerView['currentAttack']; names: Record<string, string> }) {
  if (!attack) return null;
  return <section className="panel" aria-label="各対象が受ける技"><h2>各対象が受ける技</h2>
    {attack.reflection ? <p>{names[attack.reflection.actorId] ?? '参加者'}さんが{getAction(attack.reflection.sourceCardInstanceId)?.name ?? '元の技'}を跳ね返しています。元の攻撃札を追加で消費することはありません。</p> : null}
    <p>対象ごとの補正を含む、現在の処理時点の値です。通常防御中のダメージは、従者のHPで軽減する前の値です。</p>
    <ul aria-live="polite" aria-atomic="true">{attack.targets.flatMap(target => target.hits.map(hit => hit.technique ? <li key={`${target.actorId}:${hit.index}`}>
      <strong>{names[target.actorId] ?? '参加者'}さん・{hit.index + 1}発目</strong>
      {hit.bodyDamage ? <>
        <p>効果Lv {hit.technique.effectLevel} / 本人への確定ダメージ {hit.bodyDamage.total}</p>
        <p>技による損傷 {hit.bodyDamage.directDamage ?? 'なし'} / 抵抗失敗による追加 {hit.bodyDamage.resistanceDamage}</p>
      </> : <p>効果Lv {hit.technique.effectLevel} / ダメージ {hit.technique.damage ?? 'なし'}</p>}
      {hit.defended ? <p>防御済み</p> : null}
    </li> : null))}</ul>
  </section>;
}
