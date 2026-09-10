#!/usr/bin/env python3
"""Apply AST-checked concrete bindings. Successful run evidence is added separately."""
import argparse
import copy
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from ledger_report import CONCRETE
from validate_runtime_coverage import ast_index, canonical_digest


def extract_declarations(root, paths):
    return ast_index(Path(root).resolve(), sorted(set(paths)))


def apply_bindings(ledger, bindings, declarations):
    if not bindings:
        return ledger
    updated = copy.deepcopy(ledger)
    rows = {f"{r['entryId']}#{r['clauseKey']}": r for r in updated['rows']}
    if len(rows) != len(updated['rows']):
        raise ValueError('duplicate ledger row')
    seen = set()

    def register(registry, prefix, payload):
        ref = f'{prefix}:{canonical_digest(payload)[:16]}'
        entries = updated.setdefault(registry, {})
        if ref in entries and entries[ref] != payload:
            raise ValueError(f'reference collision: {ref}')
        entries[ref] = payload
        return ref

    for binding in bindings:
        key = binding['row']
        row = rows.get(key)
        if row is None or row.get('coverageClass') != 'semantic' or key in seen:
            raise ValueError(f'unknown, nonsemantic or repeated row: {key}')
        seen.add(key)
        status = binding.get('status')
        if status not in {'implemented', 'notApplicable'}:
            raise ValueError(f'binding may not set status {status}: {key}')
        handlers = binding.get('handler') or [updated['handlers'][ref] for ref in row.get('handler', [])]
        handler_ids = []
        for handler in handlers:
            if handler['symbol'] not in declarations.get(handler['path'], {}).get('functions', []):
                raise ValueError(f'unknown handler {handler}: {key}')
            handler_ids.append(register('handlers', 'h', {k: handler[k] for k in ('path', 'symbol')}))
        if status == 'implemented' and not handler_ids:
            raise ValueError(f'implemented row needs a handler: {key}')
        test_ids = []
        for test in binding.get('tests', []):
            matches = [t for t in declarations.get(test['path'], {}).get('tests', [])
                       if t['title'] == test['title'] and t['suite'] == test.get('suite', [])]
            if len(matches) != 1:
                raise ValueError(f'nonexistent or ambiguous test: {key}')
            declared = matches[0]
            parameters = test.get('parameters')
            if declared.get('disabled') or '${' in declared['title'] or test['kind'] not in CONCRETE:
                raise ValueError(f'test must be enabled, static and concrete: {key}')
            if declared.get('each') and parameters is None:
                raise ValueError(f'each test needs concrete parameters: {key}')
            if parameters is not None and (not declared.get('each') or not any(
                    canonical_digest(parameters) == canonical_digest(p) for p in declared.get('parameters') or [])):
                raise ValueError(f'unknown parameters: {key}')
            if not declared.get('declarationSha256'):
                raise ValueError(f'missing declaration digest: {key}')
            payload = {'path': test['path'], 'suite': test.get('suite', []), 'title': test['title'],
                       'declarationSha256': declared['declarationSha256'], 'kind': test['kind'],
                       'parameters': parameters, 'bindingNote': test.get('bindingNote')}
            test_ids.append(register('testCases', 't', payload))
        if not test_ids or len(test_ids) != len(set(test_ids)):
            raise ValueError(f'row needs distinct concrete tests: {key}')
        notes = binding.get('remaining', [])
        if any(not isinstance(note, str) or not note.strip() for note in notes):
            raise ValueError(f'invalid remaining note: {key}')
        if status == 'implemented' and not notes:
            raise ValueError(f'implemented row needs a remaining note: {key}')
        row.update(handler=handler_ids, tests=test_ids, status=status,
                   remaining=[register('remainingNotes', 'n', note) for note in notes])
        for field in ('runEvidence', 'acceptanceEvidence', 'reviewEvidence', 'notApplicable'):
            row.pop(field, None)
        if status == 'notApplicable':
            spec = copy.deepcopy(binding.get('notApplicable', {}))
            if any(not spec.get(field) for field in ('reason', 'basis', 'edition', 'decidedOn', 'decidedBy')):
                raise ValueError(f'incomplete notApplicable decision: {key}')
            retained = [updated['testCases'][ref] for ref in test_ids]
            if 'retainedTests' in spec and spec['retainedTests'] != retained:
                raise ValueError(f'notApplicable retainedTests mismatch: {key}')
            spec['retainedTests'] = retained
            row.update(notApplicable=spec, remaining=[])
            row.pop('gapKind', None)
    if 'summary' in updated:
        updated['summary']['statuses'] = dict(Counter(row['status'] for row in updated['rows']))
    ledger.clear()
    ledger.update(updated)
    return ledger


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--bindings', type=Path, required=True)
    args = parser.parse_args()
    path = args.root / 'data/second-edition/runtime-coverage.json'
    ledger = json.loads(path.read_text())
    bindings = json.loads(args.bindings.read_text())['bindings']
    if bindings:
        rows = {f"{r['entryId']}#{r['clauseKey']}": r for r in ledger['rows']}
        paths = {ref['path'] for binding in bindings for field in ('handler', 'tests')
                 for ref in binding.get(field, [])}
        paths.update(ledger['handlers'][ref]['path'] for binding in bindings
                     if not binding.get('handler') for ref in rows.get(binding['row'], {}).get('handler', []))
        apply_bindings(ledger, bindings, extract_declarations(args.root, paths))
        path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'applied': len(bindings)}))


if __name__ == '__main__':
    main()
