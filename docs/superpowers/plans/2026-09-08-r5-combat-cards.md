# R5 Combat, Remaining Cards, and R6 Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The current assignment is documentation only; do not execute this plan while the R3 browser uses frozen source. No commit or approval question is required by this plan.

**Goal:** Complete the remaining combat/death abilities and all 25 missing physical action-card producers, then close the exact S01–S32 evidence gaps.

**Architecture:** Extend the existing `ActionFrame`, `AbilityFrame`, reaction priority, roll continuations and G15 death batch; do not add another combat/death engine. New commands below are proposed finite protocol contracts grounded in those continuations, not existing APIs. Server-owned source/target eligibility and saved parent IDs determine effects; clients never submit arithmetic, effect descriptors or arbitrary zone mutations.

**Tech Stack:** TypeScript, pnpm@10.18.0, Node >=22.12.0, Vitest, Cloudflare Durable Objects, React, Playwright.

**Spec (tracked, authoritative):** `docs/superpowers/plans/2026-09-08-completion-plan.md` R2/R5/R6; `data/second-edition/characters.json`, `data/second-edition/aliases.json`, `data/second-edition/actions-01-06.json`, `data/second-edition/actions-07-17.json`, `data/second-edition/actions-18-25.json`, `data/second-edition/scenarios.json`; `docs/rules/second-edition/rulings.md`, `docs/rules/second-edition/rulings-characters.md`, `docs/rules/second-edition/rulings-actions-01-06.md`, `docs/rules/second-edition/rulings-actions-07-17.md`, `docs/rules/second-edition/rulings-actions-18-25.md`. R2's tracked `data/second-edition/runtime-coverage.json` and `data/second-edition/runtime-obligations.json` hold canonical clause/evidence and semantic obligations when integrated; unintegrated obligations remain acceptance-pending under the tracked source/rulings. Appendix A preserves missing-card clauses/adopted decisions and Appendix B preserves exact S01–S32 deficiencies for a fresh checkout.

**Supplementary audit notes (optional, not required inputs):** `.superpowers/sdd/2026-09-08-completion-plan/r2-character-inventory.md` and `.superpowers/sdd/2026-09-08-completion-plan/r2-action-inventory.md` are ignored local research. Their absence must not block execution, review or source enumeration; do not use them as the only binding for any existing producer or accepted clause.

## Global Constraints

- 「返り攻撃でも現在の攻撃者・対象・発生元を保持し、G07数値確定/G15同時死亡を維持する。」
- 「群ごとに独立レビューを閉じ、同時に複数の作りかけ群を残さない。」
- Printed restrictions and allegiance fields are mandatory; optional character abilities default to non-use. Do not expose a concealed character by publishing an unused option.
- Read existing adopted rulings, including online supplements, as adopted; original question lists are not newly unresolved requirements. Any new policy below is explicitly a proposed online ruling and cannot silently become an original rule.
- R4 owns suppression/release, normalized-name recovery counters, reservations, extra/unlimited rights, Fury's independent bow dice. Consume R4's reviewed interfaces and tests; do not duplicate those implementations here.
- Required R4 boundary: use the exact `offerReclaim(state, source:ReclaimSource):void` contract and finite `CHOOSE_RECLAIM` variants reproduced below from `docs/superpowers/plans/2026-09-08-r4-suppression-reclaim.md` R4-B. R5 emits typed actual use/discard/death provenance; R4 owns claim selection, budgets and event-completion release. A checker, a choice actor and a beneficiary are distinct identities.
- Invalid input must preserve state, entropy, hand and revision. Accepted canceled declarations retain paid costs and spent action/attempt budget. All commands use existing authenticated actor and room command-id/revision envelope; target event/window IDs must match the live continuation.
- Code tasks touch no original OCR/source text to make tests pass. Catalog/ledger acceptance requires reviewed clause bindings and fresh successful evidence; this plan and the inventory are not acceptance.

## Shared file ownership and verification cycle

Every numbered task explicitly includes modifying `packages/protocol/src/messages.ts`, `packages/protocol/src/validation.ts`, `packages/engine/src/view.ts` and `packages/engine/src/reactions/continuations.ts` only for its listed finite variants/fields. Add focused tests to `packages/protocol/test/r5-commands.test.ts` (new). In UI use existing `apps/web/src/game/AbilityPanel.tsx`, `ReactionPanel.tsx`, `LifecyclePanel.tsx`, `CombinationPanel.tsx`, `InspectionPanel.tsx`, `MaaiDefenseSummary.tsx` as relevant; create `apps/web/src/game/RemainingCardPanel.tsx` and `remaining-card-input.ts` for turn/anytime card choices. No admin DSL or raw JSON entry belongs in the UI.

Every task ends with the following independently reviewable cycle, after its specific examples are written:

```sh
pnpm exec vitest run packages/protocol/test/r5-commands.test.ts packages/engine/test/r5-<group>.test.ts
pnpm --filter @madou/worker test -- test/room-r5-<group>.test.ts
pnpm exec playwright test tests/e2e/r5-<group>.spec.ts
pnpm typecheck
```

`<group>` is the exact group slug printed in the task. Create the corresponding Engine, Worker and E2E files using that substitution. Worker fixtures are `apps/worker/test/fixtures/r5-<group>-scenarios.ts`; add each through the existing authenticated test scenario mechanism, never a production state injection endpoint. The Worker case must persist at the specified interruption, recreate the room from storage, resubmit the same command ID, and compare state/events/entropy/physical-card counts to uninterrupted execution. Browser cases must operate real buttons from two participants plus a spectator; verify legal use, non-use, cancel child, saved reconnect and denied foreign private IDs. Tests that only JSON-clone Engine state are insufficient Worker evidence.

For each task: (1) write the named failing Engine/Protocol examples; (2) run the targeted command and record the intended missing producer/assertion failure; (3) implement the bounded branch and save fields; (4) add/run Worker and browser cases; (5) run typecheck; (6) independent review and precise clause/evidence ledger update. No commits required. Expected final outcome is PASS, not an assertion that these unrun tests already pass.

## Task 1 — Distance abilities (`distance`)

**Files:** Modify `packages/engine/src/combat/attack.ts`, `combat/defense.ts`, `abilities/received-defense.ts`, `abilities/frames.ts`, plus shared files. Test files use group `distance` above.

**Interfaces/continuation:** Consume current `PLAY_MAAI`, `PLAY_ADVANCE`, `receivedDefenseOptions`, `resolveDefenseMaai` and actual group target/hit indices. Add optional `abilityId` to `PLAY_MAAI`, restricted to Cham ab01, Tia ab01, Lancaster ab03; Tia earth immunity uses existing `USE_ABILITY` bound to received hit. Persist `maai` election per target and hit with paid advance count, original action actor, returned-counter origin and ability source; derive required advances from the saved election, not a blanket player boolean.

- [x] Write table cases: Cham/Tia one maai survives one advance, fails after exactly two; normal one maai fails after one. Two targets with unequal elections share each attacker advance, without changing stored near/far distances. Next simultaneous hit starts fresh. Lancaster A attacks B; B's actual counter returns to A; A's elected maai cannot be canceled by B's advance. An ordinary incoming attack on Lancaster remains cancelable.
- [x] Add Tia use/decline cases against real magic-earth source: selected immunity cancels own hit before followers, decline receives damage; warrior-earth is not immune. Hidden choices are visible only to Tia until use. Cancel ability leaves original defense live; stale hit/foreign ability rejects with no cost.
- [x] Implement payment/threshold transitions using the existing maai resolution; preserve paid history through save after first advance and through suppression. Recheck live ability availability without erasing paid cards or rewinding completed exchanges. Save/restart must not charge the second advance twice.

Task1進捗（2026-09-09 04:38 JST）: ティアの地魔法無効だけ既存received-defenseに接続。実地槍の使用/辞退/取消、実初期配置兵士の保護、実ランバ専用2対象、宣言中の実Vanmil禁止を確認。対象51、実DO3、ブラウザ3、型・台帳12,109行valid。[証跡](../../operations/evidence/2026-09-09-r5-distance-earth.json)。戦+地の除外は構造検査と明示。間合い3能力、PLAY_MAAI有限選択、支払い/禁止/返り反撃の全条件が未完なのでTask1および飛翔全体は未完保持。レビューなし。

- [x] 印刷文の間合い効果を、通常の接近/離脱の応酬にも接続する。初回WITHDRAWの任意指定とPLAY_MAAIの任意指定を有限化し、間合い1枚に必要な追加踏み込み2枚を、支払い済み履歴・取消・禁止・保存復帰とともに検証する。上の戦闘中の受け入れだけで人物能力全体を完了にしない。

Task1戦闘中の間合い受け入れ（2026-09-09 04:58 JST）: チャム/Tiaの2枚要求、実Lancaster返り反撃、異なる2対象、実Griffin2発、実CHANT後Shin3発、実取消・実Vanmil禁止、保存/再送/UIを確認。対象固有103、実DO7、ブラウザ7、型・台帳12,109行valid。[証跡](../../operations/evidence/2026-09-09-r5-distance-maai.json)。印刷文は攻撃防御だけに限定されないため、接近/離脱を新たな未完チェックとして明示し、親距離群はまだ未完。レビューなし。

Task1接近/離脱の受け入れ（2026-09-09 05:13 JST）: 両人物の1対2枚、初回WITHDRAW/応答PLAY_MAAI、実取消・辞退、実Vanmil禁止後の即時回答移動、再応酬の支払基準、距離標への処分を確認。対象Engine/Protocol47、実DO4、ブラウザ4、型・台帳12,109行valid。[証跡](../../operations/evidence/2026-09-09-r5-distance-response.json)。距離3能力の列挙した受け入れは完了。レビューなし。

## Task 2 — Virtual ice/fire attacks (`virtual-blades`)

**Files:** Modify `packages/engine/src/effects/registry.ts`, `combat/legality.ts`, `combat/attack.ts`, `abilities/declaration-candidates.ts`, `abilities/frames.ts`, `state.ts`, plus shared files.

**Finite command:** New `DECLARE_VIRTUAL_BLADE {abilityId: 'c2-p04-r1c1-ab02' | 'c2-p06-r2c1-ab02', targetIds: string[], targetEventId?: string}`. A server-created discriminated source `{kind:'ability', abilityId, actorId}` is distinct from `{kind:'card',cardInstanceId}`. Save source, declaration stage, selected targets, checks and returned-parent ID in the normal ActionFrame; no invented physical card ID enters deck/discard.

- [x] Assert exact printed descriptors: ice near/magic/water Lv4 damage3, needs one additional maai; fire near/magic/fire Lv4 damage5, normal maai. Both require own public source and consume normal attack opportunity, with normal range/use-level/chant legality as applicable to the printed virtual profile.
- [x] Reject hidden source, wrong actor, supplied numeric descriptor and far target before consuming turn. Decline leaves action available; accepted Fate cancellation consumes the attack but creates no physical discard. Save in declaration and each roll; resume creates one group and conserves all 220 physical cards. Spectator sees only the declared virtual source, not candidate ability IDs.
- [x] Implement finite factory and reuse ordinary value freeze, counter/defense and cleanup. Do not make all printed follower bottoms or arbitrary abilities virtual attacks.

Task2受け入れ（2026-09-09 05:28 JST）: 正規2IDの物理札なし通常攻撃、印刷値/間合い、実取消/禁止/使用判定/神の振り直し、実氷鏡/妖撃破山剣、保存・再送・UIを確認。対象254（新規Engine15/Protocol1を含む）、実DO4、ブラウザ4、型・台帳12,109行valid。[証跡](../../operations/evidence/2026-09-09-r5-virtual-blades.json)。物理IDはnull、能力sourceを明示し、反射表示と効果発生元を分離。レビューなし。

## Task 3 — Shadow jump (`shadow-jump`)

**Files:** Modify `packages/engine/src/abilities/received-defense.ts`, `abilities/frames.ts`, `abilities/declaration-resolution.ts`, `combat/attack.ts`, `combat/legality.ts`, plus shared files.

**Finite command:** existing `USE_ABILITY` for Yotsurm ab01 bound to hit; new `PAY_SHADOW_JUMP {abilityEventId, advanceCardInstanceId}`. PASS on the saved cost choice declines; after payment existing `ATTACK` selects a legal physical technique, with server-fixed original attacker as sole target. No enemy check and no free attack source.

**Saved continuation:** `{parentGroupId,targetId,hitIndex,originalAttackerId,stage:'self-check'|'cost-choice'|'attack-choice'|'child',rollId?,paidAdvanceId?,childActionId?}` on AbilityFrame. Spirit−2 successful self-check marks the defended parent before opening optional cost. Cost is one real advance discarded without refill/marker. Child is follower-ignore and maai-prohibited with saved provenance; no extra turn, approach or withdrawal.

- [x] Use fixed self-check pass/fail and God reroll; successful defense survives declining cost or declining child. Cancel before check yields no defense; cancel accepted child does not undo already successful defense/payment.
- [x] Reject non-advance, foreign/already spent card, arbitrary new target, dead original attacker and stale cost choice. Verify normal range, chant and use level for selected child. Nested reflection resumes the exact parent once. Save at each of four stages; private hand choices leak to neither spectator nor attacker.
- [x] Implement by extending Ida's existing `ability-attack` return path (C09), not by creating a standalone combat phase.

Task3受け入れ（2026-09-09 05:42 JST）: 本人精神−2判定、実God振り直し、支払/攻撃辞退、実取消2段階、本人私有支払候補、子の射程/詠唱/使用判定、実初期兵士無視と間合い不変拒否、実氷鏡入れ子復帰を確認。対象固有110、実DO5、ブラウザ5、型・台帳12,109行valid。[証跡](../../operations/evidence/2026-09-09-r5-shadow-jump.json)。死亡した元攻撃者の拒否は明示した構造境界検査。レビューなし。

## Task 4 — Damage and mandatory fields (`damage-restrictions`)

**Files:** Modify `packages/engine/src/combat/hits.ts`, `combat/legality.ts`, `combat/combination.ts`, `combat/follower-bundles.ts`, `abilities/action-modifiers.ts`, `abilities/stat-context.ts`, `game-stats.ts`, `rolls/action-values.ts`, plus shared files.

**Interfaces:** 斬 uses existing optional ability election with actual action/hit identity. Save target-specific `maaiWasSubmitted` before consumption, and a source-scoped multiplier provenance. Mandatory Cham half, Fury black prohibition, Asfelt/Garwin conversion +2 are derived from character fields, not selectable abilities; no decline/cancel UI for them. Consume R4 live suppression for optional 斬 only. Conversion +2 applies to real faction-change resistance checks, not every mental roll or roll-free conversion.

- [x] Actual sword numeric5 becomes10 only when selected 斬 and target submitted no maai. Maai submitted then canceled by advance still prevents doubling; next hit has independent history. Non-sword, declined/canceled ability, null damage and other target remain unchanged.
- [x] Final rounding occurs after composition; odd Cham warrior5 becomes2, magic5 remains5. Installed ふぇありぃそぅど removes half only while attached; stealing it restores half.
- [x] Reject every actual black-technique route for Fury (normal, counter, chant selection and resolution, combination co-source, granted follower bottom); no paid cards/dice/state change on rejection. Suppression does not lift printed prohibition. Positive nonblack source remains legal.
- [x] Asfelt/Garwin conversion target spirit is effective spirit+2; ordinary mental-defense roll is unmodified. Mother truth/no-check resurrection generates no artificial check. Save a frozen check then alter continuous modifiers: do not recompute frozen threshold. Hidden base/allegiance values stay out of opponent projection.
- [x] Implement common source validation and hit arithmetic in existing composition pipeline; test mandatory behavior under ability suppression and revival. Include `composeValue` abstract base5+1 then ×2×0.5→6 separately from a real producer.

Task4斬の受け入れ（2026-09-09 05:55 JST）: 実剣5→10、実間合い取消済み履歴、実2対象・実詠唱後2ヒット、実Vanmil禁止前後、実初期兵士HPより前の倍化、保存・取消・UIを確認。対象166、実DO4、ブラウザ4、型・台帳12,109行valid。[証跡](../../operations/evidence/2026-09-09-r5-zan.json)。元の先頭チェックを斬と必須Cham半減に分け、後者は未完保持。Task4全体・親チェックは未完。レビューなし。

Task4黒技禁止の受け入れ（2026-09-09 06:06 JST）: 共通printedTechniqueAllowedを通常/反撃・co-source・従者bundle・CHANT・保存宣言へ接続。実黒魔法/実反撃/実詠唱受付/実Vanmil禁止後の不変拒否、非黒の黒翼飛翔剣と実妖精族の正例を確認。対象72、DO3、browser1、型・台帳12,109 valid。[証跡](../../operations/evidence/2026-09-09-r5-mandatory-fury.json)。既存黒詠唱の解決と宣言中人物変更は明示した保存状態境界。Furyの実所有従者は白の妖精族のみでC10付与もないため、合法な黒従者付与は主張せず、実黒bottomの共通拒否/無権限使用拒否を確認した。Task4残3チェックは未完。

Task4残条件の受け入れ（2026-09-09 06:17 JST）: 実Cham戦士5→2/魔法5→5と実禁止、実剣装着/窃取/再装着、両人物の実禁止後+2、実Peace後God振り直しで閾値保持、実Lester精神防御の+2除外と秘密投影を確認。実死亡→実Uonos無判定復活でCham/Fury必須欄保持、Asfelt/Garwinの実GOOD→死亡→無判定EVIL復活→後続抵抗+2を確認。対象87（新Engine14）、DO4、browser4、型・台帳12,109 valid。[証跡](../../operations/evidence/2026-09-09-r5-mandatory-fields.json)。前の斬/黒禁止と合わせTask4は完了。Task5以降・親R5は未完。レビューなし。

## Task 5 — Whole sad-love ability and substitution (`sad-love`)

**Files:** Modify `packages/engine/src/abilities/conditional-stats.ts`, `abilities/conditional-selection.ts`, `abilities/frames.ts`, `combat/attack.ts`, `combat/defense.ts`, `lifecycle/advance.ts`, `lifecycle/types.ts`, `state.ts`, plus shared files.

**Finite choices:** existing `USE_ABILITY` for Upa ab05 with finite mode `'aura'|'substitute'`, and existing non-use choice. Substitution binds group/hit target Arnes, never any selected player. Save aura election separately from once-game substitution attempt and `{substitutionEventId, originalTargetId, substituteId}` provenance. Consume R4 current availability. C15 explicitly excludes this compound ability; do not register it as an already-complete C15 record.

- [x] Implement all three clauses: selected aura grants Upa himself spirit+1 while Arnes public; once-game substitution before attack finalization; death attributable to that substitution grants Arnes permanent spirit+1, retained through concurrent death/revival. Tests must remove each clause independently and fail.
- [x] Positive substitution into an actual hit; decline leaves Arnes target; cancel retains paid attempt but no redirection; reject second use, late finalized death and wrong target. Apply A13 substitution restrictions: no followers/ordinary defense, legal counter or own ability only; block reciprocal/repeated chain. Save before redirection and after death reward marker; duplicate resume cannot add a second +1.
- [x] Proposed online ruling R5-P1: apply C15's explicit election/temporary suppression/lifetime rules to only the aura component, with its own flag; substitution stays one-game and permanent reward never disappears with suppression. C11's concurrent-Arnes-death retention is adopted as written. Record R5-P1 in the ruling document before coding its aura lifetime, identifying it as online supplementation, not print.

Task5受け入れ（2026-09-09 06:36 JST）: 3要素を別保存、有限USE_ABILITYと既存A13転送/死亡batchへ接続。実使用/不使用/Fate/Vanmil/祝福、通常防御拒否と本人能力/手札反撃、実2対象3ヒットの同時死亡→両人物の実復活で永久+1/使用済み保持を確認。各要素を独立に除去して対応テストの失敗を確認後、全て復元。対象119（新Engine17/Protocol1）、DO5、browser5、型・台帳12,112valid。[証跡](../../operations/evidence/2026-09-09-r5-sad-love.json)。R5-P1の新規3ブロックだけpending追加、既存statusは不変。Task5完了、Task6と親R5は未完。レビューなし。

## Task 6 — Absorption, hunger, Cham gift, existing lifecycle correspondence (`death-rewards`)

**Files:** Modify `packages/engine/src/combat/hits.ts`, `lifecycle/advance.ts`, `lifecycle/commands.ts`, `lifecycle/types.ts`, `abilities/frames.ts`, `state.ts`, plus shared files. Existing reference tests: `packages/engine/test/task7f-lifecycle.test.ts`, `task7g-lifetime.test.ts`, `received-defense-abilities.test.ts`.

**Finite choices:** `USE_ABILITY` for Dia ab03 / Yotsurm ab04 bound to server-created damage/kill opportunity; extend death decision with `CHAM_DEATH_GIFT {decisionId,cardInstanceId,targetId}` and PASS. Saved task holds batch ID, predeath effective spirit, source actor/action/reflect provenance, actual capped body damage, eligible surviving recipients, used reward IDs and moved gift ID. Pending-death Cham is specifically allowed, other inactive actors are not.

- [x] Dia heals exactly post-follower actual numeric body damage capped by victim remaining endurance and own maximum. Example body hit10 on remaining3 heals3; null-only instant death heals0. Test decline/cancel, multiple hits without counting prior damage twice, reflected effective source and simultaneous source death. Do not implement printed 吸魂 card's full-heal rider as this ability.
- [x] Yotsurm kills effective spirit8 victim and survives: heal to full, permanent warrior+2/magic+2 once for that victim. Spirit7, wandering, other actor kill, self-damage kill, own simultaneous death yield no reward. Two distinct eligible kills may reward twice; same victim repeated intent once. Recompute nothing after saving predeath snapshot.
- [x] Cham gives exactly one residual hand card to active eligible recipient, without A17/A18 cost or refill, before final disposal/outcome. Exclude all simultaneous victims; reject resolution card/duplicate card/foreign hand. Ability and printed death gift may both execute with different cards; same X cannot move twice. Decline/cancel leaves X for ordinary disposal. Only giver/recipient receive X identity.
- [x] Reuse beast-capture-before-gift ordering and `settleDamage`/death batch. Add correspondence assertions for actual Uonos ritual→Vanmil full heal, identity/noninheritance, optional subordinate/Arseil branches, and Vanmil death terminal result. Follow existing transform/objective handlers; create no duplicate ritual/ending ability producer. Save each boundary and verify no premature winner before gifts/protection finish.

2026-09-09 acceptance: saved predeath snapshots drive canonical Dia absorption and Yotsurm hunger through public lifecycle boundaries; hidden ownership does not narrow response order. Finite Cham gift shares the existing death decision and cancellable ability frame, with no physical source payment/refill and private card identity. Actual reflection, follower damage, multiple hits/later kills, simultaneous source death, both gift paths, ritual branches and Vanmil/Cham simultaneous death are verified; explicitly structural invalidation/absence controls are identified separately. Focused178/9 files, DO27, browser9, typecheck and ledger12,112 valid pass. Evidence: `docs/operations/evidence/2026-09-09-r5-death-rewards.json`. No ledger status promotion.

## Task 7 — Early turn, training and attachments (`early-turn`)

**Files:** Modify `packages/engine/src/turns.ts`, `rolls/turn-continuations.ts`, `game-stats.ts`, `abilities/stat-context.ts`; create `packages/engine/src/effects/remaining-turn-cards.ts`; shared files and RemainingCardPanel. Dependencies: Task4 mandatory half and existing draw/OPEN suspension, not general recovery.

**Finite command:** extend `PLAY_TURN_CARD {cardInstanceId, mode?:'ordinary'|'dedicated'}` only for the physical whitelist below. Save a turn-card ActionFrame with previous phase/action budget, roll ID, attachment destination and declaration stage. 秘伝書 is after initial replenishment and before ordinary action, consumes no ordinary action; the other cards use one ordinary turn action. Adopted A19–A26 decide failure/attachment disposition; Appendix A is required reading.

| Physical IDs | Producer and exact numeric boundary |
|---|---|
| a2-p03-r1c1 秘伝書 | Optional extra draw of d6 cards; persisted draw task resolves OPEN before resuming the same turn. |
| a2-p03-r1c2 ソロモン王の冠 | Attach self; magic+1 only earth/water/fire/wind; GOOD human follower morale+1 only. |
| a2-p03-r1c3 赤い水晶球 | Attach self; magic+2 only black/mental; EVIL human follower morale+2 only. |
| a2-p03-r2c2 修行（戦士技） | 2d6 strictly greater than current warrior succeeds +1; equality fails; Lancelot may select dedicated automatic success. |
| a2-p03-r2c3 修行（魔法技） | Same strict comparison against magic and +1 magic; separate physical producer and roll. |
| a2-p04-r2c1 ふぇありぃそぅど | Only Cham may install; removes own warrior half while installed. Discard rider is Task11/R4, not a new ability. |

- [x] Write positive tests d6=3 extra draw plus ordinary action still available; training stat6/roll6 fails/discards and roll7 succeeds/attaches; threshold includes unconditional installed/permanent corrections and excludes the not-yet-earned +1, Lancelot ordinary vs selected automatic mode produces/no roll; crown/water+1 vs mental+0, crystal mental+2 vs water+0; GOOD/EVIL human versus beast morale tests. Reject wrong phase/actor, wrong dedicated source, non-Cham install before payment.
- [x] Use actual declarations for every listed attachment and confirm accepted Fate cancellation spends card/action but grants no modifier. Verify live loss by 祈願 removes attachment effect and does not undo independent growth. Save during draw/roll/declaration; hidden base stats and draw identities remain private. Decline before declaration leaves hand/action intact.
- [x] Inspect existing 香具羅/魔導書/悪の魅力/聖光 and potion/REST producers for G05/G07/A33/A48 declaration compliance: adapt their existing bodies to the same declaration continuation only where missing. Do not call these additional missing main producers. Batch potion/REST consumes one action but has per-physical-card child cancellation; a canceled one leaves others resolving and retains paid budget.

2026-09-09 existing-producer acceptance: `payTurnCardBatch` pays the accepted list once, then saved `turnCardRemainingIds` creates one cancellable physical declaration at a time under the original root event. Potion numeric rolls are per source; each disposal finishes its public recovery response before the next child. Four existing attachments install only after their own declaration. Focused 100, additional batch suite 8 (7 overlap), actual DO 13, browser 11 and typecheck pass. Evidence: `docs/operations/evidence/2026-09-09-r5-early-turn-progress.json`. The new early-turn/training/crown/crystal producers and live removal via Wish remain pending.

2026-09-09 early-turn progress: Secret Book, both training cards, Crown and Red Crystal now have actual finite declarations and controls. Secret Book preserves its ordinary action and one opening opportunity through d6/OPEN/resume; training stores a greater-than check at the live unconditional level, with selected Lancelot no-check mode. Installed corrections use selected spell attributes and current-faction human morale, applying level additions before the zero floor. Focused 169, extra early-turn suite 23 (21 overlap), DO 18, browser 13 plus corrected 3, and typecheck pass. Every new source cancellation is covered. The second checkbox stays pending until actual Wish acquisition removes installed corrections without undoing independent growth. Evidence remains `docs/operations/evidence/2026-09-09-r5-early-turn-progress.json`.

2026-09-09 Task7 completion: real Wish acquisition now removes installed Crown/Crystal spell corrections, Book level, and Fairy Sword full-damage permission. Independent spirit growth from actual Keil protection survives later Crystal installation and Wish theft. The prior producer/cancellation/save evidence and these Task10 integration tests close the remaining second box. See `docs/operations/evidence/2026-09-09-r5-wish.json`.

## Task 8 — Conversion, exchange and private inspection (`turn-choices`)

**Files:** Modify `packages/engine/src/effects/remaining-turn-cards.ts`, `turns.ts`, `abilities/private-inspection.ts`, `rolls/turn-continuations.ts`, `lifecycle/objectives.ts`, `lifecycle/advance.ts`, shared files. Dependencies: Task7 declarations and Task4 conversion check context.

**Finite command:** `PLAY_TURN_CARD {cardInstanceId,targetId,mode?:'ordinary'|'astrology'}`; astrology permitted only for Arseil's 遠見. Existing inspection choice is bound to inspection ID and one currently inspected hand card. Persist selected target, mode, roll ID, private inspection snapshot, pending discard and saved turn continuation before displaying results.

| IDs | Timing, target and effect |
|---|---|
| a2-p04-r1c1 おまえはだまされている | Public other target; spirit−1 (Lia user −2); failure GOOD/objective EVIL extinction/protection Lia; success no conversion. |
| a2-p04-r1c2 魅了 | Public other target; spirit−1 (Uonos user −2); failure EVIL/objective GOOD extinction/protection Gainas. Physical card is not Dia's named ability. |
| a2-p04-r1c3 ディノンの書 | One selected player, exchange entire remaining hands after source payment; identities only to two participants. |
| a2-p04-r2c2 遠見の水晶球 | Own spirit check then privately inspect one identity; Arseil alternative is automatic astrology (whole target hand inspect and optional one discard), replaces identity look and does not consume separate character astrology use. |
| a2-p05-r1c2 母様の真実 | Non-Asfelt user, public Asfelt target, no check; GOOD/objective EVIL extinction/protection Lia, attached while GOOD. Removing card never reverses conversion; becoming non-GOOD discards it; already-dead Lia invokes protection before outcome. |

- [x] Actual physical card cases prove both ordinary and named alternate modes, check failure/success, +2 mandatory conversion context, fixed-faction protections and exact objective/protection state. Reject hidden conversion target, self where prohibited, wrong astrology identity and forged inspected card.
- [x] Decline choice before play changes nothing. Accepted cancellation performs no exchange/inspection/conversion but retains paid source/action. Save after spirit roll but before private choice and before protection continuation; restart only authorized viewer receives inspection identity. Swap includes all residual cards exactly once and reveals neither hand to a third party.
- [x] Implement by calling existing inspection/protection/goal machinery; do not reuse character ability attempt budgets for physical-card alternate use. R4 reserves owned red/遠見 crystal and conversion cards by normalized names after the real event only.

2026-09-09 Task8 acceptance: actual five physical sources and six ordinary/astrology controls, saved declaration/roll/private choice, fixed faction all-or-nothing update, mandatory resistance context, current objectives/protection and canonical owned recovery are connected. Focused 73 + information regressions 103, final targeted 26 (25 overlap), actual DO 24, browser 6 plus the additional no-mutation selection assertion, and typecheck pass. Evidence: `docs/operations/evidence/2026-09-09-r5-turn-choices.json`. Actual Wish removal remains a Task10 integration case and does not close Task7 or R4 remaining matrices.

## Task 9 — Anytime named responses and substitution (`anytime`)

**Files:** Create `packages/engine/src/effects/remaining-anytime-cards.ts`; modify `combat/attack.ts`, `combat/defense.ts`, `abilities/named-responses.ts`, `abilities/stat-context.ts`, `abilities/private-inspection.ts`, `lifecycle/advance.ts`, shared files. Dependencies: Tasks5/7 for redirection/declaration; R4 for Task11 recovery rider.

**Finite command:** `PLAY_ANYTIME_CARD {cardInstanceId,targetEventId,targetId?:string,groupId?:string,hitIndex?:number}` accepts only the finite response IDs below; Dispel uses the committed attack extension described next. `targetEventId` binds the relevant attack/ability/current action; no free text ability name. Optional named Cham cancellation uses existing named-response declaration bound to 人質 child. Resolve through reaction priority, immediate refill/OPEN suspension and a cancelable card child. Save original parent generation, cancellation scope, substitute response restrictions, temporary spirit end event and private inspection snapshot. Declining means PASS on that opportunity; no paid card. Dispel is the adopted A16 exception: `ATTACK {...,dispel?:{cardInstanceId:"a2-p02-r3c1",targetId:string}}` atomically commits its physical source with a legal attack and one member of its locked target set. A cancelable Dispel child resolves before the saved attack declaration, with no anytime refill. Omitting `dispel` declines it without spending that card. A free `PLAY_ANYTIME_CARD` Dispel is rejected.

| ID | Exact main producer |
|---|---|
| a2-p01-r2c3 アレキサンドリア城の悲劇 | Fail attack whose actual source actor is public Gainas or Dia; reject hidden/nonnamed source. |
| a2-p01-r3c1 聖騎士団長ケイルベイツ | Protect public Lancelot/Lia from attack; permanent spirit+1 only Lancelot, never Lia. |
| a2-p01-r3c2 ソロモン王の護符 | Cancel only Lester 魔詩, Dia 魅了, Gadula 恐怖 ability declarations; reject same-name physical cards. |
| a2-p01-r3c3 勇気 | GOOD user only; cancel Dia 魅了/Gadula 恐怖 abilities (not Lester); Lester check/return rider Task11. |
| a2-p02-r1c1 この世界に愛と平和を | GOOD user, other target, set spirit12 (not +12) until target action ends; preserve already-frozen rolls. |
| a2-p02-r1c2 啓示 | One player: privately show all hand/followers/chant; otherworld excluded. Reveal neither identity nor hidden cards publicly. |
| a2-p02-r2c1 身代わり | User receives another's attack; cannot use followers/ordinary defense; may use counter/own ability. Exactly one unresolved target hit, bound by groupId/targetId/hitIndex; no repeated transfer of that hit. Preserve prior follower damage/reduction; do not rerun original attack range/sex eligibility on new receiver. Third-party legal intervention remains available (A13). |
| a2-p02-r2c2 人質 | EVIL user; fail one GOOD actor's attack; public Cham may cancel card use, discarding it. |
| a2-p02-r3c1 呪払 | Destroy all golem followers of enemy being attacked; preserve nongolems and existing follower/death/recovery event distinctions. |

2026-09-09 progress: Courage remains connected. Tragedy, Keil, Amulet and Hostage now use actual physical payment/refill/OPEN, a cancellable child, saved source action scope and common disposal. Public Cham has the A14 card-specific Hostage response through the saved named-response flow; ability suppression and both Fate cancellation modes cannot cancel that response. Peace and Revelation now also have actual physical producers, saved action expiry/private history and out-of-combat continuation. Substitute now has a one-hit received group with deferred simultaneous settlement. Dispel has its committed physical attack producer; all three grouped acceptance checks below remain open. Evidence: `docs/operations/evidence/2026-09-09-r5-anytime-responses.json`.

- [x] Write each positive physical-card path and a decline/no-card-spent counterpart. Table tests select wrong faction, hidden named source, resolved target event, foreign card and protected substitute defense; expect unchanged state. Assert cancellation at the correct parent scope (target-only protection versus entire attack) using two targets and three hits, not a one-hit approximation.
- [x] Cancel each accepted anytime child with Fate: payment/immediate refill and OPEN effects remain (Dispel keeps payment but has no immediate refill), main effect absent, saved parent resumes once. For hostage, reject Fate's card-use and ability-use cancellation modes against Cham's card-specific response; accepting Cham cancels hostage only (adopted A14 Q3). Keil growth occurs once only on successful protection.
- [x] Save while refill OPEN pauses, during substitute response and while inspection is private; duplicate command returns same receipt without a second draw/growth. Spectator/other players cannot infer private hand/follower/chant IDs or unused Cham candidate from view. Test peace12 lifetime across nested counter and actual target action boundary.

2026-09-09 information progress: Peace stores base12 with a current causal action event or a next-own-action marker; accepted main action binds the latter before synchronous continuations finish. Existing frozen rolls remain unchanged, and actual returned counter coverage proves expiry after the enclosing attack. Revelation uses one three-zone private snapshot with zone-local positions, private historical copies, no character identity and no public reveal/reorder. Card inspection completion uses the existing physical disposer with a turn-card or reaction continuation. Both cards work without an active window and keep the interrupted phase/action through success or Fate cancellation. Focused156, actual DO31, browser2 and typecheck pass; evidence `docs/operations/evidence/2026-09-09-r5-anytime-information.json`. The full Task9 matrix remains pending; Substitute response restrictions were subsequently connected as recorded below. Dispel pre-declaration destruction was subsequently connected as recorded below.

2026-09-09 Dispel progress: `effects/dispel.ts` accepts only an owned physical Dispel plus a valid committed ATTACK and one locked target. It saves source/target life and a child-to-parent link, pays both sources without refill, and lets Fate cancel Dispel alone. Successful resolution removes every placed ゴ follower into physical resolution, emits only their public destruction identities, and uses follower-died sources with the original placement owner/life. Nongolems stay hidden and in order. Common disposal resumes the saved attack once; paid advance sources wait until Dispel completes. The pending pre-attack source is not offered to Tragedy/Keil/Hostage. Board, follower attacks and granted attacks share Dispel selection; omission preserves the card. Evidence `docs/operations/evidence/2026-09-09-r5-dispel.json`. The three grouped Task9 checks remain open for the remaining acceptance matrix.

