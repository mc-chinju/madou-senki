import actions01To06 from '../../../../data/second-edition/actions-01-06.json' with { type: 'json' };
import actions07To17 from '../../../../data/second-edition/actions-07-17.json' with { type: 'json' };
import actions18To25 from '../../../../data/second-edition/actions-18-25.json' with { type: 'json' };
import aliasesSource from '../../../../data/second-edition/aliases.json' with { type: 'json' };
import charactersSource from '../../../../data/second-edition/characters.json' with { type: 'json' };
import rulesetSource from '../../../../data/second-edition/ruleset.json' with { type: 'json' };
import selectedDeck from './deck.json' with { type: 'json' };

import type {
  ActionCard,
  ActionMode,
  CatalogEntry,
  CharacterAbility,
  CharacterCard,
  DeckRow,
  RawRecord,
  Ruleset,
  SemanticPlayMode,
} from '../types.js';

type ValidSourceCard = Record<string, unknown> & {
  id: string;
  page: number;
  row: number;
  column: number;
  name: string;
  visually_verified: boolean;
};

const actionSources = [
  ['data/second-edition/actions-01-06.json', actions01To06.cards],
  ['data/second-edition/actions-07-17.json', actions07To17.cards],
  ['data/second-edition/actions-18-25.json', actions18To25.cards],
] as const;

function validationError(path: string, id: string, field: string): never {
  throw new Error(`${path}: ${id}: invalid required field ${field}`);
}

function requireRecord(value: unknown, path: string, id: string, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) validationError(path, id, field);
  return value as Record<string, unknown>;
}

function requireString(value: unknown, path: string, id: string, field: string): string {
  if (typeof value !== 'string' || value.length === 0) validationError(path, id, field);
  return value;
}

function requireStringValue(value: unknown, path: string, id: string, field: string): string {
  if (typeof value !== 'string') validationError(path, id, field);
  return value;
}

function requireBoolean(value: unknown, path: string, id: string, field: string): boolean {
  if (typeof value !== 'boolean') validationError(path, id, field);
  return value;
}

function requireInteger(value: unknown, path: string, id: string, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) validationError(path, id, field);
  return value as number;
}

function requireNonNegativeNumber(value: unknown, path: string, id: string, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) validationError(path, id, field);
  return value as number;
}

function requireStringArray(value: unknown, path: string, id: string, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) validationError(path, id, field);
  return value as string[];
}

function validateCommon(value: unknown, path: string, index = 0): ValidSourceCard {
  const record = requireRecord(value, path, `row[${index}]`, 'record');
  const id = requireString(record.id, path, `row[${index}]`, 'id');
  requireInteger(record.page, path, id, 'page');
  requireInteger(record.row, path, id, 'row');
  requireInteger(record.column, path, id, 'column');
  requireString(record.name, path, id, 'name');
  requireBoolean(record.visually_verified, path, id, 'visually_verified');
  return record as ValidSourceCard;
}

function sourceRef(path: string, card: ValidSourceCard) {
  return {
    path,
    page: card.page,
    row: card.row,
    column: card.column,
    verified: card.visually_verified,
  };
}

function semanticMode(name: string): SemanticPlayMode {
  if (name === '間合い') return 'distance';
  if (name === '休息') return 'rest';
  if (name === '踏み込み') return 'advance';
  if (name.length > 0) return 'attack';
  return 'other';
}

function normalizeModes(value: unknown, path: string, id: string): ActionMode[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((raw, index) => {
    const record = requireRecord(raw, path, id, `modes[${index}]`);
    const name = requireString(record.name, path, id, `modes[${index}].name`);
    return { ...record, name, playMode: semanticMode(name) } as ActionMode;
  });
}

export function normalizeActionRecord(path: string, value: unknown): ActionCard {
  const input = validateCommon(value, path);
  const card = input;
  const id = input.id;
  const normalized: ActionCard = {
    kind: 'action',
    id: input.id,
    edition: 'second',
    name: input.name,
    source: sourceRef(path, input),
    assetId: `/cards/second/${input.id}.webp`,
    copies: 1,
    implementation: 'pending',
    category: requireString(card.category, path, id, 'category'),
    printed_text: requireString(card.printed_text, path, id, 'printed_text'),
    timing: requireStringArray(card.timing, path, id, 'timing'),
    specification: requireStringArray(card.specification, path, id, 'specification'),
    questions: requireStringArray(card.questions, path, id, 'questions'),
    raw: card,
  };
  if (card.printed_category !== undefined) {
    if (typeof card.printed_category !== 'string' &&
        (!Array.isArray(card.printed_category) || card.printed_category.some((item) => typeof item !== 'string'))) {
      validationError(path, id, 'printed_category');
    }
    normalized.printed_category = card.printed_category as string | string[];
  }
  const modes = normalizeModes(card.modes, path, id);
  if (modes) normalized.modes = modes;
  if (card.stats !== undefined) normalized.stats = requireRecord(card.stats, path, id, 'stats');
  if (Array.isArray(card.character_overrides)) {
    normalized.character_overrides = card.character_overrides.map((override, index) =>
      requireRecord(override, path, id, `character_overrides[${index}]`));
  } else if (card.character_overrides !== undefined) {
    validationError(path, id, 'character_overrides');
  }
  return normalized;
}

