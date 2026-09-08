import type { PlayerView } from '@madou/engine';
import type { GameCommand } from '@madou/protocol';
import { getAction } from '@madou/catalog';

const choices = {
  'instant-death': { explanation: '精神力−2の判定を要求し、失敗した対象を即死させるか選びます。', apply: '即死の判定を要求する', decline: '要求しない' },
  'fixed-stop': { explanation: '対象本人の手番を1d6回数える間、停止させるか選びます。通常の回復判定では解除されません。', apply: '期間付きの停止を与える', decline: '停止させない' },
  'otherworld-modifier': { explanation: '異界へ送る抵抗判定に使う精神力の補正を選びます。', apply: '精神力−3で判定する', decline: '補正なしで判定する' },
  'soul-drain': { explanation: '抵抗に失敗した対象への効果を選びます。即死が成立し、自分も同時に死亡しなければ全回復します。', apply: '即死させる', decline: '能力値を各1下げる' },
};
export function LifetimeDecisionPanel({ view, disabled, send }: { view: PlayerView; disabled: boolean; send: (command: GameCommand) => boolean }) {
  const decision = view.lifetimeDecision;
  if (!decision || decision.actorId !== view.self.id || !view.legalChoices.includes('CHOOSE_LIFETIME_EFFECT')) return null;
  const text = choices[decision.kind];
  return <aside className="decision" aria-label="命中効果の選択"><h2>{getAction(decision.sourceCardInstanceId)?.name ?? '命中効果'}の選択</h2>
    <p role="status">あなたの判断です。対象: {view.players[decision.targetId]?.name ?? '参加者'}</p>
    <p>{text.explanation}</p><div className="button-row">{decision.choices.map(choice =>
      <button key={choice} className={choice === 'decline' ? 'secondary' : undefined} disabled={disabled}
        onClick={() => send({ type: 'CHOOSE_LIFETIME_EFFECT', choice })}>{text[choice]}</button>)}</div>
  </aside>;
}
