# 魔導戦記オンライン・残工程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 受け入れは [試験受け入れ方針](../../operations/acceptance-policy.md) `acceptance-policy/test-only-v1`。独立レビュー receipt は作らない。

**Goal:** 採用済みの2nd・暫定オンライン裁定で、正式卓の開始から勝敗確定、切断復帰までを検証し、Cloudflareで公開できる状態にする。

**Architecture:** 既存の純粋TypeScriptエンジン、参加者別投影、1卓1SQLite Durable Object、WebSocket、D1を継続する。今回の変更は残工程の順序と完了条件の整理。画像は実装済みのWorkers Static Assetsを使う。

**Tech Stack:** TypeScript、React、Vite、Cloudflare Workers / Durable Objects / D1 / Static Assets、Vitest、Playwright、pnpm。

**Spec:** [既存設計](../specs/2026-09-07-online-game-design.md)、[採用ルール](../../rules/second-edition/README.md)、[現在地・残件台帳](../../checkpoints/2026-09-08-implementation.md)。原計画は[2026-09-07-online-game.md](2026-09-07-online-game.md)。

## Global Constraints

- 初回は2nd。行動220枚・人物26枚・固有能力110件。3rdを混在させない。
- 暫定裁定 `second-online-v0.1-provisional` を基準とし、原典と補完裁定を区別する。
- 試合の正本は1卓1Durable Objectの永続ストレージ。
- 秘密情報はサーバーで参加者別に投影してから送信する。
- 切断は自動パス・自動敗北にしない。常時アクセスなしでも保存状態を保持し、入力待ちから復帰する。
- 乱数結果、割り込み、回答待ち、コマンド受領記録を保存する。同一コマンドの再送で二重処理しない。
- 全条項の実装と必要な検証が揃うまで正式デッキを有効にしない。
- 現在のソースと検証記録の対応を確認する。過去の成功件数を現在の合格に読み替えない。
- ブラウザ試験中は実行対象のソース・fixtureを編集しない。共有ファイルの所有者を明記する。
- 現在の作業・Git履歴を保持する。古い保存版の一括復元、無断のcommit/stashは行わない。
- 今回はローカルの計画改訂。外部リソースの作成・公開は、対象と完成候補を具体化した配備工程で扱う。

## 完成までの区切り

| 到達点 | 完了条件 | 原計画との対応 |
|---|---|---|
| M0: 安定した再開地点 | 現状差分と失敗を解消し、作りかけの8能力を画面・保存まで受け入れる | Task7y |
| M1: 残件と操作性を確定 | 全仕様の条項台帳、残件の依存順、短い戦闘の操作評価が揃う | Task1 / 6 / 7 |
| M2: 全ルールの試遊候補 | 全条項・原典32例を検証し、通常APIで正式卓が開始できる | Task1 / 5 / 7 |
| M3: 一戦を遊び切れる候補 | 4/6/8/10セッション、終了・復帰・障害の自動試験を確認 | Task6 / 8 |
| M4: 公開版 | Cloudflare上の復旧・更新・負荷・素材条件を確認して同じ候補を招待制で公開 | Task8 |
| M5: 対人検証（公開後） | 招待した参加者との通し対戦で R3 の理解・判断時間・操作数・例外裁定を記録 | Task6 |

M2は全ルールの試遊候補であり、公開完了ではない。途中の限定カード試験も完成版と区別する。

## Task R0: 現在のソースと検証記録を整合させる

**Files:**
- Read: `docs/operations/evidence/2026-09-08-replanning-checkpoint.json`
- Read: `.superpowers/sdd/2026-09-07-online-game/task-7y-report.md`, `task-7y-engine-freeze.json`, `task-7y-engine.diff`
- Inspect/必要な修正: 証跡JSONの `mismatches[].path` に列挙した9ファイル
- Inspect: `packages/engine/src/abilities/conditional-preview.ts`（現在untracked）
- Test: `packages/engine/test/conditional-stats.test.ts`, `packages/protocol/test/conditional-stats.test.ts`, `packages/engine/test/view.test.ts`