2026-09-09 Substitute progress: `effects/substitute.ts` validates physical ownership, priority and exact sourceAction/group/target/hit plus source/recipient lives, pays/refills through the common OPEN lifecycle and cancels through Fate. Successful resolution marks only that original hit transferred and opens a nonphysical single-hit received group, preserving residual damage and original provenance. The receiver may use hand counters or its own abilities; no maai, ordinary defense, chant counter, follower defense or own physical anytime response is offered/accepted. Third-party Tragedy/Hostage/Keil keeps original attack scope. No range/faction/sex target selection is rerun on the new receiver, including an explicit same-faction reveal. Completed child results join the original group damage/death batch, while irrevocable fatal intentions stay visible; black-wing hit payments are shared once with the original group. Real two-target three-hit trajectories, actual follower destruction/reduction, counter, mental defense, water immunity, third-party Tragedy, OPEN, stale inputs and deferred fatal settlement pass. Worker payment/response/cancellation eviction and replay plus browser exact second-hit choice/reload/decline pass. Evidence `docs/operations/evidence/2026-09-09-r5-substitute.json`. All three grouped Task9 boxes remain open until the remaining per-source matrix has concrete correspondence.

Task9 specification correction: the former requirement to cancel Cham's Hostage response with Fate contradicted the already adopted `rulings-actions-01-06.md` A14 Q3. The test above now asserts the two rejected modes and successful Hostage-only cancellation. Current exact scope evidence includes real Shin two-target/three-hit Hostage, Gainas three-hit Tragedy, Gainas two-target Keil plus separate three-hit Keil, and preservation of an earlier target's settled damage. The former single-trajectory Keil gap is now covered by a legal late reveal: actual Shin first attacks concealed B and C with three hits; B begins follower defense, then reveals Lancelot/Lia, and C uses Keil at the B hit window. Reveal after follower start does not reopen the already closed normal defense or cancel those hits. Both actual character cases retain all three C hits (damage21), cancel all three B hits, and grow Lancelot alone. Save/replay equivalence is asserted at every accepted command. No illegal Gainas dedicated mode or allegiance conversion is used.


2026-09-09 acceptance: the three grouped Task9 conditions now have per-source correspondence in `docs/operations/evidence/2026-09-09-r5-anytime-acceptance.json`. The new34-case matrix covers all8 true-anytime sources for decline, foreign ownership and Fate after actual Dawn OPEN, plus applicable faction/concealment/resolved-event and hidden Cham privacy. Dispel remains separately tested without refill. Actual DO and browser save at Substitute refill before/after the Fusen roll and during its exact response; either real roll outcome resumes correctly. Earlier progress statements above describe their recorded historical state. Task10 remains unchecked.

## Task 10 — Wish acquisition (`wish`)

**Files:** Modify `packages/engine/src/effects/remaining-turn-cards.ts`, `turns.ts`, `lifecycle/advance.ts`, `game-stats.ts`, `abilities/private-inspection.ts`, shared files. Dependencies: R4 reservation exclusions; Tasks7/8 for attachments, Task9 inspection boundaries.

**Physical main producers:** both `a2-p04-r3c2` and `a2-p04-r3c3` independently parameterized. **Finite command:** `PLAY_TURN_CARD {cardInstanceId, mode:'wish'}` opens saved private acquisition decision. `CHOOSE_WISH {decisionId, source:{kind:'hand',ownerId}|{kind:'deck',cardName}|{kind:'public',cardInstanceId}}` uses a server-projected finite name/ID list. This is only wish's printed acquisition, not arbitrary zone mutation. No submitted hand card ID or deck index is accepted.

- [x] Test named deck search selects random physical duplicate then shuffles remainder; absent requested name allows reselect in same decision. Only user sees available names/counts, never order. Another hand is uniformly random and result private to old/new owner. Save chosen entropy/result before transfer; restart cannot reroll or duplicate acquisition.
- [x] Acquire attachment/chant into own hand, remove old state immediately; acquire own follower into hand; reject opponent placed follower, discard, resolution, reservation, distance marker, character, virtual source and every otherworld possession. Printed OPEN goes straight to public area; persistent ownership follows, previously triggered one-shot does not trigger again, unexposed deck OPEN triggers once.
- [x] Remove crystal/book/sword and check current modifiers/capacity. At child end choose follower/chant excess discards without offering irremovable follower; hand excess waits to turn end. Mother truth conversion remains after attachment theft. Decline before card play changes nothing; accepted canceled source has no private catalog/transfer. Save at private selection, shuffle, OPEN child and capacity choice; spectator sees no hidden identities.

2026-09-09 acceptance: both physical Wish copies use saved cancellable turn-card declarations and the common source disposal. Private selection exposes only deck name/count, random hand owners and finite public-zone choices. A concealed chant uses a decision-scoped opaque slot in `source.cardInstanceId`; it resolves to the saved physical position without disclosing the hidden name. Own concealed followers/chant identities also stay out of public acquisition logs. Selected physical result, random index, shuffled remainder and transfer commit atomically in one command; DO replay does not select again. The new `CHOOSE_WISH_CAPACITY` carries only the affected owner’s finite follower/chant discards; irremovable followers are excluded and hand excess remains until turn end. Actual OPEN first-publication uses the common lifecycle; already-public OPEN only changes owner. Actual prior CHANT/installation fixtures, both-copy DO12 and browser8, focused123 plus OPEN/setup/lifecycle49, typecheck and ledger12,109 valid pass. Task7’s remaining live-loss condition is also covered by real installation, Wish, Mother Truth conversion and Keil growth trajectories. Evidence: `docs/operations/evidence/2026-09-09-r5-wish.json`.

## Task 11 — Three combinations and name-based recovery riders (`combinations-riders`)

2026-09-10 集計訂正: 過去の「183/195」等は全220枚の対応数を誤ってOther195の分子に使っていた。黒流弓登録前は全体183/220、Appendix A24/25、Other159/195、登録後は全体184/220・Appendix A24/25・Other160/195（残35）。Other195はAppendix Aに列挙された正確な25物理IDを除外して数える。以下の過去履歴のOther分類・母数・残件数は本訂正が優先し、台帳の各条項statusは変更しない。これは全semantic行implementedの枚数で、ゲーム挙動acceptedの枚数ではない。[集計根拠](../../operations/evidence/2026-09-10-r5-binding-count-scope-correction.json)。

**Files:** Modify `packages/engine/src/combat/combination.ts`, `combat/follower-bundles.ts`, `combat/attack.ts`, `effects/combination-techniques.ts`, `effects/follower-attacks.ts`, `effects/remaining-anytime-cards.ts`, `effects/remaining-turn-cards.ts`, shared files. Dependencies: R4 recovery reservations, Tasks4/7/9.

**Finite command:** extend existing combination selection with whitelisted `combinationCardInstanceIds` at original ATTACK/legal counter declaration only; new `PLAY_ALL_ARMY {cardInstanceId:'a2-p05-r2c2',followerCardInstanceId,targetIds}` consumes exactly one hand follower with complete printed bottom. No client technique attributes. Save each parent/child source ID, roll/morale ID, dependent grant, attack-chain ID and source costs in ActionFrame.

- [x] `a2-p05-r1c3` おまえは、俺の敵でないっ！！: spirit+2 from accepted declaration through approach/children/counters/withdrawal completion; applies when user later defends against returned counter, never retroactively to a frozen roll or next independent attack. Reject standalone normal defense and after-dice addition.
- [x] `a2-p05-r2c1` 月の竪琴: combined mental technique effect+2 and numeric damage+4; null stays null, numeric0 becomes4. Reject nonmental or no effect-level card before payment. Save independent component cancellation and recompute only unfrozen values with surviving source provenance.
- [x] `a2-p05-r2c2` 全軍突撃せよ: one hand follower with full printed bottom attack values/range/attributes and ordinary legality; perform required morale. Reject placed follower, two followers or incomplete profile. On morale failure both cards discarded and action spent, no reselection/no ordinary follower-death recovery. Cancel parent, child declaration and morale separately: dependent attack fails when parent fails; already paid cards stay spent. Save at each declaration/morale boundary; no duplicate source in 220-card inventory.
- [x] 勇気 rider: public Lester (possibly different from user) elects own spirit check; success lets original card user choose return; failure/decline does not. Feed R4 reservation with claimant Lester and beneficiary original user; cancellation/used budget follow adopted A09 and G11, not unconditional physical return.
- [ ] ふぇありぃそぅど rider: when that physical card enters discard from any source, active public Cham may reserve for own hand; may reveal before this one reservation window ends; hidden/nonactive/death-disposal Cham not entitled. This is card-specific, not disabled by character ability suppression. Save reservation before shuffle; release once at parent completion. Recovery itself does not install/remove half until real turn play. Alias ownership red/遠見 crystal, inherited Lancelot and additional/unlimited rights consume R4 implementation.
- [ ] Dedicated Lia 必勝の祈り already works: verify one legal use→reserved inaccessible within same event→later-event second use, and rejection of same-event replay. Do not implement another prayer recovery path. Validate ordinary/dedicated, noChecks versus chant, all physical duplicate IDs and owned-name routes for the other 195 action cards enumerated from tracked `data/second-edition/actions-01-06.json`, `actions-07-17.json` and `actions-18-25.json` (220 IDs minus the exact 25 in Appendix A). Bind each source clause and mode to R2's tracked `runtime-obligations.json` and `runtime-coverage.json`; if its binding is not integrated, keep that clause acceptance-pending. A factory registration or optional local audit report is not acceptance.

2026-09-09 two-component acceptance: `combinationCardInstanceIds` accepts only A39/A40 at actual ATTACK or legal counter declaration. Both physical sources are paid immediately without refill; independent saved child declarations and the common disposer resume the same parent. Spirit+2 starts at acceptance, survives actual two-target/three-hit attacks, returned counters and real withdrawal, and expires on withdrawal completion or attack abort. Earlier approach results are unchanged: adopted A39 Q2 requires combining at a technique declaration, so there is no standalone approach producer or retroactive correction. Harp contributes only to unfrozen values, including real mental null damage and actual Ida numeric-zero damage. Invalid nonmental/no-effect-level source, ordinary evade, foreign/duplicate card and late addition are atomic rejections. Normal, follower and granted attack controls plus counter controls share the finite field. Focused124, actual DO5, browser3 plus final affected engine13/browser1, typecheck and ledger12,109 valid pass. Evidence: `docs/operations/evidence/2026-09-09-r5-printed-combinations.json`. All Army and the unchecked shared recovery obligations remain pending.

2026-09-09 All Army acceptance: finite `PLAY_ALL_ARMY` pays one real hand follower and A41 together, retains parent/child/life/root through independent declarations and required morale, and uses common named-card-used disposition for both. Actual Griffon, near Wood Golem after real approach, random Fairy, mandatory-all Earth Dragon, returned Lancaster counter and prior Peace main-action expiry pass. Incomplete/forged/foreign/placed/forbidden inputs reject unchanged; failure spends the action and both cards. Engine/Protocol and affected checks201, actual DO5, browser3, typecheck and ledger12,109 valid. Evidence: `docs/operations/evidence/2026-09-09-r5-all-army.json`. Recovery riders and the shared adapter obligations below retain their unchecked status.

2026-09-09 Courage rider acceptance: the existing actual card/check/common reservation path already satisfies this checkbox. Focused A09 engine10, actual DO2 and browser2 pass for distinct/same checker and recipient, reveal, success/failure/decline/cancel, one bound reroll, no base-name budget consumption and saved reservation/replay. The identical code passed typecheck and ledger12,109 immediately before this acceptance mapping. No new handler or unconditional return added. Evidence: `docs/operations/evidence/2026-09-09-r5-courage-rider.json`. Sword, Lia/other195 and shared adapter obligations remain unchecked.

2026-09-09 A31 refill crossing acceptance: real Revelation→Fusen revival before-roll→actual Arseil astrology→B hand sword discard opens the common reveal/claim window while the original draw remains queued. Hidden Cham take is reserved before that draw resumes into actual Dawn or natural exhaustion/rebuild, and both exclude the sword. The engine, actual DO and browser share `sword-shuffle-scenario.ts`; live discard/claim, eviction/replay and reload pass. Another real install→opponent Wish→opponent discard→living Cham recovery→attack2/reinstall→later attack5 proves return alone does not restore the installed effect. Focused47 unique Engine/Protocol, DO2, browser2 (Dawn assertion corrected), typecheck and ledger12,109 valid. Evidence: `docs/operations/evidence/2026-09-09-r4-sword-shuffle.json`. Exact positive deck-origin and active-Cham attachment-origin discard requirements remain unproven: the current rules/runtime have no direct deck discard producer, and actual attachment disposal is owner death; Wish moves attachments to hand. Do not create a fictional operation or count the indirect Wish trajectory as direct attachment disposal. Full A31 and shared adapter acceptance remain unchecked.

2026-09-09 Lia prayer subcondition acceptance: existing physical `a2-p05-r2c3` uses the common reservation, rejects actual same-event resubmission while inaccessible, returns once after the first attack, then is legally used and returned again during another actor's later real turn event. Ordinary own-attack prayer discards; ordinary other-actor prayer rejects. Engine11 (new3 plus reservation8), one complete two-event DO trajectory with every-command restart/replay, browser2, typecheck and ledger12,112 valid pass. Evidence: `docs/operations/evidence/2026-09-09-r5-lia-prayer.json`. The combined checkbox remains unchecked for other195 physical/mode/owned-name clause binding and shared adapter obligations; no new recovery path or ledger status promotion.

- [x] Other195のうち間合い／休息8物理IDの用途選択/排他/実被弾回避/休息通常行動/自己1回復/複数物理/合計枚数の8条項ずつをexact Engine parameterへ対応。新32を含む45、既存DO2/browser2、型/ledger成功。64行をimplementedへ（acceptedではない）、残る6 maai条項/各main-producer証拠/実行receiptは未完。[証跡](../../operations/evidence/2026-09-09-r5-maai-rest-bindings.json)。他195全体のcheckboxは維持。

- [x] Other195の間合い／休息8物理IDの残6 maai条項とmain-producerをexact parameterへ対応。実CHANT/3hit、追加1枚計2、実advance取消、実接近応答、実接近/攻撃後撤退、実間合い不可。新48含む83/DO4/browser4/型/ledger成功。新48行implemented、既存main8行のrelated証拠を差替。8枚の14用途条項＋main対応完了、候補固定receipt/acceptedは未完。[証跡](../../operations/evidence/2026-09-09-r5-maai-conditions-bindings.json)。残187枚と全体checkboxは未完。

- [x] Other195の踏み込み複合14物理ID（殴る4/蹴る3/弓5/斧2）の全11用途条項＋main-producerをexact tupleへ対応。実戦士閾値0/1判定、近/遠/属性/最終damage、実近接marker/no double use、実maai取消距離不変、実same-name advance不回収→別物理attack/base回収。新56含む63/型/ledger成功。代表DO4/browser4は同ターン直前の共有経路結果を再利用し14実物matrixと混同しない。新154行implemented、main14差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-advance-physical-bindings.json)。22枚の対応済み、他173と全体受け入れは未完。

- [x] Other195回復の薬2物理の全4条項＋main対応。実d6全出目/自己のみ/2枚独立2+5/上限/単体取消rollなし/先頭取消後2枚目5。新10含む17/DO1/browser1/型/ledger成功、新8行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-potion-physical-bindings.json)。24枚対応済み、他171と全体は未完。

- [x] Other195基本装着4物理の14条項＋main対応。実装着で指定stat+1/自己public attachment、実Fate取消、実次B手番Wish窃取→元stat復元/手札のみ効果なし、反対陣営不変拒否。新14含む37/実DO4/browser4/型/ledger成功、14行implemented/main4差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-basic-attachment-bindings.json)。28枚対応済み、他167と全体は未完。

- [x] Other195反応3物理（神性介入・命運凶変・必勝の祈り）の19条項＋main対応。実Alseil非公開拒否→公開取消/見送り、実Prayer独立d6→自己God2→6/確定まで親不変/使用Lv・damage不変、数値Fate/確定後祈り拒否。既存S01〜05/Lia実別手番/実能力取消へexact binding。新5含む58/DO4/browser5/型/ledger成功、19行implemented/main3差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-reaction-physical-bindings.json)。31枚対応済み、他164と全体は未完。

- [x] Other195見切る3物理の9条項＋main対応。実CHANT3hit先頭のみ無効→14/実2target他7、通常bow使用・見送り、実Fate取消、精神・回避禁止・他者・従者開始後拒否、実非精神炎矢無効。新21含む37/実DO3/browser3/型/ledger成功、9行implemented/main3差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-evade-physical-bindings.json)。34枚対応済み、他161と全体は未完。

- [x] Other195転移2物理の8条項＋main対応。未実装のヨーツルム任意判定+1を4REDで再現→専用受付/technique専用modifier/初期・再構成checkへ修正。同[3,4]普通6失敗/専用7成功、stat不変/次普通へ持越なし、精神可/実多hit・複数対象/失敗後別防御/Fate取消。新14含む62＋宣言関連32/実DO4/browser4/型/ledger成功、8行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-teleport-physical-bindings.json)。36枚対応済み、他159と全体は未完。

- [x] Other195受け流し1物理の13条項＋main対応。実incoming3/warrior2・3でcheck1・0/近遠不問/null damage/反属性、実Prayer3→9でも使用Lv/check不変・返しdamageなし、実失敗後別見切る/3hit先頭only/Fate取消/見送り/魔法・他者・従者開始後拒否。新7含む27/S09実DO1（他3選択外）/browser1/型/ledger成功、13行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-parry-physical-bindings.json)。37枚対応済み、他158と全体は未完。

- [x] Other195氷鏡1物理の17条項＋main対応。アイエル専用受付/noChecks/戦士無効と魔法上限の効果Lv連動を4実不足REDから修正。実炎舞6反射5/戦士6専用のみ無効/Prayer2→上限8・普通warrior不可維持/失敗・Fate取消/実上限超過/反撃禁止拒否。新9含む26/実DO3Prayer・evict/replay/browser3/型/ledger成功、17行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-ice-mirror-bindings.json)。38枚対応済み、他157と全体は未完。

- [x] Other195ミラーシールド/神王界2物理の31条項＋main対応。実攻撃Prayer0/1/2による魔法6〜8・戦士5〜7境界、普通/専用/初期LancelotII、required use check1/0、実防御Prayer2でMirror相対8/7・9/8対God固定6/-1、失敗/Fate/見送り/従者開始/反撃禁止拒否。新21含む38/実DO3/browser3/型/ledger成功、31行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-reflect-limit-bindings.json)。40枚対応済み、他155と全体は未完。

- [x] Other195結界2物理の20条項＋main対応。実魔法6/use6でmagic5・6のcheck1・0、両順序の実66失敗→別物理11成功、実Prayer2でもuse/check保持、実2target Bのみ無効/C6、実Fate/見送り/従者開始/戦士/反撃禁止/専用/攻撃拒否。新14＋既存選択2（他48skip）/実DO2両物理順・entropy変更再送/browser2/型/ledger成功、20行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-barrier-physical-bindings.json)。42枚対応済み、他153と全体は未完。

- [x] Other195狼牙/連槍撃2物理の35条項＋main対応。実2d6/3d6/近拒否→別札APPROACH、普通check1/0対専用0、連槍1発7/2発14・分割拒否、各発maai1/2、実初期兵士HP1×2で12/一度破棄、実Fate取消。新20＋既存variant選択6（他81skip）/新DO5全mode・entropy変更再送/browser5実専用・1/2発選択/型/ledger成功、35行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-wolf-lance-bindings.json)。44枚対応済み、他151と全体は未完。

- [x] Other195閃光槍/妖撃破山剣2物理の41条項＋main対応。実通常/専用root・counterとuse5/不足判定、Lancaster専用は別spirit判定・実炎舞+Prayer2のLv8を無効/7返し・返しのみ従者無視、Mountain通常攻撃判定維持/反撃免除・実APPROACH・遠block/黒死属性破壊。Fate・失敗後別防御・禁止/従者開始/外国所有者拒否。新27＋既存S06〜10の4＋関連選択4（他133skip）/新DO4全command保存evict再送・entropy変更/browser4実防御選択/reload/型/ledger成功。41行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-spear-mountain-bindings.json)。46枚対応済み、他149と全体は未完。

- [x] Other195竜殺天空槍1物理の19条項＋main対応。実任意CHANT/全員の実手番後、普通10/専用15・詠唱普通10/専用30、use6不足1/0対専用0、任意2対象/実全従者破壊/片対象Evade。実Fate取消・成功処分の双方でbase回収→後の手番hand再使用15、同陣営公開後の対象拒否も保持。新13＋既存選択7（他80skip）/新DO5全command保存evict再送/browser4実CHANT・手番・選択・reload/型/ledger成功。browser初回非詠唱2成功/詠唱2locator誤り、選択ボタンへ修正し該当2のみ成功。19行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-dragon-spear-bindings.json)。47枚対応済み、他148と全体は未完。

- [x] Other195光竜剣/光竜破山剣2物理の53条項＋main対応。初期I/IIの通常・前段・継承前段・後段8mode、実別APPROACH/必須CHANT全介在手番、use6/7不足1/0対専用0、Sword6/10/15・maai1/2、Mountain10/共有4d6+1=15/25・前段詠唱維持/後段免除。実黒死属性破壊/Fate8mode/外国所有者・部分混合・対象拒否。新32＋既存選択17（他70skip）/新DO8保存evict再送・numeric後entropy変更/browser8実source/variant選択・reload/型/ledger成功。DO/browserはcanonical実command準備後の攻撃以降。53行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-white-dragon-bindings.json)。49枚対応済み、他146と全体は未完。

- [x] Other195撃戦斧/剛戦斧/死戦斧3物理の44条項＋main対応。実初期従者Lv5/6/7で専用固有破壊、普通は防御/王立騎士反射。超過6/7/8は生存、8は実Blessing取得WaterDragon。実Prayer2後もfixed5/6/7不変・超過従者は固有破壊でなく通常同Lv比較、use4/5/6不足1/0対専用0、各target maai1/2、Death専用2target、実Fate/接近/外国owner拒否。新35＋既存選択10（他77skip）/新DO6全攻撃以降command保存evict再送/browser6実専用・follower結果/reload/型/ledger成功。44行implemented/main3差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-ramba-axes-bindings.json)。52枚対応済み、他143と全体は未完。

- [x] Other195滅殺斧1物理の17条項＋main対応。実CHANT/全介在手番の普通12、専用hand/chantとも20・use7不足1/0対専用0、任意2target・B Evade/Cのみ被弾・WaterDragonHP4で16。実Fate3mode→base回収→後のhand普通拒否/専用20、成功普通→回収も実再CHANTで12。新12＋既存選択4（他83skip）/新DO4全CHANT・手番・取消回収再使用の保存evict再送/browser3実全行程/reload/型/ledger成功。DO長経路初回5秒timeout、当該宣言15秒枠として失敗1のみ成功（他3skip）。17行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-annihilation-axe-bindings.json)。53枚対応済み、他142と全体は未完。

- [x] Other195破山剣/破砕剣2物理の33条項＋main対応。実黒/死従者Lv4境界・5/6超過、Prayer1/2で効果Lvを上げ属性破壊、非該当Metalと破砕剣は通常同Lv比較。普通4/4・Lia4/5・Lancelot/II5/6、use4不足1/0対専用0、初期Lancelot/II通常不選択対照、実Fate/maai/APPROACH・専用禁止。新36＋既存選択6（他81skip）/新DO6実Prayer保存後entropy変更・全攻撃以降command保存evict再送/browser6実owner・Prayer/reload/型/ledger成功。33行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-mountain-breaker-bindings.json)。55枚対応済み、他140と全体は未完。

- [x] Other195炎矢/炎舞/爆炎3物理の48条項＋main対応。実magic use4/6/6不足1/0対専用0、通常damage5/5/10→専用8/8/13、炎舞だけ見切禁止・他2は実Evade、1maaiでBのみ防御/専用C維持、実兵士HP1、Fate6mode。実Gil沈黙→66失敗・実後続手番で専用もSILENCED、外国owner/CHANT/variant拒否。新39＋既存選択11（他88skip）/新DO6全command保存evict再送・Dance拒否時保存不変/browser6実見切候補有無/防御/reload/型/ledger成功。48行implemented/main3差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-fire-magic-bindings.json)。58枚対応済み、他137と全体は未完。

- [x] Other195炎流/烈火2物理の34条項＋main対応。通常5/5・7/15、専用6/8・8/18、use5/7不足1/0対専用0、両方普通/専用とも実maai2枚・1枚では命中/同一札再使用拒否。烈火普通は実CHANT/全手番必須、専用hand/chantとも18、実Fate5mode→base回収→後の普通烈火は実再CHANTが必要。実Evade/兵士HP/専用禁止。新23＋既存選択6（他93skip）/新DO6全CHANT・手番・取消再使用・2maai command保存evict再送/browser5実全行程/reload/型/ledger成功。台帳の誤ったturn.ts参照だけ既存turns.tsへ修正。34行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-heavy-fire-bindings.json)。60枚対応済み、他135と全体は未完。

- [x] Other195地槍/地流2物理の30条項＋main対応。通常effect4/5・damage6/4→専用effect4/5維持・damage9/7、use4/5不足1/0対専用0。実maai1/2・同一札再使用拒否・Bのみ防御、Evade/兵士HP1、実Fate4→base回収→実後続手番再使用、実Silence/外国owner/CHANT/variant拒否。新26（初回24pass/2profile期待値誤り、既定maai1の比較を直しprofile4成功）＋既存選択6（他93skip）/新DO6全command保存evict再送・専用2取消回収再使用/browser4実1/2maai/reload/型/ledger成功。30行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-earth-magic-bindings.json)。62枚対応済み、他133と全体は未完。

- [x] Other195風矢/魔風/雷走3物理の48条項＋main対応。普通use4/5/5・effect4/5/5・damage4/4/7→専用effect5/6/6・damage7/7/10、use不足1/0対専用0。魔風/雷走は普通からEvade禁止・風矢は実Evade、全6実1maai・兵士HP1、Fate→base回収→後続手番再使用、実沈黙・外国owner/CHANT/variant拒否。新39＋既存選択9（他90skip）/新DO6全command保存evict再送・見切拒否時保存不変/browser6実候補有無/防御/reload/型/ledger成功。48行implemented/main3差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-wind-magic-bindings.json)。65枚対応済み、他130と全体は未完。

- [x] Other195裂風/撃雷2物理の38条項＋main対応。裂風普通6/7→専用7/12・実空WaterDragon無視/後列兵士HP1・非空砦対照/maai2。撃雷普通7/12→専用8/18・両mode実CHANT/全介在手番、実6人で普通4target上限/専用5target、建砦HP2を維持し通常Lv比較で破棄・専用非建兵士/WaterDragon固有破壊。Fate4→base回収→後続手番/撃雷再CHANT、use不足1/0対専用0・Evade/外国owner拒否。新22＋owner強化4再試験＋既存選択9（他90skip）/DO6全command保存evict再送/browser4（初回撃雷2失敗、回答者revision同期・撃雷90秒枠で2成功、影響裂風2も再成功）/型/ledger成功。38行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-storm-magic-bindings.json)。67枚対応済み、他128と全体は未完。

- [x] Other195氷矢/凍流2物理の34条項＋main対応。use4/5・effect4/5→専用6/7・damage4→6、use不足1/0対専用0、maai1/2・Evade/兵士HP/Fate回収再使用/実沈黙。T23実水竜7は無視trueで6/生存、false/PASSで0、実祝福取得水竜8はeffect7超過、実Prayer1/2で8/9なら無視可能。B防御時はCだけ選択、対象別C見送り、誤回答者/二重選択拒否、初期敵Shinへの成功無視→回収→後続使用は改めて見送り可能。新35（単独兵士fixture2fail→修正4成功、追加再使用は同陣営公開相手拒否→初期敵で成功）＋既存選択8（他91skip）/DO6攻撃以降全command保存evict再送・Prayer1保存後entropy6/ browser6実祈り・対象別無視/見送り/reload/型/ledger成功。34行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-ice-magic-bindings.json)。69枚対応済み、他126と全体は未完。

- [x] Other195氷狼乱舞陣1物理の20条項＋main対応。普通実CHANT/全手番7、専用hand/chant14・use7不足1/0対専用0・Evade拒否/1maai。実王立騎士5固定破壊7、Metal6通常HP5/2・Prayer2/effect9でも固定5維持。実Blessing水竜8は普通effect7blocked0、Prayer1equal0/Prayer2lowerHP4で3、専用effect8/9は固有破壊14。Fate3→base回収→後続hand専用14、普通成功後は実再CHANT必須、外国ownerも実CHANT後拒否。新20＋owner強化1再試験＋既存選択3（他96skip）/DO5実CHANT・全手番・取消再使用・Prayer保存evict再送/browser4実詠唱・専用・見切候補なし/祈り/reload/型/ledger成功。20行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-ice-wolf-bindings.json)。70枚対応済み、他125と全体は未完。

- [x] Other195毒流/氷結2物理の37条項＋main対応。毒流普通4/専用4、対象抵抗0失敗だけ追加6。氷結普通4/専用8・初回/以後回復−1/−3維持、実転移失敗で手札4→抵抗失敗停止→全介在手番/回復失敗4維持・手番skip→次成功で5補充/通常draw。専用も対象判定必要、同出目4で通常成功/専用失敗、maai/Evade対象局所・Fate取消・禁止。Engine24＋既存選択6（他44skip）/DO8全command保存evict再送・実回復失敗成功/browser6実攻撃4＋実回復2/reload/型/ledger成功。37行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-water-status-bindings.json)。72枚対応済み、他123と全体は未完。

- [x] Other195錯乱/鏡封/催眠3物理の54条項＋main対応。全use4/null damage・専用effect5/7/5/noChecks/allでも対象抵抗あり。錯乱初回−2/回復普通−1専用−2・能力無効でも実手番/魔導書装着可能、鏡封毎回−2/催眠初回−2以後−1で停止/回復失敗skip。実転移失敗で手札4、全介在手番/失敗/成功、実選択リーア精神+2の無効/復帰、錯乱専用水竜7/建砦3全破壊と対象外従者維持、maai局所/精有無でEvade可否/Fate取消/禁止。Engine44対応（初回41＋従者6/能力2再成功）＋既存10/DO12対応（初回11＋時間超過1を同設定再成功）/browser12/型/ledger成功。54行implemented/main3差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-alseil-status-bindings.json)。75枚対応済み、他120と全体は未完。

- [x] Other195木の葉隠れ1物理の23条項＋main対応。普通/イダ専用use3不足判定1/0維持・実失敗は専用も防御不成立。実Prayer6のincomingLv10/戦士Lv5にもLv3で使用、普通は敵Shin精神−1成功で5/失敗0、専用は敵判定なし0/シン例外なし。実天地CHANT/全手番→3hit×2targetはB先頭only無効14/C21・追加攻撃窓なし。炎風/反撃禁止/外国専用/自手番attack・CHANT拒否、Fate取消5、敵成功後実Evade0/同札retry拒否。Engine21＋既存3/DO6/browser4/型/ledger成功。23行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-leaf-defense-bindings.json)。76枚対応済み、他119と全体は未完。

- [x] Other195滅界1物理の22条項＋main対応。実ウーノス儀式→Vanmil/全手番、普通/専用とも実CHANT/use10不足1/0維持・effect10/damage20。実対象水竜7/建砦3全破壊20、自分Metal6/兵士も破壊し普通10/専用0。実使用失敗/Fate取消/転移/閃光槍反撃でも自身破壊/自傷だけ独立維持、Lamba能力半減可/maai・Evade拒否。合法初期通常Lancelotの対象20/自傷10同時死亡集合と未確定勝敗。Engine15対応（初回14＋初期耐久fixture修正1再成功）＋既存8/DO6実CHANT以降全command/browser4実詠唱/転移/reload/型/ledger成功。22行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-mekai-physical-bindings.json)。77枚対応済み、他118と全体は未完。

- [x] Other195呪殺1物理の17条項＋main対応。普通/専用とも実CHANT/全手番・effect7/damage14維持、use7不足1/0対専用0・実普通失敗0。実Metal6は精で通過/HP軽減0/伏せ生存14、C兵士独立13。黒属性の実守護者8はPrayer0/1/2でeffect7blocked0/8equal0/9lower14。maai/Evade拒否・転移Bのみ0、Fate取消→base回収→実再CHANT→モード変更再使用。Engine18対応（初回12＋士気2d6入力修正6再成功）＋既存3/DO4全CHANT/回収再使用/browser4実詠唱/転移/reload/型/ledger成功。17行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-curse-physical-bindings.json)。78枚対応済み、他117と全体は未完。

- [x] Other195復活1物理の20条項＋main対応。実魔導書/兵士配置→実攻撃2死亡、普通は実CHANT/全手番/use10判定・専用は手札/詠唱から任意複数/判定免除、順次再setup/新手札5/旧装着不復旧・Fate取消。初期変更可能14＋条件付き2と固定6の実死亡、実GOOD/EVIL陣営変更後のウーノス現在目的/保護参照コピー。リーア死亡は終局拒否として区別。Engine36対応＋既存9/DO6保存evict再送/browser4対応（初回3＋普通combobox修正1）/型/ledger成功。20行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-resurrection-physical-bindings.json)。79枚対応済み、他116と共有T31/T32/G16/全体は未完。

- [x] Other195封獄死霊陣1物理の20条項＋main対応。実CHANT/全手番/use8不足1/0対専用0・effect8/damage10/魔黒詠・GOOD/maai制限維持。Metal6/兵士はHP減なし10、実祝福Guardian9でblock0・黒Guardian8同値破壊10・Prayer1下位破壊10。命中ごと任意停止/1d6共有・本人3手番のみ減算/回復判定なし/次draw復帰。実CHANT後GOOD変更Uonos両mode拒否・転移対象局所/Fate取消。Engine21＋既存3/DO4全command保存evict再送/browser4実選択/共有期間/全手番満了/reload/型/ledger成功。20行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-prison-physical-bindings.json)。80枚対応済み、他115と共有T33/全体は未完。

- [x] Other195治癒/封傷2枚の3物理44条項＋main対応。実炎矢A5/氷矢B4、普通自己0/B4・Jill実接近/専用B0/A5、use5不足1/0維持/詠唱なし/チェック免除なし。実使用失敗/Fate取消・不適格/遠/複数/他手番拒否。実沈黙/実回復失敗後、治癒は損傷のみ回復し沈黙保持、魔法全mode不可。Engine25＋既存9/S24回収1（使用チェック5も再確認）/DO10全command保存evict再送/browser5対応（初回3＋距離行列参照修正2）/型/ledger成功。44行implemented/main3差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-healing-physical-bindings.json)。83枚対応済み、他112と共有T37/全体は未完。

- [x] Other195吸魂/死心盗2物理49条項＋main対応。実炎矢Dia5、吸魂実接近/専用遠・死心盗両mode実CHANT/全手番、use7不足1/0対専用0・対象抵抗維持/専用effect8。精神Metal通過/Water無視、黒Guardian8で普通block・専用同値・Prayer9下位命中。吸魂B/C/both/none選択・実死亡成立後のみ全回復、実base回収/再使用で0下限累積→実死亡→実CHANT復活で低下消去。死心盗実転移失敗手札4→実本人回復−1/−3成功で全状態解除/5補充、失敗は死亡/手札0/本人行動不可。Engine40対応＋既存11/DO12対応/browser5対応/型/ledger成功。49行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-dia-lifetime-physical-bindings.json)。85枚対応済み、他110と共有裁定/全体は未完。

- [x] Other195裂界1物理28条項＋main対応。両mode実CHANT/全手番・use7不足1/0対専用0、effect7/8・damage8/12、通常最大3/専用5。Metal/Water保持、白Guardian7同値で無命中・Prayer普通8/専用8で命中。対象ごとの任意−3/0と抵抗成功でも実損傷保持、失敗で異次元・実手札/従者/B詠唱保持・本人手番skip/接近/啓示/祈願拒否。実祈願Dawn取得で全員一度帰還、実転移失敗手札4も無補充/再setupなし。Engine19＋既存5/DO4全command保存evict再送/browser2通常3人・専用5人実帰還/reload/型/ledger成功。28行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-rift-physical-bindings.json)。86枚対応済み、他109と共有T35/全体は未完。

- [x] Other195死刻鎌1物理19条項＋main対応。両mode実CHANT/全手番・戦use7不足1/0対専用0、effect7/damage8/戦鎌詠・見切り禁止維持、専用全3人。Metal6/HP5で実3、兵士2/HP1で7、Guardian同値は命中なし・Prayer8下位命中。専用B/C/both/none任意要求→精神−2閾値4・成功body保持/失敗即死予定、C評価までB生存損傷0で同時集合死亡。実転移局所/Fate/普通失敗・実base回収/次CHANT/モード変更再使用。Engine23対応＋既存3/DO6全command保存evict再送/browser3実詠唱/任意B死亡とC不使用/reload/型/ledger成功。19行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-scythe-physical-bindings.json)。87枚対応済み、他108と共有T12/G15/全体は未完。

