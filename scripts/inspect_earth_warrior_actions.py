#!/usr/bin/env python3
"""List printed 2nd action techniques that are both earth and warrior.

Follower body attributes are not attack attributes. Follower attack bottoms are
inspected separately from non-follower techniques. Absence is a data fact for
the current edition, not proof that a future card cannot exist.
"""
import argparse
import json
from pathlib import Path


def attributes_of(value):
    if isinstance(value, dict):
        found = set(value.get('attributes') or [])
        for nested in value.values():
            found.update(attributes_of(nested))
        return found
    if isinstance(value, list):
        found = set()
        for nested in value:
            found.update(attributes_of(nested))
        return found
    return set()


def collect_earth_warrior_techniques(root):
    """Return printed technique and follower-attack rows that are 地 and 戦."""
    matches = []
    root = Path(root)
    for path in sorted((root / 'data/second-edition').glob('actions-*.json')):
        relative = str(path.relative_to(root))
        for card in json.loads(path.read_text()).get('cards', []):
            stats = card.get('stats') or {}
            if card.get('category') == 'follower':
                attack_attrs = set((stats.get('attack') or {}).get('attributes') or [])
                if '地' in attack_attrs and '戦' in attack_attrs:
                    matches.append({'id': card.get('id'), 'name': card.get('name'), 'kind': 'follower-attack',
                                    'path': relative, 'attributes': sorted(attack_attrs)})
                continue
            attrs = set(stats.get('attributes') or [])
            for mode in card.get('modes') or []:
                attrs.update(mode.get('attributes') or [])
            if '地' in attrs and '戦' in attrs:
                matches.append({'id': card.get('id'), 'name': card.get('name'), 'kind': 'technique',
                                'path': relative, 'attributes': sorted(attrs)})
    return matches


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo-root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    matches = collect_earth_warrior_techniques(args.repo_root)
    print(json.dumps({'query': 'earth-warrior-technique-absence', 'edition': 'second-online-v0.1-provisional',
                      'matches': matches, 'count': len(matches)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
