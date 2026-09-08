import { DeclarationFields } from './DeclarationFields.js';
import { candidateFor } from './declaration-input.js';
import { getAction, getCharacter } from '@madou/catalog';
import type { PlayerView } from '@madou/engine';
import type { GameCommand, TechniqueVariant } from '@madou/protocol';
import { useState } from 'react';
import { abilityCommand, grantedAttackCommand, grantedAttackSources, selectableAbilities, type AbilityOption, type AbilityInputView } from './ability-input.js';
import { techniqueVariants } from './commands.js';
import { AttackCostFields } from './CombinationPanel.js';
import { coSourceKey, type CoSource } from './combination-input.js';

const mentalDefenseDescription = '同じ攻撃につき1回、攻撃者に精神力−1の判定を要求します。失敗すると自分への残りの発を無効にします。ゾロ目なら成否にかかわらず自分への攻撃を無効にし、攻撃者の次の手番が来るまで停止させます。反撃・反射された攻撃には使えません。';
const fixedAllegianceDescription = '陣営を変更できない人物は目的と敗北条件も変わりませんが、攻撃の無効と停止は残ります。';
const descriptions: Record<string, string> = {
  'c2-p03-r2c1-ab01': `${mentalDefenseDescription}6のゾロ目ならレスターと同じ陣営へ転向し、目的は「EVILの全滅」、敗北条件は「リーア姫の死亡」に変わります。${fixedAllegianceDescription}`,
  'c2-p06-r1c2-ab01': `${mentalDefenseDescription}6のゾロ目ならディアと同じ陣営へ転向し、目的は「ディアと敵対するものの全滅」、敗北条件は「愛しいディアの死亡」に変わります。対象陣営は転向した時点で確定します。${fixedAllegianceDescription}`,
  'c2-p06-r1c1-ab01': `${mentalDefenseDescription}6のゾロ目なら攻撃者への死亡効果が確定します。宣言済みの他の対象への攻撃が終わってから、死亡時の処理へ進みます。`,
  'c2-p01-r2c1-ab05': '自分とイダが公開されているとき、イダが宣言中の影分身の今回の使用を取り消します。自分の攻撃でなくても使えます。この能力が取り消されても、同じ使用への再試行はできません。',
  'c2-p07-r1c1-ab02': '公開されたガイナスが自分の攻撃に宣言した魔導王の威厳の、今回の使用を取り消します。この能力が取り消されても、同じ使用への再試行はできません。',
  'c2-p03-r1c1-ab02': 'この1発の魔法ダメージの半減を予約します。従者のHPによる軽減や命中時の処理の後、抵抗失敗による追加も含めて半減し、端数を切り捨てます。確定前に停止・能力無効になると半減しません。',
  'c2-p03-r1c2-ab01': '精神力−3の判定に成功すると、別のサイコロ1個の出目だけ、この1発の効果Lvを下げます。0以下になるとこの1発を無効にします。',
  'c2-p07-r1c1-ab01': '精神力−5の判定に成功すると、自分の戦士Lv以下の技を無効にする予約を得ます。通常防御中に効果Lvが下がれば再評価し、判定は繰り返しません。白銀の鎧とは別に選択します。',
  'c2-p05-r2c2-ab02': '精神力−5の判定に成功すると、この1発を反撃扱いで元の攻撃者へ跳ね返します。距離は問いません。反撃禁止の技には使えません。',
  'c2-p01-r1c1-ab01': '自分への効果Lv5以下の技、または従者で受ける前のダメージが5点以下の技を無効にします。ダメージのない技も含みます。条件を満たす前に予約することもできます。',
  'c2-p02-r1c2-ab01': '自分が受ける魔法技について、この1発の効果Lvを1下げます。他の対象や次の発、ダメージは変わりません。',
  'c2-p02-r1c2-ab02': '自分への効果Lv3以下の技を無効にします。先に予約し、通常防御中に後から効果Lvが下がるのを待つこともできます。',
  'c2-p02-r2c2-ab01': '自分への黒技の効果Lvを1下げ、その後、効果Lv4以下の技を無効にします。両方をまとめて選択します。条件を満たす前に予約することもできます。',
  'c2-p03-r1c1-ab01': '自分への効果Lv3以下の技を無効にします。先に予約し、通常防御中に後から効果Lvが下がるのを待つこともできます。',
  'c2-p03-r2c2-ab01': '自分が受ける魔法技について、この1発の効果Lvを1下げます。他の対象や次の発、ダメージは変わりません。',
  'c2-p04-r1c1-ab01': '自分への炎・水の技を無効にします。戦士技・魔法技のどちらにも働きます。',
  'c2-p05-r2c1-ab01': '自分への効果Lv4以下の戦士技を無効にします。先に予約し、通常防御中に後から効果Lvが下がるのを待つこともできます。',
  'c2-p05-r2c2-ab01': '自分への効果Lv5以下の技を無効にします。先に予約し、通常防御中に後から効果Lvが下がるのを待つこともできます。',
  'c2-p06-r2c1-ab01': '自分への炎・水の技を無効にします。戦士技・魔法技のどちらにも働きます。',
  'c2-p07-r1c2-ab01': '自分への効果Lv5以下の技を無効にします。先に予約し、通常防御中に後から効果Lvが下がるのを待つこともできます。',
  'c2-p02-r2c1-ab01': '戦士技の攻撃に必要な間合いを1枚追加します。元の必要枚数に加えるので、2枚必要な技なら3枚になります。',
  'c2-p03-r2c2-ab03': '弓技を見切り不可にし、効果Lv+1・ダメージ+2をまとめて使用します。',
  'c2-p05-r1c2-ab03': '戦士技で獣の従者を無視します。相手本人に1点以上与えた場合、その攻撃で無視した獣を選んで手札にできます。',
  'c2-p02-r2c1-ab02': 'この戦士技が到達した従者のうち、竜属性の従者を破壊します。前列で防がれた後列には届きません。',
  'c2-p02-r2c2-ab02': 'この剣技で黒または死の従者を破壊し、ガドューラへのダメージを2倍にします。両方を一度の選択で予約します。破壊は攻撃が到達した従者だけに働きます。',
  'c2-p04-r1c2-ab01': 'この剣技または風技が到達した従者のうち、補正込みで確定した従者Lvが6以下のものを破壊します。前列で防がれた後列には届きません。',
  'c2-p06-r1c1-ab03': 'この攻撃が到達した人属性の従者を破壊します。仮想女性親衛隊も対象ですが、物理の札にはなりません。',
  'c2-p01-r1c1-ab02': 'この魔法技の効果Lvを1上げます。使用Lvやダメージは変わりません。',
  'c2-p01-r1c2-ab02': '格闘技の効果Lvを自分の戦士Lvまで上げ、他の加算を続けます。元の方が高ければ下げません。ダメージ計算時に別のサイコロ1個を振って加えます。',
  'c2-p01-r2c1-ab03': '精神力の判定に成功すると、この技の効果Lvを1上げます。効果Lvが確定した後には使えません。',
  'c2-p03-r1c1-ab03': '宣言時、この戦士技の使用Lvがあなたの戦士Lv以下なら、ダメージを2倍にします。弓技には使えません。',
  'c2-p05-r1c1-ab02': '黒魔法の効果Lvを、サイコロ1個の出目だけ上げます。使用Lvやダメージは変わりません。',
  'c2-p03-r2c1-ab02': '使う効果を一つ以上選んでください。精神化しても戦士技・魔法技の区分は変わりません。',
  'c2-p03-r2c2-ab02': 'この攻撃を受ける仮想従者を列の先頭に置きます。各発に従者LvとHPを適用し、この攻撃の後処理で消えます。',
  'c2-p02-r1c1-ab02': '踏み込みを1枚消費し、この対象への残った攻撃で従者を無視します。無視を無効にする従者の効果は残ります。取り消されても札は戻りません。',
  'c2-p04-r2c2-ab01': '精神力−2の判定に成功し、相手が精神力−2の判定に失敗すると、この攻撃を無効にし、その相手へ1回攻撃できます。',
  'c2-p04-r2c2-ab02': 'この格闘技で従者を無視します。',
  'c2-p04-r2c2-ab03': 'サイコロ2個がゾロ目なら即死、連続する目ならこの命中のダメージが2倍になります。1と6は連続に含みません。',
  'c2-p04-r2c2-ab04': '自分の手番行動を使い、間合いを1枚消費して耐久力を2点回復します。取り消されても行動と札は戻りません。',
};
export function AbilityChoice({ view, option, disabled, send }: { view: AbilityInputView; option: AbilityOption; disabled: boolean; send: (command: GameCommand) => boolean }) {
  const [cost, setCost] = useState(''); const [conceal, setConceal] = useState(false);
  const [target, setTarget] = useState('');
  const [effects, setEffects] = useState<string[]>([]);
  const selectedTarget = option.targetIds?.includes(target) ? target : '';
  const command = abilityCommand(view, option.abilityId, cost || undefined, conceal, effects, selectedTarget || undefined);
  return <div className="panel"><h3>{option.name}</h3><p>{option.description ?? descriptions[option.abilityId] ?? 'この能力の使用を宣言します。'}</p>
    {option.actionCost ? <p className="hint">{option.actionCost === 'main' ? '通常の行動を使います。取り消されても行動は戻りません。' : '通常の行動とは別に、自分の手番中に一度だけ試せます。取消・判定失敗でも試行は戻りません。'}</p> : null}
    {option.targetIds ? <label>能力の対象<select disabled={disabled} value={selectedTarget} onChange={event => setTarget(event.target.value)}>
      <option value="">対象を選択</option>{option.targetIds.map(id => <option key={id} value={id}>{view.players[id]?.name ?? '参加者'}</option>)}
    </select></label> : null}
    {option.effectOptions ? <fieldset disabled={disabled}><legend>使う効果</legend>{option.effectOptions.map(effect => <label key={effect.id} className="inline"><input type="checkbox" checked={effects.includes(effect.id)}
      onChange={event => { const checked = event.target.checked; setEffects(current => checked ? [...current, effect.id] : current.filter(id => id !== effect.id)); }}/> {effect.name}</label>)}</fieldset> : null}
    {option.costCardInstanceIds ? <label>{option.abilityId === 'c2-p02-r1c1-ab02' ? '消費する踏み込み' : '消費する間合い'}<select value={cost} onChange={event => setCost(event.target.value)}>
      <option value="">カードを選択</option>{option.costCardInstanceIds.filter(id => view.self.hand.includes(id)).map(id => <option key={id} value={id}>{getAction(id)?.name ?? 'カード'}</option>)}
    </select></label> : null}
    {option.canConceal ? <label className="inline"><input type="checkbox" checked={conceal} onChange={event => setConceal(event.target.checked)}/> 正体を裏に戻す</label> : null}
    <button disabled={disabled || !command} onClick={() => { if (command) send(command); }}>{option.name}を使う</button>
  </div>;
}
export function AbilityPanel({ view, disabled, send }: { view: PlayerView; disabled: boolean; send: (command: GameCommand) => boolean }) {
  const [declarationIds, setDeclarationIds] = useState<string[]>([]);
  const [sourceId, setSourceId] = useState(''); const [dedicated, setDedicated] = useState(false); const [variant, setVariant] = useState<TechniqueVariant | ''>('');
  const [coSource, setCoSource] = useState<CoSource | undefined>();
  const [advances, setAdvances] = useState<string[]>([]);
  const clearCosts = () => { setCoSource(undefined); setAdvances([]); setDeclarationIds([]); };
  const options = selectableAbilities(view);
  if (view.activeWindow?.kind === 'ability-attack') {
    const mine = view.activeWindow.pendingActorId === view.self.id;
    const sources = grantedAttackSources(view);
    const selectedSource = sources.includes(sourceId) ? sourceId : '';
    const sourceCandidates = [...view.additionalAttackOptions, ...(view.declarationCandidates ?? []).filter(option => option.kind === 'attack').map(option => option.choice)].filter(option => option.cardInstanceId === selectedSource);
    const canUseDedicated = sourceCandidates.some(option => option.dedicated);
    const selectedDedicated = selectedSource ? dedicated && canUseDedicated : false;
    const modeCandidates = sourceCandidates.filter(option => option.dedicated === selectedDedicated);
    const projectedVariants = [...new Set(modeCandidates.flatMap(option => option.techniqueVariant ? [option.techniqueVariant] : []))];
    const variantLabels = techniqueVariants(selectedSource, getCharacter(view.self.characterId)?.name, selectedDedicated);
    const variants = variantLabels.filter(option => projectedVariants.includes(option.value));
    const selectedVariant = variants.find(option => option.value === variant)?.value ?? variants[0]?.value;
    const exactCandidates = modeCandidates.filter(option => option.techniqueVariant === selectedVariant);
    const coSources = [...new Map(exactCandidates.flatMap(option => option.coSource ? [[coSourceKey(option.coSource), option.coSource] as const] : [])).values()];
    const selectedCoSource = coSource && coSources.some(option => coSourceKey(option) === coSourceKey(coSource)) ? coSource : undefined;
    const command = grantedAttackCommand(view, selectedSource, selectedDedicated, selectedVariant, selectedCoSource, advances, declarationIds);
    const declarationCandidate = candidateFor(view, { type: 'ATTACK', cardInstanceId: selectedSource, dedicated: selectedDedicated, targetIds: view.additionalAttack ? [view.additionalAttack.targetId] : [], ...(selectedVariant ? { techniqueVariant: selectedVariant } : {}), ...(selectedCoSource ? { coSource: selectedCoSource } : {}) });
    const grant = view.additionalAttack;
    const target = grant?.targetId;
    const title = grant?.source === 'card' ? `${grant.sourceCardInstanceId ? getAction(grant.sourceCardInstanceId)?.name ?? 'カード' : 'カード'}による追加攻撃` : '能力による追加攻撃';
    return <aside className="decision" aria-label={title}><h2>{title}を選ぶ</h2>
      <p role="status">{mine ? 'あなたの判断です' : `${view.players[view.activeWindow.pendingActorId]?.name}さんの判断を待っています`}</p>
      <p>対象: {target ? view.players[target]?.name : '元の攻撃者'}。手札・詠唱中・配置中の候補から攻撃札を1枚使用します。射程・詠唱・使用条件を満たす札を選んでください。</p>
      {mine ? <><label>追加攻撃に使うカード<select value={selectedSource} onChange={event => { setSourceId(event.target.value); setDedicated(false); setVariant(''); clearCosts(); }}>
        <option value="">カードを選択</option>{sources.map(id => <option key={id} value={id}>{getAction(id)?.name ?? 'カード'}{view.self.followers.some(card => card.cardInstanceId === id) ? '（配置中）' : view.self.chants.some(card => card.cardInstanceId === id) ? '（詠唱中）' : ''}</option>)}
      </select></label><label className="inline"><input type="checkbox" checked={selectedDedicated} disabled={!canUseDedicated} onChange={event => { setDedicated(event.target.checked); setVariant(''); clearCosts(); }}/> 専用技として使う</label>
      {view.self.followers.some(card => card.cardInstanceId === selectedSource) ? <p>この札は従者の列から外れます。使用後は捨て札となり、取り消されても戻りません。</p> : null}
      {variants.length > 1 ? <label>追加攻撃の専用効果<select value={selectedVariant} onChange={event => { setVariant(event.target.value as TechniqueVariant); clearCosts(); }}>{variants.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
      <AttackCostFields view={view} cardId={selectedSource} dedicated={selectedDedicated} coSource={selectedCoSource} advances={advances} disabled={disabled} onCoSource={source => { setCoSource(source); setDeclarationIds([]); }} onAdvances={setAdvances}
        coSourceOptions={coSources} allowNoCoSource={exactCandidates.some(option => !option.coSource)}/>
      <DeclarationFields candidate={declarationCandidate} selected={declarationIds} disabled={disabled} onChange={setDeclarationIds}/>
      <div className="button-row"><button disabled={disabled || !command} onClick={() => { if (command) send(command); }}>追加攻撃を行う</button>
        {view.legalChoices.includes('PASS') ? <button className="secondary" disabled={disabled} onClick={() => send({ type: 'PASS' })}>追加攻撃をしない</button> : null}</div></> : null}
    </aside>;
  }
  if (!options.length) return null;
  return <section className="panel" aria-label="使える特殊能力"><h2>使える特殊能力</h2><p>使用する能力があれば選んでください。</p>
    {options.map(option => <AbilityChoice key={`${option.abilityId}:${option.targetEventId}`} view={view} option={option} disabled={disabled} send={send}/>)}</section>;
}
