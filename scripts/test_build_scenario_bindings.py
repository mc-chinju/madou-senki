import copy
import unittest

from scripts.build_scenario_bindings import build_bindings


class ScenarioBindingsTest(unittest.TestCase):
    def fixture(self, entry='S01', kind='canonical-transition'):
        test = {'path': 'test.ts', 'suite': [], 'title': entry + ' exact',
                'parameters': None, 'kind': kind, 'bindingNote': 'Exact assertions.'}
        index = {'scenarios': [{'entryId': entry, 'tests': [test]}]}
        ledger = {'handlers': {'h:1': {'path': 'engine.ts', 'symbol': 'resolve'}}, 'rows': [
            {'entryId': entry, 'clauseKey': 'acceptance-correspondence',
             'coverageClass': 'semantic', 'kind': 'scenario-semantic', 'handler': ['h:1']},
            {'entryId': entry, 'clauseKey': 'source/then', 'coverageClass': 'semantic',
             'kind': 'scenario-source', 'status': 'pending'}]}
        return index, ledger

    def test_exact_index_reference_is_preserved_without_historical_run_promotion(self):
        index, ledger = self.fixture()
        index['scenarios'][0]['tests'][0]['currentFileSha256'] = 'historical'
        original = copy.deepcopy(ledger)
        result = build_bindings(index, ledger)
        self.assertEqual(ledger, original)
        self.assertEqual(result[0]['row'], 'S01#source/then')
        self.assertEqual(result[0]['tests'][0]['kind'], 'canonical-transition')
        self.assertNotIn('currentFileSha256', result[0]['tests'][0])
        self.assertNotIn('runEvidence', result[0])
        self.assertEqual(result[0]['status'], 'implemented')

    def test_missing_canonical_case_is_not_silently_replaced_by_related_case(self):
        index, ledger = self.fixture(kind='related')
        with self.assertRaisesRegex(ValueError, 'S01'):
            build_bindings(index, ledger)

    def test_documented_abstract_case_keeps_structural_classification(self):
        for entry in ['S13', 'S23', 'S32']:
            index, ledger = self.fixture(entry, 'structural-resolver')
            result = build_bindings(index, ledger)
            self.assertEqual(result[0]['tests'][0]['kind'], 'structural-resolver')
            self.assertIn('structural', result[0]['tests'][0]['bindingNote'])

    def test_missing_index_entry_and_duplicate_entry_fail_closed(self):
        index, ledger = self.fixture()
        with self.assertRaisesRegex(ValueError, 'missing'):
            build_bindings({'scenarios': []}, ledger)
        index['scenarios'].append(copy.deepcopy(index['scenarios'][0]))
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            build_bindings(index, ledger)

    def test_every_indexed_canonical_parameter_tuple_is_kept(self):
        index, ledger = self.fixture()
        first = index['scenarios'][0]['tests'][0]
        first['parameters'] = [1]
        second = copy.deepcopy(first)
        second['parameters'] = [2]
        index['scenarios'][0]['tests'].append(second)
        result = build_bindings(index, ledger)
        self.assertEqual([t['parameters'] for t in result[0]['tests']], [[1], [2]])


if __name__ == '__main__':
    unittest.main()
