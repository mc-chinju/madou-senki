# Implementation progress

Goal: complete all eight tasks in `docs/superpowers/plans/2026-09-07-online-game.md`.
Started: 2026-09-08. Active rules: `second-online-v0.1-provisional`.

## Current phase (2026-09-08)

Current: consolidation and replanning at the user's request. Continue from the
[checkpoint](checkpoints/2026-09-08-implementation.md) and
[revised completion plan](superpowers/plans/2026-09-08-completion-plan.md).
Task7 remains open. Task7x has independent acceptance records; Task7y has an engine
implementation report but is NOT accepted. Its recorded freeze differs from the current
workspace in9 of154 owned paths. Current focused verification:95 passed /2 failed out of97.
The next implementation task is source reconciliation and those failures, then Task7y app,
DO/browser integration and independent reviews. Do not use old passcounts as current proof.

The remaining candidate list after excluding Task7x/7y has25 ability sources, including two
with existing lifecycle implementations that need clause-level reconciliation. This is not an
unimplemented count; Task7y's eight sources separately remain awaiting acceptance. Full action
card clauses, reclaim,32 original examples, formal START, human playtests and Cloudflare remote
verification are still open. The revised plan tracks M0–M4 completion gates rather than a
percentage inferred from task numbers.

2026-09-18: the ledger gate is retired. `verify:readiness` is gone from `build`, and the
ledger, its acceptance evidence and its scripts are frozen at the tag
`ledger-accepted-2026-09-15` (`1dd5eb9a`) instead of living in the working tree; see
[acceptance-policy.md](operations/acceptance-policy.md). Acceptance now rests on `pnpm test`
and the retained E2E suite. The test suite itself is being slimmed in four PRs per the
[test slimming plan](superpowers/plans/2026-09-18-test-slimming.md); the counts recorded
above and below are the measurements of their own time and are not restated here.

2026-09-18 (PR2): the E2E suite is now 31 tests in 25 spec files (30 selected in PR2 plus `public-record.spec.ts` merged from main), down from 2,173 in 221.
What remains is limited to what only a browser can show: real on-screen operation, restoring
after a reload, multi-seat synchronisation, HTTP/WebSocket body secrecy, login and operability.
Rule outcomes are verified in `packages/engine/test`, and the card-specific UI branches that
only E2E used to exercise now have `apps/web/test` unit tests.

## Current evidence

- Baseline: source verifier passed (5 originals, 221 extracted files).
- Baseline: second edition verifier passed (220 actions, 26 characters, 110 abilities).
- Git: historical runs began with unborn main. At the replanning audit, HEAD is `8c65d10`;
  only `conditional-preview.ts` was untracked before planning edits. No Git mutation was
  performed by this consolidation task. Preserve the current history and source.
- Harness: doctor succeeded, no run submitted. Execution proceeds in the current writable workspace.
- Package/toolchain installed: Node22.18, pnpm10.18, TS5.9.3, Vitest4.1.0 (Cloudflare peer compatibility).
- Generated246 2nd WebP images, source/output hashes verified. Representative action/person images visually inspected. Asset tests7 passed; independent scoped review of verifier fixes passed (spec and quality).
- Runtime catalog25 tests/typecheck passed; independent spec/quality review approved after round2.
- Protocol input validation implemented;22 tests/typecheck passed, independent spec/quality review approved after fix1.
- Task2 setup/private projection:66 engine tests (113 workspace unit total), typecheck passed; independent spec/quality review passed.
- Cloudflare SQLite storage slice:8 real-runtime tests + worker typecheck passed; independent spec/quality review passed. Room DO/WebSocket/outbox integration18 tests and dry-run passed; independent spec/quality review passed, combat-specific recovery fixtures still pending.

## Tasks

