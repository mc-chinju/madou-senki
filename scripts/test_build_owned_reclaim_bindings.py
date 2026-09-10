import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_owned_reclaim_bindings import cases, build_bindings


class OwnedReclaimBindingsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.data = self.root / 'data/second-edition'
        self.data.mkdir(parents=True)
        self.write('characters.json', {'cards': [{
            'id': 'owner', 'name': 'Owner',
            'owned_techniques': ['short', 'orbs'], 'owned_followers': ['guard'],
        }]})
        self.write('aliases.json', {'entries': [
            {'alias': 'short', 'canonical_names': ['canonical']},
            {'alias': 'orbs', 'canonical_names': ['red', 'far']},
        ]})
        self.write('actions-01-06.json', {'cards': [
            {'id': 't1', 'name': 'canonical', 'category': 'technique'},
            {'id': 't2', 'name': 'canonical', 'category': 'technique'},
            {'id': 't3', 'name': 'red', 'category': 'turn'},
            {'id': 't4', 'name': 'far', 'category': 'turn'},
            {'id': 'f1', 'name': 'guard', 'category': 'follower'},
        ]})

    def write(self, name, value):
        (self.data / name).write_text(json.dumps(value))

    def test_aliases_keep_every_physical_copy_and_each_canonical_name(self):
        techniques, followers = cases(self.root)
        self.assertEqual(techniques, [
            ['Owner', 'canonical', 't1'], ['Owner', 'canonical', 't2'],
            ['Owner', 'red', 't3'], ['Owner', 'far', 't4'],
        ])
        self.assertEqual(followers, [['Owner', 'guard', 'f1']])

    def test_unresolved_alias_member_fails_even_when_another_member_matches(self):
        self.write('aliases.json', {'entries': [
            {'alias': 'short', 'canonical_names': ['canonical', 'missing']},
            {'alias': 'orbs', 'canonical_names': ['red', 'far']},
        ]})
        with self.assertRaisesRegex(ValueError, 'missing'):
            cases(self.root)

    def test_clause_index_binds_all_matching_copies_to_exact_suffix(self):
        self.write('runtime-coverage.json', {'rows': [{
            'entryId': 'owner', 'clauseKey': 'owned_techniques/0/normalized-name-once-game',
            'kind': 'owned-reclaim', 'coverageClass': 'semantic', 'status': 'pending',
        }]})
        result = build_bindings(self.root)
        self.assertEqual(len(result), 1)
        self.assertEqual([t['parameters'] for t in result[0]['tests']], [
            ['Owner', 'canonical', 't1'], ['Owner', 'canonical', 't2'],
        ])
        self.assertEqual(result[0]['status'], 'implemented')
        self.assertNotIn('runEvidence', result[0])
        self.assertTrue(all('normalized-name-once-game' in t['title'] for t in result[0]['tests']))

    def test_unknown_clause_fails_closed(self):
        self.write('runtime-coverage.json', {'rows': [{
            'entryId': 'owner', 'clauseKey': 'owned_techniques/0/unknown',
            'kind': 'owned-reclaim', 'coverageClass': 'semantic', 'status': 'pending',
        }]})
        with self.assertRaisesRegex(ValueError, 'unknown'):
            build_bindings(self.root)


if __name__ == '__main__':
    unittest.main()
