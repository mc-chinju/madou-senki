#!/usr/bin/env python3
"""Bind scenario source clauses using the R6 index without upgrading evidence kinds."""
import argparse
import json
import sys
from pathlib import Path

# R6 explicitly retains abstract arithmetic and an arranged exhaustion boundary.
# These are not invented canonical card combinations or complete-match proofs.
STRUCTURAL_SCENARIOS = {'S13', 'S23', 'S32'}
INDEX = 'docs/operations/evidence/2026-09-10-r6-scenario-source-index.json'


def build_bindings(index, ledger):
    scenarios = {}
    for scenario in index['scenarios']:
        entry = scenario['entryId']
        if entry in scenarios:
            raise ValueError(f'duplicate scenario: {entry}')
        scenarios[entry] = scenario
    result = []
    for row in ledger['rows']:
        if row.get('kind') != 'scenario-source' or row.get('coverageClass') != 'semantic':
            continue
        entry = row['entryId']
        if entry not in scenarios:
            raise ValueError(f'missing scenario index: {entry}')
        selected = [t for t in scenarios[entry]['tests'] if t['kind'] == 'canonical-transition']
        if entry in STRUCTURAL_SCENARIOS:
            selected += [t for t in scenarios[entry]['tests'] if t['kind'] == 'structural-resolver']
        if not selected:
            raise ValueError(f'no eligible exact scenario tests: {entry}')
        tests = []
        for test in selected:
            # Historical file/run hashes are deliberately not current-candidate evidence.
            ref = {key: test.get(key) for key in ['path', 'suite', 'title', 'parameters', 'kind']}
            ref['bindingNote'] = (
                f"{entry} {row['clauseKey']}: exact R6 indexed {test['kind']} assertions. "
                + ('Preserves the documented structural boundary; not a canonical full-card or match claim. '
                   if test['kind'] == 'structural-resolver' else '')
                + test.get('bindingNote', ''))
            tests.append(ref)
        correspondence = [r for r in ledger['rows'] if r['entryId'] == entry
                          and r['clauseKey'] == 'acceptance-correspondence']
        if len(correspondence) != 1 or not correspondence[0].get('handler'):
            raise ValueError(f'missing unique scenario handlers: {entry}')
        handlers = [ledger['handlers'][h] for h in correspondence[0]['handler']]
        result.append({'row': f"{entry}#{row['clauseKey']}", 'handler': handlers,
                       'tests': tests, 'status': 'implemented',
                       'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--bindings', type=Path, required=True)
    args = parser.parse_args()
    ledger = json.loads((args.root / 'data/second-edition/runtime-coverage.json').read_text())
    index = json.loads((args.root / INDEX).read_text())
    if {s['entryId'] for s in index['scenarios']} != {f'S{i:02d}' for i in range(1, 33)}:
        raise ValueError('expected exactly S01 through S32')
    bindings = build_bindings(index, ledger)
    sys.path.insert(0, str(Path(__file__).parent))
    from apply_ledger_bindings import apply_bindings, extract_declarations
    paths = {ref['path'] for b in bindings for key in ['handler', 'tests'] for ref in b[key]}
    apply_bindings(ledger, bindings, extract_declarations(args.root, paths))
    args.bindings.write_text(json.dumps({'bindings': bindings}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'bindings': len(bindings), 'scenarios': len(index['scenarios']),
                      'structuralScenarios': sorted(STRUCTURAL_SCENARIOS)}))


if __name__ == '__main__':
    main()
