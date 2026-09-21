import { getCharacter, type ActionCard, type CharacterCard } from '@madou/catalog';
import type { PlayerView } from '@madou/engine';
import { PublicCardLinks } from './PublicCardLinks.js';

/** Everything the table held back, shown once the game is decided. Nothing here is a choice any more, so it
 *  reads as a record: one block per seat in seat order, then the pile and the deck nobody got to. */
export function EndgameRevealPanel({ view, onInspect }: { view: PlayerView; onInspect: (card: ActionCard | CharacterCard) => void }) {
  const reveal = view.reveal;
  if (!reveal) return null;
  const ownerless = reveal.discard.filter(entry => !entry.ownerId).map(entry => entry.cardInstanceId);
  // The heading names the region, rather than a second wording only a screen reader would hear.
  return <section className="panel endgame-reveal" aria-labelledby="endgame-reveal-title">
    <h2 id="endgame-reveal-title">全員の手の内</h2>
    <p>対戦が決着したので、全員の正体・手札・伏せていた札・捨て札・山札を開示しています。戦記は対戦中に見えた分だけのままです。</p>
    {/* Seats sit side by side where the width is there, as they do in 参加者の公開状態 above: the point of
        the panel is comparing hands, and stacked they left the right half of a wide screen empty. */}
    <div className="reveal-seats">{view.seatOrder.map(id => {
      const seat = reveal.players[id];
      if (!seat) return null;
      const person = getCharacter(seat.characterId);
      const discarded = reveal.discard.filter(entry => entry.ownerId === id).map(entry => entry.cardInstanceId);
      return <article className="reveal-seat" key={id}>
        <h3>{view.players[id]?.name ?? id}</h3>
        <p>{person
          ? <button className="card-link" aria-label={`${person.name}の人物カードを見る`} onClick={() => onInspect(person)}>{person.name}</button>
          : '不明な人物'}{view.players[id]?.revealed ? null : <span className="tag">最後まで非公開</span>}</p>
        <dl className="public-zones">
          <div><dt>手札</dt><dd><PublicCardLinks ids={seat.hand} onInspect={onInspect} /></dd></div>
          <div><dt>従者</dt><dd><PublicCardLinks ids={seat.followers} onInspect={onInspect} /></dd></div>
          <div><dt>詠唱</dt><dd><PublicCardLinks ids={seat.chants} onInspect={onInspect} /></dd></div>
          {/* An empty pile has no order to name, and 「0枚」 over 「なし」 says the same thing twice. */}
          <div><dt>{discarded.length ? `捨て札 ${discarded.length}枚（捨てた順）` : '捨て札'}</dt><dd><PublicCardLinks ids={discarded} onInspect={onInspect} /></dd></div>
        </dl>
      </article>;
    })}</div>
    {/* Cards that went straight from the deck to the pile belonged to no seat, so they get their own line. */}
    {ownerless.length ? <p>どの席のものでもない捨て札 {ownerless.length}枚: <PublicCardLinks ids={ownerless} onInspect={onInspect} /></p> : null}
    {/* The deck is the longest list here and the least often wanted, so it stays folded until asked for. */}
    <details className="reveal-deck"><summary>山札 {reveal.deck.length}枚（上から順）</summary>
      <p><PublicCardLinks ids={reveal.deck} onInspect={onInspect} /></p>
    </details>
  </section>;
}
