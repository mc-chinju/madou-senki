import type { GameCommand, TechniqueVariant } from '@madou/protocol';
import { getAction } from '@madou/catalog';

export interface CardCommandInput {
  cardId?: string | undefined;
  targetIds?: string[] | undefined;
  targetId?: string | undefined;
  targetActionId?: string | undefined;
  targetAbilityId?: string | undefined;
  targetRollId?: string | undefined;
  dedicated?: boolean;
  declarationAbilityIds?: string[];
  techniqueVariant?: TechniqueVariant | undefined;
  reactionMode?: 'cancel-ability' | 'cancel' | 'force-fail' | 'effect-plus' | 'reroll' | undefined;
}

export function reactionModes(windowKind: string, rollKind: 'check' | 'numeric' | undefined, hasRollTarget: boolean, hasAbilityTarget: boolean): NonNullable<CardCommandInput['reactionMode']>[] {
  if (hasRollTarget) return [...(windowKind === 'after-roll' ? ['reroll' as const] : []), ...(rollKind === 'check' ? ['force-fail' as const] : [])];
  if (hasAbilityTarget) return ['cancel-ability'];
  if (windowKind === 'declaration') return ['cancel'];
  return windowKind === 'effect-level' ? ['effect-plus'] : [];
}

export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
}

export function arrangeFollowers(current: readonly string[], id: string, operation: 'add' | 'remove', limit: number): string[] {
  if (operation === 'remove') return current.filter((item) => item !== id);
  if (current.includes(id) || current.length >= limit) return [...current];
  return [...current, id];
}

export function moveFollower(current: readonly string[], id: string, offset: -1 | 1): string[] {
  const from = current.indexOf(id); const to = from + offset;
  if (from < 0 || to < 0 || to >= current.length) return [...current];
  const result = [...current]; [result[from], result[to]] = [result[to]!, result[from]!]; return result;
}

export function discardRequirement(handCount: number, handLimit: number, selected: readonly string[]) {
  const required = Math.max(0, handCount - handLimit);
  return { required, valid: selected.length === required };
}

interface ReactionContext {
  faction?: string | undefined;
  limitedDefenses?: readonly ('teleport' | 'counter')[] | undefined;
  incomingAttributes?: readonly string[] | undefined;
  incomingEffectLevel?: number | undefined;
  statusKinds?: readonly string[] | undefined;
  rollKind?: 'check' | 'numeric' | undefined;
  characterName?: string | undefined;
  dedicated?: boolean;
  defenseRestrictions?: { maaiProhibited: boolean; evadeProhibited: boolean; counterProhibited: boolean } | undefined;
}
const dedicatedCounterOwners: Readonly<Record<string, string>> = {
  'a2-p10-r2c1': '侍大将のシン',
  'a2-p14-r1c2': '白魔術師シェリム',
};

export function eligibleReactionCards(choice: string, hand: readonly string[], chants: readonly string[], mode: CardCommandInput['reactionMode'] = 'cancel', context: ReactionContext = {}): string[] {
  if (context.statusKinds?.includes('stopped')) return [];
  const source = choice === 'PLAY_DEFENSE' ? [...hand, ...chants] : [...hand];
  return source.filter(id => {
    const card = getAction(id); if (!card) return false;
    const printed = Array.isArray(card.printed_category) ? card.printed_category.join('/') : card.printed_category ?? '';
    if (choice === 'PLAY_DEFENSE') {
      if (id === 'a2-p13-r2c2' && context.incomingAttributes?.some(attribute => attribute === '炎' || attribute === '風')) return false;
      if (id === 'a2-p16-r3c3' && context.faction !== undefined && context.faction !== 'GOOD') return false;
      const attributes = card.stats?.attributes;
      if (context.statusKinds?.includes('silenced') && Array.isArray(attributes) && attributes.includes('魔')) return false;
      if ((card.name === '結界' || card.name === '神王界') && context.incomingAttributes && !context.incomingAttributes.includes('魔')) return false;
      if (card.name === '神王界' && context.incomingEffectLevel !== undefined && context.incomingEffectLevel > 6) return false;
      const counter = Array.isArray(attributes) && attributes.includes('反');
      const distanceOnly = card.modes?.some(item => item.playMode === 'distance') === true;
      const owner = dedicatedCounterOwners[id];
      const dedicatedCounter = !!owner && context.dedicated && context.characterName === owner;
      if (context.limitedDefenses && !(context.limitedDefenses.includes('teleport') && card.name === '転移') && !(context.limitedDefenses.includes('counter') && (counter || dedicatedCounter) && printed.includes('攻撃'))) return false;
      if (context.defenseRestrictions?.counterProhibited && (counter || dedicatedCounter)) return false;
      if (context.defenseRestrictions?.evadeProhibited && card.name === '見切る') return false;
      return counter || dedicatedCounter || (printed.includes('防御') && !distanceOnly);
    }
    if (choice === 'PLAY_MAAI') return !context.defenseRestrictions?.maaiProhibited && card.modes?.some(item => item.playMode === 'distance') === true;
    if (choice === 'PLAY_ADVANCE') return card.modes?.some(item => item.playMode === 'advance') === true;
    if (choice === 'PLAY_REACTION') {
      if (mode === 'reroll') return card.name === '神性介入';
      if (mode === 'force-fail' && context.rollKind === 'numeric') return false;
      return mode === 'effect-plus' ? card.name === '必勝の祈り' : card.name === '命運凶変';
    }
    return false;
  });
}

