import type { GameCommand } from '@madou/protocol';
import { useState } from 'react';
import { drawCommand, revealCommand, type OptionalTurnInputView } from './information-input.js';

type Props = { view: OptionalTurnInputView; disabled: boolean; send: (command: GameCommand) => boolean };
export function DrawControl({ view, disabled, send }: Props) {
  const [abilityId, setAbilityId] = useState('');
  if (!view.legalChoices.includes('CHOOSE_DRAW')) return null;
  const draw = drawCommand(view, true, abilityId || undefined);
  const decline = drawCommand(view, false);
  return <section className="panel" aria-label="手札の補充"><h2>手札を補充する</h2>
    {(view.drawAbilityOptions ?? []).map(option => <label className="inline" key={option.abilityId}>
      <input type="checkbox" disabled={disabled} checked={abilityId === option.abilityId} onChange={event => setAbilityId(event.target.checked ? option.abilityId : '')}/>
      {option.name}：1枚の代わりに2枚補充する
    </label>)}
    {view.drawAbilityOptions?.length ? <p className="hint">能力が取り消されると通常の1枚補充になります。「引かない」を選ぶと能力も使いません。</p> : null}
    <div className="button-row"><button disabled={disabled || !draw} onClick={() => { if (draw) send(draw); }}>カードを引く</button>
      <button className="secondary" disabled={disabled || !decline} onClick={() => { if (decline) send(decline); }}>カードを引かない</button></div>
  </section>;
}
export function RevealControl({ view, disabled, send }: Props) {
  const [abilityId, setAbilityId] = useState('');
  if (!view.legalChoices.includes('REVEAL_CHARACTER')) return null;
  const command = revealCommand(view, abilityId || undefined);
  return <section className="reveal-control panel" aria-label="正体の公開"><h2>正体を公開する</h2>
    <p>現在の判断順を待たず、自分のキャラクターを公開できます。</p>
    {(view.revealAbilityOptions ?? []).map(option => <label className="inline" key={option.abilityId}>
      <input type="checkbox" disabled={disabled} checked={abilityId === option.abilityId} onChange={event => setAbilityId(event.target.checked ? option.abilityId : '')}/>
      {option.name}：基礎精神力を12にする
    </label>)}
    {view.revealAbilityOptions?.length ? <p className="hint">他の精神力修正は12に加えて計算します。能力が取り消されても、正体の公開は戻りません。期限は成立後に表示します。</p> : null}
    <button disabled={disabled || !command} onClick={() => { if (command) send(command); }}>正体を公開</button>
  </section>;
}
export function SpiritExpiryNotice({ value, names }: { value?: { expiresOnActorId: string; active: boolean } | null; names: Record<string, string> }) {
  if (!value) return null;
  return <p className="hint" role="status">本当の力：{names[value.expiresOnActorId] ?? '対象の人物'}さんの手番終了まで。
    {value.active ? '基礎精神力を12として、他の有効な修正を計算しています。' : '停止・能力禁止などにより現在は効果が働いていません。'}</p>;
}
