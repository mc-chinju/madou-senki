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

    def test_conditional_election_requires_exact_owner_tuple(self):
        ledger = self.ledger('default-off-explicit-cancelable-election')
        ledger['rows'][0]['entryId'] = 'c2-p02-r1c1-ab04'
        cards = [{'id': 'c2-p02-r1c1', 'name': '有翼人のティア', 'defeat_condition': 'なし'}]
        result = build_bindings(ledger, cards)
        self.assertEqual(result[0]['tests'][0]['parameters'], ['有翼人のティア', 'c2-p02-r1c1-ab04'])

    def test_conditional_update_binding_describes_source_specific_guard(self):
        ledger = self.ledger('cancel-update-retains-prior-selection-and-attempt')
        for entry, name in [('c2-p03-r1c2', 'リーア姫'), ('c2-p02-r1c1', '有翼人のティア')]:
            ledger['rows'][0]['entryId'] = entry + ('-ab03' if name == 'リーア姫' else '-ab04')
            result = build_bindings(ledger, [{'id': entry, 'name': name, 'defeat_condition': 'なし'}])
            test = result[0]['tests'][0]
            self.assertEqual(test['parameters'], [name, ledger['rows'][0]['entryId']])
            self.assertIn('Fate cancellation' if name == 'リーア姫' else 'redundant ON', test['bindingNote'])

    def test_shadow_children_bind_actual_source_specific_transitions(self):
        for entry in ['c2-p04-r2c2-ab01', 'c2-p06-r2c2-ab01']:
            ledger = self.ledger('child-normal-range-chant-use-level')
            ledger['rows'][0]['entryId'] = entry
            result = build_bindings(ledger, self.cards)
            tests = result[0]['tests']
            self.assertGreaterEqual(len(tests), 3)
            self.assertTrue(all(t['kind'] == 'canonical-transition' for t in tests))
            self.assertTrue(all(('shadow-card' if entry == 'c2-p04-r2c2-ab01' else 'shadow-jump') in t['path'] for t in tests))

    def test_follower_bundle_binds_each_owners_failed_use_check(self):
        for entry in ['c2-p05-r1c2-ab02', 'c2-p06-r1c2-ab04']:
            ledger = self.ledger('no-morale-does-not-waive-use-check')
            ledger['rows'][0]['entryId'] = entry
            result = build_bindings(ledger, self.cards)
            test = result[0]['tests'][0]
            self.assertEqual(test['parameters'][-1], entry)
            self.assertIn('failed use check', test['title'])
            self.assertEqual(test['kind'], 'canonical-transition')

    def test_follower_boundaries_bind_both_exact_owner_scalar_cases(self):
        for entry, owner in [('c2-p05-r1c2-ab02', '獣使いのウパニシャット'), ('c2-p06-r1c2-ab04', '魔聖母ディア')]:
            for clause in ['shared-advance-only-same-source-hit-index', 'one-target-follower-snapshot-across-sources']:
                ledger = self.ledger(clause)
                ledger['rows'][0]['entryId'] = entry
                result = build_bindings(ledger, self.cards)
                self.assertEqual(result[0]['tests'][0]['parameters'], owner)
                self.assertEqual(result[0]['tests'][0]['kind'], 'canonical-transition')

    def test_hunger_keeps_structural_exclusions_distinct_from_real_kills(self):
        for clause, kind in [('kill-counter-provenance', 'canonical-transition'), ('exclude-wandering', 'structural-resolver'), ('exclude-self-damage-cause', 'structural-resolver')]:
            ledger = self.ledger(clause)
            ledger['rows'][0]['entryId'] = 'c2-p06-r2c2-ab04'
            result = build_bindings(ledger, self.cards)
            self.assertEqual(result[0]['tests'][0]['kind'], kind)

    def test_lia_recipient_suppression_keeps_structural_evidence(self):
        ledger = self.ledger('recipient-suppression-does-not-remove-gift')
        ledger['rows'][0]['entryId'] = 'c2-p03-r1c2-ab03'
        result = build_bindings(ledger, self.cards)
        self.assertEqual(result[0]['tests'][0]['kind'], 'structural-resolver')

    def test_transform_binds_both_attempt_outcomes_and_explicit_hide_boundary(self):
        ledger = self.ledger('once-game-transform')
        ledger['rows'][0]['entryId'] = 'c2-p02-r2c2-ab05'
        result = build_bindings(ledger, self.cards)
        self.assertEqual([t['parameters'] for t in result[0]['tests']], [False, True])
        ledger['rows'][0]['clauseKey'] = 'no-revert-on-Lia-hide'
        self.assertEqual(build_bindings(ledger, self.cards)[0]['tests'][0]['kind'], 'structural-resolver')

    def test_c16_hidden_identity_pair_keeps_both_structural_cases(self):
        ledger = self.ledger('C16/hidden-exempt-designation-same-transcript')
        ledger['rows'][0]['entryId'] = 'c2-p07-r1c2-ab03'
        result = build_bindings(ledger, self.cards)
        self.assertEqual([t['parameters'] for t in result[0]['tests']], ['リーア姫', '聖騎士ランスロット2'])
        self.assertTrue(all(t['kind'] == 'structural-resolver' for t in result[0]['tests']))

    def test_c16_lifetime_keeps_boundary_and_actual_death_evidence_distinct(self):
        ledger = self.ledger('C16/lease-expires-G15-death-entry')
        ledger['rows'][0]['entryId'] = 'c2-p03-r1c2-ab04'
        self.assertEqual(build_bindings(ledger, self.cards)[0]['tests'][0]['kind'], 'canonical-transition')
        ledger['rows'][0]['clauseKey'] = 'C16/loss-of-Lia-identity-expires-lease'
        test = build_bindings(ledger, self.cards)[0]['tests'][0]
        self.assertEqual(test['kind'], 'structural-resolver')
        self.assertEqual(test['parameters'], 'source-identity')

    def test_conditional_inheritance_never_claims_a_printed_transformation(self):
        ledger = self.ledger('transform-inheritance-preserves-source-selection')
        ledger['rows'][0]['entryId'] = 'c2-p02-r1c1-ab04'
        result = build_bindings(ledger, [{'id':'c2-p02-r1c1','name':'有翼人のティア','defeat_condition':'なし'}])
        self.assertEqual(result[0]['tests'][0]['kind'], 'structural-resolver')
        self.assertEqual(result[0]['tests'][0]['parameters'], ['有翼人のティア','c2-p02-r1c1-ab04'])

    def test_condition_loss_uses_explicit_structural_boundary(self):
        ledger = self.ledger('condition-loss-suspends-keeps-selection')
        ledger['rows'][0]['entryId'] = 'c2-p04-r1c2-ab03'
        result = build_bindings(ledger, [{'id':'c2-p04-r1c2','name':'竜皇子アスフェルト','defeat_condition':'なし'}])
        self.assertEqual(result[0]['tests'][0]['kind'], 'structural-resolver')
        self.assertIn('condition loss', result[0]['tests'][0]['title'])

    def test_unknown_clause_inside_a_supported_family_fails_closed(self):
        with self.assertRaisesRegex(ValueError, 'unknown'):
            build_bindings(self.ledger('objective/unknown'), self.cards, core_only=True)


if __name__ == '__main__':
    unittest.main()
