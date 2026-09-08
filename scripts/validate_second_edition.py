#!/usr/bin/env python3
"""Validate the transcribed 2nd catalog, not game behavior. No dependencies."""
import argparse
import collections
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/second-edition'
DOCS = ROOT / 'docs/rules/second-edition'


def read(path):
    return json.loads(path.read_text())


def section(card):
    # Physical sections in CardAll, not the broader play-mode category.
    if card['category'] in ('advance', 'follower', 'open'):
        return card['category']
    if card['name'] == '間合い／休息':
        return 'distance'
    if card['page'] <= 6:
        return 'general'
    return 'technique'


def validate(write_report=False):
    errors = []

    def check(condition, message):
        if not condition:
            errors.append(message)

    config = read(DATA / 'ruleset.json')
    actions, characters, coverage = [], [], []
    all_ids, ability_ids = set(), set()
    for filename in config['catalogs']:
        catalog = read(DATA / filename)
        is_character = filename == 'characters.json'
        grid, pages = (2, 7) if is_character else (3, 25)
        expected_pages = range(1, 8) if is_character else catalog['pages']
        if isinstance(expected_pages, dict):
            expected_pages = range(expected_pages['from'], expected_pages['to'] + 1)
        occupied = set()
        for card in catalog['cards']:
            cid = card['id']
            check(cid not in all_ids, f'duplicate ID: {cid}')
            all_ids.add(cid)
            slot = (card['page'], card['row'], card['column'])
            check(slot not in occupied, f'duplicate slot: {filename} {slot}')
            occupied.add(slot)
            check(1 <= slot[0] <= pages and 1 <= slot[1] <= grid and 1 <= slot[2] <= grid,
                  f'invalid slot: {cid}')
            prefix = 'c2' if is_character else 'a2'
            check(cid == f'{prefix}-p{slot[0]:02}-r{slot[1]}c{slot[2]}', f'ID/slot mismatch: {cid}')
            check(card.get('visually_verified') is True, f'not visually checked: {cid}')
            check(bool(card.get('name')), f'missing name: {cid}')
            if is_character:
                characters.append(card)
                for ability in card['abilities']:
                    check(ability['id'] not in ability_ids, f'duplicate ability: {ability["id"]}')
                    ability_ids.add(ability['id'])
                    check(bool(ability['specification']) and bool(ability['timing']),
                          f'incomplete ability: {ability["id"]}')
                check(set(card['base_stats']) == {'warrior_level', 'magic_level', 'spirit', 'endurance'},
                      f'incomplete character stats: {cid}')
                check(all(isinstance(v, int) and v >= 0 for v in card['base_stats'].values()),
                      f'invalid character stats: {cid}')
                ruling_file = 'rulings-characters.md'
            else:
                actions.append(card)
                for key in ('printed_text', 'timing', 'specification'):
                    check(bool(card.get(key)), f'missing {key}: {cid}')
                ruling_file = 'rulings-' + filename.replace('.json', '.md')
                ruling_text = (DOCS / ruling_file).read_text()
                for qi, question in enumerate(card['questions'], 1):
                    check(question in ruling_text, f'question missing from rulings: {cid} Q{qi}')
                if card['questions']:
                    check(cid in ruling_text, f'card missing from rulings: {cid}')
            coverage.append((cid, card['name'], filename.replace('.json', '.md'),
                             ruling_file, len(card['questions'])))
        blanks = {(c['page'], c['row'], c['column']) for c in catalog['blank_cells']}
        check(not occupied & blanks, f'blank/card overlap: {filename}')
        expected = {(p, r, c) for p in expected_pages for r in range(1, grid + 1)
                    for c in range(1, grid + 1)}
        check(occupied | blanks == expected, f'page coverage incomplete: {filename}')

    check(len(actions) == config['expected_action_cards'], 'action count mismatch')
    check(len(characters) == config['expected_character_cards'], 'character count mismatch')
    check(len(ability_ids) == config['expected_abilities'], 'ability count mismatch')
    sections = dict(collections.Counter(section(c) for c in actions))
    check(sections == config['expected_deck_sections'], f'deck sections mismatch: {sections}')
    base = [c for c in characters if not c['transformation_only']]
    check(collections.Counter(c['initial_faction'] for c in base) == {'GOOD': 11, 'EVIL': 13},
          'initial factions mismatch')
    check(len(base) == 24, 'transformation exclusion mismatch')
    for c in characters:
        check(c['inherits_abilities_from'] is None or c['inherits_abilities_from'] in all_ids,
              f'invalid inheritance: {c["id"]}')

    names = {c['name'] for c in actions}
    aliases = read(DATA / 'aliases.json')['entries']
    alias_names = {a['alias'] for a in aliases}
    check(len(alias_names) == len(aliases), 'duplicate alias')
    for a in aliases:
        check(set(a['canonical_names']) <= names, f'unknown alias target: {a["alias"]}')
    for c in characters:
        for n in c['owned_techniques'] + c['owned_followers']:
            check(n in names or n in alias_names, f'unmapped owned card: {c["id"]}: {n}')

    ruling_ids = set()
    for path in DOCS.glob('rulings*.md'):
        text = path.read_text()
        ids = re.findall(r'^#{2,3} ([GCAFT]\d{2}) —', text, re.M)
        for rid in ids:
            check(rid not in ruling_ids, f'duplicate ruling: {rid}')
            ruling_ids.add(rid)
    scenarios = read(DATA / 'scenarios.json')['scenarios']
    seen_scenarios = set()
    for s in scenarios:
        check(s['id'] not in seen_scenarios, f'duplicate scenario: {s["id"]}')
        seen_scenarios.add(s['id'])
        check(set(s['rulings']) <= ruling_ids, f'unknown scenario ruling: {s["id"]}')
        check(all(s.get(k) for k in ('given', 'when', 'then')), f'incomplete scenario: {s["id"]}')

    # Paths with parentheses (e.g. Character(A4).pdf) need balanced matching.
    for path in [ROOT / 'README.md', *list((ROOT / 'docs').rglob('*.md'))]:
        for match in re.finditer(r'\]\(', path.read_text()):
            text = path.read_text()[match.end():]
            depth, target = 1, ''
            for char in text:
                if char == '(':
                    depth += 1
                if char == ')':
                    depth -= 1
                if depth == 0:
                    break
                target += char
            target = target.strip('<>').split('#')[0]
            if not target or re.match(r'\w+://', target):
                continue
            if write_report and (path.parent / target).resolve() == DOCS / 'coverage.md':
                continue  # Generated below; regular validation checks it afterwards.
            check((path.parent / target).exists(), f'broken link: {path.relative_to(ROOT)} -> {target}')

    if errors:
        raise SystemExit('\n'.join(errors))
    questions = sum(row[4] for row in coverage)
    summary = {'action_cards': len(actions), 'characters': len(characters), 'abilities': len(ability_ids),
               'deck_sections': sections, 'source_questions': questions, 'ruling_sections': len(ruling_ids),
               'acceptance_scenarios': len(scenarios), 'game_tests_executed': False}
    if write_report:
        lines = ['# 2nd仕様の網羅表', '',
                 '生成: `python3 scripts/validate_second_edition.py --write-report`。', '',
                 f'行動{len(actions)}枚、人物{len(characters)}枚、能力{len(ability_ids)}件。'
                 f'原文の疑問{questions}件を保持。裁定節{len(ruling_ids)}件、対戦例{len(scenarios)}件。', '',
                 '**全行が転記・目視照合済み、裁定は暫定採用。** ゲーム実装・効果テストの進捗は[実行可能なルールの網羅表](../coverage.md)を参照。 '
                 '疑問欄を削除して確定扱いにはしない。各個別裁定と共通裁定を併読する。', '',
                 'カテゴリは印刷デッキ区分。プレイ時の区分（防御・複合・手番等）とは別。', '',
                 '| 印刷区分 | 枚数 |', '|---|---:|']
        lines += [f'| {k} | {v} |' for k, v in sorted(sections.items())]
        lines += ['', '| 物理ID | 名称 | 仕様 | 裁定案 | 原文の疑問数 |', '|---|---|---|---|---:|']
        for cid, name, spec, rulings, count in sorted(coverage):
            lines.append(f'| {cid} | {name} | [本文]({spec}) | [裁定]({rulings}) | {count} |')
        lines += ['', 'この検査は枚数・構造・出典位置・リンク・質問収録を検証する。'
                  '裁定の妥当性や全能力の動作を自動で証明するものではない。', '']
        (DOCS / 'coverage.md').write_text('\n'.join(lines))
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-report', action='store_true')
    validate(parser.parse_args().write_report)
