import { getAction, type ActionCard } from '@madou/catalog';

/** Callers supply only IDs already present in the server's public projection. */
export function PublicCardLinks({ ids, onInspect }: { ids: readonly string[]; onInspect: (card: ActionCard) => void }) {
  return ids.length ? <>{ids.map((id, index) => {
    const card = getAction(id);
    return <span key={id}>{index ? '、' : ''}{card ? <button className="card-link" aria-label={`${card.name}の詳細を見る`} onClick={() => onInspect(card)}>{card.name}</button> : '公開カード'}</span>;
  })}</> : <>なし</>;
}
