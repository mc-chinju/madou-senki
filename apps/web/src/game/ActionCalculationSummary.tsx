import { getAction } from '@madou/catalog';
import type { PlayerView } from '@madou/engine';

export function calculationLabel(status?: 'pending' | 'final'): string {
  return status === 'pending' ? '（計算中）' : status === 'final' ? '（確定）' : '';
}

/** Keep the public parent visible during a child without duplicating its normal action panel. */
export function ActionCalculationSummary({ value, currentAction, names }: {
  value: PlayerView['actionCalculation']; currentAction: PlayerView['currentAction']; names: Record<string, string>;
}) {
  if (!value || currentAction?.source !== 'ability' && currentAction?.actionId === value.actionId) return null;
  return <section className="panel" aria-label="計算中の技"><h2>計算中の技</h2>
    <p>{names[value.actorId]} · {getAction(value.cardInstanceId)?.name ?? '技'}</p>
    <p>効果Lv {value.effectLevel}{calculationLabel(value.calculation.effectLevel)} / ダメージ {value.damage ?? 'なし'}{calculationLabel(value.calculation.damage)}</p>
  </section>;
}
