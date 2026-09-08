import type { PlayerView } from '@madou/engine';

export function FollowerEntrySummary({ entry, sources, names }: {
  entry: PlayerView['followerEntry']; sources: PlayerView['virtualFollowerDefense']; names: Record<string, string>;
}) {
  if (!entry && !sources.length) return null;
  return <section className="panel" aria-label="従者防御の準備"><h2>従者防御</h2>
    {entry ? <><p>{names[entry.targetId] ?? '対象者'}の従者登場前の能力を確認しています。通常防御へは戻れません。</p>
      <p>従者登場前の確認が終わった後に、残った攻撃を受ける従者とその値を確定します。</p>
      {entry.virtualGuardSelected ? <p>能力による仮想従者が選ばれています。取消や能力の無効があれば登場しません。</p> : null}</> : null}
    {sources.map(source => <div key={source.sourceId} className="panel"><h3>{names[source.targetId] ?? '対象者'}の{source.name}</h3>
      <p>能力による従者です。物理の札は増えません。手札への回収やカードとしての使用はできません。</p>
      <p>従者Lv {[...new Set(source.levels)].join(' / ')} · HP {source.hp} · 属性 {source.attributes.join('・')}</p>
      <p>士気判定はありません。従者無視を無効にし、同じ攻撃の各発を受けます。</p>
      {source.hits.length ? <p>処理済みの発: {source.hits.map(hit => `${hit.hitIndex + 1}発目（HP軽減 ${hit.hpReduction}）`).join('、')}</p> : <p>各発の従者防御を処理しています。</p>}
    </div>)}
  </section>;
}