| Task | Status | Evidence / remaining work |
|---|---|---|
| 1 Catalog and rules | In progress | 220 actions / 26 characters / 110 abilities transcribed and verified; runtime catalog and 246 second-edition images reviewed. Full effect contracts, executable coverage gate and 32 source acceptance examples remain |
| 2 Setup and private views | Complete | Protocol22 + engine66 tests; independent reviews approved |
| 3 Combat and interruption | Complete | Bounded prototype116 engine tests,29 protocol, root/worker typechecks; independent re-review PASS; full effects remainTask7 |
| 4 Durable Objects | Complete (accepted foundation) | Task7x recorded372 Worker tests; includes combat/lifecycle/ability recovery, terminal receipt replay and private gift handling. Task7y integration is separate and pending |
| 5 Tables and sessions | In progress | Auth/lobby reviews approved and typecheck passed;34 Worker tests including read-only seat lookup; formal-start acceptance pending Task7 |
| 6 Playable browser | In progress | Actual 4/6/8-browser invitation, privacy, reconnect, combat, phone/touch automation passes. Latest broad run: 210/213 passed in18.4m; three defense-option failures corrected, then42 affected cases passed3.6m on final frozen sources with independent review approved; human operation and waiting-time checks remain |
| 7 Full rules | In progress | Slices7a–h independently accepted: direct techniques, saved rolls, status/lifetime effects, lifecycle/victory foundation and seven character abilities. Task7i ten combination/special techniques independently accepted after engine/UI fixes: 709 engine/protocol tests, 41 focused web tests, 18 focused browser cases, 46 Worker tests and global typecheck PASS. Task7j physical40 follower defense/placement and Magic Gate independently accepted after fixes: 890 engine/protocol baseline +219 covering reflection tests, full73 browser, 74 web, 56 Worker and global types PASS. Task7k eighteen dedicated follower attacks: 1023 engine/protocol, 82 web, 64 Worker and global types PASS; all7 new browser paths and affected29 PASS, independent engine and UI reviews approved after a co-source origin label fix (18 covering web tests and web typecheck PASS). Task7l C10 multiple follower attacks: 1091 engine/protocol baseline plus 233 covering tests after the current-source fix; 90 web and 72 Worker baseline, then 6 web / 8 Worker / global types and both amended browser cases PASS. Independent engine and UI re-reviews approved; frozen full87-browser regression PASS in 6.6m. Task7m Arnes/Lester/Tia entry abilities implemented: 1131 engine/protocol, 97 web, 81 Worker, global types and all7 new browser paths PASS. Live spirit conversion after source suppression fixed with actual child/resume regression; 758 covering tests, Worker81 and global types PASS after fix. Independent engine scoped re-review and root UI review approved; frozen full94-browser gate PASS in7.6m. Task7n five numerical abilities implemented: 1201 engine/protocol, 105 web, 96 Worker, global types and seven new browser cases PASS. Reflected numeric projection corrected with 264 covering tests and independent re-review PASS. Root review findings corrected with 18 covering web / 15 Worker / web and root types PASS; independent scoped re-review approved. Frozen full101-browser gate PASS8.4m. Task7o four follower-destruction abilities implemented: 1271 engine/protocol, 112 web, 109 Worker, global types and all7 new browser cases PASS. Independent engine review approved. Root review found a White Sword decline/cancellation evidence gap; additional exact numeric and reached-result assertions pass13 focused Worker tests and Worker types, with independent scoped re-review PASS/Approved. Frozen full108-browser gate PASS8.8m. Task7p 獣共感 implemented: 1306 engine/protocol, 120 web, 124 Worker, global types and all7 new browser cases PASS. Independent engine review approved. Root review evidence gaps corrected with18 focused Worker tests, Worker/E2E types and8 changed browser paths PASS; scoped re-review approved. Frozen full116-browser regression PASS9.5m. Task7q 瞬風・黒弓 and public maai progress independently accepted:1341 engine/protocol,127 web,138 Worker and all typecheck targets PASS;7 new browser paths PASS40.1s and20 affected existing paths PASS2.3m. Full123-browser suite not rerun. Task7r eleven received-defense packages and target-local display independently accepted:1393 engine/protocol,142 web,155 Worker baseline plus17 covering tests after root review fixes, all typecheck targets PASS. Eleven amended browser paths PASS47.2s and20 affected existing paths PASS2.2m; independent engine and root scoped reviews approved. Full134-browser suite not rerun. Task7s four rolling/final-damage defenses independently accepted:1448 engine/protocol,150 web,185 Worker and all typecheck targets PASS; ten new browser scenarios covered by eight initial passing cases plus two corrected same-viewer Grace reruns (15.7s), and23 affected existing cases PASS2.1m. Independent engine/root reviews approved; full144-browser suite not rerun. Full followers, remaining character abilities/cards, reclaim and catalog activation remain |
| 8 Delivery verification | In progress | Local/staging/production dry-run and separateEnvtypechecks pass; deploy/recovery docs added; independent config review PASS; remote/human/load remain |

