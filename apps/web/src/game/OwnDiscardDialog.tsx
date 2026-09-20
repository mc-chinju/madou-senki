import { useEffect, useRef, useState } from 'react';
import { getAction, type ActionCard } from '@madou/catalog';

/** Copies of the same card carry no information apart from how many are gone, so they fold into one row. */
function grouped(ids: readonly string[]) {
  const rows = new Map<string, { card: ActionCard; ids: string[] }>();
  for (const id of ids) {
    const card = getAction(id);
    if (!card) continue;
    const row = rows.get(card.name) ?? { card, ids: [] };
    row.ids.push(id); rows.set(card.name, row);
  }
  return [...rows.values()].sort((a, b) => b.ids.length - a.ids.length || a.card.name.localeCompare(b.card.name, 'ja'));
}

/** The viewer's own pile. Other seats only ever learn the count, so nothing here is shared. */
export function OwnDiscardDialog({ ids, open, onClose, onInspect }: {
  ids: readonly string[];
  open: boolean;
  onClose: () => void;
  onInspect: (card: ActionCard) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null); const returnFocus = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<'recent' | 'grouped'>('recent');
  useEffect(() => { const dialog = ref.current; if (open && dialog && !dialog.open) { returnFocus.current = document.activeElement as HTMLElement; dialog.showModal(); } else if (!open && dialog?.open) dialog.close(); }, [open]);
  if (!open) return null;
  const newest = [...ids].reverse();
  return <dialog ref={ref} aria-labelledby="own-discard-title" onClose={() => { onClose(); returnFocus.current?.focus(); }}>
    <button className="dialog-close" aria-label="自分の捨て札を閉じる" onClick={() => ref.current?.close()}>×</button>
    <h2 id="own-discard-title">自分の捨て札</h2>
    <p>自分が捨てて、いまも捨て札にある札です（{ids.length}枚）。ほかの席には枚数しか出ません。</p>
    {ids.length ? <>
      <div className="button-row" role="group" aria-label="並べ方">
        <button className="secondary" aria-pressed={mode === 'recent'} onClick={() => setMode('recent')}>新しい順</button>
        <button className="secondary" aria-pressed={mode === 'grouped'} onClick={() => setMode('grouped')}>同名をまとめる</button>
      </div>
      {mode === 'recent'
        ? <ol className="zone-cards">{newest.map((id, index) => {
          const card = getAction(id);
          return <li key={`${id}-${index}`}>{card
            ? <button className="card-link" aria-label={`${card.name}の詳細を見る`} onClick={() => onInspect(card)}>{card.name}</button>
            : <span>不明な札</span>}</li>;
        })}</ol>
        : <ul className="zone-cards">{grouped(ids).map(row => <li key={row.card.name}>
          <button className="card-link" aria-label={`${row.card.name}の詳細を見る`} onClick={() => onInspect(row.card)}>{row.card.name}</button>
          <span className="tag">{row.ids.length}枚</span>
        </li>)}</ul>}
    </> : <p>まだありません。</p>}
  </dialog>;
}