- [x] Other195石化1物理9条項＋main対応。実CHANT/全手番・魔use7不足1/0・effect7/damage5/魔地詠/遠。命中前損傷0・精神0成功body5、失敗石化即死と5を同時集合へ、初期耐久5/100とも死亡1回/死因event保存。Metal6/HP5でbody0でも石化判定、地無効従者/Guardian同値は判定なし・Prayer8命中。実Evade/転移/Fate/使用失敗、実石化死亡→普通復活CHANT/3使用判定/再setup手札5。Engine15＋既存4/DO5全command保存evict再送/browser2抵抗成功・死亡から実普通復活/reload/型/ledger成功。9行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-petrify-physical-bindings.json)。88枚対応済み、他107と共有F04/G15/全体は未完。

- [x] Other195魔招門1物理14条項＋main対応。実初期配置own0/1/2・donor2、手札から魔use5不足1/0/null/魔/非CHANT手番。実前後衛8通りの1枚取得・相手後衛圧縮/自身相対順保持、満枠市民を先払い/F31自発廃棄不可・donorF31強制取得可。伏せ兵士/不適格城は同候補/宣言受付、城取得失敗は支払い保持し正体非公開。実Fate/使用失敗/不正zone・位置・actor拒否。Engine17＋既存11/DO6全command保存evict再送/browser4配置/秘密失敗/reload/型/ledger成功（browser初回exact label待ちをcombobox指定へ、残E2E server片付け後4再成功）。14行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-gate-physical-bindings.json)。89枚対応済み、他106と共有T49/全体は未完。

- [x] Other195疫病1物理17条項＋main対応。実初期従者/非CHANT手札攻撃、魔use5不足1/0対専用0・effect5/damage12/魔黒/見切り不可・専用全3。固定6でMetal6/兵士破壊HP減なし12、死Skeletonは通常HP4で8/Wight5同値0、Water7はPrayer2effect7でも固定閾値外で同値0。実隠/公開Gadyuraは従者破壊後本人無傷/状態維持、専用実神王界反射も源従者破壊/本人0・B防御/C8D12。実Evade拒否/転移局所/Fate/使用失敗。Engine18対応＋既存4/DO6全command保存evict再送/browser4実反射含む/reload/型/ledger成功。17行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-plague-physical-bindings.json)。90枚対応済み、他105と共有T34/全体は未完。

- [x] Other195白光/白輪/天舞3物理55条項＋main対応。実初期従者・Light/Ring非CHANT・Dance両mode実CHANT/全手番、use不足1/0対専用0。黒Saint6/死Knight7はLight効果Lv境界＋実Prayer1/2、Ring/DanceはLv不問破壊。非黒Guardian7下位阻止/同値body0対専用Dance全従者破壊body15・全3人。実転移局所/禁止見切り・間合い/Fate/使用失敗、実炎矢→白光専用反撃A6B0と反撃Fate後A0B5、Gadyura白使用拒否。Engine47対応＋既存11/DO14全command保存evict再送/browser7実CHANT・反撃/reload/型/ledger成功。55行implemented/main3差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-white-magic-physical-bindings.json)。93枚対応済み、他102と共有/全体は未完。

- [x] Other195妖獣/餓狼2物理33条項＋main対応。実初期Yotsurm/従者、両mode非CHANT魔精黒、use不足1/0対専用0・専用全3。白Guardian8/Angel7を効果Lv不問破壊、Metalは精神通過で保持/兵士HP1だけ減、非白Water7阻止。餓狼実魔Lv3/6/9→6/12/18、実Prayer効果7でも術者魔Lv式維持。実転移局所/精神見切り拒否/Fate/使用失敗、実通常持技回収→全手番→反対mode再使用。Engine34対応＋既存7/DO8全command保存evict再送/browser4/reload/型/ledger成功。33行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-yotsurm-magic-physical-bindings.json)。95枚対応済み、他100と共有T42/全体は未完。

- [x] Other195神罰1物理20条項＋main対応。実初期Jill/Uonos両mode実CHANT/全手番、魔use8不足1/0対専用0・effect8/9 damage16/20/魔反詠・専用全3。実Metal/兵士HP6→10/14、Guardian7通常比較、転移/見切り局所/Fate/使用失敗。実B炎矢→A詠唱済み反撃、通常判定残/専用0・返しはBのみ、反撃Fate/判定失敗でA5。実祈り加算で相手効果Lv下/同/上→反撃/相殺/拒否と詠唱保持。Jill通常持技回収→再CHANT/全手番→反対mode、Uonos専用可でも持技外でbase回収拒否。Engine42対応＋既存7/DO16対応全command保存evict再送/browser8/reload/型/ledger成功。20行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-judgment-physical-bindings.json)。96枚対応済み、他99と共有T36明示詠唱免除交差/全体は未完。

- [x] Other195沈黙1物理10条項＋main対応。実初期Shelim→Aiel/Uonos、魔use6不足1/0・精神/遠/ダメージなし/非CHANT、Metal/Water従者無視で保持。初回精神−2閾値4の4成功/5失敗、Guardian7はPrayer0阻止/1同値/2命中。実B先行神罰CHANT保持、手札魔法/新詠唱/詠唱発動/魔法防御・反撃/適格竜王教団魔法攻撃拒否、戦士弓と受動Metal防御は可。実本人回復−1失敗→次成功→保持神罰発動、実炎矢5後の薬でHP0でも沈黙維持。実公開Aiel接近/氷刃3可→沈黙で氷刃のみ不適格/能力値不変。Engine14対応＋既存2/DO3全command保存evict再送/browser3実Fate失敗と回復/reload/型/ledger成功。10行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-silence-physical-bindings.json)。97枚対応済み、他98と共有F01複数状態交差/全体は未完。

- [x] Other195紋竜破/地裂2物理14条項＋main対応。紋竜破は実CHANT/全手番/実接近、近未詠唱と遠詠唱済み拒否、魔use6不足1/0・damage15。地裂は非CHANT魔地6/damage8、実1/2人と全通常防御後に従者処理・対象変更拒否。Stone5/兵士HP5でB10/3、Earth CMetal6同値0→Prayer7でHP5/3。歌う船はEarth無効保持対Dragon通常HP2+1で12。実転移/見切り/間合い局所、実B神罰CHANTとMirror/氷鏡はEarth防御可対Dragon禁止・Royal固定4は通常6対象外。Fate/使用失敗/公開同陣営拒否。Engine21対応＋既存4/DO8全command保存evict再送/browser4実CHANT接近・転移/reload/型/ledger成功。14行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-close-earth-physical-bindings.json)。99枚対応済み、他96と共有F02低下時受動反射/全体は未完。

- [x] Other195衝破/魔衝破/幻矢3物理30条項＋main対応。実遠/実接近後近、魔use4/5不足1/0・非CHANT/専用なし。衝破5/魔衝破7固定、Stone5上/同/下を実Prayer1/2で区別しHP4+1軽減。幻矢は精/従者無視で保持、本人精神6−1閾値5の2+3成功0/3+3失敗10・通常加算/状態なし。実Guardian7はPrayer0/2/3で阻止/同値/抵抗命中。実転移/間合い、通常見切り可と精禁止、使用失敗/Fate/公開同陣営等拒否。Engine19対応＋既存4/DO11全command保存evict再送/browser7実判定・転移/reload/型/ledger成功。30行implemented/main3差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-shock-physical-bindings.json)。102枚対応済み、他93と共有/全体は未完。

- [x] Other195狂王陣1物理15条項＋main対応。実遠/実接近後近、魔use5不足1/0・非CHANT/魔精黒反/damage5。Metal精通過＋兵士HP1で4、精神6−2閾値4の2+2成功/2+3失敗停止。実黒Guardian8はPrayer0/3/4で阻止/同値/命中5停止。実B炎矢→A反撃は自身判定維持でB4停止、実BPrayer1/2で同値相殺/上回り拒否。攻撃/反撃Fate・使用失敗で元incomingのみ復旧。本人実回復−1→0→0、1/2/3回目成功・失敗時手札補充なし手番飛ばし、成功時通常手番復帰/損傷4維持。実転移/間合いと精見切り禁止、公開同陣営等拒否。Engine20/既存2/DO6対応全command保存evict再送/browser6実反撃・判定・回復/reload/型/ledger成功。15行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-mad-king-physical-bindings.json)。103枚対応済み、他92と共有/全体は未完。

- [x] Other195魔詩/呪歌2物理40条項＋main対応。実Lester普通/専用、遠/実接近近、魔use5/6不足1/0対専用0・非CHANT。魔詩5/7、Metal精通過＋兵士HP1で普通4対専用従者無視7、後の実炎矢をMetalが表になり防ぎ持続無効なし。精神6−3閾値3成功/失敗、本人回復普通−2→−1→−1/専用−3固定、失敗手番skip→成功通常復帰・損傷維持。呪歌d6×2/×4実1/6共有1roll/選択BCＤ。Guardian7実Prayer境界、実転移/間合い局所/精見切り拒否、実B神罰CHANT・Mirror/氷鏡は呪歌専用のみ禁止。実Fate/使用失敗/base回収→別手番反対mode再使用/foreign等拒否。Engine38対応/既存11対応/DO12全command保存evict再送/browser8実専用・判定回復・転移/reload/型/ledger成功。40行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-lester-songs-physical-bindings.json)。105枚対応済み、他90と共有R4公開常時再使用/全体は未完。

- [x] Other195死歌1物理22条項＋main対応。実Lester普通/専用CHANT/全介在手番、遠/実接近近、魔use7不足1/0対専用0・詠唱維持。普通2d6×2実1+2/6+6で6/24、専用魔3/7/10×3をBCＤ共有・ダメージ乱数なし。実Metal/兵士/Water無視保持、Guardian7同値0→Prayer8命中、専用8命中。実転移/間合い局所/精見切り拒否。実B神罰CHANTは普通反撃可/専用禁止、通常Mirror/氷鏡は元上限6で両mode拒否。初期Gadyura精神6±0の3+3成功0/3+4失敗21は通常防御後1回、実恐怖A−1成功→本人B±0失敗を分離。実Fate/使用失敗/base別名回収→再CHANT後反対mode/foreign等拒否。Engine25対応/既存4/DO8全command保存evict再送/browser6実CHANT・専用・転移・Gadyura/reload/型/ledger成功。22行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-death-song-physical-bindings.json)。106枚対応済み、他89と共有/全体は未完。

- [x] Other195ゴブリン/市民/兵士3物理28条項＋main3対応。実初期配置/PASS_SETUP/本人手番配置・並替/除去、他人/重複/上限拒否と非公開保持。Lv1/1/2・HP0/0/1・属性、実Bow3 damage4→4/4/3、Metal前後順と後列保護、実間合い保持。実Dia接近→Dwarf3hit各6の上下同値で生存/破棄・HP毎hit18/15。攻撃欄なし/直接転用拒否、実Dia許可の兵士手札/配置から近戦1damage1、予約→通常確定/実Fate取消とも一度捨て札・戻らない。Engine22対応/既存6/DO10全command保存evict再送/browser8実配置・接近・従者攻撃/reload/全型/ledger成功。28行implemented/main3差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-common-followers-physical-bindings.json)。109枚対応済み、他86と共有/全体は未完。

- [x] Other195民兵1物理7条項＋main1対応。Lv2/HP0/人・攻撃欄なし。実初期配置/本人手番配置・後続手番並替/除去、他人/重複/上限拒否と非公開保持。実Bow3 damage4→4、Metal前後順と隠れた後列保護、実間合い保持。実Dia接近→Dwarf3hit各6の攻撃Lv1/2/3で生存0/同値破棄0/破棄18。実手札/配置から直接攻撃/CHANT/攻撃許可偽造拒否。Engine6/既存2/DO2全command保存evict再送/browser2実初期・手番配置/reload/全型/ledger成功。7行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-militia-physical-bindings.json)。110枚対応済み、他85と共有/全体は未完。

- [x] Other195オーク/砦2物理21条項＋main2対応。Lv3・HP0/2・怪人/建。実初期/本人手番配置・後続並替/除去、他人/重複/上限拒否・非公開保持。実Bow3同値破棄0、Metal前後順と後列保護、実間合い保持。実Dia接近→Dwarf3hit各6・攻撃Lv2/3/4で生存0/同値破棄0/HP毎hitで18/12。砦攻撃欄なし・両札直接転用拒否。実Diaオーク手札/配置から近戦use2/effect2/damage3、予約→確定/実Fate許可取消とも一度捨て札・戻らない。Engine16/既存4/DO8全command保存evict再送/browser6実配置・接近・攻撃/reload/全型/ledger成功。21行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-orc-fort-physical-bindings.json)。112枚対応済み、他83と共有/全体は未完。

- [x] Other195スケルトン1物理23条項＋main1対応。実初期/手番配置・並替/除去・非公開。Lv3/HP4/死、実Dia接近→Dwarf3hit各6・Lv2/3/4/5で生存0/同値復活0/上限復活6/上限超破棄6。Metal前後順/元位置/同group再投入なし→後続実Bow。実Dwarf4+黒騎士4混在4hitで7復活、Dwarf4+聖女5の両順で8破棄。実破山4死破壊はHP無視4・復活なし、実間合い保持。実Gadyura手札/配置から遠戦棒2damage2・戦0でもチェックなし・B/C/BC/BCD選択/反撃禁止、実近接近/局所間合い/実Fate取消。実全軍突撃は手札のみ近戦棒2damage2・戦1/2で判定1/0、親/子取消/使用失敗とも2枚消費。死はDia人許可対象外、foreign等拒否。Engine26対応/既存12/DO12全command保存evict再送/browser9実配置・接近・複数攻撃・全軍・専用・間合い/reload/全型/ledger成功。23行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-skeleton-physical-bindings.json)。113枚対応済み、他82と共有/全体は未完。

- [x] Other195辺境警備隊/ウッドゴーレム2物理30条項＋main2対応。Lv3/4・HP1/5・人/ゴ地木、実初期/本人手番配置・並替/除去・非公開と不正拒否。実Bow3同値Border破棄0/Wood高値保持0・Metal前後順・実間合い。実Dia接近→Dwarf3hit各6の上下同値、HP毎hitで15/3。実Dia人許可のBorder手札/配置から近戦2damage2、実取消でも一度消費。Woodは人許可外。両札実全軍突撃は手札のみ近戦2damage2/近戦格3damage5・戦不足1/同値0チェック、親取消/使用失敗2枚消費。実妖獣4精はWood4をHP5なし通過し保持5、後列兵士HP1だけ4。実Alseil専用鏡封精でも明示破壊が優先しWood破棄。Engine23/既存5/DO14全command保存evict再送/browser10実配置・接近・許可攻撃・精神通過/破壊/reload/全型/ledger成功。30行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-border-wood-physical-bindings.json)。115枚対応済み、他80と共有/全体は未完。

- [x] Other195城/小悪魔2物理24条項＋main2対応。基本Lv4・HP5/0・建/黒飛、実初期/本人手番配置・並替/除去・非公開と不正拒否。実Bow3防御保持・Metal前後順・実間合い。実Dia接近→Dwarf3hit各6の戦3/4/5で生存0/同値破棄0/HP毎hit3/18。城は実全軍札と同時手札でも攻撃欄なし。小悪魔は実衝破4/魔衝破5/地裂6へ魔防御5で保持0/同値破棄0/破棄8。実Dia Dwarf戦5×3+聖女魔5の1groupで防御Lv4/4/4/5・本体18、一度破棄。実全軍小悪魔は手札のみ遠魔黒4damage5・魔3/4で判定1/0、実近接近も可、親取消/使用失敗2枚消費、実Mirror反射A5で支払済み従者は戻らない。Engine22対応/既存3/DO11全command保存evict再送/browser10実配置・魔法境界・混在・全軍/反射/reload/全型/ledger成功。24行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-castle-imp-physical-bindings.json)。117枚対応済み、他78と共有/全体は未完。

- [x] Other195ゾンビー1物理23条項＋main1対応。実初期/手番配置・並替/除去・非公開。Lv4HP0死、実Dia接近→Dwarf3hit各6・Lv3/4/5/6で生存0/同値復活0/上限復活18/上限超破棄18。Metal前後順/元位置/同group再投入なし→後続実Bow。実Dwarf5+聖女5混在4hitで24復活、Dwarf5+親衛隊6の両順で26破棄。実破山4死破壊は4・復活なし、実間合い保持。実Gadyura手札/配置から遠戦触3damage4・戦0でも判定なし・B/C/BC/BCD選択/反撃禁止、実近接近/局所間合い/実Fate取消。実全軍は手札のみ近戦触3damage4・戦2/3で判定1/0、親/子取消/使用失敗とも2枚消費、死はDia人許可外・foreign等拒否。Engine26/既存9/DO12全command保存evict再送/browser9実配置・接近・混在・全軍・専用/間合い/reload/全型/ledger成功。23行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-zombie-physical-bindings.json)。118枚対応済み、他77と共有/全体は未完。

- [x] Other195傭兵1物理14条項＋main1対応。Lv4HP0人、実初期/本人手番配置・後続並替/除去・非公開と不正拒否。実Bow3防御保持・Metal前後順・実間合い。実Dia接近→Dwarf3hit各6・戦3/4/5で生存0/同値破棄0/HP0の本体18。直接攻撃/CHANT拒否、実Dia手札/配置から近戦剣use3/effect3/damage4・予約→破棄、Fate許可取消でも戻らない。実全軍は手札のみ同印字・戦2/3で判定1/0、親取消/使用失敗2枚消費。Engine12/既存3/DO8全command保存evict再送/browser5実配置・接近・許可攻撃/reload/全型/ledger成功。14行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-mercenary-physical-bindings.json)。119枚対応済み、他76と共有/全体は未完。

- [x] Other195黒騎士団/聖騎士団2物理41条項＋main2対応。実初期/手番配置・並替/除去・非公開、従者4HP5人騎、Bow3保持/Metal前後順/間合い、実Dia接近→Dwarf3hit各6・戦3/4/5で生存0/同値破棄0/HP毎hit本体3。実Garwin/Lancelot手札/配置から近専用、使用4は戦3/4で判定1/0を維持、黒効果5damage10/聖効果4damage4白。実全軍は手札のみ通常4damage5/4・owner強化なし。実剣匠同時宣言で遠・黒効果6/(5+2)×2=14、実Prayer3は効果9だけ追加。初期継承Lancelot2手札/配置使用も判定維持。実Fate/使用失敗/Mirror防御でも支払済み札は戻らない・foreign/不正対象拒否。Engine26/既存14/DO18全command保存evict再送/browser12実配置・接近・全軍/専用・剣匠/継承/reload/全型/ledger成功。41行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-knight-orders-physical-bindings.json)。121枚対応済み、他74と共有/全体は未完。

- [x] Other195部分対応: 歌う船a2-p20-r2c1の21/22条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv4HP2船空、実Dwarf戦3/4/5の3hitで本体0/0/12。実Ramba地槍は持ち主0/他対象9、Metal前列で未到達保持、実公開Tia奇襲＋踏込支払で地槍6通過・HP無効。実Asfelt手札/配置から魔0でも判定なし遠魔科5/2d6、全7非空部分集合・実接近も可。実全軍手札のみ通常魔4/5で判定1/0、実2d6出目/全対象同値、Fate親/子/使用失敗/実Mirror/局所間合い・支払後戻らない。Engine19対応/既存10/DO11保存evict再送/browser7実操作reload/全型/ledger成功。21行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-singing-ship-physical-bindings.json)。全条項対応121枚/他74の総数は据置。
- [ ] 歌う船 `semantic/defense/not-earth-warrior`: 2026-09-10 D4c で現行版到達不能。2nd行動カードに地属性かつ戦士技はなく、従者属性を攻撃へ移す裁定もない。[検査](../../../scripts/inspect_earth_warrior_actions.py)。合成consumer回帰は残す。台帳の `notApplicable` 束縛は retainedTests の成功 run 後。実カード成立とは記録しない。

- [x] Other195小天使1物理17条項＋main1対応。実初期/手番配置・並替/除去/非公開、Lv4HP0白飛、Bow3阻止/Metal前後順/実間合い。実Dia接近→Dwarf戦3/4/5の3hitで本体0/0/18。実衝破4/魔衝破5/地裂6に魔防御5で保持0/同値破棄0/高値破棄8。実Dwarf戦5×3＋闇の聖女魔5の1groupで防御4/4/4/5・HP0・本体18・一度破棄。実全軍手札のみ遠魔白3damage4、魔2/3で判定1/0・実近接近も可。直接/専用/CHANT・Dia人許可・配置全軍・Gadyura白使用拒否。実親/子Fate/使用失敗で2枚消費、実Mirror反射A4/B0・支払済み従者は戻らない。Engine18/既存3/DO9全command保存evict再送/browser8実配置・魔法境界・混在・全軍/反射reload/全型/ledger成功。17行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-small-angel-physical-bindings.json)。122枚対応済み、他73（歌う船1条項pendingを含む）と共有/全体は未完。

- [x] Other195ストーンゴーレム1物理17条項＋main1対応。実初期/手番配置・並替/除去/非公開、Lv5HP4ゴ地石、Bow3阻止/Metal前後順/実間合い。実Dia接近→Dwarf戦4/5/6の3hit各6で本体0/0/6・HP4毎hit。実妖獣4精は高いStone5も比較/HP4/破棄/公開なし通過し本体5、後列兵士HP1だけなら4・兵士破棄/Stone保持。実Alseil専用鏡封精は明示破壊を優先しStone破棄・本体0。実全軍手札のみ近戦格4damage7、戦3/4で判定1/0・実接近必須。直接/専用/CHANT・Dia人許可・配置全軍拒否。実親/子Fate/使用失敗で2枚消費、実MirrorでA0/B0・支払済み従者は戻らない。Engine13/既存2/DO6全command保存evict再送/browser5実配置・精神通過/破壊・接近/全軍reload/全型/ledger成功。17行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-stone-golem-physical-bindings.json)。123枚対応済み、他72（歌う船1条項pendingを含む）と共有/全体は未完。

- [x] Other195グリフォン1物理27条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv5HP3空獣、実Dwarf戦4/5/6の3hitで本体0/0/9。非Upa到達士気は精神6修正0に2d6:2/4成功でHP3毎hit本体9、3/4失敗で全hit無防御18・1group1判定、後続実Bow別group再判定。Metal前列未到達は士気なし・隠蔽保持。実Upa精神0でもSTART_FOLLOWERS専用効果選択で免除、本体9。実Upa手札/配置専用は戦0でも判定なし遠戦格5damage8×2・全7対象集合。黒騎士HP5を各hit適用し6、初発間合いなら3/他対象16、実Mirrorは初発だけ阻止B8/C16。実Upa獣能力の通常手札/配置は1対象・戦4で使用1判定を維持。実非Upa全軍は手札のみ通常・士気1＋戦4/5で使用1/0、実近接近も可。専用/全軍親子/士気・使用失敗/獣許可取消でも一度消費。Engine26/既存9/DO15全command保存evict再送/browser11実配置・士気/専用免除・通常/専用/全軍・個別防御reload/全型/ledger成功。27行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-griffin-physical-bindings.json)。124枚対応済み、他71（歌う船1条項pendingを含む）と共有/全体は未完。

- [x] Other195アルケミア城/ガイナス城2物理19条項＋main2対応。実初期/手番配置・並替/除去/秘密、共にLv5HP5建城、実Dwarf戦4/5/6の3hitで本体0/0/3・Bow/Metal前後/間合い。GOOD/EVIL不適格ownerは手札保持可・初期/手番配置拒否、攻撃欄なしのため全軍札と同時手札でも使用不可・専用/CHANT拒否。実公開TiaGOOD/AlseilEVILへ陣営変更札→精神0-1失敗で逆陣営となり配置城を直ちに公開破棄、手札城は秘密保持。後続実Bowは城なし本体4、Fate取消なら陣営/隠れた城を保持。実Alseil専用Lv6を選択/不選択しDwarf5/6/7各3hitへHP5不変・使用者外は選択拒否。実AlseilGOOD変更後は城手札でも配置不可。Engine21/既存8/DO9全command保存evict再送/browser7実配置・公開/陣営変更・専用防御reload/全型/ledger成功。19行implemented/main2差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-faction-castles-physical-bindings.json)。126枚対応済み、他69（歌う船1条項pendingを含む）と共有/全体は未完。固定済み従者集合への実陣営変更交差は新たに完了としない。

- [x] Other195ワイト1物理24条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv5HP0死、実Dwarf戦4/5/6/7の3hitで保持0/同値復活0/上限復活18/上限超破棄18・元位置/同group再投入なし→後続Bow。実Dwarf6＋親衛隊6の4hit26復活、Dwarf7＋親衛隊6の両順26は復活不可。実白光5の死破壊は上限内でも本体6/復活なし。実Gadyura手札/配置から戦0でも遠戦触4damage5・全7対象集合/判定なし、実近/局所間合い。実全軍は手札のみ近4damage5・戦3/4で判定1/0。通常/専用いずれも実Metal無視でHP/公開なし本体5、後列守護者の士気1で列全体無視解除B0/C5。実Mirrorは通常/専用とも合法、反撃禁止なし。親/子/使用失敗/専用Fateでも支払後戻らない。Engine29対応/既存7/DO16全command保存evict再送/browser13実復活・混在・全軍/専用・無視/守護者/反撃reload/全型/ledger成功。24行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-wight-physical-bindings.json)。127枚対応済み、他68（歌う船1条項pendingを含む）と共有/全体は未完。

- [x] Other195王立騎士団1物理24条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv5HP0人騎、実Dwarf戦4/5/6の3hitで反射18/同値破棄0/上位本体18。士気精神6修正0の2+4成功/3+4失敗で各hit反射/無効、group1回・未到達なし・後続Bow再判定。Lia専用明示なら精神0でも免除・未選択は失敗。反射Bowの値/系譜/追加支払なし・元攻撃者の新間合い防御、実GadSkeleton反撃禁止も所有者分のみ反射B2/C2、実Wight無視は士気/公開/反射なしA5/C5。実衝破4反射5/魔衝破5同値破棄0、実Mirror再反射でも同一Royal源は再反射せず通常防御。Lia専用/ディア人許可の手札配置・全軍手札は実接近後に近戦剣4damage5単体、戦3/4で判定1/0、全軍のみ士気。親/子/士気/使用失敗/専用Fateでも支払後戻らない。Engine29対応/既存9/DO16保存evict再送/browser13実配置・反射・士気免除・専用/人許可/全軍reload/全型/ledger成功。24行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-royal-knights-physical-bindings.json)。128枚対応済み、他67（歌う船1条項pendingを含む）と共有/全体は未完。

- [x] Other195有翼族1物理27/28条項＋main1部分対応。実初期/手番配置・並替/除去/秘密、Lv5HP0人空翼、実Dwarf戦4/5/6の3hit本体0/0/18。士気精神6-1の2+3成功/3+3失敗・到達group1回/後続Bow再判定/未到達なし。Tia専用明示は精神0でもLv7免除・実Dwarf6/7/8で本体0/0/18、未選択は普通5/士気失敗。実Ramba地槍4damage9は士気成功/専用免除でA0/C9、失敗A9/C9、Metal前列は未到達・実Tia公開＋踏み込み奇襲で士気/公開/無効化なしA6。Tia専用/ディア人許可の手札配置・全軍手札は遠魔風7全員、魔6/7で使用1/0、1回2d6:2+5を共有し3者17、全軍のみ士気。実近・局所間合い・実Lancelot専用Mirror7反射も振直しなし。親/子/士気/使用失敗/専用Fate/人許可取消でも支払後戻らない。Engine34対応/既存13/DO20保存evict再送/browser16実配置・専用/士気/地魔法/奇襲・全員攻撃共有骰子reload/全型/ledger成功。27行implemented/main1差替、地戦士除外1は実producer証拠不足でpending、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-winged-folk-physical-bindings.json)。全条項対応済み128枚は据置、他67（歌う船/有翼族の各1pending＋他65）と共有/全体は未完。
- [ ] 有翼族 `semantic/defense/not-earth-warrior`: 歌う船と同じ D4c。実producerを再探索しない。`notApplicable` 束縛は retainedTests の成功 run 後。

- [x] Other195闇の聖女1物理22条項＋main1対応。欠落していた攻撃者Diaの任意無視を実装：既存従者登場前窓の本人のみboolean選択、敵非公開札の有無に依存しない候補、不使用は非公開維持・使用でDia公開、当該物理聖女だけ無視。実Bow4/選択なし0、他Metalは防御、実後列Guardian士気で列無視解除、Dwarf6の3hit無視はHPなし本体18。隠れたSaint/Metalの実2worldは選択前B/C/D全view同値、再入力/他actor拒否。実初期/手番配置・並替可/任意除去交換拒否（所有Diaも同じ）、Lv5HP2人黒女、Dwarf4/5/6で本体0/0/12。実魔衝破5/地裂6/祈り1加算地裂7は魔法防御6で0/0/6、Dwarf6＋有翼7混在は5/5/5/6・HP毎hitでA22/C12/D12。実Alseil鏡封は強制除去可。実Dia人許可手札配置/全軍手札の遠魔精黒5damage6・魔4/5判定1/0・精神はMetal通過/近も可・Mirror反射6でも支払聖女は戻らない。親/子/使用失敗/人許可取消でも一度消費。Engine29＋Protocol1/関連13/DO16保存evict再送/browser13実選択・不使用・無視解除・条件防御/攻撃reload/全型/ledger成功。22行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-dark-saint-physical-bindings.json)。129枚対応済み、他66（歌う船/有翼族の各1pending＋他64）と共有/全体は未完。

- [x] Other195女性親衛隊1物理25条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv5HP4人女、実Dwarf戦4/5/6の3hit本体0/0/6。士気精神6修正0の2+4成功/3+4失敗でHP4毎hit本体6/無軽減18・到達group1回/後続Bow再判定/未到達なし。Arnes専用明示は精神0でも免除・5HP4不変、未選択は失敗。実GadWight無視にMetal前列＋本札後列の専用選択でA0/C5、未選択A5/C5・隠蔽。実Tia魔風7damage12の空限定無視にGriffin前列＋本札後列で専用A5/C12、未選択A8/C12・Griffin未公開保持。実Lester全軍Wight＋人無効は専用本札も無効化し両従者隠蔽A5、実Alseil鏡封は専用でも明示破壊。実Arnes仮想4HP1を追加/不追加と物理5HP4を分離しDwarf6は本体3/6・物理破棄1。Arnes専用/ディア人許可手札配置・全軍手札は遠魔弓4damage6単体、魔3戦20で使用1/魔4戦0で使用0・全軍のみ士気、実近/間合い/Mirror反射6/取消失敗でも一度消費。Engine35/関連10/DO21保存evict再送/browser17実専用/未使用・属性限定無視解除/人無効/破壊/攻撃reload/全型/ledger成功。25行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-female-guard-physical-bindings.json)。130枚対応済み、他65（歌う船/有翼族の各1pending＋他63）と共有/全体は未完。

- [x] Other195小人族1物理28条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv5HP6人小地。実Bow3は保持防御、実UpaGriffin5の2hitは同値破棄/本体0、実祈り1で効果6はHP6毎hit/本体4。精神6修正−2の2+2成功/2+3失敗は到達group1回・本体4/16・破棄1、後続group再判定/Metal後列未到達なし。Ramba専用明示は精神0でも士気免除・5HP6不変/本体4、未選択16・他人物/重複選択拒否。Ramba専用/ディア人許可手札配置・全軍手札は遠戦斧の現在戦士0/3/4/5/8を使用/効果へ固定、damage6×3を単体、noChecks=false・使用不足なし・全軍のみ士気。黒騎士団4HP5へ戦3/4/5は本体0/0/3、初hit間合い/Mirror後は残り2hitを従者で本体2・戦技反射なし。実接近後も可・分配/重複/自分/空対象/配置全軍は拒否。実宣言中Peace補充で神々の血OPENにより戦士4→5でも3hit使用/効果4固定、実祈りは使用4維持/効果5。専用手札配置/全軍親子士気/ディア取消は一度消費・返還なし。Engine35/関連11/DO15保存evict再送/browser11実防御専用/攻撃reload/全型/ledger成功。28行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-dwarf-physical-bindings.json)。131枚対応済み、他64（歌う船/有翼族の各1pending＋他62）と共有/全体は未完。

- [x] Other195竜王教団1物理27条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv5HP0人僧、実Dwarf4/5/6の3hitは本体0/0/18。精神6修正0の2+4成功/3+4失敗・到達group1回/後続再判定/未到達なし。Uonos専用明示は精神0でもLv6士気免除、実Dwarf5/6/7へ本体0/0/18・未選択は5/士気失敗・他人物/重複拒否。実白輪普通6/専用7/祈り8へ普通・専用とも対白7を優先し本体0/0/10、未免除精神0は白6でも本体10。実祝福draw/OPENで白固定7の後に+1し両選択Lv8保持防御。Uonos専用手札配置は魔0でもチェックなし任意単体/複数/全員、ディア人許可手札配置・全軍手札は単体で魔5/6に使用1/0・全軍のみ士気。遠魔精黒6・1回2d6の2+5=7をB/C共有しD未選択、実間合い/Mirror局所反射も攻撃骰子再判定なし。精は物理Metal6HP5を公開せず通過。実接近可・不正対象/配置全軍拒否・親子/士気/使用/許可取消は一度消費し返還なし。Engine37/関連11/DO19保存evict再送/browser15実防御専用/対白/攻撃共有骰子reload/全型/ledger成功。27行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-dragon-cult-physical-bindings.json)。132枚対応済み、他63（歌う船/有翼族の各1pending＋他61）と共有/全体は未完。

- [x] Other195女神官のシャリア1物理20条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv5HP4人僧女、実Dwarf4/5/6の3hitは本体0/0/6。精神0でも士気判定なし、実Dwarf6全hitにHP4独立適用・破棄1。Jil専用防御は未記載で候補なし/入力拒否。実ディア闇の聖女5精攻撃は非ゴーレムの本札5と同値比較し本体0/破棄、精神通過は追加しない。Jil専用/ディア人許可手札配置・全軍手札は実接近後の近戦格5damage6単体、戦4魔20で使用1/戦5魔0で使用0・noChecks=false・全軍含め士気なし。遠攻撃/遠ディア候補/配置全軍/空・自分・重複・複数対象を拒否。実間合い/Mirror防御は本体0/戦技反射なし。専用手札配置/全軍親子使用失敗/専用使用失敗/ディア許可使用失敗は支払後一度消費し返還なし。Engine25/関連7/DO14保存evict再送/browser10実配置/防御/接近攻撃reload/全型/ledger成功。20行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-sharia-physical-bindings.json)。133枚対応済み、他62（歌う船/有翼族の各1pending＋他60）と共有/全体は未完。

- [x] Other195妖精族1物理29条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv5HP0人白、実Dwarf4/5/6の3hit本体0/0/18。精神6修正0の2+4成功/3+4失敗・到達group1回/後続再判定/未到達なし。Furyでも精神0は士気失敗、専用防御候補なし/拒否。実白光5/白輪6/専用白輪7へ対魔法6で本体0/0/10、精神0は白光5でも本体6。実非白魔法地裂6も対魔法6同値本体0。Fury専用手札配置は戦0でもチェックなし任意単体/複数/全員、ディア人許可手札配置・全軍手札は単体・実Lv骰子4で使用7確定後に戦6/7で使用1/0、全軍のみ士気。遠戦弓白の印字Lv骰子4とdamage骰子2が独立し使用効果7/damage6をB/C共有、D未選択。実間合い/Mirror局所防御、実ディアFairy4damage9をFuryの実王立騎士団が反射しA9/B0・元2骰子保持/反射Fury追加なし。実神性介入はLv2→6で使用効果9/damage9保持、damage5→6でdamage10/使用効果5保持、数値への強制失敗拒否。実Fury妖精の弓を追加すると能力効果3/印字Lv2/印字damage5/能力damage6の4イベントで使用5効果8damage15を共有。実接近可・配置全軍/不正対象拒否・親子/士気/使用/許可取消は一度消費。Engine37/関連10/DO19保存evict再送/browser15実防御/2数値投影/共有damage reload/全型/ledger成功。29行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-fairy-folk-physical-bindings.json)。134枚対応済み、他61（歌う船/有翼族の各1pending＋他59）と共有/全体は未完。

