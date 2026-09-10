import copy
import unittest

from .apply_ledger_bindings import apply_bindings


class ApplyBindingsTest(unittest.TestCase):
    def setUp(self):
        self.ledger = {'rows': [{'entryId': 'a', 'clauseKey': 'x', 'coverageClass': 'semantic',
                                'status': 'pending', 'handler': [], 'tests': [], 'remaining': ['n:old']}],
                       'handlers': {}, 'testCases': {}, 'remainingNotes': {'n:old': 'gap'}}
        self.declarations = {'test.ts': {'functions': [], 'tests': [
            {'title': '%s does it', 'suite': [], 'each': True, 'parameters': [['a'], ['b']],
             'disabled': False, 'declarationSha256': 'sha'}]},
            'src.ts': {'functions': ['handle'], 'tests': []}}
        self.binding = {'row': 'a#x', 'handler': [{'path': 'src.ts', 'symbol': 'handle'}],
                        'tests': [{'path': 'test.ts', 'suite': [], 'title': '%s does it',
                                   'parameters': ['a'], 'kind': 'canonical-transition', 'bindingNote': 'exact'}],
                        'status': 'implemented', 'remaining': ['run evidence remains']}

    def test_binds_exact_declaration_and_clears_stale_receipts(self):
        row = self.ledger['rows'][0]
        row.update(runEvidence={'path': 'old'}, acceptanceEvidence={'path': 'old'})
        apply_bindings(self.ledger, [self.binding], self.declarations)
        row = self.ledger['rows'][0]
        self.assertEqual(row['status'], 'implemented')
        self.assertEqual(self.ledger['testCases'][row['tests'][0]]['declarationSha256'], 'sha')
        self.assertNotIn('runEvidence', row)
        self.assertNotIn('acceptanceEvidence', row)

    def test_invalid_batch_is_atomic(self):
        before = copy.deepcopy(self.ledger)
        for bad in [dict(self.binding, status='accepted'), dict(self.binding, row='missing#x'),
                    dict(self.binding, remaining=[]), dict(self.binding, tests=[]),
                    dict(self.binding, handler=[{'path': 'src.ts', 'symbol': 'missing'}])]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                apply_bindings(self.ledger, [self.binding, bad], self.declarations)
            self.assertEqual(self.ledger, before)

    def test_rejects_unknown_parameters_related_disabled_and_ambiguous(self):
        for change in [{'parameters': ['zzz']}, {'parameters': None}, {'kind': 'related'}]:
            binding = copy.deepcopy(self.binding)
            binding['tests'][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                apply_bindings(self.ledger, [binding], self.declarations)
        self.declarations['test.ts']['tests'][0]['disabled'] = True
        with self.assertRaises(ValueError):
            apply_bindings(self.ledger, [self.binding], self.declarations)
        self.declarations['test.ts']['tests'][0]['disabled'] = False
        self.declarations['test.ts']['tests'] *= 2
        with self.assertRaises(ValueError):
            apply_bindings(self.ledger, [self.binding], self.declarations)

    def test_not_applicable_retains_resolved_tests(self):
        binding = dict(self.binding, status='notApplicable', remaining=[], notApplicable={
            'reason': 'absent', 'basis': {'kind': 'absence'}, 'edition': 'second-online-v0.1-provisional',
            'decidedOn': '2026-09-11', 'decidedBy': 'user'})
        apply_bindings(self.ledger, [binding], self.declarations)
        row = self.ledger['rows'][0]
        self.assertEqual(row['notApplicable']['retainedTests'], [self.ledger['testCases'][row['tests'][0]]])
        self.assertEqual(row['remaining'], [])

    def test_empty_input_does_not_change_ledger(self):
        before = copy.deepcopy(self.ledger)
        self.assertIs(apply_bindings(self.ledger, [], {}), self.ledger)
        self.assertEqual(self.ledger, before)


if __name__ == '__main__':
    unittest.main()
