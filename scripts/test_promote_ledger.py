import copy
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from .promote_ledger import promote, resolved_rows
from .validate_runtime_coverage import FREEZE_POLICY, candidate_files, digest, reviewed_row_digest


class PromoteTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        directory = self.root / 'data/second-edition'
        directory.mkdir(parents=True)
        self.ledger_path = directory / 'runtime-coverage.json'
        self.manifest_path = directory / 'runtime-obligations.json'
        self.manifest = {'acceptancePolicy': 'acceptance-policy/test-only-v1',
                         'sources': [{'sourceId': 's', 'path': 'data/source.json'}],
                         'obligations': [{'entryId': 'a', 'clauseKey': key, 'source': ['s'], 'rulingIds': [],
                                          'dependsOn': deps} for key, deps in
                                         [('z', ['a#y']), ('y', ['a#x']), ('x', [])]]}
        self.test_ref = {'path': 'test.ts', 'suite': [], 'title': 't', 'declarationSha256': 'd',
                         'kind': 'canonical-transition', 'parameters': None, 'bindingNote': None}
        self.ledger = {'rows': [dict(o, coverageClass='semantic', status='implemented',
                                     handler=['h'], tests=['t'], remaining=['n']) for o in self.manifest['obligations']],
                       'testCases': {'t': self.test_ref}, 'handlers': {'h': {'path': 'src.ts', 'symbol': 'handle'}},
                       'remainingNotes': {'n': 'run remains'}}
        self.write(self.manifest_path, self.manifest)
        self.write(self.ledger_path, self.ledger)
        self.run_path = self.root / 'docs/operations/evidence/run.json'
        self.run_path.parent.mkdir(parents=True)
        self.run = {'format': 'runtime-coverage-run/v2', 'exitCode': 0, 'command': 'vitest',
                    'manifestSha256': digest(self.manifest), 'freezePolicy': FREEZE_POLICY,
                    'files': candidate_files(self.root), 'cases': [{'test': self.test_ref, 'result': 'passed'}]}
        self.write(self.run_path, self.run)

    def write(self, path, data):
        path.write_text(json.dumps(data))

    def test_dependency_order_and_expanded_transitive_digest(self):
        self.assertEqual(promote(self.root, self.run_path), {'verified': 3, 'accepted': 3, 'notApplicable': 0})
        ledger = json.loads(self.ledger_path.read_text())
        rows, obligations = resolved_rows(self.manifest, ledger)
        for key, row in rows.items():
            self.assertEqual(row['status'], 'accepted')
            self.assertEqual(row['remaining'], [])
            ref = row['acceptanceEvidence']
            raw = (self.root / ref['path']).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), ref['sha256'])
            self.assertEqual(json.loads(raw)['rowDigests'][key], reviewed_row_digest(row, obligations[key], rows))
        self.assertEqual(promote(self.root, self.run_path)['accepted'], 0)

    def test_failed_missing_and_related_cases_do_not_promote(self):
        for cases in [[{'test': self.test_ref, 'result': 'failed'}], [],
                      [{'test': dict(self.test_ref, kind='related'), 'result': 'passed'}]]:
            self.write(self.run_path, dict(self.run, cases=cases))
            self.assertEqual(promote(self.root, self.run_path)['verified'], 0)
        self.assertEqual(json.loads(self.ledger_path.read_text()), self.ledger)

    def test_invalid_receipts_leave_files_unchanged(self):
        before = self.ledger_path.read_bytes()
        for changes in [{'exitCode': 1}, {'manifestSha256': 'stale'}, {'files': {'old.ts': 'x'}},
                        {'command': ''}, {'cases': self.run['cases'] * 2}]:
            self.write(self.run_path, dict(self.run, **changes))
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                promote(self.root, self.run_path)
            self.assertEqual(self.ledger_path.read_bytes(), before)
            self.assertFalse((self.run_path.parent / 'acceptance').exists())

    def test_pending_dependency_blocks_acceptance(self):
        self.ledger['rows'][-1]['status'] = 'pending'
        self.write(self.ledger_path, self.ledger)
        self.assertEqual(promote(self.root, self.run_path)['accepted'], 0)
        rows = json.loads(self.ledger_path.read_text())['rows']
        self.assertEqual([r['status'] for r in rows], ['verified', 'verified', 'pending'])

    def test_acceptance_cli_includes_transitive_dependencies(self):
        promote(self.root, self.run_path)
        ledger = json.loads(self.ledger_path.read_text())
        self.write(self.root / 'row.json', ledger['rows'][0])
        self.write(self.root / 'obligation.json', self.manifest['obligations'][0])
        output = self.root / 'receipt.json'
        subprocess.run([sys.executable, str(Path(__file__).with_name('generate_acceptance_receipt.py')),
                        '--manifest', str(self.manifest_path), '--ledger', str(self.ledger_path),
                        '--row-key', 'a#z', '--row', str(self.root / 'row.json'),
                        '--obligation', str(self.root / 'obligation.json'), '--run', str(self.run_path),
                        '--output', str(output)], check=True, capture_output=True, text=True)
        rows, obligations = resolved_rows(self.manifest, ledger)
        self.assertEqual(json.loads(output.read_text())['rowDigests']['a#z'],
                         reviewed_row_digest(rows['a#z'], obligations['a#z'], rows))


if __name__ == '__main__':
    unittest.main()
