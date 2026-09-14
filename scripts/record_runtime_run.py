#!/usr/bin/env python3
"""Record runtime-coverage-run/v2 from reports and a pre-execution snapshot.

First call with --freeze-output, run the exact commands, then record with
--snapshot, --command, --exit-code, report paths, and --output. No tests run here.
"""
import argparse
import datetime
import functools
import json
import math
import re
import subprocess
from pathlib import Path

try:
    from .validate_runtime_coverage import FREEZE_POLICY, ast_index, candidate_files, canonical_digest, digest
except ImportError:
    from validate_runtime_coverage import FREEZE_POLICY, ast_index, candidate_files, canonical_digest, digest

CONCRETE = {'canonical-transition', 'structural-resolver', 'projection', 'worker-persistence', 'browser'}


def js_string(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, list):
        return ','.join('' if item is None else js_string(item) for item in value)
    if isinstance(value, dict):
        return '[object Object]'
    return str(value)


@functools.lru_cache(maxsize=4096)
def vitest_display(serialized):
    # Use the installed runner's display implementation for named parameters.
    return subprocess.run(['node', '-e',
        "const {createRequire}=require('node:module');"
        "const r=createRequire(require.resolve('vitest/package.json'));"
        "import(r.resolve('@vitest/utils/display')).then(m=>"
        "process.stdout.write(m.objDisplay(JSON.parse(process.argv[1]))))",
        serialized], cwd=Path(__file__).resolve().parent.parent,
        check=True, capture_output=True, text=True).stdout


@functools.lru_cache(maxsize=4096)
def inspect_object(serialized):
    # Node's formatter is used for object inspection, never shell interpolation.
    return subprocess.run(['node', '-e',
        "process.stdout.write(require('node:util').format('%o',JSON.parse(process.argv[1])))",
        serialized], check=True, capture_output=True, text=True).stdout


def format_title(template, parameters, index=None):
    if parameters is None:
        return template
    if isinstance(parameters, dict) and '$' in template:
        def lookup(match):
            value = parameters
            for part in match.group(1).split('.'):
                if not isinstance(value, dict) or part not in value:
                    raise ValueError('missing named parameter: ' + match.group(1))
                value = value[part]
            return vitest_display(json.dumps(value, ensure_ascii=False))
        return re.sub(r'\$([A-Za-z_][A-Za-z0-9_.]*)', lookup, template)
    values = iter(parameters if isinstance(parameters, list) else [parameters])
    def replace(match):
        code = match.group(1)
        if code == '%':
            return '%'
        if code == '#':
            if index is None:
                raise ValueError('row index required for %#')
            return str(index)
        try:
            value = next(values)
        except StopIteration:
            return match.group(0)
        if code == 'j':
            return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
        if code == 'o':
            return inspect_object(json.dumps(value))
        if code in 'id':
            if isinstance(value, bool):
                return 'NaN' if code == 'i' else str(int(value))
            try:
                number = float(value)
                if not math.isfinite(number):
                    return 'NaN'
                return str(int(number)) if code == 'i' or number.is_integer() else str(number)
            except (TypeError, ValueError):
                return 'NaN'
        return js_string(value)
    return re.sub(r'%([sidoj#%])', replace, template)


def relative_path(path, base, root):
    path = Path(path)
    return (path if path.is_absolute() else Path(base) / path).resolve().relative_to(Path(root).resolve()).as_posix()


def vitest_reported(report_path, root):
    data = json.loads(Path(report_path).read_text())
    for file in data.get('testResults', []):
        path = relative_path(file['name'], root, root)
        for assertion in file.get('assertionResults', []):
            yield {'path': path, 'ancestors': assertion.get('ancestorTitles', []),
                   'title': assertion['title'], 'status': assertion['status']}


def playwright_reported(report_path, root):
    data = json.loads(Path(report_path).read_text())
    base = Path(data.get('config', {}).get('rootDir', root))
    if not base.is_absolute():
        base = Path(root) / base
    def walk(suite, ancestors, file):
        file = suite.get('file', file)
        for spec in suite.get('specs', []):
            tests = spec.get('tests', [])
            passed = bool(tests) and all(t.get('results') and all(
                r.get('status') == 'passed' for r in t['results']) for t in tests)
            yield {'path': relative_path(spec.get('file', file), base, root), 'ancestors': ancestors,
                   'title': spec['title'], 'status': 'passed' if passed else 'failed'}
        for child in suite.get('suites', []):
            yield from walk(child, ancestors + ([child['title']] if child.get('title') else []), file)
    for suite in data.get('suites', []):
        yield from walk(suite, [], suite.get('file'))


