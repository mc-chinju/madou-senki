# R4 Suppression, Reclaim, and Fury Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work is already authorized under the completion plan; do not ask again or commit. Do not dispatch agents unless separately authorized.

**Goal:** Complete paired 神と人の差/祝福, ordinary owned-card recovery and all ten printed reuse packages, including both independent Fury bow dice, through saved Engine/Protocol/Worker/UI decisions.

**Architecture:** Extend the existing persisted `AbilityFrame`, `RollFrame`, physical `reclaimReservations`, and parent continuations. Keep targeting designations with private suppression applicability, name-level spent budgets, and temporary physical reservations as different state. Centralize eligibility and event finalization; never use a UI-only flag or a second combat resolver.

**Tech Stack:** TypeScript, pnpm 10.18.0, Vitest 4.1.0, existing Cloudflare Durable Object storage/WebSocket transport, React UI, Playwright 1.63.0. Node >=22.12.0.

**Spec (tracked, authoritative):** `docs/superpowers/plans/2026-09-08-completion-plan.md` R2/R4/R6; `data/second-edition/characters.json`, `aliases.json`, `actions-01-06.json`, `actions-07-17.json`, `actions-18-25.json`; `docs/rules/second-edition/rulings.md` G03/G06/G07/G09/G11/G14/G15, `docs/rules/second-edition/rulings-characters.md` C01/C02/C13/C15/C16, `docs/rules/second-edition/characters.md`, `docs/rules/second-edition/scenarios.md` S07/S24; `docs/rules/second-edition/rulings-actions-01-06.md` A02/A09/A31 for printed recovery adapters. R2's tracked `data/second-edition/runtime-coverage.json` is the canonical clause/evidence ledger when created and integrated; until then the tracked source and adopted rulings govern, and acceptance stays pending.

**Supplementary audit notes only:** `.superpowers/sdd/2026-09-08-completion-plan/r2-character-inventory.md` and `r2-action-inventory.md` informed this plan. They are ignored local reports, not normative requirements, executable dependencies, or evidence prerequisites. All required source clauses, interfaces, test cases, and unresolved rulings are specified here or in the tracked sources above; implementation must remain possible without those reports.

## Global Constraints

- Planning only while the parent's live browser gate runs: this document is the only write by this task. No runtime/source/fixture/test edits or test execution occurred when preparing it.
- Keep 220 physical action-card IDs exactly once across all physical zones. Same printed name is not the same physical card; a synthetic attack/virtual follower is not a card.
- Each printed ability is optional and cancellable at its legal declaration window. No implicit activation from owning the character. Mandatory printed restrictions are not optional abilities.
- Hidden source character IDs and owned-name entitlements remain private. Public effects and actual exposed cards may be projected without publishing the hidden character ID.
- Accepted declarations consume their existing opportunity budget even on cancellation or failed checks; reject malformed/stale commands without state or entropy mutation.
- `G11`: 通常は人物ごと・正規化した名称ごとに試合中1回、同名複製で権利を増やさない。消費履歴は変身・蘇生でリセットしない。
- `G11`: 回収を選んだ札は回収予約領域へ移し、親イベント終了時に手札へ戻す。予約中は山札・捨て札操作に含めない。
- Preserve G07 effect/damage freeze boundaries, G15 pending-fatal/death settlement, existing Lia dedicated prayer return, and one physical disposition per source in nested attacks and bundles.
- Mark neither a character nor its source ability accepted from ID registration, helper-only tests, or a JSON roundtrip. R4-C and R4-B must both pass before Fury's whole ability is complete.

## Decisions grounded in the adopted text

C13 already permits Vanmil to choose multiple targets, exempts actual Lia and Lancelot II from the suppression effect, and makes the resulting prohibition persistent. It does not authorize testing concealed target identity through selectable candidates or rejection responses. C02 already limits Blessing to one selected person per success, one attempt on Lia's own turn, spirit−5, no main-action cost, and only Vanmil-origin prohibitions. C02's public-window priority and private-decision freeze apply. Do not reopen these as unanswered author questions.

G11 makes ordinary technique recovery available after the user's physical card resolves and ordinary follower recovery after a follower the user placed dies. Failed morale, voluntary disposal, and using a follower as an attack are not ordinary follower death recovery. A canceled paid technique still reaches its disposition after the cancellation resolves; distinguish rejection before payment. Returning a card does not replay OPEN or give a free refill; later actual acquisition uses existing G10 handling.

C01 aliases come from `aliases.json`, not loose substring matching. Expand `水晶球` into both `赤い水晶球` and `遠見の水晶球`; each canonical printed name has its own budget. `女神官シャイア`→`女神官のシャリア`, `死詩`→`死歌`, and `デスナイト`→`デス・ナイト` are adopted matches. Match source-mode aliases `殴る/蹴る/弓/斧` to their printed combined-card names while requiring actual technique use, not the distance/advance face.

Inherited Lancelot abilities remain available to Lancelot II; Uonos abilities do not survive Vanmil's replacement. Character transformation changes current owned lists and ability ownership but never deletes the player's spent canonical-name history. Lancelot II does not acquire fresh base recovery by acquiring a new character ID.

G09 explicitly states: 「未公開の能力使用で本人以外へ実キャラIDや不使用候補を送らない。効果と出目から推測されることは原作の範囲。」 G03 states: 「秘密の手札やキャラクターを理由に公開の回答者一覧を絞らない。」 Thus an actual later effect may permit inference, but a hidden-identity candidate/error/status oracle is not required by C13 and is avoided by the bounded privacy completion below.

### Proposed rulings requiring explicit parent integration

2026-09-08 parent integration: suppression/blessing items 1–3 and 8 are adopted in `rulings-characters.md` C16. Designations accumulate; a new selection never erases earlier targets, and a set adding no new designation is rejected. Recovery items 4–7 and 9 were subsequently adopted in G11 回収のオンライン補完 before R4-B implementation. The death boundary for a Blessing lease is entry into G15 death processing, including a pending-death source; revival creates a new life and never restores the expired lease.

These choices are **proposed online rulings**, not original author text and not silently adopted by this plan. Parent review must record them in the adopted ruling document before implementing the dependent branch; continue independent tasks while a ruling is unresolved.

1. **Suppression lifetime:** A successful ban is a durable result, retained through Vanmil becoming stopped, suppressed, absent, or losing his source ability. Vanmil death normally ends the game under C13; retain provenance through that terminal state rather than deleting unrelated statuses. Ban targets retain links through absence/death/revival; current Lia/Lancelot II identity always exempts them. Source-death tests cover the transient G15 interval and mandatory terminal cleanup, not an invented ongoing match after Vanmil dies. Use actual otherworld/wandering paths for reachable absence tests; source identity loss is a defensive saved-state case unless a legal route is demonstrated. This avoids a recursive live-source gate (Vanmil is not excluded from his own literal target set). It does not infer C15's temporary-stat source cleanup for this explicitly separate pair.
2. **Blessing lifetime/re-ban:** Blessing leases target-wide Vanmil relief while the granting Lia remains alive, including temporary absence; stopping/suppressing her after success does not undo an already committed blessing. Death permanently expires that lease, and revival needs a fresh success. A later Vanmil declaration does not defeat an existing living Lia lease. Non-Vanmil bans always remain. Loss of the actual Lia identity expires the lease. Source character IDs and a life-generation token prevent accidental reactivation after death/revival.
3. **Vanmil opportunity:** Allow one attempt per public decision opportunity, including own-turn neutral boundaries, using the existing conditional-selection opportunity ancestry rule; no main action cost. A new successful declaration records selected target designations for that source (including inert markers for concealed exempt targets), with no arbitrary remove-all switch. Empty, duplicate, and no-change target sets are rejected using the actor's previous recorded designations, never the private effective-ban set. Self-target is allowed by literal C13; once it succeeds Vanmil cannot voluntarily declare further abilities until legitimately relieved. No target is automatically revealed.
4. **Recovery spending and optional enhancement:** Base and extra allowances are separate one-game slots per player/canonical name. The chooser explicitly selects base, extra, or unlimited; never spend base when the user selected an unlimited package. The base slot is spent when reservation commits. An extra slot is spent when its valid ability declaration is accepted and is not refunded if canceled; the canceled card follows normal discard and that claimant's opportunity ends. Unlimited declarations consume only the event attempt. This applies G06 consistently but the exact extra-budget cancellation treatment is an explicit completion ruling.
5. **Named follower packages:** Explicit named-card reuse uses the owner's used technique/follower-attack or placed follower-death disposition, not arbitrary cards found in the discard. It may recover its listed follower-as-attack cards because it says named cards may be reused; ordinary and generic owned-follower allowances still require follower death. Morale failure does not count as use/death for either. Clarify this scope alongside the implementation because G11 does not independently decide every named-card sentence.
6. **Competing claims and public schedule:** For each public source disposition, process the original user/placer first when publicly participating, then every other publicly participating seat clockwise from that actor. Include seats with zero actual rights; private entitlement never changes the opportunity, seat list, waiting state or cursor. Owning the same name does not itself entitle another participant to take it. One take wins; explicit pass/decline or a completed canceled claim advances a finite saved cursor. A visible successful take/check can change subsequent flow as an actual chosen effect. The A09/A31 adapters below use this same envelope; card-specific adopted sequencing overrides generic priority.
7. **Owner unavailable at release:** Return a reserved card to a living temporarily absent/wandering owner at parent completion; no immediate use while absent. A dead, pending-death, pending-fatal, or exited owner loses the reservation to discard. Release does not restore the spent slot. This deliberately replaces current blanket `isActive` disposal of temporary absentees. A new death/revival before release does not grant a fresh allowance; decide release by current life identity, with an intervening death recorded as a failed reservation rather than reviving the old claim.

