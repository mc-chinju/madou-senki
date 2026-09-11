#!/usr/bin/env python3
"""Emit every physical owned-card case and fail-closed, clause-specific bindings."""
import argparse
import json
import sys
from pathlib import Path

SUFFIXES = {
    'normalized-name-once-game': 'A chosen base recovery spends the canonical-name allowance and a later use cannot claim it again.',
    'exhaustion-across-physical-copies': 'Every same-name physical copy shares the spent allowance; a different copy cannot create a second base claim.',
    'retention-transform-revival': 'The same saved name budget survives actual applicable identity transitions and death/revival.',
    'optional-decline': 'Declining a real recovery leaves the source discarded and does not spend its base allowance.',
    'reserve-before-parent-release': 'Recovery remains reserved under a live parent; a top-level use may close atomically. Parent completion returns the exact physical source once, including after save/restore.',
    'actual-use-disposition': 'An actual legal use of this physical owned source opens its recovery at disposition.',
    'actual-follower-death-only': 'Actual destruction of this placed physical follower opens its base recovery.',
    'morale-failure-excluded': 'Printed morale checks, when present, can fail and discard this follower without any death recovery; followers without a printed check cannot enter that failure path.',
    'attack-discard-not-follower-death': 'A permitted direct or All Army follower attack disposes its source without a death allowance; a source without any printed attack is rejected without payment or recovery.',
}
TEST_PATH = 'packages/engine/test/owned-reclaim-matrix.test.ts'


def records(root):
    data = Path(root) / 'data/second-edition'
    characters = json.loads((data / 'characters.json').read_text())['cards']
    aliases = {a['alias']: a['canonical_names'] for a in json.loads((data / 'aliases.json').read_text())['entries']}
    actions = [a for p in sorted(data.glob('actions-*.json')) for a in json.loads(p.read_text())['cards']]
    if len({a['id'] for a in actions}) != len(actions):
        raise ValueError('duplicate physical action ID')
    result = []
    for c in characters:
        for field, kind in [('owned_techniques', 'technique'), ('owned_followers', 'follower')]:
            for index, name in enumerate(c[field]):
                names = aliases.get(name, [name])
                if not names or len(names) != len(set(names)):
                    raise ValueError(f'invalid alias: {name}')
                for canonical in names:
                    matches = sorted((a for a in actions if a['name'] == canonical), key=lambda a: a['id'])
                    if not matches:
                        raise ValueError(f'unresolved owned name: {canonical}')
                    for a in matches:
                        if (a['category'] == 'follower') != (kind == 'follower'):
                            raise ValueError(f'owned kind mismatch: {c["id"]}/{name}/{a["id"]}')
                        result.append({'entryId': c['id'], 'field': field, 'index': index, 'kind': kind,
                                       'parameters': [c['name'], canonical, a['id']]})
    return result


def cases(root):
    rows = records(root)
    return tuple([[r['parameters'] for r in rows if r['kind'] == kind] for kind in ['technique', 'follower']])


def build_bindings(root):
    rows = records(root)
    ledger = json.loads((Path(root) / 'data/second-edition/runtime-coverage.json').read_text())
    bindings = []
    for row in ledger['rows']:
        if row.get('kind') != 'owned-reclaim' or row.get('coverageClass') != 'semantic':
            continue
        # Regeneration must retain the same rows after their initial application.
        parts = row['clauseKey'].split('/')
        if len(parts) != 3 or parts[0] not in {'owned_techniques', 'owned_followers'} or parts[2] not in SUFFIXES:
            raise ValueError(f'unknown owned clause: {row["clauseKey"]}')
        field, index, suffix = parts
        if not index.isdecimal():
            raise ValueError(f'owned index is not numeric: {row["clauseKey"]}')
        matches = [r for r in rows if (r['entryId'], r['field'], r['index']) == (row['entryId'], field, int(index))]
        if not matches:
            raise ValueError(f'no owned case: {row["entryId"]}#{row["clauseKey"]}')
        tests = []
        for match in matches:
            tests.append({'path': TEST_PATH, 'suite': [f'owned {match["kind"]} base recovery'],
                          'title': f'%s owned {match["kind"]} %s (%s) {suffix}',
                          'parameters': match['parameters'], 'kind': 'canonical-transition',
                          'bindingNote': SUFFIXES[suffix]})
        bindings.append({'row': f'{row["entryId"]}#{row["clauseKey"]}',
                         'handler': [{'path': 'packages/engine/src/reclaim.ts', 'symbol': 'offerReclaim'},
                                     {'path': 'packages/engine/src/reclaim.ts', 'symbol': 'commitReclaim'}],
                         'tests': tests, 'status': 'implemented',
                         'remaining': ['Exact clause assertions bound; current candidate successful run remains.']})
    return bindings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--emit-cases', action='store_true')
    parser.add_argument('--bindings', type=Path)
    args = parser.parse_args()
    if args.emit_cases:
        for kind, table in zip(['TECHNIQUE', 'FOLLOWER'], cases(args.root)):
            print(f'const OWNED_{kind}_CASES: [string,string,string][] = ' + json.dumps(table, ensure_ascii=False, indent=2) + ';')
    if args.bindings:
        sys.path.insert(0, str(Path(__file__).parent))
        from apply_ledger_bindings import apply_bindings, extract_declarations
        bindings = build_bindings(args.root)
        paths = [TEST_PATH, 'packages/engine/src/reclaim.ts']
        ledger = json.loads((args.root / 'data/second-edition/runtime-coverage.json').read_text())
        # Validate exact enabled declarations and tuples before writing any artifact.
        apply_bindings(ledger, bindings, extract_declarations(args.root, paths))
        args.bindings.write_text(json.dumps({'bindings': bindings}, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
