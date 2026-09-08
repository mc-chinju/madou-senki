import { previewDeclarationCandidate, type DeclarationCandidate } from '@madou/engine';
import { declarationEffectText } from './declaration-input.js';
import { toggleSelection } from './commands.js';

export function DeclarationFields({ candidate, selected, disabled, onChange }: {
  candidate: DeclarationCandidate | undefined; selected: string[]; disabled: boolean; onChange: (ids: string[]) => void;
}) {
  if (!candidate?.abilities.length) return null;
  const preview = previewDeclarationCandidate(candidate, selected);
  return <fieldset disabled={disabled}><legend>技と一緒に使う能力</legend>
    {candidate.abilities.map(ability => <label className="declaration-ability" key={ability.abilityId}>
      <span className="inline"><input type="checkbox" checked={selected.includes(ability.abilityId)} onChange={() => onChange(toggleSelection(selected, ability.abilityId))}/>{ability.name}</span>
      <span className="hint">{declarationEffectText(ability.effects)}</span>
    </label>)}
    {preview.technique.chant && !candidate.fromChant ? <p className="hint">
      {candidate.abilities.some(ability => ability.effects.waiveChant) ? '詠唱を省略する能力を選ぶか、先にこの札を詠唱してください。' : 'この札は先に詠唱する必要があります。'}
    </p> : null}
    {selected.length ? <div role="status">
      <p>{preview.technique.range === 'far' ? '遠距離まで使用可能' : preview.technique.range === 'near' ? '近距離に使用可能' : '射程なし'}。
        {preview.pendingEffectDie ? ` 効果Lvの上限 ${preview.technique.effectLevel}（出目によって確定）` : ` 効果Lv ${preview.technique.effectLevel}`}
        {preview.spiritChecks ? `。能力の精神力判定 ${preview.spiritChecks}回` : ''}</p>
      {!preview.canDeclare ? <p>この選択では、技の使用条件を満たしません。</p> : null}
      <p className="hint">必要な能力が取り消されたり判定に失敗したりすると、技を使えない場合があります。支払ったカードは戻りません。</p>
    </div> : <p className="hint">能力は使うものだけ選んでください。</p>}
  </fieldset>;
}
