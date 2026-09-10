#!/usr/bin/env python3
"""Validate correspondence evidence, never infer gameplay correctness or playability.

Sources use RFC6901 pointers, canonical JSON UTF-8 hashes and codepoint spans.
The checked-in obligation set requires independent review; do not regenerate it
from the ledger. A passing check means structural consistency only.
"""
import argparse
import copy
from collections import Counter
import hashlib
import json
import re
import os
from pathlib import Path
import subprocess

METADATA = {'id', 'page', 'row', 'column', 'questions', 'visually_verified'}
KINDS = {'canonical-transition', 'structural-resolver', 'related', 'projection', 'worker-persistence', 'browser'}


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


ADOPTED_RULING_FILES = tuple('docs/rules/second-edition/' + name for name in (
    'rulings.md', 'rulings-characters.md', 'rulings-actions-01-06.md',
    'rulings-actions-07-17.md', 'rulings-actions-18-25.md'))
FREEZE_POLICY = 'runtime-candidate-v3'
FREEZE_ROOTS = ('packages', 'apps', 'tests', 'scripts', 'data', 'resources', '.github/workflows', 'docs/rules/second-edition')
# Freeze every root file, including dot-configs and future runner entrypoints.
FREEZE_ROOT_PATTERNS = ('*',)
FREEZE_EXCLUDED_DIRS = {'node_modules', '.git', '.wrangler', 'dist', 'build', 'coverage',
                        'playwright-report', 'test-results', '__pycache__', '.cache'}
FREEZE_SEPARATELY_BOUND = {'data/second-edition/runtime-coverage.json', 'data/second-edition/runtime-obligations.json',
                          'packages/catalog/src/selected/readiness.json'}


def canonical_digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def candidate_files(root):
    """Conservative source/test/catalog/assets/runner/config/dependency freeze.

    Manifest is bound by its digest; ledger mappings by row review digests.
    Derived readiness is checked against this validator at build time, excluded
    to avoid a generated-output/candidate-receipt hash cycle.
    Receipts live outside these roots. Generated caches/build output are not
    candidate inputs. The exact path set is checked, including additions.
    """
    root = Path(root).resolve()
    candidates = set()
    for directory in FREEZE_ROOTS:
        for current, directories, files in os.walk(root / directory):
            directories[:] = [d for d in directories if d not in FREEZE_EXCLUDED_DIRS]
            candidates.update(Path(current) / name for name in files)
    candidates.update(p for pattern in FREEZE_ROOT_PATTERNS for p in root.glob(pattern) if p.is_file())
    result = {}
    for path in sorted(candidates):
        relative = path.relative_to(root)
        if set(relative.parts) & FREEZE_EXCLUDED_DIRS or str(relative) in FREEZE_SEPARATELY_BOUND:
            continue
        if not path.resolve().is_relative_to(root):
            raise ValueError(f'candidate symlink escapes repository: {relative}')
        result[str(relative)] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def ruling_blocks(root):
    """Enumerate every nonblank block in the explicitly adopted documents.

    Paragraphs, list items and table rows are review obligations, not an
    assertion that a paragraph contains only one semantic requirement.
    Questions/headings/context remain source anchors but are not new rules.
    """
    blocks = []
    references = set()
    for relative in ADOPTED_RULING_FILES:
        path = root / relative
        if not path.is_file():
            continue
        section, counters = 'common', Counter()
        chunks = re.split(r'\n[ \t]*\n', path.read_text().strip())
        blocks_with_headings = [part for chunk in chunks for part in re.split(r'(?m)(?=^#{1,6} |^<a )', chunk) if part.strip()]
        for block in blocks_with_headings:
            block = block.strip()
            if not block:
                continue
            heading = re.match(r'^#{2,3} ([GCAFT]\d+)\b', block)
            if heading:
                section = heading.group(1)
                references.add(relative + '#' + section)
            pieces = block.splitlines() if all(line.startswith(('|', '- ')) for line in block.splitlines()) else [block]
            for piece_index, piece in enumerate(pieces):
                counters[section] += 1
                context = bool(re.match(r'^(#|<a |作成:|出典|根拠|\*\*(Q\d|元の疑問|対応|原文から確定する中核)|\|[-: |]+\|$)', piece))
                if piece_index == 0 and len(pieces) > 1 and re.match(r'^\|[-: |]+\|$', pieces[1]):
                    context = True
                blocks.append({'path': relative, 'pointer': f'/sections/{section}/blocks/{counters[section]:03}',
                               'text': piece, 'section': section, 'role': 'source-context' if context else 'ruling-paragraph'})
    return blocks, references