8. **Concealed exemption privacy (bounded online completion):** Vanmil candidates exclude only publicly revealed Lia/Lancelot II and otherwise use public presence/turn/opportunity conditions. Every hidden target is selectable regardless of actual or privately inspected identity. Declaration validation and its result use exactly those public predicates. After an uncanceled declaration, retain a designation for each selected seat even if the private effect predicate exempts it; hidden exemptions receive no suppression and no distinct response, status, success count, extra frame, or warning. Other viewers see “指定済み・適用状況は非公開” for every designated hidden target, not a true/false disabled badge. The target sees its own actual eligibility privately. A designation is an attempted targeting record, not a false claim that the ban affects an exempt character. Blessing's targets and completion receipts likewise use recorded designations and public conditions, never whether a hidden effective ban exists. A successful Blessing on an inert designation consumes its normal attempt/check and stores an inert relief lease with the same observer projection. No mandatory reveal is added. This additional targeting/projection behavior is proposed, not a quotation of C13.

9. **Uniform recovery response envelope (bounded online completion):** An eligible public physical disposition creates one saved recovery opportunity even if every private claim list is empty. The public participant schedule is determined only by source event, seat order and public presence, and requires explicit `PASS`/decline from every participant; there is no entitlement-based automatic pass, fast-forward or timeout. Pending opportunity IDs, reasons, card IDs, cursor/participant arrays, revision steps, and command receipts do not expose whether any private right exists. Eligible public source types are listed in the contract below, not discovered by querying character ownership. A09's successful Courage use and A31's actual sword discard likewise always open their public reveal/response opportunity even without a currently revealed Lester/Cham. A normal no-right player sees a private “回収せず進む” action; observers see the same neutral recovery prompt/wait. Extra clicks for a no-claim source are the deliberate privacy cost. Voluntary take/check/reveal can produce its real observable effects under G09.

## Live-code map and dependency boundary

Inspected before naming interfaces:

- `packages/engine/src/state.ts`: `canUseCharacterAbility(player)` sees only `stopped`/`ability-disabled`; `PlayerState` has no recovery history; `GameState.reclaim` only has `{ownerId,eventId}`. `allCardInstanceIds` already counts reservations.
- `abilities/frames.ts`, `abilities/advance.ts`: finite ability registry, persisted contexts, declaration/cancellation and roll continuations. `conditional-selection.ts` provides public opportunity ancestry; `turn-information.ts` provides C02 attempt keys and `beginRoll` resumption.
- `abilities/ownership.ts`: `ownsAbility` only resolves actual/current inherited abilities; it does not implement owned-card names.
- `combat/attack.ts`: private `discardAction` physically disposes action/co-source cards; a dedicated Lia prayer branch reserves a card; local reservation release currently checks only matching `actions` and blanket `isActive`.
- `combat/follower-bundles.ts`: `discardBundle` has a second local release loop. `combat/followers.ts:resolveFollowerSnapshot` disposes physically defeated followers and distinguishes revival. Keep those reasons explicit rather than scanning the discard after the fact.
- `lifecycle/advance.ts`: `finishDeath`-equivalent physical death cleanup and outcome stability guard; cleanup must retain usage budgets. `setup.ts:refillHand` owns deck reconstruction/OPEN processing.
- `abilities/action-modifiers.ts`: `SelectedActionModifier` has `amount`, `damageRollId`, `damageSkipped`; POWER already rolls an effect d6, FIST rolls later damage d6. `realTechnique` excludes automatic follower origin and fixed reflections; actual bundle action sources use existing numeric processing.
- `rolls/action-values.ts`: native damage resolves first; `ability-damage` resume is a no-op here because modifier preview reads the saved roll. Do not put Fury's effect die into native `effect-level`, which also changes usage requirement.
- `packages/protocol/src/messages.ts`, `validation.ts`; engine `commands.ts`, `transition.ts`, `view.ts`; web `Board.tsx`, `AbilityPanel.tsx`, `ability-input.ts` supply transport and projections.

R4-A must land its common gate before R4-B extra/unlimited and R4-C suppression integration. R4-B ordinary recovery can be developed independently behind its finite decision. Finish each subgroup's tests/review before starting the next implementation subgroup. R2 supplies canonical clause IDs/evidence registration; this plan does not create a rival ledger.

## Task R4-A: Paired durable ban and Blessing

**Create:** `packages/engine/src/abilities/suppression.ts`; `packages/engine/test/suppression-blessing.test.ts`; `packages/protocol/test/suppression-blessing.test.ts`; `apps/web/src/game/SuppressionPanel.tsx`; `apps/web/test/suppression-panel.test.ts`; `apps/worker/test/fixtures/suppression-scenarios.ts`; `apps/worker/test/room-suppression.test.ts`; `tests/e2e/suppression.spec.ts`.

**Modify:** engine `state.ts`, `abilities/frames.ts`, `abilities/advance.ts`, `abilities/turn-information.ts`, `abilities/conditional-selection.ts`, `lifecycle/advance.ts`, `lifecycle/commands.ts:transform`, `view.ts`, `transition.ts`; every existing `canUseCharacterAbility` callsite enumerated by `rg`; protocol `messages.ts`, `validation.ts`; web `Board.tsx`, `ability-input.ts`; adopted rulings and R2 ledger only after integration.

**Interfaces (new declarations, not claims that these APIs exist):**

```ts
interface SuppressionDesignation {
  id: string; sourceActorId: string; sourceCharacterId: string;
  sourceAbilityId: 'c2-p07-r1c2-ab03'; targetId: string; eventId: string;
}
interface BlessingLease {
  id: string; sourceActorId: string; sourceCharacterId: 'c2-p03-r1c2';
  sourceLifeId: string; targetId: string; eventId: string;
}
interface SuppressionContext {
  kind: 'suppression'; sourceCharacterId: string;
  sourceLifeId: string; opportunityId: string;
}
// Every committed selected seat has a record, including concealed exemptions.
// GameState: suppressionDesignations?: SuppressionDesignation[]
// GameState: blessingLeases?: BlessingLease[]
// PlayerState: lifeId?: string (legacy live saves normalize deterministically).
// Replace the old signature; do not permit a fallback that ignores GameState.
function canUseCharacterAbility(player: PlayerState, state: GameState): boolean;
function vanmilSuppressed(state: GameState, actorId: string): boolean;
function publicSuppressionTargets(state: GameState): string[];
interface SuppressionTargetView {
  targetId:string; designated:boolean;
  applicability:'private'|'suppressed'|'relieved'|'exempt';
}
// PlayerView.suppressionTargets: SuppressionTargetView[]
// Only target=self or publicly revealed identities expose actual applicability.
function suppressionTargetView(state:GameState, viewerId:string,
  targetId:string): SuppressionTargetView;
function resolveSuppression(state: GameState, frame: AbilityFrame,
  dice: () => number): boolean;
```

Use existing `USE_ABILITY`. Add a bounded `targetIds?: string[]` field for Vanmil only (1..seat count, unique IDs); Lia uses existing `targetId`. Refuse both target forms together and refuse unrelated cost/effect/conceal fields. Engine revalidates against the same public-only server candidates; it must not add a second hidden-identity validation branch. Protocol validates shape/finite bounds. After acceptance, newly revealed exemption or private exemption is resolved as an inert designation rather than invalidating the command or dropping that target from public receipts. All frames bind immutable selected targets and parent opportunity; replay uses the same IDs, not a freshly generated opportunity.

