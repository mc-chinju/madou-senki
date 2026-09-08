import { DeclarationFields } from './DeclarationFields.js';
import { candidateFor } from './declaration-input.js';
import { getAction } from '@madou/catalog';
import type { PlayerView } from '@madou/engine';
import type { GameCommand } from '@madou/protocol';
import { useState } from 'react';
import { magicGateCardId, magicGateCommand } from './magic-gate-input.js';

export function MagicGatePanel({ view, disabled, send }: { view: PlayerView; disabled: boolean; send: (command: GameCommand) => boolean }) {
  const [declarationIds, setDeclarationIds] = useState<string[]>([]);
  const candidate = candidateFor(view, { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: magicGateCardId, dedicated: false, targetIds: [] });
  const [targetKey, setTargetKey] = useState('');
  const [replacement, setReplacement] = useState('');
  const [destination, setDestination] = useState('');
  if (view.activeWindow || !view.legalChoices.includes('PLAY_TURN_TECHNIQUE') || !view.self.hand.includes(magicGateCardId)) return null;
  const targets = view.magicGateTargets.flatMap(target => target.positions.map(position => ({ actorId: target.actorId, position, key: `${target.actorId}:${position}` })));
  const selected = targets.find(target => target.key === targetKey);
  const current = view.self.followers.map(card => card.cardInstanceId);
  const full = current.length >= view.self.stats.followerLimit;
  const removable = view.followerPlacementOptions.removableCardInstanceIds.filter(id => current.includes(id));
  const remaining = current.filter(id => !full || id !== replacement);
  const canChoosePosition = !full || removable.includes(replacement);
  const command = selected && destination !== '' ? magicGateCommand(view, selected.actorId, selected.position, Number(destination), full ? replacement || undefined : undefined, declarationIds) : null;
  const positions = Array.from({ length: remaining.length + 1 }, (_, index) => index);
  const label = (id: string) => getAction(id)?.name ?? '従者';
  return <section className="panel" aria-label="魔招門による従者の取得"><h2>魔招門で従者を取得する</h2>
    <p>他の参加者の従者を1枚選び、自分の列へ移します。</p>
    <label>取得する従者<select value={targetKey} disabled={disabled || !targets.length} onChange={event => { setTargetKey(event.target.value); setReplacement(''); setDestination(''); }}>
      <option value="">相手と従者の位置を選択</option>{targets.map(target => {
        const owner = view.players[target.actorId]!;
        const card = owner.followers.find(item => item.position === target.position);
        const name = card?.face === 'front' ? label(card.cardInstanceId) : '裏向き';
        return <option key={target.key} value={target.key}>{owner.name}・前から{target.position + 1}番目・{name}</option>;
      })}</select></label>
    {!targets.length ? <p>現在、取得の対象にできる従者はいません。</p> : null}
    {full ? <><p>従者の枠が埋まっています。受入れのために1枚を外します。</p>
      <label>受入れのために外す従者<select value={replacement} disabled={disabled || !removable.length} onChange={event => { setReplacement(event.target.value); setDestination(''); }}>
        <option value="">外す従者を選択</option>{removable.map(id => <option key={id} value={id}>{label(id)}</option>)}
      </select></label><p className="hint">ここで外す従者も、魔招門が取り消されても戻りません。</p>
      {!removable.length ? <p>任意に外せる従者がいないため、受入れ枠を作れません。</p> : null}
    </> : null}
    <label>取得した従者の配置先<select value={destination} disabled={disabled || !canChoosePosition} onChange={event => setDestination(event.target.value)}>
      <option value="">配置する位置を選択</option>{positions.map(position => <option key={position} value={position}>
        {position === 0 ? '先頭' : position === remaining.length ? '最後尾' : `前から${position + 1}番目`}{remaining[position] ? `（${label(remaining[position]!)}の前）` : ''}
      </option>)}
    </select></label>
    <p className="hint">裏向きの従者は取得時に配置条件を確認します。取得できなくても、使用した札は戻りません。</p>
    <DeclarationFields candidate={candidate} selected={declarationIds} disabled={disabled} onChange={setDeclarationIds}/>
    <button disabled={disabled || !command} onClick={() => { if (command) send(command); }}>魔招門を使う</button>
  </section>;
}
