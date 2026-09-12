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


def build_bindings(ledger, cards, core_only=False):
    by_id = {c['id']: c for c in cards}
    protections = protected_cases(cards)
    bindings = []
    unfinished = []
    for row in ledger['rows']:
        if row.get('kind') != 'character-semantic' or row.get('coverageClass') != 'semantic':
            continue
        extra = extra_binding(row, by_id) or received_defense_binding(row)
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
