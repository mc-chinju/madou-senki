import json
import tempfile
import unittest
from pathlib import Path

from .ledger_report import report


class LedgerReportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'data/second-edition').mkdir(parents=True)

    def write(self, rows, cases=None, obligations=None):
        directory = self.root / 'data/second-edition'
        (directory / 'runtime-coverage.json').write_text(json.dumps({'rows': rows, 'testCases': cases or {}}))
        (directory / 'runtime-obligations.json').write_text(json.dumps({'obligations': obligations or []}))

    def row(self, clause, status='implemented', tests=None, category='semantic', kind='ability-effect'):
        return {'entryId': 'a', 'clauseKey': clause, 'coverageClass': category,
                'kind': kind, 'status': status, 'tests': tests or []}

    def test_counts_evidence_and_excludes_integrity(self):
        self.write([
            self.row('x', tests=['concrete', 'related']), self.row('y', tests=['related']),
            self.row('none'), self.row('pending', 'pending', kind='owned-reclaim'),
            self.row('integrity', 'pending', category='integrity'),
            self.row('accepted', 'accepted'), self.row('na', 'notApplicable'),
            self.row('verified', 'verified'),
        ], {'concrete': {'kind': 'canonical-transition'}, 'related': {'kind': 'related'}})
        self.assertEqual(report(self.root), {'semantic': {
            'accepted': 1, 'notApplicable': 1, 'verified': 1, 'implementedConcrete': 1,
            'implementedRelatedOnly': 1, 'implementedNoTests': 1, 'pending': {'owned-reclaim': 1},
        }, 'aggregateBlocked': 0})

    def test_aggregate_requires_nonempty_covers_and_all_children_accepted(self):
        self.write([
            self.row('yes', 'accepted'), self.row('na', 'notApplicable'), self.row('no', 'verified'),
            *[self.row(k, 'pending', category='aggregate') for k in ['good', 'bad', 'empty', 'missing']],
        ], obligations=[
            {'entryId': 'a', 'clauseKey': 'good', 'covers': ['a#yes', 'a#na']},
            {'entryId': 'a', 'clauseKey': 'bad', 'covers': ['a#no']},
            {'entryId': 'a', 'clauseKey': 'empty', 'covers': []},
            {'entryId': 'a', 'clauseKey': 'missing', 'covers': ['a#absent']},
        ])
        self.assertEqual(report(self.root)['aggregateBlocked'], 3)

    def test_empty_report_has_stable_keys(self):
        self.write([])
        self.assertEqual(report(self.root)['semantic'], {
            'accepted': 0, 'notApplicable': 0, 'verified': 0, 'implementedConcrete': 0,
            'implementedRelatedOnly': 0, 'implementedNoTests': 0, 'pending': {},
        })

    def test_missing_test_reference_is_not_classified_as_evidence(self):
        self.write([self.row('x', tests=['missing'])])
        with self.assertRaisesRegex(ValueError, 'missing test reference'):
            report(self.root)


if __name__ == '__main__':
    unittest.main()