**Interfaces:** 既存 `transition` / `viewFor` / `gameStats` と有限の `SET_CONDITIONAL_ABILITY` を維持する。出力は現在のソースに対応した検証記録と新しい保存版。

`.superpowers/` はローカルの補助履歴でGit管理外。旧報告や差分が別環境で入手できない場合も、監査JSONの不一致一覧、採用済みC15、現在の実装・固定入力テストから必要な挙動を検証できるようにする。実行テストや正式開始の判定をこの補助履歴へ依存させない。

- [x] まず現在のHEAD・差分・対象ファイルのハッシュを保存する。今回の監査では過去の保存版154ファイル中9ファイルが不一致だった。原因は未確定なので、一括復元しない。
- [x] 9ファイルを旧版・現在・報告された修正の三者で比較する。プレビュー、回復窓、数値・生存条件、テストの差分を個別に採否判断する。
- [x] 現在再現する2件を、採用裁定と照合して修正する。`view.test.ts` は手番外ガーウィンの継続能力選択を含む候補を検査する。混乱回復のテストは、通常の公開された回復判定窓で停止中のOFFが可能であることと、私的選択・必須ドロー・窓なしの手番開始では不可であることを分けて検査する。
- [x] 下記の同じコマンドを再実行し、2件が解消することを確認する。さらに変更した数値プレビューの実際の従者攻撃・多対象・返り攻撃を検証する。

```bash
pnpm exec vitest run packages/engine/test/conditional-stats.test.ts packages/protocol/test/conditional-stats.test.ts packages/engine/test/view.test.ts
pnpm exec tsc --noEmit
```

R0着手前は97件中95成功・2失敗。合格条件は対象全件成功と型検査成功、検証後の対象ソース差分なし。失敗テストの削除や条件の緩和だけで終了しない。

- [x] 差分を解消した現在ソースで、既存の攻撃条件・宣言候補・単独/複合従者攻撃も次の関連Engineゲートで検査する。97件だけの成功でM0へ進めない。追加の変更先がある場合は対応する回帰検査と選定理由も記録する。

```bash
pnpm exec vitest run packages/engine/test/conditional-stats.test.ts packages/protocol/test/conditional-stats.test.ts packages/engine/test/view.test.ts packages/engine/test/heterogeneous-followers.test.ts packages/engine/test/dedicated-follower-attacks.test.ts packages/engine/test/attack-property-abilities.test.ts packages/engine/test/attack-property-provenance.test.ts packages/engine/test/declaration-modifiers.test.ts packages/engine/test/declaration-modifier-numerics.test.ts
```

これは現在ソースの再検証であり、旧報告の340件成功の引用ではない。各修正で全スイートを繰り返す必要はなく、差分確定後の関連ゲートを保存する。

R0完了証跡: [現在ソースの照合と検査結果](../../operations/evidence/2026-09-08-r0-reconciliation.json)。対象106件・関連346件と型検査が成功し、独立エンジンレビューは指摘なし。R1の画面・保存・ブラウザ受け入れは別工程。

## Task R1: 作りかけの8能力を一つの完成単位にする

**Files:**
- Engine: `packages/engine/src/abilities/conditional-*.ts`, `stat-context.ts`, `packages/engine/src/game-stats.ts`
- UI: `apps/web/src/game/ConditionalAbilityPanel.tsx`, `conditional-ability-input.ts`, `Board.tsx`, `FollowerAttackPanel.tsx`, `FollowerBundlePanel.tsx`
- Worker: `apps/worker/test/fixtures/conditional-ability-scenarios.ts`, `game-scenarios.ts`, `e2e-worker.ts`, `apps/worker/test/room-conditional-abilities.test.ts`
- Create: `tests/e2e/conditional-abilities.spec.ts`
- Docs: `docs/rules/second-edition/rulings-characters.md`, `docs/rules/coverage.md`