- [x] Other195メタルゴーレム1物理17条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv6HP5ゴ鉄地。実Bow3保持防御、実Dwarf5/6/7の3hit本体0/0/3・HP5を高Lv全hitへ独立適用。実Metal6前/Stone5後のDwarf6はMetal同値全hit防御・Stone未公開保持、逆順は両札破棄で本体0。精神0でも士気なし。実妖獣4精攻撃はLv比較/HP5/破壊なしでMetal未公開保持・本体5、実後続兵士3HP1なら本体4/兵士破棄。実Alseil精鏡封は明示破壊が優先しMetal6も破棄。本札の通常/専用直接/詠唱/ディア人許可は拒否。全軍手札は実接近後の近戦格5damage10、戦4/5で使用1/0・noChecks=false、配置/空・自分・重複・複数対象は支払前拒否。実親/子Fate取消/使用失敗は双方一度消費・返還なし、実間合い/Mirror防御は本体0/戦技反射なし。Engine17/関連2/DO9保存evict再送/browser8実配置/Dwarf等高/精神通過後続/明示破壊/全軍接近reload/全型/ledger成功。17行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-metal-golem-physical-bindings.json)。135枚対応済み、他60（歌う船/有翼族の各1pending＋他58）と共有/全体は未完。

- [x] Other195悪魔1物理21条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv6HP4悪黒空。実Bow3保持防御、実Dwarf5/6/7の3hit本体0/0/6・HP4を高Lv各hitへ適用。精神6修正0の2+4成功/3+4失敗、到達group一度判定・失敗はHPなし本体18/一度破棄、後続group再判定・未到達なし。Uonos専用明示は精神0でもLv6HP4のまま士気免除、未選択は本体18・他人物/重複拒否。実Tia魔風7は選択悪魔の空を無視し未公開保持・A/C各12、実Shelim白光6は黒属性破壊を優先し悪魔破棄/本体6/士気なし。Uonos通常専用の手札配置直接攻撃/詠唱は拒否、ディア人許可にも含まない。全軍手札のみ遠魔黒6damage8単体・魔5/6使用1/0・Uonosでも普通士気、実接近後も可。配置/フューリー黒禁止/不正対象は支払前拒否、実親子取消/士気使用失敗で双方一度消費・返還なし、間合い防御/Mirror魔反射8。Engine25/関連6/DO10保存evict再送/browser9実配置/等高/士気/専用/空無視/黒破壊/全軍reload/全型/ledger成功。21行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-devil-physical-bindings.json)。136枚対応済み、他59（歌う船/有翼族の各1pending＋他57）と共有/全体は未完。

- [x] Other195親衛隊1物理26条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv6HP4人騎。実Bow3保持、実Dwarf5/6/7の3hit本体0/0/6・高Lv各hitへHP4。精神6修正-2で2+2成功/2+3失敗、group一度/失敗HPなし本体18/一度破棄・後続再判定/未到達なし。Lia専用明示は精神0でもLv6HP4のまま士気免除。非Liaの通常効果で前Metal/後Guardは実Wight全列無視を無効化しA0/C5、失敗A5/C5でGuard破棄/Metal未公開保持。実Tia空無視も前Griffin/後Guard成功A5/C12、失敗A12/C12でGriffin未公開保持、逆順Guard/Griffinも成功A5/C12。実Lester人無効は無視無効を停止、実Alseil明示破壊は優先。Lia専用手札配置は近戦剣白6damage8・戦0でもチェック不要、実3接近後のB/C/D全7非空部分集合を検証。Dia人許可手札配置/全軍手札は単体・戦5/6使用1/0・全軍士気-2はLiaでも保持。無許可/他人物/遠距離/不正対象/配置全軍/詠唱拒否、親子/許可取消・士気使用失敗は一度消費返還なし。間合い局所防御/通常Mirror拒否/実Lancelot専用Mirrorは戦6を反射せず防御。Engine37/関連18/DO21保存evict再送/browser17実防御/無視成否/無効化/専用攻撃接近reload/全型/ledger成功。26行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-palace-guard-physical-bindings.json)。137枚対応済み、他58（歌う船/有翼族の各1pending＋他56）と共有/全体は未完。

- [x] Other195天使1物理24条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv6HP0天白空。実Bow3保持、実Dwarf5/6/7の3hit本体0/0/18。精神6修正0で2+4成功/3+4失敗、group一度/HP0軽減なし/失敗一度破棄・後続再判定/未到達なし。Shelim/Lia専用明示は精神0でも非魔6HP0のまま士気免除、Dwarf6未選択18/選択0。実非白EarthSplit6/専用WhiteRing7/祈り8を対魔7で本体0/0/10・保持/同値破棄/高Lv破棄、普通精神0はEarthSplit6でも8、両人物専用魔7免除なら0。実Tia空無視は選択魔7天使を未公開保持しA/C各12、実Alseil精鏡封の明示破壊は優先。本札Shelim/Lia手札配置の通常専用直接/詠唱は許可なし拒否、Dia人許可も除外。全軍手札のみ遠魔白6damage6単体・魔5/6使用1/0・両人物でも普通士気、実接近後可・配置/不正対象拒否、親子取消/士気使用失敗は双方一度消費返還なし。間合い防御/Mirror魔反射6。Engine32/関連8/DO15保存evict再送/browser14実配置/士気両専用/魔6等7高8/空無視/明示破壊/全軍reload/全型/ledger成功。24行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-angel-physical-bindings.json)。138枚対応済み、他57（歌う船/有翼族の各1pending＋他55）と共有/全体は未完。

- [x] Other195炎竜1物理22条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv6HP7竜獣炎空。実Bow3保持、実Dwarf5/6/7の3hit本体0/0/0・高Lv各hitのHP7記録/実ダメージ下限0。精神6修正0で2+4成功/3+4失敗、group一度・失敗HPなし本体18/一度破棄・後続再判定/未到達なし。実爆炎普通6/専用7/祈り8を対炎7でA0/0/6・C0/13/13、炎6も精神0失敗なら10。Asfelt/Upaの専用士気免除/通常専用直接手札配置/詠唱は印字許可なし拒否。実Tia空無視は未公開保持A/C各12・実Alseil明示破壊はHP7/士気なしで破棄。実Upa獣許可手札配置と全軍手札は遠魔炎6damage12全員・魔5/6使用1/0・全軍のみ士気、空自分重複部分対象/専用grant指定拒否。Dia人許可除外・配置全軍拒否。実接近可、間合いB局所0/C/D12、Mirror反射A12/B0/C/D12。親子/許可取消・士気使用失敗は全対象前に一度消費返還なし。Engine29/関連3/DO16保存evict再送/browser14実配置/炎6等7高8/士気/空無視/明示破壊/全軍獣全員reload/全型/ledger成功。22行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-flame-dragon-physical-bindings.json)。139枚対応済み、他56（歌う船/有翼族の各1pending＋他54）と共有/全体は未完。

- [x] Other195地竜1物理25条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv6HP6竜獣地空。実Bow3保持、実Dwarf5/6/7の3hit本体0/0/0・高Lv各hitへHP6。精神6修正0の2+4成功/3+4失敗、group一度・失敗HPなし本体18/一度破棄・後続再判定/未到達なし。実非白EarthSplit6/WhiteRing7/祈り8を対魔7で本体0/0/4、魔6も精神0失敗なら8。Asfelt/Upa専用免除/直接通常専用手札配置/詠唱は印字許可なし拒否。実Tia空無視は未公開保持A/C12・実Alseil明示破壊はHP6/士気なし。実Upa獣手札配置/全軍手札は遠魔地6damage8全員、魔5/6使用1/0・全軍のみ士気、不正部分対象/専用grant/人許可/配置全軍拒否。実前Metal/後Guardは到達時にLv/HP/士気前の非空破壊で本体8、飛の小天使/小悪魔も両方破壊。前Angel魔7は通常防御して後Metal未公開のまま両方保持、低い空Griffinは通常HP3後にMetal破壊で本体5。Upa実grantにも非空破壊保持。間合い/MirrorはBのhitを先に消して非空列未公開保持、C/D8・反射A8。実接近可、親子/許可取消・士気使用失敗は全対象前に一度消費返還なし。Engine36/関連3/DO19保存evict再送/browser17実魔法防御/全員/非空と飛破壊/空前衛後列保持reload/全型/ledger成功。25行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-ground-dragon-physical-bindings.json)。140枚対応済み、他55（歌う船/有翼族の各1pending＋他53）と共有/全体は未完。

- [x] Other195飛竜1物理28条項＋main1対応。実初期/手番配置・並替/除去/秘密、Lv6HP5竜獣風空。実Bow3保持、実Dwarf5/6/7の3hit本体0/0/3・各高hitへHP5。精神6修正0の2+4成功/3+4失敗、group一度・失敗HPなし本体18/一度破棄・後続再判定/未到達なし。Asfelt専用明示は精神0でも非風6HP5のまま士気免除し本体3、未選択18・他人物/重複拒否。実Asfelt風斬剣6/雷斬剣7/祈り8を対風7でA0/0/9・C12/14/14、普通精神0風6でも12。実Tia雷走6/祈り7も風7、実非風EarthSplit6は基本6で同値防御。実Tia空無視は未公開保持A/C12、実Alseil明示破壊はHP/士気なし。実Asfelt専用手札配置は遠魔風6damage9全員・魔0で使用不要、Upa獣手札配置/全軍手札は魔5/6使用1/0・全軍のみ士気（Asfelt精神0でも失敗）。全5経路で見切り拒否・全員維持。不正部分対象/無許可/他人物専用/詠唱/人許可/配置全軍拒否。実接近可・間合いB0/C/D9・Mirror反射A9/B0/C/D9。親子/許可/専用手札配置取消・士気使用失敗は全対象前に一度消費返還なし。Engine43/関連10/DO21保存evict再送/browser17実風防御/免除/全員/専用手札配置reload/全型/ledger成功。28行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-wyvern-physical-bindings.json)。141枚対応済み、他54（歌う船/有翼族の各1pending＋他52）と共有/全体は未完。

- [x] Other195デス・ナイト1物理28条項＋main1対応。Lv7HP0死騎、実Dwarf6/7/8の3hit本体0/0/18。士気−2はgroup一度・失敗HP/復活なし、明示Gad専用免除も7HP0維持。同値7はgroup終了時に生存列の同位置へ復活し同group再登場なし、後続再判定。実Dwarf/親衛隊混合groupの破壊8が先/後どちらでも復活禁止。実Sheilm白輪7/Alseil鏡封5の明示破壊も士気/HP/復活なし。実Gad専用手札/配置は遠戦剣黒6damage8全員・戦0使用不要、全軍手札は通常使用/士気−2（Gad精神0失敗）、人/獣許可や配置全軍拒否。親子/専用取消・士気使用失敗で一度消費。F44不足1枚受理の失敗3件から修正し、2枚同時支払いをstrict protocol/Engine/保存/UIへ追加。両方を受理時に移動し各再利用判断を保存queueで完了、踏み込み共有1枚後は既払返還せず不足1枚のみ追加可。Tia飛翔の宣言/取消をまたいでも両支払い保持、通常接近の1枚規則は維持。Engine38/通信10/関連86/DO17保存再送/browser11の2枚選択・再読込/型/ledger確認。28行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-09-r5-death-knight-physical-bindings.json)。142枚対応済み、他53（歌う船/有翼族の各1pending＋他51）と共有/全体は未完。

- [x] Other195守護者1物理27条項＋main1対応。Lv7HP0白空、実Dwarf6/7/8の3hit本体0/0/18。士気−1はgroup一度・失敗HPなし、Lia明示免除も7HP0維持・未選択失敗、後続再判定/未到達なし。通常効果の無視無効は前後不問で入口公開・士気成功時だけ自列全体を実Wight一般無視/Tia空無視から保護し他対象は維持。前衛同値7は自身のみ破棄し後衛Griffinを未公開保持。Lester人無効は白空守護者へ無効、Alseil明示破壊はLia専用でも有効。実悪夢6＋祈り1/2/3の黒魔法7/8/9へLv8で本体0/0/2、失敗6は2。実Gadデスナイト黒戦士7/Sheilm白輪白魔7は基本7。Lia専用手札配置は遠魔白7damage10全員・魔0使用不要、全軍手札は魔6/7使用1/0と通常士気−1（Lia精神0も失敗）。不正対象/無許可/人獣許可/詠唱/配置全軍拒否。間合い拒否でも見切り/適格Mirror反射10・通常接近撤退可。親子/専用取消と士気使用失敗は一度消費返還なし。Engine38/関連14/DO20保存再送/browser17実防御攻撃reload/型/ledger確認。27行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-guardian-physical-bindings.json)。143枚対応済み、他52（歌う船/有翼族の各1pending＋他50）と共有/全体は未完。

- [x] Other195水竜1物理23条項＋main1対応。Lv7HP4竜獣水空、実Dwarf6/7/8の3hit本体0/0/6・高hit各HP4。士気修正0の精神6に2+4成功/3+4失敗・group一度、失敗HPなし18/一度破棄、後続再判定/未到達なし。Asfelt/Upa専用防御/直接攻撃なし。実Tia空無視とAlseil明示破壊はHP/士気なし。実全軍手札/Upa獣手札配置は遠魔水6damage5全員・魔5/6使用1/0、全軍のみ士気。不正部分対象/無許可/人許可/詠唱/配置全軍拒否と親子許可取消/士気使用失敗は一度消費し停止なし。本人命中で抵抗なし固定停止、守護者7防御は停止なし・Stone5＋Griffin5のHPで本体0でも命中なら停止。実間合い/MirrorはB命中消去し他対象維持、反射は同じ物理水竜/反射者Bの期限でA停止。受け手の席では残り、使用者Aの次席到来でSTART/回復前に解除・追加判定なし。実Gaia竜王爆砕剣でA次手番省略でも席到来解除。実Mirror致死でA死亡、実水竜がGaiaを倒しAsfelt流浪でも非活動A席を飛ばす時に解除。実先行悪夢の停止は水竜期限で消さず独自回復2回のみ。Engine36/関連8/DO20全保存再送/browser18実期限/型/ledger確認。23行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-water-dragon-physical-bindings.json)。144枚対応済み、他51（歌う船/有翼族の各1pending＋他49）と共有/全体は未完。

- [x] Other195伏線だったのか1物理8条項＋main1対応。実致死攻撃のB/C死亡後、実秘伝書/任意ドローでOPEN公開。開始時死者のみ席順で独立1d6、1〜4は本人だけ復活/拒否、5〜6は選択なし、次の死者へ進む。実暗黒誘惑で死亡前にEVIL転向した人物と原GOOD/EVILの死亡時face/陣営/目的/保護を復元、公開全回復・状態除去・独立永続維持・破棄魔導書なし。初期5枚→実兵士再配置/補充5枚→次死者、親秘伝書/任意ドローを再開。一度OPEN/秘伝書消費、死者なしは判定なし。OPEN手札取消拒否、独立判定への神性振直しと命運強制失敗維持。Engine13/関連7/DO7全保存再送/browser7本人判断とreload/型/ledger確認。8行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-fusen-physical-bindings.json)。145枚対応済み、他50（歌う船/有翼族の各1pending＋他48）と共有/全体は未完。

- [x] Other195大陸の夜明け1物理3条項＋main1対応。実秘伝書でOPEN公開、実二人死亡後の捨て札＋山札全体を再編して再開取得1枚との集合保存と順変更を確認。空捨て札も山札再編。公開夜明け自身・解決中秘伝書・所有手札/従者/詠唱/付加は対象外。実裂界の異界人物は所持品とdamageを保ち帰還し、公開OPEN→帰還→私有ドローの順、復活/初期配置なし。死亡人物は死亡のまま。秘伝書一度破棄/行動再開、全員へ帰還公開。Engine4/関連4/DO3全保存再送/browser3実公開とreload/型/ledger確認。3行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-dawn-physical-bindings.json)。146枚対応済み、他49（歌う船/有翼族の各1pending＋他47）と共有/全体は未完。

- [x] Other195神々の血1物理4条項＋main1対応。実任意ドロー/秘伝書でOPEN一度公開、現在所有者の戦士/魔法/精神のみ各+1、耐久/各上限/独立永続は不変、他人物不変/本人正体は非公開。実他者祈願で公開域から公開域へ移り旧所有者3補正消失・新所有者3補正付与、OPEN再実行/永久成長化なし。実致死Bowで所有者死亡、血一度破棄/3補正消失/独立修行維持。実Bow戦士2→3・EarthSplit魔法5→6で超過使用判定1→0、残超過Bow精神6→7で同じ3+4が失敗→成功。Engine10/関連4/DO7全保存再送/browser7実操作とreload/型/ledger確認。4行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-gods-blood-physical-bindings.json)。147枚対応済み、他48（歌う船/有翼族の各1pending＋他46）と共有/全体は未完。

- [x] Other195OPEN祝福1物理4条項＋main1対応。実初期配置後ドローで公開、所有者だけ守護Lv+1/上限3/士気+1、他能力値/他人物は不変。公開前3枚拒否・公開後3枚成立/4枚拒否、実Dwarf6の3hitで既設兵士/Stoneと後置Griffinが3/6/6。実Griffin通常5/祝福6、精神6/7へ出目6/7/8、通常成功HP3で9・祝福同値0・士気失敗HPなし18、group一度判定/一度破棄。他所有者の実地竜士気は6で7失敗。実祈願移動で旧所有者3補正即時消失/新所有者付与、本人だけ容量調整・闇の聖女を候補除外し兵士一度破棄/残列順保持。実全軍Griffin士気7成功でも攻撃Lv5damage8×2のまま。実致死悪夢で祝福破棄/全補正消失/死者容量窓なし。Engine11/関連3/DO7全保存再送/browser7実操作とreload/型/ledger確認。4行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-open-blessing-physical-bindings.json)。148枚対応済み、他47（歌う船/有翼族の各1pending＋他45）と共有/全体は未完。

- [x] Other195賢者ハジャ1物理3条項＋main1対応。実任意ドロー/秘伝書でOPEN公開、所有者だけ手札上限6/詠唱上限2、他能力/他人物不変・正体非公開。初期5枚/秘伝書1枚取得後5枚から実手番末6枚補充、6枚保持/7枚時1枚調整、非保持5枚の対照。実氷狼乱舞陣/裂界を別手番で詠唱し2枚成立/3枚目滅界拒否、非保持は2枚目拒否。実氷狼使用7damageで枠が空き後続滅界詠唱可。実祈願で上限即時5/1・新所有者6/2、元所有者だけ余剰詠唱選択/1枚破棄、6枚手札は他席から本人次行動まで保持し手番末のみ1枚調整。実再取得で6/2へ戻るが破棄済み詠唱は復元しない。実致死Bowでハジャ/2詠唱破棄・死者容量窓なし。Engine10/関連3/DO6全保存再送/browser6実操作とreload/型/ledger確認。3行implemented/main1差替、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-haja-physical-bindings.json)。149枚対応済み、他46（歌う船/有翼族の各1pending＋他44）と共有/全体は未完。

- [x] Other195アレキサンドリア城の悲劇1物理5条項＋pending main1対応。実ガイナス/ディア公開→詠唱→攻撃の未解決3hit/2対象を一括取消、group前取消なら判定なし。裏ガイナス/公開ガーウィンでは候補なし・不使用無消費、同じ攻撃中の実ガイナス公開で候補成立。不正/古い/解決済みevent拒否はstate全view不変。先の対象15damage/致死を保持し残対象のみ取消。実Griffin受け開始後は本人不可/第三者可・従者破棄維持。実ランカスター専用閃光槍の精神成功で生成済み反撃7は、元天地爆砕剣の残対象取消後も成立。実命運で悲劇を取消すと補充保持/元3hit継続、実即時補充の神々の血OPENが子宣言前に一度成立。Engine15/関連10/DO12全保存再送/browser12実操作reload/型/ledger確認。5条項と主処理の計6行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-tragedy-physical-bindings.json)。150枚対応済み、他45（歌う船/有翼族の各1pending＋他43）と共有/全体は未完。

- [x] Other195聖騎士団長ケイルベイツ1物理7条項＋pending main1対応。実公開ランスロット/リーア姫に向いた同一攻撃の未解決3hitを保護、2対象では選択Bだけ0・他C15・使用者D0、身代わり転送なし。group前保護も維持、裏/対象外は候補なし・不使用無成長/無消費、実公開で同じeventの候補成立。先の別対象15を保持し後の対象を保護。実Griffin受け後は本人不可/第三者可。ランスロットだけ独立永続精神+1、リーア/第三使用者0。実命運で取消なら補充のみ保持・保護/成長なし。即時補充の血OPENは使用者D、ケイル成長は対象B。実後続Dawn→山札祈願で同じ札を再取得し別Bow宣言への再使用で成長+2、手番経過でも維持。実変身で維持、宣言前/解決中の変身でも保護対象継続・一度成長。実致死Bow→ウーノス復活→本人再配置でも成長維持。Engine20/関連17/DO13全保存再送/browser13実操作reload/型/ledger確認。7条項と主処理の計8行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-keil-physical-bindings.json)。151枚対応済み、他44（歌う船/有翼族の各1pending＋他42）と共有/全体は未完。

- [x] Other195ソロモン王の護符1物理5条項＋pending main1対応。実Bow→レスター魔詩/ディア魅了/ガドューラ恐怖の能力宣言だけ取消、敵判定なし・失敗/ゾロ目停止/改宗/即死なし、元Bow4継続。支払/補充一度・同攻撃内の能力再試行なし。不使用なら実非ゾロ判定成立/無消費、判定後・解決済みeventには不可、未取消6ゾロで実改宗/即死の対照。不正actor/stale/攻撃event拒否state全view不変。実命運で護符取消なら補充保持・能力判定/停止復帰。実即時補充の血OPENが子宣言前成立。実前のWhiteLight/能力ゾロ目でC停止・魅了改宗を成立させた後、新宣言取消でもC全profile/status維持。実後続の別Bowで同じ能力を再使用できる。同名手番魅了には候補なし・実抵抗失敗で改宗、イダ影分身も対象外。Engine19/関連7/DO11全保存再送/browser11実操作reload/型/ledger確認。5条項と主処理の計6行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-amulet-physical-bindings.json)。152枚対応済み、他43（歌う船/有翼族の各1pending＋他41）と共有/全体は未完。

- [x] Other195勇気1物理10条項＋pending main1対応。実GOOD使用者がBowへのディア魅了/ガドューラ恐怖宣言だけ取消、敵判定なし・元Bow4継続。実EVIL使用者/レスター魔詩は対象外、不使用/判定後拒否は無消費。実命運でカード取消なら補充のみ保持・精神判定/停止復帰・印刷回収判定なし。公開レスターC本人が判定同意→本人2d6→成功後元使用者Dがtake/decline、別人/同一C本人とも印刷候補を明示選択。非公開/実先行WhiteLight魅了ゾロ目で停止中のCは候補なし、判定辞退/受取辞退可。実判定窓公開でも同窓継続。精神6へ3+3成功/3+4失敗、実神性介入で同じ失敗判定を再試行権追加なく振直し。予約中は誰の手札/捨札にも属さず親攻撃末だけ元使用者へ一度返却・通常回収権未消費。即時血OPEN補充と後の勇気返却は別・手札5→6。実別Bowで同能力/返却勇気を再使用し2度目の同意判定・B計8。Engine18/関連14/DO14全保存再送/browser14実操作reload/型/ledger確認。10条項と主処理の計11行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-courage-physical-bindings.json)。153枚対応済み、他42（歌う船/有翼族の各1pending＋他40）と共有/全体は未完。

- [x] Other195この世界に愛と平和を1物理5条項＋pending main1対応。実GOOD Dが他者の精神基礎12置換、恒久加算-3/0/2を維持、実後取得の血OPENは14→15・期限後も残存。実Dawn/必要時deck祈願で同じ捨札を再取得して再使用しても14で非加算。対象の実次Bow/PASS_ACTION/CHANT末で解除、非main秘伝書では保持。実現在Bow/派生反撃の全連鎖末まで保持。実イーダ隠行中の使用が誤って次本人行動期限となる不具合をactive ability frame参照で修正し、実防御ディア魅了も包む攻撃末へ束縛。受動被攻撃者は被害4後も次本人行動期限を保持。実超過判定前は14採用・判定後は凍結値維持、末に元精神復元。全4view/実UIで公開期限表示とreload維持/末の消去。実命運取消は補充保持・置換なし、EVIL/本人対象/他人使用/stale/不正拒否、不使用無消費。Engine19/関連6/DO15全保存再送/browser15実操作reload/型/ledger確認。5条項と主処理の計6行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-peace-physical-bindings.json)。154枚対応済み、他41（歌う船/有翼族の各1pending＋他39）と共有/全体は未完。

- [x] Other195啓示1物理5条項＋pending main1対応。実初期配置で裏従者2、実補充ハジャOPENから実2手番のCHANTで裏詠唱2を作成。実他者B全3領域/本人D即時補充後手札/C手札のみ/EVIL使用者/元Bowへの割込を全現在札・領域別位置順で確認。使用者Dだけinspection/history、本人は既知手札維持、他view/公開eventへ隠し札ID漏れなし、人物正体閲覧なし・捨て/並替選択なし。終了/PASSで元処理復帰、対象fullprofile/表裏/順序/ゾーン不変、元Bow4一度。実次Bdrawの新札は履歴に追加せずreload維持。実命運取消は補充保持・inspection/historyなし。実裂界で従者/設置/詠唱を保持して異界中のBは対象外無消費。不使用、他人/stale/不正対象/不正捨札/並替/終了済判定拒否はstate全view不変。Engine11/関連7/DO9全保存再送/browser9実操作reload/型/ledger確認。5条項と主処理の計6行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-revelation-physical-bindings.json)。155枚対応済み、他40（歌う船/有翼族の各1pending＋他38）と共有/全体は未完。

- [x] Other195身代わり1物理7条項＋pending main1対応。実配置/CHANT/全手番からシン天地百撃斬2対象×3hit、CがB2発目だけ引受・C元3hit保持・原攻撃連鎖末にB14/C28。実Bwood既処理5軽減×3と捨札保持、残余2転送でB4/C23。実Cmetalは身代わりhit不可・元本人3hitには防御してB4/C8。実BowはB0/C4。実APPROACH近A-Bから遠Cへ転送/本人公開でも回避なし。実血OPEN補充でも束縛保持。実所持見切る/転移/間合い/命運と従者受けの本人使用拒否state全view不変、実手札閃光槍は元Aへ1hit反撃5。実本人レスター魔詩/水無効許可、第三者実悲劇は原攻撃取消可。実命運で身代わり取消は補充/使用済/支払保持・元B4。不使用/終了hit/self/foreign/stale/誤group/hit拒否。Cアーネスが引受済のhit再転送は実Dヤミン悲しき愛で不可、別の元C hitには実使用可でB14/C21/D7。Engine18/関連17/DO15全保存再送/browser15実操作reload/型/ledger確認。7条項と主処理の計8行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-substitute-physical-bindings.json)。156枚対応済み、他39（歌う船/有翼族の各1pending＋他37）と共有/全体は未完。

- [x] Other195人質1物理8条項＋pending main1対応。実EVIL使用者/GOOD非公開・公開シン攻撃、実CHANT/全手番から2対象×3hit全取消。実EarthBlast先行B15保持・残C取消、実ランカスター反撃7は原攻撃取消後も継続、実次別BowはB4で継続無効化なし。実兵士受け開始済の本人は使用不可/第三者Dは残存hit取消可。実初期陣営違い使用者/攻撃者は無消費拒否、非公開攻撃者の正体保持、実血OPEN即時補充保持。公開チャム/同未解決窓で実公開から印刷中止可能。実先行錯乱で能力無効・実ウーノス儀式→ヴァンミール神と人の差で禁止中も印刷中止可、実催眠停止中は不可、非公開/別人/辞退も中止なし。印刷反応frameは人物能力と別、実命運所持Dの能力/手札取消対象外でstate全view不変。中止成功は人質だけ捨札・補充保持・元B4/再中止拒否。実命運で人質取消も補充保持/元B4。不使用/完了hit/foreign/stale/不正target/group/hit拒否。Engine22/関連11/DO19全保存再送/browser19実操作reload/型/ledger確認。8条項と主処理の計9行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-hostage-physical-bindings.json)。157枚binding対応済み、他38（歌う船/有翼族の各1pending＋他36）と人質未解決中の陣営変更交差・共有/全体は未完。

- [x] Other195呪払1物理5条項＋pending main1対応。実初期配置のWood/Stone/Metalだけ指定対象から全破壊、実補充祝福OPENで3枠を作ったゴーレム2＋裏グリフォン混在でも非ゴーレムの表裏/順序/秘匿を維持。実CHANT/全手番のEarthBlast2対象からB/C片方だけ選び他対象従者保持。手札内ゴーレムは非対象・非公開、0体/空列でも呪払消費。実攻撃＋呪払＋専用魔空剣追加踏み込みは原子的支払、即時補充/独立行動なし・山札不変。呪払子処理/破壊従者の通常回収処分後だけ元攻撃宣言、未宣言親は人質対象外、1groupからwithdrawalへ。実命運で呪払だけ取消は従者/支払保持で攻撃継続、実人質/命運で後の親攻撃取消でも済破壊を戻さず。不使用は攻撃のみ消費、受け手の防御/いつでも/単独使用/未固定target/self/foreign/不正攻撃/未解決中target変更拒否はstate全view不変。Engine14/関連8/DO13全保存再送/browser13実操作reload/型/ledger確認。5条項と主処理の計6行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-dispel-physical-bindings.json)。158枚binding対応済み、他37（歌う船/有翼族の各1pending＋他35）と共有/全体は未完。

- [x] Other195死亡時贈与「これで勝ったと思うなよ」/「姫を頼む」2物理各6条項＋既存main2再binding。初期訓練だけで致死値を合わせ、実Bow4/実CHANT全手番EarthBlast15のB/C同時死亡から死亡identityと窓を生成。実REVEAL/改心・魅了で両方向の陣営変更後、死亡時GOOD/EVILの札だけ使用。使用札はresolutionへ移り即時補充なし、残手札の別札1枚を別の受取人1人へ秘密の物理移動、公開は事実だけ。自分/外国手札/使用札自身/別actor/生存時/いつでも/陣営違い/二重使用拒否はstate全view不変。同死亡B/Cは最初とB処分後のC窓の両方で候補外。実保護者死亡で受取人は贈与後に流浪して札を山札へ戻す。受取6枚は次の本人START/引かない/主行動passまで保持し通常ENDで1枚調整。実命運取消は使用札だけ先に捨て贈与予定札は通常死亡処分まで残る。不使用は全札処分。実チャム能力と印刷札はGOOD/実EVIL化の各順序で独立2枚、移動済札/能力の再使用不可。Engine新21＋関連Cham10/DO15全保存再送/browser15実選択reload/型/ledger確認。12条項implemented、main2再binding、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-death-gift-physical-bindings.json)。160枚binding対応済み、他35（部分2＋他33）と共有/全体は未完。残手札が使用札のみ/適法受取人0人/既離脱・異界/同batch内復活との実交差は今回未測定として証跡に残す。

- [x] Other195秘伝書1物理5条項＋pending main1対応。実setup/START/通常drawまたは引かない後だけ使用、実催眠＋失敗テレポートで4枚に減った後の実停止回復補充5枚からも使用可能、回復失敗は手番skipで使用不可。開始前/補充選択前/他席/未解決中/専用/いつでも拒否、実接近後は主行動が残っても冒頭窓を閉じ、不使用は札保持。実数値d6の1〜6各出目だけ秘密に追加draw、before-rollの成否判定なし・即時補充なし・上限到達でも枚数を減らさず通常END調整。実主行動の攻撃/CHANTへ続行。実命運取消は数値rollも追加drawもせず主行動保持。実神性rerollは最終generationの枚数だけ引き、神性使用者の即時補充で進んだ山札から開始。数値への命運強制失敗拒否。実先行BowでB死亡後の秘伝書draw伏せんOPENから復活判断に停止し、declineならAのBlood/Haja/代替drawを挟み残枚数再開、acceptならBの復活補充5枚＋そのBlood/Haja＋再配置を終えてA残3枚を再開（Engine/DO）。browserは実d6に応じ出た復活判断を操作し、各runの復活判定成功を固定仮定しない。Engine新17/関連4/DO13全保存再送/browser13実操作reload/型/ledger確認。5条項と主処理の6行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-secret-book-physical-bindings.json)。161枚binding対応済み、他34（部分2＋他32）と共有/全体は未完。

- [x] Other195ソロモン王の冠/赤い水晶球2物理各7条項＋pending main2対応。実手番宣言で各1札を即時補充なしで支払、resolutionから自己attachmentを全員公開、主行動消費でhand-adjustment。他席/専用/いつでも/未解決中/二重/追加主行動拒否はstate全view不変。実命運取消は札破棄で補正なし、不使用は手札保持、全手番後も設置保持、実Bow致死4の死亡贈与窓後に設置札を通常死亡処分で1度だけ破棄。各札から実地/水/炎/風/黒/精/黒精複合/白/戦士攻撃を実行し対象属性の魔法使用Lvだけ冠+1/球+2、複合でも球+2だけ、超過Lv判定数へ反映・印刷効果Lv/他actor/無属性Lv不変。実修行の無属性6との同値6失敗、実END補充BloodOPENを含む7には8成功し限定補正は除外。実初期配置女性親衛隊（人）/グリフォン（非人）の防御士気と実全軍突撃の攻撃士気で、現在GOOD冠+1/EVIL球+2だけ人に適用、逆陣営/非人は0。実REVEAL/改心・魅了で設置後の陣営を両方向に変更して設置を残したまま次の実士気判定の補正をon/off。Engine新44/関連13/DO26全保存再送/browser26実設置・攻撃・突撃・修行・閾値・reload/型/ledger確認。14条項＋主処理2の16行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-attribute-jewels-physical-bindings.json)。163枚binding対応済み、他32（部分2＋他30）と共有/全体は未完。

- [x] Other195修行（戦士技）/修行（魔法技）2物理各7条項＋pending main2対応。実setup/START/補充選択後、各1札を即時補充なしで支払い主行動消費。実2d6の厳密超過で6未満/同値6失敗・7>6成功、0に対する2成功、12同値/13超え不能は失敗。成功だけ自己attachment公開と対応Lv+1、他Lv不変、失敗/取消は通常捨て札。開始前/補充前/他席/未解決/専用不可/いつでも/二重拒否はstate全view不変。実香具羅/魔導書設置と全手番後の無条件7には8成功し今回成長分は閾値外。実本人Aの愛と平和（対象B）補充でBloodOPENを開き、判定前は6→7を閾値に算入、判定後は現Lv7でも閾値6固定、成功後は8。前回冠/水晶球の属性限定除外/Blood算入4実試験はAST一致で再利用。実ランスロット/実Lia公開→II変身の専用はLv13でも判定なし成功、実混乱＋回復失敗の能力禁止中も印刷専用を使用可。通常選択は実2d6、実催眠＋回復失敗はskipで使用不可。実命運は通常/専用どちらも手札使用を取消可、専用に存在しない判定を指定不可。実神性rerollは結果再計算、実命運強制失敗は振り直し12でも維持。実後続II変身で設置成長保持、実END後のBow致死で死亡贈与窓までは保持し通常処分後に修行+1を除去。Engine新44/関連4＋前回再利用4/DO30全保存再送/browser30通常・専用・厳密超過表示・介入・OPEN・reload/型/ledger確認。14条項＋主処理2の16行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-training-physical-bindings.json)。165枚binding対応済み、他30（部分2＋他28）と共有/全体は未完。

- [x] Other195「おまえはだまされている」/「魅了」各9条項＋pending main2対応。実setup/START/補充選択/対象本人REVEALを経て他の公開参加者を指定し、1札を即時補充なしで支払い主行動消費・解決後1回捨て札。開始前/補充前/非公開/本人/他席/占星指定/未解決重複拒否はstate全view不変。実対象2d6でSP6通常閾値5、実リーア/ウーノス使用者はordinary入力のまま自動閾値4、各同値成功/1超過失敗。実アスフェルト/ガーウィンの必須+2では閾値7、7成功/8失敗。失敗時は陣営・目的・currentObjective・保護対象・表示敗北条件を一括置換、成功/固定陣営の禁止は全体不変。同陣営にも使用可でGOOD既存Lia+Arnes→Liaのみ、EVIL既存Gaia+Dia→Gaiaのみ。対象の手札/OPEN/attachment/従者/詠唱/人物/傷/恒久値は不変。実命運取消は対象判定なし、実命運強制失敗は神性再判定2でも維持、通常神性2は抵抗成功へ戻る。全員EVIL初期配札の未公開者による勝敗保留下、実DのBowでGaia死亡→END/STARTA→Bウーノス公開→魅了失敗で即放浪、実手札とsetup配置従者を山札へ返却。死亡済みCは対象候補外。GOOD死亡済みLiaと他lifetime交差・抑制下必須補正の実交差は共有未測定として残す。Engine33/関連2/DO25全保存再送/browser25対象選択・公開・閾値・介入・reload/型/ledger確認。18条項＋主処理2の20行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-conversion-physical-bindings.json)。167枚binding対応済み、他28（部分2＋他26）と共有/全体は未完。