function normalizeAbility(value: unknown, path: string, characterId: string, index: number): CharacterAbility {
  const ability = requireRecord(value, path, characterId, `abilities[${index}]`);
  return {
    ...ability,
    id: requireString(ability.id, path, characterId, `abilities[${index}].id`),
    name: requireString(ability.name, path, characterId, `abilities[${index}].name`),
    timing: requireStringArray(ability.timing, path, characterId, `abilities[${index}].timing`),
    specification: requireString(ability.specification, path, characterId, `abilities[${index}].specification`),
    activation: requireString(ability.activation, path, characterId, `abilities[${index}].activation`),
    implementation: 'pending',
  } as CharacterAbility;
}

function normalizeCharacter(value: unknown, index: number): CharacterCard {
  const path = 'data/second-edition/characters.json';
  const input = validateCommon(value, path, index);
  const card = input;
  const id = input.id;
  const stats = requireRecord(card.base_stats, path, id, 'base_stats');
  const sex = requireString(card.sex, path, id, 'sex');
  if (sex !== '男' && sex !== '女' && sex !== '不明') validationError(path, id, 'sex');
  const inheritance = card.inherits_abilities_from;
  if (inheritance !== null && typeof inheritance !== 'string') validationError(path, id, 'inherits_abilities_from');
  if (!Array.isArray(card.abilities)) validationError(path, id, 'abilities');
  const faction = requireString(card.initial_faction, path, id, 'initial_faction');
  if (faction !== 'GOOD' && faction !== 'EVIL' && faction !== 'ヴァンミール') validationError(path, id, 'initial_faction');
  return {
    kind: 'character',
    id: input.id,
    edition: 'second',
    name: input.name,
    source: sourceRef('data/second-edition/characters.json', input),
    assetId: `/cards/second/${input.id}.webp`,
    copies: 1,
    implementation: 'pending',
    sex,
    initial_faction: faction,
    transformation_only: requireBoolean(card.transformation_only, path, id, 'transformation_only'),
    base_stats: {
      warrior_level: requireNonNegativeNumber(stats.warrior_level, path, id, 'base_stats.warrior_level'),
      magic_level: requireNonNegativeNumber(stats.magic_level, path, id, 'base_stats.magic_level'),
      spirit: requireNonNegativeNumber(stats.spirit, path, id, 'base_stats.spirit'),
      endurance: requireNonNegativeNumber(stats.endurance, path, id, 'base_stats.endurance'),
    },
    allegiance_text: requireStringValue(card.allegiance_text, path, id, 'allegiance_text'),
    inherits_abilities_from: inheritance,
    objective: requireString(card.objective, path, id, 'objective'),
    defeat_condition: requireString(card.defeat_condition, path, id, 'defeat_condition'),
    owned_techniques: requireStringArray(card.owned_techniques, path, id, 'owned_techniques'),
    owned_followers: requireStringArray(card.owned_followers, path, id, 'owned_followers'),
    abilities: card.abilities.map((ability, abilityIndex) => normalizeAbility(ability, path, id, abilityIndex)),
    restrictions: requireStringArray(card.restrictions, path, id, 'restrictions'),
    raw: card,
  };
}

function requireSourceArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) validationError(path, 'catalog', 'cards');
  return value;
}

export const actionCards: ActionCard[] = actionSources.flatMap(([path, cards]) =>
  requireSourceArray(cards, path).map((card) => normalizeActionRecord(path, card)),
);

export const characters: CharacterCard[] = requireSourceArray(
  charactersSource.cards,
  'data/second-edition/characters.json',
).map(normalizeCharacter);
export const entries: (ActionCard | CharacterCard)[] = [...actionCards, ...characters];
export const deck: DeckRow[] = selectedDeck;
export const initialCharacterPool = characters.filter((character) => !character.transformation_only);

export const ruleset: Ruleset = {
  id: rulesetSource.id,
  edition: 'second',
  actionCardCount: rulesetSource.expected_action_cards,
  characterCardCount: rulesetSource.expected_character_cards,
  minPlayers: rulesetSource.players.min,
  maxPlayers: rulesetSource.players.max,
};