**Interfaces:**
- `SET_CONDITIONAL_ABILITY`: `abilityId`, 現在の `targetEventId`, `enabled`。リーアのON/更新のみ `targetIds` 必須。
- 自分にだけ `conditionalAbilities` を投影。選択ONと、印刷条件成立による数値適用を区別する。
- 従者候補の追加契約 `targetValues?: { actorId: string; effectLevel: number | string; damage: number | string }[]` は未接続部分を確認する。公開表示名を用いた対象別の値を画面に示す。

- [x] R0後のエンジンと原典8件を独立レビューする。レビュー前のコードを「Task7y完了」にしない。
- [x] C15に一時不在／死亡確定前／死亡確定後、公開回復窓の区別を同期する。実装者の報告だけに裁定を残さない。
- [x] 既存の13fixtureをブラウザ用入口に登録する。現在のWorkerテストは主にfixtureの成立と全能力OFFを確認しており、能力適用の受け入れではない。
- [x] 8能力それぞれのON・不使用・取消をWorker経由で検査する。リーアの対象更新取消は旧選択を維持し、隠れた対象や新たな公開者を自動追加しない。
- [x] ティアの対象非公開→公開、リーア自身非公開と実際のランスロットII、アーネス攻撃/防御、竜の士気、真実の対象別値、ウパの攻撃限定、ガーウィン陣営条件、ディアの上限喪失→通常終了調整を確認する。
- [x] 実DOで同一コマンド再送、保存後再接続、リーアの取消更新、手札上限の選択保存を検証する。新しい試験もカード220枚の一意性を維持する。
- [x] プレビュー表示テストは、対象別値を受け取ったのに通常値だけを表示する現状で失敗させ、対応後に成功させる。秘密の人物IDや他人の設定をDOM/HTTP/WSに出さない。
- [x] 新規ブラウザ試験を実際の操作で通す。負のfixtureも実行し、隠れた対象の偽造入力が状態を変えないことを確認する。
- [x] 全Web/Worker・型検査、新規と影響する既存ブラウザ試験を実施し、画面/通信の独立レビューを終える。結果とソース保存版を揃えてM0とする。

```bash
pnpm --filter @madou/web test
pnpm test:worker
pnpm typecheck
pnpm exec playwright test tests/e2e/conditional-abilities.spec.ts tests/e2e/turn-information.spec.ts tests/e2e/follower-attacks.spec.ts tests/e2e/follower-groups.spec.ts tests/e2e/reconnect.spec.ts tests/e2e/privacy.spec.ts
```

R1/M0完了証跡: [受け入れ記録とソース保存版](../../operations/evidence/2026-09-08-r1-acceptance.json)。Web197件・Worker437件・全型検査・指定ブラウザ64件が成功。実行後372ファイルのハッシュ一致、エンジン・画面/通信・実画像の独立レビューは指摘なし。

## Task R2: 全仕様を条項単位の実行台帳へ対応付ける

**Files:**
- Read: `data/second-edition/actions-*.json`, `characters.json`, `scenarios.json`
- Read: `packages/engine/src/`, `packages/engine/test/`, `apps/worker/test/`, `tests/e2e/`
- Create: `data/second-edition/runtime-coverage.json`, `scripts/validate_runtime_coverage.py`, `scripts/test_validate_runtime_coverage.py`
- Update: `docs/rules/coverage.md`, `docs/checkpoints/2026-09-08-implementation.md`

**Interfaces:** 台帳を出典→条項→実装関数→具体的試験名→未確認条件の正本にする。カタログはエンジンをimportせず、この台帳を検証した結果だけを後のR7で参照する。