- [x] Other195ディノンの書5条項＋pending main1対応。実setup/START/補充選択後、公開/非公開/本人のactive対象1人を選び、物理元札を解決領域へ支払った後の残手札を解決時に同時全交換。元札を含めず即時補充なし。初期手札の境界配置による枚数差/元札のみ/対象空/双方空/交換後8枚超過、本人指定で自分の残手札とB手札不変を確認。実本人Aまたは相手Bの宣言中愛と平和は使用1枚を補充し、その補充後の残手札を交換する。実B/A香具羅/魔導書設置と全手番経過、実Bアイスウルフ詠唱、setup兵士/女親衛隊配置と実BloodOPENは各元所有者に残り、人物/傷/恒久値も不変。実命運取消は支払元札と主行動を消費して交換なし、辞退は双方手札保持。開始前/補充前/他席/占星/対象不在/複数対象形/未解決重複拒否はstate全view不変。受取Aの8枚は現在END、受取Bの8枚はAEND→本人START/補充辞退/mainpassまで保持し、各本人ENDで3枚捨てる。初期超過の生成元は未検証境界fixtureと明記。所有者2画面は交換後手札、他2画面は相手手札非表示。Engine17/関連2/DO14全保存再送/browser14対象選択・交換・補充・取消・3枚選択調整・reload/型/ledger確認。5条項＋主処理1の6行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-dinon-physical-bindings.json)。168枚binding対応済み、他27（部分2＋他25）と共有/全体は未完。

- [x] Other195遠見の水晶球7条項＋pending main1対応。実setup/START/補充選択後にactiveの非公開/実公開/本人対象を指定し、物理元札を即時補充なしで支払い主行動消費。通常は対象SP2でなく使用者SP6の実2d6、6同値成功/7失敗、SP0失敗/12同値成功、使用者ガーウィン/アスフェルトの変換抵抗+2を算入しない。成功時だけ本人の正体確認窓と私的履歴、他3人にinspectionなし・公開確認ログは人物IDなし、対象の元の公開状態維持。確認中は元札を解決領域に保持し、終了後1回捨て札。アルセイルは通常選択も可能で、任意専用は正体確認の追加なし・新規判定なしの手札全閲覧と任意1枚破棄/辞退。実配置した従者を閲覧対象から除外、空手札/本人手札も処理、破棄は1枚で補充なし。実占星を先に使用済みでもカード専用可、カード後に別イベントの占星を使い実2d6と別確認窓、能力回数は別枠。実混乱と回復失敗の能力禁止中もカード印刷専用を使用可。実命運取消は通常/専用とも情報公開前に取消、判定なし専用へ強制失敗指定不可、通常の実命運強制失敗は神性2でも維持し通常神性2は確認成功。開始前/補充前/他席/未対応専用/対象不在/未解決重複/他人確認/stale/不正破棄はstate全view不変。Engine23/関連8/DO19全保存再送/browser19通常・専用・私的表示・任意破棄・履歴・占星別枠・reload/型/ledger確認。7条項＋主処理1の8行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-farseeing-physical-bindings.json)。169枚binding対応済み、他26（部分2＋他24）と共有/全体は未完。

- [x] Other195祈願2物理各9条項＋pending main2対応。実setup/START後に元札を即時補充なしで支払い、本人だけのwish窓で1札取得を選択。山札は名前別枚数だけの非公開候補・存在しない名前の拒否後も同じ窓で再選択、同名回復薬2物理の各index取得と残山札shuffle、相手手札の各物理index取得と本人手札の再取得を確認。通常取得札は自己手札へ入り旧設置/詠唱状態解除、実B魔導書設置→取得で旧魔法Lv+1消失・新所有者は次の実自己手番で再設置するまで補正なし。実B詠唱は名前非公開のslot tokenで指定し取得後も詠唱状態を持ち越さない。実自己配置従者を手札へ戻せるが追加配置なし、実相手配置3従者（解除不能闇の聖女含む）は取得拒否。実B初期配置時の補充でBlood/祝福/ハジャ/夜明け/フーセンを初回OPENにし、公開札取得は旧所有者から新公開領域へ移す。Blood3能力値は所有者に追従、実祝福喪失は補正を即時除去し本人だけの従者超過選択で闇の聖女を候補外、実ハジャ喪失は実2詠唱から1札選択破棄し6手札は本人の次START/補充辞退/mainpassまで保持してENDで1枚捨てる。実シェリム詠唱/全手番/専用裂界で異界を作り、異界所有者の実手札とOPENを対象外、既公開夜明けの移動は異界の者を帰還させず、山札から未公開夜明けを取得すると初回帰還処理。フーセン初回公開後の実Bow死亡に対し公開フーセン移動は復活を再発動しない。実B公開/母様の真実/全手番後の取得は成立済み陣営・目的・保護対象を保持。実Bow捨て札、解決中元札、人物、他席、未解決重複、stale選択等はstate全view不変で拒否。公開既知札だけ取得内容を公開、非公開詠唱/自己裏従者/山札/手札は取得者と元所有者だけの私的履歴。命運取消は選択/取得なし、辞退は元札保持。Engine44/関連4/DO34全保存再送/browser34私的取得候補・各移動・上限選択・ハジャEND調整・reload/型/ledger確認。18条項＋主処理2の20行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-wish-physical-bindings.json)。171枚binding対応済み、他24（部分2＋他22）と共有/全体は未完。

- [x] Other195母様の真実10条項＋pending main1対応。実setup/START/補充選択/対象本人REVEAL後、公開activeアスフェルトだけを対象にし、アスフェルト本人の使用・別人物・非公開・本人指定・他席・開始前/補充前・占星・未解決重複はstate全view不変で拒否。実シェリム詠唱/全手番/専用裂界の異界対象は候補外、実催眠と回復失敗で停止中の自己手番も使用不可。実混乱と回復失敗の能力禁止中は印刷カード使用可。元札を即時補充なしで支払い、解決前は対象不変、SP0/13でも判定を作らずGOOD・EVIL全滅目的・Lia保護/敗北条件を一括置換して対象attachmentへ公開設置、主行動消費。実先行GOOD変換済みアスフェルトにも使用可。判定なしのため命運強制失敗の対象なし、実手札使用取消は元札捨て札/主行動消費のみで対象全体不変。実全手番後のGOOD変換なら設置維持、魅了抵抗成功なら維持、魅了抵抗失敗でEVILへ変更した時点で設置札を1回捨て、実後続GOOD変換では自動復帰なし。実Bowでアスフェルト本人が死亡すると死亡贈与窓までは設置を保持して通常処分後に除去、実BowでLiaが死亡するとGOODアスフェルトは放浪して手札返却・勝敗判定へ進み母様札は保持。前回実Wish2物理のMother取得後profile保持2ケースをAST一致で再利用し、除去だけで陣営等を巻き戻さない証跡を対応。Engine新17/関連4＋再利用2/DO16全保存再送/browser16対象公開・制限・設置・後続変換・死亡/放浪・reload/型/ledger確認。10条項＋主処理1の11行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-mother-truth-physical-bindings.json)。172枚binding対応済み、他23（部分2＋他21）と共有/全体は未完。

- [x] Other195復活の儀式8条項対応。実setup兵士配置・ウーノス策謀・魔道書設置・全手番・Bow被弾（兵士処分と本人3damage）・後続女衛士配置・全手番を経たウーノスが自己主行動で使用し、元札を即時補充なしに支払い、判定なしで同席の公開ヴァンミール・damage0/耐久力25・新陣営/目的/保護へ置換、残手札/実配置/設置/実使用履歴を保持、旧人物能力を継承せず、元札を1回捨て主行動消費。専用窓の席順で下僕達とアルセイル陰謀をそれぞれ選択/不選択、選択時のみディア/ヨーツルム転向・アルセイル個人勝利退場、全反応前の勝敗確定なし。実命運取消は元札と主行動だけ消費し元人物状態を保持、判定なしへの強制失敗は拒否。裏/表ディアから公開activeウーノスへの実贈与は開始前/補充中/行動中/行動後/策謀割り込み窓内で手札から手札へ原子的移動、同一窓IDを維持して取消可能なaction/子窓を作らず、即時補充/強制公開なし、公開贈与logは札IDを伏せて両所有者だけ私信で取得。実混乱中は贈与可、実催眠停止中は不可、非公開受取人は実公開後だけ可、実Bow死亡後の公開ウーノスは不可、札はディアの手札に残る。非資格人物/自己/別人物/不正ID/優先権外/重複/誤手番はstate全view不変で拒否、受取ウーノスが同じ物理札を儀式に使用する後続経路も実行。Engine18/関連4/DO17全保存再起動再送/browser17操作・reload/型/ledger確認。semantic8のみimplemented増、既存main1は証跡更新、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-ritual-physical-bindings.json)。173枚binding対応済み、他22（部分2＋他20）と共有/全体は未完。

- [x] Other195おまえは、俺の敵でないっ！！2条項・月の竪琴3条項＋各pending main2対応。実初期deal/setup/START/補充選択から同一攻撃宣言で両複合/片方/不使用を選び、技と各複合元札を即時補充なしに独立支払い、自分だけ精神力+2、魔詩5/5を7/9へ補正。実沈黙の無損害nullはnullのまま効果6→8、実イダ専用気斬で精神力0の数値damage0は4・効果9になり、不在damageの新造と数値0補正を区別。実命運による片方だけ取消はもう片方を維持し親処理へ復帰、親取消は精神力補正を終了、支払いは返らず各元札1回処分。初期magic4に対する魔詩use5で実判定threshold8を固定し出目8成功/10失敗、失敗による補正終了と確定判定の不変、出目確認後の追加禁止を確認。実防御側反撃への複合と相手からの子反撃を受ける間も精神力補正を維持し撤退終了時に除去。実先行進撃は無補正、後続実撤退中は補正を保ち完了で除去。実詠唱/全手番を経たシン専用天地百撃斬の2対象3hit計6hitを通して補正を維持し、実全手番後の独立Bow攻撃へ持ち越さない。非精神技の竪琴/重複/他人の札/未知ID/単独使用/後付けはstate全view不変で拒否。新Engine17/関連13/既存DO5保存再起動再送/既存browser3選択・不使用・反撃・reload/型/ledger確認。semantic5＋main2の7行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-combination-physical-bindings.json)。175枚binding対応済み、他20（部分2＋他18）と共有/全体は未完。

- [x] Other195全軍突撃せよ7条項＋pending main1対応。実初期配札/setup/START後、手札の下部攻撃プロファイルを持つ従者を1枚選び、全軍札と従者札を即時補充なしに支払い、親札→依存従者→必要な士気判定を独立宣言で解決する。実グリフォン効果5/damage8×2、女性親衛隊の遠魔弓4/6、ドワーフの自己戦士Lv4・遠戦斧・6×3・士気-2、ウパの全軍でも専用士気免除なしを確認。士気threshold6の出目6成功/7失敗を固定し、失敗も両札を1回処分して従者配置/選び直しなし、主行動消費。実命運の親だけ/従者だけ取消、士気強制失敗、実神判による出目2への振り直し後も強制失敗維持を確認。実先行進撃後のウッドゴーレム近戦格3/5と兵士近戦1/1は士気不要。実妖精族の士気→ランダムuse9固定→戦士5との差4回判定→damage5、実地竜の全員対象3席と初期配置した地上兵士の破壊・各8damageを実行。実自己setup配置済み/他人初期配札の従者は不可、実混乱中は全軍使用可、実催眠による手番飛ばしと実沈黙による魔法従者は禁止。自己/空/重複/余分な対象・複数従者payload・非従者・他席・開始/補充前・重複使用はstate全view不変で拒否、不使用は両札保持。新Engine20/関連Engine・Protocol25/既存DO5保存再起動再送/browser3成功・士気失敗・不使用・親/従者/判定reload/型/ledger確認。semantic7＋main1の8行implemented、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-all-army-physical-bindings.json)。176枚binding対応済み、他19（部分2＋他17）と共有/全体は未完。次の札ID確認時に前回のcombination-physical通常防御拒否ケースがa2-p06-r1c3間合い/休息を使っていたことを確認し、a2-p05-r3c1見切るへ変更。複合なしの通常防御が実際に成立する分岐を正の対照として追加した上で、同札＋Spiritの拒否と反撃での使用可を確認。該当counter2ケースと型が成功し、currentASTへ再binding。通常防御拒否を証明する旧入力の不足を補い、本番処理は変更なし。

- [x] Other195間合い/休息の残る7物理（p06r1c3/r2c1〜3/r3c1〜3）各14条項、計98対応。初期配札/setup後の実Bow4damageから自己手番REST1点、2物理同時RESTの合計2点、実命運が第1子だけを取消したとき残る第2子の1点、5物理RESTで最大耐久力まで4点回復して全5札消費を確認。即時補充なし・判定なし・自己だけ回復・主行動消費、重複札/薬混在/他席/開始・補充前/途中モード切替はstate全view不変で拒否。実Bowまたは精神技魔詩への間合いは既存damage4を保持して対象hitを回避、実詠唱と全手番後のシン3hitには最初の1hitだけ回避し残り14damage。実黒翼飛翔剣の追加1枚条件は別物理2枚が必要、1枚で止めると7damageを受ける。実攻撃者踏み込みで間合い取消・距離不変、実進撃への間合いは相互farを維持、実進撃/攻撃後の撤退は相互farへ戻して既存markerを処分し主行動終了。実間合い不可技には支払い前拒否して手札保持、休息/防御不使用も札保持。実詠唱/2対象攻撃で両対象の別物理間合いを1枚の踏み込みが同時に取消する応酬を確認。Engine84/関連23/新DO14全コマンド保存再起動再送/新browser14各物理の休息第1子取消・回避・reload/型/ledger確認。semantic98のみimplemented増、既存main7は証跡更新、accepted0昇格。[証跡](../../operations/evidence/2026-09-10-r5-maai-other-physical-bindings.json)。183枚binding対応済み、他12（部分2＋他10）と共有/全体は未完。再開時に8枚としたのは誤り。a2-p07-r3c3は黒流弓であり間合い/休息ではない。対象JSONと原本転記で確認し、その12パラメータを試験から除外した。初回96ケースの79passにはこの誤対象の2passを含み、17failには誤対象10failと有効7枚の複数対象用踏み込みID誤指定7failを含む。有効77passを維持し、実fixtureの「踏み込み／蹴る」を名前で特定した該当7ケースを再実行して84unique成功。黒流弓の台帳は未昇格で次へ残す。既に対応したp07r1c1〜r3c2の8枚は同じOther195側の先行対応であり、今回の7枚と合わせ間合い/休息15物理となる。

- [x] Other195 黒流弓a2-p07-r3c3の14用途条項＋既存main証跡を対応。実初期配札/setup後の通常遠戦弓use5/effect5/damage10、戦士4の不足1判定で精神6・出目6成功/7失敗、通常アーネスが専用を自動選択しないこと、実配置メタルゴーレム6による通常損害0・従者公開を確認。選択したアーネス専用は戦士0/精神0でも使用5チェックを省略、合法な1/2/全3対象を選択でき、実公開した同陣営対象は拒否、実進撃後の近距離相手にも使用可能。専用従者無視は実配置したメタルゴーレム/兵士を非公開のまま保持して各10damageを与える。実混乱で人物能力が停止しても専用効果を使用でき、実沈黙は戦士技を禁止せず、実催眠/回復失敗は手番を飛ばす。実命運取消で対象damageなし・元札1回処分、チェック不要攻撃への強制失敗は拒否。実間合い/見切るは専用でも使用でき、Bだけ回避/C10、人物弓能力は自動付与しない。誤所有者の専用・偽対象・誤時機・REST/turn/CHANT・再使用はstate全view不変で拒否、不使用は札保持。Engine18/関連5/DO16全コマンド保存再起動再送/browser16実UI・reload/型/ledger成功。semantic14だけimplemented増、main1再binding、accepted0昇格。ブラウザー初回15成功/1失敗で、誤所有者が専用チェックを選んだとき攻撃ボタンが有効になる本番UI不備を検出。既存サーバー資格判定canSelectPrintedDedicatedをengine公開APIへexportし、Boardの攻撃command構築にも同じ判定を適用して送信ボタンを無効化。型成功後、同じbrowser16を再実行して全件成功。Engine/関連/DOは初回成功。 [証跡](../../operations/evidence/2026-09-10-r5-black-bow-physical-bindings.json)。現在の正確な集計は全体184/220、Appendix A24/25、Other160/195（残35）。

- [x] Other195 黒翼飛翔剣a2-p08-r1c1の16用途条項＋既存main証跡を対応。実初期配札/setup後の通常遠戦剣use/effect5・damage7、戦士4の不足1判定で精神6・出目6成功/7失敗を確認。実アーネスも不選択なら通常5/7で、実配置メタルゴーレム6に防がれてdamage0・従者公開。選択したアーネス専用は戦士0/精神0でも使用5チェックを省略しeffect6/damage10へ置換、同従者を非公開のまま残して10damageを与える。両モードとも対象1人・間合い2枚を保持し、2対象/実公開した同陣営対象を拒否、実進撃で近距離となっても使用可。実混乱/沈黙下でも印刷戦士専用を使用でき、実催眠/回復失敗で手番を飛ばす。実命運取消は対象/従者不変・元札1回処分、チェック不要への強制失敗を拒否。通常/専用それぞれで実間合い1枚後のsubmitted1/remaining1を保存し、同じ物理の再使用を拒否。1枚だけなら7/10damage、別物理2枚なら回避し両札処分、通常見切るも専用攻撃を回避できる。誤所有者の専用・誤時機・CHANT/REST/turn・偽対象・再使用はstate全view不変で拒否、不使用は札保持。Engine20/関連6/DO18全コマンド保存再起動再送/browser18実UI・reload/型2回/ledgerすべて初回成功。semantic16だけimplemented増、main1再binding、accepted0昇格。 [証跡](../../operations/evidence/2026-09-10-r5-black-wing-physical-bindings.json)。全体185/220、Appendix A24/25、Other161/195（残34）。

- [x] Other195 黒翼天翔剣a2-p08-r1c2の22用途条項＋既存main証跡を対応。実初期配札/setup後の手札では通常/専用とも攻撃拒否、実CHANT直後も拒否し、自己END・他3人の全手番・次の自己START/補充選択後に発動。通常遠戦剣詠use/effect7・damage12・単体・間合い2枚を確認。実アーネスも通常選択なら7/12で、実配置メタルゴーレムLv6/HP5を処分し本体7damage。専用選択ならeffect8/damage15・従者無視で同従者を非公開のまま保持し15damage。戦士0/精神0でも7回の使用チェックを省略するが詠唱を省略しない。通常戦士6は不足1回の精神6判定、出目6成功/7失敗。実進撃の近距離相手にも使用でき、実混乱/沈黙でも印刷戦士専用を使用可、実催眠/回復失敗は手番飛ばし。実命中後の専用窓で任意0/1/2物理踏み込みを一括消費し+0/5/10、一度だけ・即時補充なし・全支払い各1回処分。重複・非踏み込み・他人の札・未知札・別group・他席・窓外・再支払いはstate全view不変で拒否。通常/専用不選択・追加不選択は追加コスト保持。実Bの間合い2枚→実Aの第1踏み込みで取消→命中後の別の第2踏み込みだけで+5、先に使った物理は再支払い不可、距離不変を確認。実間合い1枚なら15damage、2枚または見切るで回避すると命中後支払い窓を開かず全追加コスト保持。実命運取消は詠唱元札だけ処分し命中/追加支払いなし。Engine21/関連5/DO18各コマンド保存再起動再送/代表browser10実詠唱・全手番・実コスト選択・reload/型3回/ledger成功。semantic22だけimplemented増、main1再binding、accepted0昇格。Engine初回20成功/1失敗は、防御者の間合い2枚のうち1枚提出時点で攻撃者へ進めた試験手順のNOT_PRIORITY。実normal-defenseの追加提出を終えdefense-advanceへ進んでから攻撃者が支払うよう修正し、該当1件のみ再実行成功。残20は初回成功を維持。DO初回15成功・見切る/混乱/沈黙3件が15秒timeout。同じ3件を無変更で再実行して成功、制限時間は変更せず時間要因の恒久解消は主張しない。browser初回4成功/専用6失敗から、人物宣言能力候補のないアーネス専用では未詠唱でも攻撃ボタンが有効になる本番UI不備を確認。engineの既存techniqueForを公開exportし、Boardの候補不在時にも選択した印刷技（複合時は従属技）のchantと実詠唱領域を確認する。宣言能力候補がある場合は既存preview判定を維持し、人物の詠唱省略を妨げない。修正後の同じbrowser10全件と関連browser5（シン/シェリムの省略、氷狼専用の未詠唱/詠唱、獣王複合）・型が成功。 [証跡](../../operations/evidence/2026-09-10-r5-sky-wing-physical-bindings.json)。全体186/220、Appendix A24/25、Other162/195（残33）。

- [x] Other195 風斬剣a2-p08-r1c3/雷斬剣p08r2c1/裂風斬p08r2c2の19/17/21用途条項、計57＋既存main3証跡を対応。実初期deal/setup/STARTから通常遠戦剣風use/effect4・5・6、damage6・7・8、選択したアスフェルト専用effect6・7・8、damage12・14・16を確認。通常アスフェルトは自動専用化しない。実砦Lv3/HP2を通したdamageはHP無視の風斬6/裂風8・通常雷斬5、専用では12/16/12。実水竜Lv7は士気成功後に風斬専用Lv6を防いで残り、雷斬専用Lv7とは相殺して本体0・破壊、裂風専用Lv8は士気前に破壊して本体16。実メタルゴーレムLv6/HP5は風斬専用と相殺0、雷斬専用では本体9、裂風専用では破壊して16。Cのsetup実補充で祝福を開き、水竜snapshot levels[8]・level-destroyed・士気なしを確認、効果Lv8との同値でも全3対象へ16damage。従者HP無視は従者Lv防御を省略しない。通常不足1Lvの精神6判定は出目6成功/7失敗、専用戦士0/精神0は全使用チェック省略。実進撃後の近距離、1/2/全3対象選択、実公開同陣営拒否、実混乱/沈黙で印刷戦士専用使用可、実催眠/回復失敗で手番飛ばしを確認。通常/専用とも風斬・裂風は間合い2枚、雷斬は1枚、未完の1枚なら被弾、十分な枚数なら従者を非公開のまま保持して回避。見切るは風斬のみ可能で雷斬/裂風は支払い前拒否。実命運取消は対象/従者不変・元札1回処分、不使用/誤所有者/誤時機/偽対象/CHANT/REST/turn/再使用は原子拒否または手札保持。Engine22登録（各card parameterの試験内で複数の実mode経路）/関連18/DO24全コマンド保存再起動再送/代表browser18各札guard・専用・全対象・間合い・見切る・取消/型3回/ledger成功。semantic57だけimplemented増、main3再binding、accepted0昇格。本番変更なし。Engine初回20成功/風斬・雷斬のmatrix2失敗は水竜の正規士気1回を総roll数に含めていなかった期待値不足。該当2ケースを修正して成功。祝福境界の観測追加時は完了後に破棄済みのgroupを参照して1失敗、解決中のsnapshotでLv8・破壊outcome・士気なしを観測するよう直し当該1ケース成功。既存の他19登録ケースは初回成功を維持、現行unique22成功。DO初回19成功/5件15秒timeout（雷斬evade、裂風dedicated/all/maai/evade）は同じ5件を無変更で再実行して成功。制限時間は変更せず時間要因の恒久解消は主張しない。browserでは水竜の実ランダム士気成否をC本人viewから観測し、失敗時の本体被弾/従者処分もその実結果に従って検証する。 [証跡](../../operations/evidence/2026-09-10-r5-asfelt-swords-physical-bindings.json)。全体189/220、Appendix A24/25、Other165/195（残30）。

- [x] Other195 手裏剣a2-p08-r2c3の21用途条項＋既存main証跡を対応。実初期deal/setup、Bの従者配置補充で破邪の石OPEN→詠唱上限2、Bの実CHANTを全手番を経て2回・Cの実CHANT1回を成立させ、詠唱領域の注入なしで命中対象を準備。通常遠戦忍反use/effect4・damage5、通常イダも専用自動選択なし、実メタルゴーレム6が防いで本体0・従者公開・詠唱保持。選択イダ専用はeffect6・1d6×5で、実メタル/砦を非公開のまま無視。全出目1〜6で5〜30を確認し、1回の数値ロールを1/2/全3対象へ共有、精神0/戦士0でも4回の使用チェックを省略するが数値ロールは必要。数値ロールはafter-rollから始まり、強制失敗不可。通常戦士3は精神6の不足1回判定、出目6成功/7失敗。実近距離進撃・公開同陣営拒否・混乱/沈黙下の印刷戦士専用・催眠/回復失敗の手番飛ばしも確認。対象ごとの命中時に全廃棄/不使用を1回選び、Bの実詠唱2枚をまとめて廃棄、Cは独立に1枚を残す選択が可能。選択前に相手の詠唱物理IDを全view/実UIへ漏らさず、部分payload・偽対象・別actor・時機外・再選択は原子拒否。実間合い1枚/見切るでBは詠唱2枚と従者を保持して回避、Cだけ被弾・廃棄可。実命運取消は数値ロール前に止め、命中選択なし・元札1回処分。通常反撃4対incoming3は5damageを返し、同値4対4は相殺して0、4対5は未払い拒否・イダ専用6なら返して命中後の詠唱廃棄も可能。実専用反撃の命運取消では元の4damageへ戻り対象詠唱保持。不使用/誤所有者/不正対象/攻撃以外のモード/誤時機は手札保持またはstate全view不変で拒否。Engine28/関連3/DO21各コマンド保存再起動再送/代表browser14実攻撃・反撃・ランダム実結果・対象別廃棄・reload/型/ledger成功。semantic21だけimplemented増、main1再binding、accepted0昇格。Engine初回22成功/数値6失敗はnumericロールにもbefore-roll窓があるとした試験手順。beginRollのnumericは直ちにafter-rollへ進むことを確認し、出目をその窓が開く直前に与えて当該6件だけ再実行成功。初回型はContinuationのtargetIdを未絞込で参照した3エラーを修正し、以後2回成功。DOは直近の一括実行timeoutを踏まえ、同じ21ケースを重複なしの7件×3組として順番に実行、全組初回成功。これはtimeout原因の恒久解消を示すものではない。黒流弓時に追加したBoardの資格確認が、サーバー全体判定ではなくcanSelectPrintedDedicatedという部分判定に接続されていた。このため旧登録方式の手裏剣専用が画面で無効となり、browser初回は2成功/3timeout後に原因を確認して停止（exit130、残9件未完走）。サーバーで使うcanSelectDedicatedを既存のまま公開exportし、Boardを同じ全体判定へ変更。停止後に残った当該試験workerd PID68274が8787番を保持し再試行が起動前に失敗したため、lsofで本repoのapps/workerプロセスと確認して当該PIDだけTERM終了。修正後の同じbrowser14全件と関連browser3（シン天地百撃斬、黒流弓誤所有者、黒翼天翔剣の専用詠唱必須）・型が成功。 [証跡](../../operations/evidence/2026-09-10-r5-shuriken-physical-bindings.json)。全体190/220、Appendix A24/25、Other166/195（残29）。

- [x] Other195 裏天空剣a2-p08-r3c1の17用途条項＋既存main証跡を対応。実初期deal/setupでBメタルゴーレム・C兵士を配置し、手札の進撃を実APPROACHして距離標へ保存した近距離から使用。通常近戦剣忍use/effect5・damage5・単体・詠なし/反なし。通常イダも専用自動選択なし、実メタル6が防いで本体0・従者公開。選択イダ専用は同じeffect5/damage5/近距離のまま、精神0/戦士0でも5回の使用チェックを省略し、メタルを非公開のまま無視。通常戦士4は精神6の不足1回判定、出目6成功/7失敗。実混乱下も印刷専用/2回予算は残るが人物の必殺は使えず、沈黙下は戦士技と人物の必殺を使用可、催眠/回復失敗は手番飛ばし。実命中の必殺を0/1/2回任意選択、通常イダは1回だけ。耐久コスト0、1/6や2/4は倍化なし、1/2と5/6の2回成功で20damage、各回に実numeric2d6が必要で3回目拒否。1回目ゾロ目は即死予定を記録しても対象はまだactive・damage0・従者保持、任意2回目を省略して窓終了後に1回だけ死亡/廃棄。1回目の実命運による能力取消も1回分を消費し、2回目を実神性介入で2/2から1/2へ全出目再判定すると即死にならず10damage。numericへの命運強制失敗は原子拒否。実間合い1枚/見切るは従者を隠したまま回避し、必殺の機会も出ない。元技の命運取消は命中前で止まり元札1回処分。遠距離では両モード拒否、実進撃後は使用可。アーネスへ実進撃後に正体公開すると同陣営対象拒否。実次B手番の弓をAへ撃ち、本当の防御窓でも反属性のない裏天空剣は通常/専用とも拒否、元弓4damageを受け裏天空剣は手札保持。誤所有者・不正対象・別actor・時機外・REST/通常使用/CHANT等はstate全view不変で拒否、不使用では札を保持。Engine24/関連7/DO21各コマンド保存再起動再送/browser17実操作・実ランダム結果・reload/型/ledger成功。semantic17だけimplemented増、main1再binding、accepted0昇格。Engine初回13成功/8失敗は、進撃成功札を捨て札と誤認した7件と死亡時lifeIdが更新されないと誤認した1件。実装の距離標保存と死亡境界を確認して当該8だけ再実行し1成功/7失敗、残7はmaaiRequired省略時の既定1を明示fieldと誤認しており既定を含む比較へ修正して7成功。後続のnumeric命運拒否/実公開同陣営/実防御窓拒否3件は初回成功、unique24。DOは7件ずつ3組、最初3成功/4失敗はロールを一度も生成しないstateのrolls未定義を試験が直接filterしたもの。空配列扱いへ修正して当該4だけ再実行成功、残2組各7件初回成功。DO timeoutなし。型は初回/DO追加後成功、UI追加後nullable参照5件を修正し最終成功。browser初回16成功/1失敗は進撃等と共通の対象チェック欄を距離で無効とした試験期待。遠距離攻撃を実送信→INVALID_ACTION/通知表示/revisionと全game不変・未払い→reload→実進撃→専用攻撃5damage成立へ直し当該1件成功。修正後の最初の選択条件はファイル名を含むPlaywright titleを先頭anchorで絞って0件/exit1となり、anchorを外して同じ1件を実行。2回目は公開エラーをEngine内部のOUT_OF_RANGEと誤認して1失敗、WorkerのINVALID_ACTION正規化と日本語通知を確認して当該1件を修正。本番コードの変更なし。 [証跡](../../operations/evidence/2026-09-10-r5-ura-sword-physical-bindings.json)。全体191/220、Appendix A24/25、Other167/195（残28）。

- [x] Other195 影分身a2-p08-r3c2の21用途条項＋既存main証跡を対応。実初期deal/setup→実弓Lv3・雷斬剣Lv5・裂風斬Lv6の受けから使用し、通常−戦忍反use/effect5・damage null・防御専用で相手技Lvとの比較なし。通常は攻撃者精神6−1の閾値5、出目5成功なら元弓4damage、出目6失敗なら元弓を防いで0。通常イダも自動失敗化なし、シン相手は通常/専用とも抵抗ロール不要で元弓4damage・追加攻撃なし。イダ専用は非シン相手を自動失敗化するが使用チェックは省略しない。B戦士4/精神6は不足1回判定6成功/7失敗、成功後の非反札の黒翼飛翔剣も独立に不足1回判定を行い成功7damage/失敗0。印刷専用による追加攻撃のsource/actor/元攻撃者targetは公開、使用候補は本人だけ。対象変更・進撃/撤退・追加詠唱・未詠唱氷狼乱舞陣・遠距離の裏天空剣・別actor/誤owner/不正組合せ/時機外・自身の次手番の攻撃/CHANT/REST等は原子拒否。実BCHANT氷狼乱舞陣→自分END→C/D手番後の元A攻撃に対し、詠唱領域の実氷狼乱舞陣で7damageを返せる。実A進撃後は近距離の裏天空剣専用で5damageを返せる。Aに実初期配置したメタル6は通常黒翼飛翔剣の子攻撃を防いで本体0・従者公開、子攻撃へ従者無視を足さない。不使用なら影分身を保持して元弓4damage、追加攻撃不使用なら元弓0・子札保持。元影分身を実命運取消すると元弓4へ戻り、子攻撃だけ取消すると元弓失敗化を維持して両本体0・子札1回処分・再攻撃機会なし。実D混乱/沈黙を受けても印刷戦士の影分身/追加攻撃を使用可、催眠では未払い拒否。実レスター専用呪歌の反撃不可には通常/専用とも未払い拒否。非シンの実CHANT天地百撃斬は精神8−2の使用判定6成功、実1対象×3ヒットの最初の受けだけ影分身で防ぎ、Bは残2ヒット14damage・C0・子攻撃A7。シン専用の実CHANT2対象×3ヒットは影分身で失敗せずB/C各21・子攻撃なし。Engine29/関連4/DO25各コマンド保存再起動再送/browser22実操作・実ランダム判定・reload/型/ledger成功。semantic21だけimplemented増、main1再binding、accepted0昇格。Engine初回19成功/9失敗。5件は追加攻撃の公開概要も本人以外nullと誤認した試験で、公開source/actor/targetと本人限定候補に分けて修正。状態異常3件と非シン多段1件は、公開された同陣営への攻撃を準備してしまったfixture。最初の配役修正もアスフェルトがEVILのため4件失敗が残り、対象の人物6件だけinitial_factionを確認してGOODランスロットへ変更、状態異常3件成功。残る非シン多段は通常の天地百撃斬が単体という条件も誤り、実1対象×3ヒットへ修正し、シン専用の実2対象×3ヒット/影分身無効を別の新規1件で検証、2件成功。unique29。DOは重複なし5件×5組、最初4成功/1失敗は低Lv専用が影分身と選んだ子攻撃の両方で判定するのに1回と数えた試験。選択した子攻撃の独立判定を含む2回へ修正し当該1件だけ成功、残4組各5件初回成功、timeoutなし。型5回成功。browser初回4成功/2timeoutの時点で共通原因を確認して停止（exit130、残16未完走）。labelは選択肢の文言も含むためgetByLabelのexact:trueが実在する選択欄に一致せず、既存画面試験と同じラベル指定へ修正。中断後の試験workerd76403/親node76393をログとlsofで本repoのプロセスと確認し当該PIDだけTERM終了、8787番解放を確認。失敗2件＋未完走16件だけを再実行し16成功/2失敗。詠唱札の正名は氷狼乱舞陣で、略名を期待した1件を修正。もう1件は共通候補欄に誤所有者の影分身が残り、専用送信ボタンも有効だった。送信ボタンを直接検証する1件でも修正前の失敗を確認し、ReactionPanelのdefenseBaseへサーバーと同じ全体資格判定canSelectDedicatedを追加。元のカード候補から通常使用へ戻せるまま、不正な専用送信を無効化した。修正後は同じ影分身browser22全件と関連3件（シン専用詠唱反撃、シェリム白光専用防御、イダ手裏剣専用反撃）・型が成功。 [証跡](../../operations/evidence/2026-09-10-r5-shadow-card-physical-bindings.json)。全体192/220、Appendix A24/25、Other168/195（残27）。

- [x] Other195 気斬a2-p08-r3c3の18用途条項＋既存main証跡を対応。実初期deal/setup→実攻撃で通常遠・戦剣精忍use/effect6・ダメージ術者精神力、通常から従者無視。イダ専用はeffect7・精神力×2・使用チェック不要、単体/noCHANT/noCOUNTERを維持。通常イダは自動専用化せず選択可能。実術者精神6・対象精神11で参照者を区別し、数値0はnullへ変わらず通常/専用とも0damage、専用は戦士0/精神0でも不足6回の使用判定なし。通常戦士5/精神6は不足1回判定6成功/7失敗。T06は第三者Dの実「この世界に愛と平和を」で、通常防御前damage窓内または固定後attack-abilities窓内に術者A/対象Bの精神を12+恒久補正へ変える通常/専用8通りを検証。術者を固定前に変えた時だけ変更後の精神（専用は×2）を使い、固定後の術者変更と対象の前後変更はダメージを再計算しない。各介入でD補充・実札1回処分、親窓への復帰とreload/保存再起動再送を確認。実初期配置メタル/兵士は通常/専用とも無傷・非公開のまま。実進撃後の近距離使用、実Cアーネス公開後の同EVIL対象拒否、実D混乱/沈黙後も印刷戦士専用使用可・催眠回復失敗は手番を飛ばして未払いを確認。実間合い1枚で防ぎ0damage、精属性に使用禁止の実見切るは原子拒否・UI候補なしで12damage。実命運取消は気斬1回処分・判定/命中なし、存在しない使用判定への強制失敗は拒否。誤owner/actor/対象/重複/複数対象/時機/CHANT/REST/turncardを原子拒否し、不使用は札を保持。Engine25/関連5/DO23各コマンド保存再起動再送/browser23実操作・実ランダム判定・reload/型/ledger成功。semantic18だけimplemented増、main1再binding、accepted0昇格。Engine初回23成功/2失敗。共通防御制限の精属性による見切る禁止をテストが見落としていたため、間合い使用可と見切る未払い拒否へ期待値を修正し、当該2件だけ再実行して成功。アプリ本体の変更なし。関連Engine5、DO重複なし5/5/5/4/4件、browser23は初回成功。型はfixture/Engine追加時とDO/UI登録後の2回成功。 [証跡](../../operations/evidence/2026-09-10-r5-ki-slash-physical-bindings.json)。全体193/220、Appendix A24/25、Other169/195（残26）。

