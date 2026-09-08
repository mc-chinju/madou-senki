import { useState } from 'react';
import { getAction } from '@madou/catalog';
import type { GameCommand } from '@madou/protocol';
import { FollowerAttackTargets } from './FollowerAttackPanel.js';
import { followerBundleCommand, type FollowerBundleChoice, type FollowerBundleInputView, type FollowerBundleSource } from './follower-bundle-input.js';

type Names = Record<string, string>;
export function FollowerBundleSourceFields({ option, choice, dedicatedAvailable, names, disabled, change }: {
  option: FollowerBundleSource; choice: FollowerBundleChoice; dedicatedAvailable: boolean; names: Names; disabled: boolean; change: (choice: FollowerBundleChoice) => void;
}) {
  return <fieldset><legend>{getAction(option.cardInstanceId)?.name ?? '従者'}（{option.sourceZone === 'followers' ? '配置中' : '手札'}）</legend>
    {dedicatedAvailable ? <label className="inline"><input type="checkbox" checked={choice.dedicated} disabled={disabled}
      onChange={event => change({ ...choice, dedicated: event.target.checked, targetIds: [] })}/>専用効果を使う</label> : null}
    <p>{option.range === 'near' ? '近距離' : '遠距離'} · {option.attributes.join('・')} · 使用Lv {option.useLevel} · 効果Lv {option.effectLevel} · ダメージ {option.damage} · {option.hitCount}回攻撃</p>
    <p>{option.noChecks ? 'この専用攻撃は使用チェック不要です。' : '通常の使用条件で判定します。士気免除とは別です。'}</p>
    <FollowerAttackTargets option={option} names={names} selected={choice.targetIds} disabled={disabled} inputName={`follower-bundle-target-${option.cardInstanceId}`}
      change={targetIds => change({ ...choice, targetIds })}/>
  </fieldset>;
}
export function FollowerBundlePanel({ view, disabled, send }: {
  view: FollowerBundleInputView & { players: Record<string, { name: string }> }; disabled: boolean; send: (command: GameCommand) => boolean;
}) {
  const [abilityId, setAbilityId] = useState('');
  const [nextSourceId, setNextSourceId] = useState('');
  const [sources, setSources] = useState<FollowerBundleChoice[]>([]);
  if (view.activeWindow || !view.legalChoices.includes('USE_FOLLOWER_ATTACK') || !view.followerBundleOptions.length) return null;
  const ability = view.followerBundleOptions.find(option => option.abilityId === abilityId);
  const pool = (ability?.sources ?? []).filter(option => option.sourceZone === 'hand'
    ? view.self.hand.includes(option.cardInstanceId) : view.self.followers.some(card => card.cardInstanceId === option.cardInstanceId));
  const available = pool.filter(option => !option.dedicated && !sources.some(source => source.cardInstanceId === option.cardInstanceId));
  const names = Object.fromEntries(Object.entries(view.players).map(([id, player]) => [id, player.name]));
  const normalized = sources.map(source => {
    const option = pool.find(candidate => candidate.cardInstanceId === source.cardInstanceId && candidate.dedicated === source.dedicated);
    return { ...source, targetIds: option?.targetMode === 'mandatory-all' ? [...option.legalTargetIds] : source.targetIds };
  });
  const command = ability ? followerBundleCommand(view, ability.abilityId, ability.targetEventId, normalized) : null;
  function move(index: number, direction: number) {
    setSources(current => { const result = [...current]; const other = index + direction;
      if (other >= 0 && other < result.length) [result[index], result[other]] = [result[other]!, result[index]!];
      return result;
    });
  }
  return <section className="panel" aria-label="複数従者の攻撃"><h2>従者をまとめて攻撃に使う</h2>
    <p>選んだ札を一度に使い、下の順番でそれぞれの技を処理します。配置中の札は従者から外れます。取り消されても、札は戻りません。</p>
    <label>使う能力<select value={ability?.abilityId ?? ''} disabled={disabled} onChange={event => {
      setAbilityId(event.target.value); setNextSourceId(''); setSources([]);
    }}><option value="">能力を選択</option>{view.followerBundleOptions.map(option => <option key={option.abilityId} value={option.abilityId}>{option.name}</option>)}</select></label>
    {ability ? <><label>追加する従者<select value={nextSourceId} disabled={disabled} onChange={event => setNextSourceId(event.target.value)}>
      <option value="">従者を選択</option>{available.map(option => <option key={option.cardInstanceId} value={option.cardInstanceId}>
        {getAction(option.cardInstanceId)?.name ?? '従者'}（{option.sourceZone === 'followers' ? '配置中' : '手札'}）
      </option>)}</select></label>
      <button className="secondary" disabled={disabled || !available.some(option => option.cardInstanceId === nextSourceId)} onClick={() => {
        const selectedId = nextSourceId;
        if (available.some(option => option.cardInstanceId === selectedId)) setSources(current => [...current, { cardInstanceId: selectedId, dedicated: false, targetIds: [] }]);
        setNextSourceId('');
      }}>攻撃に加える</button>
      <ol>{sources.map((source, index) => {
        const option = pool.find(candidate => candidate.cardInstanceId === source.cardInstanceId && candidate.dedicated === source.dedicated);
        if (!option) return <li key={source.cardInstanceId}>この選択は使えなくなりました。</li>;
        return <li key={source.cardInstanceId}>
          <FollowerBundleSourceFields option={option} choice={source} names={names} disabled={disabled}
            dedicatedAvailable={pool.some(candidate => candidate.cardInstanceId === source.cardInstanceId && candidate.dedicated)}
            change={choice => setSources(current => current.map(item => item.cardInstanceId === source.cardInstanceId ? choice : item))}/>
          <div className="button-row"><button className="secondary" disabled={disabled || index === 0} onClick={() => move(index, -1)}>前へ</button>
            <button className="secondary" disabled={disabled || index === sources.length - 1} onClick={() => move(index, 1)}>後へ</button>
            <button className="secondary" disabled={disabled} onClick={() => setSources(current => current.filter(item => item.cardInstanceId !== source.cardInstanceId))}>選択から外す</button></div>
        </li>;
      })}</ol></> : null}
    <button disabled={disabled || !command} onClick={() => { if (command) send(command); }}>選んだ従者で攻撃する</button>
  </section>;
}
