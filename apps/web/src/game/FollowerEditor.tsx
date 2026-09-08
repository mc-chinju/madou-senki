import { getAction } from '@madou/catalog';
import type { GameCommand } from '@madou/protocol';
import { useState } from 'react';
import { arrangeFollowers, moveFollower } from './commands.js';
import { followerArrangementCommand, type FollowerInputView } from './follower-input.js';

export function FollowerEditor({ view, disabled, confirm }: { view: FollowerInputView; disabled: boolean; confirm: (command: GameCommand) => void }) {
  const current = view.self.followers.map(card => card.cardInstanceId);
  const [ordered, setOrdered] = useState(current);
  const limit = view.self.stats.followerLimit;
  const { placeableCardInstanceIds, removableCardInstanceIds } = view.followerPlacementOptions;
  const candidates = [...new Set([...current, ...placeableCardInstanceIds.filter(id => view.self.hand.includes(id))])].filter(id => !ordered.includes(id));
  const command = followerArrangementCommand(view, ordered);
  return <section className="panel arrangement" aria-label="従者の配置"><h2>従者を配置する</h2>
    <p>前から順に並べます。{ordered.length} / {limit}枚</p>
    <ol>{ordered.map((id, index) => {
      const locked = current.includes(id) && !removableCardInstanceIds.includes(id);
      return <li key={id}><span>{getAction(id)?.name ?? '従者'}{locked ? '（任意に外せません）' : ''}</span>
        <div className="button-row">
          <button className="secondary compact" disabled={disabled || index === 0} onClick={() => setOrdered(value => moveFollower(value, id, -1))}>前へ</button>
          <button className="secondary compact" disabled={disabled || index === ordered.length - 1} onClick={() => setOrdered(value => moveFollower(value, id, 1))}>後ろへ</button>
          <button className="secondary compact" disabled={disabled || locked} onClick={() => setOrdered(value => arrangeFollowers(value, id, 'remove', limit))}>外す</button>
        </div></li>;
    })}</ol>
    {candidates.length ? <label>従者を加える<select defaultValue="" disabled={disabled || ordered.length >= limit} onChange={event => {
      const selectedId = event.target.value;
      if (selectedId) { setOrdered(value => arrangeFollowers(value, selectedId, 'add', limit)); event.target.value = ''; }
    }}><option value="">従者を選択</option>{candidates.map(id => <option key={id} value={id}>{getAction(id)?.name ?? '従者'}</option>)}</select></label> : <p className="muted">追加できる従者はありません。</p>}
    <button disabled={disabled || !command} onClick={() => { if (command) confirm(command); }}>この順番で確定</button>
  </section>;
}