- [x] 行動220・人物26・能力110件を全列挙する。通常/専用、別用途、持ち技/従者回収、強制制限、目的、敗北条件、変身と継承も対象にする。
- [x] 台帳の行は `entryId`, `clauseKey`, `source`, `rulingIds`, `handler`, `tests`, `status`, `remaining` を持つ。状態は `pending`, `implemented`, `verified`, `accepted`。一部の条項だけで人物・カード全体を完了にしない。
- [x] ID重複・欠落・出典なし・存在しないハンドラー/試験・未確認条項があるのにaccepted・未知の条項を検出する小さな失敗fixtureで検証器を試す。単なるIDの文字列検索は実装済み判定に使わない。
- [x] 原典32例をS01〜S32のIDで別に対応付ける。原典どおりの値と手順、抽象的な解決器の検査、関連するだけの試験を分ける。
- [x] 下記25候補と、行動カード121技/20手番/13任意時機/5OPEN/40従者/21踏み込みの全用途を再照合し、「未実装」と「実装済みだが対応確認が残る」を確定する。
- [x] 完了済み効果の二重実装を避け、R4〜R6の各群について変更対象・有限コマンド・保存再開点・具体的失敗試験を書いた小計画を作る。根拠のないAPIを先に固定しない。

```bash
python3 scripts/validate_runtime_coverage.py
python3 -m unittest scripts/test_validate_runtime_coverage.py
pnpm verify:catalog
```

上記新規スクリプトはこのタスクで作る。監査だけでは `assertPlayableCatalog` を緩めない。M1では残件数と依存関係を台帳から説明できること。

R2の列挙・残件分類を完了（2026-09-08再開時の機械検査）。台帳12,109行、semantic条項5,193件は証拠不足4,128件／実装不足1,065件として分類済み。S01〜S32はrelated18、exact-core9、structural-resolver2、pending3。これらは対応の強さ・不足の区別であり、原典例の実行合格を意味しない。検証器53件・カタログ検査が成功。R4〜R6の小計画へ進む。ユーザー指示に従い独立レビュー・自己レビューを省略し、実装と指定受け入れ条件を用いる。台帳のverified/acceptedへの昇格は未実施。

## Task R3: 割り込みの操作性を先に確認する

**Files:** `docs/operations/playtest-guide.md`, `playtest-results.md`, `tests/e2e/combat.spec.ts`, `apps/web/src/game/ReactionPanel.tsx`, `RollPanel.tsx`, `PublicLog.tsx`

**Interfaces:** 既存の明示的パスと回答者表示を使う。入力待ちを無期限で保存する契約を維持する。

- [x] M0の限定シナリオで、通常攻撃・第三者取消・多対象多段の短い操作確認を実施する。未完成デッキの正式STARTを迂回して公開しない。
- [x] 6–8人での確認は参加者が必要な工程として日程を分離する。参加者不在でも、R2と独立したルール実装を進めてよい。人間の確認を自動ブラウザで代替したことにしない。
2026-09-11: ユーザー指示により、人による操作評価は production 公開後の M5 で実施する。以下2項目の完了条件は変更しない。自動試験で代替したとは記録しない。

- [ ] 回答者、残る選択肢、処理が戻る先、パス範囲の理解と、判断時間・操作数・通信待ちを記録する。現在の比較基準は8人通常58パス/9窓、多段90パス/20窓。
- [ ] 画面の不明瞭さは該当コンポーネントに限定して直す。操作数削減が必要なら、「現在の明示した機会をパスする設定」と取り消しを別の小設計にする。新しい攻撃/子処理/判定条件変更で失効し、必須選択や支払いには適用しない。
- [x] 自動パスは本計画だけで採用しない。現行の明示パスを維持するか、実測から変更するかを記録する。秘密の手札/人物から順番を省略する方式は採らない。

R3の自動操作部分: [M0と同じ候補で4件成功](../../operations/evidence/2026-09-08-r3-combat-metrics.json)。通常58パス/9窓、多段90パス/20窓を再測定。参加者・日程は未確定で、人間の理解・判断時間・待ち時間は未確認。現行の明示パスを維持し、R3全体は未完了。

## Task R4: 無効化と再使用の共通処理を完成させる

