import unittest
from scripts.build_character_bindings import build_bindings


class CharacterBindingsTest(unittest.TestCase):
    def setUp(self):
        self.cards = [{'id': 'owner', 'name': 'Owner', 'defeat_condition': 'リーア姫かシェリムの死亡'},
                      {'id': 'lia', 'name': 'リーア姫', 'defeat_condition': 'なし'},
                      {'id': 'sherim', 'name': '白魔術師シェリム', 'defeat_condition': 'なし'}]

    def ledger(self, clause):
        return {'rows': [{'entryId': 'owner', 'clauseKey': clause,
                          'kind': 'character-semantic', 'coverageClass': 'semantic', 'status': 'pending'}]}

    def test_or_protection_binds_both_real_death_continuations(self):
        bindings = build_bindings(self.ledger('defeat/any-listed-death-or'), self.cards, core_only=True)
        self.assertEqual([t['parameters'][-1] for t in bindings[0]['tests']], ['lia', 'sherim'])
        self.assertTrue(all(t['kind'] == 'canonical-transition' for t in bindings[0]['tests']))

    def test_unimplemented_family_is_not_silently_accepted(self):
        with self.assertRaisesRegex(ValueError, 'unimplemented'):
            build_bindings(self.ledger('own-turn-extra'), self.cards)
        self.assertEqual(build_bindings(self.ledger('own-turn-extra'), self.cards, core_only=True), [])

    def test_pure_allegiance_resolver_keeps_its_evidence_kind(self):
        bindings = build_bindings(self.ledger('allegiance/reject-outside-allowed-set'), self.cards, core_only=True)
        self.assertEqual(bindings[0]['tests'][0]['kind'], 'structural-resolver')
        self.assertEqual(bindings[0]['status'], 'implemented')
        self.assertNotIn('runEvidence', bindings[0])

    def test_extra_ability_keeps_exact_owner_and_target_tuple(self):
        ledger = self.ledger('main-action-preserved')
        ledger['rows'][0]['entryId'] = 'c2-p04-r2c1-ab02'
        cards = [{'id': 'c2-p04-r2c1', 'name': '占星術師のアルセイル', 'defeat_condition': 'なし'}]
        result = build_bindings(ledger, cards)
        self.assertEqual(result[0]['tests'][0]['parameters'], ['占星術師のアルセイル', 'c2-p04-r2c1-ab02', 'B'])
        self.assertEqual(result[0]['tests'][0]['kind'], 'canonical-transition')

    def test_mental_defense_binds_its_own_scalar_case(self):
        ledger = self.ledger('canceled-attempt-stays-spent')
        ledger['rows'][0]['entryId'] = 'c2-p06-r1c1-ab01'
        result = build_bindings(ledger, self.cards)
        self.assertEqual(result[0]['tests'][0]['parameters'], 'c2-p06-r1c1-ab01')
        self.assertIn('Fate cancellation', result[0]['tests'][0]['title'])

    def test_unknown_clause_inside_a_supported_family_fails_closed(self):
        with self.assertRaisesRegex(ValueError, 'unknown'):
            build_bindings(self.ledger('objective/unknown'), self.cards, core_only=True)


if __name__ == '__main__':
    unittest.main()