def resolve_ruling(reference):
    if not isinstance(reference, str):
        return None
    if re.fullmatch(r'G\d+', reference):
        return ADOPTED_RULING_FILES[0] + '#' + reference
    if re.fullmatch(r'C\d+', reference):
        return ADOPTED_RULING_FILES[1] + '#' + reference
    if '#' in reference:
        path, anchor = reference.rsplit('#', 1)
        return path + '#' + anchor.upper()
    return None


def reviewed_row_digest(row, obligation, rows):
    """Bind reviewed mapping/run and transitive dependency states without self-reference.

    Exclude own status/reviewEvidence; include dependencies' status and review
    receipts, plus their mappings/run references. Cycles are separately refused.
    """
    fields = ('entryId', 'clauseKey', 'source', 'rulingIds', 'handler', 'tests', 'remaining', 'runEvidence')
    def payload(value):
        return {field: value.get(field) for field in fields}
    dependencies = {}
    pending = list(obligation.get('dependsOn', []))
    while pending:
        key = pending.pop()
        if key in dependencies:
            continue
        dependency = rows.get(key, {})
        dependencies[key] = dict(payload(dependency), status=dependency.get('status'), reviewEvidence=dependency.get('reviewEvidence'))
        pending.extend(dependency.get('dependsOn', []))
    return canonical_digest({'row': payload(row), 'obligation': obligation, 'dependencies': dependencies})


def leaves(value, pointer=''):
    if isinstance(value, dict) and value:
        for k, v in value.items():
            if k not in METADATA:
                yield from leaves(v, pointer + '/' + k.replace('~', '~0').replace('/', '~1'))
    elif isinstance(value, list) and value:
        for i, v in enumerate(value):
            yield from leaves(v, pointer + '/' + str(i))
    else:
        yield pointer, value


def source_inventory(root):
    found = {}
    for path in sorted((root / 'data/second-edition').glob('*.json')):
        if path.name not in {'characters.json', 'scenarios.json', 'aliases.json'} and not path.name.startswith('actions-'):
            continue
        data = json.loads(path.read_text())
        fields = ['cards', 'common_specification'] if 'cards' in data else ['scenarios'] if 'scenarios' in data else ['entries']
        for field in fields:
            if field in data:
                for pointer, value in leaves(data[field], '/' + field):
                    found[(str(path.relative_to(root)), pointer)] = value
    blocks, _ = ruling_blocks(root)
    found.update({(b['path'], b['pointer']): b['text'] for b in blocks})
    return found


def ast_index(root, paths):
    if not paths:
        return {}
    call = subprocess.run(['node', str(Path(__file__).with_name('runtime_coverage_ast.cjs'))],
                          input=json.dumps({'root': str(root), 'paths': sorted(paths)}), text=True, capture_output=True)
    if call.returncode:
        raise ValueError('AST index failed: ' + call.stderr.strip())
    return json.loads(call.stdout)


def coverage_class(obligation):
    kind = obligation.get('kind')
    if kind in {'source-field', 'source-context', 'shared-source'}:
        return 'integrity'
    return 'aggregate' if kind == 'ruling-paragraph' else 'semantic'