**Files:** `packages/engine/src/abilities/`, `packages/engine/src/reactions/`, `packages/engine/src/lifecycle/`, `packages/engine/src/state.ts`, `packages/protocol/src/`, `apps/web/src/game/`, 対応するEngine/Worker/E2Eテスト

**Interfaces:** 現在の能力利用可否と `conditionalSelections` を無効化の基礎にする。再使用は既存 `reclaimReservations` と物理カードの領域管理を使う。新しいコマンド名・予約解放時機はR2の群別計画で定義してから実装する。

- [x] 「神と人の差」と「祝福」を一組で実装する。対象例外、使用任意、取消、禁止元と回復元の生存、再禁止、変身/継承、既存の能力停止を別々に検証する。
- [ ] 通常の持ち技/従者回収と、常時再使用・追加1回を共通の保存処理で扱う。使用済み回数の単位、予約時機、取消時、山札再構成、死亡/流浪、複数権利者の順序を採用裁定に従って確定する。
- [ ] 再使用10候補を全条項で実装する。フューリー「妖精の弓」はランダム数値修正も含めて完了判定する。
- [ ] 予約された札が引かれる/二重取得される/捨て札に残ることを拒否する試験と、保存→復帰→同じ選択の一回確定を各群の受け入れに含める。
- [ ] Engine/Protocol、Worker、UIの必要経路と [試験受け入れ方針](../../operations/acceptance-policy.md) による受け入れを終え、台帳を更新する。独立レビュー receipt は作らない。

## Task R5: 残る戦闘・死亡能力とカード効果を完成させる

**Files:** `packages/engine/src/combat/`, `abilities/`, `lifecycle/`, `effects/`, `rolls/`, `packages/protocol/src/`, `apps/web/src/game/`, 対応するEngine/Worker/E2Eテスト

**Interfaces:** 既存の攻撃・判定・ヒット・死亡バッチを拡張する。返り攻撃でも現在の攻撃者・対象・発生元を保持し、G07数値確定/G15同時死亡を維持する。

- [x] 距離3候補を実装する。ティア「飛翔」は地魔法無効と間合いの両方を検証する。ランカスターは元の攻撃者に返った反撃時という条件を固定する。
- [x] 氷刃・炎刃と影飛びを実装する。物理札を使わない攻撃と支払い札を区別し、影飛びの無効化→任意の踏み込み支払い→元の攻撃者への従者無視/間合い不可攻撃を保存可能にする。
- [x] 斬・悲しき愛・吸魂・飢え・チャムの死亡贈与を、共有する死亡境界に合わせて実装する。身代わり前後の対象、撃破者の発生元、同時死亡、報酬の前提時点、永久修正と一時能力の違いを検査する。
- [x] ウーノスの復活の儀式とヴァンミール終末は既存の変身/終了処理へ全条項を照合する。証拠不足なら不足試験または修正を行い、重複したハンドラーを作らない。 人物2能力のsemantic12条項を既存処理へ対応し、実儀式→終末、履歴保持、実死亡/流浪/退場/異界退去、能力無効/行動停止の不足検証を完了。[最終補足](../../operations/evidence/2026-09-10-r5-ritual-disabled.md)。全件acceptedや他のR5項目の完了とは区別する。
- [ ] R2で確定した残カード効果・全用途を依存順に実装する。効果ごとに実カードの成立経路、不使用/取消/禁止、保存再開、公開範囲を確認する。
- [ ] 群ごとに試験受け入れを閉じ、同時に複数の作りかけ群を残さない。独立レビューは行わない。

## Task R6: 原典例と組み合わせの検証を閉じる

**Files:** `data/second-edition/scenarios.json`, `runtime-coverage.json`, `packages/engine/test/`, `apps/worker/test/`, `tests/e2e/`

