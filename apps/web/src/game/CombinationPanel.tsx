import { useState } from 'react';
import { getAction } from '@madou/catalog';
import type { GameCommand } from '@madou/protocol';
import { coSourceKey, combinationDefenseCommand, groupDefenseCommand, techniqueDecisionCommand, type CoSource, type CombinationInputView } from './combination-input.js';
import { toggleSelection } from './commands.js';

function AdvanceCosts({ pool, selected, disabled, change }: { pool: string[]; selected: string[]; disabled: boolean; change: (ids: string[]) => void }) {
  return <fieldset><legend>消費する踏み込み</legend>{pool.map(id => <label className="inline" key={id}>
    <input type="checkbox" checked={selected.includes(id)} disabled={disabled} onChange={() => change(toggleSelection(selected, id))}/>
    {getAction(id)?.name ?? '踏み込み'}
  </label>)}{!pool.length ? <p>消費できる踏み込みはありません。</p> : null}</fieldset>;
}
export function AttackCostFields({ view, cardId, dedicated, coSource, advances, disabled, onCoSource, onAdvances, coSourceOptions, allowNoCoSource }: {
  view: CombinationInputView; cardId: string; dedicated: boolean; coSource: CoSource | undefined; advances: string[];
  disabled: boolean; onCoSource: (source: CoSource | undefined) => void; onAdvances: (ids: string[]) => void;
  coSourceOptions?: CoSource[]; allowNoCoSource?: boolean;
}) {
  if (!dedicated) return null;
  const projected = view.combinationOptions.find(option => option.cardInstanceId === cardId)?.coSources;
  const combinations = coSourceOptions ?? projected;
  const allowNone = allowNoCoSource ?? true;
  const advancePool = view.advanceCostOptions.find(option => option.cardInstanceId === cardId);
  return <>{combinations?.length ? <><label>組み合わせる技<select value={coSource ? coSourceKey(coSource) : ''} disabled={disabled} onChange={event => onCoSource(combinations.find(option => coSourceKey(option) === event.target.value))}>
    <option value="">{allowNone ? '組み合わせない' : '組み合わせる技を選択'}</option>{combinations.map(option => <option key={coSourceKey(option)} value={coSourceKey(option)}>
      {getAction(option.cardInstanceId)?.name}{view.self.followers?.some(card => card.cardInstanceId === option.cardInstanceId) ? '（配置中）' : view.self.chants.some(card => card.cardInstanceId === option.cardInstanceId) ? '（詠唱中）' : ''}（{option.dedicated ? '専用' : '通常'}{option.techniqueVariant ? `・${option.techniqueVariant === 'one-hit' ? '1発' : option.techniqueVariant === 'two-hit' ? '2発' : option.techniqueVariant === 'lancelot-1' ? '変身前' : '変身後'}` : ''}）
    </option>)}
  </select></label>{coSource ? <p>獣王剣と{getAction(coSource.cardInstanceId)?.name}を同時に使います。取り消されても2枚は戻りません。{view.self.followers?.some(card => card.cardInstanceId === coSource.cardInstanceId) ? '配置中の従者は列から外れ、防御には使えなくなります。' : ''}</p> : null}</> : null}
  {advancePool ? <><AdvanceCosts pool={advancePool.advanceCardInstanceIds.filter(id => view.self.hand.includes(id))} selected={advances} disabled={disabled} change={onAdvances}/>
    <p>追加の消費: {advances.length}枚。効果Lvを{advances.length}上げます。この消費では補充しません。</p></> : null}</>;
}
export function CombinationPanel({ view, names, disabled, send }: { view: CombinationInputView; names: Record<string, string>; disabled: boolean; send: (command: GameCommand) => boolean }) {
  const [advances, setAdvances] = useState<string[]>([]);
  const [defenseSource, setDefenseSource] = useState<CoSource | undefined>();
  const composite = view.activeWindow?.kind === 'normal-defense' && view.activeWindow.pendingActorId === view.self.id && view.legalChoices.includes('PLAY_DEFENSE')
    ? view.combinationOptions.find(option => option.cardInstanceId === 'a2-p09-r1c1' && option.coSources.length > 0) : undefined;
  const decision = view.techniqueDecision;
  const options = view.groupDefenseOptions;
  if (!decision && !options.length && !composite) return null;
  const commit = (command: GameCommand | null) => { if (command) send(command); };
  return <section className="panel" aria-label="技の追加効果">
    {decision?.kind === 'damage-double' ? <><h2>黒竜剣の追加判定</h2><p>精神力の判定に成功すると、この攻撃のダメージを2倍にできます。</p>
      <div className="button-row"><button disabled={disabled || !techniqueDecisionCommand(view, [], true)} onClick={() => commit(techniqueDecisionCommand(view, [], true))}>ダメージ倍の判定を行う</button>
        <button className="secondary" disabled={disabled || !techniqueDecisionCommand(view, [], false)} onClick={() => commit(techniqueDecisionCommand(view, [], false))}>判定しない</button></div></> : null}
    {decision?.kind === 'hit-advance' ? <><h2>黒翼天翔剣の追加ダメージ</h2>
      <p>踏み込み1枚につき5点を加算します。この攻撃の、まだダメージが確定していない命中に適用します。</p>
      <AdvanceCosts pool={decision.cardInstanceIds.filter(id => view.self.hand.includes(id))} selected={advances} disabled={disabled} change={setAdvances}/>
      <p>消費{advances.length}枚・加算{advances.length * 5}点。まとめて一度だけ支払います。</p>
      <div className="button-row"><button disabled={disabled || !advances.length || !techniqueDecisionCommand(view, advances)} onClick={() => commit(techniqueDecisionCommand(view, advances))}>踏み込みを消費して追加する</button>
        <button className="secondary" disabled={disabled || !techniqueDecisionCommand(view, [])} onClick={() => commit(techniqueDecisionCommand(view, []))}>追加しない</button></div></> : null}
    {composite ? <><h2>獣王剣を組み合わせて防御する</h2>
      <AttackCostFields view={view} cardId={composite.cardInstanceId} dedicated coSource={defenseSource} advances={[]} disabled={disabled} onCoSource={setDefenseSource} onAdvances={() => {}}/>
      <button disabled={disabled || !combinationDefenseCommand(view, defenseSource)} onClick={() => commit(combinationDefenseCommand(view, defenseSource))}>獣王剣の組み合わせで防御する</button></> : null}
    {options.map(option => <div key={`${option.groupId}:${option.cardInstanceId}`}><h2>光王陣で他の人を守る</h2>
      <p>対象: {option.targetIds.map(id => names[id] ?? '参加者').join('・')}。この組の防御中の命中をまとめて受けます。</p>
      <p>精神力−3の判定に成功すると対象の命中を無効にし、元の攻撃者へ光王陣で1回反撃します。</p>
      <button disabled={disabled || !groupDefenseCommand(view, option.cardInstanceId, option.groupId)} onClick={() => commit(groupDefenseCommand(view, option.cardInstanceId, option.groupId))}>光王陣でまとめて防ぐ</button>
    </div>)}
  </section>;
}