- [x] Other195 獣王剣a2-p09-r1c1の22用途条項＋既存main証跡を対応。実初期deal/setup→実攻撃で通常遠・戦剣獣use/effect6・damage10、単体/noCHANT/noCOUNTER。通常ウパニシャットは自動専用化せず、選択した専用は使用チェック不要・獣破壊・任意の戦士co-source1枚を許可。戦士0で単独専用の不足6回判定を省略、通常戦士5/精神6は不足1回判定6成功/7失敗。実水竜は通常なら士気成功後に防いで0、専用なら士気前に獣破壊して10。非獣の実守護者は精神6−1の士気成功なら残って0、失敗なら退場して10。合成は実弓で14、気斬で精神6+10=16・精/忍/従者無視継承（水竜は通過し非公開のまま残る）、影分身のnull成分をnullのまま保持して基礎10と反属性、実進撃後の狼牙で共有2d6出目3/4+10=17。実滅殺斧CHANT→自分END→B/C/D手番→合成は22、既詠唱領域から支払う。黒竜剣との近距離合成は獣/白破壊の和集合で16。Bの初期水竜配置の補充で実祝福をOPENし、2体目の守護者も実初期配置して両方破壊を確認。すべて合成use/effect6でLv加算なし、2実札を受理時に支払い・補充なし・source provenanceを保存。実CHANT天地百撃斬は別途精神6−2の事前activation判定を維持し、4成功/5失敗を確認。成功後だけ共有d6出目3→固定17×3ヒット=51、失敗なら両札処分・命中/数値ロールなし。実初期配置グリフォンの本人専用合成は任意のB/C2対象×18を2ヒット、支払いで自分の従者列から外し、B水竜破壊で36、C兵士HP1はG14同時集合により各ヒットへ軽減して34。黒翼飛翔剣の間合い2条件を継承し1枚では17、2枚なら0。裂風斬の見切る禁止を継承して18。実B弓Lv3を受けたAの手裏剣通常合成は反撃Lv6で15を返す。近属性co-sourceは遠距離で拒否し実進撃後15。現在戦士5より高い気斬Lv6合成は候補外・未払い拒否で精神判定による代用不可、獣王剣専用単独は使用可。滅殺斧は戦士7を満たしても未詠唱なら合成拒否。魔法/無分類見切る/他者札/自分自身/配列co/通常primary/他人物専用/対象・時機・モード不正を原子拒否。実混乱/沈黙でも印刷専用を維持し、催眠回復失敗は手番skip。不使用・誤ownerでは札保持。実命運取消は2札1回処分・別々の使用履歴・命中なし。Engine30/関連10/DO31各コマンド保存再起動再送/browser30実操作・実ランダム判定/数値・reload/型/ledger成功。semantic22だけimplemented増、main1再binding、accepted0昇格。Engine初回24成功/5失敗。通常水竜2件と専用守護者1件は従者士気判定を総ロール数から落としていた期待値、気斬合成1件は継承した従者無視で水竜を通過するところ破壊を期待した試験、グリフォン1件は兵士HP1を最初のヒットだけへ軽減して35と期待した試験。既存の従者処理順とG14同時従者スナップショットに合わせて5件だけ修正・成功。未詠唱合成の試験はLv不足も重なっていたため、fixtureを戦士7へ上げ未詠唱だけの拒否1件を再実行し成功。DO初回は重複なし5件×6組で28成功/2失敗。守護者は士気−1なので固定出目6が失敗し、天地百撃斬は精神−2の事前activation判定が固定出目6で失敗していた。守護者成功側と天地百撃斬の事前成功側を出目2へ設定し、後者はdamage窓から共有ヒット数の出目3を使用。天地百撃斬の事前失敗をDO新規1件へ分け、3件だけ再実行して成功。Engineにも事前判定4成功/5失敗の2境界を明示し直し、旧成功1件を置換して新規失敗1件を追加、2成功でunique30。DOunique31。UIは実ランダム値の士気/使用/activationの成否と数値式を読み取り期待結果を分岐、固定失敗専用DO scenarioはUIから除いた30件。アプリ本体の変更なし。型4回成功。 [証跡](../../operations/evidence/2026-09-10-r5-beast-king-physical-bindings.json)。全体194/220、Appendix A24/25、Other170/195（残25）。

- [x] Other195 破黒剣a2-p09-r1c2の15用途条項＋既存main証跡を対応。実初期deal/setup→実進撃→実攻撃で通常近・戦剣use/effect4・damage5、白従者破壊、単体/noCHANT/noCOUNTER/従者無視なし。ガーウィン専用はeffect5/damage7/noChecksに置換して近/白破壊を維持、通常ガーウィンは自動専用化しない。通常戦士3/精神6は不足1回判定6成功/7失敗、専用戦士0/精神0は不足4回判定を省略。実守護者Lv7は通常/専用ともLv比較/士気前に白破壊して本体5/7、実小天使Lv4は通常と同値/専用より低い場合とも破壊して本体5/7、Cの実兵士は触らない。非白メタルLv6は専用を止めて残り0damage、砦Lv3HP2は破壊され7−2=5。実B初期従者補充で祝福をOPENして2体を初期配置し、守護者→砦/砦→守護者の順は両方へ到達・処分して5、メタル前衛→守護者後衛はメタルで止まり両方残存・後衛守護者は非公開のまま。白破壊は全盤面への破壊ではない。実Cアーネス公開と2回の実進撃で近距離の同EVIL対象を拒否、実D混乱/沈黙でも印刷専用使用可・催眠回復失敗は手番skip。通常/専用の遠距離拒否は全状態/全員view不変で、実進撃後は使用可能。実間合い1枚/見切るで回避すると本体0・守護者非公開保持、実命運取消も白破壊/使用判定を起こさず実札1回処分。存在しない使用判定への強制失敗を拒否。実B弓を受けたAは破黒剣通常/専用の防御をともに拒否してA4damage・札保持。誤owner/actor/対象/CHANT/co-source/REST/turncard/時機/再使用を未払い拒否、不使用は札保持。Engine25/関連5/DO23各コマンド保存再起動再送/browser23実操作・実ランダム判定・reload/型/ledger成功。semantic15だけimplemented増、main1再binding、accepted0昇格。Engine初回22成功/3失敗と型1箇所失敗は、祝福の公開札を存在しないGameState.openで参照した試験の誤り。実補充で祝福を開いたBのplayers.B.openへ修正し、該当3件だけ再実行成功。アプリ本体の変更なし。関連Engine5、DO重複なし5/5/5/5/3件、browser23は初回成功。型はDO/UI登録後に成功。 [証跡](../../operations/evidence/2026-09-10-r5-black-break-physical-bindings.json)。全体195/220、Appendix A24/25、Other171/195（残24）。

- [x] Other195 黒竜剣a2-p09-r1c3の18用途条項＋既存main証跡を対応。実初期deal/setup→実進撃→実攻撃で通常近・戦剣use/effect5・damage6、白破壊、単体/noCHANT/noCOUNTER。ガーウィン専用はeffect6/damage10/noChecks＋任意倍化、通常ガーウィンは自動専用化しない。通常戦士4/精神6は不足1回判定6成功/7失敗。専用戦士0は不足5回の使用判定を省略するが、倍化用の追加判定は残る。防御前damage計算の後に保存したtechnique-double-choiceで明示選択し、辞退は10・追加ロールなし。精神6は出目6成功20/7失敗10、精神0でも省略せず判定して失敗10。別actor/誤action/早期/反復/遅延選択は全状態・全員view不変で拒否。実守護者Lv7は通常/専用とも士気前に白破壊、Cの実兵士は不変。非白メタルLv6は専用と同値で本体0・自身は破壊、砦Lv3HP2は通常の専用10を8、倍化済み20を18へ軽減する。実D混乱/沈黙でも印刷専用の追加判定を選択でき、催眠回復失敗は手番skip。倍化判定を実施/辞退した双方で、実間合い1枚/見切るなら本体0・守護者非公開保持。実命運による元札取消は任意判定前に終了して追加ロール/命中なし・札1回処分。実D命運の追加判定への強制失敗は本来成功する出目2や6でも失敗を維持。実C神性介入で全2d6を振り直し、同一rollIdのgeneration1へ進む。Engineの7失敗→6成功、DOの8失敗→2成功は20damage、強制失敗後の振り直しは出目成功でも失敗10damage。どちらも技追加判定は1件で、再選択/再試行はできない。遠距離は通常/専用とも未払い拒否し実進撃後に使用可、公開同EVILの近距離Cを拒否。実弓を受けたAの黒竜剣は攻撃専用で、通常/専用の防御を拒否してA4・札保持。誤owner/actor/対象/時機/REST/turncard/不使用を確認。Engine29/関連4/DO28各コマンド保存再起動再送/browser28実選択・辞退・ランダム判定・命運/神性・reload/型/ledger成功。semantic18だけimplemented増、main1再binding、accepted0昇格。 全試験初回成功、アプリ本体の変更なし。[証跡](../../operations/evidence/2026-09-10-r5-black-dragon-physical-bindings.json)。全体196/220、Appendix A24/25、Other172/195（残23）。

- [x] Other195 魔空剣a2-p09-r2c1の20用途条項＋既存main証跡を対応。実初期deal/setup→実攻撃で通常遠・戦剣use/effect6・damage10、白破壊/見切り不可、単体/noCHANT/noCOUNTER。ガーウィン専用はuse6を維持してeffect7+k/damage15/noChecks/任意対象集合、通常ガーウィンは自動専用化しない。実1/2/3対象と非公開EVILのCを含む選択を検証し、実C公開後はCを拒否してB/Dを攻撃できる。実踏み込み0/1/2/4枚を札と同時に払い、補充なし・実回収機会のパス後に各cost札1回処分・advanceCostsを保存、効果Lv7/8/9/11へ上昇して使用Lv6/ダメージ15は不変。B実守護者は士気前白破壊で15、C実兵士はHP1軽減で14、D従者なし15。戦士0/精神0の4枚支払い・3対象も使用不足6回判定なし。通常戦士5/精神6は不足1回判定6成功/7失敗。実進撃後の近距離使用も可能だが、効果Lv用支払いで距離/既存markerは変わらない。実水竜Lv7は士気成功なら通常effect6で防いで残り、専用0枚effect7は同値で防いで処分、1/2枚effect8/9はHP4を軽減して11。支払い枚数が増えてもdamage加算なし。B/C対象の攻撃で実B間合い1枚に対し、効果Lv用に処分済みの踏み込みをPLAY_ADVANCEへ再使用できない。そこでパスならB0/C14、別の未使用札で実PLAY_ADVANCEならB15/C14へ戻り、effect8/距離は変わらない。見切るは通常/専用とも拒否。実命運取消では2枚のcostも返らず、両対象は命中なし・従者非公開のまま。重複/本体/非踏み込み/他者/未知/通常効果へのcost・不正対象を全状態/全員view不変で拒否。実APPROACHでmarkerになった札もcostへ使えず、別の手札の踏み込みは使用できる。後出しcost/二度目ATTACK/PAY_HIT_ADVANCESを拒否。実D混乱/沈黙でも専用の支払い/対象集合/使用判定不要を維持し、催眠回復失敗は手番skip。実弓を受けたAは通常/専用の魔空剣防御を拒否してA4・札保持。誤owner/時機/REST/turncard/不使用を確認。Engine28/関連5/DO28各コマンド保存再起動再送/browser28実costチェックボックス・対象選択・回収窓・間合い・実ランダム使用/士気判定・reload/型/ledger成功。semantic20だけimplemented増、main1再binding、accepted0昇格。Engine初回24成功/3失敗。水竜Lvを8と置いた2件の期待値は印刷Lv7に修正し、通常effect6の下側境界を新規1件で追加した。既存の専用0/1/2枚3件＋通常新規1件で、下/同値/上の比較とダメージ非加算を確認。残る取消1件はtargetActionIdの省略記法に対応する変数がなく、actionIdを明示して修正。型の初回1箇所失敗も同じ変数名。変更された水竜4件＋取消1件だけ再実行して5成功、unique28。アプリ本体の変更なし。関連5、DO重複なし5/5/5/5/5/3件、browser28は初回成功。型は修正/DO/UI追加後と、UIで不正cost候補を1件ずつ除外確認する変更後の2回成功。 [証跡](../../operations/evidence/2026-09-10-r5-void-sword-physical-bindings.json)。全体197/220、Appendix A24/25、Other173/195（残22）。

- [x] Other195 竜王爆砕剣a2-p09-r2c2の19用途条項＋既存main証跡を対応。実初期deal/setup→実攻撃で通常遠・戦剣use/effect8・damage10・単体/noCHANT/noCOUNTER、ガイナスの通常使用は専用化しない。専用は8/10を維持してnoChecks/任意1・2・3対象。非公開EVILのCを含められるが、実C公開後はCを拒否してB/Dを攻撃できる。戦士0/精神0でも使用Lv8の不足判定なし。攻撃側1d6を防御前に1回保存し、実出目1〜6で全対象の間合い要求2〜7枚。数値ロールへの命運強制失敗は拒否、実神の気まぐれは同じrollIdのgeneration1へ振り直し、最終出目の1+値を共有。命中したBは精神0でも12でも固定値6・2d6で判定し、6成功10/7失敗30。Cは別の2d6で反対の成否を出し、各対象1回で独立。成功/失敗とも次手番skip1を命中経路で付与。実A手番終了後、実B/CのSTART_TURNは手札/deck/rolls/damageを保って回復・ドロー・行動・調整なしで次席へ移動し、CHOOSE_DRAW/ENDを拒否。次の周のBはdraw/actionへ戻る。実水竜Lv7の士気成功後、HP4軽減した6が通常/抵抗成功の値、抵抗失敗は18。通常戦士7/精神6は不足1回判定6成功/7失敗で、専用の数値/抵抗/skipなし。実間合い2枚/4枚は要求2枚/4枚を満たしてBを回避させ、Cのみ抵抗する。要求3枚/5枚に対する不足2枚/4枚の一括提出は全状態/全員view不変で拒否し、実1枚ずつの不足支払いは処分されてもB命中・抵抗・skipとなる。通常間合い1枚と通常/専用の見切るは回避でき、抵抗もskipも発生しない。実命運取消は数値ロールより前で終わり、ダメージ/抵抗/skipなし、札は1回処分。実混乱/沈黙でも印刷の専用処理を維持し、実催眠の回復失敗は使用前に手番を飛ばす。実弓への通常/専用防御を拒否してA4・札保持。誤owner/対象/actor/時機/REST/turncard/不使用を確認。Engine33/関連3/DO24各コマンド保存再起動再送/browser24実出目・間合い1枚ずつ支払い・対象別抵抗・reload・実skip/型/ledger成功。semantic19だけimplemented増、main1再binding、accepted0昇格。Engine初回27成功/6失敗。通常使用の判定履歴が未生成でも空配列として扱う4件を修正。間合い不足2件はadditionalCardInstanceIds付きの一括提出が必要枚数ちょうどを要求する仕様だったため、不足一括の拒否確認と実1枚ずつ支払う不足経路に変更した。変更された6件だけ再実行して6成功、unique33。アプリ本体の変更なし。関連3、DO重複なし5/5/5/5/4件、browser初回は22成功/2失敗。間合いのUIはmaaiAtomicでない本技では1枚ずつ支払う仕様のため、一括選択fieldsetを探す想定を修正し、必要/有効/残枚数の表示と実1枚ずつ支払う操作に変更した。変更された間合い2件だけ再実行して2成功、unique24。型はDO追加後・UI追加後・この2件修正後の3回成功。同じ次手番へ複数source/複数hitが重なる実producerでのskip併合、status期間満了との交差、間合い6/7枚の実全額支払い、広いlifetime/回収交差は未測定で共有未完のまま。browserの間合いは実出目に対して必要枚数まで1枚ずつ支払い、shortは1枚不足（手札上限5枚まで）のままパス。6/7枚要求時の全額支払いは未測定。DOの抵抗は6成功/8失敗、7境界と精神0/12比較・翌周復帰はEngine証跡。 [証跡](../../operations/evidence/2026-09-10-r5-dragon-king-physical-bindings.json)。全体198/220、Appendix A24/25、Other174/195（残21）。

- [x] Other195 血流a2-p09-r2c3の19用途条項＋既存main証跡を対応。実初期deal/setup→実CHANT→一周の手番→実ATTACKで通常遠・戦黒詠use/effect8・damage10・単体/noCOUNTER・GOOD使用禁止。ガイナス通常使用は専用化せず、任意専用は8/10と詠唱必要を維持してnoChecks/任意1・2・3対象。非公開EVILのCを含む選択、実C公開後のC拒否とB/D選択を確認。戦士0/精神0でも使用不足判定なしだが、対象本人の精神力抵抗は残る。B精神6では通常−2の閾値4に4成功10/5失敗20、専用−3の閾値3に3成功10/4失敗20。B精神0/12に対する専用閾値−3/9と実出目6の失敗/成功、別対象C精神12の閾値9・出目10失敗で、攻撃者精神0から独立して対象別1回判定する。抵抗成功/失敗による永続状態/手番skipは付かない。実水竜Lv7のHP4軽減後は通常/専用とも成功6・失敗16で、追加10は1回。実初期従者配置の補充でOPEN祝福を出すと水竜Lv8が効果Lv8と同値で命中を止めて処分され、対象抵抗は起こらない。実間合い1枚と見切るは両modeで回避でき、Bの抵抗/追加ダメージなし、別対象Cは独立して命中。通常戦士7/精神6は不足1回判定6成功/7失敗、成功時だけ命中抵抗へ進む。実命運取消は使用済み詠唱札を1回処分して抵抗/ダメージなし。実対象抵抗への命運強制失敗と神の気まぐれ振り直しは同じrollId/generation1、強制失敗は振り直し成功後も残り追加10を1回だけ加える。実混乱/沈黙でも戦士技の詠唱/専用/抵抗を維持し、催眠回復失敗は使用前に手番を飛ばし札保持。実弓への通常/専用防御は実際の詠唱中でも拒否し、A4・詠唱札保持。GOODのシンは実CHANTを拒否、EVILのガーウィンは通常詠唱後に使用可能。誤owner/対象/actor/時機/REST/turncard/不使用/未詠唱攻撃を全状態/全員view不変で拒否。Engine35/関連3/DO31各コマンド保存再起動再送/browser31実詠唱・一周・対象別ランダム抵抗・防御・反応・reload/型/ledger成功。semantic19だけimplemented増、main1再binding、accepted0昇格。画面のeligibleChantCardsは人物の白黒技禁止だけを確認しており、現在GOODの血流詠唱候補を除外していなかった。現陣営GOOD/EVILとシン/ガーウィンの4件で初回2失敗/2成功を確認後、Boardからview.self.factionを渡し、techniqueForのprohibitedFactionsへ照合して除外する修正。過去/初期陣営で決めず現在値を使う。Web関連10成功、公開viewのfactionがstring型なので引数をstringとしsomeで同値比較する型修正後に当該4件成功。型の初回とUI追加後は同じ1箇所で失敗、型修正後は全対象成功。Engine35/関連3/DO重複なし5/5/5/5/5/5/1/browser31は初回成功。実GOODのブラウザでは通常/専用の両選択で詠唱ボタン無効。実陣営変更後・詠唱準備後の禁止/復帰、複数hitでの追加ダメージ、広いlifetime/回収交差は未測定で共有未完のまま。抵抗の正確な4/5・3/4境界と精神0/12はEngine証跡、DOの通常乱数は合計2、失敗例は6。browserは実乱数で成否とダメージを照合。 [証跡](../../operations/evidence/2026-09-10-r5-blood-flow-physical-bindings.json)。全体199/220、Appendix A24/25、Other175/195（残20）。

- [x] Other195 気破a2-p09-r3c2の16用途条項＋既存main証跡を対応。実初期deal/setup→実APPROACH→実ATTACKで近・戦格精白use/effect4・術者SP×2・間合い2枚・単体/noCHANT/noCOUNTER。ジル通常使用は自動専用化せず、任意専用はnoChecksとガドューラ精技無効例外だけを加える。術者SP0/1/6/12は0/2/12/24、対象SP11と区別。専用戦士0/精神0でも使用不足4回の判定なし。実Dの愛と平和で術者/対象のSPをダメージ準備窓の閉鎖前/後に変え、術者を閉鎖前に変更した場合だけSP×2の保存値が変わる。対象の変更や閉鎖後の術者変更で再計算しない。実ガドューラは通常気破の通常防御で死者をUSE_ABILITYすると0、任意不使用は12。専用では候補がなく直接要求も拒否して12となる。ただし専用でも実間合い2枚で回避し、実水竜Lv7は効果Lv4を止めるので、専用例外は従者や通常防御を無視しない。実水竜上側は0で残存、実小天使Lv4の同値は0で処分、実砦Lv3/HP2は10。水竜は精神11の士気判定あり、小天使/砦は士気成功確定で判定省略。通常/専用とも実間合い1枚は処分されても不足で12、2枚は0、近距離関係は維持。精属性により通常/専用の見切るを拒否。通常戦士3/精神6は不足1回判定6成功/7失敗。実遠距離からの両mode攻撃を拒否し、実APPROACH後に使用可能。実命運取消は数値準備/命中前で終わり0・札1回処分。実混乱/沈黙でも印刷専用/数式を維持し、実催眠回復失敗は使用前に手番を飛ばす。実弓への通常/専用防御を拒否してA4・札保持。実ガドューラ本人が使用者の白技禁止を支払い前に拒否。実公開した同陣営Cへの攻撃、不正対象/owner/actor/時機/REST/turncard/不使用を全状態/全員view不変で確認。Engine38/関連9/DO32各コマンド保存再起動再送/browser32実進撃・間合い枚数・死者選択/除外・平和SP変更・reload/型/ledger成功。semantic16だけimplemented増、main1再binding、accepted0昇格。Engine初回35成功/3失敗。小天使/砦は精神11と士気修正で自動成功するためロール1回の想定を0へ修正し、当該2件は成功。残る死者の試験は正体公開を期待したが原文/C03追加に追加の公開条件はなく、能力使用を選んだだけで公開する期待を削除した。さらに解決後に消える一時abilityフレームを残存すると期待していたため、宣言直後に1フレームを確認し、解決後はダメージ0を確認する形へ変更。3件再実行は2成功/1失敗、死者と白技禁止2件は1成功/1失敗、最後に死者1件成功でunique38。ブラウザの白技禁止1件は修正前に攻撃ボタンenabledで失敗を確認。エンジンの既存printedTechniqueAllowedを公開exportし、引数を実際に必要なcharacterId/factionへ限定して比較をstring同値へ変更、Boardから既存判定を使用して禁止された技の攻撃コマンドを作らない修正。エンジンの制限条件自体は変更せず画面と共有した。修正後の関連9成功、DO重複なし5/5/5/5/5/5/2は初回成功。browser修正後初回31成功/1失敗で、実ジルの反撃化能力を加える候補にも札が表示される点を試験が考慮していなかった。候補にcounter効果の能力があることを確認し、未選択の通常/専用では防御ボタン無効・札保持・弓ダメージ4となる確認へ変更。失敗した反撃不可1件だけ再実行して1成功、unique32。型はUI追加後・本体修正/DO追加後・反撃候補の確認修正後の3回成功。能力を追加して反撃化する交差、他の人物への継承や複数source/hitを含む例外の交差、広いlifetime/回収交差は未測定で共有未完のまま。実Peaceのfreeze交差は今回専用modeの4経路。browserの士気/使用判定は実乱数を読み、死者は実本人が任意で選択した。 [証跡](../../operations/evidence/2026-09-10-r5-ki-burst-physical-bindings.json)。全体200/220、Appendix A24/25、Other176/195（残19）。

- [x] 死鬼旋風脚13条項＋main対応。Engine28・関連4・DO22・browser22・型・台帳成功。全体201/220、Appendix A24/25、Other177/195。共有未完とacceptedは維持。[証跡](../../operations/evidence/2026-09-10-r5-whirlwind-kick-physical-bindings.json)。

- [x] 死鬼界滅拳15条項＋main対応。Engine35・関連3・DO29・browser29・型・台帳成功。全体202/220、Appendix A24/25、Other178/195。共有未完とacceptedは維持。[証跡](../../operations/evidence/2026-09-10-r5-world-fist-physical-bindings.json)。

- [x] 死鬼滅殺拳18条項＋main対応。Engine49・関連4・DO43・browser43・型・台帳成功。全体203/220、Appendix A24/25、Other179/195。共有未完とacceptedは維持。[証跡](../../operations/evidence/2026-09-10-r5-slaying-fist-physical-bindings.json)。

- [x] 天地百撃斬23条項＋main対応。専用詠唱の共通適格判定を修正。Engine35＋既存S18/R6の2・DO31＋S18の1・browser31＋S18の2・型・台帳成功。全体204/220、Appendix A24/25、Other180/195。共有未完とacceptedは維持。[証跡](../../operations/evidence/2026-09-10-r5-hundred-slash-physical-bindings.json)。

- [x] 天地爆砕剣19条項＋main対応。Engine44＋関連6・DO40・browser40・型・台帳成功。全体205/220、Appendix A24/25、Other181/195。共有未完とacceptedは維持。[証跡](../../operations/evidence/2026-09-10-r5-blast-sword-physical-bindings.json)。

- [x] 光流弓21条項＋main対応。Engine53＋関連3・DO48・browser48・型・台帳成功。全体206/220、Appendix A24/25、Other182/195。共有未完とacceptedは維持。[証跡](../../operations/evidence/2026-09-10-r5-light-bow-physical-bindings.json)。

- [x] 星流弓24条項＋main対応。Engine48＋関連3・DO41・browser41・型・台帳成功。全体207/220、Appendix A24/25、Other183/195。共有未完とacceptedは維持。[証跡](../../operations/evidence/2026-09-10-r5-star-bow-physical-bindings.json)。

- [x] 狼牙の既存16条項＋mainへ追加検証（新規件数なし）。Engine33＋関連7・DO23・browser23・型・台帳成功。全体207/220、Appendix A24/25、Other183/195。共有未完とacceptedは維持。[証跡](../../operations/evidence/2026-09-10-r5-wolf-fang-physical-bindings.json)。

- [x] 悪夢23条項＋main対応。Engine45＋関連2・DO31・browser31・型・台帳成功。全体208/220、Appendix A24/25、Other184/195。共有未完とacceptedは維持。[証跡](../../operations/evidence/2026-09-10-r5-nightmare-physical-bindings.json)。

- [x] 植縛18条項＋main対応。Engine33＋関連3・DO26・browser26・型・台帳成功。全体209/220、Appendix A24/25、Other185/195。共有未完とacceptedは維持。[証跡](../../operations/evidence/2026-09-10-r5-plant-bind-physical-bindings.json)。

- [x] 光王陣25条項＋main対応。Engine30＋関連8・DO20・browser20・型・台帳成功。全体210/220、Appendix A24/25、Other186/195。共有未完とacceptedは維持。[証跡](../../operations/evidence/2026-09-10-r5-light-king-physical-bindings.json)。

- [x] 2026-09-10 13:44 JST 踏み込み残7枚（槍1・鎚矛1・剣5）77用途条項とmainを実試験へ対応。Engine28＋関連7・DO28・browser28・型成功。用途217/220、台帳pending8399/implemented3713。共有lifetime/回収・acceptedは未完。証跡: `docs/operations/evidence/2026-09-10-r5-advance-remaining-physical-bindings.json`。

- [x] 2026-09-10 13:48 JST ふぇありぃそぅど9用途条項＋main対応。追加4を含むEngine16・既存DO4/browser4・型成功。用途218/220、Appendix A25/25。strict A31の未証明producerと共有回収/acceptedは未完。証跡: `docs/operations/evidence/2026-09-10-r5-fairy-sword-physical-bindings.json`。

### Task11/R4-B shared adapter contract and acceptance

The following contract is identical to the R4-B plan. These declarations describe planned interfaces, not implemented APIs. Use the R4-owned recovery module; do not add a second rider-specific reservation store.

```ts
type ReclaimTrigger = 'technique-resolved' | 'follower-died' | 'named-card-used';
interface ReclaimSourceBase {
  eventId:string; sourceId:string; sourceActorId:string; cardInstanceId:string;
}
type ReclaimSource = ReclaimSourceBase & (
  | {kind:'ordinary-disposition';fromZone:'resolution';trigger:ReclaimTrigger;
      usedModeName?:string}
  | {kind:'courage-resolution';fromZone:'resolution';
      cardInstanceId:'a2-p01-r3c3';beneficiaryId:string;
      beneficiaryLifeId:string;cancellationSucceeded:true}
  | {kind:'actual-discard';fromZone:'discard';cardInstanceId:'a2-p04-r2c1';
      discardEventId:string;origin:{zone:'hand'|'attachments'|'deck'|'resolution'|
      'followers'|'chants'|'open'|'reclaimReservations'|'distanceMarkers';
      ownerId?:string}}
);
type ReclaimRight = 'base' | 'extra' | 'unlimited' | 'printed';
interface ReclaimClaim {
  id:string; declaringActorId:string; chooserId:string;
  beneficiaryId:string; beneficiaryLifeId:string; budgetOwnerId?:string;
  normalizedName:string;right:ReclaimRight;abilityId?:string;
  printedRider?:'courage'|'fairy-sword';checkActorId?:string;
}
interface ReclaimDecision {
  id:string; source:ReclaimSource; cardInstanceId:string;
  eventId:string;sourceId:string;sourceActorId:string;
  fromZone:'resolution'|'discard';
  stage:'responses'|'printed-check'|'beneficiary-choice'|'reserved'|'closed';
  participants:string[];cursor:number;windowId:string;windowRevision:number;
  // Claims remain private; never use their count to decide the public schedule.
  claims:ReclaimClaim[];attemptedClaimIds:string[];resolvedClaimIds:string[];
  selectedClaimId?:string;checkActorId?:string;checkRollId?:string;
  checkAttempted:boolean;beneficiaryId?:string;
  parentWindowId:string|null;
}
interface ReclaimBudget {baseSpent:boolean;extraSpentByAbility:string[]}
// PlayerState.reclaimUsage?: Record<string, ReclaimBudget>
// GameState.reclaimDecisions?: ReclaimDecision[]
// Reservation metadata: existing ownerId=beneficiaryId, ownerLifeId=
// beneficiaryLifeId; also claimId, decisionId, sourceId, discardEventId?.
function canonicalOwnedNames(player:PlayerState,
  kind:'technique'|'follower'):string[];
function offerReclaim(state:GameState,source:ReclaimSource):void;
function commitReclaim(state:GameState,decisionId:string,claimId:string):boolean;
function releaseReclaimReservations(state:GameState,eventId:string):void;
function reclaimView(state:GameState,actorId:string): {
  decisionId:string;cardInstanceId:string;stage:ReclaimDecision['stage'];
  pendingActorId:string;canDecline:boolean;
  claims:{claimId:string;right:ReclaimRight;label:string;
    action:'take'|'request-check'}[];
} | null;
// Finite command; claimId is an opaque private server-issued choice.
type ChooseReclaim = {type:'CHOOSE_RECLAIM';decisionId:string;
  choice:'take'|'request-check';claimId:string} |
  {type:'CHOOSE_RECLAIM';decisionId:string;choice:'decline'};
// Existing PASS explicitly declines the current recovery response slot.
// Existing REVEAL_CHARACTER preserves slot, decision and parent continuation.

```

**Public opportunity scheduling:** creation follows the public source event, never the number of private claims. Every public active seat receives the same ordered response opportunity even with zero claims, and advances only on explicit `CHOOSE_RECLAIM decline`/PASS (or public inactivity under G03). Private rights do not cause auto-skip, different receipt shapes or different public revisions. A09 opens on public successful Courage cancellation even with no currently revealed Lester; A31 opens on each actual sword discard even with no currently revealed Cham. `REVEAL_CHARACTER` retains the seat and original opportunity. Only actual chosen effects can add public check/declaration children. Allocate private claim IDs independently of public `nextEventId` so different private claim counts cannot shift later public event IDs.

**A09 adapter:** after Courage successfully cancels the selected ability, call `offerReclaim` with `kind:'courage-resolution'`, source `a2-p01-r3c3` still in `resolution`, original user as `beneficiaryId` with saved life ID, and `cancellationSucceeded:true`. A revealed Lester can `request-check` once, including reveal in this window. Store Lester separately as `checkActorId`; resolve his spirit check in stage `printed-check`, preserving the original beneficiary. Use `RollResume {kind:'reclaim-check';decisionId:string}` and `beginRoll` with `purpose:'activation'`, `formula:'2d6'`, `check:{modifier:0}`, `rollerId` equal to that revealed Lester; save `checkRollId/checkAttempted` before suspension. This printed rider has no character-ability-disabled gate. Success advances to `beneficiary-choice`, where only that original user can `take` or decline. Reservation owner/life is the beneficiary, never Lester by implication. Canceled Courage generates no A09 source. A09 does not consume ordinary owned-name entitlement merely because its checker owns Courage.

**A31 adapter:** complete the real physical movement into `discard` first, assign that occurrence a unique `discardEventId`, and call `offerReclaim` with `kind:'actual-discard'`, `fromZone:'discard'` and exact `origin.zone/ownerId`. Pause subsequent Dawn/shuffle/draw movement until all public response slots and any claim resolve. An eligible public Cham (including reveal now) takes directly from that exact discard occurrence into reservation. Do not route through resolution, infer ordinary ownership or fire the rider for direct resolution→reservation. An ordinary all-pass disposition that actually discards the sword can then open a distinct A31 opportunity. Same physical card discarded later receives a new occurrence ID; replay of one occurrence does not open a second window. Cham's own death disposal remains ineligible by its public inactivity.

- [x] Shared A09 acceptance in `packages/engine/test/r5-combinations-riders.test.ts` and R4 `packages/engine/test/reclaim-reservations.test.ts`: actual GOOD A uses Courage to cancel Dia; B is initially concealed Lester and reveals in his scheduled slot; B requests/checks once, save during roll, resume successful roll into A's choice. B cannot take to himself, A cannot submit another check, A take removes the one source from resolution and reserves for A; parent finish returns exactly once to A. A decline discards normally; B decline or check failure never opens A's printed take. Worker `apps/worker/test/room-r5-combinations-riders.test.ts` recreates storage at both stages and replays command IDs; spectator cannot see unused concealed Lester claims. Both plans must bind this same adapter scenario, not independent lookalike tests.
- [ ] Shared A31 acceptance in those same two Engine files: parameterize actual discard from A's hand, A's attachment and deck, then hidden B=Cham reveals in his scheduled slot and takes. Assert saved `origin` and unique `discardEventId`, `discard`→`reclaimReservations` only, no transient resolution membership, no ordinary-name budget, and parent finish→B hand once. Queue actual Dawn/shuffle after discard and prove it cannot consume the sword during this window. Save before B reveal and after reservation; replay cannot duplicate or reopen the same occurrence. Re-discard after a later legal event creates one new window. Worker persistence and `tests/e2e/r5-combinations-riders.spec.ts` cover reveal→claim before queued shuffle using the real R4 adapter.
- [x] Paired-world shared privacy tests: hold all public state, source, explicit PASS sequence and entropy equal while concealed current seat has no rights versus base/extra rights; public `reclaimView`, active window, revisions and receipts match until an actual choice reveals an effect. Repeat A09 no revealed Lester vs concealed Lester and A31 no revealed Cham vs concealed Cham; neither missing public claimant removes the reveal opportunity. Include current zero-claim actor PASS and confirm no eligibility-based auto-advance.

2026-09-09 shared acceptance: both named Engine files, Worker `room-r5-combinations-riders.test.ts` and browser `r5-combinations-riders.spec.ts` use `shared-reclaim-scenarios.ts`. Actual A Courage/B hidden Lester/C Dia covers take, beneficiary decline, checker decline and failure with separate saved check/beneficiary/reservation states. Hidden/no Lester, hidden/no Cham and zero/base/extra/both private budgets preserve complete non-owner game snapshots, response windows, event IDs and PASS receipts under equal entropy. Focused43, DO7, browser5, typecheck and ledger12,112 valid pass. Evidence: `docs/operations/evidence/2026-09-09-r5-shared-reclaim.json`. A31 full origin matrix remains unchecked; this hand-discard case does not supply an unproven deck or direct live attachment producer.

