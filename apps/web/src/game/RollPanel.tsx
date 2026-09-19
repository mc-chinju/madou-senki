import type { PlayerView, PublicRollView } from '@madou/engine';

export const purposeNames: Record<PublicRollView['purpose'], string> = {
  'faction-change':'陣営変更への抵抗','card-inspection':'遠見の判定',
  training:'修行の判定','extra-draw':'秘伝書の追加枚数',
  'technique-check': '技の追加判定', 'technique-value': '技のサイコロ', 'hit-resistance': '命中時の抵抗判定',
  'ability-check': '特殊能力の判定', 'ability-value': '特殊能力のサイコロ',
  'stop-duration': '停止する手番数',
  revival: '伏線の復活判定', activation: '発動の判定', use: '使用の判定', 'excess-level': '使用Lv超過の判定',
  teleport: '転移の判定', counter: '反撃の判定', 'status-resistance': '抵抗の判定',
  'follower-morale': '従者の士気判定', 'status-recovery': '状態回復の判定',
  'attack-hit-count': '攻撃の発数', 'attack-damage': '攻撃ダメージ',
  'prayer-addition': '必勝の祈りの加算', 'potion-recovery': '回復の薬の回復量',
};
function diceText(roll: PublicRollView, faces = roll.faces, total = roll.total): string {
  if (!faces.length || total === null) return 'まだ振っていません';
  const sum = faces.join(' + ');
  const expression = roll.formula === 'd6-product-min10' ? `最大（10, ${faces.join(' × ')}）`
    : roll.formula === '2d6x2' ? `(${sum}) × 2`
    : roll.formula === '4d6+1' ? `${sum} + 1`
    : roll.formula.startsWith('d6x') ? `${sum} × ${roll.modifier}` : sum;
  return `${expression} = ${total}`;
}
function resultText(roll: PublicRollView): string {
  if (roll.forcedFailure) return '強制失敗';
  if (roll.success === undefined) return '';
  return roll.success ? '成功' : '失敗';
}
function RollResult({ roll, name, announce = false }: { roll: PublicRollView; name: string; announce?: boolean }) {
  return <>
    <h3>{name} · {purposeNames[roll.purpose]}</h3>
    <p>{roll.stage === 'before-roll' ? '判定前' : roll.stage === 'after-roll' ? '結果の確認中' : '適用済み'}</p>
    <p role={announce ? "status" : undefined}>{diceText(roll)}{resultText(roll) ? ` · ${resultText(roll)}` : ''}</p>
    {roll.threshold === undefined ? null : <p>目標値: {roll.threshold}{roll.comparison==='greater-than'?'より大きい':'以下'}</p>}
    {roll.generation > 0 ? <details><summary>振り直し {roll.generation}回</summary><ol>{roll.attempts.map(attempt =>
      <li key={attempt.generation}>{attempt.generation === 0 ? '最初' : `振り直し ${attempt.generation}回目`}: {diceText(roll, attempt.faces, attempt.total)}</li>,
    )}</ol></details> : null}
  </>;
}
export function RollPanel({ view }: { view: PlayerView }) {
  const recent = view.recentRolls.filter(roll => roll.rollId !== view.currentRoll?.rollId).slice().reverse();
  const name = (roll: PublicRollView) => view.players[roll.rollerId]?.name ?? '参加者';
  return <>
    {view.currentRoll ? <section className="panel" aria-label="サイコロの結果"><h2>サイコロの結果</h2><RollResult roll={view.currentRoll} name={name(view.currentRoll)} announce/></section> : null}
    {recent.length ? <section className="panel log" aria-label="直近のサイコロ履歴"><h2>直近のサイコロ履歴</h2><details><summary>過去の結果を見る（{recent.length}件）</summary><ol>{recent.map(roll => <li key={roll.rollId}><RollResult roll={roll} name={name(roll)}/></li>)}</ol></details></section> : null}
  </>;
}
