import { getAction } from '@madou/catalog';
import type { PlayerView } from '@madou/engine';

type Result = PlayerView['followerDefenseResults'][number];
const outcomes: Record<Result['hits'][number]['outcome'], string> = {
  'morale-failed': '士気判定失敗', 'passed-through': '通過',
  'attribute-destroyed': '属性による破壊', 'level-destroyed': '効果による破壊',
  blocked: '防御成功', 'equal-destroyed': '同値で防御して破壊', 'lower-destroyed': '突破されて破壊',
  'earth-nullified': '地の魔法を無効化', reflected: '反射',
};
export function FollowerDestructionSummary({ attack, results, names }: {
  attack: PlayerView['currentAttack']; results: PlayerView['followerDefenseResults']; names: Record<string, string>;
}) {
  const effects = attack?.targets.flatMap(target => target.hits.flatMap(hit => {
    const technique = hit.technique;
    return !hit.defended && technique && (technique.destructionEffects.length || technique.beastIgnore) ? [{ targetId: target.actorId, hit, technique }] : [];
  })) ?? [];
  if (!effects.length && !results.length) return null;
  return <section className="panel" aria-label="従者への攻撃と結果" aria-live="polite">
    <h2>従者への攻撃と結果</h2>
    {effects.length ? <><h3>現在の攻撃効果</h3><ul>{effects.map(({ targetId, hit, technique }) => <li key={`${targetId}:${hit.index}`}>
      {names[targetId]}への{hit.index + 1}発目{hit.sourceCardInstanceId ? `・${getAction(hit.sourceCardInstanceId)?.name ?? '使用した技'}` : ''}：ダメージ {technique.damage ?? 'なし'}
      <ul>{technique.beastIgnore ? <li>獣属性の従者を無視</li> : null}{technique.destructionEffects.map(effect => <li key={effect}>{effect}</li>)}</ul>
    </li>)}</ul></> : null}
    {results.length ? <><h3>到達した従者の結果</h3>{results.map(result => <article key={`${result.targetId}:${result.source}:${result.position}`}>
      <h4>{names[result.targetId]}：{result.source === 'virtual' ? '仮想女性親衛隊' : result.cardInstanceId ? getAction(result.cardInstanceId)?.name ?? '公開された従者' : `裏向きの従者（${result.position + 1}番目）`}</h4>
      <ul>{result.hits.map(hit => <li key={hit.hitIndex}>{hit.hitIndex + 1}発目：{outcomes[hit.outcome]}・HP軽減 {hit.hpReduction}</li>)}</ul>
    </article>)}</> : null}
  </section>;
}
