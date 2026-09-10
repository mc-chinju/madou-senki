import { useState } from 'react';
import type { GameCommand } from '@madou/protocol';
import type { AbilityOption } from './ability-input.js';
import { BAN_ABILITY, suppressionCommand, suppressionOptions, type SuppressionInputView } from './suppression-input.js';

interface Props { view: SuppressionInputView; disabled: boolean; send: (command: GameCommand) => boolean }
const applicabilityLabels = {
  private: '指定済み・適用状況は非公開',
  suppressed: '指定済み・特殊能力を使用できません',
  relieved: '指定済み・ヴァンミール由来の禁止は解除されています',
  exempt: '指定済み・この人物には禁止が適用されません',
};
export function SuppressionPanel({ view, disabled, send }: Props) {
  const options = suppressionOptions(view);
  if (!options.length && !view.suppressionTargets.length) return null;
  return <section className="panel" aria-label="能力の禁止と祝福"><h2>能力の禁止と祝福</h2>
    {view.suppressionTargets.length ? <ul>{view.suppressionTargets.map(target => <li key={target.targetId}>
      {view.players[target.targetId]?.name ?? '参加者'}：{applicabilityLabels[target.applicability]}
    </li>)}</ul> : null}
    {options.map(option => <SuppressionChoice key={JSON.stringify([option.abilityId, option.targetEventId, option.targetIds])}
      view={view} option={option} disabled={disabled} send={send}/>)}
  </section>;
}
function SuppressionChoice({ view, option, disabled, send }: Props & { option: AbilityOption }) {
  const [targets, setTargets] = useState<string[]>([]);
  const ban = option.abilityId === BAN_ABILITY;
  const offered = option.targetIds ?? [];
  const selected = targets.filter(id => offered.includes(id));
  const command = suppressionCommand(view, option.abilityId, option.targetEventId, selected);
  return <fieldset className="panel" disabled={disabled}><legend>{option.name}</legend>
    {ban ? <><p>選んだ参加者を特殊能力の禁止対象に指定します。以前の指定は、今回選ばなくても残ります。</p>
      <p className="hint">公開の回答順、または自分の手番の安定した場面で、同じ機会に一度だけ試せます。通常の行動は使いません。取消でも試行は戻りません。</p>
      <fieldset><legend>追加する指定の対象（複数選択可）</legend>{offered.map(id => <label className="inline" key={id}>
        <input type="checkbox" checked={selected.includes(id)} onChange={event => {
          const checked = event.target.checked;
          setTargets(current => checked ? [...current.filter(value => value !== id), id] : current.filter(value => value !== id));
        }}/>{view.players[id]?.name ?? '参加者'}
      </label>)}</fieldset></> : <><p>選んだ一人について精神力−5の判定を行い、成功するとヴァンミール由来の禁止を解除します。他の原因の禁止や停止は解除しません。</p>
      <p className="hint">通常の行動とは別に、自分の手番中に一度だけ試せます。取消・判定失敗でも試行は戻りません。</p>
      <p className="hint">成立した解除は、あなたの死亡処理が始まると失効し、復活しても戻りません。停止・能力禁止・一時不在だけでは消えません。</p>
      <label>祝福する対象<select value={selected[0] ?? ''} onChange={event => setTargets(event.target.value ? [event.target.value] : [])}>
        <option value="">対象を選択</option>{offered.map(id => <option key={id} value={id}>{view.players[id]?.name ?? '参加者'}</option>)}
      </select></label></>}
    {!offered.length ? <p>現在、選べる対象はいません。</p> : null}
    <button disabled={disabled || !command} onClick={() => { if (command && send(command)) setTargets([]); }}>{option.name}を使う</button>
    <p className="hint">使わずに進める場合は、現在の回答や行動を選んでください。</p>
  </fieldset>;
}
