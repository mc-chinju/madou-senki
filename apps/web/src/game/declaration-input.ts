import { previewDeclarationCandidate, type DeclarationCandidate, type DeclarationEffects } from '@madou/engine';
import type { GameCommand } from '@madou/protocol';

export interface DeclarationInputView { declarationCandidates?: DeclarationCandidate[] }
export type DeclarationCommand = Extract<GameCommand, { type: 'ATTACK' | 'PLAY_DEFENSE' | 'PLAY_TURN_TECHNIQUE' | 'PLAY_GROUP_DEFENSE' }>;
export function defenseCardChoices(view: DeclarationInputView, ordinaryChoices: readonly string[], dedicated: boolean): string[] {
  const declarationChoices = (view.declarationCandidates ?? [])
    .filter(candidate => candidate.kind === 'defense' && !candidate.choice.coSource && candidate.choice.dedicated === dedicated)
    .filter(candidate => {
      if (previewDeclarationCandidate(candidate, []).canDeclare) return true;
      const all = candidate.abilities.map(ability => ability.abilityId);
      if (previewDeclarationCandidate(candidate, all).canDeclare) return true;
      // Of the thirteen packages, exact replacement is the only preview effect that can lower an otherwise useful defense level.
      const withoutReplacement = candidate.abilities.filter(ability => ability.effects.effectReplacement === undefined).map(ability => ability.abilityId);
      return withoutReplacement.length !== all.length && previewDeclarationCandidate(candidate, withoutReplacement).canDeclare;
    })
    .map(candidate => candidate.choice.cardInstanceId);
  return [...new Set([...ordinaryChoices, ...declarationChoices])];
}
export function candidateFor(view: DeclarationInputView, command: DeclarationCommand | null): DeclarationCandidate | undefined {
  if (!command) return;
  const kind = command.type === 'ATTACK' ? 'attack' : command.type === 'PLAY_DEFENSE' ? 'defense' : command.type === 'PLAY_TURN_TECHNIQUE' ? 'turn-technique' : 'group-defense';
  return view.declarationCandidates?.find(candidate => candidate.kind === kind && candidate.choice.cardInstanceId === command.cardInstanceId && candidate.choice.dedicated === command.dedicated
    && candidate.choice.techniqueVariant === ('techniqueVariant' in command ? command.techniqueVariant : undefined)
    && sameSource(candidate.choice.coSource, 'coSource' in command ? command.coSource : undefined)
    && (command.type !== 'PLAY_GROUP_DEFENSE' || candidate.groupId === command.groupId));
}
function sameSource(a: DeclarationCandidate['choice']['coSource'], b: DeclarationCandidate['choice']['coSource']) {
  return a?.cardInstanceId === b?.cardInstanceId && a?.dedicated === b?.dedicated && a?.techniqueVariant === b?.techniqueVariant;
}
export function applyDeclarationSelection(view: DeclarationInputView, command: DeclarationCommand | null, selectedIds: string[]): DeclarationCommand | null {
  if (!command) return null;
  const candidate = candidateFor(view, command);
  if (!candidate) return selectedIds.length ? null : command;
  const preview = previewDeclarationCandidate(candidate, selectedIds);
  if (!preview.canDeclare) return null;
  if (command.type === 'ATTACK') {
    const targets = command.targetIds;
    const technique = preview.technique;
    if (!targets.length || new Set(targets).size !== targets.length || targets.some(id => !preview.legalTargetIds.includes(id))) return null;
    if (candidate.grantTargetId && (targets.length !== 1 || targets[0] !== candidate.grantTargetId)) return null;
    if (technique.target === 'one' && targets.length > (technique.maxTargets ?? 1)) return null;
    if (technique.mandatoryAll && targets.length !== preview.legalTargetIds.length) return null;
  }
  const { declarationAbilityIds: _old, ...base } = command;
  return { ...base, ...(selectedIds.length ? { declarationAbilityIds: [...selectedIds] } : {}) } as DeclarationCommand;
}
export function declarationEffectText(effects: DeclarationEffects): string {
  const words: string[] = [];
  if (effects.waiveChant) words.push('詠唱なしで使える');
  if (effects.noChecks) words.push('技の使用判定を省略');
  if (effects.far) words.push('遠距離へ使える');
  if (effects.allTargets) words.push('対象を複数選べる');
  if (effects.counter) words.push('反撃技として使える');
  if (effects.effectReplacement !== undefined) words.push(`効果Lvを${effects.effectReplacement}にする`);
  if (effects.effectAddition) words.push(`効果Lv+${effects.effectAddition}`);
  if (effects.effectDie) words.push('効果Lv+1d6');
  if (effects.damageAddition) words.push(`ダメージ+${effects.damageAddition}`);
  if (effects.damageDouble) words.push('ダメージ2倍');
  if (effects.damageDie) words.push('ダメージ+1d6（効果Lvとは別に振る）');
  if (effects.spiritCheck) words.push('精神力判定に成功すると有効');
  return words.join('、');
}
