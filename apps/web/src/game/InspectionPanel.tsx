import { getAction, getCharacter, type ActionCard, type CharacterCard } from '@madou/catalog';
import type { GameCommand } from '@madou/protocol';
import { useState } from 'react';
import { inspectionCommand, type InspectionInputView } from './information-input.js';

type Props = { view: InspectionInputView; names: Record<string, string>; disabled: boolean; send: (command: GameCommand) => boolean; onInspect: (card: ActionCard | CharacterCard) => void };
const zoneNames = { hand: '手札', followers: '従者', chants: '詠唱札', character: '人物カード' };
export function InspectionPanel(props: Props) {
  if (!props.view.inspection && props.view.activeWindow?.kind !== 'private-inspection') return null;
  return <InspectionChoice key={props.view.inspection?.decisionId ?? 'waiting'} {...props}/>;
}
function InspectionChoice({ view, names, disabled, send, onInspect }: Props) {
  const [selected, setSelected] = useState('');
  const decision = view.inspection?.actorId === view.self.id ? view.inspection : null;
  if (!decision) return <aside className="decision" aria-label="情報確認の判断"><h2>情報の確認</h2>
    <p role="status">{names[view.activeWindow?.pendingActorId ?? ''] ?? '参加者'}さんの確認を待っています。</p></aside>;
  const finish = inspectionCommand(view, 'finish');
  const discardOne = inspectionCommand(view, 'discard-one', selected || undefined);
  const discardAll = inspectionCommand(view, 'discard-all');
  const character = decision.characterId ? getCharacter(decision.characterId) : undefined;
  const canChoose = !!finish && !disabled;
  return <aside className="decision" aria-label="自分だけの確認内容"><h2>{names[decision.targetId] ?? '対象の人物'}さんの{zoneNames[decision.zone]}</h2>
    <p>この確認内容はあなただけに表示されています。確認だけでは札の表裏・順番は変わりません。</p>
    {!finish ? <p role="status">確認内容を保持しています。割り込みの解決を待っています。</p> : null}
    {character ? <button className="card-link" onClick={() => onInspect(character)}>{character.name}</button> : null}
    {decision.cards.length ? <ul className="zone-cards">{decision.cards.map(source => {
      const card = getAction(source.cardInstanceId);
      return <li key={source.cardInstanceId}>
        {decision.discardMode === 'one' ? <label className="inline"><input type="radio" name={`inspection-${decision.decisionId}`} disabled={!canChoose} checked={selected === source.cardInstanceId} onChange={() => setSelected(source.cardInstanceId)}/>
          {source.position + 1}番目：{card?.name ?? 'カード'}</label> : <span>{source.position + 1}番目：{card?.name ?? 'カード'}</span>}
        {card ? <button className="secondary compact" aria-label={`${card.name}の詳細を見る`} onClick={() => onInspect(card)}>詳細</button> : null}
      </li>;
    })}</ul> : !character ? <p>確認できるカードはありません。</p> : null}
    <div className="button-row">
      {decision.choices.includes('discard-one') ? <button disabled={disabled || !discardOne} onClick={() => { if (discardOne) send(discardOne); }}>選んだ1枚を捨てさせる</button> : null}
      {decision.choices.includes('discard-all') ? <button disabled={disabled || !discardAll} onClick={() => { if (discardAll) send(discardAll); }}>見た詠唱札をすべて捨てさせる</button> : null}
      <button className="secondary" disabled={disabled || !finish} onClick={() => { if (finish) send(finish); }}>確認を終える</button>
    </div>
  </aside>;
}
