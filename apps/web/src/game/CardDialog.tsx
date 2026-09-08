import { useEffect, useRef } from 'react';
import type { ActionCard, CharacterCard } from '@madou/catalog';

export function CardDialog({ card, onClose }: { card: ActionCard | CharacterCard | null; onClose: () => void }) {
  const ref=useRef<HTMLDialogElement>(null); const returnFocus=useRef<HTMLElement|null>(null);
  useEffect(()=>{const dialog=ref.current;if(card&&dialog&&!dialog.open){returnFocus.current=document.activeElement as HTMLElement;dialog.showModal();}else if(!card&&dialog?.open)dialog.close();},[card]);
  if(!card)return null;
  return <dialog ref={ref} aria-labelledby="card-dialog-title" aria-describedby="card-dialog-description" onClose={()=>{onClose();returnFocus.current?.focus();}}>
    <button className="dialog-close" aria-label="カード詳細を閉じる" onClick={()=>ref.current?.close()}>×</button>
    <div className="dialog-card"><img src={card.assetId} alt="" width="400" height="560"/>
      <div id="card-dialog-description"><p className="eyebrow">{card.kind === 'character' ? '人物' : '行動カード'}</p><h2 id="card-dialog-title">{card.name}</h2>
        {card.kind === 'action' ? <>
          <p className="printed-text">{card.printed_text}</p>
          {card.specification.length ? <><h3>補足</h3><ul>{card.specification.map((line,i)=><li key={i}>{line}</li>)}</ul></> : null}
          {card.timing.length ? <p><strong>使用時:</strong> {card.timing.join(' / ')}</p> : null}
        </> : <>
          <p>初期陣営: {card.initial_faction} / 目的: {card.objective}</p>
          {card.allegiance_text ? <p>{card.allegiance_text}</p> : null}
          <p>持ち技: {card.owned_techniques.join('、') || 'なし'}</p>
          <p>持ち従者: {card.owned_followers.join('、') || 'なし'}</p>
          {card.abilities.map(ability => <section key={ability.id}><h3>{ability.name}</h3><p>{typeof ability.printed_text === 'string' ? ability.printed_text : ability.specification}</p></section>)}
          {card.restrictions.length ? <><h3>制限</h3><ul>{card.restrictions.map((restriction,i)=><li key={i}>{restriction}</li>)}</ul></> : null}
          {card.defeat_condition ? <p>敗北条件: {card.defeat_condition}</p> : null}
        </>}
      </div>
    </div>
  </dialog>;
}