const actionsById = new Map(actionCards.map((card) => [card.id, card]));
const charactersById = new Map(characters.map((card) => [card.id, card]));
const selectedIds = new Set(entries.map((entry) => entry.id));
const selectedAbilityIds = new Set(characters.flatMap((character) => character.abilities.map((ability) => ability.id)));

function canonicalDefinition(value: unknown, ancestors = new Set<object>()): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return `${typeof value}:${JSON.stringify(value)}`;
  if (ancestors.has(value)) throw new Error('catalog definition must not contain cycles');
  ancestors.add(value);
  let result: string;
  if (Array.isArray(value)) {
    result = `[${value.map((item) => canonicalDefinition(item, ancestors)).join(',')}]`;
  } else {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter((key) => key !== 'implementation').sort();
    result = `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalDefinition(record[key], ancestors)}`).join(',')}}`;
  }
  ancestors.delete(value);
  return result;
}

const selectedDefinitions = new Map(entries.map((entry) => [entry.id, {
  kind: entry.kind,
  source: { ...entry.source },
  signature: canonicalDefinition(entry),
}]));
const aliases = new Map(
  aliasesSource.entries.map((entry) => [entry.alias, entry.canonical_names] as const),
);

export function getAction(id: string): ActionCard | undefined {
  return actionsById.get(id);
}

export function getCharacter(id: string): CharacterCard | undefined {
  return charactersById.get(id);
}

export function ownedCardNames(characterId: string): string[] | undefined {
  const character = getCharacter(characterId);
  if (!character) return undefined;
  return [...character.owned_techniques, ...character.owned_followers].flatMap(
    (name) => aliases.get(name) ?? [name],
  );
}

export function deriveCharacterImplementation(character: Pick<CharacterCard, 'abilities'>) {
  return character.abilities.every((ability) => ability.implementation === 'tested') ? 'tested' : 'pending';
}

export function assertPlayableCatalog(catalog: readonly (ActionCard | CharacterCard)[]): void {
  for (const entry of catalog) {
    if (entry.implementation === 'pending') {
      throw new Error(`${entry.id}: pending implementation`);
    }
    if (!entry.source.path || !entry.source.verified) {
      throw new Error(`${entry.id}: no verified source`);
    }
    if (entry.assetId !== `/cards/second/${entry.id}.webp`) {
      throw new Error(`${entry.id}: missing asset ID`);
    }
    if (entry.edition !== ruleset.edition) {
      throw new Error(`${entry.id}: invalid edition`);
    }
    if (entry.copies !== 1) {
      throw new Error(`${entry.id}: invalid copies`);
    }
    const selected = selectedDefinitions.get(entry.id);
    if (selected && entry.kind !== selected.kind) {
      throw new Error(`${entry.id}: invalid kind`);
    }
    if (selected && (
      entry.source.path !== selected.source.path ||
      entry.source.page !== selected.source.page ||
      entry.source.row !== selected.source.row ||
      entry.source.column !== selected.source.column
    )) {
      throw new Error(`${entry.id}: invalid source cell`);
    }
    if (entry.kind === 'character') {
      const pending = entry.abilities.find((ability) => ability.implementation !== 'tested');
      if (pending) throw new Error(`${entry.id}: pending ability ${pending.id}`);
      if (entry.implementation !== deriveCharacterImplementation(entry)) {
        throw new Error(`${entry.id}: character implementation state does not match abilities`);
      }
    }
    if (selected && canonicalDefinition(entry) !== selected.signature) {
      throw new Error(`${entry.id}: immutable definition differs from selected catalog`);
    }
  }

  if (catalog.length !== ruleset.actionCardCount + ruleset.characterCardCount) {
    throw new Error(`catalog must contain exactly 246 entries`);
  }
  const ids = catalog.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error('catalog contains duplicate physical IDs');
  if (ids.some((id) => !selectedIds.has(id)) || selectedIds.size !== ids.length) {
    throw new Error('catalog does not match selected physical IDs');
  }
  const actions = catalog.filter((entry) => entry.kind === 'action');
  const catalogCharacters = catalog.filter((entry): entry is CharacterCard => entry.kind === 'character');
  if (actions.length !== ruleset.actionCardCount || catalogCharacters.length !== ruleset.characterCardCount) {
    throw new Error('catalog has invalid action/character counts');
  }
  for (const group of [actions, catalogCharacters]) {
    const cells = group.map((entry) => `${entry.source.page}:${entry.source.row}:${entry.source.column}`);
    if (new Set(cells).size !== cells.length) throw new Error('catalog contains duplicate source cells');
  }
  const abilityIds = catalogCharacters.flatMap((character) => character.abilities.map((ability) => ability.id));
  if (abilityIds.length !== 110 || new Set(abilityIds).size !== 110 || abilityIds.some((id) => !selectedAbilityIds.has(id))) {
    throw new Error('catalog must contain all 110 selected character abilities exactly once');
  }
}
