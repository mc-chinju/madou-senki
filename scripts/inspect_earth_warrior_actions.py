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
    try:
        from .inspect_card_data import run_query
    except ImportError:
        import importlib.util
        spec = importlib.util.spec_from_file_location('inspect_card_data', Path(__file__).with_name('inspect_card_data.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        run_query = module.run_query
    return run_query(root, {'dataset': 'actions', 'where': {
        'attributes_contains': '地', 'technique_class': '戦士'}})['matches']


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