## Task 12 — Exact scenario closure and combined invariants (`scenario-closure`)

2026-09-09 S18 acceptance: a single shared actual producer now joins the previously separate multi-hit and mental-defense evidence. Focused57, DO1, browser2, typecheck and ledger12,112 valid pass. Evidence: `docs/operations/evidence/2026-09-09-r5-s18.json`. Other scenario rows and combined invariant checks remain pending.

**Files:** Modify the exact existing Engine test files named in Appendix B; create `packages/engine/test/r6-scenarios.test.ts`, `apps/worker/test/room-r6-scenarios.test.ts`, `apps/worker/test/fixtures/r6-scenarios.ts`, `tests/e2e/r6-scenarios.spec.ts`; update `data/second-edition/runtime-coverage.json` only with exact reviewed evidence. Read `data/second-edition/scenarios.json`, do not change originals to fit tests.

- [ ] Turn every Appendix B row into named test/parameter binding.
- [x] For S01–S05 preserve actor order, exact rolls and stale generation receipt tests.
- [x] S06–S10 require their actual modifier/prayer/transfer/counter producers and exact Lv values; keep abstract solver evidence separately if print cannot produce a scenario's given arithmetic.
- [x] S11 asserts unchanged pair distance and final outcome; S12 uses actual three-hit result with one maai and exactly two hits remaining; S13 adds abstract Lv5/damage6×3/frontLv3 HP2→[4,4,4]/12 and once-only physical destruction alongside existing printed 天地 test. S14 retains legal third-party intervention after follower entry. Retain exact S15/S16 candidates and finish S17 legal alternate defense after lineage rejection, without fabricating returned hand cards as reclaim evidence.
- [x] S18 single actual trajectory: real 天地百撃斬, locked hit-count die3, two targets, B actual Lester elects 魔詩, one attacker resistance, cancel all three B hits only, preserve all three C hits. Persist before resistance and between target resolution; assert no stop on ordinary failure. Separate 地裂1-hit and multi-hit tests do not close this row.
- [x] S19 bind existing actual Gil low-spirit sixes/faith protection body. S20 use physical action 魔詩 a2-p17-r1c1, initial −3 failure, resulting next turn −2 failure then −1 success, required draw/refill and action progression from that same saved status. Character ability 魔詩 is not evidence.
- [ ] S21 concealed actual Shelim receives threshold hit and chooses non-use; damage occurs, no foreign view contains Shelim identity or unused ability candidate. Existing Shelim use/Fury decline are insufficient. Pending clarification of the conflict with G15 mandatory post-hit identity publication.
- [x] S22 two OPEN in same actual anytime refill, child suspension and original parent generation resume.
- [x] S23 natural exhaustion: draw1+discard2+resolution1 needing3 excludes resolution from shuffle, with deterministic result.
- [x] S24 uses physical X normal recovery, then same-name Y refused, plus separately eligible extra use from R4.
- [x] S25 real Cham gift plus physical death gift reject same X, settle before outcome.
- [x] S26 actual protected death→wandering→revival and replacement initial hand/followers, not seeded dead/wandering state.
- [x] S27 actual final two players die in simultaneous 滅界 and final all-dead draw.
- [x] Retain S28 transformation exact pairs and S29 all three Dia virtual dwarf hits with explicit 220 unique physical IDs/no normal virtual recovery.
- [x] S30 actual 裂界 then both real 祈願 copies and 啓示 reject otherworld B without private leak; actual Dawn returns B.
- [x] S31 exact dedicated noChecks still requires chant with no other waiver.
- [x] S32 exact abstract `(5+1)*2*0.5=6`, final floor/null case; do not invent physical combo.
- [x] Add legally generated combinations: suppression×frozen value×revival, recovery×cancellation×refill, two-target three-hit×counter×follower×simultaneous death. At every accepted transition assert 220 unique physical cards, no dual membership, reservations excluded from draw, rejected input unchanged, saved/restarted continuation equivalent and outcomes only at stable boundary. A legal pending choice is not a deadlock.

Concrete table-test shape (inside each existing fixture harness; do not create public arbitrary-effect commands):

```ts
it.each(['a2-p04-r3c2', 'a2-p04-r3c3'])(
  'S30 actual wish %s rejects otherworld possessions atomically',
  (wishId) => {
    // Use fixture harness to issue real 裂界, pass legal windows, then select wishId.
    // Snapshot before the actual CHOOSE_WISH request targeting away B.
    const before = structuredClone(state);
    const result = transition(state, { actorId: 'A', command: {
      type: 'CHOOSE_WISH', decisionId: wishDecision.id,
      source: { kind: 'hand', ownerId: 'B' }
    } });
    expect(result).toEqual({ ok: false, code: 'INVALID_TARGET' });
    expect(state).toEqual(before);
  }
);
```

The producer setup must be implemented using existing `combat-helpers.ts`/fixture commands; `state` and `wishDecision` above are the resulting legal state and its actual saved decision, never hand-injected otherworld evidence. For each row record source hash, exact test declaration plus parameter tuple, evidence kind and run/review evidence. Run the focused Engine/Worker/browser commands for these three actual new files, then the required completion-plan gates. This documentation task ran none.

## Explicit online-ruling register

R5-P1 (Task5) is a proposed aura lifecycle supplement, not an original printed requirement. No other unresolved rule is asserted simply because an inventory calls a producer missing. For implementation discoveries, identify source clause and already-adopted ruling first; if neither fixes a genuinely new boundary, add a labeled proposed online ruling with one concrete behavior and counterexample before the dependent code. Continue independent groups. In particular do not reinterpret C09 shadow jump, C11 gifts/substitution, C12 reward arithmetic, A31 sword duration or A35/A36 wish as open questions.

## Appendix A — Complete missing-card clauses and adopted per-card rulings

The following transcribed inventory clauses cover exactly 25 physical IDs (13 turn, 9 anytime, 3 technique), 24 distinct names. They are normative inputs to Tasks7–11, not accepted implementation evidence. The following existing adopted decisions are included so timing, alternate use and edge clauses cannot disappear into a generic “implement card” step.

### おまえは、俺の敵でないっ！！

IDs: `a2-p05-r1c3`.

Source clauses:

1. 自分の精神力に+2のボーナスを与える。
2. 効果は一連の攻撃の間持続する。

### 月の竪琴

IDs: `a2-p05-r2c1`.

Source clauses:

1. 組み合わせた精神技の効果Lvに2を加える。
2. 同じ精神技のダメージに4を加える。

### 全軍突撃せよ

IDs: `a2-p05-r2c2`.

Source clauses:

1. 手札の従者カードのうち、下部に技としての効果Lvとダメージが書かれているカードが対象。
2. その従者カードを1枚だけ、記載の効果Lvを持つ攻撃技として使用できる。
3. 士気チェックが必要な従者の場合、そのチェックを行う。
4. 既に配置した従者ではなく手札の従者を使う。

### 秘伝書

IDs: `a2-p03-r1c1`.

Source clauses:

1. 自分の手番の最初に行う手札補充の後で使う。
2. 通常の手番行動とは別に使用できる。
3. 1d6を振り、その出目の枚数だけ追加で手札を引くことができる。

### ソロモン王の冠

IDs: `a2-p03-r1c2`.

Source clauses:

1. 自分の魔法Lvを、地・水・炎・風魔法に対してのみ1上昇させる。
2. 使用者がGOODである場合に限り、「人」の従者の士気チェックに+1を適用する。
3. 使用後はこのカードを自分のキャラクターカードの上に置く。

### 赤い水晶球

IDs: `a2-p03-r1c3`.

Source clauses:

1. 自分の魔法Lvを、黒魔法および精神魔法に対してのみ2上昇させる。
2. 使用者がEVILである場合に限り、「人」の従者の士気チェックに+2を適用する。
3. 使用後はこのカードを自分のキャラクターカードの上に置く。

### 修行（戦士技）

IDs: `a2-p03-r2c2`.

Source clauses:

1. 2d6を振り、その合計が自分の戦士Lvを厳密に上回れば成功する。等しい場合は成功ではない。
2. 成功した場合、自分の戦士Lvを1上昇する。
3. ランスロットが使う場合は判定不要で成功する。
4. 使用後はこのカードを自分のキャラクターカードの上に置く。

### 修行（魔法技）

IDs: `a2-p03-r2c3`.

Source clauses:

1. 2d6を振り、その合計が自分の魔法Lvを厳密に上回れば成功する。等しい場合は成功ではない。
2. 成功した場合、自分の魔法Lvを1上昇する。
3. ランスロットが使う場合は判定不要で成功する。
4. 使用後はこのカードを自分のキャラクターカードの上に置く。

### おまえはだまされている

IDs: `a2-p04-r1c1`.

Source clauses:

1. 対象はキャラクターカードが表向きで、使用者自身ではない者に限る。
2. 対象は精神力-1でチェックする。使用者がリーア姫の場合は-1の代わりに-2とする。
3. 判定失敗時、対象の陣営をGOODへ変更する。
4. 同じ失敗時、対象の目的を「EVILの全滅」、敗北条件を「リーア姫の死亡」へ変更する。
5. 判定成功時にはこれらの変更を行わない。

### 魅了

IDs: `a2-p04-r1c2`.

Source clauses:

1. 対象はキャラクターカードが表向きで、使用者自身ではない者に限る。
2. 対象は精神力-1でチェックする。使用者がウーノスの場合は-1の代わりに-2とする。
3. 判定失敗時、対象の陣営をEVILへ変更する。
4. 同じ失敗時、対象の目的を「GOODの全滅」、敗北条件を「ガイナスの死亡」へ変更する。
5. 判定成功時にはこれらの変更を行わない。

### ディノンの書

IDs: `a2-p04-r1c3`.

Source clauses:

1. 任意のプレイヤー1人を選び、使用者とそのプレイヤーの手札をすべて交換する。

### ふぇありぃそぅど

IDs: `a2-p04-r2c1`.

Source clauses:

1. 通常使用はチャムに限る。
2. 使用後、チャムは自分の「戦士技のダメージを半減する」制限を以後無視できるようになる。
3. 使用後はこのカードを自分のキャラクターカードの上に置く。
4. このカードが捨て札にされたとき、表向きのチャムはこのカードを自分の手札に加えることを選べる。

### 遠見の水晶球

IDs: `a2-p04-r2c2`.

Source clauses:

1. 指定したプレイヤー1人の正体を調べるため、使用者が精神力チェックを行う。
2. 成功時、対象の正体を使用者だけが見ることができる。
3. アルセイルが使用する場合、「占星」の特殊能力に自動的に成功したことにすることができる。

### 祈願

IDs: `a2-p04-r3c2`, `a2-p04-r3c3`.

Source clauses:

1. カード1枚をどこからでも取得し、自分のものにすることができる。
2. 取得可能な例としてOPENカード、キャラクターカード上の魔導書など、詠唱中のカード、相手の手札が明記されている。
3. 捨て札からは取得できない。
4. 相手がすでにつけている従者は取得できない。
5. 相手の手札から取得する場合は完全にランダムに選ぶ。

### 母様の真実

IDs: `a2-p05-r1c2`.

Source clauses:

1. 対象は表向きのアスフェルトに限る。
2. アスフェルト本人は使用できない。
3. 判定の要求はなく、アスフェルトをGOODに変更する。
4. アスフェルトの目的を「EVILの全滅」、敗北条件を「リーア姫の死亡」に変更する。
5. 以後、アスフェルトがGOODである限り、対象のキャラクターカードの上にこのカードを置く。

### アレキサンドリア城の悲劇

IDs: `a2-p01-r2c3`.

Source clauses:

1. 攻撃者がガイナスまたはディアで、かつそのキャラクターカードが表向きであることを要する。
2. 条件を満たす攻撃そのものを失敗させる。

### 聖騎士団長ケイルベイツ

IDs: `a2-p01-r3c1`.

Source clauses:

1. 対象は表向きのランスロットまたはリーア姫に限る。
2. 対象への攻撃をこのカードが身代わって無効にする。
3. 対象がランスロットなら、そのランスロットの精神力を1増加する。リーア姫への精神力増加は書かれていない。

### ソロモン王の護符

IDs: `a2-p01-r3c2`.

Source clauses:

1. 無効化対象は列挙された3人の該当特殊能力に限る。
2. レスターの魔詩、ディアの魅了、ガドューラの恐怖を無効にする。
3. 同名の手番カード「魅了」は特殊能力ではなく、本文の対象列挙には含まれない。

### 勇気

IDs: `a2-p01-r3c3`.

Source clauses:

1. 使用者はGOODでなければならない。
2. ディアの魅了またはガドューラの恐怖という特殊能力を無効にする。
3. 表向きのレスターが精神力チェックに成功すれば、使用者はこのカードを自分の手札に戻すことを選べる。
4. 判定者はレスター、回収先は使用者であり、本文は両者が同一人物であることを要求していない。

### この世界に愛と平和を

IDs: `a2-p02-r1c1`.

Source clauses:

1. 使用者はGOODに限る。
2. 自分以外の人物を対象にする。
3. 対象の精神力を一時的に12とする。+12ではない。
4. 対象の行動が終わるまで持続する。

### 啓示

IDs: `a2-p02-r1c2`.

Source clauses:

1. 任意のプレイヤー1人を選ぶ。
2. そのプレイヤーの手札・従者・詠唱している技をすべて見ることができる。

### 身代わり

IDs: `a2-p02-r2c1`.

Source clauses:

1. 別の人への攻撃を使用者が代わりに受けることができる。
2. 身代わりとなった者は、その攻撃を従者に受けさせることができない。
3. その攻撃への対応は反撃または自身の特殊能力に限定される。防御カード等を通常の対応として追加使用する許可はない。

### 人質

IDs: `a2-p02-r2c2`.

Source clauses:

1. 使用者はEVILに限る。
2. GOODの者による攻撃そのものを1度だけ失敗させる。
3. 表向きのチャムはこのカードの使用を中止させることを選べる。その場合、このカードを捨て札にする。

### 呪払

IDs: `a2-p02-r3c1`.

Source clauses:

1. 攻撃する敵の従者の中にゴーレムの従者がいる場合、それらをすべて破壊する。
2. ゴーレム以外の従者はこの本文による破壊対象ではない。

### Adopted A06 — a2-p01-r2c3：アレキサンドリア城の悲劇

