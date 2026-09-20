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
export function OwnDiscardDialog({ ids, count, open, onClose, onInspect }: {
  ids: readonly string[];
  /** The whole pile, the number the header shows; the copy reconciles it with the viewer's own share. */
  count: number;
  open: boolean;
  onClose: () => void;
  onInspect: (card: ActionCard) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null); const returnFocus = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<'recent' | 'grouped'>('recent');
  useEffect(() => { const dialog = ref.current; if (open && dialog && !dialog.open) { returnFocus.current = document.activeElement as HTMLElement; dialog.showModal(); } else if (!open && dialog?.open) dialog.close(); }, [open]);
  if (!open) return null;
  const newest = [...ids].reverse();
  const rows = grouped(ids);
  // Without a single pair the grouped view is every row tagged "1枚": it loses the order and gives nothing
  // back, so it stays unavailable, and a mode kept from an earlier pile falls back to the newest order.
  const canGroup = rows.some(row => row.ids.length > 1);
  const view = mode === 'grouped' && canGroup ? 'grouped' : 'recent';
  return <dialog className="own-discard" ref={ref} aria-labelledby="own-discard-title" onClose={() => { onClose(); returnFocus.current?.focus(); }}>
    <button className="dialog-close" aria-label="自分の捨て札を閉じる" onClick={() => ref.current?.close()}>×</button>
    <h2 id="own-discard-title">自分の捨て札</h2>
    {/* The header counts the whole pile, so say in one line how much of it is the viewer's. Folded rows are
        fewer than the cards they stand for, so the grouped view names how many kinds the rows are. */}
    <p>捨て札 {count}枚のうち、自分が捨てた {ids.length}枚です{view === 'grouped' ? `（${rows.length}種）` : ''}。ほかの席には枚数しか出ません。</p>
    {ids.length ? <>
      <div className="button-row" role="group" aria-label="並べ方">
        <button className="secondary" aria-pressed={view === 'recent'} onClick={() => setMode('recent')}>新しい順</button>
        <button className="secondary" aria-pressed={view === 'grouped'} disabled={!canGroup}
          aria-label={canGroup ? undefined : '同名をまとめる（同じ名前の札がまだありません）'}
          onClick={() => setMode('grouped')}>同名をまとめる</button>
      </div>
      {view === 'recent'
        ? <ol className="zone-cards own-discard-list">{newest.map((id, index) => {
          const card = getAction(id);
          return <li key={`${id}-${index}`}>{card
            ? <button className="card-link" aria-label={`${card.name}の詳細を見る`} onClick={() => onInspect(card)}>{card.name}</button>
            : <span>不明な札</span>}</li>;
        })}</ol>
        : <ul className="zone-cards own-discard-list">{rows.map(row => <li key={row.card.name}>
          <button className="card-link" aria-label={`${row.card.name}の詳細を見る`} onClick={() => onInspect(row.card)}>{row.card.name}</button>
          <span className="tag">{row.ids.length}枚</span>
        </li>)}</ul>}
    </> : <p>まだありません。自分が札を捨てると、ここに新しい順で並びます。</p>}
  </dialog>;
}