- [x] Record the selected proposed rulings in the adopted source before coding their lifetime behavior.
- [x] Add the canonical assertion below using existing `ready`, `character`, `act`, `closeWindow`, `viewFor` helpers. Add a local bounded priority helper copied from `action-value-abilities.test.ts`; no production state bypass to trigger the ability.

```ts
it('Vanmil ban and Lia Blessing are paired saved declarations', () => {
  let s = ready();
  character(s, 'A', '破壊神ヴァンミール');
  character(s, 'B', '侍大将のシン');
  const option = viewFor(s, 'A').abilityOptions
    .find(x => x.abilityId === 'c2-p07-r1c2-ab03');
  expect(option).toBeDefined(); // RED: current registry/options omit this source.
  s = act(s, 'A', {type:'USE_ABILITY', abilityId:option!.abilityId,
    targetEventId:option!.targetEventId, targetIds:['B']});
  s = closeWindow(JSON.parse(JSON.stringify(s)));
  expect(canUseCharacterAbility(s.players.B!, s)).toBe(false);
  expect(s.suppressionDesignations).toHaveLength(1);
});
```

- [x] Run `pnpm exec vitest run packages/engine/test/suppression-blessing.test.ts packages/protocol/test/suppression-blessing.test.ts` and implement the saved frame resolver. Accepted existing implementation/verification supersedes the original RED-capture step; no historical RED result is claimed here.
- [x] In `resolveSuppression`, canceled/invalid frames close without mutation; Vanmil commits all selected-seat designations atomically only after declaration responses, irrespective of private exemption; Lia starts exactly one `beginRoll` with `formula:'2d6'`, `purpose:'ability-check'`, `check:{modifier:-5}`, resume `{kind:'ability',abilityId:f.id}`. Only a successful finalized roll creates a lease. Keep declaration source life ID through the roll. Do not roll during option projection.
- [x] Change all gate consumers to supply state, including conditional stats, action/declaration modifiers, defenses, ongoing selections, follower destruction/entry, beast bundles, lifetime replacements, and lifecycle ability checks. Thread `GameState` through state-less consumers such as `replacementActive` and every caller; avoid introducing a runtime state↔suppression import cycle by keeping source types type-only and the suppression predicate free of the common gate. The final gate is existing stopped/ability-disabled OR durable Vanmil suppression; no clearing other statuses to implement Blessing. Persistent-link lookup must not recursively call the source's ability gate.
- [x] Implement these exact test titles with the listed assertions in `suppression-blessing.test.ts`:

| Test title | Required setup and assertions |
|---|---|
| `Vanmil excludes only publicly revealed exempt targets` | Revealed actual Lia/Lancelot II omitted and rejected without mutation. Hidden exempt and ordinary seats all included. A target revealed as exempt during responses gets an inert resolved designation, not a new command rejection. |
| `Alternative hidden worlds have identical Vanmil candidates and command receipts` | Couple two public-equivalent worlds changing only B's concealed ordinary/exempt identity; compare all non-B views before declaration, accepted command result envelopes, event/revision/attempt counts, response participants and windows. Source actor's private source stays identical. |
| `Hidden exemption changes private ability gate but not designation status` | Resolve the same selected B with no intervening observable effect; compare all non-B views, logs and UI markup, including designation counts/IDs, generic applicability marker, no-change validation and declaration completion. B ordinary is blocked; B exempt remains usable in its own view. |
| `Alternative hidden worlds have identical Blessing candidates and saved receipts` | Fixed Lia chooser C targets B with a recorded designation; compare options, spirit−5 check/roll stages, success/failure/cancellation, lease receipt and reload across ordinary/exempt B worlds. Do not select by private vanmilSuppressed(B). |
| `G03 response seats do not expose a hidden suppression exemption` | Same seats/cursors after declaration/relief across hidden worlds even if B privately has different available abilities; no automatic skip based on ability eligibility. |
| `Public reveal ends concealed applicability without retrospective logs` | Explicit legal reveal publishes actual identity once; then known-exempt status may differ and candidates exclude it. Old generic completion logs are never rewritten with prior exemption. |
| `Vanmil finite target set rejects duplicates empty stale and no-change updates` | Wrong actor/opportunity, duplicate target, empty target, unknown ID, old event; no revision/entropy change. |
| `Canceled Vanmil addition preserves previous committed bans` | B already banned; declare C then actual cancellation card; B still banned, C untouched, attempt spent. |
| `Blessing success failure and cancellation consume one own-turn attempt` | Actual Lia, live banned B; pass/fail spirit−5 fixed dice and canceled declaration. Main action remains available; repeated attempt rejected; other-turn and private inspection unavailable. |
| `Living Blessing covers repeated Vanmil bans but not unrelated prohibition` | Successful lease on B; new ban event selects [B,D] and adds D; generic ability-disabled still blocks; clearing only that status permits the Vanmil relief. |
| `Lia death expires a lease and revival does not resurrect it` | Real lifecycle death/revival; target becomes banned again; same old life ID cannot grant relief. Temporary absence and stopped state follow recorded ruling. |
| `Vanmil source suppression and absence do not recursively erase committed bans` | Commit self plus B; both are suppressed and source cannot re-declare; lookup terminates; terminal source death preserves provenance for end outcome. |
| `Lancelot II becomes exempt after relief and actual transformation` | Ban actual Lancelot; while Lia is public, transform is unavailable because the ability is suppressed. Successful Blessing permits the existing legal transformation. The old designation becomes inert for actual Lancelot II; retain damage4, real inherited ownership and use history, with no unrelated status removed. Lancelot has no C15 selection; check C15 retention with Tia separately. |
| `Suppression pauses selected conditional values without erasing selections` | Actual Tia selected contribution; ban disables live contribution, blessing restores; pre-frozen numeric values remain frozen. |
| `Saved Blessing roll and nested response resume once after reload` | Serialize before roll, after roll and before apply; same parent window/cursor/target; no new roll, lease or declaration cost on replay. |

- [x] Implement the public/private split with the following predicates in `suppression.ts`; consumers must not replace public eligibility with `vanmilSuppressed`:

```ts
const EXEMPT = new Set(['c2-p03-r1c2', 'c2-p07-r1c1']);
function publicSuppressionTargets(s:GameState):string[] {
  return s.seatOrder.filter(id => {
    const p=s.players[id]!;
    return isActive(p) && !(p.revealed && EXEMPT.has(p.characterId));
  });
}
function suppressionTargetView(s:GameState, viewerId:string,
  targetId:string):SuppressionTargetView {
  const p=s.players[targetId]!;
  const designated=!!s.suppressionDesignations?.some(x=>x.targetId===targetId);
  if (targetId!==viewerId && !p.revealed)
    return {targetId,designated,applicability:'private'};
  const applicability=EXEMPT.has(p.characterId)?'exempt':
    vanmilSuppressed(s,targetId)?'suppressed':'relieved';
  return {targetId,designated,applicability};
}
```

Only project entries with `designated:true`; `relieved` means an existing designation whose Vanmil gate is lifted, never absence of an original designation. The authoritative `vanmilSuppressed` first returns false for actual exempt identity, then checks committed designation and valid lease; its private truth value does not feed other-viewer target sets or status payloads.

- [x] Add the following paired-world assertion to `suppression-blessing.test.ts`; its purpose is behavioral privacy rather than textual absence of character IDs. Use the existing bounded `closeWindow` after confirming it completes the declaration and does not auto-select B's private ability. Ensure source A and observers C/D, including their hands/private own identity, remain identical in both states.

```ts
it.each(['リーア姫','聖騎士ランスロット2'])(
  'hidden %s and ordinary identity have the same targeting transcript', name => {
    let ordinary=ready();
    character(ordinary,'A','破壊神ヴァンミール');
    character(ordinary,'B','侍大将のシン');
    ordinary.players.B!.revealed=false;
    let exempt=structuredClone(ordinary);
    character(exempt,'B',name);
    exempt.players.B!.revealed=false;
    const outsiders=['A','C','D'];
    for(const id of outsiders) expect(viewFor(exempt,id)).toEqual(viewFor(ordinary,id));
    const o=viewFor(ordinary,'A').abilityOptions
      .find(x=>x.abilityId==='c2-p07-r1c2-ab03')!;
    expect(o.targetIds).toContain('B');
    const command={type:'USE_ABILITY' as const,abilityId:o.abilityId,
      targetEventId:o.targetEventId,targetIds:['B']};
    ordinary=act(ordinary,'A',command);
    exempt=act(exempt,'A',command);
    for(const id of outsiders) expect(viewFor(exempt,id)).toEqual(viewFor(ordinary,id));
    ordinary=closeWindow(ordinary);
    exempt=closeWindow(exempt);
    for(const id of outsiders) expect(viewFor(exempt,id)).toEqual(viewFor(ordinary,id));
    expect(canUseCharacterAbility(ordinary.players.B!,ordinary)).toBe(false);
    expect(canUseCharacterAbility(exempt.players.B!,exempt)).toBe(true);
  });
```

