import { getAction, type ActionCard } from '@madou/catalog';

export function OwnCardZone({ title, cards, onInspect, selected = [], onSelect, disabled = false }: {
  title: string;
  cards: readonly { cardInstanceId: string }[];
  onInspect: (card: ActionCard) => void;
  selected?: readonly string[];
  onSelect?: (id: string) => void;
  disabled?: boolean;
}) {
  return <section className="panel" aria-label={title}><h2>{title}</h2>
    {cards.length ? <ul className="zone-cards">{cards.map(({ cardInstanceId }) => {
      const card = getAction(cardInstanceId);
      if (!card) return null;
      return <li key={cardInstanceId}>
        {onSelect ? <button className="secondary" aria-label={`${card.name}を選ぶ`} aria-pressed={selected.includes(card.id)} disabled={disabled} onClick={() => onSelect(card.id)}>{card.name}</button> : <span>{card.name}</span>}
        <button className="secondary compact" aria-label={`${card.name}の詳細を見る`} onClick={() => onInspect(card)}>詳細</button>
      </li>;
    })}</ul> : <p>なし</p>}
  </section>;
}
