import type { PlayerView } from '@madou/engine';

type CurrentGoalsProps = Pick<PlayerView['self'], 'objective' | 'currentObjective' | 'defeatCondition'>;
export function CurrentGoals({ objective, currentObjective, defeatCondition }: CurrentGoalsProps) {
  return <section aria-label="現在の勝利・敗北条件">
    <h3>現在の条件</h3>
    <p>勝利条件: {objective}</p>
    <p>対象陣営: {currentObjective.enemyFactions.join('・')}</p>
    <p>敗北条件: {defeatCondition || 'なし'}</p>
  </section>;
}
