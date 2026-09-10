"""Earth-warrior inspection reports printed 地+戦 techniques only."""
import json
import tempfile
import unittest
from pathlib import Path

from .inspect_earth_warrior_actions import collect_earth_warrior_techniques


class EarthWarriorInspection(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'data/second-edition').mkdir(parents=True)

    def write(self, cards):
        (self.root / 'data/second-edition/actions-01-06.json').write_text(json.dumps({'cards': cards}, ensure_ascii=False))

    def test_earth_magic_and_earth_follower_are_not_warrior_techniques(self):
        self.write([
            {'id': 'earth-magic', 'name': '地裂', 'category': 'technique',
             'stats': {'attributes': ['遠', '魔', '地']}},
            {'id': 'earth-follower', 'name': 'ドワーフ', 'category': 'follower',
             'stats': {'attributes': ['人', '地'], 'attack': {'attributes': ['近', '戦', '格']}}},
        ])
        self.assertEqual(collect_earth_warrior_techniques(self.root), [])

    def test_printed_earth_warrior_technique_is_reported(self):
        self.write([{'id': 'invented', 'name': '地戦士', 'category': 'technique',
                     'stats': {'attributes': ['近', '戦', '地']}}])
        matches = collect_earth_warrior_techniques(self.root)
        self.assertEqual([m['id'] for m in matches], ['invented'])

    def test_current_second_edition_has_no_earth_warrior_technique(self):
        repo = Path(__file__).resolve().parents[1]
        self.assertEqual(collect_earth_warrior_techniques(repo), [])


if __name__ == '__main__':
    unittest.main()
