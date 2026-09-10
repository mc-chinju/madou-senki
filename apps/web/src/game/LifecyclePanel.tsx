import { getAction, getCharacter } from '@madou/catalog';
import type { PlayerView } from '@madou/engine';
import type { GameCommand } from '@madou/protocol';
import { useState, type ReactNode } from 'react';
import { deathGiftCards, deathGiftCommand } from './lifecycle-input.js';

import { initialFollowerCommand } from './follower-input.js';

const abilityLabels = {
  'lancelot-transform': 'ランスロットⅡへ変身する',
  'vanmil-subordinates': '下僕達を使う',
  'arseil-conspiracy': '陰謀を使い、勝利して退場する',
} as const;
export const lifecycleCommands = new Set([
  'CHAM_DEATH_GIFT', 'PLAY_DEATH_GIFT', 'CHOOSE_REVIVAL', 'USE_LIFECYCLE_ABILITY', 'TRANSFER_RITUAL', 'USE_REVIVAL_RITUAL',
]);

export function LifecyclePanel({ view, disabled, send }: {
  view: PlayerView; disabled: boolean; send: (command: GameCommand) => boolean;
}) {
  const [sourceId, setSourceId] = useState('');
  const [giftId, setGiftId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [followerId, setFollowerId] = useState('');
  const decision = view.lifecycleDecision;
  const allowed = (command: string) => view.legalChoices.includes(command);
  const name = (id: string) => view.players[id]?.name ?? '参加者';
  const mine = view.activeWindow?.pendingActorId === view.self.id;
  const ritualTransfer = allowed('TRANSFER_RITUAL');
  const ritualUse = allowed('USE_REVIVAL_RITUAL');
  const lifecycleAbility = allowed('USE_LIFECYCLE_ABILITY') && view.lifecycleAbilities.length > 0;
  const recipients = view.seatOrder.filter(id => {
    const player = view.players[id]!;
    return id !== view.self.id && player.presence === 'active' && player.revealed &&
      !!player.characterId && getCharacter(player.characterId)?.name === '邪祭ウーノス';
  });
  const abilityPanel = lifecycleAbility ? <section className="panel" aria-label="変身と固有能力"><h2>変身と固有能力</h2>
    <p>能力の使用を宣言し、割り込みの確認後に解決します。取り消されても使用回数は戻りません。</p><div className="button-row">
      {view.lifecycleAbilities.map(ability => <button key={ability} disabled={disabled}
        onClick={() => send({ type: 'USE_LIFECYCLE_ABILITY', ability })}>{abilityLabels[ability]}</button>)}
    </div></section> : null;
  const ritualPanel = ritualTransfer || ritualUse ? <section className="panel" aria-label="復活の儀式"><h2>復活の儀式</h2>
      {ritualUse ? <><p>ヴァンミールへ変身し、耐久力を全回復します。陣営と目的も変わります。</p>
        <button disabled={disabled} onClick={() => send({ type: 'USE_REVIVAL_RITUAL' })}>儀式を行い、ヴァンミールへ変身する</button></> : null}
      {ritualTransfer ? <><p>復活の儀式を、正体を公開しているウーノスへ渡します。</p>
        <label>儀式を渡す相手<select value={targetId} onChange={event => setTargetId(event.target.value)}>
          <option value="">相手を選択</option>{recipients.map(id => <option key={id} value={id}>{name(id)}</option>)}
        </select></label><button disabled={disabled || !recipients.includes(targetId)}
          onClick={() => send({ type: 'TRANSFER_RITUAL', targetId })}>復活の儀式を渡す</button></> : null}
    </section> : null;
  const withActions = (prompt: ReactNode) => <>{prompt}{abilityPanel}{ritualPanel}</>;
  if (!decision) return lifecycleAbility || ritualTransfer || ritualUse ? withActions(null) : null;

  const waiting = <p role="status">{mine ? 'あなたの判断です' : `${name(view.activeWindow!.pendingActorId)}さんの判断を待っています`}</p>;
  if (decision.kind === 'death-gift') {
    const sourceCards = deathGiftCards(view.self.hand, view.self.faction);
    const giftCards = view.self.hand.filter(id => id !== sourceId);
    const command = deathGiftCommand({ hand: view.self.hand, faction: view.self.faction,
      eligibleTargetIds: decision.eligibleTargetIds, cardInstanceId: sourceId, giftCardInstanceId: giftId, targetId });
    return withActions(<aside className="decision" aria-label="死亡時の贈与">{waiting}<h2>最後にカードを託す</h2>
      <p>{name(decision.actorId)}さんの死亡時の処理です。使える能力やカードで、残った手札を託せます。</p>
      {mine && decision.chamGift && allowed('CHAM_DEATH_GIFT') ? <section aria-label="みんな姫様を頼むね">
        <h3>みんな姫様を頼むね</h3><p>手札を1枚託します。手札の補充はありません。</p>
        <label>能力で託す手札<select value={giftId} onChange={event => setGiftId(event.target.value)}>
          <option value="">手札を選択</option>{decision.chamGift.cardInstanceIds.map(id => <option key={id} value={id}>{getAction(id)?.name}</option>)}
        </select></label>
        <label>能力で託す相手<select value={targetId} onChange={event => setTargetId(event.target.value)}>
          <option value="">相手を選択</option>{decision.chamGift.eligibleTargetIds.map(id => <option key={id} value={id}>{name(id)}</option>)}
        </select></label>
        <p className="hint">カードの中身は受取人だけが確認できます。能力を取り消された場合は、選んだ手札も死亡時に捨てます。</p>
        <button disabled={disabled || !decision.chamGift.cardInstanceIds.includes(giftId) || !decision.chamGift.eligibleTargetIds.includes(targetId)}
          onClick={() => send({type:'CHAM_DEATH_GIFT',decisionId:decision.chamGift!.decisionId,cardInstanceId:giftId,targetId})}>能力で手札を託す</button>
      </section> : null}
      {mine ? <>{allowed('PLAY_DEATH_GIFT') ? <>
        <label>死亡時に使うカード<select value={sourceId} onChange={event => { setSourceId(event.target.value); setGiftId(''); }}>
          <option value="">カードを選択</option>{sourceCards.map(id => <option key={id} value={id}>{getAction(id)?.name}</option>)}
        </select></label>
        <label>相手に託す手札<select value={giftId} onChange={event => setGiftId(event.target.value)}>
          <option value="">別の手札を選択</option>{giftCards.map(id => <option key={id} value={id}>{getAction(id)?.name}</option>)}
        </select></label>
        <label>カードを託す相手<select value={targetId} onChange={event => setTargetId(event.target.value)}>
          <option value="">相手を選択</option>{decision.eligibleTargetIds.map(id => <option key={id} value={id}>{name(id)}</option>)}
        </select></label>
        <p className="hint">託したカードの中身は受取人だけが確認できます。この使用による手札補充はありません。</p>
        <button disabled={disabled || !command} onClick={() => { if (command) send(command); }}>選んだ手札を託す</button>
      </> : null}{allowed('PASS') ? <button className="secondary" disabled={disabled} onClick={() => send({ type: 'PASS' })}>託さずに進む</button> : null}</> : null}
    </aside>);
  }
  if (decision.kind === 'revival') return withActions(<aside className="decision" aria-label="復活の選択">{waiting}<h2>復活するか選ぶ</h2>
    <p>{name(decision.actorId)}さんが復活できる状態になりました。</p>
    {mine && allowed('CHOOSE_REVIVAL') ? <><p>復活すると正体を公開したまま全回復し、手札と従者を取得し直します。</p>
      <div className="button-row"><button disabled={disabled} onClick={() => send({ type: 'CHOOSE_REVIVAL', revive: true })}>復活する</button>
        <button className="secondary" disabled={disabled} onClick={() => send({ type: 'CHOOSE_REVIVAL', revive: false })}>復活しない</button></div></> : null}
  </aside>);
  if (decision.kind === 're-setup') {
    const cards = view.followerPlacementOptions.placeableCardInstanceIds.filter(id => view.self.hand.includes(id));
    const placement = initialFollowerCommand(view, followerId);
    return withActions(<aside className="decision" aria-label="復帰後の従者配置">{waiting}<h2>復帰後の従者を配置する</h2>
      <p>{name(decision.actorId)}さんが手札から従者を配置します。</p>
      {mine ? <>{allowed('PLACE_INITIAL_FOLLOWER') ? <><p>現在 {view.self.followers.length} / {view.self.stats.followerLimit}枚</p>
        <label>配置する従者<select value={followerId} onChange={event => setFollowerId(event.target.value)}>
          <option value="">従者を選択</option>{cards.map(id => <option key={id} value={id}>{getAction(id)?.name}</option>)}
        </select></label><button disabled={disabled || !placement}
          onClick={() => { if (placement) send(placement); }}>この従者を配置する</button></> : null}
        {allowed('PASS_SETUP') ? <button className="secondary" disabled={disabled} onClick={() => send({ type: 'PASS_SETUP' })}>従者の配置を終える</button> : null}</> : null}
    </aside>);
  }
  return withActions(<aside className="decision" aria-label="変身と陣営の確認">{waiting}<h2>変身と陣営の確認</h2>
    {mine ? <div className="button-row">
      {allowed('PASS') ? <button className="secondary" disabled={disabled} onClick={() => send({ type: 'PASS' })}>能力を使わず進む</button> : null}
    </div> : null}
  </aside>);
}
