#!/usr/bin/env python3
"""Generate exact character clause bindings, refusing unfinished families by default."""
import argparse
import json
import sys
from pathlib import Path

TEST = 'packages/engine/test/character-clauses.test.ts'
OBJECTIVES = 'packages/engine/src/lifecycle/objectives.ts'
ADVANCE = 'packages/engine/src/lifecycle/advance.ts'
PROTECTED_NAMES = ['リーア姫', 'シェリム', 'ガイナス', 'ディア', 'フレイアード', 'アーネス', 'アイエル']


def protected_cases(cards):
    result = []
    for card in cards:
        for token in PROTECTED_NAMES:
            if token not in card['defeat_condition']:
                continue
            matches = [c for c in cards if token in c['name']]
            if len(matches) != 1:
                raise ValueError(f'ambiguous printed protection: {token}')
            target = matches[0]
            result.append([card['name'], card['id'], target['name'], target['id']])
    return result


EXTRA_IDS = {'c2-p01-r2c2-ab03', 'c2-p03-r1c2-ab02', 'c2-p03-r1c2-ab04', 'c2-p03-r2c1-ab03', 'c2-p04-r2c1-ab02', 'c2-p04-r2c1-ab01', 'c2-p05-r1c1-ab01'}
EXTRA_SUFFIXES = {'own-turn-once-attempt', 'main-action-preserved', 'public-priority-no-private-choice-interrupt'}