- [x] S01〜S32を全て対応付ける。S18は実際の天地百撃斬で2対象×3ヒットとレスターの取消範囲を確認する。1ヒットの近似試験で済ませない。
- [x] S19のジル信仰心、S21の非公開シェリム不使用は既存試験を照合する。S20の行動カード魔詩を人物能力の魔詩と取り違えない。
- [x] S24の回収、S25のチャム贈与、S30の異界と祈願/啓示、S07/S10〜13/S22〜23の旧監査指摘を現行コードに照合する。抽象例S13は与えられた数値の解決器検査と印刷カードの成立検査を分ける。既存の個別受け入れを同期（再監査なし）: [S24/S25](../../operations/evidence/2026-09-09-r5-s24-s25.json)、[S30](../../operations/evidence/2026-09-09-r5-s30.json)、[S06〜S10](../../operations/evidence/2026-09-09-r5-s06-s10.json)、[S11〜S17](../../operations/evidence/2026-09-09-r5-s11-s17.json)、[S22/S23](../../operations/evidence/2026-09-09-r5-s22-s23.json)。
- [x] 能力禁止×継続値×復活、回収×取消×補充、全体多段×反撃×従者×同時死亡を固定乱数で試す。[実反撃の証跡](../../operations/evidence/2026-09-10-r6-canonical-counter-deaths.json)でBからAへの1hit7と親B残14/C従者差引18の同時死亡を確認。[Liaの実死亡・復活・新祝福](../../operations/evidence/2026-09-10-r6-canonical-lia-life.json)、[取消・OPEN・再構成](../../operations/evidence/2026-09-10-r6-canonical-recovery-dawn.json)も別の実操作列で確認。
- [x] 到達可能な状態列で220枚保存・二重所属なし・拒否時不変・保存復帰の同値・未解決処理がない安定時の終了判定を検証する。合法な入力待ちを「停止バグ」と誤判定しない。

R6の現在候補の122具体参照は[統合実行証跡](../../operations/evidence/2026-09-10-r6-candidate-run.json)に紐付けた。Engine45/DO47/browser40成功。これらのチェックは記載した動作の検証であり、全条項acceptedや独立レビューを意味しない。[残る依存状態](../../operations/evidence/2026-09-10-r6-dependency-status.json)は未完として保持する。

## Task R7: 正式開始と一戦の完了を接続する

**Files:** `packages/catalog/src/selected/index.ts`, `packages/catalog/test/catalog.test.ts`, `apps/worker/src/rooms/room.ts`, `apps/worker/test/lobby.test.ts`, `tests/e2e/invite-game.spec.ts`
- Create: `tests/e2e/full-game.spec.ts`, `tests/e2e/failure-recovery.spec.ts`

**Interfaces:** 検証済み台帳からカタログの `implementation` を決め、既存 `assertPlayableCatalog(entries)` を維持する。正式STARTは通常の認証済みルームコマンドを通す。

- [x] pending・条項欠落・不正なtested指定を拒否するカタログ試験を先に書き、全件acceptedの候補だけが通るように接続する。文字列を一括でtestedへ変更しない。判定接続と拒否検証は[readiness証跡](../../operations/evidence/2026-09-10-r7-catalog-readiness.json)。受け入れ済み候補は `packages/catalog/src/selected/readiness.json` の `ready: true` と `packages/catalog/test/catalog.test.ts` の playable 検査。
- [x] 卓主・必要人数・全員準備・同時START・古いrevision・途中参加拒否を通常APIで検証する。テスト用状態投入を使わず、招待→準備→正式STARTを通す。[lobby.test.ts](../../../apps/worker/test/lobby.test.ts) の `R7 %i authenticated seats keep rejected concurrent START and stale readiness from creating a game` と `R7 %i seats start a real game through the normal START command when readiness is ready`（4/6/8/10）。
- [x] 4/6/8/10の独立セッションで本人への投影と開始を確認し、固定条件の一戦を勝敗まで終える。途中全員切断、未ACK再送、終了後再読込、合意終了も確認する。[full-game.spec.ts](../../../tests/e2e/full-game.spec.ts) と [failure-recovery.spec.ts](../../../tests/e2e/failure-recovery.spec.ts)。
- [x] 完成候補を固定して全検査を一度通す。失敗は原因・修正・影響範囲を記録し、必要な関連検査を再実行する。未実施や失敗を一括成功と報告しない。[C5 記録](../../operations/evidence/2026-09-11-release-candidate.md)。`pnpm verify:catalog` の C11 重複見出しと gitignore 原本 PDF 欠落は D2 の freeze 変更にまとめる。

