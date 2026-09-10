"""Mutation-oriented tests: ledger validation never proves gameplay semantics."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('validate_runtime_coverage.py')
spec = importlib.util.spec_from_file_location('coverage_validator', SCRIPT)
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)


class CoverageValidation(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'data/second-edition').mkdir(parents=True)
        (self.root / '.evidence').mkdir()
        self.path = 'data/second-edition/characters.json'
        self.value = '弓技の効果Lvとダメージをそれぞれ+1d6。'
        self.write({'cards': [{'id': 'c-test', 'abilities': [{'id': 'ability', 'specification': self.value}]}]})
        source = {'path': self.path, 'pointer': '/cards/0/abilities/0/specification',
                  'sha256': hashlib.sha256(json.dumps(self.value, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest(),
                  'span': [0, len(self.value)], 'quote': self.value}
        self.manifest = {'schemaVersion': 1, 'review': {'status': 'pending'}, 'sources': [source],
                         'obligations': [{'entryId': 'ability', 'clauseKey': key, 'source': [source], 'rulingIds': [], 'dependsOn': []}
                                         for key in ['bow-effect-d6', 'bow-damage-independent-d6']]}
        self.ledger = {'schemaVersion': 1, 'rows': [dict(o, handler=[], tests=[], status='pending', remaining=['Implementation absent'])
                                                   for o in self.manifest['obligations']]}

    def write(self, content):
        (self.root / self.path).write_text(json.dumps(content, ensure_ascii=False))

    def errors(self):
        return v.validate(self.root, self.manifest, self.ledger, fixture=True)


    def test_derived_readiness_excluded_but_generator_is_frozen(self):
        generated = self.root / 'packages/catalog/src/selected/readiness.json'
        generated.parent.mkdir(parents=True)
        generated.write_text('{"ready": false}')
        generator = self.root / 'scripts/generate_catalog_readiness.py'
        generator.parent.mkdir()
        generator.write_text('validate_accepted()')
        before = v.candidate_files(self.root)
        self.assertNotIn(str(generated.relative_to(self.root)), before)
        self.assertIn(str(generator.relative_to(self.root)), before)
        generated.write_text('{"ready": true}')
        self.assertEqual(v.candidate_files(self.root), before)
        generator.write_text('skip_validation()')
        self.assertNotEqual(v.candidate_files(self.root), before)

    def test_well_formed_pending_is_valid_without_claiming_completion(self):
        self.assertEqual(self.errors(), [])

    def test_omitting_only_bow_damage_fails_with_parent_source_retained(self):
        self.ledger['rows'].pop()
        self.assertTrue(any('missing obligation' in e for e in self.errors()))

    def test_omitting_only_tia_earth_immunity_fails(self):
        self.manifest['obligations'][0]['clauseKey'] = 'earth-magic-immunity'
        self.manifest['obligations'][1]['clauseKey'] = 'maai-requires-two-advances'
        self.ledger['rows'] = [dict(self.manifest['obligations'][1], handler=[], tests=[], status='pending', remaining=['Absent'])]
        self.assertTrue(any('earth-magic-immunity' in e for e in self.errors()))

    def test_duplicate_and_unknown_obligations_are_rejected(self):
        self.ledger['rows'].append(copy.deepcopy(self.ledger['rows'][0]))
        self.ledger['rows'][1]['clauseKey'] = 'invented'
        self.assertTrue(any('duplicate' in e for e in self.errors()))
        self.assertTrue(any('unknown obligation' in e for e in self.errors()))

    def test_source_less_and_forged_hash_rejected(self):
        self.ledger['rows'][0]['source'] = []
        self.manifest['sources'][0]['sha256'] = '0' * 64
        errors = self.errors()
        self.assertTrue(any('source' in e for e in errors))
        self.assertTrue(any('hash' in e for e in errors))

    def test_new_source_clause_is_not_hidden_by_existing_card_id(self):
        data = json.loads((self.root / self.path).read_text())
        data['cards'][0]['restrictions'] = ['黒技使用不可']
        self.write(data)
        self.assertTrue(any('uncovered source' in e for e in self.errors()))

    def test_text_span_hole_rejected(self):
        for source in self.manifest['sources']:
            source['span'] = [0, 2]
            source['quote'] = self.value[:2]
        self.assertTrue(any('uncovered span' in e for e in self.errors()))

    def test_accepted_with_remaining_and_without_acceptance_rejected(self):
        self.ledger['rows'][0]['status'] = 'accepted'
        errors = self.errors()
        self.assertTrue(any('remaining' in e for e in errors))
        self.assertTrue(any('acceptance' in e for e in errors))

    def test_implemented_without_handler_or_missing_evidence_note_rejected(self):
        self.ledger['rows'][0].update(status='implemented', remaining=[])
        errors = self.errors()
        self.assertTrue(any('handler' in e for e in errors))
        self.assertTrue(any('remaining' in e for e in errors))

    def test_nonexistent_handlers_and_tests_rejected(self):
        self.ledger['rows'][0]['handler'] = [{'path': 'missing.ts', 'symbol': 'handler'}]
        self.ledger['rows'][0]['tests'] = [{'path': 'missing.test.ts', 'title': 'case', 'kind': 'canonical-transition'}]
        self.assertTrue(any('missing.ts' in e for e in self.errors()))
        self.assertTrue(any('missing.test.ts' in e for e in self.errors()))

    def test_verified_requires_bound_successful_run(self):
        self.ledger['rows'][0].update(status='verified', remaining=[])
        self.assertTrue(any('run evidence' in e for e in self.errors()))

    def test_dependency_unknown_and_unaccepted_inheritance_rejected(self):
        self.manifest['obligations'][0]['dependsOn'] = ['missing#ability']
        self.assertTrue(any('dependency' in e for e in self.errors()))

    def integrity_fixture(self):
        anchor = copy.deepcopy(self.manifest['obligations'][0])
        anchor.update(clauseKey='source/specification', kind='source-field', coverageClass='integrity', covers=['ability#bow-effect-d6'])
        self.manifest['obligations'].append(anchor)
        self.ledger['rows'].append(dict(anchor, handler=[], tests=[], status='pending', remaining=['Integrity only']))
        return anchor, self.ledger['rows'][-1]

    def test_integrity_anchor_needs_no_fake_runtime_handler(self):
        self.integrity_fixture()
        self.assertEqual(self.errors(), [])

    def test_integrity_cannot_claim_gameplay_acceptance(self):
        _, row = self.integrity_fixture()
        row['status'] = 'accepted'
        self.assertTrue(any('non-semantic runtime status' in e for e in self.errors()))

    def test_semantic_class_cannot_be_overridden_by_row(self):
        self.ledger['rows'][0]['coverageClass'] = 'integrity'
        self.assertTrue(any('coverage class' in e for e in self.errors()))

    def test_semantic_key_cannot_be_laundered_as_source_field(self):
        for row in [self.manifest['obligations'][0], self.ledger['rows'][0]]:
            row.update(kind='source-field', coverageClass='integrity')
        self.assertTrue(any('integrity identity' in e for e in self.errors()))

    def test_context_is_not_an_and_dependency(self):
        self.integrity_fixture()
        self.manifest['obligations'][0]['dependsOn'] = ['ability#source/specification']
        self.assertTrue(any('non-semantic dependency' in e for e in self.errors()))

    def test_malformed_dependency_list_fails_without_crash(self):
        self.manifest['obligations'][0]['dependsOn'] = None
        self.assertTrue(any('invalid dependsOn list' in e for e in self.errors()))

    def test_context_and_coverage_references_fail_closed(self):
        anchor, _ = self.integrity_fixture()
        anchor['contextRefs'] = ['missing#context']
        anchor['covers'] *= 2
        errors = self.errors()
        self.assertTrue(any('unknown contextRefs' in e for e in errors))
        self.assertTrue(any('duplicate covers' in e for e in errors))

    def test_full_gate_rejects_pending_semantics_without_classification_reviewer(self):
        self.integrity_fixture()
        errors = v.validate(self.root, self.manifest, self.ledger, fixture=True, require_accepted=True)
        self.assertFalse(any('classification review' in e for e in errors))
        self.assertTrue(any('unaccepted semantic' in e for e in errors))

    def test_aggregate_cannot_close_without_atomic_mapping(self):
        anchor, row = self.integrity_fixture()
        for obj in [anchor, row]:
            obj.update(kind='ruling-paragraph', coverageClass='aggregate', covers=[])
        errors = v.validate(self.root, self.manifest, self.ledger, fixture=True, require_accepted=True)
        self.assertTrue(any('incomplete aggregate mapping' in e for e in errors))

    def declaration_fixture(self):
        (self.root / 'fixture.ts').write_text("export function realHandler() {}\n// function fakeHandler() {}\nconst label = 'fakeHandler';\n")
        (self.root / 'fixture.test.ts').write_text("import {it} from 'vitest';\nconst values = [['bow', 2], ['earth', 3]] as const;\nit.each(values)('supports %s %i', (name, value) => { if (!value) throw Error(name); });\n// it('comment-only', () => {});\n")
        ast = v.ast_index(self.root, {'fixture.ts', 'fixture.test.ts'})
        test = ast['fixture.test.ts']['tests'][0]
        self.ledger['rows'][0]['handler'] = [{'path': 'fixture.ts', 'symbol': 'realHandler'}]
        self.ledger['rows'][0]['tests'] = [{'path': 'fixture.test.ts', 'title': test['title'], 'suite': [],
            'declarationSha256': test['declarationSha256'], 'kind': 'structural-resolver', 'parameters': ['bow', 2]}]

    def test_ast_accepts_actual_declaration_and_static_parameter_tuple(self):
        self.declaration_fixture()
        self.assertEqual(self.errors(), [])

    def test_ast_rejects_comment_handler_and_comment_test(self):
        self.declaration_fixture()
        self.ledger['rows'][0]['handler'][0]['symbol'] = 'fakeHandler'
        self.ledger['rows'][0]['tests'][0]['title'] = 'comment-only'
        errors = self.errors()
        self.assertTrue(any('nonexistent handler' in e for e in errors))
        self.assertTrue(any('nonexistent or ambiguous test' in e for e in errors))

    def test_ast_rejects_wrong_concrete_parameter_tuple(self):
        self.declaration_fixture()
        self.ledger['rows'][0]['tests'][0]['parameters'] = ['bow', 999]
        self.assertTrue(any('unknown concrete' in e for e in self.errors()))

    def test_malformed_row_lists_report_errors_without_crashing(self):
        self.ledger['rows'][0]['handler'] = None
        self.assertTrue(any('invalid handler' in e for e in self.errors()))

    def test_run_log_is_not_evidence_for_unrelated_source_revision(self):
        self.declaration_fixture()
        log = self.root / 'run.log'
        log.write_text('pass')
        self.ledger['rows'][0].update(status='verified', remaining=[], runEvidence={
            'path': 'run.log', 'sha256': hashlib.sha256(b'pass').hexdigest(), 'sourceRevision': 'unrelated',
            'command': 'test', 'exitCode': 0})
        self.assertTrue(any('run evidence' in e or 'source binding' in e for e in self.errors()))

    def test_manifest_and_ledger_revision_mismatch_fails(self):
        self.manifest['revision'] = 'new'
        self.ledger['manifestRevision'] = 'old'
        self.assertTrue(any('manifest revision' in e for e in self.errors()))

    def receipt_fixture(self):
        self.declaration_fixture()
        row = self.ledger['rows'][0]
        row.update(status='verified', remaining=[])
        case = row['tests'][0]
        self.receipt = {'format': 'runtime-coverage-run/v2', 'command': 'fixture check', 'exitCode': 0,
            'manifestSha256': v.digest(self.manifest), 'freezePolicy': v.FREEZE_POLICY,
            'files': {p: hashlib.sha256((self.root / p).read_bytes()).hexdigest() for p in ['fixture.ts', 'fixture.test.ts', self.path]},
            'cases': [{'test': case, 'result': 'passed'}]}
        self.save_receipt()

    def save_receipt(self):
        raw = json.dumps(self.receipt).encode()
        (self.root / '.evidence/receipt.json').write_bytes(raw)
        self.ledger['rows'][0]['runEvidence'] = {'path': '.evidence/receipt.json', 'sha256': hashlib.sha256(raw).hexdigest()}

    def test_structured_pass_receipt_matches_exact_case_and_source(self):
        self.receipt_fixture()
        self.assertEqual(self.errors(), [])

    def test_failed_missing_case_or_stale_source_receipt_rejected(self):
        for corruption in ['failed', 'missing', 'stale']:
            with self.subTest(corruption=corruption):
                self.receipt_fixture()
                if corruption == 'failed': self.receipt['cases'][0]['result'] = 'failed'
                if corruption == 'missing': self.receipt['cases'] = []
                if corruption == 'stale': self.receipt['files']['fixture.ts'] = '0' * 64
                self.save_receipt()
                self.assertTrue(self.errors())

    def test_truthy_acceptance_or_wrong_manifest_digest_cannot_accept(self):
        self.receipt_fixture()
        self.manifest['acceptancePolicy'] = v.ACCEPTANCE_POLICY
        self.ledger['rows'][0].update(status='accepted', remaining=[], acceptanceEvidence=True)
        self.assertTrue(any('acceptance' in e for e in self.errors()))

    def test_nonobject_row_and_duplicate_scenario_refs_rejected(self):
        self.ledger['rows'].append('invalid')
        self.assertTrue(any('row object' in e for e in self.errors()))
        self.ledger['rows'].pop()
        self.ledger['scenarios'] = [{'entryId': 'S01'}, {'entryId': 'S01'}]
        self.assertTrue(any('duplicate scenario' in e for e in self.errors()))

    def test_compact_references_resolve_and_unknown_reference_fails(self):
        source = self.manifest['sources'][0]
        source['sourceId'] = 'src:one'
        for row in self.manifest['obligations'] + self.ledger['rows']: row['source'] = ['src:one']
        self.ledger['remainingNotes'] = {'n:gap': 'Effect absent'}
        self.ledger['rows'][0]['remaining'] = ['n:gap']
        self.assertEqual(self.errors(), [])
        self.ledger['rows'][0]['source'] = ['src:invented']
        self.assertTrue(any('unknown source reference' in e for e in self.errors()))

    def test_duplicate_source_registry_id_is_rejected(self):
        self.manifest['sources'][0]['sourceId'] = 'src:one'
        self.manifest['sources'].append(copy.deepcopy(self.manifest['sources'][0]))
        self.assertTrue(any('duplicate source' in e for e in self.errors()))

    def test_nonobject_handler_reference_fails_without_crash(self):
        self.ledger['rows'][0]['handler'] = [17]
        self.assertTrue(any('invalid handler' in e for e in self.errors()))

    def test_acceptance_receipt_cannot_skip_unaccepted_inherited_obligation(self):
        self.accepted_fixture()
        self.manifest['obligations'][0]['dependsOn'] = ['ability#bow-damage-independent-d6']
        self.receipt['manifestSha256'] = v.digest(self.manifest)
        self.save_receipt()
        self.save_acceptance()
        self.assertTrue(any('unaccepted dependency' in e for e in self.errors()))

    def ruling_fixture(self):
        p = self.root / 'docs/rules/second-edition/rulings.md'
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text('## G03 — priority\n\nEveryone must explicitly pass.\n')
        self.ledger['rows'][0]['rulingIds'] = ['G03']
        self.manifest['obligations'][0]['rulingIds'] = ['G03']
        return p

    def test_added_ruling_paragraph_cannot_escape_source_coverage(self):
        self.ruling_fixture()
        self.assertTrue(any('uncovered source' in e for e in self.errors()))

    def test_nonexistent_ruling_reference_fails_even_if_manifest_agrees(self):
        self.ledger['rows'][0]['rulingIds'] = ['missing-file.md#FAKE']
        self.manifest['obligations'][0]['rulingIds'] = ['missing-file.md#FAKE']
        self.assertTrue(any('unknown ruling' in e for e in self.errors()))

    def test_imported_helper_edit_and_new_file_stale_run_candidate(self):
        self.receipt_fixture()
        (self.root / 'helper.ts').write_text('export const value = 1;')
        self.assertTrue(any('candidate' in e for e in self.errors()))
        self.receipt['files']['helper.ts'] = hashlib.sha256((self.root / 'helper.ts').read_bytes()).hexdigest()
        self.save_receipt()
        self.assertEqual(self.errors(), [])
        (self.root / 'helper.ts').write_text('export const value = 999;')
        self.assertTrue(any('candidate' in e for e in self.errors()))

    def test_each_shadowing_never_uses_another_scope_table(self):
        (self.root / 'scope.test.ts').write_text("const values = [['bow', 2]]; it.each(values)('outer %s %i', () => {}); describe('other', () => { const values = [['earth', 999]]; });")
        indexed = v.ast_index(self.root, {'scope.test.ts'})['scope.test.ts']['tests'][0]
        self.assertNotEqual(indexed['parameters'], [['earth', 999]])

    def test_mutable_or_mutated_each_table_is_unresolved(self):
        for declaration in ["let values = [['bow', 2]]; values = [['earth', 3]];", "const values = [['bow', 2]]; values.push(['earth', 3]);"]:
            with self.subTest(declaration=declaration):
                (self.root / 'scope.test.ts').write_text(declaration + "it.each(values)('case %s %i', () => {});")
                indexed = v.ast_index(self.root, {'scope.test.ts'})['scope.test.ts']['tests'][0]
                self.assertIsNone(indexed['parameters'])

    def test_null_run_case_list_reports_error(self):
        self.receipt_fixture()
        self.receipt['cases'] = None
        self.save_receipt()
        self.assertTrue(any('cases' in e for e in self.errors()))

    def accepted_fixture(self):
        self.receipt_fixture()
        self.manifest['acceptancePolicy'] = v.ACCEPTANCE_POLICY
        self.receipt['manifestSha256'] = v.digest(self.manifest)
        self.save_receipt()
        self.save_acceptance()

    def save_acceptance(self, extra=None):
        row = self.ledger['rows'][0]
        row.update(status='accepted', remaining=[])
        fields = ('entryId', 'clauseKey', 'source', 'rulingIds', 'handler', 'tests', 'remaining', 'runEvidence')
        payload = {'row': {field: row.get(field) for field in fields}, 'obligation': self.manifest['obligations'][0], 'dependencies': {}}
        acceptance = {'format': v.ACCEPTANCE_POLICY, 'policy': v.ACCEPTANCE_POLICY,
            'manifestSha256': v.digest(self.manifest), 'obligations': ['ability#bow-effect-d6'],
            'rowDigests': {'ability#bow-effect-d6': hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()}}
        if extra:
            acceptance.update(extra)
        raw = json.dumps(acceptance).encode()
        (self.root / '.evidence/acceptance.json').write_bytes(raw)
        row['acceptanceEvidence'] = {'path': '.evidence/acceptance.json', 'sha256': hashlib.sha256(raw).hexdigest()}

    def complete_fixture(self):
        # One semantic effect, one integrity anchor, one independently mapped aggregate.
        self.manifest['obligations'].pop()
        self.ledger['rows'].pop()
        self.integrity_fixture()
        aggregate = copy.deepcopy(self.manifest['obligations'][-1])
        aggregate.update(clauseKey='ruling-paragraph/001', kind='ruling-paragraph', coverageClass='aggregate')
        self.manifest['obligations'].append(aggregate)
        self.ledger['rows'].append(dict(aggregate, handler=[], tests=[], status='pending', remaining=['Mapping checked mechanically']))
        self.accepted_fixture()

    def test_complete_gate_never_requires_gameplay_acceptance_for_heading(self):
        self.complete_fixture()
        self.assertEqual(v.validate(self.root, self.manifest, self.ledger, fixture=True, require_accepted=True), [])
        self.assertEqual(self.ledger['rows'][1]['status'], 'pending')

    def test_changed_classification_cannot_bypass_semantic_gate(self):
        self.complete_fixture()
        for row in [self.manifest['obligations'][0], self.ledger['rows'][0]]:
            row.update(clauseKey='source/renamed', kind='source-field', coverageClass='integrity')
        errors = v.validate(self.root, self.manifest, self.ledger, fixture=True, require_accepted=True)
        self.assertTrue(any('non-semantic runtime status' in e for e in errors))

    def test_forged_or_stale_aggregate_mapping_review_cannot_close_empty_covers(self):
        self.complete_fixture()
        self.manifest['obligations'][-1]['covers'] = []
        self.ledger['rows'][-1]['mappingReview'] = True
        errors = v.validate(self.root, self.manifest, self.ledger, fixture=True, require_accepted=True)
        self.assertTrue(any('incomplete aggregate mapping' in e for e in errors))

    def test_removing_covered_atom_invalidates_independent_mapping(self):
        self.complete_fixture()
        self.manifest['obligations'][-1]['covers'] = []
        errors = v.validate(self.root, self.manifest, self.ledger, fixture=True, require_accepted=True)
        self.assertTrue(any('incomplete aggregate mapping' in e for e in errors))

    def test_test_only_acceptance_receipt_accepts_only_bound_candidate(self):
        self.accepted_fixture()
        self.assertEqual(self.errors(), [])
        (self.root / 'fixture.ts').write_text('export function realHandler() { return 999; }')
        self.receipt['files']['fixture.ts'] = hashlib.sha256((self.root / 'fixture.ts').read_bytes()).hexdigest()
        self.save_receipt()
        self.assertTrue(any('acceptance receipt current row' in e for e in self.errors()))

    def test_changed_test_mapping_invalidates_old_acceptance_even_after_new_pass(self):
        self.accepted_fixture()
        self.ledger['rows'][0]['tests'][0]['parameters'] = ['earth', 3]
        self.receipt['cases'][0]['test'] = self.ledger['rows'][0]['tests'][0]
        self.save_receipt()
        self.assertTrue(any('acceptance receipt current row' in e for e in self.errors()))

    def test_changed_and_added_rulings_stale_bound_sources(self):
        path = self.ruling_fixture()
        values = [('/sections/G03/blocks/001', '## G03 — priority'), ('/sections/G03/blocks/002', 'Everyone must explicitly pass.')]
        for index, (pointer, text) in enumerate(values):
            source = {'path': 'docs/rules/second-edition/rulings.md', 'pointer': pointer,
                'sha256': hashlib.sha256(json.dumps(text, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest(), 'span': [0, len(text)], 'quote': text}
            obligation = {'entryId': 'G03', 'clauseKey': str(index), 'source': [source], 'rulingIds': ['G03'], 'dependsOn': []}
            self.manifest['sources'].append(source)
            self.manifest['obligations'].append(obligation)
            self.ledger['rows'].append(dict(obligation, status='pending', handler=[], tests=[], remaining=['Unverified']))
        self.assertEqual(self.errors(), [])
        path.write_text('## G03 — priority\n\nHidden actors skip pass.\n\n## G99 — new rule\n\nSkip everyone.\n')
        errors = self.errors()
        self.assertTrue(any('source hash mismatch' in e for e in errors))
        self.assertTrue(any('uncovered source' in e for e in errors))

    def test_root_config_and_lockfile_are_frozen(self):
        self.receipt_fixture()
        (self.root / 'custom.settings.json').write_text('{}')
        self.assertTrue(any('candidate' in e for e in self.errors()))

    def test_skipped_test_cannot_be_claimed_passed(self):
        self.receipt_fixture()
        path = self.root / 'fixture.test.ts'
        path.write_text(path.read_text().replace('it.each', 'it.skip.each'))
        declaration = v.ast_index(self.root, {'fixture.test.ts'})['fixture.test.ts']['tests'][0]
        self.ledger['rows'][0]['tests'][0]['declarationSha256'] = declaration['declarationSha256']
        self.receipt['cases'][0]['test'] = self.ledger['rows'][0]['tests'][0]
        self.receipt['files']['fixture.test.ts'] = hashlib.sha256(path.read_bytes()).hexdigest()
        self.save_receipt()
        self.assertTrue(any('disabled test' in e for e in self.errors()))

    def test_cyclic_dependencies_cannot_create_review_hash_cycles(self):
        self.manifest['obligations'][0]['dependsOn'] = ['ability#bow-damage-independent-d6']
        self.manifest['obligations'][1]['dependsOn'] = ['ability#bow-effect-d6']
        self.assertTrue(any('cyclic dependency' in e for e in self.errors()))

    def test_deleted_lockfile_stales_candidate_receipt(self):
        self.receipt_fixture()
        (self.root / 'pnpm-lock.yaml').write_text('lockfileVersion: 9')
        self.receipt['files']['pnpm-lock.yaml'] = hashlib.sha256((self.root / 'pnpm-lock.yaml').read_bytes()).hexdigest()
        self.save_receipt()
        self.assertEqual(self.errors(), [])
        (self.root / 'pnpm-lock.yaml').unlink()
        self.assertTrue(any('candidate' in e for e in self.errors()))

    def test_conflicting_duplicate_case_receipt_is_rejected(self):
        self.receipt_fixture()
        self.receipt['cases'].append(dict(self.receipt['cases'][0], result='failed'))
        self.save_receipt()
        self.assertTrue(any('duplicate run evidence case' in e for e in self.errors()))

    def test_legacy_review_receipt_cannot_accept_under_test_only_policy(self):
        self.receipt_fixture()
        self.manifest['acceptancePolicy'] = 'acceptance-policy/test-only-v1'
        self.receipt['manifestSha256'] = v.digest(self.manifest)
        self.save_receipt()
        row = self.ledger['rows'][0]
        row.update(status='accepted', remaining=[])
        review = {'format': 'runtime-coverage-review/v2', 'verdict': 'accepted', 'reviewer': 'independent fixture',
            'manifestSha256': v.digest(self.manifest), 'obligations': ['ability#bow-effect-d6']}
        raw = json.dumps(review).encode()
        (self.root / '.evidence/review.json').write_bytes(raw)
        row['acceptanceEvidence'] = {'path': '.evidence/review.json', 'sha256': hashlib.sha256(raw).hexdigest()}
        self.assertTrue(any('test-only acceptance' in e for e in self.errors()))

    def test_not_applicable_without_basis_is_rejected(self):
        self.receipt_fixture()
        self.ledger['rows'][0].update(status='notApplicable', remaining=[])
        self.assertTrue(any('notApplicable' in e for e in self.errors()))

    def test_not_applicable_stale_basis_is_rejected(self):
        self.receipt_fixture()
        self.ledger['rows'][0].update(status='notApplicable', remaining=[], notApplicable={
            'reason': '到達不能',
            'basis': {'kind': 'earth-warrior-technique-absence', 'matches': [{'id': 'forged'}],
                      'edition': 'second-online-v0.1-provisional'},
            'edition': 'second-online-v0.1-provisional', 'decidedOn': '2026-09-10', 'decidedBy': 'user',
            'retainedTests': self.ledger['rows'][0]['tests']})
        self.assertTrue(any('notApplicable basis' in e for e in self.errors()))

    def test_valid_not_applicable_counts_for_require_accepted(self):
        self.manifest['obligations'].pop()
        self.ledger['rows'].pop()
        self.receipt_fixture()
        self.ledger['rows'][0].update(status='notApplicable', remaining=[], notApplicable={
            'reason': '到達不能',
            'basis': {'kind': 'earth-warrior-technique-absence', 'matches': [],
                      'edition': 'second-online-v0.1-provisional'},
            'edition': 'second-online-v0.1-provisional', 'decidedOn': '2026-09-10', 'decidedBy': 'user',
            'retainedTests': self.ledger['rows'][0]['tests']})
        self.assertEqual(self.errors(), [])
        self.assertEqual(v.validate(self.root, self.manifest, self.ledger, fixture=True, require_accepted=True), [])


if __name__ == '__main__':
    unittest.main()
