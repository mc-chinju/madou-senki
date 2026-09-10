#!/usr/bin/env python3
"""Deterministic queries for current-edition absence decisions. Never writes data."""
import argparse
import json
from pathlib import Path


def _actions(root):
    paths = sorted((Path(root) / 'data/second-edition').glob('actions-*.json'))
    if not paths:
        raise ValueError('action data is missing')
    for path in paths:
        for card in json.loads(path.read_text())['cards']:
            yield path.relative_to(root).as_posix(), card


def _attributes(card):
    stats = card.get('stats') or {}
    if card.get('category') == 'follower':
        return set((stats.get('attack') or {}).get('attributes') or [])
    attrs = set(stats.get('attributes') or [])
    for mode in card.get('modes') or []:
        attrs.update(mode.get('attributes') or [])
    return attrs


def _matches(card, where):
    attrs = _attributes(card)
    if 'attributes_contains' in where and where['attributes_contains'] not in attrs:
        return False
    if 'attribute_not_contains' in where and where['attribute_not_contains'] in attrs:
        return False
    if 'printed_category' in where and card.get('printed_category') != where['printed_category']:
        return False
    if 'technique_class' in where and {'戦士': '戦', '魔法': '魔'}.get(where['technique_class'], where['technique_class']) not in attrs:
        return False
    specification = card.get('specification') or []
    if isinstance(specification, str):
        specification = [specification]
    text = ' '.join([card.get('printed_text') or ''] + specification)
    if 'counter' in where and ('反撃' in text) != where['counter']:
        return False
    return True


def run_query(root, query):
    root = Path(root)
    if not isinstance(query, dict) or set(query) != {'dataset', 'where'}:
        raise ValueError('query requires dataset and where')
    dataset, where = query['dataset'], query['where']
    allowed = {'attributes_contains', 'attribute_not_contains', 'printed_category', 'technique_class', 'counter'}
    if dataset == 'character-owned-techniques':
        allowed.add('character')
    elif dataset != 'actions':
        raise ValueError('unknown dataset')
    if not isinstance(where, dict) or set(where) - allowed:
        raise ValueError('unknown query filter')
    if any((type(value) is not bool if key == 'counter' else not isinstance(value, str) or not value)
           for key, value in where.items()):
        raise ValueError('invalid filter value')
    actions = list(_actions(root))
    if dataset == 'character-owned-techniques':
        characters = json.loads((root / 'data/second-edition/characters.json').read_text())['cards']
        selected = [c for c in characters if c['id'] == where.get('character')]
        if len(selected) != 1 or 'owned_techniques' not in selected[0]:
            raise ValueError('unknown character or missing owned techniques')
        selected_actions = {}
        for name in selected[0]['owned_techniques']:
            matches = [(path, card) for path, card in actions if name == card['name'] or
                       name in [mode.get('name') for mode in card.get('modes') or []]]
            if not matches:
                raise ValueError(f'unresolved owned technique: {name}')
            for path, card in matches:
                selected_actions[card['id']] = (path, card)
        actions = list(selected_actions.values())
    matches = [{'id': c['id'], 'name': c.get('name'),
                'kind': 'follower-attack' if c.get('category') == 'follower' else 'technique',
                'path': path, 'attributes': sorted(_attributes(c))}
               for path, c in actions if _matches(c, where)]
    matches.sort(key=lambda row: (row['path'], row['id']))
    return {'kind': 'card-data-filter', 'query': query, 'matches': matches, 'count': len(matches)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('query', type=json.loads)
    parser.add_argument('--root', type=Path, default=Path('.'))
    args = parser.parse_args()
    print(json.dumps(run_query(args.root, args.query), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