出典：[CardAll.pdf p.1](../../../resources/original/second-edition/CardAll.pdf#page=1)、2行3列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：「攻撃そのもの」が複数の技・標的・連続攻撃のどこまでを含むか。**

【オンライン補完・暫定採用】「攻撃そのもの」は選んだ一回の攻撃宣言から生じる全対象・全ヒットを指す。未解決の残り全てを失敗にするが、既に確定した別対象の損害・死亡は巻き戻さない。別の攻撃宣言、すでに生成された反撃は別イベントとする。

**Q2：攻撃宣言後のどの時点まで割り込めるか。**

【オンライン補完・暫定採用】攻撃宣言後から、その攻撃に未解決の対象・ヒットが残る間の受付窓で使える。最後のヒット確定後の遡及使用は禁止。使用時と解決時に攻撃者の名前・表向き条件を検証する。従者受け後の防御者本人の通常防御としては使用できないが第三者は介入できる。

<a id="A07"></a>

### Adopted A07 — a2-p01-r3c1：聖騎士団長ケイルベイツ

出典：[CardAll.pdf p.1](../../../resources/original/second-edition/CardAll.pdf#page=1)、3行1列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：精神力+1の持続期間・カードの保持場所が書かれていない。**

【オンライン補完・暫定採用】ランスロット本人への独立した永続精神力+1として記録し、カードは通常の使用済み札として捨てる。持続期限がないため手番末には戻さず、復活やランスロット2への変身でも補正を維持する。別の適法な使用は加算できる。同一物理札の同一対象イベントへの反復使用はできない。

**Q2：無効化する「攻撃」の単位はどこまでか。**

【オンライン補完・暫定採用】選んだランスロットまたはリーア姫に向いた、その攻撃宣言の未解決ヒット全てを無効にする。他の対象は守らない。身代わるのはカード上のケイルベイツであり、使用者がダメージを受ける「身代わり」カードの処理は適用しない。

<a id="A08"></a>

### Adopted A08 — a2-p01-r3c2：ソロモン王の護符

出典：[CardAll.pdf p.1](../../../resources/original/second-edition/CardAll.pdf#page=1)、3行2列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：1回の使用を無効にするのか、能力を継続的に無効にするのか。**

【オンライン補完・暫定採用】選んだ未解決の特殊能力使用1回のみを無効にする。同一宣言の能力が要求した判定とその失敗・ゾロ目効果も一括で取り消すが、過去に確定した停止・陣営変更は解除しない。将来の能力使用を封印し続ける効果は持たせない。

**Q2：使用後のカードの置き場所は本文にない。**

【オンライン補完・暫定採用】使用宣言時に手札から解決領域へ置き、いつでもカードの即時補充とそこで引いたOPEN子処理を先に処理してから、この使用への介入窓を開く。解決後は捨て札へ送り、持ち技・再使用権が適法に使える場合だけ共通の回収窓を適用する。

<a id="A09"></a>

### Adopted A09 — a2-p01-r3c3：勇気

出典：[CardAll.pdf p.1](../../../resources/original/second-edition/CardAll.pdf#page=1)、3行3列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：レスターの判定を行うタイミング・回数と、本人の同意の要否は本文にない。**

【原文確認】判定者は表向きのレスター、回収者はカード使用者と区別されており、両者が同一という条件はない。基本ルールp.6は任意能力・限定効果を使わない選択を認める。【オンライン補完・暫定採用】勇気の無効化成功後、レスター本人に一度だけ判定する／しないを選ばせる。成功後に使用者が回収を選び、札を回収予約領域に置いて親イベント終了時に手札へ戻す。レスターは判定窓で自発公開してもよい。カード使用を命運凶変等で止められた場合はこの回収条件を満たさない。

**Q2：無効化の持続期間は本文にない。**

【オンライン補完・暫定採用】選んだディアの魅了またはガドューラの恐怖の未解決使用1回だけを無効にする。判定・ゾロ目による停止等はその能力処理ごと取り消す。過去の確定効果の解除や将来の能力封印には使えない。

<a id="A10"></a>

### Adopted A10 — a2-p02-r1c1：この世界に愛と平和を

出典：[CardAll.pdf p.2](../../../resources/original/second-edition/CardAll.pdf#page=2)、1行1列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：対象の行動中以外で使用した場合の終了時点はいつか。**

【オンライン補完・暫定採用】対象が現在実行中の行動があれば、その行動とそこから生じる反撃・防御・割込の連鎖が終わるまで持続する。対象が現在行動していなければ、次に開始するその対象自身の手番行動の終了までとする。行動を選ばず手番終了した場合もそこで終了する。終了期限は使用時に公開表示する。

**Q2：精神力への他の加算・置換と併用した場合の計算順は本文にない。**

【オンライン補完・暫定採用】共通裁定の能力値合成に合わせ、精神力の基礎値を12へ置換してから、現在有効な加減算・倍率を適用する。その値へ「精神力-1チェック」等の判定専用修正を加える。最終値を12に丸める上限は設けない。効果終了後は元の基礎値と現在残る補正から再計算する。同種の12置換は重複せず、+12にはしない。

<a id="A11"></a>

### Adopted A11 — a2-p02-r1c2：啓示

出典：[CardAll.pdf p.2](../../../resources/original/second-edition/CardAll.pdf#page=2)、1行2列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：使用者だけが確認するのか全員に公開するのかは明記されていない。**

【オンライン補完・暫定採用】見る権限は使用者だけに付与する。対象者自身は元々知っている情報を引き続き見られるが、他人の画面や公開ログに内容を流さない。対象は1人、閲覧集合はその時点の手札・従者・詠唱札全て。異界中の者は基本ルールp.6§11.8により対象外。

**Q2：閲覧後の公開状態の維持や配置順変更の可否は本文にない。**

【オンライン補完・暫定採用】閲覧終了後に新たな公開状態を残さず、各カードの表裏・配置順・ゾーンをそのまま維持する。手札順や従者順の変更権は与えない。使用者向けの確認履歴だけは保持し、以後取得された新札は見せない。

<a id="A12"></a>

### Adopted A13 — a2-p02-r2c1：身代わり

出典：[CardAll.pdf p.2](../../../resources/original/second-edition/CardAll.pdf#page=2)、2行1列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：第三者がその後に攻撃失敗カードを使うことも制限されるか。**

【オンライン補完・暫定採用】身代わった者自身のその攻撃への対応だけを制限する。第三者のアレキサンドリア城の悲劇・人質等の適法な介入は残す。新しい防御者は手札の反撃技と自身の特殊能力だけを使用でき、見切る・転移・間合いなど他の通常防御札、従者受けは不可とする。

**Q2：身代わりをさらに身代わりする連鎖が可能か。**

【オンライン補完・暫定採用】同じ対象ヒットを再転送する身代わりの連鎖は認めない。最初の適法な身代わり1回で受け手を固定する。複数ヒットに対しては別のヒットへ別の物理札で身代わることはできる。身代わり宣言を中止された場合も、その札の同一イベント使用済み記録と支払済コストは戻さない。

**Q3：対象変更後の距離・技の対象条件の再確認要否は本文にない。**

【オンライン補完・暫定採用】元の攻撃の距離・使用条件が適法に確定したことを前提に、残存する対象ヒット1つの受け手だけを変更する。攻撃者と身代わり者の距離が遠くても近距離技を受け、対象者固有の性別等の攻撃対象制限を再チェックして回避にはしない。身代わり者自身の無効化・耐性・自身の特殊能力は変更後の受け手について評価する。すでに元の標的の従者へ与えた損害・軽減は維持する。

**処理を閉じるための補足**

【オンライン補完・暫定採用】身代わり宣言時に受け手本人の同意は不要で、使用者が引受けを選ぶ。元の対象ヒットがすでに確定・消滅していれば宣言不可。自分へのヒットは「別の人」を満たさない。身代わった後の反撃は共通裁定に従い、元の攻撃者を対象とする1ヒットへ置換する。

<a id="A14"></a>

### Adopted A14 — a2-p02-r2c2：人質

出典：[CardAll.pdf p.2](../../../resources/original/second-edition/CardAll.pdf#page=2)、2行2列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：攻撃者の陣営は宣言時・解決時のどちらで確認するか。**

【オンライン補完・暫定採用】人質の使用者がEVIL、対象攻撃の攻撃者がGOODであることを宣言時と解決時の両方で検証する。未解決中の陣営変更で条件を失えば効果不発とし、カード・補充・行動等の支払済コストは戻さない。攻撃者が裏向きの場合はサーバーだけが現在陣営を検証し、使用可否以外の正体は公開しない。

**Q2：チャムが割込時に正体公開して条件を満たしてよいか。**

【原文確認】基本ルールp.6§11.4はいつでも自主的正体公開を認める。【オンライン補完・暫定採用】人質の未解決使用への受付窓でチャムが公開し、その後に中止を宣言してよい。中止解決時にも表向きで、通常の反応を行える状態であることを要する。キャラクター固有の特殊能力無効だけではこのカード固有反応を禁止しない。

**Q3：チャムの中止宣言に命運凶変等でさらに割り込めるか。**

【オンライン補完・暫定採用】チャムの中止は人質カードが与えるキャラクター限定のカード固有反応として扱い、人物の特殊能力とは区別する。命運凶変の特殊能力使用禁止モードでは止められず、別の手札を使用する宣言でもないため手札モードの対象にもならない。ヴァンミール等による特殊能力無効だけでも禁止しない。チャムが同じ人質宣言へ中止を何度も再宣言することはできない。

**処理を閉じるための補足**

【オンライン補完・暫定採用】人質が成功すれば、選んだ攻撃宣言の未解決の全対象・全ヒットを失敗にする。過去の確定損害は戻さない。チャムの中止が成功すれば人質だけを捨てて元の攻撃を再開し、人質使用に伴う即時補充は取り消さない。

<a id="A15"></a>

### Adopted A16 — a2-p02-r3c1：呪払

出典：[CardAll.pdf p.2](../../../resources/original/second-edition/CardAll.pdf#page=2)、3行1列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：「攻撃する敵」は自分が攻撃しようとする敵か、自分に攻撃する敵か。**

【オンライン補完・暫定採用】使用者がこれから攻撃する敵を指すと解釈する。使用者の攻撃対象集合を固定した直後、攻撃技の使用宣言前に1対象を指定して、その対象が配置しているゴーレムを全て破壊する。敵の攻撃を受ける側の防御としては使えない。

**Q2：攻撃の前に使用するカードが通常の手番行動を消費するかは本文にない。**

【オンライン補完・暫定採用】攻撃行動に付随する「攻撃の前」の追加使用とし、独立の手番行動は消費しない。本文の印刷カテゴリは「いつでも」ではないため、いつでもカードに対する即時補充は与えない。攻撃を結局行わない任意使用は認めず、この使用後は宣言した攻撃行動の残りを実行する。

**Q3：裏向きの従者の種別をどう確認するか。**

【オンライン補完・暫定採用】サーバーが対象の配置済み従者の実体を検査し、ゴーレムだけを公開して破壊する。他の伏せ従者は種別や名前を公開しない。ゴーレムが0枚なら不発だが受理済みのカードは返さない。

<a id="A17"></a>

### Adopted A19 — a2-p03-r1c1：秘伝書

出典：[CardAll.pdf p.3](../../../resources/original/second-edition/CardAll.pdf#page=3)、1行1列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：手札上限超過の処理時点および引いたOPENを処理する順序は基本ルールとの照合が必要。**

【原文確認】手番冒頭の補充後に通常行動とは別で1d6枚引くことがカード明記。手番末の手札調整は基本ルールp.4に明記。【オンライン補完・暫定採用】通常ドローまたは停止回復後の手札補充を終えた手番冒頭窓で一度使い、1d6で決めた枚数を順に引く。OPENを引くたびに公開・効果・代替ドローを処理してから残り枚数を再開し、途中で上限に達しても追加枚数は減らさない。上限超過の破棄は手番末だけ。

<a id="A20"></a>

### Adopted A20 — a2-p03-r1c2：ソロモン王の冠

出典：[CardAll.pdf p.3](../../../resources/original/second-edition/CardAll.pdf#page=3)、1行2列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：使用後に陣営が変わった場合、士気ボーナスを現在の陣営で再判定するか。**

【オンライン補完・暫定採用】現在陣営を常に参照し、GOODである間だけ人従者への士気+1を有効にする。陣営変更で即時に有効／無効を切り替えるがカードは設置されたままとする。

**Q2：修行（魔法技）の閾値に属性限定Lv上昇を算入するか。**

【オンライン補完・暫定採用】修行（魔法技）は属性を持たない魔法Lvそのものを比較するので、地・水・炎・風限定の+1を閾値へ算入しない。魔導書や神々の血など無属性の魔法Lv補正は算入する。

<a id="A21"></a>

### Adopted A21 — a2-p03-r1c3：赤い水晶球

出典：[CardAll.pdf p.3](../../../resources/original/second-edition/CardAll.pdf#page=3)、1行3列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：使用後に陣営が変わった場合、士気ボーナスを現在の陣営で再判定するか。**

【オンライン補完・暫定採用】現在陣営を常に参照し、EVILである間だけ人従者への士気+2を有効にする。陣営変更で即時に有効／無効を切り替えるがカードは設置されたままとする。

**Q2：修行（魔法技）の閾値に属性限定Lv上昇を算入するか。**

【オンライン補完・暫定採用】修行（魔法技）は属性を持たない魔法Lvそのものを比較するので、黒・精神限定の+2を閾値へ算入しない。魔導書や神々の血など無属性の魔法Lv補正は算入する。

<a id="A22"></a>

### Adopted A23 — a2-p03-r2c2：修行（戦士技）

出典：[CardAll.pdf p.3](../../../resources/original/second-edition/CardAll.pdf#page=3)、2行2列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：失敗してもカードをキャラクターカード上に置くのか。本文は配置を成功時に限定していない。**

【オンライン補完・暫定採用】成功時だけ有効な設置カードとして置き、失敗時は捨て札にする。原文の配置指示は成功限定と明記されていないため、この処理はオンライン上の追加裁定である。成功フラグのない無効な修行札を設置領域に残さない。

**Q2：比較する戦士Lvに他カードによる補正を含むか。**

【オンライン補完・暫定採用】判定直前の自分の戦士Lvに適用される無条件の設置補正・永続補正を含めて比較する。属性限定の魔法Lv補正は除外する。今回成功すると得る+1はまだ加えない。2d6合計が閾値を厳密に上回る場合のみ成功。

**Q3：ランスロットの判定不要成功を命運凶変の「判定を失敗」で止められるか。**

【原文確認】ランスロットには「チェック不要で成功」とある。【オンライン補完・暫定採用】生成されていない判定を命運凶変の判定モードで狙うことはできない。修行カードそのものの手札使用を失敗させることはできる。判定不要を使わない任意選択をした場合は実際に生成した判定へ介入できる。

<a id="A24"></a>

### Adopted A24 — a2-p03-r2c3：修行（魔法技）

出典：[CardAll.pdf p.3](../../../resources/original/second-edition/CardAll.pdf#page=3)、2行3列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：失敗してもカードをキャラクターカード上に置くのか。本文は配置を成功時に限定していない。**

【オンライン補完・暫定採用】成功時だけ有効な設置カードとして置き、失敗時は捨て札にする。原文の配置指示は成功限定と明記されていないため、この処理はオンライン上の追加裁定である。成功フラグのない無効な修行札を設置領域に残さない。

**Q2：比較する魔法Lvに他カードによる補正を含むか。**

【オンライン補完・暫定採用】判定直前の自分の魔法Lvに適用される無条件の設置補正・永続補正を含めて比較する。属性限定の魔法Lv補正は除外する。今回成功すると得る+1はまだ加えない。2d6合計が閾値を厳密に上回る場合のみ成功。

**Q3：ランスロットの判定不要成功を命運凶変の「判定を失敗」で止められるか。**

【原文確認】ランスロットには「チェック不要で成功」とある。【オンライン補完・暫定採用】生成されていない判定を命運凶変の判定モードで狙うことはできない。修行カードそのものの手札使用を失敗させることはできる。判定不要を使わない任意選択をした場合は実際に生成した判定へ介入できる。

<a id="A25"></a>

### Adopted A28 — a2-p04-r1c1：おまえはだまされている

出典：[CardAll.pdf p.4](../../../resources/original/second-edition/CardAll.pdf#page=4)、1行1列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：対象が既に同じ陣営でも使用可能か。本文には異陣営限定の記載はない。**

【原文確認】表向きの自身以外という制限だけで、異陣営限定ではない。【オンライン補完・暫定採用】既にGOODの者にも使用でき、チェック失敗なら目的・敗北条件を本文通り置換する。ただしキャラクターの「常にGOOD」等の陣営制限が変更先を禁じる場合は陣営変更効果全体を適用せず、目的だけの変更も行わない。

**Q2：対象の元々の個別目的・敗北条件は全部置換するのか。**

【オンライン補完・暫定採用】失敗時は元のカード固有の目的と敗北条件を全て本文の指定へ置換し、元の保護対象を追加で残さない。判定成功時は何も変更しない。陣営変更チェックへのキャラクター補正は通常通り適用する。

**Q3：指定された敗北条件がすでに満たされている場合の即時処理はどうなるか。**

【オンライン補完・暫定採用】新しい敗北条件のリーア姫が既に死亡していれば、変更解決直後の状態確認で流浪を成立させる。手札・従者の返却等を終えてから勝敗を評価する。敗北条件を無視して活動を続ける猶予は与えない。

<a id="A29"></a>

### Adopted A29 — a2-p04-r1c2：魅了

出典：[CardAll.pdf p.4](../../../resources/original/second-edition/CardAll.pdf#page=4)、1行2列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：対象が既に同じ陣営でも使用可能か。本文には異陣営限定の記載はない。**

【原文確認】表向きの自身以外という制限だけで、異陣営限定ではない。【オンライン補完・暫定採用】既にEVILの者にも使用でき、チェック失敗なら目的・敗北条件を本文通り置換する。ただしキャラクターの「常にGOOD」等の陣営制限が変更先を禁じる場合は陣営変更効果全体を適用せず、目的だけの変更も行わない。

**Q2：対象の元々の個別目的・敗北条件は全部置換するのか。**

【オンライン補完・暫定採用】失敗時は元のカード固有の目的と敗北条件を全て本文の指定へ置換し、元の保護対象を追加で残さない。判定成功時は何も変更しない。陣営変更チェックへのキャラクター補正は通常通り適用する。

**Q3：指定された敗北条件がすでに満たされている場合の即時処理はどうなるか。**

【オンライン補完・暫定採用】新しい敗北条件のガイナスが既に死亡していれば、変更解決直後の状態確認で流浪を成立させる。手札・従者の返却等を終えてから勝敗を評価する。敗北条件を無視して活動を続ける猶予は与えない。

<a id="A30"></a>

### Adopted A30 — a2-p04-r1c3：ディノンの書

出典：[CardAll.pdf p.4](../../../resources/original/second-edition/CardAll.pdf#page=4)、1行3列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：このカード自身を交換する手札に含めるか。**

【オンライン補完・暫定採用】使用時にこのカードを解決領域へ移すため交換対象には含まれない。解決時点で両者の残り手札集合を固定して同時交換する。詠唱・設置・従者は交換しない。異界・死亡・流浪・離脱中の相手は選べない。

**Q2：枚数差で手札上限を超えた場合の処理時点はいつか。**

【オンライン補完・暫定採用】交換による手札上限超過は保持でき、それぞれの次の手番末の手札調整時に処理する。不足分もこの交換だけでは補充しない。

<a id="A31"></a>

### Adopted A31 — a2-p04-r2c1：ふぇありぃそぅど

出典：[CardAll.pdf p.4](../../../resources/original/second-edition/CardAll.pdf#page=4)、2行1列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：カード名の小書き文字は印刷通り「ふぇありぃそぅど」。別資料の表記との同一性確認が必要。**

【原文確認】拡大したカード画像の名称は「ふぇありぃそぅど」として転記した。【オンライン補完・暫定採用】物理カードIDを正規キーとし、検索用表記「ふえありぃそうど」「ふぇありぃそーど」は同じIDの別名にだけ割り当てる。名前の揺れで別カード・追加コピーを生成しない。

**Q2：他人が捨て札にした場合やデッキから直接捨てられた場合もチャムが回収できるか。本文には場所・所有者の限定がない。**

【原文確認】捨て札になった際の元の場所や所有者に限定がない。【オンライン補完・暫定採用】他人の手札・設置・山札から捨てられた場合も、参加中で通常の反応を行えるチャムが条件を満たせば回収できる。これはカード固有効果なので人物の特殊能力無効だけでは禁止しない。チャム自身の死亡処分ではすでに死亡者なので回収できない。捨て札へ移った直後の窓1回だけ受け付け、山札へ戻す処理など確定済みの移動は巻き戻さない。

**Q3：設置カードが取り除かれた場合も「以後」制限無視が継続するか。**

【オンライン補完・暫定採用】キャラクター上に置く指示を効果の維持場所と解釈し、そのチャムの設置領域にある間だけ半減制限を無視できる。祈願で奪われたり捨てられて回収しただけでは半減制限が復活し、手番を使って再設置すると再び無視できる。「以後」をカード離脱後も残る永久効果にはしない。

**Q4：回収のためにこの瞬間にキャラクターカードを表向きにしてよいか。**

【原文確認】基本ルールp.6§11.4により自主公開はいつでも可能。【オンライン補完・暫定採用】この捨て札化への回収予約窓で、公開→回収宣言を順に行える。成立した回収は予約領域に置き、親イベント終了時に手札へ戻す。窓終了後に公開して過去の捨て札化を狙うことはできない。

<a id="A32"></a>

### Adopted A32 — a2-p04-r2c2：遠見の水晶球

出典：[CardAll.pdf p.4](../../../resources/original/second-edition/CardAll.pdf#page=4)、2行2列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：アルセイルの効果は通常の覗き見の代替か追加か。占星の使用回数や通常タイミングを消費・要求するか。**

【オンライン補完・暫定採用】アルセイルは通常の正体確認に代えて、同じ1回のカード使用を占星1回の自動成功として解決できる。任意の対象1人の手札全確認と任意の1枚破棄を行い、正体確認を追加では行わない。カードの「手番」は消費するが、本人の別枠の占星能力使用を消費せず、別イベントとして通常の占星も行える。判定は生成されないため判定失敗モードは不可、カード使用失敗モードは可。

**Q2：正体確認後は元の表裏状態に戻す扱いでよいか。**

【原文確認】通常効果は「自分だけ」正体を見られる。【オンライン補完・暫定採用】他の閲覧と同様、キャラクターカードの公開状態は変えず元の表裏を維持する。使用者専用の確認履歴を残し、公開ログには対象と確認成功のみを記録する。

<a id="A33"></a>

### Adopted A35 — a2-p04-r3c2：祈願

出典：[CardAll.pdf p.4](../../../resources/original/second-edition/CardAll.pdf#page=4)、3行2列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：取得したカードは手札へ入るのか、元の設置・詠唱状態を維持して移るのか。OPEN取得後の扱いも要裁定。**

【オンライン補完・暫定採用】通常の取得札は使用者の手札へ入れ、旧所有者の設置・詠唱状態は解除する。取得した札をその場で詠唱済み扱いや装備済み扱いにはしない。OPENだけは手札に保持できず、新所有者の公開領域へ直接移す。持続型OPEN3種は所有者に追従する。一回型OPEN2種がすでに公開済みなら移動によって一回効果を再発動しない。山札から未公開OPENを取得した場合は初回公開として一回効果を処理する。

**Q2：山札から特定カードを探して選べるか。「どこからでも」とあるが探索・シャッフル手順がない。**

【オンライン補完・暫定採用】「どこからでも」に山札を含め、山札から希望するカード名を指定して検索できる。同名複数ならサーバーがランダムな物理1枚を選び、存在しない場合は同じ検索処理内で別名を選び直す。使用者には残り山札に存在するカード名と枚数だけを非公開で示し、山札順は見せない。取得後、残り山札をシャッフルする。他人の手札から選ぶ場合は検索や名前指定を認めず、完全ランダムの例外を優先する。

**Q3：キャラクターカード自体やゲーム外カードは対象に含まれるか。**

【オンライン補完・暫定採用】取得対象は、この対局で使用している行動カードだけ。キャラクターカード、未配布キャラクター、ゲーム外の予備札、解決中のカード、距離を表すため場に残っている踏み込み等の進行管理札、仮想従者・能力トークンは対象外。捨て札と相手の配置済み従者は原文通り対象外。自分の配置従者は本文が禁じないため取得して手札へ戻せるが、この行動以外の追加配置は与えない。

**Q4：設置カードを失った側の能力値・詠唱・従者上限の再計算時点はいつか。**

【オンライン補完・暫定採用】取得の移動と同時に旧所有者の設置補正を取り除き、詠唱枚数・従者上限・手札上限を再計算する。従者・詠唱超過は現在の子効果終了時に選択破棄し、解除不能従者を破棄候補にしない。手札超過だけ手番末まで保持する。人物への一度成立した陣営・目的変更や、カードから独立した永続効果はカード取得だけでは解除しない。公開した補正で秘密のキャラクター基本値は表示しない。

**処理を閉じるための補足**

【原文確認】基本ルールp.6§11.8は異界のキャラクターが「祈願」等の影響を受けないと明記する。【オンライン補完・暫定採用】その者の手札・従者・詠唱・設置・公開OPENを対象にしない。通常の参加者からランダム手札取得を行うときは、取得内容を使用者と元所有者だけに示す。公開領域からの取得内容は公開履歴に残す。

<a id="A36"></a>

### Adopted A36 — a2-p04-r3c3：祈願

出典：[CardAll.pdf p.4](../../../resources/original/second-edition/CardAll.pdf#page=4)、3行3列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：取得したカードは手札へ入るのか、元の設置・詠唱状態を維持して移るのか。OPEN取得後の扱いも要裁定。**

【オンライン補完・暫定採用】通常の取得札は使用者の手札へ入れ、旧所有者の設置・詠唱状態は解除する。取得した札をその場で詠唱済み扱いや装備済み扱いにはしない。OPENだけは手札に保持できず、新所有者の公開領域へ直接移す。持続型OPEN3種は所有者に追従する。一回型OPEN2種がすでに公開済みなら移動によって一回効果を再発動しない。山札から未公開OPENを取得した場合は初回公開として一回効果を処理する。

**Q2：山札から特定カードを探して選べるか。「どこからでも」とあるが探索・シャッフル手順がない。**

【オンライン補完・暫定採用】「どこからでも」に山札を含め、山札から希望するカード名を指定して検索できる。同名複数ならサーバーがランダムな物理1枚を選び、存在しない場合は同じ検索処理内で別名を選び直す。使用者には残り山札に存在するカード名と枚数だけを非公開で示し、山札順は見せない。取得後、残り山札をシャッフルする。他人の手札から選ぶ場合は検索や名前指定を認めず、完全ランダムの例外を優先する。

**Q3：キャラクターカード自体やゲーム外カードは対象に含まれるか。**

【オンライン補完・暫定採用】取得対象は、この対局で使用している行動カードだけ。キャラクターカード、未配布キャラクター、ゲーム外の予備札、解決中のカード、距離を表すため場に残っている踏み込み等の進行管理札、仮想従者・能力トークンは対象外。捨て札と相手の配置済み従者は原文通り対象外。自分の配置従者は本文が禁じないため取得して手札へ戻せるが、この行動以外の追加配置は与えない。

**Q4：設置カードを失った側の能力値・詠唱・従者上限の再計算時点はいつか。**

【オンライン補完・暫定採用】取得の移動と同時に旧所有者の設置補正を取り除き、詠唱枚数・従者上限・手札上限を再計算する。従者・詠唱超過は現在の子効果終了時に選択破棄し、解除不能従者を破棄候補にしない。手札超過だけ手番末まで保持する。人物への一度成立した陣営・目的変更や、カードから独立した永続効果はカード取得だけでは解除しない。公開した補正で秘密のキャラクター基本値は表示しない。

**処理を閉じるための補足**

【原文確認】基本ルールp.6§11.8は異界のキャラクターが「祈願」等の影響を受けないと明記する。【オンライン補完・暫定採用】その者の手札・従者・詠唱・設置・公開OPENを対象にしない。通常の参加者からランダム手札取得を行うときは、取得内容を使用者と元所有者だけに示す。公開領域からの取得内容は公開履歴に残す。

<a id="A37"></a>

### Adopted A38 — a2-p05-r1c2：母様の真実

出典：[CardAll.pdf p.5](../../../resources/original/second-edition/CardAll.pdf#page=5)、1行2列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：GOODでなくなった場合のカードの行き先は本文にない。**

【オンライン補完・暫定採用】アスフェルトがGOODでなくなった時点でこの設置札を捨て札へ送る。再びGOODへ変わっても同じ札を自動的に戻さない。捨て札化自体は追加の陣営変更を発生させない。

**Q2：祈願等でカードを取り除くと陣営・目的の変更は元に戻るか。**

【オンライン補完・暫定採用】成立した陣営・目的・敗北条件の置換は人物側の状態として保持し、祈願で物理カードを除いても巻き戻さない。別の陣営変更効果が新たに解決した場合だけその指定に上書きされる。

**Q3：すでにリーア姫が死亡していた場合の敗北処理時点はいつか。**

【オンライン補完・暫定採用】置換直後の状態確認でアスフェルトを流浪にし、カード返却等の連鎖を解決した後に勝敗を評価する。既に死亡しているリーア姫を存在しなかった条件として無視しない。

<a id="A39"></a>

### Adopted A39 — a2-p05-r1c3：おまえは、俺の敵でないっ！！

出典：[CardAll.pdf p.5](../../../resources/original/second-edition/CardAll.pdf#page=5)、1行3列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：「一連の攻撃」が反撃・連続攻撃をどこまで含むか。**

【オンライン補完・暫定採用】共通裁定の「一連の攻撃」に合わせ、最初の進撃から子の反撃・追加攻撃を含む撤退完了までを一連とする。このカードの使用が成立した時点以降、複数対象・複数ヒット・子の追加攻撃には維持し、反撃を返されて自分が判定を行う場合にも+2を維持する。使用前に確定した判定を巻き戻して補正しない。撤退完了または攻撃行動全体の中止で終了し、後の手番の独立した攻撃には持ち越さない。

**Q2：防御側が使えるか、複合を後から追加できるかは一般ルールとの照合が必要。**

【オンライン補完・暫定採用】複合カードは技を使う際に組み合わせる。防御者も適法な反撃技の宣言と同時なら使える。単独の通常防御札としては使えず、使用Lv不足の精神力判定を有利にするために出目を見た後で追加することもできない。

<a id="A40"></a>

### Adopted A40 — a2-p05-r2c1：月の竪琴

出典：[CardAll.pdf p.5](../../../resources/original/second-edition/CardAll.pdf#page=5)、2行1列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：効果Lvやダメージを持たない精神技への使用可否は本文にない。**

【オンライン補完・暫定採用】精神技であり効果Lvが存在するなら使える。ダメージ欄が「-」等の無損害効果で数値を持たない場合は効果Lv+2だけを適用し、存在しないダメージを新たに4として作らない。ダメージ欄が数値0なら0+4とする。効果Lv自体を持たない札には使えない。

<a id="A41"></a>

### Adopted A41 — a2-p05-r2c2：全軍突撃せよ

出典：[CardAll.pdf p.5](../../../resources/original/second-edition/CardAll.pdf#page=5)、2行2列。

**原文から確定する中核**

印刷本文・数値・使用者制限は [カード仕様](../../rules/second-edition/actions-01-06.md) の同一カードIDを参照。以下はその未確定点を補う裁定であり、提案の文言で原本転記を上書きしない。

**Q1：攻撃技として使用する際の属性・距離・技種別・ダメージ計算とカード行き先は一般ルールとの照合が必要。**

【原文確認】基本ルールp.6§11.3は従者を攻撃技のように使い、使用後は捨て札にして従者に戻さないと明記。【オンライン補完・暫定採用】下部の攻撃プロファイルの距離・属性・効果Lv・ダメージ・特殊条件をそのまま使用し、通常の技の適法性を検証する。明記のない戦士／魔法属性や距離を推測で与えない。下部プロファイル自体が不完全な場合はその従者をこのカードで選択不可とし、カード個別裁定で補完されるまで止める。

**Q2：士気チェック失敗時に全軍突撃せよと従者の双方を消費するか。**

【オンライン補完・暫定採用】使用時に全軍突撃せよと選んだ従者1枚を解決領域へ出し、必要な士気チェックを行う。失敗時は両方を捨て札にし、攻撃行動を消費する。別の従者への選び直しはできない。

**Q3：このカードの使用と従者カードの使用のどちらに命運凶変で割り込めるか。**

【オンライン補完・暫定採用】全軍突撃せよの手札使用宣言、従者カードの攻撃使用宣言、必要なら士気判定のそれぞれに対応するモードで介入できる。親の全軍突撃が失敗すればその許可に依存する従者攻撃も失敗するが、すでに支払った両カードは返さない。一枚の命運凶変が同時に複数の独立宣言を対象にはできない。

<a id="A42"></a>

## Appendix B — S01–S32 producer deficiencies and existing evidence candidates

## 5. S01–S32 exactness audit

Classification refers to match of the existing test body to the scenario, **not current test execution**. `exact core` means the written original core is exercised in one producer path but remaining named checks are explicitly noted; it does not set ledger status verified. `related` means values/actors/path differ. `abstract` means injected state/helper arithmetic rather than all original producer actions. `unverified/pending` means no complete exact case was established.

| ID | Existing concrete test(s), handler | Classification and remaining exact acceptance |
|---|---|---|
| S01 | `scenario-s01-s05.test.ts`, `room-scenario-s01-s05.test.ts`, `scenario-s01-s05.spec.ts`; shared `r6-roll-scenarios.ts` | **Verified 2026-09-09:** D God request arrives first at C priority and is rejected unchanged; C Fate then accepted at the same expected revision. D later answers the new parent generation legally. Engine/DO exact dice; browser uses live reroll and preserves observed result across reload. See `2026-09-09-r5-s01-s05.json`. No semantic ledger promotion. |
| S02 | `scenario-s01-s05.test.ts`, `room-scenario-s01-s05.test.ts`, `scenario-s01-s05.spec.ts`; shared `r6-roll-scenarios.ts` | **Verified 2026-09-09:** A/B passes cleared after actual C force-fail child; same parent ID, cursor0 and greater revision. Real DO rejects a fresh command carrying the old window generation with STALE_WINDOW and replays the same error. Engine/DO exact dice; browser uses live reroll and preserves observed result across reload. See `2026-09-09-r5-s01-s05.json`. No semantic ledger promotion. |
| S03 | `scenario-s01-s05.test.ts`, `room-scenario-s01-s05.test.ts`, `scenario-s01-s05.spec.ts`; shared `r6-roll-scenarios.ts` | **Verified 2026-09-09:** B actual God declaration pays/refills once, then C actual Fate cancels it. Both cards discarded, B replacement and used-event key retained, no reroll/dice consumption and no original action refund. Engine/DO exact dice; browser uses live reroll and preserves observed result across reload. See `2026-09-09-r5-s01-s05.json`. No semantic ledger promotion. |
| S04 | `scenario-s01-s05.test.ts`, `room-scenario-s01-s05.test.ts`, `scenario-s01-s05.spec.ts`; shared `r6-roll-scenarios.ts` | **Verified 2026-09-09:** Actual whole 2d6 [2,3]→[4,4], stable roll ID and two attempts. DO saves the result-writing command, changes entropy to6 before restart, replays identical receipt and never produces a third roll; doubles retained. Engine/DO exact dice; browser uses live reroll and preserves observed result across reload. See `2026-09-09-r5-s01-s05.json`. No semantic ledger promotion. |
| S05 | `scenario-s01-s05.test.ts`, `room-scenario-s01-s05.test.ts`, `scenario-s01-s05.spec.ts`; shared `r6-roll-scenarios.ts` | **Verified 2026-09-09:** C actual force-fail then D actual God reroll to [4,4] total8/threshold9 preserves forcedFailure and unsuccessful outcome, causing actual poem damage5/stop1. Engine/DO exact dice; browser uses live reroll and preserves observed result across reload. See `2026-09-09-r5-s01-s05.json`. No semantic ledger promotion. |
| S06 | `scenario-s06-s10.test.ts`, `room-scenario-s06-s10.test.ts`, `scenario-s06-s10.spec.ts`; shared `r6-defense-scenarios.ts` | **Verified 2026-09-09:** Actual Shin ordinary 炎 locks Lv6 at normal-defense. Late 気合い USE_ABILITY rejects unchanged, no hand/used attempt/roll consumed; ability not offered and damage5 still resolves. See `2026-09-09-r5-s06-s10.json`. No semantic ledger promotion. |
| S07 | `lia-prayer-rider.test.ts`, `room-lia-prayer.test.ts`, `lia-prayer.spec.ts` | **Verified 2026-09-09:** Existing Dedicated Lia prayer is inaccessible within one real event, then legally used and returned in a later real turn event in lia-prayer-rider.test.ts. One actual physical prayer reservation prevents same-event resubmission, returns once, then actual later D turn Black Wing allows same physical prayer again. Full DO and two browser paths already verified in 2026-09-09-r5-lia-prayer.json; current Engine body rerun. See `2026-09-09-r5-s06-s10.json`. No semantic ledger promotion. |
| S08 | `scenario-s06-s10.test.ts`, `room-scenario-s06-s10.test.ts`, `scenario-s06-s10.spec.ts`; shared `r6-defense-scenarios.ts` | **Verified 2026-09-09:** Actual 転移 [6,6] failure at B spirit6 returns to normal defense; same spent teleport retry refused unchanged. B actual 閃光槍 accepted before followers and returns5 to A, B0. See `2026-09-09-r5-s06-s10.json`. No semantic ledger promotion. |
| S09 | `scenario-s06-s10.test.ts`, `room-scenario-s06-s10.test.ts`, `scenario-s06-s10.spec.ts`; shared `r6-defense-scenarios.ts` | **Verified 2026-09-09:** Actual Asfelt dedicated 風斬剣 Lv6/damage12 targets B/C. B actual ordinary 受け流し Lv6 with warrior5 requires and succeeds at one usage check; B hit defended/no returned group, C hit intact then damage12, A/B0. See `2026-09-09-r5-s06-s10.json`. No semantic ledger promotion. |
| S10 | `scenario-s06-s10.test.ts`, `room-scenario-s06-s10.test.ts`, `scenario-s06-s10.spec.ts`; shared `r6-defense-scenarios.ts` | **Verified 2026-09-09:** Actual far 黒翼飛翔剣 Lv5 and ordinary near 妖撃破山剣 Lv5 (warrior4 usage check succeeds), then actual own physical prayer d6=2 freezes counterLv7. Blocks B hit, no A returned damage, distances unchanged. Browser starts from this command-generated Lv7 boundary; Engine/DO exercise full counter/prayer producer. See `2026-09-09-r5-s06-s10.json`. No semantic ledger promotion. |
| S11 | `scenario-s11-s13.test.ts`; `room-scenario-s11-s12.test.ts`; `scenario-s11-s12.spec.ts` | **Verified 2026-09-09:** Actual CHANT and intervening turns produce Shin one-hit sword B/C. Both physical maai paid, one actual advance cancels both, all three physical cards discarded once. Full distance matrix unchanged before/after final B7/C7 and withdrawal. DO each command restart/duplicate receipt and live browser payments/reload. See `2026-09-09-r5-s11-s17.json`. No semantic ledger promotion. |
| S12 | `scenario-s11-s13.test.ts`; `room-scenario-s11-s12.test.ts`; `scenario-s11-s12.spec.ts` | **Verified 2026-09-09:** Actual CHANT and intervening turns produce die3 with B three hits. B pays exactly one maai, A passes; defended [true,false,false], hitCursor1 and fresh normal defense, final B14. Same physical maai discarded once; DO each command and browser live inputs/reload. See `2026-09-09-r5-s11-s17.json`. No semantic ledger promotion. |
| S13 | `scenario-s11-s13.test.ts` abstract resolver test; `multi-hit.test.ts` printed 天地 follower test | **Verified 2026-09-09:** Explicit abstract boundary substitutes Lv5/damage6×3 and frozen physical front descriptor Lv3/HP2/no morale. Resolver gives [4,4,4], reduction [2,2,2], one physical follower destroyed/resolution source; JSON continuation equal, repeated settled resolver unchanged, final damage12 and discard once. Separate existing printed 天地7×3/SoldierHP1→18 rerun. Abstract values are not claimed as printed bow/Soldier behavior. See `2026-09-09-r5-s11-s17.json`. No semantic ledger promotion. |
| S14 | `scenario-s14-s17.test.ts`; `room-scenario-s14-s17.test.ts`; `scenario-s14-s17.spec.ts` | **Verified 2026-09-09:** Real initial Royal Knight placement and actual bow. B START_FOLLOWERS closes owned 見切る with DEFENSE_WINDOW_CLOSED/unchanged, then actual morale roll still permits C physical God reroll. Stable roll ID/second attempt, B0 and follower/unused defense retained. DO restart/duplicate ACK-error; browser no normal-defense button, live C God/reload. See `2026-09-09-r5-s11-s17.json`. No semantic ledger promotion. |
| S15 | `combat.test.ts` `suppresses a friendly hit when the target reveals before followers, but not after follower defense starts` | **Verified 2026-09-09:** Existing exact real bow test retained and rerun: same faction hidden B reveals before follower start→damage0, after explicit START_FOLLOWERS and follower-start→damage4. Exact pair is Engine evidence; no new browser producer claimed. See `2026-09-09-r5-s11-s17.json`. No semantic ledger promotion. |
| S16 | `combat.test.ts` `lets 必勝の祈り change the follower outcome through the effect-level child` | **Verified 2026-09-09:** Existing exact actual bow/prayer2 and Wood Golem HP4 test retained and rerun: boosted effect reaches body with numeric damage0, follower destroyed and B revealed. Numeric-zero proof is this Engine path, not the separate null-damage silence test. See `2026-09-09-r5-s11-s17.json`. No semantic ledger promotion. |
| S17 | `scenario-s14-s17.test.ts`; `room-scenario-s14-s17.test.ts`; `scenario-s14-s17.spec.ts` | **Verified 2026-09-09:** Real silence→B Mirror X→A Ice Y creates [X,Y] lineage. Live spent-X request rejected unchanged; B unused teleport accepted in the original unmodified trajectory, no statuses, all three physical defenses discarded once and groups/windows empty. Separate copied structural X-in-hand challenge asserts ALREADY_USED unchanged to isolate lineage; explicitly not a physical reclaim producer. DO and browser continue only the actual path. See `2026-09-09-r5-s11-s17.json`. No semantic ledger promotion. |
| S18 | `scenario-s18.test.ts` `S18 actual chanted two-target three-hit sword uses one Lester resistance and cancels only B three hits`; shared `scenario-s18.ts`; `room-scenario-s18.test.ts`; `scenario-s18.spec.ts` | **Same actual trajectory verified 2026-09-09:** real CHANT and intervening turns, Shin dedicated sword with saved die3, B Lester actual 魔詩, one attacker resistance [2,3] ordinary failure, only B3 canceled/C3 retained, body0/21/no stop. Save before resistance and between target resolution; DO restart/replay and browser reload. See `2026-09-09-r5-s18.json`. R2 semantic catalog promotion remains pending. |
| S19 | `mental-protection.test.ts` `S19 actual Gil spirit threshold failure on Lester sixes retains ordinary cancellation`; mental resistance + faith guard | Exact core: actual Gil spirit (permanent spirit reset0), [6,6], successful selected faith protection preserves faction/no stop, roll successfalse and B damage0. Do not replace with high-spirit helper success example. |
| S20 | `r6-scenarios.test.ts` S20; shared `r6-scenarios.ts`; `room-r6-scenarios.test.ts`; `r6-scenarios.spec.ts` | Exact same trajectory: ordinary physical 魔詩 a2-p17-r1c1, actual maai cancelled by advance reduces B hand5→4; initial −3 [3,4] failure, real turns to −2 [3,4] failure, real turns to −1 [2,3] success from the same status ID. Recovery draws exactly one to5, normal draw to6, action and end turn resume. Engine/DO run exact sequence; browser retains observed recovery dice and separately finishes the exact recovered fixture. Evidence: 2026-09-09-r5-s19-s20.json. |
| S21 | `received-defense-abilities.test.ts` `Shelim real high-effect low/null damage %s is immune before followers`; `receivedDefenseOptions` | Related: selects Shelim. Existing generic `private offered options, exact errors, cancel spent, decline, and late follower entry` uses Fury barrier, not Shelim. Exact concealed Shelim threshold hit → choose non-use → hit occurs → no foreign ID/unused candidate leakage remains unverified. Do not count Fury decline or Shelim use as S21. **Pending user clarification:** G15 (`rulings.md:137`) requires identity publication on a hit reaching the person, conflicting with post-hit identity secrecy here. `r6-scenarios.test.ts` records only current-boundary evidence: actual hidden Shelim non-use is private before hit, then legitimate G15 publication and damage5; unused ability ID stays absent. This does not close S21. |
| S22 | `r6-scenarios.test.ts` S22; shared `r6-refill-scenario.ts`; `room-r6-scenarios.test.ts` S22; `r6-scenarios.spec.ts` S22 ×2 | Exact actual path: real first attack kills D, real intervening turns, next attack C cancels with physical Fate. Its single refill draws FuSen, pauses for actual successful d6/revival decline, then Dawn and one ordinary card. Both resolving cards stay outside shuffle. Original parent ID returns with advanced revision/reset responses; DO rejects old generation and retains identical ACK/error across restart. Browser covers live random revival branch plus exact successful-choice fixture. |
| S23 | `r6-scenarios.test.ts` S23; shared `r6-exhaustion-scenario.ts`; `room-r6-scenarios.test.ts` S23; `r6-scenarios.spec.ts` S23 | Exact structural zone boundary: initial deck1/discard2, actual Secret Book declaration/d6=3 leaves that sole card in resolution. Natural exhaustion draws first deck card then deterministically shuffled two discard cards; resolving book remains excluded until reclaim responses finish. JSON/DO replay and browser reload preserve draw result, ordinary action and 220 unique physical IDs. Initial concentrated zone distribution is a boundary fixture, not a whole-match producer claim. |
| S24 | `owned-reclaim.test.ts` `S24 same-name physical copies share one base allowance`; `reuse-abilities.test.ts` `Extra recovery permits base plus extra but never a third same-name return` | Exact physical X/Y 封傷 via actual use and intervening turns. X base take spends the name; Y exposes no base claim and rejects a request using its current decision/canonical base claim ID as well as the old decision, unchanged. Separate actual Fury base→extra→third refusal proves independent extra allowance. DO/browser cover normal and extra selection persistence; the full X/Y and three-use sequences are Engine evidence. |
| S25 | `cham-death-gift.test.ts` `Cham ability and printed death gift both execute with different cards (ability first)` and `(printed first)`; `death-reward-lifecycle.test.ts` `Actual ritual then two-target chanted sword defers Vanmil terminal outcome until simultaneous Cham gift finishes` | Exact actual lethal hit→Cham gift X→physical death card rejects same X, then legal distinct card Y. Reverse order also rejects the moved card via Cham ability. Rejections leave state unchanged; transfers precede death disposal/outcome. Actual ritual→chanted sword simultaneous Vanmil/Cham death separately proves terminal outcome waits for gift. DO/browser cover Cham use/decline/cancel and private transfer across restart; cross-gift same-card rejection is Engine evidence. |
| S26 | `scenario-s26.test.ts`; shared `r6-wandering-scenario.ts`; `room-scenario-s26.test.ts`; `scenario-s26.spec.ts` ×2 | Exact real Uonos bow kills C Shelim→B Fury wanders, with D Lia alive to continue. Actual old B Soldier and hand return to deck, C death hand goes to discard. Real intervening turns→Uonos dedicated resurrection→C setup5→B return setup5, damage2/life retained, old cards absent, actual new Dwarf placement/refill5→original A hand-adjustment. Every Engine/DO command saves/replays with220 unique; browser covers actual revival and returned setup boundaries. No seeded dead/wandering state. |
| S27 | `r6-scenarios.test.ts` S27; shared `r6-extinction-scenario.ts`; `room-scenario-s27.test.ts`; `scenario-s27.spec.ts` | Exact actual Ramba dedicated earth spear kills C/D→real turns→CHANT→real turns leaves A/B. Ordinary 滅界 target B20/source A10 commits A/B pending in one saved batch before any outcome; all4 then dead, mutual-extinction draw, no winner, one GAME_COMPLETED and one physical source discard. Engine/DO220/replay, browser actual chanted attack→pending-death reload→final draw reload. |
| S28 | `task7f-lifecycle.test.ts` `public Lia offers optional Lancelot transformation while retaining damage and use history`; `ritual transforms Uonos fully and permits optional Vanmil subordinates and Arseil exit`; `received-defense-abilities.test.ts` `actual Uonos ritual grants Giant with no Uonos inheritance`; `transform` | Exact paired transformation tests freshly pass: Lancelot damage4 and old/current IDs retained, Uonos damage4→0 and only Vanmil ID (now asserted in the same ritual body). Separate real Giant selection proves inherited Uonos options absent. Browser exercises both transformation flows; exact damage/identity pair is Engine evidence. Tracked semantic status is unchanged. |
| S29 | `follower-entry-abilities.test.ts` `same one guard reduces all actual Dia Dwarf hits by HP1 with Blessing=%s`; `freezeFollowerSnapshot`, `resolveFollowerSnapshot` | Exact actual 小人族3 hits via Dia ability, one Arnes virtual source across all3, damage[5,5,5], no morale. Explicit length/set220, no virtual ID in physical inventory/any hand/reclaim decision at every remaining response, cleared after final damage15. DO now continues frozen guard through full cleanup and replays original receipt after final restart; browser selected guard completes all3 hits. |
| S30 | `scenario-s30.test.ts`; shared `r6-otherworld-scenario.ts`; `room-scenario-s30.test.ts`; `scenario-s30.spec.ts` ×2 | Exact actual B initial Soldier placement, Magic Book installation and CHANT; A real CHANT/turns/dedicated 裂界, apply and [6,6] resistance failure→B otherworld/damage12. C uses both physical Wishes across actual turns; each excludes B hand/public sources and rejects direct hand/attachment/hidden chant requests unchanged. D physical Revelation B request rejects with an otherwise current valid event; all views unchanged. First Wish legally takes A hand, second acquires actual Dawn from deck→B returns once with possessions/damage/life intact, no revival/setup. DO persists full two-Wish sequence and both ACK/error replay; browser verifies both card paths and reload. |
| S31 | `task7b-techniques.test.ts` `rejects optional chant for a wrong owner and noChecks never waives a required chant`; `resolveTechniqueSelection` / `additionalAttackTarget` / `heldSelections` / `additionalAttackOptions` / `sourceChoices` / `legalAttackTargets` / `followerAttackOptions`/`transitionCombat` chant validation | Exact canonical Fury dedicated 星流弓 factory asserts noChecks:true and chant:true; real direct ATTACK from hand without any waiver returns CHANT_REQUIRED with unchanged state. Wrong-owner optional-chant refusal is retained as a separate assertion. This is Engine legality evidence; no additional browser result is claimed. |
| S32 | `action-value-arithmetic.test.ts` `composes $base / $floor / $add / $multipliers to $want`; `composeValue` | Exact abstract rows now include base5/add[1]/multipliers[2,0.5]→6 and null/add[1]/same multipliers→null. Existing base5/add[0.5]/[0.5,2]→5 retains final-only floor coverage. No canonical card combination or browser producer is claimed. |


### S19/S20 acceptance — 2026-09-09 07:45 JST

The existing exact S19 Gil sixes/faith-protection test and new S20 physical 魔詩 trajectory pass. Focused Engine has 60 unique passing tests (59 in the three-file run, plus S19; S20 overlaps the two-test exact run), DO1, browser3, typecheck and ledger12,112 valid. Three existing status-defense cases now explicitly pass common reclaim windows before expecting discard/next defense/frozen reroll; their original assertions remain. Evidence: `docs/operations/evidence/2026-09-09-r5-s19-s20.json`. S21 remains pending the stated G15 conflict; S22 is the next independent condition. No semantic ledger status is promoted.

### S22/S23 acceptance — 2026-09-09 07:57 JST

Shared R6 fixtures and Engine/DO/browser bindings close the separated S22 and S23 conditions. S22 targeted Engine43, DO2 (including prior S20), browser2; S23 targeted Engine31, DO1, browser1. Across these runs there are 71 unique Engine tests, 3 DO tests and 3 browser tests. Typecheck and ledger12,112 valid; no ledger status promotion. S23 initial zones are explicitly structural; S22 death/turn/reaction prefix is generated with actual commands. Evidence: `docs/operations/evidence/2026-09-09-r5-s22-s23.json`. S21 remains pending G15 clarification.

### S24/S25 acceptance — 2026-09-09 08:01 JST

Focused Engine13, DO5 and browser6 pass, with typecheck and ledger12,112 valid. S24 strengthens the existing actual two-copy test with a current-decision base request and removes the intermediate damage mutation; separate actual Fury base/extra/third-use sequence is retained. S25 adds cross-gift same-card rejection in both orders and pre-outcome assertions to existing real Cham gift cases. Full duplicate/sequence conditions are Engine evidence; DO/browser verify their normal/extra and Cham use/decline/cancel components across persistence. Evidence: `docs/operations/evidence/2026-09-09-r5-s24-s25.json`. Other scenario rows and semantic bindings remain pending.

### S26/S27 acceptance — 2026-09-09 08:12 JST

S26 Engine96/3files, DO1, browser2; S27 adds exact Engine1, DO1, browser1. Typecheck and ledger12,112 valid. Both share actual command-generated fixture prefixes and conserve220 unique cards; death/wandering and final-two states are never seeded. S26 uses deterministic shuffle entropy to observe exact replacement identities; live browser starts after that actual prefix. Evidence: `docs/operations/evidence/2026-09-09-r5-s26-s27.json`. No semantic ledger promotion.

### S28/S29/S31/S32 acceptance — 2026-09-09 08:18 JST

Targeted Engine16/5files, S29 real DO1, browser3 (both transformation flows and selected three-hit virtual guard), typecheck and ledger12,112 valid pass. Only four shared declaration hashes referenced by19 reported rows were updated; no ledger status or semantic correspondence strength was promoted. S28/S29 exact core and S31/S32 legality/arithmetic close their separated checkboxes. Evidence: `docs/operations/evidence/2026-09-09-r5-s28-s29-s31-s32.json`. S30 and the other unfinished plan conditions remain pending.

### S30 acceptance — 2026-09-09 08:26 JST

Engine41/3files, DO1, browser2, typecheck and ledger12,112 valid pass. Shared fixture uses actual commands for placement, installation, chants, turns and 裂界; Engine/DO run both Wishes in one continued state. Invalid requests preserve game state and all player views; Worker intentionally maps engine INVALID_TARGET to public INVALID_ACTION. Browser excludes B from both hand and public selectors, retains private choices across reload, and second real Wish acquires Dawn to return B without re-setup. Evidence: `docs/operations/evidence/2026-09-09-r5-s30.json`. No production handler duplication or semantic ledger promotion.

- [x] 儀式→終末の下僕不選択Engine経路を追加。実儀式で全快したVanmilを、後続実詠唱・専用竜槍で倒し、pending-death後の一回終了と非Vanmil3人勝利を確認。対象1/関連18・型・台帳成功、7条項へ参照追加、status昇格なし。[証跡](../../operations/evidence/2026-09-10-r5-ritual-terminal.md)。下僕転向交差・DO/browser・全条項対応は未完。

- [x] 実儀式→終末の4人不選択/6人下僕選択を三層対応。6人では転向後もGOOD/EVIL対立を残し、実致死槍後に下僕を除くC/E/Fが勝利。Engine2/関連18・DO2全保存再送・browser2操作reload・型・台帳成功。6具体参照を7条項へ登録、status昇格なし。[証跡](../../operations/evidence/2026-09-10-r5-ritual-terminal-transport.md)。死亡/流浪済み勝者・個人勝利交差・人物全条項は未完。

- [x] 実儀式→終末へ6人Arseil公開/陰謀勝利退場を追加。退場直後は個人勝利だけ確定、後続実専用詠唱竜殺天空槍によるVanmil死亡後もexited/個人勝利を保持し勝者重複なし。Engine3/DO3全保存再送/browser3実操作reload・型・台帳成功。3参照を8条項追加、status維持。[証跡](../../operations/evidence/2026-09-10-r5-ritual-terminal-conspiracy.md)。実死亡/流浪済み勝者と人物全条項は未完。

- [x] 実Gaia死亡→Arseil流浪→同一槍の通常回収/再詠唱→実Vanmil死亡で、死亡/流浪済みの両者も終末勝利する三層経路を追加。Engine/DO/browser各1・型・台帳成功。browser初回の手札調整0枚固定を実超過枚数へ修正。3参照を5条項登録、生存/死亡/流浪勝者3行implemented、accepted0。[証跡](../../operations/evidence/2026-09-10-r5-ritual-terminal-absence.md)。実死亡以外の不在、人物全条項、親項目は未完。

- [x] 実儀式→普通裂界詠唱/全手番/実抵抗失敗→Vanmil異界退去では終末なしを三層確認。後続巡回と保存/reloadでもotherworld・所持状態維持、死亡/終了eventなし。Engine1/関連18・DO1全保存再送/browser1・型・台帳成功。試験entropyだけ固定。3参照を終末2条項登録、status維持。[証跡](../../operations/evidence/2026-09-10-r5-ritual-otherworld.md)。人物全条項対応・親項目は未完。

- [x] 儀式/終末の人物2能力semantic12条項を既存handler/具体試験へ対応。実接近と呪殺通常回収消費後の儀式で非初期距離・baseSpent・lifeId・所持状態保持をEngine追加確認。対象1/関連18・型・台帳成功。status昇格なし。[対応表](../../operations/evidence/2026-09-10-r5-ritual-terminal-clause-map.md)。新履歴経路のDO/browserと人物能力無効中の実儀式は未完、親チェック維持。

- [x] ritual-historyの実接近/呪殺通常回収後の変身をDO1全保存再送/browser1実操作reloadへ追加、全型・台帳成功。非初期距離と所持保持は三層、privateなbaseSpent/lifeId/usedはEngine/DOの証拠と区別。該当条項へ2参照追加、status維持。[証跡](../../operations/evidence/2026-09-10-r5-ritual-history-transport.md)。人物能力無効中の実儀式・親項目は未完。

- [x] 実錯乱下の物理儀式成立と実催眠下の手番スキップ/札保持を追加。Engine2/関連18・DO2（停止の期待コード修正再実行）・browser2・型・台帳成功、6具体参照追加、status昇格なし。[証跡](../../operations/evidence/2026-09-10-r5-ritual-disabled.md)。履歴transport等の既存証拠と合わせrootの儀式/終末12条項対応項目を完了。残カード条項・全件accepted・他項目は未完。
