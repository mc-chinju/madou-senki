import type { PlayerView } from '@madou/engine';

export type SetupView = Pick<PlayerView, 'phase' | 'pending' | 'seatOrder' | 'legalChoices'> & {
  logs?: readonly { type: string; actorId?: string | undefined }[];
  players: Record<string, { name: string }>;
  self: { id: string; followers: unknown[]; stats: { followerLimit: number } };
};

/** Public per-seat progress of the current concurrent setup round (G10). */
export function setupSeatLabel(view: SetupView, id: string): '配置中' | '準備完了' | '対象外' {
  if (!view.pending?.participantIds.includes(id)) return '対象外';
  return view.pending.readyIds.includes(id) ? '準備完了' : '配置中';
}

export function FollowerPositionChoice({ value, disabled, onChange }: {
  value: 'front' | 'back'; disabled: boolean; onChange: (value: 'front' | 'back') => void;
}) {
  return <label>置く位置
    <select value={value} disabled={disabled} onChange={event => onChange(event.target.value as 'front' | 'back')}>
      <option value="back">後ろに置く</option>
      <option value="front">前に置く（最前線）</option>
    </select>
  </label>;
}

/** Followers this seat placed in the round before the current one: the refill drew the same number (public log only). */
export function placedLastRound(view: SetupView): number {
  let count = 0, passed = false;
  for (const entry of [...(view.logs ?? [])].reverse()) {
    if (entry.actorId !== view.self.id) continue;
    if (entry.type === 'SETUP_PASSED') { if (passed) break; passed = true; }
    else if (entry.type === 'FOLLOWER_PLACED' && passed) count++;
  }
  return count;
}

/** One-line progress for the sticky command bar: stays in view next to the hand while the panel above scrolls away. */
export function setupStatusText(view: SetupView, selected?: { name: string; placeable: boolean }, canPlace = true): string {
  const pending = view.pending;
  if (view.phase !== 'setup' || !pending) return '';
  const waiting = pending.participantIds.filter(id => id !== view.self.id && !pending.readyIds.includes(id)).map(id => view.players[id]?.name ?? id);
  const others = waiting.length ? `${waiting.join('、')}の配置を待っています。` : '';
  const mine = setupSeatLabel(view, view.self.id);
  if (mine === '対象外') return `このラウンドは対象外です。${others}`;
  if (mine === '準備完了') return `準備完了しました。${others}`;
  const limit = view.self.stats.followerLimit;
  const count = `現在 ${view.self.followers.length} / ${limit}枚`;
  if (selected?.placeable) return `「${selected.name}」を選択中。「従者を置く」で配置します（${count}）。`;
  if (view.self.followers.length >= limit) return `従者は上限の${limit}枚です。「配置を終える」で準備完了にしてください。`;
  if (selected) return `「${selected.name}」は従者として置けません。`;
  const drawn = pending.round > 1 ? placedLastRound(view) : 0;
  const refill = pending.round > 1 ? (drawn ? `補充で${drawn}枚引きました。` : '手札を補充しました。') : '';
  if (!canPlace) return `${refill}置ける従者はありません（${count}）。${pending.round > 1 ? 'もう一度' : ''}「配置を終える」で準備完了にしてください。`;
  return `${refill}${pending.round > 1 ? '引いた従者があれば置けます' : '手札の従者を選んで置けます'}（${count}）。`;
}

/** Round, ready count and the next step; a placing seat also gets a jump to its hand, which starts far below the fold. */
export function SetupCommandStatus({ view, selected, canPlace, onShowHand }: {
  view: SetupView; selected?: { name: string; placeable: boolean } | undefined; canPlace: boolean; onShowHand?: (() => void) | undefined;
}) {
  const pending = view.pending;
  if (view.phase !== 'setup' || !pending) return null;
  // Remount on progress so the change is noticeable wherever the board is scrolled.
  return <div className="setup-status" key={`${pending.round}:${pending.readyIds.length}`}>
    <p role="status" tabIndex={-1}>
      <strong>初期配置 ラウンド{pending.round}</strong>
      <span className="tag">準備完了 {pending.readyIds.length} / {pending.participantIds.length}席</span>
      <span>{setupStatusText(view, selected, canPlace)}</span>
    </p>
    {onShowHand && setupSeatLabel(view, view.self.id) === '配置中'
      ? <button type="button" className="secondary compact" onClick={onShowHand}>手札へ</button> : null}
  </div>;
}

/** The front/back choice once something is placed and another follower can still go down; rendered after the buttons so they keep their place. */
export function SetupPositionChoice({ view, canPlace, position, disabled, onPosition }: {
  view: SetupView; canPlace: boolean; position: 'front' | 'back'; disabled: boolean; onPosition: (value: 'front' | 'back') => void;
}) {
  if (view.phase !== 'setup' || !view.pending) return null;
  const placing = setupSeatLabel(view, view.self.id) === '配置中' && view.legalChoices.includes('PLACE_INITIAL_FOLLOWER');
  return placing && canPlace && view.self.followers.length
    ? <FollowerPositionChoice value={position} disabled={disabled} onChange={onPosition} /> : null;
}

export function SetupPanel({ view }: { view: SetupView }) {
  const pending = view.pending;
  if (view.phase !== 'setup' || !pending) return null;
  const name = (id: string) => view.players[id]?.name ?? id;
  const waiting = pending.participantIds.filter(id => !pending.readyIds.includes(id));
  const mine = setupSeatLabel(view, view.self.id);
  return <section className="panel" aria-label="初期配置の進行">
    <h2>初期配置 ラウンド{pending.round}</h2>
    <p>{mine === '対象外' ? 'このラウンドは対象外です。' :
      mine === '準備完了' ? '準備完了しました。' :
      pending.round > 1 ? '補充で引いた従者があれば置けます。' : '手札の従者を置けます。'}
      {mine !== '対象外' ? ` 現在 ${view.self.followers.length} / ${view.self.stats.followerLimit}枚` : ''}</p>
    {waiting.length ? <p>全員の準備完了を待っています（未完了: {waiting.map(name).join('、')}）</p> : null}
    {mine === '配置中'
      ? <p className="hint">配置は順不同です。手札の従者を選んで「従者を置く」、置き終えたら「配置を終える」で準備完了にしてください。2枚目からは置く位置（前 / 後ろ）を選べます。</p>
      : <p className="hint">ほかの席の配置が終わると、補充して次へ進みます。操作は不要です。</p>}
  </section>;
}
