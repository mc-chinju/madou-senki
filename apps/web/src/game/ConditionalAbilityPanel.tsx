import type { GameCommand } from '@madou/protocol';
import { useState } from 'react';
import { conditionalAbilityCommand, type ConditionalAbilityInputView, type ConditionalAbilitySetting } from './conditional-ability-input.js';
export interface ConditionalAbilityPanelProps { view: ConditionalAbilityInputView; names: Record<string, string>; disabled: boolean; send: (command: GameCommand) => boolean }
export function ConditionalAbilityPanel(props: ConditionalAbilityPanelProps) {
  if (!props.view.conditionalAbilities?.length) return null;
  return <section className="panel" aria-label="継続する特殊能力"><h2>継続する特殊能力</h2>
    <p>使用する設定が成立すると、書かれた条件を満たした間だけ修正が働きます。条件が未成立でも設定を予約できます。</p>
    <p className="hint">使用・対象変更には割り込みの確認があります。通常の行動は使いません。取消でも同じ場面での試行は戻りません。</p>
    {props.view.conditionalAbilities.map(setting => <ConditionalChoice key={`${setting.abilityId}:${setting.targetEventId}:${setting.enabled}:${setting.selectedTargetIds.join(',')}`} {...props} setting={setting}/>)}</section>;
}
function ConditionalChoice({ view, names, disabled, send, setting }: ConditionalAbilityPanelProps & { setting: ConditionalAbilitySetting }) {
  const [targets, setTargets] = useState([...setting.selectedTargetIds]);
  const lia = setting.abilityId === 'c2-p03-r1c2-ab03';
  const activate = conditionalAbilityCommand(view, setting.abilityId, true, lia ? targets : undefined);
  const deactivate = conditionalAbilityCommand(view, setting.abilityId, false);
  const choices = [...new Set([...(setting.eligibleTargetIds ?? []), ...setting.selectedTargetIds])];
  const invalidTargets = targets.some(id => !setting.eligibleTargetIds?.includes(id));
  return <fieldset className="panel" disabled={disabled}><legend>{setting.name}</legend>
    <p>{setting.description}</p>
    <p className="hint" role="status">{setting.enabled ? '使用する設定を保持しています。' : '使用しない設定です。'}
      {setting.suppressed ? '停止・能力禁止により一時停止しています。' : setting.enabled ? '実際の修正は条件と現在の能力値で確認してください。' : ''}</p>
    {lia ? <><p>現在の選択：{setting.selectedTargetIds.length ? setting.selectedTargetIds.map(id => names[id] ?? '参加者').join('、') : 'なし'}</p>
      <fieldset disabled={disabled || !setting.canActivate}><legend>精神力+1を届ける相手</legend>
        {choices.map(id => {
          const eligible = setting.eligibleTargetIds?.includes(id) ?? false;
          return <label className="inline" key={id}><input type="checkbox" checked={targets.includes(id)} disabled={!eligible && !targets.includes(id)} onChange={event => {
            const checked = event.target.checked; setTargets(current => checked ? [...current, id] : current.filter(value => value !== id));
          }}/>{names[id] ?? '参加者'}{eligible ? '' : '（現在は選べません）'}</label>;
        })}
        {!choices.length ? <p>現在、選べる相手はいません。</p> : null}
      </fieldset><p className="hint">誰も選ばなくても、ランスロットによる自分への修正を選択できます。後から公開された人は自動で追加されません。</p>
      {invalidTargets ? <p className="hint">現在は選べない対象を外すと、対象を変更できます。変更しなければ以前の選択を保持します。</p> : null}
    </> : null}
    <div className="button-row">
      {!setting.enabled || lia ? <button disabled={disabled || !activate} onClick={() => { if (activate) send(activate); }}>{setting.enabled ? '対象の変更を宣言' : '使用する設定を宣言'}</button> : null}
      {setting.enabled ? <button className="secondary" disabled={disabled || !deactivate} onClick={() => { if (deactivate) send(deactivate); }}>使用しない設定に戻す</button> : null}
    </div>
    {!setting.canActivate && !setting.canDeactivate ? <p className="hint">今は設定を変更できません。現在の判断が進むのを待ってください。</p> : null}
  </fieldset>;
}
