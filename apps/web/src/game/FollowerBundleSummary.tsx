import { getAction } from '@madou/catalog';
import type { PlayerView } from '@madou/engine';
import { calculationLabel } from './ActionCalculationSummary.js';

const stageLabels: Record<string, string> = { reserved: '準備待ち', declaration: '使用宣言', checks: '使用判定', 'check-result': '判定結果の確認',
  'effect-level': '効果Lvの計算', damage: 'ダメージ計算', resolve: '攻撃値確定', failed: '不成立' };
const rangeLabels: Record<string, string> = { near: '近距離', far: '遠距離' };
const schoolLabels: Record<string, string> = { warrior: '武技', magic: '魔法' };
export function FollowerBundleSummary({ bundle, names }: { bundle: PlayerView['followerBundle']; names: Record<string, string> }) {
  if (!bundle) return null;
  return <section className="panel" aria-label="同時に使っている従者"><h2>{names[bundle.actorId]}の従者攻撃</h2>
    <p>{bundle.stage === 'grant' ? '能力の使用を確認しています。能力が取り消されると、選んだ技は全て不成立になります。'
      : 'それぞれの札の技を処理します。個別の技が不成立になっても、他の技は続きます。'}</p>
    <ol>{bundle.sources.map((source, index) => <li key={source.cardInstanceId} aria-current={bundle.currentSourceIndex === index ? 'step' : undefined}>
      <strong>{getAction(source.cardInstanceId)?.name ?? '従者'}</strong>（{source.sourceZone === 'followers' ? '配置から使用' : '手札から使用'}）
      {' · '}{stageLabels[source.stage] ?? source.stage}{bundle.currentSourceIndex === index ? ' · 現在の技' : ''}
      <p>対象 {source.targetIds.map(id => names[id] ?? '参加者').join('、')}</p>
      <p>{rangeLabels[source.technique.range] ?? source.technique.range} · {schoolLabels[source.technique.school] ?? source.technique.school}
        {' · '}属性 {source.technique.attributes.length ? source.technique.attributes.join('・') : 'なし'}
        {' · '}使用Lv {source.technique.useLevel} · 効果Lv {source.technique.effectLevel}{calculationLabel(source.technique.calculation?.effectLevel)}
        {' · '}ダメージ {source.technique.damage ?? (source.technique.calculation?.damage === 'final' ? 'なし' : '未確定')}{calculationLabel(source.technique.calculation?.damage)} · {source.technique.hitCount}回攻撃</p>
      {source.stage !== 'resolve' && source.stage !== 'failed' ? <p>準備中の値です。確定値ではありません。</p> : null}
    </li>)}</ol>
  </section>;
}
