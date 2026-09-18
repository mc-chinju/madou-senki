# Engine rules coverage

This file tracks executable coverage added after the transcription-wide matrix in
[`second-edition/coverage.md`](second-edition/coverage.md). It does not mark the full catalog playable.
All source entries remain `implementation: pending`, so formal production START remains blocked.

## Task 7a — first printed warrior-technique group

Shared transition coverage is in `packages/engine/test/techniques.test.ts`: every row below has an
ordinary attack, its optional dedicated selection, exact physical-card consumption, and immutable
wrong-owner rejection. The suite also checks JSON round trips and the existing card-conservation
assertion on every accepted transition.

| Physical ID | Printed card and source | Handler paths | Actual transition tests | Remaining dependency |
|---|---|---|---|---|
| `a2-p07-r3c3` | 黒流弓 — CardAll p.7 r3c3 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated result tables; dedicated multi-target follower bypass | Arnes's optional virtual follower and other character abilities remain in the character slice |
| `a2-p08-r1c1` | 黒翼飛翔剣 — CardAll p.8 r1c1 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated result tables; one-card maai insufficiency; wrong-owner rejection | Arnes's character abilities and owned-technique reclaim remain outside this slice |
| `a2-p08-r1c3` | 風斬剣 — CardAll p.8 r1c3 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated result tables; two-card/shared maai; HP bypass versus level defense | Asfelt's optional 風龍の剣 is deliberately not auto-activated and remains in the character slice |
| `a2-p08-r2c1` | 雷斬剣 — CardAll p.8 r2c1 | `effects/techniques.ts` → `combat/attack.ts` | ordinary/dedicated multi-target results; 見切る rejected before cost; optional character power remains unused | Asfelt's optional abilities remain in the character slice |
| `a2-p08-r2c2` | 裂風斬 — CardAll p.8 r2c2 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated multi-target results; 見切る rejection; extra maai; final-effect-Lv destruction only on targets with a live hit; fully evaded and mixed-target regressions | Other character-driven follower modifiers remain in the character slice |
| `a2-p08-r3c3` | 気斬 — CardAll p.8 r3c3 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated results; follower bypass; attacker-spirit value frozen at damage boundary and survives JSON round trip | General Gadyura spirit-technique immunity and Ida's optional abilities remain in the character slice |
| `a2-p09-r1c2` | 破黒剣 — CardAll p.9 r1c2 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated results; white follower destroyed before level comparison while nonmatching HP still applies; fully evaded attack leaves followers untouched and unrevealed | Garwin's optional 剣匠 modifiers remain in the character slice |
| `a2-p09-r3c2` | 気破 — CardAll p.9 r3c2 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated results; extra maai; Gadyura white-use restriction; typed dedicated immunity exception and actual damage | Gadyura's general spirit-technique immunity is not integrated yet; the printed Jill exception is retained for that later handler |
| `a2-p09-r3c3` | 死鬼旋風脚 — CardAll p.9 r3c3 | `effects/techniques.ts` → `combat/attack.ts` | ordinary/dedicated results; one-card maai insufficiency; wrong-owner rejection | Jill's optional counter-conversion ability remains in the character slice |

The generic multi-hit follower snapshot and HP behavior continues to be covered by
`packages/engine/test/multi-hit.test.ts`. None of these nine printed cards creates multiple hits,
so Task 7a does not invent a multi-hit mode for them.

## Task 7b — remaining direct warrior techniques

The 17 physical cards below are covered through real `transition` calls in
`packages/engine/test/task7b-techniques.test.ts`. Every accepted step is replayed from a JSON copy
with the same entropy and checks that the exact 220-card physical multiset is conserved. The
catalog remains pending and the formal production START gate is unchanged.