The inspected catalog names are `リーア姫` (`c2-p03-r1c2`) and `聖騎士ランスロット2` (`c2-p07-r1c1`). A concealed Lancelot II state that has no demonstrated legal concealment route is explicitly a structural privacy boundary test, not canonical playable evidence. Hidden Lia vs an ordinary hidden starting character provides the reachable identity contrast after an actual Vanmil ritual. Add canonical transition coverage of that ritual separately. Do not create a second Lia when testing Blessing: use C as fixed Lia and B as ordinary vs concealed Lancelot II for the structural paired-state test.

- [x] Add UI bounded target selection and the separate `suppressionTargets` projection. Existing `PublicPlayerView.statuses` currently publishes every stored `p.statuses` entry; therefore do not materialize effective Vanmil suppression as `ability-disabled` there. Existing unrelated public statuses remain unchanged. For hidden non-self targets project `applicability:'private'` even when blessed; a successful relief receipt may acknowledge the chosen target/check without asserting it previously had an effective ban. Never expose effective target arrays, exempt target counts, internal life IDs, or a tooltip/error explaining hidden immunity.
- [x] Make Blessing candidates depend on selected-seat designations plus public presence/publicly known exemption, and store successful leases equally for all eligible hidden targets. Source-private known targeting history can filter repetitions; private target identity/effective suppression cannot. Repeat/no-change errors, response windows, logs, and persisted metadata ID allocation must be identical in coupled hidden worlds.
- [x] Follow actual G09 effects faithfully: later voluntarily used abilities, publicly observable numeric consequences, and explicit reveals may support inference. Do not suppress a legal exempt ability, fake equal damage, or leak future private choices to force whole-match indistinguishability. Tests require identical non-owner protocol/projection through the targeting/resolution sequence when no new allowed observable effect occurs; label any later divergence with the exact real effect/reveal, not an implementation diagnostic.
- [x] Worker test persists before/after declaration and during Lia roll, closes/reopens authenticated socket and forces DO reload using existing room recovery harness; stale revision and same command retry cannot duplicate a lease. Browser test uses two authenticated views, cancels one ban, completes one blessing roll and reloads the chooser. No acceptance claim from fixture injection alone.
- [x] Run focused tests plus `pnpm typecheck`, `pnpm --filter @madou/worker exec vitest run test/room-suppression.test.ts`, `pnpm exec playwright test tests/e2e/suppression.spec.ts --workers=1`. Use the recorded paired acceptance; review is omitted per the user instruction.

R4-A再開時受け入れ（2026-09-08）: Engine/Protocol/Web44件、Worker7件、型検査、専用ブラウザ2件成功。[記録](../../operations/evidence/2026-09-08-r4a-acceptance.json)。ユーザー指定によりレビューは実施しない。上の手順チェックは当初の実装手順であり、RED履歴の再取得や独立レビューを再開時に繰り返さない。

2026-09-09文書整合: 親計画R4-Aの既存完了チェックと上記受け入れ記録に合わせ、当初手順の未更新チェック13件を完了へ同期。再実装・再監査・再試験・レビューは実施していない。RED取得を今回実施したという意味ではなく、実装済み状態の受け入れが当初手順を置換する。R4-B/Cや台帳statusには波及しない。

## Task R4-B1: Ordinary owned-card opportunities and reservation finalization

**Create:** `packages/engine/src/reclaim.ts`; `packages/engine/src/reclaim-names.ts`; `packages/engine/test/owned-reclaim.test.ts`; `packages/engine/test/reclaim-reservations.test.ts`; `packages/engine/test/reclaim-privacy.test.ts`; `packages/engine/test/printed-reclaim-adapters.test.ts`; `packages/protocol/test/reclaim.test.ts`; `apps/web/src/game/ReclaimPanel.tsx`; `apps/web/src/game/reclaim-input.ts`; `apps/web/test/reclaim-panel.test.ts`; `apps/worker/test/fixtures/reclaim-scenarios.ts`; `apps/worker/test/room-reclaim.test.ts`; `tests/e2e/reclaim.spec.ts`.

**Modify:** engine `state.ts`, `transition.ts`, `view.ts`, `combat/attack.ts`, `combat/follower-bundles.ts`, `combat/followers.ts`, `combat/legality.ts` (saved source-mode provenance), `combat/follower-placement.ts` (original placer provenance if ownership can change), `reactions/continuations.ts`, `rolls/frames.ts`, `rolls/advance.ts`, `lifecycle/advance.ts`, `setup.ts`; protocol `messages.ts`, `validation.ts`; web `Board.tsx`; keep physical conservation assertions in `packages/engine/test/reclaim-reservations.test.ts`.

**Interfaces:**

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
// Extend RollResume with {kind:'reclaim-check';decisionId:string}.
function resumeReclaimCheck(state:GameState,decisionId:string):void;