def extra_binding(row, cards):
    entry, clause = row['entryId'], row['clauseKey']
    if entry not in EXTRA_IDS or clause not in EXTRA_SUFFIXES | {'own-turn-extra', 'selected-one-target'}:
        return None
    card = cards[entry.split('-ab')[0]]
    target = None if entry == 'c2-p04-r2c1-ab01' else 'C' if entry == 'c2-p03-r1c2-ab04' else 'B'
    parameters = [card['name'], entry, target]
    title = '%s %s target %s ' + ('own-turn-once-attempt' if clause == 'own-turn-extra' else clause)
    if clause == 'selected-one-target':
        if entry != 'c2-p04-r2c1-ab02':
            raise ValueError('unexpected single-target extra clause')
        title = 'Astrology selects exactly one declared player and rejects a multiple-player input atomically'
        parameters = None
    suppression = entry == 'c2-p03-r1c2-ab04'
    path = 'packages/engine/src/abilities/' + ('suppression.ts' if suppression else 'turn-information.ts')
    symbols = ['suppressionOptions', 'transitionSuppression'] if suppression else ['turnAbilityOptions', 'transitionTurnPackage']
    return {'row': f'{entry}#{clause}', 'handler': [{'path': path, 'symbol': symbol} for symbol in symbols],
            'tests': [{'path': 'packages/engine/test/character-turn-extras.test.ts', 'suite': [],
                       'title': title, 'parameters': parameters, 'kind': 'canonical-transition',
                       'bindingNote': f'{clause}: actual own-turn extra commands, cancellation/retry, preserved main attack, or public/private window eligibility for this exact source.'}],
            'status': 'implemented', 'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}


def received_defense_binding(row):
    entry, clause = row['entryId'], row['clauseKey']
    mental = {'c2-p03-r2c1-ab01', 'c2-p06-r1c1-ab01', 'c2-p06-r1c2-ab01'}
    titles = {
        'canceled-attempt-stays-spent': '%s actual Fate cancellation spends the entire Griffin target group; later group is fresh',
        'same-faction-attacker-not-excluded': '%s accepts an actually declared same-faction attacker without exclusion',
        'once-group-target-before-followers': '%s is available before follower start and rejects a late declaration',
        'other-target-declared-hits-survive': '%s successful doubles cancel and save separate attacker seat clock',
        'fixed-faction-keeps-objective-and-protection': '%s fixed initial faction retains objective and protection after a real declaration',
    }
    if entry in mental and clause in titles:
        path = 'packages/engine/test/mental-received-defenses.test.ts'
        refs = [(titles[clause], entry, ['C03 complete mental received defenses'] if clause == 'other-target-declared-hits-survive' else [])]
        if clause == 'once-group-target-before-followers':
            refs.append((titles['canceled-attempt-stays-spent'], entry, []))
        handler = 'packages/engine/src/abilities/mental-defense.ts'
        symbols = ['mentalDefenseOptions', 'mentalDefenseAttempt', 'resolveMentalDefense']
    elif entry == 'c2-p05-r1c2-ab05' and clause in {'substitution-before-final-hit','substitution-no-follower-normal-defense','substitution-no-repeat-same-hit'}:
        path = 'packages/engine/test/sad-love.test.ts'
        names = {
            'substitution-before-final-hit': ['Sad love actual substitution redirects one hit into Upa with no physical payment', 'Substitution rejects wrong target, wrong hit, foreign actor and late finalized source immutably'],
            'substitution-no-follower-normal-defense': ['Substitution retains A13 restrictions and permits a real hand counter'],
            'substitution-no-repeat-same-hit': ['Substitution retains A13 restrictions and permits a real hand counter', 'Canceled substitution spends the once-game attempt and leaves the hit with Arnes'],
        }
        refs = [(title, None, []) for title in names[clause]]
        handler = 'packages/engine/src/abilities/sad-love.ts'
        symbols = ['sadLoveView', 'transitionSadLove', 'resolveSadLove']
    else:
        return None
    return {'row': f'{entry}#{clause}', 'handler': [{'path': handler, 'symbol': symbol} for symbol in symbols],
            'tests': [{'path': path, 'suite': suite, 'title': title, 'parameters': parameters, 'kind': 'canonical-transition',
                       'bindingNote': f'{clause}: actual declared attack and exact source-specific defense/substitution assertions; not a related-only package reference.'}
                      for title, parameters, suite in refs],
            'status': 'implemented', 'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}


def conditional_election_binding(row, cards):
    ids = {'c2-p02-r1c1-ab04','c2-p03-r1c2-ab03','c2-p03-r2c2-ab04','c2-p04-r1c2-ab03','c2-p04-r1c2-ab05','c2-p05-r1c2-ab01','c2-p05-r2c1-ab05','c2-p06-r1c2-ab02'}
    entry, clause = row['entryId'], row['clauseKey']
    if entry not in ids or clause not in {'default-off-explicit-cancelable-election', 'absence-retains-death-clears', 'cancel-update-retains-prior-selection-and-attempt', 'transform-inheritance-preserves-source-selection', 'condition-loss-suspends-keeps-selection'}:
        return None
    if clause == 'condition-loss-suspends-keeps-selection':
        return {'row': f'{entry}#{clause}',
                'handler': [{'path': 'packages/engine/src/abilities/conditional-stats.ts', 'symbol': 'conditionalStatAdditions'},
                            {'path': 'packages/engine/src/abilities/conditional-selection.ts', 'symbol': 'cleanConditionalSelections'}],
                'tests': [{'path': 'packages/engine/test/character-conditional-matrix.test.ts', 'suite': [],
                           'title': '%s %s structural condition loss suspends addition without erasing election',
                           'parameters': [cards[entry.split('-ab')[0]]['name'], entry], 'kind': 'structural-resolver',
                           'bindingNote': 'Actual election then source-specific public/faction/combat-context boundary: exact addition disappears while selection persists and resumes after JSON restore. Dragon uses an actual follower-morale roll context. Condition removal is direct, not a claimed legal concealment or allegiance producer.'}],
                'status': 'implemented', 'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}
    inherited = clause == 'transform-inheritance-preserves-source-selection'
    update_note = ('Actual Fate cancellation of Lia target update preserves prior selection and the spent opportunity across JSON restore; retry is rejected.'
                   if entry == 'c2-p03-r1c2-ab03' else
                   'This source has no target update: redundant ON is rejected without changing the prior selection or attempt history.')
    return {'row': f'{entry}#{clause}',
            'handler': [{'path': 'packages/engine/src/abilities/conditional-selection.ts', 'symbol': symbol}
                        for symbol in ['transitionConditionalAbility', 'resolveConditionalAbility', 'cleanConditionalSelections']],
            'tests': [{'path': 'packages/engine/test/character-conditional-matrix.test.ts', 'suite': [],
                       'title': '%s %s ' + ('structural inherited ownership retains exact source election' if inherited else clause),
                       'parameters': [cards[entry.split('-ab')[0]]['name'], entry], 'kind': 'structural-resolver' if inherited else 'canonical-transition',
                       'bindingNote': 'Actual election followed by direct inherited ownership and identity boundary; no printed transformation into Lancelot II is claimed. Exact source and targets persist only while ownership remains.' if inherited else update_note if clause == 'cancel-update-retains-prior-selection-and-attempt' else 'Actual Rift and forced failed resistance enter otherworld, actual Wish opens Dawn to return; actual protected death preserves election while wandering (or unrelated death leaves an unprotected owner active); actual approach/lethal attack clears election on owner death.' if clause == 'absence-retains-death-clears' else 'Exact source defaults OFF; actual Fate cancellation spends its opportunity without installation; real phase advance permits explicit selection; JSON restore and explicit OFF preserve eligibility rules.'}],
            'status': 'implemented', 'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}


def shadow_child_binding(row):
    entry, clause = row['entryId'], row['clauseKey']
    refs = []
    if entry == 'c2-p04-r2c2-ab01':
        path = 'packages/engine/test/shadow-card-physical.test.ts'
        if clause in {'child-no-extra-turn', 'child-no-extra-approach-withdrawal'}:
            refs = [('%s actual received physical attack preserves fixed defense5 null damage and independent optional printed Ida child', 'shadow-card-dedicated')]
        elif clause == 'child-normal-range-chant-use-level':
            refs = [('actual prepared IceWolf across own end and intervening turns is available to the grant while unchanted and far near-sword sources are refused', None),
                    ('actual non-counter child independently pays warrior4 use check %s plus %s success=%s', [3, 3, True]),
                    ('actual non-counter child independently pays warrior4 use check %s plus %s success=%s', [3, 4, False])]
    elif entry == 'c2-p06-r2c2-ab01':
        path = 'packages/engine/test/shadow-jump.test.ts'
        if clause in {'child-no-extra-turn', 'child-no-extra-approach-withdrawal'}:
            refs = [('Shadow jump paid child rejects approach withdrawal and extra turns while preserving the parent turn', None)]
        elif clause == 'child-normal-range-chant-use-level':
            refs = [('Shadow jump child keeps ordinary %s eligibility without spending its card', v) for v in ['far', 'chant']]
            refs += [('Shadow jump child independently checks excess magic level at %s plus %s success=%s', v) for v in [[3, 4, True], [4, 4, False]]]
        elif clause == 'advance-is-exact-one-discard':
            refs = [('Shadow jump cost rejects stale, foreign and non-advance payment before mutation; repeated payment is refused', None),
                    ('Actual cancellation of the paid child never restores the original hit or refunds its advance', None)]
        elif clause in {'advance-not-marker', 'declining-child-retains-successful-defense'}:
            refs = [('Shadow jump self-check has no enemy check and defense survives declining %s', v) for v in ['cost', 'attack', 'child']]
    if not refs:
        return None
    handlers = [{'path': 'packages/engine/src/combat/attack.ts', 'symbol': 'transitionCombat'}]
    if entry == 'c2-p06-r2c2-ab01':
        handlers += [{'path': 'packages/engine/src/abilities/shadow-jump.ts', 'symbol': v} for v in ['resolveShadowJump', 'payShadowJump']]
    return {'row': f'{entry}#{clause}', 'handler': handlers,
            'tests': [{'path': path, 'suite': [], 'title': title, 'parameters': params, 'kind': 'canonical-transition',
                       'bindingNote': f'{clause}: exact printed source and actual parent/child transitions; ordinary eligibility, payment, or return assertions specific to this clause.'} for title, params in refs],
            'status': 'implemented', 'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}


def follower_bundle_binding(row):
    entry, clause = row['entryId'], row['clauseKey']
    cases = {'c2-p05-r1c2-ab02': ['獣使いのウパニシャット', 'グリフォン', '地竜', 'c2-p05-r1c2-ab02'],
             'c2-p06-r1c2-ab04': ['魔聖母ディア', '兵士', '竜王教団', 'c2-p06-r1c2-ab04']}
    if entry not in cases:
        return None
    prefix = '%s %s %s %s '
    refs = []
    if clause in {'hand-source-eligible', 'placed-source-eligible', 'declare-source-order-targets-dedication', 'parent-cancel-spends-all-sources-action'}:
        refs = [(prefix + 'freezes ordered hand and placed declarations before parent cancellation', cases[entry])]
    elif clause == 'child-failure-only-own-source':
        refs = [(prefix + suffix, cases[entry]) for suffix in ['child cancellation preserves the later source', 'morale waiver retains failed use check and later source']]
    elif clause == 'no-morale-does-not-waive-use-check':
        refs = [(prefix + 'morale waiver retains failed use check and later source', cases[entry])]
    elif clause == 'shared-advance-only-same-source-hit-index':
        refs = [('%s shared advance stops at the next source hit index', cases[entry][0])]
    elif clause == 'one-target-follower-snapshot-across-sources':
        refs = [('%s shares one target follower snapshot and morale across source hits', cases[entry][0])]
    elif clause == 'one-group-independent-values-not-sum':
        refs = [(prefix + 'keeps independent values in one defense group', cases[entry])]
    if not refs:
        return None
    return {'row': f'{entry}#{clause}',
            'handler': [{'path': 'packages/engine/src/combat/follower-bundles.ts', 'symbol': 'transitionFollowerBundle'},
                        {'path': 'packages/engine/src/combat/attack.ts', 'symbol': 'continueFollowerBundle'}],
            'tests': [{'path': 'packages/engine/test/heterogeneous-followers.test.ts', 'suite': [], 'title': title, 'parameters': params,
                       'kind': 'canonical-transition', 'bindingNote': f'{clause}: actual exact-owner follower bundle with physical sources, preserved declaration metadata, independent resolution or cancellation assertions.'} for title, params in refs],
            'status': 'implemented', 'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}


def hunger_binding(row):
    entry, clause = row['entryId'], row['clauseKey']
    if entry != 'c2-p06-r2c2-ab04':
        return None
    path = 'packages/engine/test/combat-rewards.test.ts'
    kind, params = 'canonical-transition', None
    if clause in {'kill-attack-provenance', 'kill-counter-provenance', 'kill-reflection-provenance'}:
        title = 'Yotsurm hunger preserves actual %s killing source through death'
        params = clause.split('-')[1]
    elif clause == 'exclude-other-killer':
        title = 'An actual kill by another actor grants no hunger to the observing Yotsurm'
    elif clause in {'exclude-wandering', 'exclude-self-damage-cause'}:
        path = 'packages/engine/test/combat-reward-boundaries.test.ts'
        title = 'Structural settlement excludes wandering victims and self damage from kill rewards'
        kind = 'structural-resolver'
    else:
        return None
    return {'row': f'{entry}#{clause}',
            'handler': [{'path': 'packages/engine/src/abilities/combat-reward-state.ts', 'symbol': 'queueCombatRewards'},
                        {'path': 'packages/engine/src/lifecycle/advance.ts', 'symbol': 'settleDamage'}],
            'tests': [{'path': path, 'suite': [], 'title': title, 'parameters': params, 'kind': kind,
                       'bindingNote': 'Direct settlement boundary with arranged presence/cause; not a fabricated legal attack on a wandering target or an actual self-damage producer.' if kind == 'structural-resolver' else 'Actual attack/response/death transitions verify exact killer and source, or exclude an observing non-killer.'}],
            'status': 'implemented', 'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}


def lia_dia_binding(row):
    key = (row['entryId'], row['clauseKey'])
    refs = {
        ('c2-p03-r1c2-ab03', 'target-set-explicit-no-auto-add'): ('Lia explicit recipient list does not add a later actually revealed character', 'canonical-transition'),
        ('c2-p03-r1c2-ab03', 'recipient-suppression-does-not-remove-gift'): ('Lia saves a chosen public subset; hidden self still receives separate public Lance bonus', 'structural-resolver'),
        ('c2-p06-r1c2-ab02', 'initial-hand-five'): ('Dia initial five cards do not grow when public capacity is elected', 'canonical-transition'),
        ('c2-p06-r1c2-ab02', 'capacity-add-two-plus-Haja'): ('Dia reserves +2 capacity, requires public source and retains Haja addition', 'structural-resolver'),
        ('c2-p06-r1c2-ab02', 'capacity-loss-adjust-end-turn'): ('actual Dia END uses selected public capacity plus Haja; late OFF waits for normal END discard', 'canonical-transition'),
    }
    if key not in refs:
        return None
    title, kind = refs[key]
    handlers = [{'path': 'packages/engine/src/abilities/conditional-stats.ts', 'symbol': 'conditionalStatAdditions'}]
    if key[1] == 'initial-hand-five':
        handlers += [{'path': 'packages/engine/src/setup.ts', 'symbol': 'refillInitialHand'}]
    return {'row': '#'.join(key), 'handler': handlers,
            'tests': [{'path': 'packages/engine/test/conditional-stats.test.ts', 'suite': [], 'title': title, 'parameters': None, 'kind': kind,
                       'bindingNote': 'Direct arranged recipient suppression or Haja OPEN arithmetic; structural classification retained.' if kind == 'structural-resolver' else 'Actual source-specific selection/reveal or END transition; initial hand test uses real assigned Dia creation, END test uses arranged Haja and hand before its turn sequence.'}],
            'status': 'implemented', 'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}


def lancelot_transform_binding(row):
    entry, clause = row['entryId'], row['clauseKey']
    if entry != 'c2-p02-r2c2-ab05' or clause not in {'once-game-transform', 'no-revert-on-Lia-hide'}:
        return None
    once = clause == 'once-game-transform'
    return {'row': f'{entry}#{clause}',
            'handler': [{'path': 'packages/engine/src/lifecycle/commands.ts', 'symbol': symbol} for symbol in ['availableLifecycleAbilities', 'resolveLifecycleAbility']],
            'tests': [{'path': 'packages/engine/test/optional-lifecycle-transform.test.ts', 'suite': [],
                       'title': 'Lancelot transformation attempt stays spent after actual cancellation=%s and phase change' if once else 'Structural Lia concealment after actual Lancelot transformation does not revert identity or inherited abilities',
                       'parameters': param, 'kind': 'canonical-transition' if once else 'structural-resolver',
                       'bindingNote': 'Actual transformation success or Fate cancellation retains one attempt across phase change and JSON restore; retry rejected.' if once else 'Actual transformation followed by direct Lia reveal-state change; no legal Lia concealment producer is invented.'} for param in ([False, True] if once else [None])],
            'status': 'implemented', 'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}


def c16_designation_binding(row):
    entry, clause = row['entryId'], row['clauseKey']
    if entry != 'c2-p07-r1c2-ab03':
        return None
    refs = []
    if clause in {'C16/no-secret-target-rejection', 'C16/hidden-exempt-designation-same-transcript', 'C16/hidden-target-uniform-public-view'}:
        refs = [('C16 hidden %s produces the same targeting transcript as an ordinary identity', name, 'structural-resolver') for name in ['リーア姫', '聖騎士ランスロット2']]
    elif clause == 'C16/public-only-target-candidates':
        refs = [('C16 public exemptions are excluded but hidden exemptions remain selectable', None, 'structural-resolver')]
    else:
        titles = {
            'C16/public-own-opportunity-once': 'C16 real turn advance offers Vanmil only his public reaction and spends it once',
            'C16/no-main-action': 'C16 invalid target lists do not spend the attempt and valid designation preserves main action',
            'C16/reject-empty-duplicate-nonexistent': 'C16 invalid target lists do not spend the attempt and valid designation preserves main action',
            'C16/reject-no-new-designation': 'C16 a fresh attack window cannot retry a no-new-target designation',
            'C16/designations-accumulate': 'C16 a fresh attack window cannot retry a no-new-target designation',
            'C16/self-target-ban-blocks-further-declaration': 'C16 self-designation prevents subsequent ability use and never adds a public disabled status',
        }
        if clause in titles:
            refs = [(titles[clause], None, 'canonical-transition')]
    if not refs:
        return None
    return {'row': f'{entry}#{clause}',
            'handler': [{'path': 'packages/engine/src/abilities/suppression.ts', 'symbol': symbol} for symbol in ['suppressionOptions', 'transitionSuppression', 'resolveSuppression']],
            'tests': [{'path': 'packages/engine/test/suppression-blessing.test.ts', 'suite': [], 'title': title, 'parameters': param, 'kind': kind,
                       'bindingNote': 'Paired arranged identities/public flags verify targeting and observer projection without claiming real identity transformation.' if kind == 'structural-resolver' else 'Actual public declaration/turn/attack/cancellation transitions assert the precise C16 target or opportunity rule.'} for title, param, kind in refs],
            'status': 'implemented', 'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}


def c16_lifetime_binding(row):
    entry, clause = row['entryId'], row['clauseKey']
    refs = []
    structural = 'structural-resolver'
    boundary = 'C16 structural Blessing lifetime boundary %s preserves only a living matching source'
    if entry == 'c2-p07-r1c2-ab03':
        if clause == 'C16/established-ban-survives-source-suppression-absence':
            refs = [('C16 bans persist while Vanmil is stopped or absent; mandatory non-ability rules remain separate', None, structural)]
        elif clause in {'C16/target-death-revival-retains-designation', 'C16/no-early-ban-removal-in-G15'}:
            refs = [('C16 structural death entry and resetup of %s retain the established designation', v, structural) for v in (['B'] if clause.endswith('retains-designation') else ['A', 'B'])]
    elif entry == 'c2-p03-r1c2-ab04':
        if clause == 'C16/designated-public-state-candidates':
            refs = [('C16 Blessing candidates use designated public state after actual turn advance', None, 'canonical-transition')]
        elif clause in {'C16/exempt-target-same-check-and-lease', 'C16/success-does-not-disclose-prior-ban'}:
            refs = [('C16 Blessing on a concealed inert designation has the same outsider transcript', None, structural)]
        elif clause == 'C16/only-Vanmil-ban-released':
            refs = [('C16 actual Blessing spirit minus five roll relieves only Vanmil and survives temporary absence', None, structural)]
        elif clause == 'C16/lease-survives-Lia-suppression-absence':
            refs = [(t, None, structural) for t in ['C16 actual Blessing spirit minus five roll relieves only Vanmil and survives temporary absence', 'C16 a new declaration containing an already relieved target never cancels its living Blessing']]
        elif clause == 'C16/redesignation-does-not-break-live-lease':
            refs = [('C16 a new declaration containing an already relieved target never cancels its living Blessing', None, structural)]
        elif clause == 'C16/lease-survives-target-absence':
            refs = [(boundary, v, structural) for v in ['target-otherworld', 'target-wandering']]
        elif clause == 'C16/lease-expires-G15-death-entry':
            refs = [('C16 actual own-turn Blessing expires on the source lethal attack before disposal', None, 'canonical-transition')]
        elif clause == 'C16/revival-does-not-restore-lease':
            refs = [('C16 Blessing expires at G15 death entry and cannot revive with its old life', None, structural)]
        elif clause == 'C16/loss-of-Lia-identity-expires-lease':
            refs = [(boundary, 'source-identity', structural)]
        elif clause == 'C16/source-life-generation-saved':
            refs = [(boundary, 'source-generation', structural), ('C16 Blessing candidates use designated public state after actual turn advance', None, 'canonical-transition')]
    if not refs:
        return None
    return {'row': f'{entry}#{clause}',
            'handler': [{'path': 'packages/engine/src/abilities/suppression-state.ts', 'symbol': symbol} for symbol in ['cleanBlessingLeases', 'vanmilSuppressed']],
            'tests': [{'path': 'packages/engine/test/suppression-blessing.test.ts', 'suite': [], 'title': title, 'parameters': param, 'kind': kind,
                       'bindingNote': 'Explicit direct state/lifecycle boundary or paired identity fixture; no actual absence, revival or identity-change producer is claimed.' if kind == structural else 'Actual turn progression and Blessing declaration, with actual lethal attack for G15 expiry before disposal.'} for title, param, kind in refs],
            'status': 'implemented', 'remaining': ['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}


def frozen_conditional_binding(row, cards):
    entry = row['entryId']
    if row['clauseKey'] != 'frozen-values-no-rewind':
        return None
    matrix = 'packages/engine/test/character-conditional-matrix.test.ts'
    stats = 'packages/engine/test/conditional-stats.test.ts'
    bonuses = {'c2-p02-r1c1-ab04':1,'c2-p03-r1c2-ab03':2,'c2-p03-r2c2-ab04':2,'c2-p04-r1c2-ab05':1,'c2-p05-r1c2-ab01':1,'c2-p05-r2c1-ab05':2}
    refs = []
    if entry in bonuses:
        refs = [(matrix, '%s %s actual OFF preserves frozen check with bonus %s', [cards[entry.split('-ab')[0]]['name'],entry,bonuses[entry]], 'canonical-transition')]
    elif entry == 'c2-p04-r1c2-ab03':
        refs = [(stats, 'Dragon source disabled within before-roll loses +2; post-freeze OFF never rewrites roll', None, 'canonical-transition')]
    elif entry == 'c2-p06-r1c2-ab02':
        refs = [(stats, 'actual Dia END uses selected public capacity plus Haja; late OFF waits for normal END discard', None, 'canonical-transition')]
    else:
        return None
    if entry == 'c2-p05-r1c2-ab01':
        refs += [(matrix, 'Upa actual OFF leaves already frozen warrior damage unchanged', None, 'canonical-transition')]
    if entry == 'c2-p04-r1c2-ab05':
        refs += [(stats, 'Truth effect and damage freeze independently, without changing used level', None, 'canonical-transition'),
                 (stats, 'Truth frozen multi-hit numbers survive later OFF and target concealment', None, 'structural-resolver')]
    return {'row': f'{entry}#frozen-values-no-rewind',
            'handler': [{'path':'packages/engine/src/abilities/conditional-selection.ts','symbol':'transitionConditionalAbility'}],
            'tests': [{'path':path,'suite':[],'title':title,'parameters':params,'kind':kind,
                       'bindingNote':'Source-specific committed check, effect/damage or END hand continuation survives subsequent source selection changes. Direct target concealment is explicitly structural.'} for path,title,params,kind in refs],
            'status':'implemented','remaining':['Exact source assertions bound; frozen current-candidate run and acceptance remain.']}


def build_bindings(ledger, cards, core_only=False):
    by_id = {c['id']: c for c in cards}
    protections = protected_cases(cards)
    bindings = []
    unfinished = []
    for row in ledger['rows']:
        if row.get('kind') != 'character-semantic' or row.get('coverageClass') != 'semantic':
            continue
        extra = extra_binding(row, by_id) or received_defense_binding(row) or conditional_election_binding(row, by_id) or shadow_child_binding(row) or follower_bundle_binding(row) or hunger_binding(row) or lia_dia_binding(row) or lancelot_transform_binding(row) or c16_designation_binding(row) or c16_lifetime_binding(row) or frozen_conditional_binding(row, by_id)
        if extra:
            bindings.append(extra)
            continue
        clause = row['clauseKey']
        if not clause.startswith(('allegiance/', 'objective/', 'defeat/')) and clause not in {'inheritance/no-additional-source','restrictions/no-printed-restriction','owned_techniques/empty-no-base-entitlement','owned_followers/empty-no-base-entitlement'}:
            if row['status'] == 'pending':
                unfinished.append(f"{row['entryId']}#{clause}")
            continue
        card = by_id[row['entryId']]
        parameters = [card['name'], card['id']]
        tests = []
        handlers = []

        def add(suite, title, kind='structural-resolver', params=None):
            tests.append({'path': TEST, 'suite': [suite], 'title': title,
                          'parameters': parameters if params is None else params, 'kind': kind,
                          'bindingNote': f'{clause}: exact printed-character assertions; evidence kind retained; current-candidate acceptance remains.'})

        def handler(path, *symbols):
            handlers.extend({'path': path, 'symbol': symbol} for symbol in symbols)

        if clause == 'inheritance/no-additional-source':
            add('character source clauses', '%s (%s) has no additional inherited ability source')
            handler('packages/engine/src/abilities/ownership.ts', 'ownsAbility')
        elif clause == 'restrictions/no-printed-restriction':
            add('character printed restrictions', '%s (%s) has no additional printed technique restriction', 'canonical-transition')
            handler('packages/engine/src/combat/printed-restrictions.ts', 'printedTechniqueAllowed')
            handler('packages/engine/src/abilities/action-modifiers.ts', 'damagePreview')
        elif clause in {'owned_techniques/empty-no-base-entitlement','owned_followers/empty-no-base-entitlement'}:
            kind = 'technique' if clause.startswith('owned_techniques/') else 'follower'
            add('character source clauses', '%s (%s) empty owned %s list grants no base recovery', 'canonical-transition', parameters+[kind])
            handler('packages/engine/src/reclaim-names.ts', 'canonicalOwnedNames')
            handler('packages/engine/src/reclaim.ts', 'offerReclaim')
        elif clause.startswith('allegiance/'):

            suffix = clause.split('/')[1]
            if suffix not in {'no-printed-fixed-faction', 'reject-outside-allowed-set', 'not-optional-ability',
                              'allow-GOOD', 'allow-EVIL', 'allow-ヴァンミール'}:
                raise ValueError(f'unknown allegiance clause: {clause}')
            title = ('%s (%s) fixed allegiance is not an optional ability' if suffix == 'not-optional-ability'
                     else '%s (%s) printed faction allowance')
            add('character allegiance clauses', title)
            handler(OBJECTIVES, 'allowedFactions', 'replaceAllegiance')
        elif clause == 'objective/no-unrelated-faction-rewrite':
            add('character allegiance clauses', '%s (%s) unrelated allegiance changes preserve this objective')
            handler(OBJECTIVES, 'replaceAllegiance')
        elif clause in {'objective/extinction-GOOD', 'objective/extinction-EVIL', 'objective/extinction-nonVanmil'}:
            add('character objective clauses', '%s (%s) actual extinction completes the printed objective', 'canonical-transition')
            handler(OBJECTIVES, 'factionObjective')
            handler(ADVANCE, 'settleDamage', 'stableOutcome')
        elif clause == 'defeat/no-protected-character':
            add('character defeat clauses', '%s (%s) protection matches every printed death condition')
            add('character objective clauses', '%s (%s) actual extinction completes the printed objective', 'canonical-transition')
            handler(OBJECTIVES, 'initialProtection', 'protectedDead', 'currentDefeatCondition')
        elif clause in {'defeat/protected-Lia', 'defeat/protected-Gainas', 'defeat/protected-Dia',
                        'defeat/protected-Arnes', 'defeat/any-listed-death-or'}:
            matches = [p for p in protections if p[1] == card['id']]
            if not matches:
                raise ValueError(f'missing printed protection: {card["id"]}')
            for params in matches:
                add('character defeat clauses', '%s (%s) actual death of %s (%s) causes wandering then final loss',
                    'canonical-transition', params)
            handler(OBJECTIVES, 'protectedDead')
            handler(ADVANCE, 'advanceLifecycle', 'stableOutcome')
        else:
            raise ValueError(f'unknown core clause: {clause}')
        bindings.append({'row': f"{row['entryId']}#{clause}", 'handler': handlers, 'tests': tests,
                         'status': 'implemented', 'remaining': ['Exact clause assertions bound; frozen current-candidate run and acceptance remain.']})
    if unfinished and not core_only:
        raise ValueError(f'unimplemented character families: {len(unfinished)}; first {unfinished[0]}')
    return bindings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--emit-cases', action='store_true')
    parser.add_argument('--core-only', action='store_true', help='Explicit partial progress: basic character clauses; excludes unfinished ability clauses.')
    parser.add_argument('--bindings', type=Path)
    args = parser.parse_args()
    cards = json.loads((args.root / 'data/second-edition/characters.json').read_text())['cards']
    if args.emit_cases:
        print('const CHARACTER_CASES: [string,string][] = ' + json.dumps([[c['name'], c['id']] for c in cards], ensure_ascii=False, indent=2) + ';')
        for name, filtered in [('UNINHERITED_CASES', [c for c in cards if not c['transformation_only']]), ('UNRESTRICTED_CASES', [c for c in cards if not c['restrictions']])]:
            print(f'const {name}: [string,string][] = ' + json.dumps([[c['name'], c['id']] for c in filtered], ensure_ascii=False, indent=2) + ';')
        empty = [[c['name'], c['id'], kind] for c in cards for field,kind in [('owned_techniques','technique'),('owned_followers','follower')] if not c[field]]
        print("const EMPTY_OWNED_CASES: [string,string,'technique'|'follower'][] = " + json.dumps(empty, ensure_ascii=False, indent=2) + ';')
        print('const PROTECTED_CASES: [string,string,string,string][] = ' + json.dumps(protected_cases(cards), ensure_ascii=False, indent=2) + ';')
    if args.bindings:
        ledger = json.loads((args.root / 'data/second-edition/runtime-coverage.json').read_text())
        bindings = build_bindings(ledger, cards, args.core_only)
        sys.path.insert(0, str(Path(__file__).parent))
        from apply_ledger_bindings import apply_bindings, extract_declarations
        paths = {r['path'] for b in bindings for key in ['handler', 'tests'] for r in b[key]}
        apply_bindings(ledger, bindings, extract_declarations(args.root, paths))
        args.bindings.write_text(json.dumps({'bindings': bindings}, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'bindings': len(bindings), 'partial': args.core_only}))


if __name__ == '__main__':
    main()
