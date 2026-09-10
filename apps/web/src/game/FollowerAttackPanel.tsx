import {PrintedCombinationFields,withPrintedComponents} from './PrintedCombinationFields.js';
import {DispelFields,withDispel} from './DispelFields.js';
import { previewDeclarationCandidate } from '@madou/engine';
import { DeclarationFields } from './DeclarationFields.js';
import { candidateFor } from './declaration-input.js';
import { getAction } from '@madou/catalog';
import type { PlayerView } from '@madou/engine';
import type { GameCommand } from '@madou/protocol';
import { useState } from 'react';
import { followerAttackCommand, followerAttackChoices, type FollowerAttackOption } from './follower-attack-input.js';
import { toggleSelection } from './commands.js';

export function FollowerAttackTargets({ option, names, selected, disabled, change, inputName = 'follower-attack-target' }: {
  option: Pick<FollowerAttackOption, 'targetMode' | 'legalTargetIds' | 'targetValues'>; inputName?: string; names: Record<string, string>; selected: string[]; disabled: boolean; change: (ids: string[]) => void;
}) {
  const targetValues = option.targetValues?.length ? <div><p>継続能力を含む対象別の値</p><ul>
    {option.targetValues.map(value => <li key={value.actorId}>{names[value.actorId] ?? '参加者'}：効果Lv {value.effectLevel}・ダメージ {value.damage}</li>)}
  </ul></div> : null;
  if (option.targetMode === 'mandatory-all') return <div><p>対象は攻撃できる相手全員です。この技では対象を減らせません。</p>
    <ul>{option.legalTargetIds.map(id => <li key={id}>{names[id] ?? '参加者'}</li>)}</ul>{targetValues}</div>;
  return <><fieldset><legend>{option.targetMode === 'one' ? '攻撃する相手を1人選択' : '攻撃する相手を1人以上選択'}</legend>
    {option.legalTargetIds.map(id => <label className="inline" key={id}><input type={option.targetMode === 'one' ? 'radio' : 'checkbox'}
      name={inputName} checked={selected.includes(id)} disabled={disabled}
      onChange={() => change(option.targetMode === 'one' ? [id] : toggleSelection(selected, id))}/>{names[id] ?? '参加者'}</label>)}
  </fieldset>{targetValues}</>;
}
export function FollowerAttackPanel({ view, disabled, send }: { view: PlayerView; disabled: boolean; send: (command: GameCommand) => boolean }) {
  const [dispelTarget,setDispelTarget]=useState('');
  const [printedComponents,setPrintedComponents]=useState<string[]>([]);
  const [declarationIds, setDeclarationIds] = useState<string[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [dedicated, setDedicated] = useState(false);
  const [targets, setTargets] = useState<string[]>([]);
  const candidates = followerAttackChoices(view).filter(option => option.sourceZone === 'hand'
    ? view.self.hand.includes(option.cardInstanceId) : view.self.followers.some(card => card.cardInstanceId === option.cardInstanceId));
  const option = candidates.find(candidate => candidate.cardInstanceId === sourceId);
  if (view.activeWindow || !view.legalChoices.includes('ATTACK') || !candidates.length) return null;
  const declarationCandidate = candidateFor(view, { type: 'ATTACK', cardInstanceId: sourceId, targetIds: targets, dedicated });
  const preview = declarationCandidate ? previewDeclarationCandidate(declarationCandidate, declarationIds) : undefined;
  const effectiveOption = option && preview ? { ...option, legalTargetIds: preview.legalTargetIds, targetMode: preview.technique.mandatoryAll ? 'mandatory-all' as const : preview.technique.target === 'all' ? 'selected-all' as const : 'one' as const } : option;
  const chosenTargets = effectiveOption?.targetMode === 'mandatory-all' ? effectiveOption.legalTargetIds : targets;
  const baseCommand = withDispel(followerAttackCommand(view, sourceId, chosenTargets, dedicated, declarationIds),view.self.hand,dispelTarget);
  const command=withPrintedComponents(view,baseCommand,printedComponents);
  const names = Object.fromEntries(Object.entries(view.players).map(([id, player]) => [id, player.name]));
  return <section className="panel" aria-label="従者による攻撃"><h2>従者を攻撃札として使う</h2>
    <p>配置中の札は、攻撃に使うと従者から外れ、使用後は捨て札になります。取り消されても札は戻りません。</p>
    <label>攻撃に使う従者<select value={option?.cardInstanceId ?? ''} disabled={disabled} onChange={event => {
      setSourceId(event.target.value);setPrintedComponents([]); setDedicated(false); setTargets([]); setDeclarationIds([]);
    }}><option value="">従者を選択</option>{candidates.map(candidate => <option key={candidate.cardInstanceId} value={candidate.cardInstanceId}>
      {getAction(candidate.cardInstanceId)?.name ?? '従者'}（{candidate.sourceZone === 'followers' ? '配置中' : '手札'}）
    </option>)}</select></label>
    <label className="inline"><input type="checkbox" checked={dedicated} disabled={disabled || !option} onChange={event => { setDedicated(event.target.checked);setPrintedComponents([]); setDeclarationIds([]); }}/>専用の攻撃として使う</label>
    {option ? <><p>{option.range === 'near' ? '近距離' : '遠距離'} · {option.attributes.join('・')} · 使用Lv {option.useLevel} · 効果Lv {option.effectLevel} · ダメージ {option.damage} · {option.hitCount}回攻撃</p>
      <p>{option.noChecks ? 'この専用攻撃は使用チェック不要です。' : '通常の技と同じ使用条件で判定します。従者の士気免除とは別です。'}</p>
      <FollowerAttackTargets option={effectiveOption!} names={names} selected={targets} disabled={disabled} change={setTargets}/></> : null}
    <DeclarationFields candidate={declarationCandidate} selected={declarationIds} disabled={disabled} onChange={setDeclarationIds}/>
    <PrintedCombinationFields view={view} command={baseCommand} selected={printedComponents} disabled={disabled} onChange={setPrintedComponents}/><DispelFields hand={view.self.hand} targets={command?.type==='ATTACK'?command.targetIds:[]} names={names} targetId={dispelTarget} disabled={disabled} onChange={setDispelTarget}/>
    <button disabled={disabled || !command} onClick={() => { if (command) send(command); }}>従者で攻撃する</button>
  </section>;
}