```

`offerReclaim` dispatches by saved **source kind**, not by a scan of current rights. For every actually played physical action-card terminal disposition (including turn/anytime utilities listed as 持ち技, not only warrior/magic attacks) and every actual follower death, create a public envelope even when its private claims are empty. Source-specific A09 chooses the Courage adapter for that same disposition rather than adding a duplicate ordinary opportunity; unrelated ordinary rights, if any, remain private choices in the shared envelope. A resolved played physical card remains in `resolution`; move a dying physical follower there after intrinsic revival is resolved. Failed morale/voluntary disposal are not ordinary follower-death triggers. Synthetic attacks and virtual followers create no physical opportunity, based on their public source type. `technique-resolved` is the stored owned-use disposition label; it must not be implemented with the numerical-modifier helper `realTechnique`, which would exclude owned utility cards. A combined card's pure distance/advance mode gives no owned-technique claim; any terminal physical disposition envelope remains public and may simply have zero claims. Source-mode and original placer provenance are saved at actual acceptance/placement; do not infer them from whoever currently holds the card. Snapshot references are not additional zones.

The two printed adapters are different events: A09 opens after successful Courage cancellation with the card still in `resolution`; A31 opens only **after the exact physical sword has actually entered `discard`**, from any adopted source zone. Never move A31 into `resolution` or substitute ordinary ownership eligibility. If an ordinary all-pass disposition actually discards that sword, the distinct A31 discard opportunity follows; a direct reservation has not been discarded and cannot trigger A31. Persist a unique `discardEventId` per actual occurrence, including a later re-discard of the same physical card, to distinguish it from replay of the old occurrence.

Public `reclaimView`/activeWindow exists for everyone throughout every envelope; only the current actor gets its private claims and actionable decline. Zero-claim current actors still issue explicit decline/PASS. The server never sends a public eligible-claimant count or skips a waiting seat because it has no ability. Derive opaque claim IDs within the saved decision/seat scope without incrementing `nextEventId` per private claim; private list size must not shift later public event/window/roll IDs. Source identity/printed source event controls envelope existence; selected actual effects may open their public roll/declaration children. A public death/removal can remove a seat under G03, but hidden eligibility cannot. Reveal resumes the same participant without advancing it or opening a replacement recovery opportunity.

2026-09-09 distance progress: contested approach/withdrawal terminal sources now save payment actor/life/mode, use the public per-card disposition queue and resume their distance result once. Actual distance-then-kick preserves the owned-name slot; failed approach returns to action. `distance-reclaim.test.ts` 3 and existing distance 6 cases pass, with DO/browser source reload coverage. Combat maai/advance payments were subsequently connected with a saved group continuation, and Magic Sky/Black Wing paid batches with a saved source cursor. Final focused 408 cases and typecheck pass; actual DO/browser source reload coverage is recorded in the R4-B1 progress evidence. Ability/utility producers and A31 remain outstanding.

### Shared R4/R5 printed adapters (required B1 contract, R5 owns card producers)

A09 and A31 are adopted card rules, not new character reuse abilities. Keep `right:'printed'` independent of owned-name membership and `canUseCharacterAbility`; apply each card's actual conditions and public normal-response/presence rules. The checker, chooser, beneficiary and budget owner are separate roles even when ordinary recovery makes them the same player. No base or extra slot is charged for either printed rider.

- [x] **Courage A09 producer → common saved check → original-user reservation.** R5 calls the common entry point only after the real Courage effect canceled its selected unresolved mental ability. The original user remains the immutable beneficiary; no eventual Lester selection rewrites it:

```ts
offerReclaim(state, {
  kind:'courage-resolution',eventId:action.eventId,sourceId:action.id,
  sourceActorId:action.actorId,cardInstanceId:'a2-p01-r3c3',
  fromZone:'resolution',beneficiaryId:action.actorId,
  beneficiaryLifeId:state.players[action.actorId]!.lifeId!,
  cancellationSucceeded:true,
});
```

The public response schedule opens even if nobody is currently revealed as Lester. At their ordinary public slot each hidden participant may reveal, remain in that same slot, and then only an actual publicly revealed Lester receives `request-check`. Selecting it saves `checkAttempted=true`, `selectedClaimId`, `checkActorId`, stage `printed-check`, and exactly one roll:

```ts
const roll=beginRoll(state,{
  eventId:decision.eventId,rollerId:claim.checkActorId!,
  purpose:'activation',formula:'2d6',check:{modifier:0},
  resume:{kind:'reclaim-check',decisionId:decision.id},
},dice);
decision.checkRollId=roll.id;
```

Save `checkAttempted` before opening the roll. Revealing, reconnecting, passing a child response, or rerolling the same check cannot create another check attempt. `resumeReclaimCheck` reads this exact applied roll; success opens stage `beneficiary-choice`, pendingActorId=`source.beneficiaryId`, with a private `take`/explicit decline for the original user. The claim's `declaringActorId`/`checkActorId` are Lester, `chooserId`/`beneficiaryId` are the original user. Failure resumes the saved public response cursor with the printed check attempt exhausted; other participants still explicitly pass, but cannot reroll a new check. The same-person case is allowed without assuming it in the contract. On beneficiary take, `commitReclaim` validates the original life and the exact resolution card, reserves to the original user, and returns only when root event settles. Canceled Courage does not meet A09 and never produces the Courage-check adapter; it follows its actual public canceled disposition.

A09 accepted 2026-09-08: actual Courage producer, distinct/same-person checker and beneficiary, failed check/decline/reroll, stopped versus character ability prohibition, cancellation and immediate OPEN refill. Focused Engine/Protocol/Web 41, actual DO 5, browser 5 and typecheck pass; evidence: `docs/operations/evidence/2026-09-08-r4b1-progress.json`. This accepts only the A09 shared adapter, not B1 or all nine R5 anytime cards.

- [ ] **Fairy sword A31 actual discard → common reveal/claim → reservation.** R5 and every actual sword-discard producer first remove the exact ID from its real source zone and append it to `discard` once, saving a discard occurrence ID and origin. Only then call:

```ts
offerReclaim(state, {
  kind:'actual-discard',eventId:discardEvent.parentEventId,
  sourceId:discardEvent.id,sourceActorId:discardEvent.actorId,
  cardInstanceId:'a2-p04-r2c1',fromZone:'discard',
  discardEventId:discardEvent.id,origin:discardEvent.origin,
});
```

`discardEvent` here is an adapter input record with the exact fields shown (`id`, `parentEventId`, `actorId`, `origin:Extract<ReclaimSource,{kind:'actual-discard'}>['origin']`), saved by the producer; it is not assumed to be an existing `GameEvent` type. `actorId` is the publicly causal actor, never a fabricated prior owner for a deck discard. The card stays in discard while all publicly participating seats receive the same reveal/pass schedule. A presently hidden Cham may reveal during its slot and then choose the private printed claim; a non-Cham seat passes. Absence of a revealed Cham never removes the window. Normal response ineligibility/public death prevents Cham taking, not the neutral pass opportunity for other public seats. A character ability ban alone does not block this printed card effect.

A valid take atomically verifies the bound `discardEventId` is still open, removes exactly the sword ID from `discard`, and enters the shared reservation zone for Cham; it never travels through `resolution`. Close the immediate discard opportunity before causally following Dawn/deck-rebuild operations under A02. If the source event already closed or a later independent event moved the card, reject without rewinding or substituting another occurrence. A reshuffle into deck is not a discard trigger. Cham's own death disposal cannot give the dead Cham a claim. Returning the sword does not reattach it or preserve its departed-attachment damage-halving exception.

A31 progress 2026-09-09: actual hand-end-turn/astrology/death/exit/canceled-source hooks save occurrence provenance; common response and root-bound reservation are connected. Actual Cham-only cancellable installation and live attachment damage exception are connected. Focused 227, additional adapter suite 21 (19 overlap), DO 11, browser 9 and typecheck pass. Still pending: actual deck-discard producer, living Cham take after attachment disposal, and a causally queued actual Dawn/rebuild path; this checkbox remains open. Evidence: `docs/operations/evidence/2026-09-08-r4b1-progress.json`.

- [ ] **Adapter acceptance is shared, not delegated away.** Add canonical `printed-reclaim-adapters.test.ts` cases consuming the actual R5 Courage and sword producers through `transition`, the common `offerReclaim`/`commitReclaim` path, and normal root completion. Directly constructed adapter records may prove the helper's schema but do not close either source's runtime clause. R4 B1's transport/check continuation must be present before R5 claims either rider complete; R5 producer evidence is needed before shared adapter acceptance.

- [x] Add exact failing base test using a real canonical source and immutable rejected input, and import `allCardInstanceIds` from `src/state.ts`:

```ts
it('S24 same-name physical copies share one base allowance', () => {
  let s = ready();
  character(s, 'A', '大神官ジル');
  const [x,y] = handCards(s, ['A','A'], '封傷');
  expect(x).not.toBe(y);
  expect(new Set(allCardInstanceIds(s)).size).toBe(220);
  // The production resolver test below completes each actual source using
  // PLAY_TURN_TECHNIQUE/PASS and chooses the server-issued decision, never scans discard.
  expect(canonicalOwnedNames(s.players.A!, 'technique')).toContain('封傷');
  expect(s.players.A!.reclaimUsage?.['封傷']?.baseSpent ?? false).toBe(false);
});
```

Catalog inspection confirms Gil owns `封傷` and there are exactly two printed physical copies. Use the existing healing turn-technique command and a damaged legal target; do not turn this healing card into an attack or manufacture another physical ID. The helper assertion above establishes canonical fixture identity; the S24 test must additionally execute both actual card resolutions and the first reservation, then assert the second base option is absent.

- [ ] Run `pnpm exec vitest run packages/engine/test/owned-reclaim.test.ts packages/engine/test/reclaim-reservations.test.ts packages/engine/test/reclaim-privacy.test.ts packages/engine/test/printed-reclaim-adapters.test.ts packages/protocol/test/reclaim.test.ts`; capture semantic RED for absent `CHOOSE_RECLAIM` decisions and name history, not only missing helper imports.
- [ ] Implement canonical ownership from actual `getCharacter(...).owned_techniques/owned_followers` and C01 alias expansion. Check used action mode as well as normalized printed name. Keep usage on player identity, keyed by canonical name (not event, physical copy, current character, or placement ID).
- [ ] Extend each public physical disposition to offer exactly once independently of claim availability, save source/event/life IDs, and freeze parent progress through the full public participant schedule. Zero actual claims still require explicit passes. Acceptance atomically moves the exact saved `fromZone` (`resolution` or `discard`)→`reclaimReservations`, records beneficiary metadata and any selected budget, and resumes the saved parent when its public response work is complete. All-pass ordinary/Courage disposition moves resolution→discard; all-pass A31 leaves the already-discarded card in place. Process saved source order then public participant cursor, not a private claimant cursor. Never rediscover opportunities by scanning discard after every transition.
- [ ] Extend `ReactionWindow.kind` with `reclaim` and its continuation union with `{kind:'reclaim';id:string}` bound to `ReclaimDecision.id`; store its ID/revision in the decision and dispatch it before ordinary PASS handling. A pending decision must coexist with its suspended parent window; unrelated commands are rejected, while existing required lifecycle/death work can settle with the decision still bound. Publicly vanished card or removed participant follows saved finite cleanup without retargeting; lack of private eligibility never closes/skips the envelope. Preserve a zero-claim actor's ability to explicitly pass. A31 blocks the causally following Dawn/deck-rebuild operation until its window closes, as adopted A02 requires; do not execute a rebuild then undo its draw/shuffle.
- [ ] Validate finite commands against saved stage and current public seat: `request-check` only at `responses` by the claim's declared/check actor, once for Courage; `take` for ordinary/A31 only by the current chooser, or at `beneficiary-choice` only by the saved original user. `decline`/top-level `PASS` advances the current response or beneficiary stage explicitly, even when its claim list is empty. While `printed-check` opens ordinary roll child windows, PASS addresses that top child, not a hidden decline of the parent. Wrong actor/claim/decision/stage is rejected unchanged. Reveal is existing `REVEAL_CHARACTER` and returns to the same saved slot. Bound one pass/choice per seat per opportunity; reopening child reaction windows never regenerates the recovery opportunity or resets its answered-seat prefix.
- [ ] Centralize both current local release loops and dedicated Lia prayer producer. A parent event is settled only when there are no live actions, groups, abilities, windows, unresolved rolls, lifecycle tasks, bundles, pending recovery decisions or private decisions causally owned by it. If lifecycle tasks lack event provenance, add explicit root-event provenance when created; do not test unrelated global activity or only `actions` emptiness. Invoke finalization after a child/event closes, not from `viewFor`.
- [ ] Use life-ID check and recorded unavailable-owner ruling for release; reserved cards are not stolen, reshuffled, drawn, or playable early. Existing `allCardInstanceIds` already counts reservations; never also count metadata or snapshot references. End/outcome waits for the recovery queue as well as reservations.
- [x] Owned alias producers: actual Sharia/Death Knight placement and destruction, actual Death Song CHANT/use, and both crystal cards with separate canonical-name budgets. See 2026-09-09-r4-alias-producers.json.
- [ ] Write the remaining canonical test bodies for each exact case:

| Exact test title | Input route and invariant |
|---|---|
| `Hidden owned versus unowned name has the same empty-or-private opportunity envelope` | Coupled hidden Gil/nonowner uses the same actual 封傷 via `PLAY_TURN_TECHNIQUE`; both reach identical recovery IDs, participants, cursor, activeWindow, legal public phase and non-owner views. Only actor-private claim lists differ. Compare before inputs too: neither world auto-advances after waiting/reload. |
| `Hidden unlimited worlds compare public transcripts without revealing the right` | 権利者を秘匿した初期状態で、権利なし／通常／追加／無制限の4世界を同じ全PASS列で進め、非所有者のreceipt・revision・event ID・窓・最終捨て札を同一にする。無制限世界は権利者が公開しない分岐で比較する。公開後の差は公開イベント本体とその後に実際に選択した効果だけを別行で検証する。 |
| `Suppression and spent history never erase a public recovery response slot` | Same concealed character with ability enabled/disabled and base spent/unspent; own claim list changes, outsider opportunity existence/participant order never does. |
| `Recovery disconnect never auto-passes a no-claim actor` | **Verified 2026-09-09:** `room-reclaim-disconnect.test.ts` closes authenticated sockets without commands, evicts/reloads and invokes the real alarm at 0/60 seconds/1 day in no-claim and base-claim worlds. Complete stored snapshot/cursor/revision remain unchanged, B/C/D game payloads and all four explicit PASS receipts match, source stays in resolution until the final pass then discards once. |
| `A09 absent revealed Lester still gets one public reveal response schedule` | Actual successful Courage in worlds hidden Lester/ordinary seat; all participants explicitly pass with no reveal and identical envelope. In a separate real branch Lester reveals, requests check once and succeeds; only then original user receives its separate take/decline stage. |
| `A09 distinct Lester checker and original user beneficiary share one saved reservation` | Courage user A, actual Lester B; successful cancellation, B reveal/check (2d6 modifier0), A takes. Reload at check and beneficiary-choice; no B return, no slot charged, physical card reserved until parent ends and goes only to A. Also test B decline/failure and A decline, no reused roll/check attempt. |
| `A31 actual discard from hand attachment and deck enters the same adapter` | Parameterize exact source zone; assert discard membership before opportunity, public all-seat reveal window even hidden/no Cham, actual Cham reveal/take gives discard→reservation exactly once; stale occurrence rejected and Dawn sees the reserved card excluded. |
| `A31 all-pass hidden Cham and non-Cham worlds do not reveal rights` | Identical sword discard events and explicit per-seat PASS in both worlds; equal observer schedules/status, no candidate-count/event-ID leak, same final discard location. |
| `A31 reservation does not restore attachment effect and is not owned-name recovery` | Actual attachment disposal, printed take by Cham under generic ability-disabled; no owned budget touched, returned hand card does not restore half-damage exemption, dead Cham cannot take. |
| `S24 same-name physical copies share one base allowance` | Use X, take base, complete parent; later use distinct same-name Y; no base option and forged base claim rejected. All IDs conserved after each accepted command. |
| `Owned aliases expand to physical matches and canonical-name budgets` | **Verified 2026-09-09:** `reclaim-alias-producers.test.ts` uses actual ARRANGE_FOLLOWERS and Lv8 destruction for Sharia/Death Knight, actual CHANT/intervening turns/ordinary Death Song, and canceled Red Crystal plus actual Farseeing over real turns. Each returns its exact physical ID with normalized name budget. Crystal keys are independent; third Farseeing use rejects current forged base claim unchanged. `room-reclaim-aliases.test.ts` traverses both returns and third refusal with per-command restart/receipt replay; `reclaim-aliases.spec.ts` has live red and far paths/private views/reload. Full other-card mode/clause binding remains pending. |
| `Advance mode does not consume an owned technique recovery right` | Use combined advance/attack card as distance then actual printed technique; first is ineligible, second eligible. |
| `Only actual follower death offers ordinary follower recovery` | Actual placement then defeat; separate morale failure, follower-as-attack use, voluntary discard and intrinsic revival routes yield no ordinary death claim. |
| `Canceled paid technique can be reclaimed but rejected declaration cannot` | Real cancellation after accepted card payment; choose base, release after cancellation parent. Invalid ATTACK never moves/spends. |
| `Ordinary recovery is not blocked by character ability suppression` | Base entitlement with Vanmil/generic disabled present remains; enhancement checked separately. |
| `Reservation survives nested child and bundle until root completion` | Real multi-source/bundle chain and a child counter; held card absent from hand/discard until all source windows finish; exactly one return. |
| `Deck reconstruction and Dawn cannot draw a reserved card` | Exhaust deck, trigger existing shuffle and Dawn during parent child; reserved ID remains reserved, other IDs conserved. |
| `Same-seat multiple rights are one response; decline skips the seat` | 同一席に複数権利が出る場合は選択肢として提示し、一方の取得で他方を消す。辞退は席全体を見送る。同名の通常所有は第三の権利を作らない。異なる席の競合は合法経路が特定された時点で追加する。2026-09-10: actual Lester Courage base/printed alternatives pass (2 cases, [evidence](../../operations/evidence/2026-09-10-r4-lester-two-rights.md))。 |
| `Recovery history survives actual transform death and revival` | Spend name slot, execute actual lifecycle transformations/revival; reject another base claim. Ensure cleanup leaves history in stored player. |
| `Reservation owner life and absence decide one final disposition` | Active/absent/wandering versus pending-fatal/dead/exited and died-then-revived scenarios; saved ruling applied; no refund/no orphan reservation. 2026-09-10: actual Rift + Lia prayer proves otherworld transition while reserved and one return after root completion, including Worker per-command restart/ACK replay/all-seat projection and browser reloads ([evidence](../../operations/evidence/2026-09-10-r4-reclaim-otherworld.md)). Same-root actual death/FuSen revival also passes Engine/Worker/browser with old-life discard ([evidence](../../operations/evidence/2026-09-10-r4-reclaim-revival.md)). Actual protected-death wandering also passes Engine/Worker/browser ([evidence](../../operations/evidence/2026-09-10-r4-reclaim-wandering.md)). Actual Arseil self-cancellation of paid Fate, reservation, Vanmil awakening and conspiracy exit also pass Engine/Worker/browser: discard once, preserve spent history, no return ([evidence](../../operations/evidence/2026-09-10-r4-reclaim-exit.md)). |
| `Reloaded recovery rejects stale wrong actor and duplicate take unchanged` | Serialize at offer, reservation and pre-release; same view/cursor; duplicated input rejected without changing 220-card multiset or budget. |
| `Dedicated Lia prayer keeps S07 same-event prohibition through general release` | Existing prayer takes same physical reservation helper; same-event repeat rejected, later event permitted; no base budget charged. |

B1追加受け入れ（2026-09-09 04:29 JST）: `Recovery history survives actual transform death and revival` は実破山剣base回収→Lia公開/ランスロットII変身→実致死攻撃→伏線判定/復活/再準備→暁→祈願→後手番の実接近/同札攻撃まで検証し、通常枠復元なし・古いclaim不変拒否を確認。別途hidden Furyの0/base/extra/base+extra履歴4状態を実攻撃の全PASSで比較。対象61・型成功。[証跡](../../operations/evidence/2026-09-09-r4-reclaim-crossings.json)。この4状態をunlimitedを含む別条件の代替にはしない。集合チェックは残件があるため未完保持。

- [ ] Worker test includes authentic command processing, persistence reload at decision and reserved state, stale revision/command ID retries, private views for all seats. Paired states also persist/reload the zero-claim envelope and compare every non-owner WebSocket payload, participant/cursor and decline receipt. Browser test selects take/decline, sees pending reservation and refreshes before final parent; verify only owner sees recovery entitlements and return does not reopen a used main action.
- [ ] Run focused suites, `pnpm typecheck`, `pnpm --filter @madou/worker exec vitest run test/room-reclaim.test.ts`, `pnpm exec playwright test tests/e2e/reclaim.spec.ts --workers=1`. Review conservation + parent lifetime before R4-B2.

R4-B1進行記録（2026-09-08 23:39 JST）: S24実封傷2枚の名称予算、公開全席順/私有claim、通常技・従者死亡・複数従者・入れ子反撃の保存継続、UI/Worker/E2Eを実装。対象5ファイル30件、Worker3件、ブラウザ3件、型検査・台帳機械チェック成功。距離等の残る処分経路、勇気/妖精の剣adapter、残る交差条件は未完。[進行証拠](../../operations/evidence/2026-09-08-r4b1-progress.json)。B1全体の完了ではない。

2026-09-09 A31 refill crossing acceptance: real Revelation→Fusen revival before-roll→actual Arseil astrology→B hand sword discard opens the common reveal/claim window while the original draw remains queued. Hidden Cham take is reserved before that draw resumes into actual Dawn or natural exhaustion/rebuild, and both exclude the sword. The engine, actual DO and browser share `sword-shuffle-scenario.ts`; live discard/claim, eviction/replay and reload pass. Another real install→opponent Wish→opponent discard→living Cham recovery→attack2/reinstall→later attack5 proves return alone does not restore the installed effect. Focused47 unique Engine/Protocol, DO2, browser2 (Dawn assertion corrected), typecheck and ledger12,109 valid. Evidence: `docs/operations/evidence/2026-09-09-r4-sword-shuffle.json`. Exact positive deck-origin and active-Cham attachment-origin discard requirements remain unproven: the current rules/runtime have no direct deck discard producer, and actual attachment disposal is owner death; Wish moves attachments to hand. Do not create a fictional operation or count the indirect Wish trajectory as direct attachment disposal. Full A31 and shared adapter acceptance remain unchecked.

## Task R4-B2: All ten reuse packages on the shared claim engine

**Create:** `packages/engine/src/abilities/reuse.ts`; `packages/engine/test/reuse-abilities.test.ts`.
**Modify:** R4-B1 files, `abilities/frames.ts`, `abilities/advance.ts`, `abilities/action-modifiers.ts` (Fury dispatch by context); expand Worker/UI/E2E reclaim suites instead of duplicate transport.

**Interface:** `reuseClaims(state:GameState, ownerId:string, decision:ReclaimDecision): ReclaimClaim[]` in `abilities/reuse.ts`; `resolveReuse(state:GameState, frame:AbilityFrame):void`; add `{kind:'reclaim';decisionId:string;claimId:string;cardInstanceId:string;sourceCharacterId:string;ownerLifeId:string}` to `AbilityFrame.context`.

| Printed source ID | Entire recovery obligation |
|---|---|
| `c2-p02-r1c2-ab03` 妖精の弓 | One extra owned-technique recovery/name; R4-C supplies bow effect d6 and independent damage d6 under this same ID. |
| `c2-p02-r2c2-ab04` 主人公 | Revealed Lancelot unlimited owned techniques; inheritance works in actual Lancelot II. |
| `c2-p03-r1c1-ab04` 王の誇り | One extra/name for both owned techniques and placed owned follower deaths. |
| `c2-p03-r2c1-ab04` 月の愛 | Revealed Lester unlimited 月の竪琴, 魔詩, 呪歌. |
| `c2-p04-r1c1-ab03` 凍気の奥義者 | One extra owned-technique recovery/name. |
| `c2-p04-r1c2-ab04` 魔導王第一軍 | Revealed Asfelt unlimited 歌う船, 飛竜. |
| `c2-p05-r1c2-ab04` 魔導王第三軍 | Revealed Upanishad unlimited グリフォン. |
| `c2-p06-r1c1-ab04` 魔導王第二軍 | Revealed Gadyoora unlimited スケルトン, ゾンビー, ワイト, デス・ナイト via adopted alias. |
| `c2-p06-r2c1-ab03` 炎の奥義者 | One extra owned-technique recovery/name. |
| `c2-p06-r2c2-ab03` 闇の雄叫び | Revealed Yotsurm unlimited 狼牙, 妖獣, 餓狼. |

- [ ] Register exact IDs once; Fury dispatches action context to value resolver and reclaim context to reuse resolver, not two printed ability objects. Named rights match their literal list even where not present in generic owned fields. Generic extra rights use only actual owned techniques/followers.
- [x] Add `it.each` table with all ten IDs and exact titles `%s offers only its complete printed recovery package`, `%s declines without auto-recovery`, `%s cancellation consumes its selected attempt without a physical clone`, `%s saves and resumes one recovery declaration`. Every concrete parameter must execute at least one matching real card source; Ramba executes both technique and follower routes; every named-card list member gets a positive case and an unrelated name gets a negative case. Record concrete tuples in R2 evidence.
- [x] Run `pnpm exec vitest run packages/engine/test/reuse-abilities.test.ts` for RED. Implement `CHOOSE_RECLAIM take` for enhancement by creating a normal cancellable `AbilityFrame` with the selected claim; reserve only when `resolveReuse` validates source ownership/reveal/live gate and exact still-pending decision. Explicit base choice makes no optional ability declaration. A failed enhancement ends that actor's selected attempt and advances the public participant cursor once; cannot loop by selecting the same unlimited package again for this source event.

```ts
// Commit point used by resolveReuse after its saved declaration resolves:
const claim = decision.claims.find(c => c.id === context.claimId);
if (!claim || decision.resolvedClaimIds.includes(claim.id)
    || decision.cardInstanceId !== context.cardInstanceId) return;
