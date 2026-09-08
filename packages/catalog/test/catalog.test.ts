import { describe, expect, it } from 'vitest';
import type { ActionCard, CharacterCard } from '../src/index.js';

import {
  actionCards,
  assertPlayableCatalog,
  characters,
  deck,
  entries,
  getAction,
  getCharacter,
  initialCharacterPool,
  normalizeActionRecord,
  ownedCardNames,
  ruleset,
} from '../src/index.js';

describe('second-edition runtime catalog', () => {
  it('contains every verified physical action and character cell', () => {
    expect(actionCards).toHaveLength(220);
    expect(characters).toHaveLength(26);
    expect(entries).toHaveLength(246);
    expect(characters.flatMap((character) => character.abilities)).toHaveLength(110);

    const actionCells = new Set(actionCards.map(({ source }) => `${source.page}:${source.row}:${source.column}`));
    const characterCells = new Set(characters.map(({ source }) => `${source.page}:${source.row}:${source.column}`));
    expect(actionCells).toHaveLength(25 * 9 - 5);
    expect(characterCells).toHaveLength(7 * 4 - 2);
  });

  it('preserves physical identity, source detail, raw modes and stats', () => {
    const splitCard = getAction('a2-p06-r3c3');
    expect(splitCard?.modes?.map((mode) => mode.name)).toEqual(['間合い', '休息']);
    expect(actionCards.filter((card) => card.id === splitCard?.id)).toHaveLength(1);
    expect(splitCard?.source).toMatchObject({ page: 6, row: 3, column: 3, verified: true });

    const silence = actionCards.find((card) => card.name === '沈黙');
    expect(silence?.stats).toMatchObject({ magic_level: 6, damage: '−' });
    expect(silence?.raw.printed_text).toContain('精神力チェック');

    const blackBow = getAction('a2-p07-r3c3');
    expect(blackBow?.character_overrides?.[0]).toMatchObject({
      characters: ['アーネス'],
      activation_check_waived: true,
    });
  });

  it('builds a one-copy deck and selected ruleset', () => {
    expect(deck).toHaveLength(220);
    expect(deck.reduce((count, row) => count + row.copies, 0)).toBe(220);
    expect(new Set(deck.map((row) => row.id))).toHaveLength(220);
    expect(deck.every((row) => row.copies === 1)).toBe(true);
    expect(new Set(deck.map((row) => row.id))).toEqual(new Set(actionCards.map((card) => card.id)));
    expect(ruleset).toEqual({
      id: 'second-online-v0.1-provisional',
      edition: 'second',
      actionCardCount: 220,
      characterCardCount: 26,
      minPlayers: 4,
      maxPlayers: 10,
    });
  });

  it('normalizes character-owned aliases to physical action names', () => {
    expect(ownedCardNames('c2-p03-r2c1')).toContain('死歌');
    expect(ownedCardNames('c2-p04-r2c1')).toEqual(expect.arrayContaining(['赤い水晶球', '遠見の水晶球']));
    expect(ownedCardNames('c2-p03-r2c1')).toEqual(expect.arrayContaining(['魔詩', '呪歌']));
    expect(ownedCardNames('c2-p04-r1c2')).toContain('歌う船');
    expect(ownedCardNames('c2-p01-r1c2')).toContain('女神官のシャリア');
  });

  it('excludes transformations from the 11 GOOD and 13 EVIL initial characters', () => {
    expect(initialCharacterPool.filter((card) => card.initial_faction === 'GOOD')).toHaveLength(11);
    expect(initialCharacterPool.filter((card) => card.initial_faction === 'EVIL')).toHaveLength(13);
    expect(initialCharacterPool).toHaveLength(24);
    expect(initialCharacterPool.every((card) => !card.transformation_only)).toBe(true);
  });

  it('looks up known ids and explicitly returns undefined for invalid ids', () => {
    expect(getAction('a2-p18-r1c1')?.name).toBe('沈黙');
    expect(getCharacter('c2-p01-r1c1')?.name).toBe('白魔術師シェリム');
    expect(getAction('missing')).toBeUndefined();
    expect(getCharacter('missing')).toBeUndefined();
    expect(ownedCardNames('missing')).toBeUndefined();
  });

  it('keeps effects pending and refuses a production-playable catalog', () => {
    expect(entries.every((entry) => entry.implementation === 'pending')).toBe(true);
    expect(() => assertPlayableCatalog(entries)).toThrow(/pending implementation/);
  });

  function testedCatalog() {
    return entries.map((entry): ActionCard | CharacterCard => entry.kind === 'character'
      ? { ...entry, implementation: 'tested' as const, abilities: entry.abilities.map((ability) => ({ ...ability, implementation: 'tested' as const })) }
      : { ...entry, implementation: 'tested' as const });
  }

  it('accepts only the complete selected catalog after every handler is tested', () => {
    expect(() => assertPlayableCatalog(testedCatalog())).not.toThrow();
  });

  it.each([
    ['empty catalog', () => [], /246 entries/],
    ['partial catalog', () => testedCatalog().slice(0, -1), /246 entries/],
    ['duplicate id', () => {
      const catalog = testedCatalog();
      catalog[catalog.length - 1] = catalog[0]!;
      return catalog;
    }, /duplicate|selected physical IDs/],
    ['unknown replacement id', () => {
      const catalog = testedCatalog();
      catalog[0] = { ...catalog[0]!, id: 'a2-unknown', assetId: '/cards/second/a2-unknown.webp' };
      return catalog;
    }, /selected physical IDs/],
    ['wrong edition', () => {
      const catalog = testedCatalog();
      catalog[0] = { ...catalog[0]!, edition: 'third' };
      return catalog;
    }, /edition/],
    ['wrong kind for a selected id', () => {
      const catalog = testedCatalog();
      catalog[0] = { ...catalog[0]!, kind: 'character' } as CharacterCard;
      return catalog;
    }, /kind/],
    ['altered source cell', () => {
      const catalog = testedCatalog();
      catalog[0] = { ...catalog[0]!, source: { ...catalog[0]!.source, page: 99 } };
      return catalog;
    }, /source cell/],
  ])('rejects a %s', (_label, build, expected) => {
    expect(() => assertPlayableCatalog(build())).toThrow(expected);
  });

  it('rejects a tested character while any nested ability remains pending', () => {
    const catalog = testedCatalog();
    const characterIndex = catalog.findIndex((entry) => entry.kind === 'character');
    const character = catalog[characterIndex]!;
    if (character.kind !== 'character') throw new Error('test fixture requires character');
    catalog[characterIndex] = {
      ...character,
      abilities: character.abilities.map((ability, index) => index === 0 ? { ...ability, implementation: 'pending' as const } : ability),
    };
    expect(() => assertPlayableCatalog(catalog)).toThrow(/pending ability/);
  });

  it('rejects altered gameplay content under a selected physical action id', () => {
    const catalog = testedCatalog();
    const actionIndex = catalog.findIndex((entry) => entry.id === 'a2-p18-r1c1');
    const action = catalog[actionIndex]!;
    if (action.kind !== 'action') throw new Error('test fixture requires action');
    catalog[actionIndex] = { ...action, printed_text: `${action.printed_text} altered` };
    expect(() => assertPlayableCatalog(catalog)).toThrow(/immutable definition/);
  });

  it('rejects swapping tested abilities between selected characters', () => {
    const catalog = testedCatalog();
    const firstIndex = catalog.findIndex((entry) => entry.id === 'c2-p01-r1c1');
    const secondIndex = catalog.findIndex((entry) => entry.id === 'c2-p01-r1c2');
    const first = catalog[firstIndex]!;
    const second = catalog[secondIndex]!;
    if (first.kind !== 'character' || second.kind !== 'character') throw new Error('test fixture requires characters');
    const firstAbility = first.abilities[0]!;
    const secondAbility = second.abilities[0]!;
    catalog[firstIndex] = { ...first, abilities: [secondAbility, ...first.abilities.slice(1)] };
    catalog[secondIndex] = { ...second, abilities: [firstAbility, ...second.abilities.slice(1)] };
    expect(() => assertPlayableCatalog(catalog)).toThrow(/immutable definition|ability membership/);
  });

  it('accepts equivalent raw objects regardless of property insertion order', () => {
    const catalog = testedCatalog();
    const first = catalog[0]!;
    catalog[0] = { ...first, raw: Object.fromEntries(Object.entries(first.raw).reverse()) };
    expect(() => assertPlayableCatalog(catalog)).not.toThrow();
  });

  it('validates malformed required source fields with source path and physical id', () => {
    const raw = getAction('a2-p18-r1c1')!.raw;
    expect(() => normalizeActionRecord('broken-actions.json', { ...raw, timing: [null] }))
      .toThrow(/broken-actions\.json.*a2-p18-r1c1.*timing/);
    expect(() => normalizeActionRecord('broken-actions.json', { ...raw, modes: [null] }))
      .toThrow(/broken-actions\.json.*a2-p18-r1c1.*modes\[0\]/);
  });

  it('exposes typed character identity and base stats without losing raw fields', () => {
    const sherim = getCharacter('c2-p01-r1c1')!;
    expect(sherim.sex).toBe('男');
    expect(sherim.base_stats.magic_level).toBe(8);
    expect(sherim.allegiance_text).toBe('白の護り手：常にGOOD');
    expect(sherim.inherits_abilities_from).toBeNull();
    expect(sherim.raw.sex).toBe('男');
  });

  it.each([
    ['unverified source', { source: { verified: false } }, /verified source/],
    ['missing asset id', { assetId: '' }, /asset ID/],
    ['asset id for another physical card', { assetId: '/cards/second/wrong.webp' }, /asset ID/],
    ['invalid copies', { copies: 0 }, /copies/],
  ])('rejects %s', (_label, patch, expected) => {
    const sourcePatch = 'source' in patch ? patch.source : {};
    const catalog = testedCatalog();
    catalog[0] = { ...catalog[0]!, ...patch, source: { ...catalog[0]!.source, ...sourcePatch } };
    expect(() => assertPlayableCatalog(catalog)).toThrow(expected);
  });
});
