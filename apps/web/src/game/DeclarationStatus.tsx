import type { PlayerView } from '@madou/engine';

const labels = { pending: '使用待ち', resolving: '判定・反応待ち', accepted: '成立', failed: '不成立' };
export function DeclarationStatus({ selection }: { selection: PlayerView['declarationSelection'] }) {
  if (!selection?.abilities.length) return null;
  return <section className="panel" aria-label="選択した能力の進行"><h2>この技と一緒に使う能力</h2>
    <ul>{selection.abilities.map(ability => <li key={ability.abilityId}>{ability.name}: {labels[ability.status]}</li>)}</ul>
    <p role="status">{selection.committed ? '技の使用条件は確定しました。' : '能力と必要な判定を解決しています。支払ったカードは戻りません。'}</p>
  </section>;
}