commitReclaim(state, decision.id, claim.id);
```

Use a complete named internal helper, `commitReclaim(state, decisionId, claimId): boolean`, defined in `reclaim.ts`; it owns zone/budget atomicity for both base and ability routes. The declared context already carries `cardInstanceId`. `attemptedClaimIds` records accepted declarations, while `resolvedClaimIds` records terminal claim disposition; a pending accepted frame is not rejected by its own attempt marker.

- [ ] Add exact tests `Extra recovery permits base plus extra but never a third same-name return`, `Unlimited recovery leaves base slot intact and is finite per event`, `Suppression blocks extra and unlimited but preserves budget and ordinary right`, `Reveal requirement is checked at declaration and resolution without auto-reveal`, `Inherited protagonist survives actual Lancelot II transformation without resetting usage`, and `Fury non-bow owned technique receives extra use without bow dice`.
- [x] Do not reset `reclaimUsage` in turn/death/transform cleanup. Changing the set of owned names merely changes future eligibility; leave historical entries retained. Extra declarations canceled after valid acceptance retain the recorded extra spent bit under the explicitly adopted cancellation rule.
- [x] Expand `room-reclaim.test.ts` to one extra and one unlimited case across actual reload; expand `reclaim.spec.ts` to choose ordinary versus named optional right with server-issued opaque claim ID. Run R4-B focused suites and transport commands from B1, then `pnpm typecheck`. Review all ten rows, with Fury explicitly pending its R4-C obligations.

2026-09-09 B2 recovery path acceptance:10 canonical packages now use one saved cancellable reclaim AbilityFrame and the common commit/disposition/root release. Extra is spent at acceptance, base only at base reservation, unlimited preserves base, and any failed accepted enhancement advances its original respondent once. All40 package matrix cases plus actual named-list members, Ramba death-only extra, repeat base/extra/unlimited, actual Lancelot II, hidden/suppressed conditions and All Army failed-morale exclusion pass. Focused127 plus affected producer152, actual DO2 (4 success/cancel subcases), browser4 (ordinary/printed each), typecheck and ledger12,109 valid. Concrete source tuples: `docs/operations/evidence/2026-09-09-r4-reuse.json`; no ledger/status promotion. Fury numeric dispatch remains pending R4-C. The exact requested positive non-bow owned Fury case also stays unchecked: current owned bow/Light Bow/Star Bow all carry 弓; do not fabricate an owned source or replace it with unrelated-negative evidence. Other B1/strict A31 gaps remain separate.

## Task R4-C: Fury's two independent bow modifiers

**Modify:** `packages/engine/src/abilities/frames.ts`, `abilities/action-modifiers.ts`, `abilities/advance.ts`, `rolls/action-values.ts` only if required by saved resume plumbing; `view.ts`; existing web `ActionCalculationSummary.tsx`, `RollPanel.tsx` only if existing projections cannot display both phases.
**Create:** `packages/engine/test/fury-bow.test.ts`; `apps/worker/test/room-fury-bow.test.ts`; `apps/worker/test/fixtures/fury-bow-scenarios.ts`; `tests/e2e/fury-bow.spec.ts`.

**Interfaces:** Keep `SelectedActionModifier.amount` for finalized Fury effect addition and existing `damageRollId` for its separate later d6. Extend `VALUE_ABILITIES` with `'c2-p02-r1c2-ab03':'fairy-bow'`; ownership stays one registry ID shared with B2. `prepareModifierDamage(s,a,dice)` processes the stable selected-modifier list and returns false while the earliest required damage roll is unapplied. Each modifier has its own saved roll ID/skipped flag; do not reuse the Fist die or overwrite native `damageRollId`.

- [x] Add exact failing test `Fury bow freezes independent effect two and damage five without changing use level`. Select actual Fury and `踏み込み／弓` attack mode using the existing declaration selector; reach `effect-level`, select the whole ability; fix effect die to 2 and damage die to 5 with separate before-/after-roll windows. Assert printed base effect +2, printed base damage +5, unchanged use requirement, two distinct roll IDs and each final face. Existing code fails because Fury has no value option.
- [x] Run `pnpm exec vitest run packages/engine/test/fury-bow.test.ts`. Add qualifying condition `t.attributes.includes('弓')` for a real selected technique, including legal ordinary/counter/bundle source routes; preserve the existing exclusion of automatic follower origin and fixed reflected copies.
- [x] Start effect die in `resolveActionModifier` as the existing POWER numeric branch does; purpose `ability-value`, formula `d6`, resume the same ability frame. Finalized total becomes `amount`. The one selection enables both printed numeric clauses; do not offer separate toggles for effect/damage or use that effect die as an excess-level die.

```ts
// Generalize later modifier damage without changing Fist behavior.
for (const selected of modifiers.selected) {
  const kind = VALUE_ABILITIES[selected.abilityId];
  if (kind !== 'fist' && kind !== 'fairy-bow') continue;
  if (selected.damageSkipped) continue;
  if (!selected.damageRollId) {
    if (!live(state, selected)) { selected.damageSkipped = true; continue; }
    selected.damageRollId = beginRoll(state, {
      eventId: action.eventId, rollerId: action.actorId,
      purpose:'ability-value', formula:'d6',
      resume:{kind:'action-value',actionId:action.id,value:'ability-damage'},
    }, dice).id;
    return false;
  }
  if (state.rolls?.find(r=>r.id===selected.damageRollId)?.stage !== 'applied')
    return false;
}
return true;
```

`damagePreview` adds each applied, still-live modifier die exactly once. Preserve `composeValue(null,...) === null`: no damage is manufactured on a damage-less bow. Freeze one effect contribution before damage, then one damage contribution before target/hit creation. If no canonical damage-less bow exists, label that null case structural-resolver evidence, not a printed play route.

- [ ] Add exact tests `Fury decline and cancellation roll neither optional die`, `Fury non-bow never offers numerical modifier`, `Fury effect reroll does not alter independent damage roll`, `Fury damage reroll preserves already frozen effect`, `Fury suppressed before effect freeze loses both live additions`, `Fury suppressed after effect freeze preserves effect and omits unfrozen damage`, `Fury one bow declaration shares saved numbers across targets and hits`, `Fury reflection does not declare new numeric bonuses`, `Fury source-specific bundle modifier never spills into another source`, `Fury null damage remains null`, `Fury extra owned return and two bow dice complete one printed ability`.
- [ ] 通常弓の実成立経路と数値2ロールを必須とする。フューリーに弓反撃を許可する採用済みカード・能力が存在する場合は、その実成立経路も必須とする。現行の弓・専用欄に反撃権がない組合せは、反撃不可と拒否時の不変を確認する。テスト専用の能力合成は正規経路としない。helper-only の bundle は構造検査。D4a 2026-09-10。
- [x] JSON replay at effect before-/after-roll, after effect freeze, and damage before-/after-roll must produce byte-equivalent saved totals/roll IDs and identical target/hit results. Worker test reloads at each die independently and submits one real reroll reaction; browser uses two clients and refreshes between the two distinct visible rolls. Preserve the opponent's hidden-source projection.
- [x] Run `pnpm exec vitest run packages/engine/test/fury-bow.test.ts packages/engine/test/action-value-abilities.test.ts packages/engine/test/reuse-abilities.test.ts`, `pnpm --filter @madou/worker exec vitest run test/room-fury-bow.test.ts`, `pnpm exec playwright test tests/e2e/fury-bow.spec.ts --workers=1`, and `pnpm typecheck`.

R4-C進捗（2026-09-09 04:22 JST）: 同一IDの数値/追加回収を接続。実弓の2/5、独立振り直し、実Vanmil前後、実光流弓2対象、回収まで確認。Engine対象170（新規13を含む）、実DO1、ブラウザ1、型・台帳12,109行valid。[証跡](../../operations/evidence/2026-09-09-r4-fury-bow.json)。bundleのFury継承、null、反射コピー/自動従者由来は構造検査。実弓反射は後続R5の実王立騎士団/Furyによる妖精族反射で補完（[2026-09-10対応証跡](../../operations/evidence/2026-09-10-r4-fury-reflection.md)、Engine対象1件再実行、Worker毎操作保存再送、browser全席reload成功。3宣言を数値2条項へ登録、pending維持）。合法なFury自身の弓反撃は未証明であり、集合/正規経路チェックは未完保持。レビューなし。

## Final R4 review and ledger handoff

- [ ] Run `pnpm test:unit`, `pnpm test:worker`, `pnpm verify:catalog`, and `pnpm typecheck` once after the integrated subgroup checks pass. Do not repeat broad runs without a source change or unresolved concern.
- [ ] Run the four new E2E files together with `--workers=1` after fixtures/server are stable and no other live browser gate is using that server.
- [ ] Review exact adopted-rule changes against all nine proposed rulings; any unresolved proposal keeps its dependent rows pending. Verify no rule text was labeled an author's statement.
- [ ] R2 ledger maps paired C13/C02 effects, every ordinary owned name clause, ten reuse packages, Fury's three semantic obligations, G11 reservation/budget/alias clauses, S07 and S24 to concrete source functions and exact parameterized test cases. Include Worker-reload and browser evidence separately from engine serialization.
- [ ] Record implementation/test evidence without raising accepted status until parent review and canonical acceptance gates pass. The current document is a plan only; no tests have been run and no behavior has been accepted by its author.

### 2026-09-09 shared A09 and public privacy correspondence

The R5 Task11 shared A09/paired-privacy acceptance now uses `apps/worker/test/fixtures/shared-reclaim-scenarios.ts` in both Engine files (`r5-combinations-riders.test.ts`, `reclaim-reservations.test.ts`), Worker `room-r5-combinations-riders.test.ts` and browser `r5-combinations-riders.spec.ts`. Actual GOOD A Courage cancels C Dia, hidden B Lester reveals/checks once and A alone takes/declines. The four outcome branches and hidden/no printed claimant plus zero/base/extra/both private budget worlds pass with saved/replayed commands and equal public snapshots/receipts under coupled clock/random entropy. Focused43, DO7, browser5 and typecheck pass; ledger12,112 remains valid without promotions. Evidence: `docs/operations/evidence/2026-09-09-r5-shared-reclaim.json`. This closes those shared A09 and Task11 privacy subconditions, not the encompassing R4 checkbox containing other aliases/unlimited rules or the unproven A31 origin matrix.

- [x] R4-B1 disconnect/no-command/time passage acceptance: actual DO1, related Engine/Protocol21, typecheck and ledger12,112 valid. [Evidence](../../operations/evidence/2026-09-09-r4-reclaim-disconnect.json). Other B1 conditions remain open.

- [x] R4-B1 reserved recipient actual death: live Lia prayer→held reservation→actual fatal hit/pending-death/root lifecycle→dead owner/final discard once, Engine/DO/browser reload. Additional pending-death/dead/exited release eligibility matrices are explicitly structural. Engine16/DO2/browser1/typecheck/ledger12,112 valid. [Evidence](../../operations/evidence/2026-09-09-r4-reclaim-owner-death.json). Remaining B1 matrix stays open.

R4-C弓反撃境界（2026-09-10）: 実弓4種類・通常/専用6条件の反撃権なしと防御拒否時不変をEngineで確認、6件と型・台帳成功。[証跡と未採用の条件変更案](../../operations/evidence/2026-09-10-r4-fury-counter-boundary.md)。反撃成功ではなく、既存の正規経路チェックは未完のまま。
