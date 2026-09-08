import { getAction } from '@madou/catalog';
import { toggleSelection } from './commands.js';
import type { FollowerInputView } from './follower-input.js';

export function FollowerDefenseFields({ view, selected, disabled, onChange }: {
  view: FollowerInputView; selected: string[]; disabled: boolean; onChange: (ids: string[]) => void;
}) {
  if (view.activeWindow?.kind !== 'normal-defense' || view.activeWindow.pendingActorId !== view.self.id || !view.legalChoices.includes('START_FOLLOWERS')) return null;
  const options = view.followerDefenseOptions.filter(option => view.self.followers.some(card => card.cardInstanceId === option.cardInstanceId));
  if (!options.length) return null;
  return <fieldset><legend>従者の専用効果</legend><p>選ばなければ通常の従者として受けます。</p>
    {options.map(({ cardInstanceId }) => <label className="inline" key={cardInstanceId}><input type="checkbox" disabled={disabled} checked={selected.includes(cardInstanceId)} onChange={() => onChange(toggleSelection(selected, cardInstanceId))}/>
      {getAction(cardInstanceId)?.name ?? '従者'}の専用効果を使う</label>)}
  </fieldset>;
}
