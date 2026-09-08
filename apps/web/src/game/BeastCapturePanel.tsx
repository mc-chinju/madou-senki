import type { GameCommand } from '@madou/protocol';
import { useState } from 'react';
import { beastCaptureCommand, type BeastCaptureInputView } from './beast-capture-input.js';

type Props = { view: BeastCaptureInputView; names: Record<string, string>; disabled: boolean; send: (command: GameCommand) => boolean };
export function BeastCapturePanel(props: Props) {
  if (props.view.activeWindow?.kind !== 'beast-capture') return null;
  return <CaptureChoice key={props.view.activeWindow.windowId} {...props} />;
}
function CaptureChoice({ view, names, disabled, send }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const mine = view.activeWindow!.pendingActorId === view.self.id;
  const choice = mine && view.beastCapture?.actorId === view.self.id ? view.beastCapture : null;
  const command = beastCaptureCommand(view, selected);
  return <aside className="decision" aria-label="獣の取得">
    <p role="status">{mine ? 'あなたの判断です' : `${names[view.activeWindow!.pendingActorId] ?? '参加者'}さんの判断を待っています`}</p>
    <h2>獣を手札に加える</h2>
    <p>相手本人にダメージを与えた攻撃で、無視した獣を選べます。奪わずに進むこともできます。</p>
    {choice ? <>
      <fieldset disabled={disabled}><legend>手札に加える獣</legend>
        {choice.candidates.map(candidate => <label className="inline" key={candidate.cardInstanceId}>
          <input type="checkbox" checked={selected.includes(candidate.cardInstanceId)} onChange={event => {
            const checked = event.target.checked;
            setSelected(current => checked ? [...current, candidate.cardInstanceId] : current.filter(id => id !== candidate.cardInstanceId));
          }} /> {names[candidate.targetId] ?? '参加者'}さんの{candidate.position + 1}番目：{candidate.name}
        </label>)}
      </fieldset>
      <div className="button-row">
        <button disabled={disabled || !selected.length || !command} onClick={() => { if (command) send(command); }}>選んだ獣を手札に加える</button>
        {view.legalChoices.includes('PASS') ? <button className="secondary" disabled={disabled} onClick={() => send({ type: 'PASS' })}>奪わずに進む</button> : null}
      </div>
      <p className="hint">取得した札は手札に入ります。手札上限の調整は自分の手番末に行います。</p>
    </> : null}
  </aside>;
}