export function hasOptionalChant(cardId: string | undefined, characterName: string | undefined): boolean {
  return cardId === 'a2-p11-r1c1' && characterName === '早駆けのランカスター';
}

export function techniqueVariants(cardId: string | undefined, characterName: string | undefined, dedicated: boolean): { value: TechniqueVariant; label: string }[] {
  if (!dedicated) return [];
  if (cardId === 'a2-p10-r3c2' && characterName === '早駆けのランカスター') return [
    { value: 'two-hit', label: '2発を同時に与える' },
    { value: 'one-hit', label: '1発を与える' },
  ];
  if (cardId !== 'a2-p11-r2c1' && cardId !== 'a2-p11-r2c2') return [];
  if (characterName === '聖騎士ランスロット2') return [
    { value: 'lancelot-2', label: '変身後の専用効果' },
    { value: 'lancelot-1', label: '変身前の専用効果' },
  ];
  return [];
}

export function eligibleChantCards(hand: readonly string[], characterName?: string, dedicated = false, silenced = false): string[] {
  return hand.filter(id => {
    const attributes = getAction(id)?.stats?.attributes;
    if (silenced && Array.isArray(attributes) && attributes.includes('魔')) return false;
    return (Array.isArray(attributes) && attributes.includes('詠')) || (dedicated && hasOptionalChant(id, characterName));
  });
}

export function buildCardCommand(type: GameCommand['type'], input: CardCommandInput): GameCommand | null {
  const cardInstanceId = input.cardId;
  const abilities = input.declarationAbilityIds?.length ? { declarationAbilityIds: [...input.declarationAbilityIds] } : {};
  if (type === 'ATTACK') return cardInstanceId && input.targetIds?.length
    ? { type, cardInstanceId, targetIds: [...new Set(input.targetIds)], dedicated: input.dedicated ?? false, ...abilities, ...(input.dedicated && input.techniqueVariant ? { techniqueVariant: input.techniqueVariant } : {}) } : null;
  if (type === 'PLAY_REACTION') {
    const mode = input.reactionMode;
    if (!cardInstanceId || !mode) return null;
    if (mode === 'cancel-ability') return input.targetAbilityId ? { type, cardInstanceId, mode, targetAbilityId: input.targetAbilityId } : null;
    if ((mode === 'reroll' || mode === 'force-fail') && input.targetRollId) return { type, cardInstanceId, mode, targetRollId: input.targetRollId };
    if (mode === 'reroll' || !input.targetActionId) return null;
    return { type, cardInstanceId, targetActionId: input.targetActionId, mode, dedicated: input.dedicated ?? false };
  }
  if (type === 'PLAY_DEFENSE') return cardInstanceId ? { type, cardInstanceId, dedicated: input.dedicated ?? false, ...abilities } : null;
  if ((type === 'APPROACH' || type === 'WITHDRAW') && cardInstanceId && input.targetId) return { type, cardInstanceId, targetId: input.targetId };
  if (type === 'CHANT' && cardInstanceId) return { type, cardInstanceId, ...(input.dedicated === undefined ? {} : { dedicated: input.dedicated }) };
  if ((type === 'PLAY_MAAI' || type === 'PLAY_ADVANCE' || type === 'PLACE_INITIAL_FOLLOWER') && cardInstanceId) return { type, cardInstanceId };
  return null;
}
