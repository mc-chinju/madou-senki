import json
import tempfile
import unittest
from pathlib import Path

from .inspect_card_data import run_query


class CardDataQueryTest(unittest.TestCase):
    def test_current_absences(self):
        root = Path(__file__).resolve().parents[1]
        for query in [
            {'dataset': 'actions', 'where': {'attributes_contains': '弓', 'counter': True}},
            {'dataset': 'character-owned-techniques', 'where': {'character': 'c2-p02-r1c2', 'attribute_not_contains': '弓'}},
            {'dataset': 'actions', 'where': {'attributes_contains': '地', 'technique_class': '戦士'}},
        ]:
            with self.subTest(query=query):
                self.assertEqual(run_query(root, query)['matches'], [])

    def test_modes_follower_attacks_and_unresolved_names(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            directory = root / 'data/second-edition'
            directory.mkdir(parents=True)
            cards = [{'id': 'dual', 'name': 'advance/bow', 'modes': [{'name': 'bow', 'attributes': ['戦', '弓']}],
                      'specification': '反撃'},
                     {'id': 'follower', 'name': 'follower', 'category': 'follower',
                      'stats': {'attributes': ['地'], 'attack': {'attributes': ['戦', '格']}}}]
            (directory / 'actions-01.json').write_text(json.dumps({'cards': cards}))
            (directory / 'characters.json').write_text(json.dumps({'cards': [
                {'id': 'fury', 'owned_techniques': ['bow', 'missing']}]}))
            result = run_query(root, {'dataset': 'actions', 'where': {'attributes_contains': '弓', 'counter': True}})
            self.assertEqual([r['id'] for r in result['matches']], ['dual'])
            self.assertEqual(run_query(root, {'dataset': 'actions', 'where': {'attributes_contains': '地', 'technique_class': '戦士'}})['matches'], [])
            with self.assertRaises(ValueError):
                run_query(root, {'dataset': 'character-owned-techniques', 'where': {'character': 'fury'}})
            with self.assertRaises(ValueError):
                run_query(root, {'dataset': 'actions', 'where': {'unknown': True}})


if __name__ == '__main__':
    unittest.main()
