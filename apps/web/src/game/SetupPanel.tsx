import type { PlayerView } from '@madou/engine';

export type SetupView = Pick<PlayerView, 'phase' | 'pending' | 'seatOrder' | 'legalChoices'> & {
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

export function SetupPanel({ view, position, disabled, onPosition }: {
  view: SetupView; position: 'front' | 'back'; disabled: boolean; onPosition: (value: 'front' | 'back') => void;
}) {
  const pending = view.pending;
  if (view.phase !== 'setup' || !pending) return null;
  const name = (id: string) => view.players[id]?.name ?? id;
  const waiting = pending.participantIds.filter(id => !pending.readyIds.includes(id));
  const mine = setupSeatLabel(view, view.self.id);
  return <section className="panel" aria-label="初期配置の進行">
    <h2>初期配置 ラウンド{pending.round}</h2>
    <p>{mine === '対象外' ? 'この卓のこのラウンドでは、あなたは配置できません。' :
      mine === '準備完了' ? '準備完了しました。' :
      pending.round > 1 ? '補充で引いた従者があれば置けます。' : '手札の従者を置けます。'}
      {mine !== '対象外' ? ` 現在 ${view.self.followers.length} / ${view.self.stats.followerLimit}枚` : ''}</p>
    {waiting.length ? <p role="status">全員の準備完了を待っています（未完了: {waiting.map(name).join('、')}）</p> : null}
    {mine === '配置中' && view.legalChoices.includes('PLACE_INITIAL_FOLLOWER') && view.self.followers.length
      ? <FollowerPositionChoice value={position} disabled={disabled} onChange={onPosition} /> : null}
    <p className="hint">配置は順不同です。置き終えたら「従者を置かず進む」で準備完了にしてください。</p>
  </section>;
}
