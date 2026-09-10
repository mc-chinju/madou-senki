import { getAction } from '@madou/catalog';
import type { PlayerView } from '@madou/engine';
import { calculationLabel } from './ActionCalculationSummary.js';

const effectNames: Record<string, string> = { 'spirit-conversion': '技の精神化', 'human-invalidation': '人の従者を無効', 'arnes-suppression': '公開済みの仮想女性親衛隊能力を無効' };
const rangeNames: Record<string, string> = { near: '近距離', far: '遠距離（近距離にも使用可）', none: '—' };
const stageNames: Record<string, string> = { declaration: '宣言の確認', checks: '使用判定',
  'check-result': '判定結果の確認', 'effect-level': '効果Lvの確定', damage: 'ダメージの確定', resolve: '防御・命中の解決' };
export function ActionSummary({ action, names }: { action: PlayerView['currentAction']; names: Record<string, string> }) {
  if (!action) return null;
  const armyParent=action.source==='card'&&action.cardInstanceId==='a2-p05-r2c2';
  const printedComponent=armyParent||action.source==='card'&&['a2-p05-r1c3','a2-p05-r2c1'].includes(action.cardInstanceId);
  return <section className="panel action-summary" aria-label="現在の行動"><h2>現在の行動</h2>
    <p>{stageNames[action.stage] ?? '処理中'}</p>
    <p>{names[action.actorId]} · {action.source === 'ability' ? action.label : action.source === 'follower' ? `${getAction(action.cardInstanceId)?.name ?? '従者'}による反射` : getAction(action.cardInstanceId)?.name ?? 'カード'} · 対象 {action.targetIds.map(id => names[id]).join('、')}</p>
    {action.source === 'card' && action.coSourceCardInstanceId ? <p>組み合わせた技: {getAction(action.coSourceCardInstanceId)?.name ?? 'カード'}</p> : null}
    {action.source === 'card' && action.sourceZone === 'followers' ? <p>配置中の従者を使用。従者の列から外れ、使用後は捨て札になります。</p> : null}
    {action.source === 'card' && action.coSourceZone === 'followers' ? <p>組み合わせた従者も配置から外れ、使用後は捨て札になります。</p> : null}
    {action.source === 'ability' && action.abilityEffectIds?.length ? <p>選んだ効果: {action.abilityEffectIds.map(id => effectNames[id] ?? id).join('、')}</p> : null}
    {printedComponent?<p>{armyParent?'全軍突撃の使用を確認しています。成立後、支払った従者の攻撃宣言へ進みます。':'複合札の使用を確認しています。この札の処理後、組み合わせた技へ戻ります。'}</p>:null}
    {!printedComponent&&action.technique ? <p>{action.technique.school === 'warrior' ? '戦士技' : action.technique.school === 'magic' ? '魔法技' : '技'} · 属性 {action.technique.attributes.join('・')}</p> : null}
    {!printedComponent&&action.technique ? <p>射程 {rangeNames[action.technique.range] ?? '—'} / 使用値 {action.technique.useLevel}
      {action.technique.effectLevel === undefined ? '' : ` / 効果値 ${action.technique.effectLevel}${calculationLabel(action.technique.calculation?.effectLevel)}`}
      {action.technique.damage === undefined ? '' : ` / ダメージ ${action.technique.damage ?? 'なし'}${calculationLabel(action.technique.calculation?.damage)}`}</p> : null}
  </section>;
}