def match_cases(refs, reported, indices=None):
    by_key = {}
    for item in reported:
        key = (item['path'], tuple(item['ancestors']), item['title'])
        by_key.setdefault(key, []).append(item['status'])
    cases, seen, executions = [], set(), {}
    for test_id, ref in refs.items():
        if ref.get('kind') not in CONCRETE:
            continue
        try:
            title = format_title(ref['title'], ref.get('parameters'), (indices or {}).get(test_id))
        except ValueError:
            continue
        key = (ref['path'], tuple(ref.get('suite', [])), title)
        results = by_key.get(key)
        identity = canonical_digest(ref)
        if results is None or identity in seen:
            continue
        # A title may omit parameters. Repeated successes cannot identify which
        # row ran, so require an unambiguous execution before issuing evidence.
        execution = canonical_digest({field: ref.get(field) for field in
                                      ('title', 'parameters', 'declarationSha256')})
        if key in executions and executions[key] != execution:
            raise ValueError(f'ambiguous reported test: {ref["path"]}: {title}')
        executions[key] = execution
        seen.add(identity)
        cases.append({'test': ref, 'result': 'passed' if all(r == 'passed' for r in results) else 'failed',
                      'reportedTitle': title})
    return cases


def verify_snapshot(snapshot, files, manifest_sha):
    if snapshot.get('files') != files:
        raise ValueError('candidate changed since pre-execution snapshot')
    if snapshot.get('manifestSha256') != manifest_sha:
        raise ValueError('manifest changed since pre-execution snapshot')


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--freeze-output', type=Path)
    parser.add_argument('--snapshot', type=Path)
    parser.add_argument('--vitest', type=Path, action='append', default=[])
    parser.add_argument('--playwright', type=Path, action='append', default=[])
    parser.add_argument('--command', action='append', default=[])
    parser.add_argument('--exit-code', type=int)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    manifest_sha = digest(json.loads((root / 'data/second-edition/runtime-obligations.json').read_text()))
    files = candidate_files(root)
    if args.freeze_output:
        write_json(args.freeze_output, {'format': 'runtime-candidate-snapshot/v1', 'freezePolicy': FREEZE_POLICY,
            'manifestSha256': manifest_sha, 'files': files,
            'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat()})
        return
    if not args.snapshot or not args.output or not args.command or args.exit_code is None:
        parser.error('recording requires --snapshot, --output, --command and --exit-code')
    snapshot = json.loads(args.snapshot.read_text())
    if snapshot.get('format') != 'runtime-candidate-snapshot/v1' or snapshot.get('freezePolicy') != FREEZE_POLICY:
        parser.error('invalid pre-execution snapshot')
    verify_snapshot(snapshot, files, manifest_sha)
    reported = []
    for report_path, reader in [(p, vitest_reported) for p in args.vitest] + [(p, playwright_reported) for p in args.playwright]:
        if report_path.stat().st_mtime < args.snapshot.stat().st_mtime:
            parser.error('report predates pre-execution snapshot')
        reported.extend(reader(report_path, root))
    if not reported:
        parser.error('no reported test cases')
    ledger = json.loads((root / 'data/second-edition/runtime-coverage.json').read_text())
    registry = ledger.get('testCases', {})
    active = {test_id for row in ledger.get('rows', []) for test_id in row.get('tests', [])
              if isinstance(test_id, str)}
    refs = {test_id: registry[test_id] for test_id in sorted(active)}
    indexed = {k: ref for k, ref in refs.items() if '%#' in ref['title']}
    indices = {}
    if indexed:
        ast = ast_index(root, {r['path'] for r in indexed.values()})
        for key, ref in indexed.items():
            for test in ast.get(ref['path'], {}).get('tests', []):
                if (test['title'], test['suite'], test['declarationSha256']) != (ref['title'], ref.get('suite', []), ref['declarationSha256']):
                    continue
                positions = [i for i, param in enumerate(test.get('parameters') or []) if param == ref.get('parameters')]
                if len(positions) == 1:
                    indices[key] = positions[0]
    cases = match_cases(refs, reported, indices)
    if not cases:
        parser.error('no concrete ledger references matched')
    failed = sum(case['result'] != 'passed' for case in cases)
    receipt = {'format': 'runtime-coverage-run/v2', 'command': ' && '.join(args.command), 'commands': args.command,
        'exitCode': args.exit_code, 'manifestSha256': manifest_sha, 'freezePolicy': FREEZE_POLICY,
        'files': files, 'cases': cases, 'snapshotCreatedAt': snapshot['createdAt'],
        'scope': f'{len(cases)} matched references; {failed} unsuccessful'}
    write_json(args.output, receipt)
    print(json.dumps({'written': str(args.output), 'matched': len(cases), 'failed': failed}))


if __name__ == '__main__':
    main()