| Physical ID | Printed card and source | Handler paths | Actual transition tests | Remaining dependency |
|---|---|---|---|---|
| `a2-p10-r1c1` | 死鬼界滅拳 — CardAll p.10 r1c1 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated damage and consumption; black/death destruction; white restriction | Jill's unrelated character abilities and owned-technique reclaim remain pending |
| `a2-p10-r1c2` | 死鬼滅殺拳 — CardAll p.10 r1c2 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated damage; Gadyura/Dia printed multiplier descriptor; immutable wrong-owner rejection | Broad character immunity remains pending; this card's multiplier is active without it |
| `a2-p10-r2c1` | 天地爆砕剣 — CardAll p.10 r2c1, ruling T14 | `effects/techniques.ts` → `combat/attack.ts` | ordinary one/two-target bound and three-target rejection; non-Shin pre-check ordering/failure cost; dedicated all-target counter; mandatory chant | Other effects that explicitly waive chant remain pending |
| `a2-p10-r2c2` | 光流弓 — CardAll p.10 r2c2 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated damage; dedicated all-target path; target-local Gadyura doubling; front follower block | Fury's unrelated character abilities remain pending |
| `a2-p10-r2c3` | 星流弓 — CardAll p.10 r2c3 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated damage; mandatory chant despite no-checks; evade prohibition/extra maai through shared paths; dedicated effect-level destruction | Fury's unrelated character abilities remain pending |
| `a2-p10-r3c1` | 狼牙 — CardAll p.10 r3c1 | `effects/techniques.ts` → `combat/attack.ts` | ordinary near 2d6 and dedicated far 3d6; exact frozen rolls at damage window; extra maai | Yotsurm's reclaim and other character abilities remain pending |
| `a2-p10-r3c2` | 連槍撃 — CardAll p.10 r3c2, ruling T15 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary one-hit; dedicated explicit one/two-hit choices with the same dedicated package; invalid/mixed variant rejection; same-target grouping; front block and lower-front HP subtraction per hit | Independent future effects may add targets; this card itself does not split hits |
| `a2-p11-r1c1` | 竜殺天空槍 — CardAll p.11 r1c1, ruling T17 | `effects/techniques.ts` → `turns.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated damage; all received followers destroyed; dedicated all targets; explicit optional chant doubles; wrong-owner chant rejection | Lancaster's unrelated character abilities remain pending |
| `a2-p11-r1c2` | 妖撃破山剣 — CardAll p.11 r1c2, ruling T18 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | completed ordinary/dedicated attacks; ordinary and dedicated counter values; counter-only no-check path; both catalog Lancelot names | Lancelot character abilities and reclaim remain pending |
| `a2-p11-r2c1` | 光竜剣 — CardAll p.11 r2c1, ruling T20 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | Lancelot2 ordinary, explicit inherited-I effect7/damage10, explicit full-II effect8/damage15, and omitted backward-compatible default; invalid actor/package rejection | Character transformation handling remains pending; already-transformed card choices are complete |
| `a2-p11-r2c2` | 光竜破山剣 — CardAll p.11 r2c2, ruling T21 | `effects/techniques.ts` → `turns.ts` → `combat/attack.ts` → `combat/followers.ts` | Lancelot2 ordinary mandatory chant, explicit inherited-I 4d6+1 with chant, explicit full-II 25 with chant waiver, and indivisible-package rejection | Character transformation handling remains pending; already-transformed card choices are complete |
| `a2-p11-r2c3` | 撃戦斧 — CardAll p.11 r2c3 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated damage; fixed follower-Lv5 destruction distinct from effect level | Ramba's damage-doubling ability and reclaim remain pending |
| `a2-p11-r3c1` | 剛戦斧 — CardAll p.11 r3c1 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated damage; fixed follower-Lv6 destruction | Ramba's damage-doubling ability and reclaim remain pending |
| `a2-p11-r3c2` | 死戦斧 — CardAll p.11 r3c2 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary/dedicated damage; extra maai; dedicated all targets and fixed follower-Lv7 destruction | Ramba's damage-doubling ability and reclaim remain pending |
| `a2-p11-r3c3` | 滅殺斧 — CardAll p.11 r3c3 | `effects/techniques.ts` → `turns.ts` → `combat/attack.ts` | ordinary mandatory chant; dedicated effect/damage/all targets; printed chant and check waiver | Ramba's damage-doubling ability and reclaim remain pending |
| `a2-p12-r1c1` | 破山剣 — CardAll p.12 r1c1 | `effects/techniques.ts` → `combat/attack.ts` → `combat/followers.ts` | ordinary plus Lia/Lancelot/Lancelot2 dedicated values; effect-level AND black/death follower predicate | Lancelot's optional 白龍の剣 must remain a separate later character ability |
| `a2-p12-r1c2` | 破砕剣 — CardAll p.12 r1c2 | `effects/techniques.ts` → `combat/attack.ts` | ordinary damage and consumption; unprinted dedicated mode rejected before cost; cancellation consumes once | No card-local dependency |

Shared regressions also prove that follower processing stops once all live hits are blocked: an
adequate nonmatching front follower keeps a matching rear follower concealed and prevents its
destruction or morale roll, a single adequate front follower blocks both fixed hits, and a lower
front follower subtracts its HP from each hit before the rear follower receives them. Generic
`CHANT` now derives eligibility from supported technique descriptors. Its optional `dedicated`
field is backward-compatible and is needed only to select Lancaster's optional 竜殺天空槍 chant.
`ATTACK.techniqueVariant` is also optional and backward-compatible: it exposes 連槍撃's dedicated
one/two-hit choice and Lancelot2's inherited-I/full-II packages. Its four values are strictly
validated against the card, dedicated flag, and current catalog character before physical cost.

For 2d6, 3d6, and 4d6+1 damage, one JSON-safe authoritative record stores the stable action/event
identity, formula, exact die faces, modifier, and total. The attack group and every target hit share
that record ID while live; the record remains in game state after action/group cleanup and survives
JSON replay.

## Task 7c — direct magic techniques

These 28 physical cards use `effects/magic-techniques.ts` through the existing action/check/damage,
normal-defense, follower, hit, and cleanup continuations in `combat/attack.ts`. Real transitions in
`packages/engine/test/task7c-magic-techniques.test.ts` cover every ordinary attack and every printed
dedicated package, immutable wrong-owner/invalid-target rejection, chant/check rules, counter paths,
target-local 凍流 choices, follower predicates, 疫病 immunity, and frozen/shared damage. Protocol
validation for the explicit 凍流 choice is in `packages/protocol/test/validation.test.ts`. Catalog
entries remain pending and the production START gate is unchanged.

| Physical ID | Printed card and source | Handler/test coverage | Remaining dependency |
|---|---|---|---|
| `a2-p12-r2c2` | 氷矢 — CardAll p.12 r2c2 | ordinary/dedicated damage, all-target package, wrong owner | later character abilities/reclaim |
| `a2-p12-r2c3` | 凍流 — CardAll p.12 r2c3; T23 | ordinary/dedicated damage, extra maai, explicit per-target ignore/normal choice, reconnect, above-effect follower | later follower ignore-cancellation effects |
| `a2-p13-r1c1` | 氷狼乱舞陣 — CardAll p.13 r1c1; T25 | ordinary fixed-Lv5 destruction, dedicated effect-Lv destruction, evade and chant rules | later character abilities/reclaim |
| `a2-p13-r3c2` | 呪殺 — CardAll p.13 r3c2 | ordinary/dedicated damage, mandatory chant, maai prohibition | later character abilities/reclaim |
| `a2-p14-r1c1` | 疫病 — CardAll p.14 r1c1; T34 | non-death Lv6 destruction, death exemption through normal defense, Gadyura-only personal immunity | broader character immunities/statuses |
| `a2-p14-r1c2` | 白光 — CardAll p.14 r1c2 | effect-Lv black/death predicate and dedicated counter | later character abilities/reclaim |
| `a2-p14-r1c3` | 白輪 — CardAll p.14 r1c3 | unconditional black/death destruction and evade prohibition | later character abilities/reclaim |
| `a2-p14-r2c1` | 天舞 — CardAll p.14 r2c1 | ordinary attribute destruction, dedicated all-follower destruction, chant and maai prohibition | later character abilities/reclaim |
| `a2-p14-r2c3` | 神罰 — CardAll p.14 r2c3 | ordinary counter/attack and Jill/Uunos dedicated counter/attack packages, mandatory chant | later character abilities/reclaim |
| `a2-p14-r3c3` | 風矢 — CardAll p.14 r3c3 | ordinary/dedicated damage and all-target package | later character abilities/reclaim |
| `a2-p15-r1c1` | 魔風 — CardAll p.15 r1c1 | ordinary/dedicated damage and evade prohibition | later character abilities/reclaim |
| `a2-p15-r1c2` | 雷走 — CardAll p.15 r1c2 | ordinary/dedicated damage and evade prohibition | later character abilities/reclaim |
| `a2-p15-r1c3` | 裂風 — CardAll p.15 r1c3 | extra maai and concealed 空-follower bypass with front-to-back reach | later follower ignore-cancellation effects |
| `a2-p15-r2c1` | 撃雷 — CardAll p.15 r2c1; T38 | ordinary four-target maximum, dedicated nonempty subset, non-建 destruction, invalid ally/target pre-cost | later character abilities/reclaim |
| `a2-p15-r3c2` | 炎矢 — CardAll p.15 r3c2 | ordinary/dedicated damage and all-target package | later character abilities/reclaim |
| `a2-p15-r3c3` | 炎流 — CardAll p.15 r3c3 | ordinary/dedicated damage and extra maai | later character abilities/reclaim |
| `a2-p16-r1c1` | 炎舞 — CardAll p.16 r1c1 | ordinary/dedicated damage and evade prohibition | later character abilities/reclaim |
| `a2-p16-r1c2` | 爆炎 — CardAll p.16 r1c2 | ordinary/dedicated damage and all-target package | later character abilities/reclaim |
| `a2-p16-r1c3` | 烈火 — CardAll p.16 r1c3 | ordinary mandatory chant, dedicated chant waiver, extra maai | later character abilities/reclaim |
| `a2-p16-r2c1` | 妖獣 — CardAll p.16 r2c1 | ordinary/dedicated damage and white-follower destruction | later character abilities/reclaim |
| `a2-p16-r2c2` | 餓狼 — CardAll p.16 r2c2; T42 | effective caster magic-Lv×2 frozen at damage boundary and shared across targets | later character abilities/reclaim |
| `a2-p16-r2c3` | 地槍 — CardAll p.16 r2c3 | ordinary/dedicated damage with unchanged effect Lv | later character abilities/reclaim |
| `a2-p16-r3c2` | 地流 — CardAll p.16 r3c2 | ordinary/dedicated damage with unchanged effect Lv and extra maai | later character abilities/reclaim |
| `a2-p17-r1c2` | 呪歌 — CardAll p.17 r1c2; T46/G13 | follower bypass, shared durable 1d6×2/×4 record, dedicated prohibition of all 反 defenses | later character abilities/reclaim |
| `a2-p17-r2c1` | 衝破 — CardAll p.17 r2c1 | ordinary damage; unprinted dedicated rejection | no card-local dependency |
| `a2-p17-r2c2` | 魔衝破 — CardAll p.17 r2c2 | ordinary damage; unprinted dedicated rejection | no card-local dependency |
| `a2-p18-r1c2` | 紋竜破 — CardAll p.18 r1c2 | near-range mandatory chant, counter prohibition, unprinted dedicated rejection | no card-local dependency |
| `a2-p18-r1c3` | 地裂 — CardAll p.18 r1c3 | one/two-target ordinary damage and unprinted dedicated rejection | no card-local dependency |

The shared view projects effective maai, 見切り, and counter prohibitions from the declared attack.
It does not project hidden follower levels or attributes. `CHOOSE_FOLLOWER_BYPASS` accepts an explicit
boolean only during the persisted attacker choice window; `PASS` records the normal-processing default.
Existing `TechniqueVariant` values remain unchanged and strict.

## Task 7d — durable roll/check continuations

`rolls/frames.ts`, `rolls/advance.ts`, `rolls/action-values.ts`, and
`rolls/turn-continuations.ts` provide persisted roll identity, exact formulas/faces,
original and rerolled attempts, a durable forced-failure latch, and typed parent resumes.
Checks freeze current spirit and applicable modifiers when the before-roll window closes;
all results remain unapplied through an after-roll window. A waived check creates no roll.

| Source / family | Implemented boundary and verification |
|---|---|
| G03–G08, G18; activation, excess-level use, teleport and counter checks | Persisted before/after windows; public priority; late threshold freeze; JSON replay; accepted full-roll reroll only; existing action result compatibility |
| `a2-p02-r1c3` 神性介入 | Explicit current `targetRollId`; cancelable paid declaration; full 2d6/sum/multiplier reroll; retained attempts and parent generation reset; G06 source/player/event limit |
| `a2-p02-r2c3` 命運凶変 | All current check continuations accept durable force-fail; numeric amounts reject it before cost; cancelable force-fail child and revealed Arseil cancellation preserve normal outcomes |
| `a2-p05-r2c3` 必勝の祈り | Delayed and rerollable d6 addition; parent effect unchanged until result finalization; ordinary compound consumes without immediate refill; Lia dedicated anytime use replaces one card and reserves reclaim until parent-event cleanup |
| Random attack values | Shared hit-count d6 and damage d6×2/×4/×5, 2d6, 3d6, 4d6+1; canceled declarations generate no random effect; all targets/hits consume the same finalized value |
| G14 follower morale | One before/after check per reached follower per simultaneous hit set; persisted front-to-back cursor, pending destruction list and per-hit values; retained physical cards until the complete follower set is evaluated; front blocking leaves rear followers concealed |
| 沈黙 on-hit resistance | Reveal on hit, pause resistance before status/damage application, resume once; public parent attack remains available |
| G17 status recovery | One persisted check per effect, all effects checked after an earlier failure, nextCheck advanced once per result, skip only after all decisions, stopped-clear refill only after all stopped effects clear |
| 回復の薬 | Each paid potion has its own persisted numeric recovery result; damage and physical cleanup occur only when final; multiple potion continuation retains remaining card IDs |

New authoritative snapshot fields are `GameState.rolls`, `GameState.turnRoll`, window
`continuation.kind = 'roll'`, action check specifications and roll IDs, and follower/hit
cursors and completion markers. `rolls` retains the full authoritative history; the existing
`randomRolls` export remains a compatibility record for finalized attack damage. No functions,
closures, or fresh entropy are needed to restore these fields. Existing in-flight snapshots
that predate these fields require an explicit migration or a clean game; schema/version
upgrade machinery is outside this slice and no transparent upgrade is claimed.

The exported `PublicRollView` is an explicit allowlist used for both `currentRoll` and the
latest 30 `recentRolls`. Concealed rollers' thresholds and success flags are omitted for other
viewers, including historical attempts. The projected modifier is only the printed modifier
or public numeric formula operand; derived spirit/morale bonuses, private status source IDs,
and raw continuation frames are never projected. `reactionTargetRollId` is available only
for the top unresolved result; an underlying result may remain visible while its reaction
child is declared. Incoming attack context remains public during defense and follower rolls.

`packages/engine/test/task7d-rolls.test.ts` covers these transitions, nested cancellation,
exact over-limit replacement plus OPEN draws, retained prayer reservations, counter-parent
G06 identity, privacy, and repeated JSON replay with physical-card conservation. Existing
timing-sensitive tests now provide entropy and assert final rules at the actual persisted
boundaries. Protocol tests retain strict TechniqueVariant handling and reject mixed
roll/action target shapes. Catalog implementation flags and the production START gate remain
unchanged. Remaining character abilities, lifecycle/death-group commit, new status techniques,
and unrelated anytime effects are still pending.

## Task 7e — resistance/status attacks and fixed defenses

`combat/hits.ts` now resolves one target-local resistance after the target's follower snapshot and
before final damage. The result is shared by every live hit for that target in the attack group:
base hit damage remains per hit, while a printed conditional addition is charged once. Failed
persistent effects retain the physical source card, source actor, receiving target, exact modifier
sequence, and next recovery index. Separate sources stack; the same group does not duplicate one
effect per hit. Null printed damage remains null until an explicit failed-resistance damage effect
such as 幻矢 creates damage 10.

| Physical ID | Printed card and source | Implemented boundary and verification |
|---|---|---|
| `a2-p09-r2c3` | 血流 — CardAll p.9 | GOOD prohibition; mandatory chant; ordinary -2/+10; Gaina no-check/all-target/-3 dedicated package |
| `a2-p12-r3c1` | 毒流 — CardAll p.12 | target resistance; failure-only +6; Aiel effect Lv6/no-check/all-target package |
| `a2-p12-r3c3` | 氷結 — CardAll p.12 | stopped status; ordinary -1 and Aiel fixed -3; dedicated effect Lv8/damage8/all targets |
| `a2-p13-r1c2` | 錯乱 — CardAll p.13; T26/G09 | ability-disabled status distinct from stopped; ordinary -2/-1; Arseil fixed -2 and receiving-target follower destruction |
| `a2-p13-r1c3` | 鏡封 — CardAll p.13 | stopped status with repeated -2; Arseil effect Lv7/no-check/all targets |
| `a2-p13-r2c1` | 催眠 — CardAll p.13 | stopped status with -2/-1; Arseil effect Lv5/no-check/all targets |
| `a2-p15-r2c2` | 悪夢 — CardAll p.15 | maai prohibition, follower bypass, stopped status; Asfelt-only repeated -2; Dia shared 2d6-sum×2 damage with whole-roll rerolls |
| `a2-p16-r3c1` | 植縛 — CardAll p.16 | stopped -3/-2/-1/0 sequence; Ramba no-check/all-target package |
| `a2-p17-r1c1` | 魔詩 — CardAll p.17; T45 | stopped -3/-2/-1; Lester fixed -3, effect Lv6/damage7, follower bypass without destruction |
| `a2-p17-r2c3` | 幻矢 — CardAll p.17 | follower bypass; failed -1 resistance creates one damage10 result from printed null damage |
| `a2-p17-r3c1` | 狂王陣 — CardAll p.17 | damage5, counter attribute, stopped -2/-1/0 sequence |
| `a2-p17-r3c2` | 神王界 — CardAll p.17; T48/G13 | magic-only fixed effect-Lv6 ceiling; no ordinary counter comparison; one-hit reflection with lineage and inherited finalized roll |
| `a2-p18-r2c2`, `a2-p18-r2c3` | 結界 — CardAll p.18; F05/F06 | separate physical copies; dynamic use Lv from incoming magic; one own-hit negate; failed check consumes and resumes parent defense |
| `a2-p10-r3c3` | 閃光槍 — CardAll p.10; T16 | ordinary comparison unchanged; Lancaster's dedicated defense accepts any incoming Lv, returns fixed Lv6/damage7 only on a spirit-check success, and adds follower bypass only to that returned attack |

`PersistentStatus.kind` now includes `ability-disabled`. The exported
`canUseCharacterAbility(player)` guard rejects stopped or ability-disabled character abilities and
is applied to Arseil's existing fate-cancellation ability. Character-limited card packages remain
legal while ability-disabled. Stopped players cannot start attacks, approach/withdrawal card
actions, hand-card reactions, ordinary defenses, distance responses, or other turn card actions,
while `PASS`, public reveal, and follower defense stay legal. Silence blocks magic technique use,
including magic defenses, activation from chant, and new magic `CHANT` placement. New warrior
chants remain legal, and already placed magic chants stay in place until silence recovery permits
their use. Once combat has fully ended, stopped `PASS_ACTION` and `PASS_WITHDRAWAL` are
administrative completion commands: they advance directly to the next seat's `turn-start` without
discard or refill. A restored stopped `hand-adjustment` snapshot accepts a normally validated
`END_TURN`, also advancing without refill, so no advertised completion choice can softlock the
turn.

Each `PublicPlayerView` exposes an allowlisted `statuses` array containing kind, current recovery
modifier/index, and optional public source actor/card metadata. Internal status IDs, full future
modifier sequences, target bookkeeping, thresholds, and concealed check results are omitted.
Legacy persisted statuses without source metadata project safely without fabricating identity.

`packages/engine/test/task7e-status-defenses.test.ts` covers ordinary and exact-owner dedicated
transitions, immutable wrong-owner/restriction rejection, every printed modifier sequence,
conditional success/failure damage, recovery progression, both 結界 copies, failed-defense parent
recovery, counter prohibition, Lancaster high-Lv success/failure, public privacy, JSON replay, and
physical-card conservation. It also covers stopped approach/withdrawal rejection before cost,
magic-only chant rejection under silence with warrior chant acceptance, and the one-resistance/
one-addition/one-status invariant on an explicitly composed shared multi-hit group. Catalog
implementation flags and the production START gate remain unchanged. 影分身, 木の葉隠れ, 治癒,
封傷, 魔招門, otherworld/death/lifecycle work, and broader character abilities remain scheduled for
later slices.

## Task 7f — persisted lifecycle, OPEN continuations, and stable outcomes

`packages/engine/test/task7f-lifecycle.test.ts` exercises real attacks, draws, turn-end/recovery
refills, reaction acceptance, optional revival and re-setup, physical gift/ritual declarations,
and stable public outcomes. Every accepted helper transition is compared with a JSON-restored
transition using identical entropy, and checks the exact physical-card multiset including
resolution/reclaim/distance reservations. Strict lifecycle command parsing is covered in
`packages/protocol/test/lifecycle.test.ts`. The root task owns Worker/browser integration.

| Source / physical identity | Executable paths | Remaining dependency |
|---|---|---|
| G08, G12, G14–G18 | `lifecycle/advance.ts`, `combat/hits.ts`, `combat/attack.ts`: simultaneous group damage commit, typed explicit instant-death/self-damage intents, pending death, clockwise gift/disposal, opposite-owned distance-marker disposal, reflected-child continuation, inactive response/turn cleanup | Future lethal/self-cost cards call the shared settlement API; their individual card effects are not covered by this infrastructure |
| A17 `a2-p02-r3c2` and A18 `a2-p02-r3c3` | Faction-specific physical gift cost, distinct remaining private hand card, no immediate refill, living/nonpending recipient, cancellable declaration, failed gift retained until death disposal | Chaum's separate C11 death-gift ability is deliberately deferred; it is not auto-activated or claimed covered |
| A01 `a2-p01-r1c1` | Every draw site queues a saved continuation. OPEN snapshots dead actors; each has a saved fixed-threshold-4 d6 check, whole-roll God reroll and persistent Fate force-failure; eligible dead actor chooses revive/refuse; death identity and permanent/use histories survive; initial-five/follower re-setup and protector-return re-setup precede the interrupted next draw | Other explicit resurrection cards/character abilities remain pending |
| A02 `a2-p01-r1c2` | OPEN remains placed while the discard/deck are shuffled excluding reservations; otherworld return preserves unrelated stop and does not refill solely for return; nested Dawn during revived initial setup | Actual 裂界 attack/banishment remains in the next lifetime-card slice |
| G16, all 24 ordinary Character(A4) identities | Exact typed initial protection map; any named assigned death fails protection, absent characters do not; replacement allegiance replaces protection with mandatory faction restrictions; wandering returns hand/chants/followers to shuffled deck, retains inactive OPEN/attachments; return re-setup preserves histories | Individual conversion abilities/cards and their declaration/result validation remain pending |
| C13 Lancelot / Lancelot2 (`c2-p02-r2c2`, `c2-p07-r1c1`) | Optional boundary transformation after public Lia, G09 suppression, retained damage/possessions/history and inherited ability identity | Shared character-ability declaration/cancellation completed in Task7h below; all other Lancelot ability effects remain pending |
| A37 `a2-p05-r1c1`, Uonos / Vanmil | Root turn-action ritual declaration/cancellation, public transformed character, base endurance25/full recovery/new faction/objective, no inherited Uonos abilities; Dia card-specific transfer requires public active Uonos, no refill/reveal/ordinary card or ability cancellation | Other Uonos/Dia abilities remain pending |
| C08/C13 Vanmil subordinates, Arseil conspiracy, Vanmil death | Optional explicit awakening-boundary effect choices; subordinates update current and death-time Dia/Yotsurm allegiance/protection; Arseil personal victory/exit; mandatory Vanmil death awards non-Vanmil participants including dead/wandering and retains prior personal wins | Shared character-ability declaration/cancellation completed in Task7h below. Vanmil suppression ability and other Vanmil/Arseil abilities are not implemented |
| G15, MadoRule p6 §10 | Stable outcomes wait for children, mandatory draws/OPEN, gifts, re-setup, reclaim and protection; simultaneous extinction draw; immutable post-outcome command rejection; initial same-faction deal waits for every public identity and setup completion | Formal START remains gated by full catalog/ability completion |

Source interpretation recorded for integration: ordinary GOOD/EVIL typed objectives contain
only the printed opposite faction. MadoRule p6 §10 says the character card's objective is the
victory condition; no source in this slice silently adds Vanmil to those printed lists. A surviving
third faction can therefore coexist with an ordinary faction's completed printed objective.
Otherworld is living and not wandering (G15), so it both blocks enemy extinction and can satisfy
its own objective. Gift declarations are children of the death-gift window and start after the
speaker (G03's child-origin sentence); root ritual declarations start at the current turn seat.

Lifecycle optional effects above are dependency scaffolding with working state changes, not
claims that all special-ability timing/cancellation is finished. All catalog implementation flags
and the production START gate remain unchanged. Pre-release saved fixture schema now records
`initialFactions`, typed current objective/protection, and persisted lifecycle continuations; a
production migration policy is still required before an upgrade of deployed live matches.

### Task 7f review fix1

The accepted G15 provisional no-turn supplement is implemented after all pending work and
ordinary/special winner checks: opposing living otherworld survivors with no normal-turn actor
and no winner produce `outcome.kind: draw`, `reason: stalemate`. Presence stays unchanged,
prior individual wins remain `won`, and no future card is drawn to seek an escape. An active
stopped actor still has recovery/elapsed turns and therefore prevents this stalemate condition.
This is distinct from mutual extinction and does not remove otherworld actors from living counts.

A17/A18 gift recipient validation and projection now share the owning persisted death batch's
full `actorIds` exclusion. A disposed victim revived by a nested Fate-refill/FuSen cannot receive
a later gift from the same batch. The check applies at acceptance and resolution, including a
restored historically accepted action, and invalid commands leave cost/state/revision unchanged.
`packages/engine/test/task7f-fix1.test.ts` covers both review findings with real death settlement,
nested cancellation/refill/roll/revival/re-setup, exact220 conservation and JSON restoration.

## Task 7g — lifetime-dependent printed techniques

Source: adopted T12, T29–33, T35, T37, T39–41 and F04; the eleven exact physical
records are captured in `.superpowers/sdd/2026-09-07-online-game/task-7g-source-cards.json`.
`packages/engine/test/task7g-lifetime.test.ts` exercises actual accepted declarations,
rolls, defenses, choices, death batches, draws and re-setup. Its ordinary/dedicated
mode matrix checks saved printed values before consuming the actual physical card.
Every accepted helper transition is compared with JSON restoration and preserves the
physical-card multiset; exact 220 unique cards are additionally asserted in the matrix.
Catalog implementation flags and the production START gate remain pending.

| Physical card | Ordinary executable mode | Dedicated executable mode | Separate character dependencies |
|---|---|---|---|
| `a2-p09-r3c1` 死刻鎌 | Warrior7, damage8, far, chant retained, evade prohibited | Gadyura explicitly selected: no use checks, arbitrary legal target set, optional per-hit spirit−2 instant-death intent; decline keeps ordinary8 | Other Gadyura abilities and generic ability cancellation |
| `a2-p12-r2c1` 治癒 | Warrior5 checked turn technique, explicit self only, full damage recovery; warrior use survives silence | None printed | Generic ability interactions remain separate |
| `a2-p13-r2c3` 滅界 | Magic10, damage20, chant, target followers destroyed, only teleport/counter/ability defenses; accepted declaration retains independent own followers+10 through check failure, cancellation, nested-counter cancellation and simultaneous death | Explicit Vanmil mode omits only self damage (no zero-damage intent), retains own follower destruction and checks/chant | Vanmil special defenses/abilities remain separate |
| `a2-p13-r3c1` 復活 | Magic10 checked, mandatory chant, exactly one explicit dead target; restore death identity, zero damage, initial-five/follower setup, history retained | Uonos explicit no-chant/no-check selected dead subset; optional conversion of selected eligible subset copies resolution-time faction/objective/protection, with exact15 flexible,2 conditional and9 fixed identities | Other resurrection abilities; generic ability cancellation |
| `a2-p13-r3c3` 封獄死霊陣 | Magic8, damage10, GOOD prohibition, no maai, effect-level-or-lower follower destruction | Uonos no use checks/all selected targets; explicit per-hit stop choice, one shared interruptible d6, independent recipient/source counters; no ordinary recovery check | Other Uonos abilities; whole-turn-skip producers remain separate |
| `a2-p14-r2c2` 裂界 | Magic7, damage8, chant, up to3, follower-ignore, target-local spirit0; failed hit banishes while retaining possessions and clearing distances | Shelim effect8/damage12/no use checks/all selected targets; explicit optional spirit−3 (decline uses0) | Other Shelim abilities |
| `a2-p14-r3c1` 封傷 | Magic5 checked turn technique, explicit self recovery, silence enforced | Jill replaces target with exactly one active other near person; revalidate at resolution, no self fallback/refund/check waiver | Other Jill abilities |
| `a2-p14-r3c2` 封傷 | Same physical-duplicate handler and real ordinary transition | Same dedicated target validation and invalidation path | Other Jill abilities |
| `a2-p15-r2c3` 吸魂 | Magic7, near, no direct damage, spirit−1; all3 future derived stats fall together, accumulate/min0, survive transformation, clear on death independently of permanent/use history | Dia effect8/far/follower-ignore/all/no use checks; failed resistance explicitly chooses stat loss OR instant death; full healing only after actual death and if source was not simultaneously pending-dead | C12 numeric damage drain is separate; other Dia abilities |
| `a2-p15-r3c1` 死心盗 | Magic7, chant, no direct damage, spirit−1; linked stop and next actual recovery check; success removes whole status, failure instant death | Dia effect8/follower-ignore/all/no use checks; both modifiers−3, chant retained | Whole-turn-skip effect producers and other Dia abilities |
| `a2-p18-r2c1` 石化 | Magic7/damage5/earth/chant; only an actual hit rolls spirit0; failed resistance and damage commit together, durable petrification provenance, ordinary resurrection allowed | None printed | Separate explicit resurrection prohibitions when implemented |

The public API adds `PLAY_TURN_TECHNIQUE`, `CHOOSE_LIFETIME_EFFECT`, private
`lifetimeDecision`, tagged fixed/deadly/drain status views, and the printed
`limitedDefenses` allowlist for 滅界. Existing recovery views retain their prior fields.
`PLAYER_DIED.death` durably records the accepted cause/event and public source IDs.
Otherworld participants remain living and must still pass their own protection defeat
conditions. Actual Dawn returns all participants together in current-turn seat order,
before its shuffle body, with no return-only refill or unrelated status reset.

Duration and deadly recovery use separate persisted contracts. `skipTurns` is an internal
whole-turn-skip consumer for future accepted effect producers, with no client command:
fixed counters advance once at each completed arriving turn, while skipped recovery
obligations remain pending. Explicit status removal naturally removes the linked deadly
obligation. Source-dependent stat drain is applied after its failed hit before later
unexecuted checks; saved numeric attack and already-fixed roll results are not rewritten.

Final engine/protocol verification: **532 engine +58 protocol =590 tests PASS**,
23 files; root `tsc --noEmit` PASS. Browser/Worker integration is verified separately
by the root task. Remaining composition techniques, followers, 110 character abilities,
full production acceptance and deployed-state migration policy are not claimed complete.


## Task7h — saved optional declarations and seven executable ability paths

Source records are unchanged `data/second-edition/characters.json` and G03–G09,
G14–G18, C09/C13, A15. `abilities/frames.ts` and `abilities/advance.ts` provide a
separate tagged source, exact target event, acceptance costs/ordinal, saved roll IDs,
parent continuation and declaration cancellation. Canonical IDs stay private while
concealed; public declarations expose opaque use IDs and a generic label. New
attack/hit opportunities depend on public combat progression, with legal options
projected only to the owning player. There is no synthetic physical ability card.

| Canonical ability | Executable behavior | Covering real transitions | Remaining dependencies |
|---|---|---|---|
| `c2-p02-r2c2-ab05` 姫への愛 | Cancellable optional transformation, once-game attempt consumed on acceptance; public Lia revalidated; retained damage, allegiance/history and inherited source identities | `task7h-abilities.test.ts`, adapted `task7f-lifecycle.test.ts` and `task7g-lifetime.test.ts` | Other Lancelot abilities/reclaim |
| `c2-p07-r1c2-ab04` 破壊神の下僕達 | Cancellable awakening event declaration; acceptance consumes attempt; permanent allegiance/protection outcome retained | Accepted/canceled boundary paths; live state validation and no same-event retry | Vanmil suppression and other optional abilities |
| `c2-p04-r2c1-ab04` 陰謀 | Cancellable awakening declaration; accepted attempt consumed; only resolved effect exits/wins | Accepted/canceled boundary paths and personal result retention | Other Arseil abilities |
| `c2-p04-r2c2-ab01` 影分身 | Own spirit−2 then enemy spirit−2 only on own success; enemy failure negates that incoming hit and offers one physical child attack; ordinary range/chant/use costs, no approach/withdrawal | Failed/self/enemy checks, optional non-counter attack, declined child, independent multi-hit attempts, saved parent continuation | Dedicated 影分身 technique remains a separate card task |
| `c2-p04-r2c2-ab02` 忍び | Explicit optional martial group declaration before followers; resolved contribution ignores followers while source remains enabled | Elected/declined/canceled use; suppression restores normal followers without changing frozen technique values | Other attack modifier abilities |
| `c2-p04-r2c2-ab03` 必殺 | Per-actual-warrior-hit optional whole2d6; equal faces pending instant death, absolute difference1 doubles that hit after follower reduction; 1/6 unchanged; numeric null retained; no endurance cost | Numeric God reroll, numeric Fate rejection, canceled attempt budget, multiple hit/target batch deaths, one normal budget and explicit future total-two budget | 裏天空剣 not implemented; its future producer may grant total2, including normal1 |
| `c2-p04-r2c2-ab04` 隠行 | Own action pays one physical 間合い at acceptance, no refill; heal2 capped by damage, explicit optional conceal; invalid source/cost/event rejected before payment | Cost/action retained on cancellation/suppression; hidden self/other view and no manufactured reveal | Other own-action abilities |

Fate has separate typed card-cancel, ability-cancel and check-failure targets.
Before/after check failure and whole-roll God rerolls use existing durable roll
machinery. Legal Arseil printed Fate cancellation restores the parent ability,
including nested OPEN/refill; it remains neither a catalog ability nor a hand-card
declaration and is unaffected by ability-disabled. The catalog contains only one
physical Fate, so a duplicate physical Fate child is rejected rather than invented.
Mandatory Vanmil 終末 (`c2-p07-r1c2-ab05`) remains outside optional cancellation and
continues to end the game despite ability-disabled.

Every accepted covering fixture transition compares JSON-restored replay and the
unique 220-card multiset. Full 110-ability completion, composition techniques and
formal START remain pending; this section claims exactly the seven paths above.

## Task7i — remaining ten combination and defense techniques

All ten physical sources below now have ordinary/dedicated real-transition coverage in
`packages/engine/test/task7i-combinations.test.ts`, with strict wire cases in
`packages/protocol/test/task7i-combinations.test.ts`. The common helper replays every accepted
step from JSON using identical entropy and checks the exact conserved 220-card multiset.
The registry remains bounded: no catalog implementation flags or production START gate changed.

| Physical source | Implemented printed package and adopted ruling | Executable evidence |
|---|---|---|
| `a2-p08-r1c2` 黒翼天翔剣 | Ordinary 7/12, chant, two maai; elected Arnes effect8/damage15/no-check/follower-ignore; one explicit post-hit 5k advance batch, only pending hits, modifier before multiplication (T02) | Ordinary/dedicated outcomes; real maai/follower handling; immutable batch costs; partial finalized-target and multiplier regression |
| `a2-p08-r3c1` 裏天空剣 | Ordinary near5/5; elected Ida no-check/follower-ignore; two total optional actual 必殺 attempts per hit, zero endurance cost (T04/C09) | Two consecutive pairs ×4; canceled first attempt; whole second God reroll; no third attempt; ability suppression independent from printed source |
| `a2-p08-r3c2` 影分身 | Ordinary fixed defense, enemy spirit−1, Shin automatic success; elected Ida non-Shin negate and optional physical child attack (T05) | Ordinary resistance; Shin exception; printed ActionFrame grant with no fabricated ability; child cost/cancellation/no extra turn; generic ability path retained |
| `a2-p09-r1c1` 獣王剣 | Ordinary6/10; elected Upa beast destruction/no-check/optional one physical warrior co-source. Attack and defense entries pay both sources; component printed useLv ≤ current warrior; base6, one damage sum, inherited restrictions/effects (T07–08) | Formula sum and shared multi-hit, null component, source history and numeric provenance through counter child, cancellation, ordinary Lv6 counter, banned/insufficient components, incoming-use parry component |
| `a2-p09-r1c3` 黒竜剣 | Ordinary near5/6 and white destruction; elected Garwin effect6/10 plus explicit optional spirit check for group damage×2 (T09) | Decline/success/forced failure, nested God/Fate, once-only saved result and ordinary/dedicated follower destruction |
| `a2-p09-r2c1` 魔空剣 | Ordinary6/10 white destruction/evade ban; elected Garwin effect7/damage15/all/no-check plus declaration advance batch effect+count (T10) | Acceptance payment, no refill/distance marker, cancellation retains batch, ordinary target restriction, evade and white-follower cases |
| `a2-p09-r2c2` 竜王爆砕剣 | Ordinary8/10; elected Gainas all/no-check, shared predefense d6 extra maai, per-target fixed6 2d6 resistance/×3 on fail and next whole turn skip (T11) | Shared saved die; fixed threshold; coalesced skip; real skipped-turn fixed-stop expiry and delayed deadly recovery; public boolean skip projection |
| `a2-p13-r2c2` 木の葉隠れ | Ordinary magic3 fixed defense/enemy spirit−1; fire/wind declaration ban; elected Ida auto-negation without Shadow's Shin exception or attack grant (T27–28) | Ordinary enemy roll, dedicated negate, fire rejection before payment, no outgoing damage |
| `a2-p16-r3c3` 光王陣 | GOOD-only own-spirit use/effectLv, non-Lia prerequisite−2, whole max(10,d6×d6) roll; ordinary Lv defense without return; elected Lia separate frozen whole-other-hit substitution with one−3 check then one own-value return (T43–44) | Ordinary/dedicated defense, Lv/faction/counter bans, success/failure/cost, own/follower cutoff, frozen set, whole God reroll, source lineage, no inherited follower-ignore |
| `a2-p17-r1c3` 死歌 | Ordinary magic7/2d6×2/chant/follower-ignore; elected Lester effect8/currentmagic×3/all/no-check/counter-ban; actual Gadyura hit own spirit0 resistance once per group (T47) | Ordinary/dedicated damage and follower bypass; source chant/silence; target resistance success/failure without hidden character metadata; group simultaneous death settlement |

General character-owned technique reclaim is still pending. Both composite physical uses are
recorded separately and discarded separately; composition does not claim a blanket two-card reclaim.
The remaining follower dependency includes all 40 full follower placement/removal/attack packages
and 魔招門. Generic 110-character-ability completion remains outside this slice. T08 composition
and T43–44 Lia substitution remain major provisional rulings requiring independent review.

### Task7i fix1 — source authority, relative defense limits, exact granted attacks

Independent review findings I1/I2 are covered by real transitions in
`packages/engine/test/task7i-fix1.test.ts`. Beast components now require actual printed 戦
classification/use-Lv, or an explicit supported mixed-card warrior attack mode. Generic 見切る
is rejected and unoffered; real 踏み込み／弓 and received-warrior dynamic 受け流し remain legal.

Mirror Shield retains its printed relative warrior/magic offsets. A composed ordinary Mirror
uses composite effect6 for warrior6/magic7 limits, and recomputes the same relative references
at the effect-level freeze after Prayer. Actual fixed 神王界 limit6 remains fixed. Shared
pure defense validation is used for both candidate projection and actual declaration.

`PlayerView.additionalAttackOptions` is an exact private candidate array for the owner's actual
printed-card or character-ability grant. The same pure source/target validation handles ATTACK
acceptance and candidate enumeration, including dedicated/variant packages, prepared chants,
range/faction/silence restrictions and complete co-source selections. Tests submit every offered
candidate from saved real grant states, reject unavailable near/chant packages, preserve own
hidden-source privacy and JSON/220-card replay, and distinguish inherited/full-II chant packages.

## Task7j — physical follower defense/placement and 魔招門

The forty physical sources below use exact catalog stats with typed defensive rules in
`effects/follower-descriptors.ts`, one placement predicate in `combat/follower-placement.ts`,
and frozen source/hit continuations in `combat/followers.ts`. Every physical source has an
actual final-defense transition (in addition to printed-stat assertions) in
`physical-followers.test.ts`. `follower-continuations.test.ts` covers nested reflection,
saved morale, conditional levels, upper-bound revival, and independently labeled synthetic
heterogeneous consumer fixtures. These fixtures do **not** claim the C10 producer exists.

| Physical source | Defensive/placement clauses covered | Remaining source dependency |
|---|---|---|
| `a2-p18-r3c1` ゴブリン | printed Lv/HP/attributes | applicable character abilities and reclaim |
| `a2-p18-r3c2` 市民 | printed Lv/HP/attributes | applicable character abilities and reclaim |
| `a2-p18-r3c3` 兵士 | printed Lv/HP/attributes | explicit attack conversion / applicable character ability and reclaim |
| `a2-p19-r1c1` 民兵 | printed Lv/HP/attributes | applicable character abilities and reclaim |
| `a2-p19-r1c2` オーク | printed Lv/HP/attributes | explicit attack conversion / applicable character ability and reclaim |
| `a2-p19-r1c3` 砦 | printed Lv/HP/attributes | applicable character abilities and reclaim |
| `a2-p19-r2c1` スケルトン | printed Lv/HP/attributes; group-end bounded revival | explicit attack conversion / applicable character ability and reclaim |
| `a2-p19-r2c2` 辺境警備隊 | printed Lv/HP/attributes | explicit attack conversion / applicable character ability and reclaim |
| `a2-p19-r2c3` ウッドゴーレム | printed Lv/HP/attributes; spirit pass without HP/destruction | explicit attack conversion / applicable character ability and reclaim |
| `a2-p19-r3c1` 城 | printed Lv/HP/attributes | applicable character abilities and reclaim |
| `a2-p19-r3c2` 小悪魔 | printed Lv/HP/attributes; conditional fixed level | explicit attack conversion / applicable character ability and reclaim |
| `a2-p19-r3c3` ゾンビー | printed Lv/HP/attributes; group-end bounded revival | explicit attack conversion / applicable character ability and reclaim |
| `a2-p20-r1c1` 傭兵 | printed Lv/HP/attributes | explicit attack conversion / applicable character ability and reclaim |
| `a2-p20-r1c2` 黒騎士団 | printed Lv/HP/attributes | explicit attack conversion / applicable character ability and reclaim |
| `a2-p20-r1c3` 聖騎士団 | printed Lv/HP/attributes | explicit attack conversion / applicable character ability and reclaim |
| `a2-p20-r2c1` 歌う船 | printed Lv/HP/attributes; reached own earth-magic nullification | explicit attack conversion / applicable character ability and reclaim |
| `a2-p20-r2c2` 小天使 | printed Lv/HP/attributes; conditional fixed level | explicit attack conversion / applicable character ability and reclaim |
| `a2-p20-r2c3` ストーンゴーレム | printed Lv/HP/attributes; spirit pass without HP/destruction | explicit attack conversion / applicable character ability and reclaim |
| `a2-p20-r3c1` グリフォン | printed Lv/HP/attributes; saved exact morale modifier; explicit own defensive package | explicit attack conversion / applicable character ability and reclaim |
| `a2-p20-r3c2` アルケミア城 | printed Lv/HP/attributes; faction placement/maintenance | applicable character abilities and reclaim |
| `a2-p20-r3c3` ガイナス城 | printed Lv/HP/attributes; explicit own defensive package; faction placement/maintenance | applicable character abilities and reclaim |
| `a2-p21-r1c1` ワイト | printed Lv/HP/attributes; group-end bounded revival | explicit attack conversion / applicable character ability and reclaim |
| `a2-p21-r1c2` 王立騎士団 | printed Lv/HP/attributes; saved exact morale modifier; explicit own defensive package; automatic per-hit reflection / physical lineage | explicit attack conversion / applicable character ability and reclaim |
| `a2-p21-r1c3` 有翼族 | printed Lv/HP/attributes; saved exact morale modifier; explicit own defensive package; reached own earth-magic nullification | explicit attack conversion / applicable character ability and reclaim |
| `a2-p21-r2c1` 闇の聖女 | printed Lv/HP/attributes; conditional fixed level; mandatory voluntary-removal restriction | explicit attack conversion / applicable character ability and reclaim; Dia optional enemy bypass |
| `a2-p21-r2c2` 女性親衛隊 | printed Lv/HP/attributes; saved exact morale modifier; explicit own defensive package; whole-column ignore cancellation | explicit attack conversion / applicable character ability and reclaim |
| `a2-p21-r2c3` 小人族 | printed Lv/HP/attributes; saved exact morale modifier; explicit own defensive package | explicit attack conversion / applicable character ability and reclaim |
| `a2-p21-r3c1` 竜王教団 | printed Lv/HP/attributes; saved exact morale modifier; conditional fixed level; explicit own defensive package | explicit attack conversion / applicable character ability and reclaim |
| `a2-p21-r3c2` 女神官のシャリア | printed Lv/HP/attributes | explicit attack conversion / applicable character ability and reclaim |
| `a2-p21-r3c3` 妖精族 | printed Lv/HP/attributes; saved exact morale modifier; conditional fixed level | explicit attack conversion / applicable character ability and reclaim |
| `a2-p22-r1c1` メタルゴーレム | printed Lv/HP/attributes; spirit pass without HP/destruction | explicit attack conversion / applicable character ability and reclaim |
| `a2-p22-r1c2` 悪魔 | printed Lv/HP/attributes; saved exact morale modifier; explicit own defensive package | explicit attack conversion / applicable character ability and reclaim |
| `a2-p22-r1c3` 親衛隊 | printed Lv/HP/attributes; saved exact morale modifier; explicit own defensive package; whole-column ignore cancellation | explicit attack conversion / applicable character ability and reclaim |
| `a2-p22-r2c1` 天使 | printed Lv/HP/attributes; saved exact morale modifier; conditional fixed level; explicit own defensive package | explicit attack conversion / applicable character ability and reclaim |
| `a2-p22-r2c2` 炎竜 | printed Lv/HP/attributes; saved exact morale modifier; conditional fixed level | explicit attack conversion / applicable character ability and reclaim |
| `a2-p22-r2c3` 地竜 | printed Lv/HP/attributes; saved exact morale modifier; conditional fixed level | explicit attack conversion / applicable character ability and reclaim |
| `a2-p22-r3c1` 飛竜 | printed Lv/HP/attributes; saved exact morale modifier; conditional fixed level; explicit own defensive package | explicit attack conversion / applicable character ability and reclaim |
| `a2-p22-r3c2` デス・ナイト | printed Lv/HP/attributes; saved exact morale modifier; group-end bounded revival; explicit own defensive package | explicit attack conversion / applicable character ability and reclaim |
| `a2-p22-r3c3` 守護者 | printed Lv/HP/attributes; saved exact morale modifier; conditional fixed level; explicit own defensive package; whole-column ignore cancellation | explicit attack conversion / applicable character ability and reclaim |
| `a2-p23-r1c1` 水竜 | printed Lv/HP/attributes; saved exact morale modifier | explicit attack conversion / applicable character ability and reclaim |

`a2-p17-r3c3` 魔招門 (T49) is implemented by `lifecycle/magic-gate.ts` and the existing
turn-technique declaration/check/cancel continuation. `magic-gate.test.ts` covers paid hidden
placement failure without identity leakage, public pre-cost invalidity, nonrefundable replacement,
F31 protection, arbitrary effective capacity, explicit insertion, donor compaction, and immutable
physical binding on interruption. `protocol/test/physical-followers.test.ts` covers the strict wire.

`START_FOLLOWERS` optionally elects own defensive packages; plain PASS and omitted selection
remain defaultoff. Owner-only placement/defense/transfer candidates never expose hidden enemy
identities. Royal guard reflection uses an honest follower-origin action, never a hand-card
reservation or paid use, and retains original effect-source and numeric-roll provenance.

F07–F46 attack permissions, C07 virtual Arnes, C10 actual multi-source attacks, optional Dia/Tia
and Lester character effects, and G11 follower reclaim remain pending. Current concrete loss
producers remove followers together with Blessing (death/flow) rather than leaving an over-capacity
column; owner-choice capacity reduction remains pending its future independent limit-loss producer.
No catalog flags changed; formal START still returns RULESET_NOT_READY. Earlier generic bypass
fixtures now use 水竜 instead of the mandatory ignore-cancelling 守護者, and the generic front-morale
fixture uses グリフォン instead of the now-reflecting 王立騎士団.


## Task7k — eighteen dedicated physical follower attacks

`effects/follower-attacks.ts` explicitly grants only the printed dedicated packages below.
The existing ATTACK wire accepts own hand or currently placed physical sources only after the
same pure legality predicate used for private `followerAttackOptions`. Accepted placed sources
leave the column immediately and retain their origin in saved actions; cancellation, failed
checks, reflection and completion never restore them as followers. Normal hand attacks retain
G05's existing refill timing. This is not generic follower attack permission.

| Source IDs | Dedicated owner / implemented attack |
|---|---|
| a2-p19-r2c1, a2-p19-r3c3 | Gadyura Skeleton/Zombie: printed stats, far, selected-all, no checks, counter ban |
| a2-p20-r1c2 | Garwin Black Knights: use4/effect5, damage5 plus additions before ×2; normal use checks |
| a2-p20-r1c3 | Lancelot / canonical Lancelot2 Holy Knights: near warrior white4/4, normal checks |
| a2-p20-r2c1 | Asfelt Singing Ship: far magic5, shared full2d6, selected-all/no checks |
| a2-p20-r3c1 | Upa Griffin: far warrior5/8, same selected target set ×2, no checks |
| a2-p21-r1c1 | Gadyura Wight: far warrior4/5, selected-all/no checks, follower bypass |
| a2-p21-r1c2 | Lia Royal Guard: near warrior4/5; passive morale waiver does not waive active use checks |
| a2-p21-r1c3 | Tia Winged People: far magic7/10+shared2d6, mandatory-all, normal checks |
| a2-p21-r2c2 | Arnes Female Guard: far magic bow4/6, normal checks |
| a2-p21-r2c3 | Ramba Dwarves: frozen current warrior use/effect, far6 ×3 to one target, normal checks |
| a2-p21-r3c1 | Uonos Dragon Cult: far magic spirit black6/shared2d6, selected-all/no checks |
| a2-p21-r3c2 | Zil 女神官のシャリア: near warrior martial5/6, normal checks |
| a2-p21-r3c3 | Fury Fairies: far warrior bow white, independent saved3+1d6 attack level and4+1d6 damage, selected-all/no checks |
| a2-p22-r1c3 | Lia Guard: near warrior sword white6/8, selected-all/no checks |
| a2-p22-r3c1 | Asfelt Wyvern: far magic wind6/9, mandatory-all/no checks, evade ban |
| a2-p22-r3c2 | Gadyura Death Knight: far warrior black6/8, mandatory-all/no checks, two maai |
| a2-p22-r3c3 | Lia Guardian: far magic white7/10, mandatory-all/no checks, maai ban |

The four bare-all sources require the entire nonempty normal legal OTHER-active target set:
public same-faction allies and inactive actors are excluded; concealed factions never filter
secretly. Declaration freezes the set; later absence removes only effect delivery, never adds
or redirects recipients. Optional selected-all permits any nonempty legal subset.

Actual T07/T08 Beast + hand/placed Griffin uses printed warrior bottom Lv5 for eligibility,
reserves both physical sources, and inherits one selected-set two-hit technique with damage18.
It neither admits unclassified evade cards nor creates a C10 multi-source technique producer.

`dedicated-follower-attacks.test.ts` exercises real commands with JSON replay and 220 unique
physical IDs per accepted transition: all18 both zones, owner and ordinary rejection, independent
and shared rolls, source compaction/cancellation/failure, actual reflection/source spending,
per-hit defenses, static target sets, bans, and exact private candidates. Protocol tests reject
client-forged origin/target-mode fields while preserving existing ATTACK/coSource shapes.
Additional-grant consumer tests first create the real Ida printed grant, then explicitly replace
only its consumer character in a labelled test fixture. No current canonical Ida-to-dedicated-owner
producer exists: this verifies saved-grant legality/resume, not a reachable follower-grant producer.
Only a mandatory-all set equal to the fixed grant recipient is accepted.

The other22 follower attack permissions, C07 virtual Arnes, C10 heterogeneous producer, generic
human/animal character permissions, automatic dedicated character damage bonuses and follower
reclaim remain pending. This section supersedes Task7j's attack-pending statement for these18
only; the full40 follower catalog is not completed. Catalog activation remains unchanged.

## Task7l — C10 actual heterogeneous follower attacks

The explicit own-action abilities `c2-p05-r1c2-ab02` 獣使い and
`c2-p06-r1c2-ab04` 下僕達 now produce one saved heterogeneous attack group.
`USE_FOLLOWER_ATTACK` accepts a nonempty ordered list of physical own hand/placed
sources, each with a target set and an explicit dedicated boolean. Pure validation
precedes all reservation. The common cancellable ability frame grants the bundle;
ordinary source declarations, checks and numeric windows then finish in order before
any normal defense. Grant cancellation spends all sources; individual cancellation
or failed use checks exclude only that source. Neither path refunds cards or actions.

| Actual producer | Ordinary attack bottoms covered |
|---|---|
| Upa 獣使い | Griffin; Fire, Earth, Wind/Wyvern and Water Dragons |
| Dia 下僕達 | Soldier, Orc, Frontier Guard, Mercenary, Black Knights, Holy Knights, Royal Knights, Winged People, Dark Saint, Female Guard, Dwarves, Dragon Cult, 女神官のシャリア, Fairies, Guard |

This is all20 eligible human/animal attack-bottom records in the bounded C10 source
subset. Dia's canonical `restrictions` is empty: white Holy Knights, Fairies and Guard
are legal ordinary sources. The earlier Task7l dispatch assumption assigning Gadyura's
white prohibition to Dia was corrected against `characters.json` before acceptance.
Fairies roll their ordinary `3+1d6` use/effect level before excess-level checks, then
roll an independent `4+1d6` damage value. Dwarves freeze the acting Dia's own current
warrior level and retain three hits. Winged People retain `10+2d6` and mandatory-all;
Dragon Cult retains ordinary single-target `2d6` without Uonos' no-check package.
Only Upa may explicitly select his Griffin dedication for selected-all/no-checks;
omission is not an implicit dedication and ordinary Griffin keeps one target/two hits.

Each successful source keeps its own action/event, values, source card, full saved
numeric rolls, targets and hit count. Defense and approach exchanges use a source/hit
slot, skipping absent target slots and preserving that source's target order. Normal
reflection retains the actual current source/rolls; Royal follower reflection retains
its own physical reflector and original attack-source provenance. Each target has one
physical follower snapshot, one morale result per reached follower and mixed-source
per-hit HP/destruction/regeneration outcomes. Damage intents retain each constituent's
source and settle once for the complete group. Dedicated Lia Prayer reservations are
released when the bundle's source events finish.

Earth Dragon destroys reached non-空 followers before HP; 飛 is not 空. Water Dragon
stops reached owners until its caster/reflector's next seat arrival before recovery,
including dead/wandering/skipped source turns, and preserves unrelated stops. This
fixed source-clock status creates no recovery roll. Ordinary and Beast composite
paths retain their preexisting homogeneous/shared-source behavior.

`heterogeneous-followers.test.ts` exercises real Upa/Dia transitions, all20 ordinary
bottoms, private/public projections, strict acceptance, grant and constituent failures,
independent dice, mixed normal defense, original-source returned attacks, one snapshot,
Earth/Water effects and simultaneous damage. Every accepted test transition is compared
with an exact JSON reload and conserves220 unique physical cards.
`protocol/test/follower-bundles.test.ts` rejects forged capabilities, nested extras,
duplicate sources/targets and accessor records. Root-owned Worker/browser integration
is recorded separately; it is not inferred from engine tests.

This section supersedes previous C10-pending statements for these two actual abilities
and these20 ordinary bottoms only. All unrelated Upa/Dia abilities (獣性, 獣共感,
吸魂, follower reclaim, etc.), C07 virtual followers and other unimplemented catalog
clauses remain pending. No catalog activation flags changed; formal START remains gated.

## Task7m — follower-entry ability boundary and three canonical abilities

This slice implements only `c2-p03-r2c2-ab02` (アーネス・女性親衛隊),
`c2-p03-r2c1-ab02` (レスター・幻術), and `c2-p02-r1c1-ab02` (ティア・奇襲),
under adopted G03/G04/G06/G08/G09/G14/G18, C06/C07, and F68 supplements.
The full production catalog remains gated.

Every residual target receives a persisted public `follower-entry-abilities`
window after all normal defenses and before its immutable follower snapshot.
All public active seats participate, including those without private options.
The existing cancellable ability frame, used event key, restart, and replay
mechanisms apply; follower morale and reflection resume the frozen snapshot.

- Arnes explicitly chooses one virtual front guard, with Lv4 + general follower
  bonuses, HP1, human/female attributes, no morale check, and column ignore
  cancellation. The source has a group-scoped virtual ID, never a physical card
  ID. Every residual hit uses the same guard; group cleanup expires it. A later
  group can create another. Hidden use does not automatically reveal identity.
- Lester selects a nonempty subset of three independent effects. Spirit
  conversion compares actual printed source use Lv with own magic Lv at
  acceptance, adds only 精, and preserves school, other attributes and numbers.
  Physical human invalidation skips that source's effects and morale without
  moving the card, and also excludes its ignore cancellation. The separate
  Arnes suppression branch applies only to publicly revealed Arnes at snapshot.
  All branches share one cancellable declaration and one consumed attempt.
- Revealed attacking Tia may discard one actual own hand 踏み込み at that target's
  entry if physical followers or an accepted virtual guard will enter. The cost
  is consumed immediately, without refill, refund, or distance change. Generic
  ignore affects only that target's residual hits and respects column ignore
  cancellation. Targets use separate event IDs/costs. Entry modifiers are
  rechecked and fixed when snapshotting, then remain fixed through child resumes.

Evidence: `follower-entry-abilities.test.ts` uses real setup, declarations,
reactions, dedicated Tia Wind Arrow, ordinary Tia 天地百撃斬, actual Dia C10 小人族,
real Royal Guard reflection, and intervening normal turns. `follower-entry-sources.test.ts`
checks heterogeneous printed source qualification with canonical Dia ownership
without creating an unsupported Lester/C10 combination. Accepted commands use
JSON replay and exact conservation of 220 unique physical cards. Protocol tests
cover explicit bounded branch subsets, empty/duplicate/unknown branches and
fields on unrelated abilities. Existing Task7h, physical follower, heterogeneous,
single-card/dedicated follower and continuation suites remain regression gates.

The other five records in the Task7m source bundle remain dependencies for later
slices: Lancaster dragon destruction, Lancelot White Dragon Sword,
Asfelt Wind Dragon Sword, Upa beast empathy/capture, and Gadyura soul frenzy.
This slice does not partially activate those abilities or generic named reclaim.

Task7m fix1: Lester's added 精 is derived from live source eligibility throughout
normal defense, including return from an actual Ida Shadow / 錯乱 child attack.
The shared incoming-technique and public-projection path preserves printed 精,
acceptance-time qualification, and each already-frozen target. Maintained evidence:
`follower-entry-live-suppression.test.ts` (five cases, JSON replay and 220 cards).

## Task 7n — five optional technique value abilities

Exact canonical records: `c2-p01-r1c1-ab02` 賢者の杖 (magic effect +1),
`c2-p01-r1c2-ab02` 鉄拳 (martial effect floor at live warrior, independent damage d6),
`c2-p01-r2c1-ab03` 気合い (modifier-zero spirit check, success effect +1),
`c2-p03-r1c1-ab03` 斧使い (qualified nonbow warrior damage ×2), and
`c2-p05-r1c1-ab02` 破壊神の力 (black magic effect +d6).

`abilities/action-modifiers.ts` owns persisted declaration usage/warrior snapshots,
effect base/floor/addition composition, selected live sources, deferred Fist roll,
and separate effect/damage freezes. Prayer now adds to this bookkeeping. Printed
additions precede chant/printed/optional multipliers, with final clamp/floor; null
remains no damage. All five use ordinary optional, cancellable ability declarations
with persisted real action context, existing private ability options and event-use
keys. No synthetic card or owner, new command, hidden source ID, or optional public
window skip is introduced. Public allowlisted `actionCalculation` follows the real
parent through ability/Prayer/reroll children; numerical previews and readiness
also appear on ordinary and C10 source summaries.

`action-value-abilities.test.ts` contains actual canonical select/decline/cancel
paths for all five, Prayer/Fist order parity, separate native 2d6/Fist d6 and numeric
reroll, Shin force-failure plus reroll, source suppression on both sides of each
component cutoff, exact late-use rejection, declared Axe qualification despite
later stat changes, Dwarf shared three-hit damage, actual counters/parry/played
reflection versus incoming copied values, relative reflection limits, turn healing,
Shin multi-target multi-hit values, C10 Fairy's pre-check dynamic use plus per-source
Prayer, Beast base+10, and real Vanmil transformation excluding Uonos inheritance.
Every accepted step uses canonical transition, JSON replay and exact 220 unique
physical cards. `action-value-arithmetic.test.ts` is explicitly **helper evidence**
for null, zero, fractional final rounding and additive-before-chant/optional
multiplier combinations lacking a current canonical producer; it does not claim
invented full-card combinations or unsupported multi-hit martial producers.

Regression consumers: `task7d-rolls.test.ts`, `task7h-abilities.test.ts`,
`task7i-combinations.test.ts`, `dedicated-follower-attacks.test.ts`,
`heterogeneous-followers.test.ts`, `physical-followers.test.ts`, and
`follower-entry-live-suppression.test.ts`. C05/G08/G09 provisional interpretation
applies: defense declaration must already be legal; prospective boosts do not
permit an initially insufficient counter/reflect. Existing C10 ordinary dynamic
usage is resolved before its checks; no ability/Prayer changes useLv. Arnes Black
Bow and mixed capture/destruction/reclaim abilities remain separate future work.
Raw catalog activation, deployment and full-catalog completion remain blocked.

### Task7o — reached-follower destruction abilities

Four complete canonical records are executable, per the adopted C05 supplement
and G03/G08/G09/G13/G14:

| Source | Complete package | Selection and cutoff |
| --- | --- | --- |
| `c2-p02-r2c1-ab02` 竜殺槍 | Actual warrior hits destroy reached dragon followers | Attack ability window; source live until each target snapshot |
| `c2-p02-r2c2-ab02` 白龍の剣 | Sword hits destroy reached black or dead followers; actual Gadyoora receives ×2 damage | One damage-window declaration/cancellation; target multiplier commits at damage cutoff; destruction remains live until each snapshot; actual LancelotII inheritance supported |
| `c2-p04-r1c2-ab01` 風龍の剣 | Sword or wind hits destroy reached effective follower Lv≤6 | Attack ability window; uses per-hit frozen conditional/dedicated level and Blessing bonus |
| `c2-p06-r1c1-ab03` 狂魂 | Actual hits destroy reached human followers, including selected virtual Arnes guard | Attack ability window; no synthetic physical card for virtual destruction |

`abilities/follower-destruction.ts` stores typed selected provenance separately
from printed Technique predicates. Effective per-hit projection and target entry
freeze reuse the live spirit path. Destruction runs after ignore/ineffectiveness
and before morale, reflection, level comparison or HP; reached destruction forbids
revival and physical disposal stays delayed across reflection children. Repeated
simultaneous hits consume the frozen source independently. Normal and physical
reflection copy active incoming predicates plus fixed target damage with original
source-card lineage; copied effects cannot acquire reflector enhancements or
another named-target multiplier. Printed predicates survive ability suppression.

`PlayerView.followerDefenseResults` exposes only reached per-hit outcomes, source
kind/position and identity already public or permitted to the original owner;
immutable snapshot disclosure survives JSON/child continuations. Unreached rear
sources and passed-through concealed identities stay private. Public per-hit
`destructionEffects` descriptions disclose game capabilities without the selected
ability ID/name or hidden character identity. Ordinary USE_ABILITY/PASS and
cancel-ability commands suffice; all four late/spent attempts return the existing
ABILITY_DISABLED error (STOPPED retains precedence when applicable).

Evidence: `follower-destruction-abilities.test.ts` uses actual canonical owners,
cards, declarations, cancellation, real LancelotII/Vanmil transformations, every
condition boundary, ordinary and revealed/hidden Gadyoora, independent numerical
and follower cutoffs, real three-hit Heavenly Hundred Slash for all four, actual
counter returns, ignored/blocked rear privacy, virtual Arnes, Ida Shadow→Confusion
source suppression, normal Asfelt wind reflection and physical Royal guard
reflection. Every accepted transition is JSON-replayed and preserves 220 unique
physical IDs. Active Frenzy destroys human Royal guard before it can reflect;
its suppressed branch legitimately reflects only intrinsic magic properties.
`follower-destruction-properties.test.ts` explicitly labels pure helper evidence
for heterogeneous source provenance and copied pre-multiplied numeric values;
it does not claim a nonexistent canonical multi-owner ability combination.

Task7n numerical modifiers and all existing follower/combination/physical
reflection consumers remain regression gates. Upanishat capture and Arnes Black
Bow are separate complete packages; raw catalog activation and deployment remain
outside this slice.

### Task7p — Upa's complete optional beast empathy

`c2-p05-r1c2-ab03` 獣共感 now executes both printed clauses under the adopted
C10/G15 supplement: one ordinary optional attack-abilities declaration/cancel
attempt, then one optional earned capture subset after simultaneous body damage.
This section supersedes the earlier statements that this specific ability is
pending. Other catalog records and the ruleset/start gate are unchanged.

Typed selected provenance lives separately from printed ignore predicates.
Actual warrior sources (ordinary attacks, returned legal counters, and actual
Upa C10 Griffin warrior bottoms) qualify per hit. Effective ignore stays live
until each target's shared follower snapshot; that target's technique and selected
provenance then freeze. Only the actual traversal ignore branch records physical
beast IDs, target/position and immutable source/hit lineage. Ineffective, failed
morale, natural spirit passage, normal defense and unreached sources create no
entitlement. A positive body hit must itself have passed that source. Intrinsic
ignore alone grants no acquisition; overlapping selected ignore retains its own
provenance. Column ignore cancellation blocks it.

`abilities/beast-empathy.ts` creates a typed saved lifecycle task only after
simultaneous damage/self-cost and pending deaths commit. It saves the eligible
original owner, group identity and complete earned physical/hit provenance before
actions/groups are deleted. An active, enabled owner selects zero/all/some cards
with `CHOOSE_BEAST_CAPTURE {groupId,windowId,cardInstanceIds}`; empty/PASS declines.
Strict protocol shape and atomic engine validation reject forged, duplicate,
wrong-priority, stale or moved-source choices without changing state or revision.
Resolution revalidates source and current ownership, directly moving each actual
card once from target followers to owner's hand. No draw, refill or immediate
hand-limit adjustment occurs. Capture blocks stable outcomes and precedes the
pending target's death-gift/disposal; a simultaneously pending-death owner cannot
acquire. Fixed reflection copies effective ignore and original source lineage but
never selected acquisition rights.

An explicit private `beastCapture` projection exposes candidate ID/name/original
position only to the entitled priority owner after committed positive damage.
`lifecycleDecision` uses a window allowlist and excludes this task. Public per-hit
`beastIgnore` discloses the effective attack capability without private ability
identity. Public BEAST_CAPTURED events expose actor/target/count; private copies
identify each moved physical card only to recipient and former owner. Completed
choices disappear and third-party views retain concealed identities.

Evidence: `beast-empathy.test.ts` covers canonical sword vs two hidden beasts,
select/cancel/decline/spent/late errors, subset/all/empty/PASS, lifecycle JSON
resume, atomic errors, actual Castle HP reducing final damage to zero, unreached
rear beasts, printed Royal Guard reflection of ordinary Lv4 破黒剣, actual reflected
child death, actual counter return, Upa C10 two-hit Griffin and mixed FireDragon,
positive unrelated magic that cannot qualify for capture, lethal target ordering,
and actual dedicated Griffin → Ida Shadow → Confusion source suppression. Every
accepted command replays from JSON and preserves all 220 unique physical IDs.
`beast-empathy-properties.test.ts` explicitly labels direct probes for missing
source fallback, ineffective/morale/spirit/virtual traversal, independent frozen
and live targets, immutable earned provenance, zero damage and simultaneous owner
pending death. `beast-capture.test.ts` covers strict protocol shape/list bounds.

Producer limits are explicit: the only current printed selfCost is magic
滅界; no canonical qualifying warrior/self-cost combination exists. The
simultaneous-owner-death helper is paired with actual legal reflected-child death.
Ordinary magic reflection cannot return a selected warrior-only beast ignore;
actual physical Royal Guard reflection proves the applicable fixed-return path.
BlackWing is Lv5, above Royal Guard's Lv4 limit; no fictional lower-level variant
is used. Source suppression via direct status assignment is helper evidence,
separate from the actual Ida→Confusion chain. Full Task7/all110 abilities, raw
catalog activation and deployment are not claimed.

### Task7q — Lancaster Wind and Arnes Black Bow

Two complete optional records now execute under adopted Japanese C05/G08/G09:
`c2-p02-r2c1-ab01` 瞬風 and `c2-p03-r2c2-ab03` 黒弓. This supersedes the
specific earlier Black Bow pending statements; all other excluded packages,
raw catalog activation, full catalog completion and deployment remain gated.

Lancaster selects once in public attack-abilities for actual warrior attacks or
actual returned counters. Typed group provenance adds one to each qualifying
hit's native maai requirement (default one; BlackWing two becomes three), without
changing printed properties, numerical values, costs or distances. Arnes selects
one cancellable Black Bow package in effect-level for an actual bow attack or
counter action: effect +1, damage +2 at their separate G08/G09 cutoffs, plus live
no-evade. The ability never grants otherwise illegal counter/card/chant permission.

`abilities/attack-properties.ts` composes live properties from each actual hit's
source and active canonical owner, separately from printed properties. Suppression
removes only selected live properties/unfixed numbers. Physical received reflection
copies effective properties and fixed incoming values once; reflector boosts and
later original-owner suppression cannot modify the copy. Per-target follower
snapshots remain immutable through child continuations. Existing destruction,
spirit, beast-ignore/capture and follower traversal semantics remain intact.

All maai entry/final checks use each actual current target hit's effective
requirement. Public `PlayerView.maaiDefense` allowlists only current group/target/
hit identity and required, carried, submitted, shared-advance, effective and
remaining counts. Physical paid IDs and source ability identity stay private.
One attacker advance cancels one current submission independently for all targets;
prior carried progress stays uncancelled. Accepted cards remain paid, completed
hits do not reopen, next hits start fresh, and the projection closes outside the
actual normal-defense/defense-advance exchange. Existing plain USE_ABILITY,
cancellation, numeric projections and incoming defense restrictions are reused.

Evidence: `attack-property-abilities.test.ts` uses ordinary BlackWing/BlackFlowBow,
dedicated Lancaster SkySpear shared B/C maai, separate multi-hit Heavenly Hundred
Slash progress, real Lancaster counter return, legal Royal Guard reflections of
printed Lv3 踏み込み／弓 (selected Black Bow Lv4/damage6), mandatory StarFlowBow
chant and intrinsic no-evade, whole-package select/decline/cancel/spent/late errors,
public option/privacy checks, actual Vanmil transformation and actual dedicated
Arnes/Lancaster → Ida Shadow → Confusion later-target resumes. Accepted commands
replay from JSON and conserve exactly 220 unique physical cards.

`attack-property-provenance.test.ts` explicitly labels helper-only evidence for
heterogeneous/missing/foreign sources, saved random native maai, independent frozen
versus live targets, source status changes, null damage and printed/chant multiplier
composition. Generic bow-counter classification is helper-only: no current Arnes
bow producer has legal counter permission. Random extra maai currently belongs to
Gainas's dedicated source, so no Lancaster ownership/inheritance is invented.
Direct partial-maai suppression probes are paired with legal later-target child
suppression retaining earlier paid maai. `protocol/test/attack-property-abilities.test.ts`
checks plain packages and rejects split effects/forged property payloads. Root-owned
Worker/browser acceptance is recorded separately and is not inferred from engine
coverage. Full Task7/all110 ability completion remains outside this slice.

## Task 7r — received defense and numeric reduction foundation

The eleven complete C04 abilities below use optional cancellable normal-defense
selection, once per actual group/target/hit. Cancellation spends the attempt;
PASS or other defenses decline. Numeric deductions resolve for only the receiving
hit and persist after later source suppression. Threshold reservations remain live
until they qualify or normal defense closes. Each successful package reevaluates
eligible reservations after all resolved deductions; WhiteSilver applies its own
black deduction before its own threshold. Effect Lv clamps at zero without adding
Lia's separate disappearance effect.

| Source ability ID | Complete package |
|---|---|
| `c2-p01-r1c1-ab01` | Shelim 絶対結界: effect ≤5 or pre-follower damage ≤5, including null |
| `c2-p02-r1c2-ab01` | Fury 光の結界: received magic effect −1 |
| `c2-p02-r1c2-ab02` | Fury ミスリルのローブ: all techniques effect ≤3 immune |
| `c2-p02-r2c2-ab01` | Lancelot 白銀の鎧: black effect −1 and all techniques effect ≤4 immune |
| `c2-p03-r1c1-ab01` | Lamba ミスリルの鎧: all techniques effect ≤3 immune |
| `c2-p03-r2c2-ab01` | Arnes 闇の結界: received magic effect −1 |
| `c2-p04-r1c1-ab01` | Aiel 氷の結界: fire and water techniques immune |
| `c2-p05-r2c1-ab01` | Garwin 黒騎士の鎧: warrior techniques effect ≤4 immune |
| `c2-p05-r2c2-ab01` | Gainas 暗黒の鎧: all techniques effect ≤5 immune |
| `c2-p06-r2c1-ab01` | Fleiard 炎の結界: water and fire techniques immune |
| `c2-p07-r1c2-ab01` | Vanmil 巨神: all techniques effect ≤5 immune |

`received-defense-abilities.test.ts` exercises actual attacks, declarations,
cancellation, both Fury ordering paths, above-threshold reservations, private
options, canonical warrior 3/4/5/6 and magic 4/5/6 boundaries, reduced reflected
magic3, exact atomic errors, later Griffin hits, target B reduction with C unchanged,
real counter comparison and return, Royal Guard/神王界 reflection, LancelotII
transformation inheritance and Vanmil's lack of Uonos inheritance. Actual 炎舞6/5
and 吸魂7/null cover Shelim's damage branch; actual 白光5/6 plus Prayer1 and a
Soldier HP1 proves resulting damage5 does not retroactively qualify for immunity.
Actual Frenzy → B barrier → C Shadow → Confusion preserves B's reduced value
while removing the attacker's still-live destruction before B's follower snapshot.
Every accepted command replays identically from JSON and conserves 220 unique
physical cards. Protocol tests reject forged hit outcomes and split package inputs.

Explicit helper-only probes cover source stop/disable/inactivity/ownership during
pending declarations and after numeric resolution, zero arithmetic, and combined
Wind/BlackBow/Spirit provenance before versus after follower snapshot. No current
actual warrior producer with fire/water attributes was found in the implemented
technique and follower attack sources; school independence is tested as a labeled
helper predicate, with both actual magic attributes tested canonically. Hidden
hand/follower/identity mutations are privacy probes, not source transactions.

Numeric provenance is stored independently of Technique, then applied once at
existing follower/reflection cutoff. Public currentAttack values use the same
received effect as defense comparisons. No public reservation identity is added.
Lamba 魔法抵抗, Lia 光の加護, LancelotII 光の盾, Gainas 威厳 and other rolling,
halving, reflection or multi-clause packages remain outside this slice. Root-owned
Worker/browser evidence is recorded separately; full Task7 and catalog activation
remain pending.

## Task 7s — received defense roll and settlement continuations

The four remaining adopted C04 packages below extend Task7r numeric provenance.
Each is optional once per own current normal-defense hit, cancellable through the
ordinary ability declaration; cancellation/failure consumes that attempt, later
hits get fresh attempts, and follower entry closes selection. No physical cost.

| Canonical ability | Complete behavior |
| --- | --- |
| `c2-p03-r1c1-ab02` | Lamba 魔法抵抗 reserves magic body damage half until the target's final numeric settlement. Follower HP and on-hit effects precede per-hit flooring; separate magic resistance failure damage is included with direct null preserved. Source suppression before this cutoff prevents half; fixed values remain fixed. |
| `c2-p03-r1c2-ab01` | Lia 光の加護 saves spirit−3 check and separate d6 with ordinary result/reroll children; live-source recheck commits one target-local effect reduction. Exact zero explicitly negates only this hit and compatible thresholds reevaluate. |
| `c2-p07-r1c1-ab01` | LancelotII 光の盾 saves spirit−5 once and reserves comparison to own current warrior level during open normal defense. Actual transformation inherits WhiteSilver as a separate complete option; no repeated check when later reduction qualifies. |
| `c2-p05-r2c2-ab02` | Gainas 魔導王の威厳 saves spirit−5 and reflects one received hit as counter. Counter prohibition and G13 same-ability lineage prevent acceptance. Copied received effect/damage/attributes/on-hit effects retain physical provenance with no source cost/check or reflector boost; original attacker chooses ordinary new defense. |

`received-defense-continuations.test.ts` separates actual source sequences from
explicit helper probes. Canonical cases include 雷走7 and 白光6 behind Soldier HP1
settling to3 and2, 幻矢 null plus failed resistance10 settling to5, 毒流 direct4
plus failed resistance6 settling to5, warrior 血流 failure damage remaining whole,
real magic stop suppression before half, two-target cutoff ordering, C10 mixed
human warrior/magic sources, Lia saved result/force-fail/d6 reroll/cancellation,
Griffin per-hit freshness, actual LancelotII transformation and black Prayer5→7
then inherited WhiteSilver→6 against own warrior6, Gainas source effects/ordinary
defense/counter ban/mirror lineage, and exact atomic command rejection. Every
accepted command checks JSON replay and all220 unique physical cards.

Helpers explicitly cover source ownership/activity/suppression changes during
children versus fixed results; absent canonical repeated-magic-hit and magic
on-hit multiplier combinations; null failure projection with an extra target;
hypothetical Lia/armor/shield and Gainas/reduction/half ownership compositions;
late warrior-stat changes; and changed-distance/no-reflector-boost assertions.
These probes do not claim canonical ownership or unsupported source activation.

Public per-hit `bodyDamage` exists only after pendingDamage freezes and contains
`directDamage` (nullable), separate `resistanceDamage`, and final `total`.
`technique.damage` remains incoming direct damage and is not a final body-damage
label when that explicit projection exists. Ability reflection uses generic
public context with original physical source provenance; hidden character ability
IDs remain limited to owner/revealed currentAction views and private options.
No half reservation identity is published. C04 LancelotII 悲しみを胸に remains
outside this slice; no catalog/START activation is claimed. Worker/browser and
independent acceptance evidence are owned by the root task.

## Task 7t — named current ability-use responses

Two complete adopted C14 packages use ordinary optional, cancellable private
ability selection during the exact source ability's clockwise declaration window:

| Canonical ability | Complete behavior |
| --- | --- |
| `c2-p01-r2c1-ab05` | Shin 鏡心 cancels revealed Ida's pending 影分身 when Shin is revealed. Any active participating Shin may respond, including a third party. |
| `c2-p07-r1c1-ab02` | Actually transformed LancelotII 悲しみを胸に cancels revealed Gainas's pending 魔導王の威厳 only against LancelotII's own current attack. Self-reveal is not an added condition. |

The existing opaque `targetEventId` is the original ability frame ID for these
responses, so nested declarations cannot share or switch the target. Saved
storage-only context pins `sourceAbilityId`; attempt keys include the source
frame, responder and response. Source stage/public identity/current hit and live
responder ownership/activity/status recheck at resolution. Cancellation spends
the source attempt before its checks/children, resumes unchanged incoming defense,
and persists after later suppression. Canceling the response itself spends only
its response attempt and lets the original source proceed. Later declarations
have fresh entitlement. No physical cost, stat/faction change or permanent ban.

`named-ability-responses.test.ts` covers actual revealed Shin attacker/third-party
and hidden-source negatives; actual Lia reveal and Lancelot transformation,
unrelated transformed third-party and wrong-named-source negatives; cancellation
before original checks with ordinary Soldier settlement; actual Fate cancellation
and refill, saved Shadow self/enemy checks including a physical child attack,
Majesty reflection with original-attacker defense, and later source declarations
through a complete turn cycle rejecting old targets. Every accepted command uses
the shared helper to verify identical JSON replay and exactly 220 unique physical
cards. Protocol tests preserve the plain command and reject forged cancellation
state, private context and split effects.

Explicit helper probes cover stopped/disabled/inactive/changed ownership and
public conditions at declaration/resolution, closed/stale source or changed hit,
committed cancellation permanence, and a second synthetic Shin's independent
entitlement. Real transformation reveals LancelotII; the no-self-reveal restriction
and owner-only nested response privacy are therefore tested with a labeled
post-transformation conceal-state probe, not claimed as a legal conceal action.
Characters, initial statistics, hands and follower zones are fixture arrangements;
the source attacks, transformations, response declarations, reactions, checks,
child attacks and later turns are actual accepted commands. Root-owned Worker,
reconnect/receipt and browser evidence are recorded separately. This slice does
not activate the catalog/START gate or claim all Task7 abilities implemented.

## Task 7u — three complete mental received defenses

The exact C03 packages `c2-p03-r2c1-ab01` 魔詩, `c2-p06-r1c1-ab01` 恐怖,
and `c2-p06-r1c2-ab01` 魅了 now use one optional cancellable declaration per
actual target/group, before followers. Counter/physical reflection/ability
reflection continuations cannot offer them. Printed counter-capable cards used
as ordinary attacks still qualify. Same-faction attacks qualify without a hidden
faction oracle. Cancellation spends the group attempt; no cost card is invented.

The actual attacker makes the existing saved spirit−1 check, with ordinary
before/after-roll and Fate/reroll children. Ordinary failure cancels the owner's
remaining hits; final saved doubles cancel regardless of check success and stop
the attacker until that attacker's next seat arrival, including inactive/dead/
skipped seats. Saved status provenance separates actual ability source from expiry
actor, with no physical card or recovery roll. Previously completed defenses and
other declared targets persist. Source ownership/activity/stop/disable recheck
until the result commits; committed results do not roll back.

Sixes additionally replace faction/objective/protection or save fatal intent.
Lester always supplies explicit EVIL extinction and Lia-only protection. Dia
supplies a permanent snapshot of every other faction relative to Dia at conversion,
with Dia-only protection. Mandatory faction restrictions block the entire identity
replacement but retain cancellation/stop. Same-faction permitted replacements
still replace the old protection. Typed objective labels and protection descriptions
survive G15 identity capture/revival; unlabelled explicit objectives display their
actual enemy factions. The private self projection carries currentObjective,
protection and defeatCondition, separately from printed character text.

Gadyoora saves an irrevocable ability fatal intent on the attack group and applies
stop immediately. Already-declared other targets complete; further optional source
choices decline without granting an extra action. At group settlement the fatal
intent joins ordinary simultaneous damage/self-cost, then the existing death-gift,
disposal, revival, protection/wandering and stable outcome pipeline runs once.
The original physical attack is discarded once. Ability death records the actual
source actor without borrowing a physical card. Public pendingFatal is a generic
boolean; next-own-seat exposes only its expiry actor. Hidden ability provenance,
objective and protection stay outside other players' public projections.

`mental-received-defenses.test.ts` covers exact source text, all three ordinary
success/failure/double/six branches, fixed/same-faction cases, actual EarthRift
multiple targets including failed sixes, actual Upa Griffin two hits/group attempt
and fresh later group, actual Fate cancellation/forced failure/rerolls both removing
and introducing sixes, actual counter/神王界/Majesty/Royal Guard returns, inactive/
skipped/dead seat arrival, source suppression boundaries, atomic errors and privacy.
Actual death gift and Fusen revival are exercised both for Gadyoora death and for
converted players' own death identities. Actual Gainas death then Dia death and
Fusen return prove old protection removal and current protection/wandering behavior.
Every accepted command replays from JSON and preserves exactly 220 unique physical
cards. Three protocol cases reject forged results, identity, expiry and split effects.

Fixture characters/stats/zones are arrangements, not claimed acquisition commands.
Helper evidence is explicitly labelled for later source suppression/ownership,
alternate prior allegiance/protection, inactive/dead/skip conditions, and a composed
optional source-choice group unsupported by one canonical technique. The six-seat
named-death/return test uses an explicitly documented pre-existing E protection
replacement to keep an opposing survivor while actual deaths/returns execute.
Related eight mental suppressors/immunities remain separate future complete
packages; no automatic partial activation, full Task7 claim, catalog START gate
activation or deployment is included. Root-owned Worker/browser/review evidence
is recorded separately.

Task7u review fix I1: actual dedicated Ida 手裏剣 (`a2-p08-r2c3`) also
skips its optional on-hit chant-discard choice while the attacker has a saved
fatal intent. Other declared recipient damage and chants persist until normal
G15 fatal settlement; the source discards exactly once. An old saved on-hit window
hides the discard command and atomically rejects it while fatal is pending; PASS
still declines safely. This restriction is specific to pending fatal intent and
does not change the existing nonfatal stopped-attacker choice semantics. Three
new readable tests cover the actual multiple-target card/fatal sequence, the
nonfatal-double control, and the explicitly labelled old-saved-window helper.

## Task 7v — eight complete mental protection abilities

C03/C14 now implement the complete printed packages 信仰心 (Gil ab04), 精神統一
(Shin ab04), いたずらしちゃった (Cham ab04), 私、同性には興味がないもので
(Tia ab03), 不屈の意志 (Lancelot ab03), 愛など無駄だ (Uonos ab03), 執念
(Garwin ab02), and 死者 (Gadyoora ab02). Catalog implementation/START gates remain
unchanged. The preceding Task7u statement that these packages are future work is
superseded by this slice; this does not complete all of Task7.

The three double guards use ordinary optional USE_ABILITY at the actual attacker's
public after-roll priority. A private reservation binds the exact pending mental
invocation and saved roll across divine reroll generations. Cancellation spends
one attempt. At final mental result commit, a live reservation suppresses only
final-double effects, including unconditional cancellation, stop, conversion and
fatal intent. Ordinary threshold failure or actual Fate forced failure still
cancels the mental defender's remaining hits. Faces, success, and private thresholds
retain their ordinary meanings. No applied result rolls back after suppression.

Five named responses bind the current declared mental source frame, with exact
original character and ability matching. Cham requires both characters revealed
and can be a third party; Tia requires the actual attacker and revealed Dia; Uonos
requires the actual attacker and revealed Lester; Lancelot and Gad require the
actual attacker without extra reveal conditions. Gad excludes his own Fear. Actual
Lancelot II transformation inherits the original Lancelot package; Vanmil does not
inherit Uonos. Existing Mirror Heart and Sorrow source/reveal/role conditions stay
explicit. Children recheck source/owner/role/reveal, never retarget another frame.

Garwin and Gad also offer separate contextual normal-defense uses against the
current effective received 精 hit, before followers, including real counter and
reflection returns. Garwin reserves only stopping prevention, retaining damage,
ordinary resistance and other statuses. Its status cutoff uses the actual source
hit and saved received attributes; source-turn, ordinary resistance, deadly and
fixed-stop producers honor the reservation. Existing stops are never cured. Gad
negates the whole received hit on resolution, including numeric and null effects.
The typed dedicated Gil 気破 exception bypasses that immunity, without a general
white-technique exemption. Unselected/canceled abilities have no automatic effect.

`mental-protection.test.ts` includes exact eight-record source fidelity through a
permanent independent fixture, the full 3 guard × 3 source × 2/6 doubles × ordinary
success/failure matrix, S19 Gil's actual failed threshold, actual Fate cancellation/
forced failure and divine rerolls, source-bound attempts and fresh later attacks,
all named source/reveal/role combinations, actual transformation, atomic rejects,
private nested views/history, actual nightmare/hypnosis/action-card MagicSong,
actual deadly-stop, warrior 精, Gil dedicated/ordinary controls, nonmental water/
earth controls, actual illusion conversion, actual Majesty reflection and 狂王陣
counter returns. An actual dedicated Lester MagicSong multiple-recipient attack
confirms other recipients still take damage and stop.

All accepted command helpers independently replay JSON and retain exactly 220
unique physical IDs. Initial characters/stats/zones are fixture arrangements.
Explicit helpers cover unproducible duplicate-Gad exclusion, mixed-source and
multi-hit status combinations, fixed mental stop, extra resistance failure damage,
source ownership/activity/reveal changes and suppression before/after snapshots or
commit. These do not claim canonical acquisition or printed card combinations.
Eight protocol cases verify no client can forge clause/context/reservation/result
fields. The interface adds only an optional owner-private AbilityOption description;
no guard provenance leaks via public statuses, technique fields or roll history.
Root owns Worker/browser/reconnect and independent review evidence separately.

## Task 7w — explicitly selected whole declaration abilities

The adopted C05 supplement adds thirteen complete optional packages. `declarationAbilityIds`
selects them on normal/granted attacks, defenses, turn techniques and applicable group defenses.
A shared stored queue retains the selected source, original targets and stable ability-ID order.
The physical declaration cancellation window precedes independently cancellable ability frames;
failed or canceled requirements spend the accepted source and resume its original continuation.
Use conditions commit once; effect level and damage independently recheck the live ability source.

| Canonical source | Whole package | Executable evidence |
|---|---|---|
| `c2-p01-r1c1-ab03` / シェリム・大魔術師 | All magic chant waiver | Selected/declined/canceled magic; revival single-target use; canceled 滅界 retains its mandatory self-cost |
| `c2-p01-r1c1-ab04` / シェリム・強化詠唱 | Revealed, actually chanted magic to chosen enemies | Actual CHANT and subsequent turn; selection/decline/cancel; hidden and waived-hand negatives |
| `c2-p01-r1c2-ab01` / ジル・気闘術の奥義 | Martial counter conversion with its own spirit check | Equality, stronger near counter at far, decline/cancel/Fate force-failure, printed counter prohibition |
| `c2-p01-r1c2-ab03` / ジル・拳圧 | Near martial to far | Selection/decline/cancel with unchanged requested target |
| `c2-p01-r2c1-ab01` / シン・ツバメ返し | Sword counter conversion with its own spirit check | Separate two-Shin check sequence; cancellation; original printed counter fallback; return provenance |
| `c2-p01-r2c1-ab02` / シン・居合抜き | Sword chant waiver with its own spirit check | Unchanted sword use; cancellation; failure after the other ability succeeds does not retain a disabled source |
| `c2-p02-r1c2-ab04` / フューリー・精霊を統べるもの | Elemental magic effect +1 and chant waiver | Whole select/decline/cancel; warrior/nonelemental negatives; fairy lower attack remains a warrior/bow source |
| `c2-p05-r2c1-ab03` / ガーウィン・剣匠 | Near warrior to far; sword effect +1 and damage +2 | Whole select/decline/cancel; independent live cutoffs; actual 黒騎士団 hand/placed sources resolve 6 effect and (5+2)×2=14 damage |
| `c2-p05-r2c1-ab04` / ガーウィン・衝撃波 | Revealed, actually chanted sword to chosen enemies | Actual CHANT, selection/decline/cancel, preserved target set |
| `c2-p05-r2c2-ab03` / ガイナス・実力 | All-technique chant waiver | Selection/decline/cancel; composed component and granted-use integration |
| `c2-p05-r2c2-ab04` / ガイナス・黒龍の剣 | Revealed sword with actual use Lv≥6 to chosen enemies | Actual CHANT sequence; selection/decline/cancel; below-use-Lv negative; actual Shadow grant remains one target |
| `c2-p06-r2c2-ab02` / ヨーツルム・野獣 | Martial usage-check waiver and independent effect/damage d6 | Separate stored rolls, Divine reroll, whole decline/cancel, fixed reflected copy, null damage invariant |
| `c2-p07-r1c2-ab02` / ヴァンミール・破壊の神 | Chant waiver; warrior chosen-all and double damage; magic chosen-all and exact effect 10 | Actual Uonos ritual transformation; whole select/decline/cancel; deterministic counter acceptance after actual Prayer; turn techniques retain printed target count |

Permanent independent exact-source assertions, including character name, timing, specification,
activation and ability identity, are in `packages/engine/test/declaration-modifiers.test.ts` and
`fixtures/declaration-modifier-sources.json`. Runtime definitions have no ignored-artifact imports.
Boundary/source/numeric suites are `declaration-modifier-boundaries.test.ts`,
`declaration-modifier-sources.test.ts`, and `declaration-modifier-numerics.test.ts`.
Accepted command helpers replay JSON state with identical entropy and verify 220 unique physical IDs.
The protocol suite rejects forged, unrelated, duplicate, sparse and misplaced selection fields.

The private candidate wire contains source/mode entries plus applicable whole-package effects, never
an ability-subset Cartesian product. The exported pure `previewDeclarationCandidate` consumes only
that projection. Selected random effect boosts use their finite possible maximum for acceptance;
insufficient final counter values fail and spend the defense instead of rejecting the final PASS.
Candidates and saved selection details belong only to their owning viewer.

Explicit structural helpers isolate states with no canonical producer: cross-character inherited
ability combinations (Upanishat/Yotsurm/Gil/Gainas), a primary BeastSword in the chant zone,
an above-10 magic+martial source with iron-fist lower bound, printed-null martial damage,
mid-window source suppression, and an incoming value requiring a selected random boost. These do
not claim printed ownership or new inheritance. The Uonos→Vanmil test uses the actual ritual producer.
Actual Shadow creates the grant before its helper-inherited modifier combination is tested.
Printed follower restrictions, reflection provenance and mandatory costs remain authoritative.
Catalog entries remain pending; this slice does not enable production START or complete Task 7.

## Task 7x — twelve complete turn, inspection and visibility abilities

| Source ability | Implemented behavior | Evidence |
| --- | --- | --- |
| `c2-p01-r2c2-ab02` / チャム・なになに | Explicit normal draw replacement, two hand cards; decline and canceled ordinary one | Saved opportunity, OPEN refill, actor self-Fate with its existing reaction refill, current-hand-size boundary |
| `c2-p07-r1c1-ab03` / ランスロット2・成長 | Same optional whole draw package on the actual transformed character | Actual Uonos→Lia public reveal→LancelotII producer and subsequent Growth draw; cancellation |
| `c2-p01-r2c2-ab03` / チャム・見ちゃった | Once own turn, privately inspect one participant's complete followers separately from main action | Whole ordered hidden zone, frozen snapshot, ordinary attack priority, private acknowledgement and resume |
| `c2-p03-r1c2-ab02` / リーア・神出鬼没 | Own turn outside attacks, inspect one nearby participant's complete chants; optionally discard all seen | Near/attack restrictions, all/none, original-card revalidation |
| `c2-p03-r2c1-ab03` / レスター・噂 | Once own turn, spirit−3 then private hidden-character inspection | Success/failure, cancellation, Divine reroll, Fate force failure; no public identity flip |
| `c2-p04-r2c1-ab02` / アルセイル・占星 | Once own turn, spirit check then private whole hand and optional one seen card discard | Strict snapshot decision/card ownership, decline, empty hand, reload, cancellation/reroll/force failure |
| `c2-p02-r2c1-ab04` / ランカスター・わかんねえよ | Spend main action, discard all currently held normal printed magic techniques | Printed category/school, p18 normal attributes fallback, empty set, canceled action remains spent |
| `c2-p04-r1c1-ab04` / アイエル・双子 | Spend main action, exchange entire current hands with actual public Flaiard | Both canonical directions, unequal/empty hands, no new refill/OPEN, target revalidation |
| `c2-p06-r2c1-ab04` / フレイアード・双子 | Spend main action, exchange entire current hands with actual public Aiel | Independent exact source, owner need not be public, canceled attempt remains spent |
| `c2-p04-r2c1-ab01` / アルセイル・影 | Once own turn, spirit−1 excluding only TruePower replacement; hide own public character | Bonuses/drains/independent replacement retained; failure/cancel; hiding retains existing expiry |
| `c2-p04-r2c1-ab03` / アルセイル・本当の力 | Explicit voluntary hidden→public benefit; base spirit12 until saved actor's turn END | Setup/turn/attack/private-inspection reveal, cancel leaves public reveal; stopped/disabled suppression; counterattack, normal/skip/inactive-seat expiry |
| `c2-p05-r1c1-ab01` / ウーノス・策謀の主 | Once own turn, spirit−1 then forced hidden→public reveal | Self permitted; no voluntary TruePower; actual Lia/LanceII mandatory boundary and public allegiance cutoff |

Permanent independent source fixture: `packages/engine/test/fixtures/turn-information-sources.json`.
All seven adopted fields, including character name, are asserted against the catalogue by
`turn-information-abilities.test.ts`. Twelve unique whole sources are asserted separately.
New source modules are `turn-packages.ts`, `turn-information.ts`, `private-inspection.ts`,
`character-visibility.ts`, and `spirit-lifetime.ts` under engine abilities.
`turn-information-spirit.test.ts` covers C08 derived values and exact END boundaries;
`printed-turn-classification.test.ts` verifies runtime-independent printed classification.
Strict command-schema checks are in `packages/protocol/test/turn-information.test.ts`.

Every accepted command in the new engine transition suites replays JSON with identical entropy
and checks the exact 220 unique physical card IDs. Owning inspection is an explicit private
projection with no shared dossier; public windows expose only ordinary actor/reason. Original
inspected cards are revalidated in their original zone before discard; moved cards never cause
an unseen replacement to be discarded. Legitimate character reveals may create mandatory children
above an inspection; its saved snapshot remains owner-only and is restored afterwards. Accepted
attempts retain their own-turn budget across phase changes, cancellation, failure and reconnect.

Fixture limits are explicit: baseline identity/zone arrangements, mid-window availability/zone
changes, independent base replacements, and pending hand-size changes are structural scenarios.
The future unimplemented-magic fixture tests the pure printed classifier without adding a fake
physical card to a game. All currently printed magical techniques already have runtime entries;
Lancaster classification does not depend on those entries. Original p18 magic techniques encode
normal school in `stats.attributes` rather than `stats.school`; the normal-stat fallback reads
only that printed zone, never follower bottoms or character-specific overrides.

Engine evidence does not claim Web, real Durable Object or browser completion. Those integration
gates remain separately root-owned. Catalogue implementation flags remain pending, production
START remains disabled, and this slice does not complete all of Task 7.

## Task 7y / R0–R1 — 条件付き継続能力の再検証

対象は次の8能力。選択は初期OFF、使用宣言の成立後だけ保持し、印刷条件の成立と選択ONを区別する。

| 能力ID | 原典の能力 | 対応する処理 |
| --- | --- | --- |
| `c2-p02-r1c1-ab04` | ティアがんばる | 公開レスターによる精神力+1 |
| `c2-p03-r1c2-ab03` | この世界に愛を | 選択した公開他者+1と、公開ランスロットによる自身+2 |
| `c2-p03-r2c2-ab04` | 男ごときが | 現在の攻撃・防御相手が公開男性の場合の精神力+2 |
| `c2-p04-r1c2-ab03` | 竜皇子 | 竜属性の従者の士気判定値+2 |
| `c2-p04-r1c2-ab05` | 真実 | GOOD時の精神力+1、公開ガイナス/ウーノスへの効果Lv+1・ダメージ+2 |
| `c2-p05-r1c2-ab01` | 獣性 | 攻撃時の精神力+1、戦士技ダメージ+1 |
| `c2-p05-r2c1-ab05` | 我がライバル | EVILかつ公開ランスロットによる精神力+2 |
| `c2-p06-r1c2-ab02` | 闇の聖女達の情報 | 本人公開中の手札上限+2、ハジャと加算 |

出典の独立した固定入力は `packages/engine/test/fixtures/conditional-stat-sources.json`。
`conditional-stats.test.ts` は全8件の原典項目、使用・取消・不使用、対象更新、公開範囲、数値と保存状態を扱う。
有限コマンドの検証は `packages/protocol/test/conditional-stats.test.ts`。
実装は `abilities/conditional-sources.ts`、`conditional-selection.ts`、`conditional-stats.ts`、
`conditional-preview.ts` と `game-stats.ts` を中心に接続する。

一時不在、G15死亡確定前の致死保留、死亡処理後の選択消去、公開回復窓と私的・必須処理の区別は
[採用済みC15](second-edition/rulings-characters.md#c15--条件付きの継続能力2026-09-08暫定採用)へ同期した。
構造的な状態変更で条件の境界を検査するテストと、実際の宣言・回復・変身・死亡を通すテストを区別する。

R0・R1の現在ソースを再検証し、M0へ到達した。対象Engine/Protocol106件・関連346件、
Web197件・Worker437件・全型検査・指定ブラウザ64件（うち新規19件）が成功。
独立エンジン・画面/通信・実画像レビューは指摘なし。検査後372ファイルのハッシュ一致を確認した。
受け入れ証跡（`ledger-accepted-2026-09-15:docs/operations/evidence/2026-09-08-r1-acceptance.json`）へ保存。旧Task7yの件数からの推定ではない。
カタログはpendingを維持し、正式STARTの未対応ルール拒否を解除していない。


## R6 Task5 — 実操作の組み合わせ（2026-09-10）

Engine の `canonical-combinations.test.ts` と対応する DO 試験で、次の四列を検証した。

| 列 | 確認した成立経路 | 証跡 |
| --- | --- | --- |
| 生存VanmilとLia | 実禁止、Asfelt継続値停止、祝福、Lia実死亡で解除失効、実復活、新lifeで再祝福 | Lia life（`ledger-accepted-2026-09-15:docs/operations/evidence/2026-09-10-r6-canonical-lia-life.json`） |
| Vanmil死亡 | 死亡待ちまで指定保持、G15確定でC13を一回だけ確定 | Vanmil terminal（`ledger-accepted-2026-09-15:docs/operations/evidence/2026-09-10-r6-canonical-vanmil-terminal.json`） |
| 回収と再構成 | 同じ弓の追加回収宣言をFateで取消、即時補充のDawnで再構成、親終了時に一枚だけ廃棄 | Recovery Dawn（`ledger-accepted-2026-09-15:docs/operations/evidence/2026-09-10-r6-canonical-recovery-dawn.json`） |
| 多段と反撃死亡 | 実詠唱の天地百撃斬2対象3hit、Bの専用反撃からAだけに1hit7、B残14/C兵士軽減18、同時G15死亡をB→Cで確定 | Counter deaths（`ledger-accepted-2026-09-15:docs/operations/evidence/2026-09-10-r6-canonical-counter-deaths.json`） |

取消された追加回収宣言の札は解決領域に残り、予約は成立しない。
成立済み予約の保護は別の実占星術廃棄→Cham回収→保留補充再開の列で検証した。
夜明け・山札枯渇の両方で、再構成前後の二重取得拒否と正当な返却までの所属一意性を確認。
Engine では拒否前後のJSONと乱数消費ゼロ、DOでは拒否前後の保存状態と再起動後の同一エラーを検査する。
非公開の持ち技/使用歴の比較は全員パスの実経路を使い、第三者の投影と回収窓の順序を比較する。
予約・秘密窓の証跡（`ledger-accepted-2026-09-15:docs/operations/evidence/2026-09-10-r6-reservation-protection.json`）に対象tupleと実行結果を保存した。

これらは限定した組み合わせの証拠であり、R6全条件・全カードのacceptedを意味しない。
Task5の4列では、全操作/パスのexact220・JSON投影同値・全処理が空の安定終了をEngineで確認し、DOの各保存地点で全員の再投影を確認した。
共通invariant証跡（`ledger-accepted-2026-09-15:docs/operations/evidence/2026-09-10-r6-canonical-invariants.json`）を参照。
S01〜S32の最終出典対応と候補全体の検査は未完。
strict A31の未証明producerとR4-B1の秘密契約も、この列から完了とは判定しない。


R6 S01〜S32の出典本文・裁定ID・122件の具体試験参照と24件の過去実行証跡を
出典対応インデックス（`ledger-accepted-2026-09-15:docs/operations/evidence/2026-09-10-r6-scenario-source-index.json`）に統合した。
過去ログは全参照先が存在し、ハッシュを記録した。現在の試験ファイルの実行を過去ログから推定しない。
候補スナップショット（`ledger-accepted-2026-09-15:docs/operations/evidence/2026-09-10-r6-candidate-snapshot.json`）は既存バリデータの
`runtime-candidate-v2` 定義で1640ファイルを固定した機械的記録であり、成功実行receiptではない。
現在候補に紐付く実行結果と依存条項の受け入れは引き続き未完。


固定候補に対してEngine45ケース・DO47ケース・ブラウザ40ケースが成功し、
122件すべての具体参照を統合実行receipt（`ledger-accepted-2026-09-15:docs/operations/evidence/2026-09-10-r6-candidate-run.json`）へ紐付けた。
各層のJSON reporter原本と実行前後の候補一致を記録した。DOは参照外の同宣言tuple12件も実行している。
ブラウザはスキップ・失敗・flakyとも0。これにより現在候補のR6参照試験の実行は確認できるが、
依存条項のaccepted・独立レビュー・R7全ゲートの完了は意味しない。
