#!/usr/bin/env python3
"""Build a test-only acceptance receipt from a bound run JSON and ledger row.

Does not rewrite row status. Reviewer/reviewed/verdict fields are refused.
"""
import argparse
import json
import sys
from pathlib import Path

try:
    from .validate_runtime_coverage import ACCEPTANCE_POLICY, digest, reviewed_row_digest
except ImportError:
    from validate_runtime_coverage import ACCEPTANCE_POLICY, digest, reviewed_row_digest


def build_acceptance_receipt(manifest, row_key, row, obligation, dependency_rows, run):
    if any(run.get(field) for field in ('reviewer', 'reviewed', 'verdict')):
        raise ValueError('run receipt cannot carry reviewer/reviewed/verdict')
    return {
        'format': ACCEPTANCE_POLICY,
        'policy': ACCEPTANCE_POLICY,
        'manifestSha256': digest(manifest),
        'obligations': [row_key],
        'rowDigests': {row_key: reviewed_row_digest(row, obligation, dependency_rows)},
        'command': run.get('command'),
        'cases': run.get('cases'),
        'files': run.get('files'),
        'freezePolicy': run.get('freezePolicy'),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--ledger', type=Path, required=True)
    parser.add_argument('--row-key', required=True)
    parser.add_argument('--row', type=Path, required=True)
    parser.add_argument('--obligation', type=Path, required=True)
    parser.add_argument('--run', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        from .promote_ledger import resolved_rows
    except ImportError:
        from promote_ledger import resolved_rows
    manifest = json.loads(args.manifest.read_text())
    rows, obligations = resolved_rows(manifest, json.loads(args.ledger.read_text()))
    if args.row_key not in rows or args.row_key not in obligations:
        raise ValueError('row key must exist in ledger and manifest')
    # Require the caller-provided row/obligation to describe the ledger input.
    ledger_row = next(r for r in json.loads(args.ledger.read_text())['rows']
                      if f"{r['entryId']}#{r['clauseKey']}" == args.row_key)
    manifest_obligation = next(o for o in manifest['obligations']
                               if f"{o['entryId']}#{o['clauseKey']}" == args.row_key)
    if json.loads(args.row.read_text()) != ledger_row or json.loads(args.obligation.read_text()) != manifest_obligation:
        raise ValueError('row/obligation input differs from ledger/manifest')
    receipt = build_acceptance_receipt(
        manifest, args.row_key, rows[args.row_key], obligations[args.row_key],
        rows, json.loads(args.run.read_text()))
    args.output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'written': str(args.output), 'policy': ACCEPTANCE_POLICY}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
