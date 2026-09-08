import { DeclarationFields } from './DeclarationFields.js';
import { candidateFor } from './declaration-input.js';
import { useState } from 'react';
import { getAction } from '@madou/catalog';
import type { PlayerView } from '@madou/engine';
import type { GameCommand } from '@madou/protocol';
import { canConvertRevived, hasTurnTechniqueDedicated, turnTechniqueCards, turnTechniqueCommand, turnTechniqueTargets } from './lifetime-input.js';
import { toggleSelection } from './commands.js';

export function TurnTechniquePanel({ view, disabled, send }: { view: PlayerView; disabled: boolean; send: (command: GameCommand) => boolean }) {
  const [declarationIds, setDeclarationIds] = useState<string[]>([]);
  const [cardId, setCardId] = useState(''); const [dedicated, setDedicated] = useState(false);
  const [targets, setTargets] = useState<string[]>([]); const [conversions, setConversions] = useState<string[]>([]);
  const cards = turnTechniqueCards(view);
  if (!view.legalChoices.includes('PLAY_TURN_TECHNIQUE') || !cards.length) return null;
  const resurrection = cardId === 'a2-p13-r3c1'; const multiple = resurrection && dedicated;
  const ownHealing = !!cardId && !resurrection && !dedicated;
  const eligible = turnTechniqueTargets(view, cardId, dedicated);
  const chosenTargets = ownHealing ? [view.self.id] : targets;
  const command = turnTechniqueCommand(view, cardId, dedicated, chosenTargets, conversions, declarationIds);
  const candidate = candidateFor(view, { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: cardId, dedicated, targetIds: chosenTargets });
  const chanted = view.self.chants.some(card => card.cardInstanceId === cardId);
  return <section className="panel" aria-label="回復と復活の手番技"><h2>回復・復活の技</h2>
    <label>手番技として使うカード<select value={cardId} disabled={disabled} onChange={event => {
      setCardId(event.target.value); setDedicated(false); setTargets([]); setConversions([]); setDeclarationIds([]);
    }}><option value="">選択してください</option>{cards.map(id => <option key={id} value={id}>
      {getAction(id)?.name}{view.self.chants.some(card => card.cardInstanceId === id) ? '（詠唱中）' : ''}
    </option>)}</select></label>
    {cardId && hasTurnTechniqueDedicated(view, cardId) ? <label className="inline"><input type="checkbox" checked={dedicated} disabled={disabled} onChange={event => {
      setDedicated(event.target.checked); setTargets([]); setConversions([]); setDeclarationIds([]);
    }}/>専用効果を使う</label> : null}
    {ownHealing ? <p>自分のダメージを全回復します。</p> : null}
    <DeclarationFields candidate={candidate} selected={declarationIds} disabled={disabled} onChange={setDeclarationIds}/>
    {resurrection && !dedicated && !chanted && !declarationIds.length ? <p className="hint">通常の復活は、先にこのカードを詠唱する必要があります。</p> : null}
    {cardId && !ownHealing ? multiple ? <fieldset><legend>復活させる相手（複数選択可）</legend>
      {eligible.map(id => <div key={id}><label className="inline"><input type="checkbox" checked={targets.includes(id)} disabled={disabled} onChange={() => {
        setTargets(toggleSelection(targets, id)); setConversions(conversions.filter(target => target !== id));
      }}/>{view.players[id]!.name}</label>
        {targets.includes(id) && canConvertRevived(view, id) ? <label className="inline"><input type="checkbox" checked={conversions.includes(id)} disabled={disabled} onChange={() => setConversions(toggleSelection(conversions, id))}/>
          {view.players[id]!.name}の陣営・目的を自分と同じにする</label> : null}
      </div>)}{!eligible.length ? <p>復活の対象になる死亡者はいません。</p> : null}
    </fieldset> : <label>{resurrection ? '復活させる相手' : '回復させる近くの相手'}<select value={targets[0] ?? ''} disabled={disabled} onChange={event => setTargets(event.target.value ? [event.target.value] : [])}>
      <option value="">選択してください</option>{eligible.map(id => <option key={id} value={id}>{view.players[id]!.name}</option>)}
    </select></label> : null}
    {resurrection ? <p className="hint">選んだ相手を復活させ、初期手札と従者を再配置します。陣営変更を選ばなければ死亡時の陣営・目的を保ちます。</p> : null}
    <button disabled={disabled || !command} onClick={() => { if (command) send(command); }}>手番技を使う</button>
  </section>;
}
