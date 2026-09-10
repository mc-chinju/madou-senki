import json
import tempfile
import unittest
from pathlib import Path

from .record_runtime_run import format_title, match_cases, playwright_reported, vitest_reported, verify_snapshot


class RuntimeRunTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def ref(self, **kwargs):
        return dict(path='test/x.test.ts', suite=['s'], title='%s does it', parameters=['a'],
                    kind='canonical-transition', declarationSha256='hash', bindingNote=None, **kwargs)

    def test_formats_parameters_without_using_argument_position_as_row_index(self):
        self.assertEqual(format_title('%s %i %d %j %%', [False, 2.7, 2.7, {'a': 1}]), 'false 2 2.7 {"a":1} %')
        self.assertEqual(format_title('$name $nested.value', {'name': 'A', 'nested': {'value': 'B'}}), 'A B')
        self.assertEqual(format_title('%# %s', ['a'], index=4), '4 a')
        with self.assertRaises(ValueError):
            format_title('%# %s', ['a'])

    def test_matches_exact_reference_and_ignores_other_suite(self):
        ref = self.ref()
        reported = [{'path': ref['path'], 'ancestors': ['s'], 'title': 'a does it', 'status': 'passed'}]
        self.assertEqual(match_cases({'t:1': ref}, reported)[0]['test'], ref)
        self.assertEqual(match_cases({'t:1': ref}, reported)[0]['result'], 'passed')
        reported[0]['ancestors'] = ['another']
        self.assertEqual(match_cases({'t:1': ref}, reported), [])

    def test_duplicate_result_cannot_hide_a_failure(self):
        ref = self.ref()
        items = [{'path': ref['path'], 'ancestors': ['s'], 'title': 'a does it', 'status': status}
                 for status in ['failed', 'passed']]
        self.assertEqual(match_cases({'t:1': ref}, items)[0]['result'], 'failed')

    def test_same_reported_title_cannot_certify_different_parameter_rows(self):
        first = self.ref()
        first['parameters'] = ['a', 'first card']
        second = dict(first, parameters=['a', 'second card'])
        item = {'path': first['path'], 'ancestors': ['s'], 'title': 'a does it', 'status': 'passed'}
        for reported in [[item], [item, item]]:
            with self.subTest(result_count=len(reported)):
                with self.assertRaisesRegex(ValueError, 'ambiguous reported test'):
                    match_cases({'t:1': first, 't:2': second}, reported)

    def test_same_execution_can_support_multiple_binding_notes(self):
        first = self.ref()
        second = dict(first, bindingNote='Another clause about the same execution')
        item = {'path': first['path'], 'ancestors': ['s'], 'title': 'a does it', 'status': 'passed'}
        cases = match_cases({'t:1': first, 't:2': second}, [item])
        self.assertEqual([case['result'] for case in cases], ['passed', 'passed'])

    def test_skipped_and_related_are_not_successful_evidence(self):
        ref = self.ref()
        item = {'path': ref['path'], 'ancestors': ['s'], 'title': 'a does it', 'status': 'pending'}
        self.assertEqual(match_cases({'t:1': ref}, [item])[0]['result'], 'failed')
        ref['kind'] = 'related'
        self.assertEqual(match_cases({'t:1': ref}, [dict(item, status='passed')]), [])

    def test_parses_vitest_absolute_paths(self):
        path = self.root / 'vitest.json'
        path.write_text(json.dumps({'testResults': [{'name': str(self.root / 'test/x.test.ts'),
            'assertionResults': [{'ancestorTitles': ['s'], 'title': 'a does it', 'status': 'passed'}]}]}))
        self.assertEqual(list(vitest_reported(path, self.root)), [
            {'path': 'test/x.test.ts', 'ancestors': ['s'], 'title': 'a does it', 'status': 'passed'}])

    def test_playwright_empty_results_and_flaky_attempts_fail(self):
        path = self.root / 'pw.json'
        path.write_text(json.dumps({'config': {'rootDir': str(self.root / 'test')}, 'suites': [
            {'title': 'x.spec.ts', 'file': 'x.spec.ts', 'suites': [{'title': 's', 'file': 'x.spec.ts',
                'specs': [{'title': 'empty', 'tests': [{'results': []}]},
                          {'title': 'flaky', 'tests': [{'results': [{'status': 'failed'}, {'status': 'passed'}]}]},
                          {'title': 'ok', 'tests': [{'results': [{'status': 'passed'}]}]}]}]}]}))
        rows = list(playwright_reported(path, self.root))
        self.assertEqual([r['status'] for r in rows], ['failed', 'failed', 'passed'])
        self.assertEqual(rows[-1]['path'], 'test/x.spec.ts')
        self.assertEqual(rows[-1]['ancestors'], ['s'])

    def test_snapshot_rejects_changed_candidate_or_manifest(self):
        snapshot = {'files': {'a': 'old'}, 'manifestSha256': 'm'}
        verify_snapshot(snapshot, {'a': 'old'}, 'm')
        with self.assertRaisesRegex(ValueError, 'candidate changed'):
            verify_snapshot(snapshot, {'a': 'new'}, 'm')
        with self.assertRaisesRegex(ValueError, 'manifest changed'):
            verify_snapshot(snapshot, {'a': 'old'}, 'changed')


if __name__ == '__main__':
    unittest.main()
