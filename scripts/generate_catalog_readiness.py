#!/usr/bin/env python3
"""Generate a compact runtime gate from the existing coverage validator."""
import argparse
import json
from pathlib import Path
try:
    from .validate_runtime_coverage import validate, digest
except ImportError:
    from validate_runtime_coverage import validate, digest

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = 'packages/catalog/src/selected/readiness.json'


def readiness(root, *, fixture=False):
    manifest = json.loads((root / 'data/second-edition/runtime-obligations.json').read_text())
    ledger = json.loads((root / 'data/second-edition/runtime-coverage.json').read_text())
    structural = validate(root, manifest, ledger, fixture=fixture)
    if structural:
        raise ValueError('invalid coverage: ' + structural[0])
    errors = validate(root, manifest, ledger, fixture=fixture, require_accepted=True)
    return {'format': 'catalog-readiness/v1', 'ready': not errors,
            'manifestSha256': digest(manifest), 'ledgerSha256': digest(ledger)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--require-ready', action='store_true')
    args = parser.parse_args()
    try:
        expected = readiness(ROOT)
        path = ROOT / OUTPUT
        if args.check:
            if not path.is_file() or json.loads(path.read_text()) != expected:
                raise ValueError('catalog readiness is stale or modified; regenerate from validated coverage')
        else:
            path.write_text(json.dumps(expected, ensure_ascii=False, indent=2) + '\n')
        if args.require_ready and not expected['ready']:
            raise ValueError('catalog has no complete accepted coverage')
        print(json.dumps({'valid': True, 'ready': expected['ready']}))
        return 0
    except (ValueError, OSError) as error:
        print(str(error))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
