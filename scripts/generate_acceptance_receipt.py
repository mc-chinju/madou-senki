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
    parser.add_argument('--row-key', required=True)
    parser.add_argument('--row', type=Path, required=True)
    parser.add_argument('--obligation', type=Path, required=True)
    parser.add_argument('--run', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    receipt = build_acceptance_receipt(
        json.loads(args.manifest.read_text()), args.row_key,
        json.loads(args.row.read_text()), json.loads(args.obligation.read_text()),
        {}, json.loads(args.run.read_text()))
    args.output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'written': str(args.output), 'policy': ACCEPTANCE_POLICY}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