def validate(root, manifest, ledger, fixture=False, require_accepted=False):
    root = Path(root).resolve()
    manifest_digest = digest(manifest)
    manifest, ledger = copy.deepcopy(manifest), copy.deepcopy(ledger)
    errors = []
    if not isinstance(manifest, dict) or not isinstance(ledger, dict):
        return ['manifest and ledger must be objects']
    for obj, field in [(manifest, 'sources'), (manifest, 'obligations'), (ledger, 'rows')]:
        if not isinstance(obj.get(field), list) or any(not isinstance(r, dict) for r in obj[field]):
            return [f'invalid {field} row object/list']
    scenario_ids = [s.get('entryId') for s in ledger.get('scenarios', []) if isinstance(s, dict)]
    if len(scenario_ids) != len(set(scenario_ids)):
        errors.append('duplicate scenario reference')
    source_ids = [s['sourceId'] for s in manifest['sources'] if 'sourceId' in s]
    if len(source_ids) != len(set(source_ids)):
        errors.append('duplicate source registry ID')
    source_refs = {s['sourceId']: s for s in manifest['sources'] if 'sourceId' in s}
    registries = {'source': source_refs, 'handler': ledger.get('handlers', {}), 'tests': ledger.get('testCases', {}), 'remaining': ledger.get('remainingNotes', {})}
    for row in manifest['obligations'] + ledger['rows']:
        for field, registry in registries.items():
            if isinstance(row.get(field), list):
                resolved = []
                for ref in row[field]:
                    if isinstance(ref, str) and ref in registry:
                        resolved.append(registry[ref])
                    elif isinstance(ref, str) and field != 'remaining':
                        errors.append(f'unknown {field} reference {ref}')
                    else: resolved.append(ref)
                row[field] = resolved
    for row in manifest['obligations'] + ledger['rows']:
        for field in ['source', 'handler', 'tests']:
            if field in row and (not isinstance(row[field], list) or any(not isinstance(ref, dict) for ref in row[field])):
                errors.append(f'invalid {field} reference object/list')
    if errors: return errors
    def receipt(ref, label, key):
        if not isinstance(ref, dict) or not isinstance(ref.get('path'), str) or not isinstance(ref.get('sha256'), str):
            errors.append(f'invalid {label} receipt {key}')
            return {}
        path = (root / ref['path']).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            errors.append(f'missing {label} receipt {key}')
            return {}
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != ref['sha256']:
            errors.append(f'{label} receipt hash mismatch {key}')
            return {}
        try: data = json.loads(raw)
        except (ValueError, UnicodeError): data = None
        if not isinstance(data, dict):
            errors.append(f'invalid {label} receipt JSON {key}')
            return {}
        return data
    if manifest.get('schemaVersion') != 1 or ledger.get('schemaVersion') != 1:
        errors.append('unsupported schema version')
    if manifest.get('revision') != ledger.get('manifestRevision'):
        errors.append('manifest revision mismatch')
    inventory = source_inventory(root)
    _, ruling_references = ruling_blocks(root)
    frozen_candidate = None
    sources = manifest.get('sources', [])
    covered = {}
    for source in sources:
        key = (source.get('path'), source.get('pointer'))
        if key not in inventory:
            errors.append(f'unknown source {key}')
            continue
        value = inventory[key]
        if source.get('sha256') != digest(value):
            errors.append(f'source hash mismatch {key}')
        text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, separators=(',', ':'))
        span = source.get('span', [])
        if len(span) != 2 or not all(isinstance(i, int) for i in span) or not 0 <= span[0] <= span[1] <= len(text):
            errors.append(f'invalid source span {key}')
            continue
        if source.get('quote') != text[span[0]:span[1]]:
            errors.append(f'source quote mismatch {key}')
        covered.setdefault(key, set()).update(range(*span))
    for key, value in inventory.items():
        if key not in covered:
            errors.append(f'uncovered source {key}')
        else:
            text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, separators=(',', ':'))
            if set(range(len(text))) - covered[key]:
                errors.append(f'uncovered span {key}')
    def index(rows, label):
        result = {}
        for row in rows:
            key = str(row.get('entryId', '')) + '#' + str(row.get('clauseKey', ''))
            if key in result:
                errors.append(f'duplicate {label} {key}')
            if not row.get('entryId') or not row.get('clauseKey'):
                errors.append(f'missing identity {label}')
            result[key] = row
        return result
    expected = index(manifest.get('obligations', []), 'manifest obligation')
    actual = index(ledger.get('rows', []), 'ledger obligation')
    # Classifications and paragraph mappings are independently attested; changing
    # a semantic kind cannot manufacture completion by removing its runtime gate.
    if require_accepted or ledger.get('classificationReview') is not None:
        review = receipt(ledger.get('classificationReview'), 'classification review', 'manifest')
        if (review.get('format') != 'runtime-coverage-classification/v1'
                or review.get('manifestSha256') != manifest_digest
                or review.get('verdict') != 'accepted' or not review.get('reviewer')):
            errors.append('missing current independent classification review')
    for identity, obligation in expected.items():
        category = coverage_class(obligation)
        for obj in [obligation, actual.get(identity, {})]:
            if obj.get('coverageClass', category) != category:
                errors.append(f'coverage class mismatch {identity}')
            if not fixture and obj.get('coverageClass') != category:
                errors.append(f'missing explicit coverage class {identity}')
        if actual.get(identity, {}).get('kind') != obligation.get('kind'):
            errors.append(f'coverage kind mismatch {identity}')
        if category == 'integrity':
            prefix = 'source-context/' if obligation.get('kind') == 'source-context' else 'source/'
            if not obligation.get('clauseKey', '').startswith(prefix):
                errors.append(f'invalid integrity identity {identity}')
        for field in ['dependsOn', 'contextRefs', 'covers']:
            refs = obligation.get(field, [])
            if not isinstance(refs, list) or any(not isinstance(ref, str) for ref in refs):
                errors.append(f'invalid {field} list {identity}')
                continue
            if len(refs) != len(set(refs)):
                errors.append(f'duplicate {field} {identity}')
            for ref in refs:
                if ref not in expected:
                    errors.append(f'unknown {field} reference {identity}: {ref}')
                elif field in {'dependsOn', 'covers'} and coverage_class(expected[ref]) != 'semantic':
                    errors.append(f'non-semantic dependency {identity}: {ref}')
        if category != 'semantic' and obligation.get('dependsOn'):
            errors.append(f'non-semantic source uses runtime dependencies {identity}')
        if category == 'semantic' and obligation.get('covers'):
            errors.append(f'semantic row uses aggregate covers {identity}')
        row = actual.get(identity, {})
        if category != 'semantic':
            if row.get('status') != 'pending' or row.get('handler') or row.get('tests') or row.get('runEvidence') or row.get('reviewEvidence'):
                errors.append(f'non-semantic runtime status/evidence {identity}')
        elif require_accepted and row.get('status') != 'accepted':
            errors.append(f'unaccepted semantic obligation {identity}')
        if category == 'aggregate' and (require_accepted or row.get('mappingReview') is not None):
            review = receipt(row.get('mappingReview'), 'mapping review', identity)
            if (not obligation.get('covers') or review.get('format') != 'runtime-coverage-mapping/v1'
                    or review.get('manifestSha256') != manifest_digest
                    or review.get('obligation') != identity
                    or review.get('mappingDigest') != canonical_digest(obligation)
                    or review.get('verdict') != 'accepted' or not review.get('reviewer')):
                errors.append(f'incomplete aggregate mapping or independent review {identity}')
            if require_accepted:
                for ref in obligation.get('covers', []):
                    if actual.get(ref, {}).get('status') != 'accepted':
                        errors.append(f'unaccepted aggregate child {identity}: {ref}')
    if any(error.startswith(('invalid dependsOn list', 'invalid contextRefs list', 'invalid covers list')) for error in errors):
        return errors
    colors = {}
    for identity in expected:
        stack = [(identity, False)]
        while stack:
            node, leaving = stack.pop()
            if leaving:
                colors[node] = 2
                continue
            if colors.get(node) == 1:
                errors.append(f'cyclic dependency {node}')
                continue
            if colors.get(node) == 2 or node not in expected:
                continue
            colors[node] = 1
            stack.append((node, True))
            stack.extend((dep, False) for dep in expected[node].get('dependsOn', []))
    dependency_rows = {identity: dict(value, dependsOn=expected.get(identity, {}).get('dependsOn', [])) for identity, value in actual.items()}
    for key in expected.keys() - actual.keys(): errors.append(f'missing obligation {key}')
    for key in actual.keys() - expected.keys(): errors.append(f'unknown obligation {key}')
    source_signatures = {json.dumps(s, sort_keys=True, ensure_ascii=False) for s in sources}
    used_sources = set()
    for key, obligation in expected.items():
        for ruling in obligation.get('rulingIds', []):
            if resolve_ruling(ruling) not in ruling_references:
                errors.append(f'unknown ruling reference {key}: {ruling}')
        for source in obligation.get('source', []):
            signature = json.dumps(source, sort_keys=True, ensure_ascii=False)
            used_sources.add(signature)
            if signature not in source_signatures: errors.append(f'unknown obligation source {key}')
        if not obligation.get('source'): errors.append(f'source-less manifest obligation {key}')
        for dependency in obligation.get('dependsOn', []):
            if dependency not in expected: errors.append(f'unknown dependency {key}: {dependency}')
    if source_signatures - used_sources:
        errors.append('source anchors without obligations')
    for key, row in actual.items():
        for field in ['handler', 'tests', 'source', 'rulingIds', 'remaining']:
            if not isinstance(row.get(field), list):
                errors.append(f'invalid {field} list {key}')
    if any(' list ' in e for e in errors):
        return errors
    paths = {ref.get('path', '') for row in actual.values() for ref in row.get('handler', []) + row.get('tests', [])}
    safe_paths = set()
    for path in paths:
        if not path or not (root / path).resolve().is_relative_to(root): errors.append(f'unsafe evidence path {path}')
        elif not (root / path).is_file(): errors.append(f'missing evidence file {path}')
        else: safe_paths.add(path)
    try:
        declarations = ast_index(root, safe_paths)
    except (ValueError, OSError) as error:
        declarations = {}
        errors.append(str(error))
    for key, row in actual.items():
        for field in ['entryId', 'clauseKey', 'source', 'rulingIds', 'handler', 'tests', 'status', 'remaining']:
            if field not in row: errors.append(f'missing {field} {key}')
        if not row.get('source'): errors.append(f'source-less ledger obligation {key}')
        if key in expected:
            for field in ['source', 'rulingIds']:
                if row.get(field) != expected[key].get(field): errors.append(f'{field} differs from manifest {key}')
        status = row.get('status')
        if status not in {'pending', 'implemented', 'verified', 'accepted'}: errors.append(f'invalid status {key}')
        if status in {'pending', 'implemented'} and not row.get('remaining'): errors.append(f'unverified row needs remaining evidence/gap note {key}')
        if status in {'implemented', 'verified', 'accepted'} and not row.get('handler'): errors.append(f'missing handler {key}')
        if status in {'verified', 'accepted'}:
            if not row.get('tests'): errors.append(f'missing concrete tests {key}')
            run = receipt(row.get('runEvidence'), 'run evidence', key)
            if frozen_candidate is None:
                frozen_candidate = candidate_files(root)
            if run.get('format') != 'runtime-coverage-run/v2' or run.get('exitCode') != 0 or not run.get('command'):
                errors.append(f'missing successful bound run evidence {key}')
            if run.get('manifestSha256') != manifest_digest:
                errors.append(f'run evidence lacks current source binding {key}')
            if run.get('freezePolicy') != FREEZE_POLICY or run.get('files') != frozen_candidate:
                errors.append(f'run evidence candidate path/hash/policy mismatch {key}')
            cases = run.get('cases')
            if not isinstance(cases, list) or any(not isinstance(case, dict) for case in cases):
                errors.append(f'invalid run evidence cases list {key}')
                cases = []
            case_ids = [canonical_digest(case.get('test')) for case in cases]
            if len(case_ids) != len(set(case_ids)):
                errors.append(f'duplicate run evidence case {key}')
            passed = [case.get('test') for case in cases if case.get('result') == 'passed']
            for test in row.get('tests', []):
                if test not in passed:
                    errors.append(f'run evidence missing exact passed case {key}: {test.get("title")}')
        if status == 'accepted':
            if row.get('remaining'): errors.append(f'accepted row has remaining {key}')
            review = receipt(row.get('reviewEvidence'), 'review', key)
            if manifest.get('review', {}).get('status') != 'reviewed' or review.get('format') != 'runtime-coverage-review/v2' or review.get('verdict') != 'accepted' or not review.get('reviewer') or review.get('manifestSha256') != manifest_digest or key not in review.get('obligations', []):
                errors.append(f'missing independent review receipt evidence {key}')
            if not isinstance(review.get('rowDigests'), dict) or review['rowDigests'].get(key) != reviewed_row_digest(row, expected.get(key, {}), dependency_rows):
                errors.append(f'review receipt current row/candidate/dependency binding mismatch {key}')
            for dep in expected.get(key, {}).get('dependsOn', []):
                if actual.get(dep, {}).get('status') != 'accepted': errors.append(f'unaccepted dependency {key}: {dep}')
        for ref in row.get('handler', []):
            if ref.get('symbol') not in declarations.get(ref.get('path'), {}).get('functions', []):
                errors.append(f'nonexistent handler declaration {key}: {ref}')
        for ref in row.get('tests', []):
            matches = [t for t in declarations.get(ref.get('path'), {}).get('tests', []) if t['title'] == ref.get('title') and t['suite'] == ref.get('suite', [])]
            if len(matches) != 1: errors.append(f'nonexistent or ambiguous test declaration {key}: {ref}')
            elif status in {'verified', 'accepted'} and matches[0].get('disabled'):
                errors.append(f'disabled test cannot have passed evidence {key}')
            elif ref.get('declarationSha256') != matches[0]['declarationSha256']: errors.append(f'test declaration hash mismatch {key}: {ref.get("title")}')
            elif 'parameters' in ref and ref['parameters'] is not None and (matches[0]['parameters'] is None or ref['parameters'] not in matches[0]['parameters']): errors.append(f'unknown concrete test parameters {key}')
            elif status in {'verified', 'accepted'} and (matches[0]['each'] or '${' in matches[0]['title']) and ref.get('parameters') is None: errors.append(f'unresolved concrete test parameters {key}')
            if ref.get('kind') not in KINDS: errors.append(f'invalid evidence kind {key}')
            if status in {'verified', 'accepted'} and ref.get('kind') == 'related': errors.append(f'related evidence cannot verify {key}')
    if not fixture:
        actions = [c for p in (root / 'data/second-edition').glob('actions-*.json') for c in json.loads(p.read_text())['cards']]
        chars = json.loads((root / 'data/second-edition/characters.json').read_text())['cards']
        abilities = [a for c in chars for a in c['abilities']]
        for label, records, want in [('actions', actions, 220), ('characters', chars, 26), ('abilities', abilities, 110)]:
            ids = [r['id'] for r in records]
            if len(ids) != want or len(set(ids)) != want: errors.append(f'{label} canonical count/duplicates expected {want}')
            for identity in ids:
                if not any(o['entryId'] == identity for o in expected.values()): errors.append(f'missing {label} entry {identity}')
        scenarios = ledger.get('scenarios', [])
        if Counter(s.get('entryId') for s in scenarios) != Counter(f'S{i:02}' for i in range(1,33)): errors.append('scenario mapping must cover S01-S32 exactly once')
        for s in scenarios:
            if s.get('classification') not in {'exact-core', 'structural-resolver', 'related', 'pending'} or not s.get('remaining'): errors.append(f'invalid scenario mapping {s.get("entryId")}')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo-root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--ledger', type=Path)
    parser.add_argument('--require-accepted', action='store_true', help='Require independent classification/mapping review and accepted semantic obligations; integrity anchors never require gameplay acceptance.')
    args = parser.parse_args()
    manifest_path = args.manifest or args.repo_root / 'data/second-edition/runtime-obligations.json'
    ledger_path = args.ledger or args.repo_root / 'data/second-edition/runtime-coverage.json'
    manifest, ledger = (json.loads(p.read_text()) for p in [manifest_path, ledger_path])
    errors = validate(args.repo_root, manifest, ledger, require_accepted=args.require_accepted)
    for error in errors: print(error)
    print(json.dumps({'valid': not errors, 'rows': len(ledger['rows']), 'statuses': dict(Counter(r['status'] for r in ledger['rows'])),
                      'coverageClasses': dict(Counter(coverage_class(o) for o in manifest['obligations'])),
                      'sourceIntegrity': 'valid' if not errors else 'not-confirmed', 'acceptanceRequired': args.require_accepted,
                      'semanticReview': manifest.get('review', {}).get('status'), 'note': 'Structural evidence only; no gameplay acceptance inferred.'}, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
