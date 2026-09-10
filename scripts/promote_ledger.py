#!/usr/bin/env python3
"""Promote concrete bindings using an exact successful candidate run."""
import argparse
import copy
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from generate_acceptance_receipt import build_acceptance_receipt
from ledger_report import CONCRETE
from validate_runtime_coverage import (ACCEPTANCE_POLICY, FREEZE_POLICY, candidate_files,
                                       canonical_digest, digest, not_applicable_errors)


def resolved_rows(manifest, ledger):
    registries = {'source': {s['sourceId']: s for s in manifest.get('sources', []) if 'sourceId' in s},
                  'handler': ledger.get('handlers', {}), 'tests': ledger.get('testCases', {}),
                  'remaining': ledger.get('remainingNotes', {})}

    def expand(value):
        row = copy.deepcopy(value)
        for field, registry in registries.items():
            if field in row:
                row[field] = [registry.get(ref, ref) if isinstance(ref, str) else ref for ref in row[field]]
        return row

    obligations = {f"{o['entryId']}#{o['clauseKey']}": expand(o) for o in manifest['obligations']}
    rows = {f"{r['entryId']}#{r['clauseKey']}": expand(r) for r in ledger['rows']}
    if len(rows) != len(ledger['rows']) or len(obligations) != len(manifest['obligations']):
        raise ValueError('duplicate row or obligation')
    for key, row in rows.items():
        row['dependsOn'] = obligations.get(key, {}).get('dependsOn', [])
    return rows, obligations


def promote(root, run_path):
    root, run_path = Path(root).resolve(), Path(run_path).resolve()
    if not run_path.is_relative_to(root):
        raise ValueError('run receipt must be inside the repository')
    ledger_path = root / 'data/second-edition/runtime-coverage.json'
    original = ledger_path.read_text()
    ledger = json.loads(original)
    manifest = json.loads((root / 'data/second-edition/runtime-obligations.json').read_text())
    raw = run_path.read_bytes()
    run = json.loads(raw)
    if (run.get('format') != 'runtime-coverage-run/v2' or run.get('exitCode') != 0
            or not run.get('command') or run.get('manifestSha256') != digest(manifest)
            or run.get('freezePolicy') != FREEZE_POLICY or run.get('files') != candidate_files(root)
            or manifest.get('acceptancePolicy') != ACCEPTANCE_POLICY):
        raise ValueError('run must bind a successful execution to the current candidate and manifest')
    cases = run.get('cases')
    if not isinstance(cases, list) or any(not isinstance(c, dict) or not isinstance(c.get('test'), dict)
                                          or c.get('result') not in {'passed', 'failed'} for c in cases):
        raise ValueError('invalid run cases')
    ids = [canonical_digest(c['test']) for c in cases]
    if len(ids) != len(set(ids)):
        raise ValueError('duplicate run case')
    passed = {canonical_digest(c['test']) for c in cases if c['result'] == 'passed'}
    run_ref = {'path': run_path.relative_to(root).as_posix(), 'sha256': hashlib.sha256(raw).hexdigest()}
    rows, obligations = resolved_rows(manifest, ledger)
    originals = {f"{r['entryId']}#{r['clauseKey']}": r for r in ledger['rows']}
    summary = {'verified': 0, 'accepted': 0, 'notApplicable': 0}
    bound = set()
    for key, row in rows.items():
        if row.get('coverageClass') != 'semantic' or row.get('status') == 'pending':
            continue
        if key not in obligations:
            raise ValueError(f'unknown obligation: {key}')
        if row.get('status') == 'accepted':
            if row.get('runEvidence') != run_ref:
                raise ValueError(f'accepted row uses a different run; rebind before promotion: {key}')
            bound.add(key)
            continue
        tests = row.get('tests', [])
        if not tests or any(not isinstance(t, dict) or t.get('kind') not in CONCRETE
                            or canonical_digest(t) not in passed for t in tests):
            continue
        if row.get('status') not in {'implemented', 'verified', 'notApplicable'}:
            continue
        if row['status'] == 'notApplicable':
            errors = not_applicable_errors(root, row, key, manifest)
            if errors:
                raise ValueError('; '.join(errors))
        elif not row.get('handler'):
            raise ValueError(f'missing handler: {key}')
        row['runEvidence'] = originals[key]['runEvidence'] = run_ref
        if row['status'] == 'implemented':
            row['status'] = originals[key]['status'] = 'verified'
            summary['verified'] += 1
        bound.add(key)
    done = {key for key in bound if rows[key]['status'] == 'accepted'}
    pending_receipts = []
    changed = True
    while changed:
        changed = False
        for key in bound - done:
            row = rows[key]
            if any(dep not in done for dep in obligations[key].get('dependsOn', [])):
                continue
            if row['status'] == 'notApplicable':
                summary['notApplicable'] += 1
            else:
                row['remaining'] = originals[key]['remaining'] = []
                row['status'] = originals[key]['status'] = 'accepted'
                receipt = build_acceptance_receipt(manifest, key, row, obligations[key], rows, run)
                # Hash filenames avoid slash/underscore collisions and path traversal.
                path = root / 'docs/operations/evidence/acceptance' / (canonical_digest(key) + '.json')
                data = (json.dumps(receipt, ensure_ascii=False, indent=2) + '\n').encode()
                row['acceptanceEvidence'] = originals[key]['acceptanceEvidence'] = {
                    'path': path.relative_to(root).as_posix(), 'sha256': hashlib.sha256(data).hexdigest()}
                pending_receipts.append((path, data))
                summary['accepted'] += 1
            done.add(key)
            changed = True
    if any(rows[key]['status'] == 'notApplicable' for key in bound - done):
        raise ValueError('notApplicable dependencies are not accepted')
    if 'summary' in ledger:
        ledger['summary']['statuses'] = dict(Counter(r['status'] for r in ledger['rows']))
    if ledger != json.loads(original):
        for path, data in pending_receipts:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n')
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--run', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(promote(args.root, args.run)))


if __name__ == '__main__':
    main()
