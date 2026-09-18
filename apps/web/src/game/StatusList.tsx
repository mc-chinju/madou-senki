import { getAction } from '@madou/catalog';
import type { PublicPlayerView } from '@madou/engine';

type PublicStatusView = PublicPlayerView['statuses'][number];

export const statusNames = { stopped: '停止', silenced: '沈黙', 'ability-disabled': '特殊能力無効', 'stat-drain': '能力値低下' };
const explanations = {
  stopped: 'カードと特殊能力は使えません。正体の公開と従者による防御はできます。',
  silenced: '魔法技の使用と魔法技の新規詠唱はできません。戦士技（詠唱を含む）と転移は使えます。詠唱済みの魔法は回復後に使えます。',
  'ability-disabled': 'キャラクターの特殊能力が無効です。カードに書かれた専用効果は使えます。',
  'stat-drain': '低下後の能力値は、これから行う判定に使います。',
};
function durationText(status: PublicStatusView): string {
  if (status.timing === 'next-own-seat') return '自分の次の席順が来るまで停止します。手番を飛ばす場合も、その席順で解除します。回復判定はありません。';
  if (status.timing === 'source-turn') return '使用者の次の手番が来るまで停止します。使用者が死亡・流浪していても、その席順で解除します。回復判定はありません。';
  if (status.timing === 'fixed-turns') return `あと自分の手番${status.remainingTurns}回。手番終了時に1回減り、通常の回復判定はありません。`;
  if (status.timing === 'until-death') return `戦士Lv・魔法Lv・精神力が各${status.amount}低下。解除する効果か、死亡するまで継続します。変身では解除されません。`;
  const modifier = `${status.recoveryModifier < 0 ? '−' : '+'}${Math.abs(status.recoveryModifier)}`;
  return `次の回復判定: 精神力${modifier}${status.timing === 'deadly-recovery' ? '。次の回復判定に失敗すると死亡。手番全体を飛ばす間は判定を持ち越します。' : ''}`;
}
export function StatusList({ player, own = false }: { player: PublicPlayerView; own?: boolean }) {
  if (!player.statuses.length && !player.skipsNextTurn) return null;
  const kinds = [...new Set(player.statuses.map(status => status.kind))];
  return <section aria-label={`${player.name}の状態異常`}>
    <h3>状態異常</h3>
    {player.skipsNextTurn ? <p><strong>次の手番を飛ばします</strong>。回復判定・ドロー・行動も行いません。</p> : null}
    <ul>{player.statuses.map((status, index) => <li key={`${status.kind}:${index}`}>
      <strong>{statusNames[status.kind]}</strong>
      {'sourceCardInstanceId' in status && status.sourceCardInstanceId ? `（${getAction(status.sourceCardInstanceId)?.name ?? 'カード効果'}）` : ''}
      {' · '}{durationText(status)}
    </li>)}</ul>
    {own ? kinds.map(kind => <p className="hint" key={kind}>{explanations[kind]}</p>) : null}
  </section>;
}
