#!/usr/bin/env python3
"""Read-only evidence-strength counts; these do not certify acceptance receipts."""
import collections
import json
import sys
from pathlib import Path

CONCRETE = {'canonical-transition', 'structural-resolver', 'projection', 'worker-persistence', 'browser'}
TERMINAL = {'accepted', 'notApplicable'}


def report(root: Path) -> dict:
    directory = Path(root) / 'data/second-edition'
    ledger = json.loads((directory / 'runtime-coverage.json').read_text())
    manifest_path = directory / 'runtime-obligations.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    rows = {r['entryId'] + '#' + r['clauseKey']: r for r in ledger['rows']}
    obligations = {r['entryId'] + '#' + r['clauseKey']: r for r in manifest.get('obligations', [])}
    cases = ledger.get('testCases', {})
    counts = dict.fromkeys(['accepted', 'notApplicable', 'verified', 'implementedConcrete',
                          'implementedRelatedOnly', 'implementedNoTests'], 0)
    pending = collections.Counter()
    blocked = 0
    for identity, row in rows.items():
        category = row.get('coverageClass')
        if category == 'aggregate':
            covers = obligations.get(identity, {}).get('covers', [])
            if not covers or any(rows.get(child, {}).get('status') not in TERMINAL for child in covers):
                blocked += 1
            continue
        if category != 'semantic':
            continue
        status = row['status']
        if status == 'pending':
            pending[row.get('kind', '')] += 1
        elif status == 'implemented':
            refs = row.get('tests', [])
            if any(ref not in cases for ref in refs):
                raise ValueError('missing test reference: ' + identity)
            kinds = {cases[ref].get('kind') for ref in refs}
            bucket = ('implementedNoTests' if not refs else
                      'implementedConcrete' if kinds & CONCRETE else 'implementedRelatedOnly')
            counts[bucket] += 1
        elif status in counts:
            counts[status] += 1
        else:
            raise ValueError('unknown semantic status: ' + str(status))
    counts['pending'] = dict(sorted(pending.items()))
    return {'semantic': counts, 'aggregateBlocked': blocked}


if __name__ == '__main__':
    print(json.dumps(report(Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')),
                     ensure_ascii=False, indent=2))