```bash
pnpm verify:catalog
pnpm verify:assets
python3 scripts/validate_runtime_coverage.py
pnpm typecheck
pnpm test
pnpm exec playwright test
pnpm build
```

全条項と正式開始が揃えばM2。人数別の一戦・終了・復帰・障害の自動試験の合格でM3。対人の通し対戦と時間・判断・操作性・例外裁定の確認は、公開後のM5で行う。

## Task R8: Cloudflare上で公開条件を確認する

**Files:** `apps/worker/wrangler.jsonc`, `apps/worker/src/rooms/storage.ts`, `docs/operations/deploy.md`, `recovery.md`, `assets.md`, `playtest-results.md`

- [ ] 既存配備手順に沿って、候補ビルド・アカウント・staging/production・D1/DO設定・素材の配信条件とクレジットを具体化する。認証が必要ならその段階で接続を依頼する。秘密値を文書に書かない。
- [x] 非互換なルール更新は別Workerへ分け、旧版の進行中卓を旧Workerで完了させる方針を具体化する。同一Worker内で実装済みの複数版があるとは扱わない。既存卓の版を勝手に書き換えない。[版分離の配備手順](../../operations/deploy.md#非互換なルール版の切り替え)にWorker/D1/origin分離、旧セッション・卓保持、切り替え失敗時の扱いを記載。方針の具体化のみ完了し、実配備・同時稼働の実測は未完。
- [ ] 認可された配備範囲でstagingを配備し、DO休止復帰、保存後ACK喪失、D1投影失敗、再デプロイ中の試合維持を実測する。
- [ ] 10人×10卓の負荷試験を行い、条件・遅延分布・失敗率・使用量を記録する。ローカル時間から料金を推定しない。
- [ ] 公開対象と同じ候補で最終確認し、productionへ配備する。URL、版、既知の制限、復旧方法、実施結果を残してM4。

## 工程管理と見積もり

- 能力件数ではなく、M0〜M5の完了条件で進捗を報告する。「実装済み」「受け入れ済み」「公開済み」を混ぜない。
- 次に着手するのはR0。R1完了後にR2を確定し、R3の短い操作確認を早めに行う。人間待ちで独立したルール実装を止める必要はない。
- R4→R5→R6→R7→R8が主な実装順序。R2の結果で依存が判明した場合は該当群の小計画を修正する。
- 先の「半日〜1日＋1〜2日」は見積もり確約として使わない。現状差分、全カードの残条項、対人確認と配備先検証が未確定なため、M0/M1で実測時間と残件から再見積もりする。
- 見積もりには、純実装、試験/レビュー修正、参加者/認証待ちを分けて記す。外部待ちを含む公開日を自動作業時間だけで約束しない。

## 再開時の読み順

1. `docs/checkpoints/2026-09-08-implementation.md`
2. この計画のR0とR1、および採用済みC15
3. `docs/operations/evidence/2026-09-08-replanning-checkpoint.json`
4. Task7yの現在の実装と旧報告を差分として読む。過去の成功報告から開始済み/完了済みを推測しない。

全履歴を最初から読み直す必要はない。原典の細部は担当群の採用裁定と実装台帳から辿る。

## 計画の確認結果

2026-09-08、[独立レビュー](../../checkpoints/2026-09-08-plan-review.md)で2指摘を修正し、未解決の必須指摘なし。文書リンク、候補25件の原典IDと重複、既存試験ファイルの参照を確認した。計画作業中の対象エンジン154ファイルに変更はない。これは計画の承認であり、R0の2件の失敗やTask7yの受け入れを完了させた記録ではない。