Task7u mental defenses (魔詩・恐怖・魅了) are independently accepted after closing the fatal attacker chant-choice path and moving an expected-source fixture out of ignored scratch storage. Final web161/Worker233 and all typechecks passed; engine baseline full1530/1531 had one old privacy-test false positive, corrected view8 passed, followed by fix66 and relocated-fixture50 passing checks. New13 and affected27 browser cases passed. Full168 ran with167 passing and one old privacy assertion failure (14.0m); the assertion was corrected without runtime changes and both privacy cases passed8.3s, with scoped review approved. This covers all168 scenarios across those runs, not a single rerun green suite. Remaining full-card contracts, abilities/reclaim, formal START and delivery acceptance are still open.

Task7v implements eight mental-protection packages: three double-effect guards and five named responses, including Garwin stopping-only and Gad whole-spirit-technique immunity. Full1703 engine/protocol,165 web,271 Worker and all typechecks passed. New19 browser cases passed1.6m and affected37 passed2.6m on frozen sources. Independent engine and app integration reviews are approved. Full187 browser suite has not been rerun.

Task7w implements thirteen whole declaration-time packages with explicit selection for chant waiver, range/target expansion, counter conversion and numerical effects. The engine baseline1778 tests plus final36 and fix61 covering checks passed; final179 Web,336 Worker and applicable typechecks passed. Independent engine and app reviews are approved, including corrected defense option admission. The whole213 browser run passed210 and exposed three option expectations; the bounded correction and amended42 browser run passed3.6m, including all26 new cases and all three discovered failures. All213 scenarios are covered across those runs; this is not one green full213 rerun. Remaining character/card effects, reclaim, full catalog contracts, formal START and delivery acceptance remain open.

Detailed per-slice test and review history is retained in `.superpowers/sdd/2026-09-07-online-game/progress.md`; executable card coverage is in [coverage.md](rules/coverage.md). Passing aggregate tests does not activate pending catalog entries.

## Execution decisions

- Workspace execution: the original run began without a committed HEAD. The current audit
  has HEAD `8c65d10`; preserve its history and current working files. The environment still
  restricts Git metadata writes. No unsolicited commit/stash or old-snapshot restoration.
  Git integration remains separate from code verification.
- Shared workspace setup precedes Task 1 because its runtime catalog tests require the package/test infrastructure that the plan originally lists in Task 2.
- Pin Vitest to the 4.1 line required by the current Cloudflare Workers test integration, rather than the registry's latest major. Confirmed via package peerDependencies; lock exact installed versions.
- Do not call a partial-card prototype a complete game. Track handler/test coverage separately from transcription coverage.

## Requirements/interface preflight

| Tasks | Interface or consistency finding |
|---|---|
| 1 → 2,7 | Catalog must separate physical cards, play modes, named reclaim rights and implementation status |
| 2 → 3,4 | Serializable GameState; transition input actor comes from authentication; pure deterministic entropy boundary |
| 2 → 6 | PlayerView is an allowlist, never full state with hidden CSS |
| 3 → 4,6,7 | Window IDs/revisions, costs and continuations must persist; all-hit follower snapshot required |
| 4 → 5 | One DO transaction owns join/start; D1 is a projection |
| 4,5 → 6 | API/session/connection generation contracts must precede browser client integration |
| 6 → 7,8 | Limited combat usability check precedes full deck; full human playtests remain a distinct requirement |
| 7 → 8 | Full deck start must reject pending handlers; build/E2E alone cannot establish all effects |
| 1 | Runtime catalog tests need Task 2 scaffolding first; moved only that prerequisite |
| 2 | Setup must pause for OPEN/initial follower decisions, not silently approximate setup |
| 3 | General stack alone insufficient; explicit phase boundaries and simultaneous follower handling |
| 4 | Restore from storage, no in-memory-only pending state |
| 5 | Invite grants entry, not seat ownership; duplicate actor != duplicate display name |
| 6 | Test examples are future interfaces, not tests already passed |
| 7 | Source verification != runtime effect coverage |
| 8 | Deployment and human playtest evidence cannot be fabricated from local mocks |

Task7x implements twelve whole turn/inspection/visibility packages. Independent engine and app reviews are approved after scoped fixes. Full1905 engine/protocol baseline had1879 passing and26 strict-protocol failures; the parser correction passed the entire protocol plus new engine gate291, then the nested counterattack expiry correction passed201 covering tests and root types. Full188 Web/372 Worker and applicable types passed. New25 browser cases passed1.6m, affected32 passed1.8m, and an added hidden-twin/real forged-command case passed7.2s with scoped review approved. Frozen182 root texts/145 engine hashes were verified. No one full239 browser rerun is claimed.
