# テストスイートのスリム化 計画（PR1〜PR4）

> 状態: 計画のみ。実装はユーザーの承認後に行う。
> このファイルのチェックボックスは、このブランチ（`mc-chinju/feature-close-test`）で実装する **PR1 だけ**を対象にする。
> PR2〜PR4 は別ブランチ・別実行で行うため、手順は番号付きの一覧で書き、各 PR の着手時にその節を元にチェックボックス付きの計画ファイルを作る。

## 目的

実装約1.2万行に対し、テストとフィクスチャが約4.7万行ある。Worker 層と E2E 層の大半は、engine で検証済みのシナリオを同じように再実行している。これを削り、保守できる規模にする。

- 台帳ゲート（hash で縛られた 20MB の台帳）を build から外し、`pnpm build` が通る状態に戻す（PR1）。
- E2E を 2,173件から 30件以下にする（PR2）。
- Worker テストを 215ファイルから10ファイルにし、engine からアプリのテスト資産への逆向き依存を解消する（PR3）。
- engine と protocol のテストファイルを、作業名ではなく振る舞い名で整理する（PR4、優先度低）。

原作ルール・ゲーム挙動・公開 API は変えない。変更してよいのはテスト、テスト用資産、build スクリプト、docs だけ。

## 受入条件（シリーズ全体）

1. PR1: `pnpm build` と `pnpm test` が成功する。`verify:readiness` は build から外れる。`packages/catalog/src/selected/readiness.json` は `ready: true` のまま残り、`assertPlayableCatalog` の挙動は変わらない。タグ `ledger-accepted-2026-09-15` が `1dd5eb9a` を指す。
2. PR2: `pnpm exec playwright test --list` が 30件以下。`*-physical.spec.ts` が 0件。worker∩e2e 機能の engine 側照合表があり、`needs-port` の行はすべて engine テストへ移植済み。`apps/web/src` に現れる card ID リテラル（`[ac]N-pNN-rNcN…`）が、すべて `apps/web/test` のいずれかのファイルに現れる。
3. PR3: `apps/worker/test/*.test.ts` が 15ファイル以下。`git grep "apps/worker/test/fixtures" -- packages` が 0件。未使用のフィクスチャが残っていない。PR2 から送られた「`pnpm test:e2e` で残した 30件が全件成功する」もここで満たす。
4. PR4: engine テストのファイル名に `task7` / `r5-` / `r6-` / `fix1` / `review-` / `release-` を含むものが無い。`owned-reclaim` の個別版とマトリクス版が統合されている。protocol テストが 6ファイル以下。
5. 各 PR の前後で、engine（`packages/engine/src`）と protocol（`packages/protocol/src`）のカバレッジ（lines / statements / functions / branches）が PR1 で取った基準値を下回らない（worker は計測不能。下記「共通: カバレッジの測り方」）。
6. 各 PR で `pnpm typecheck` と `pnpm test` が成功する。PR2 と PR3 では、残した E2E が全件成功する。

## 調査で確かめたこと（計画の前提）

- `packages/catalog/src/selected/index.ts:1` が `readiness.json` を import し、`implementation: readiness.ready ? 'tested' : 'pending'`（126/162/187行）と `assertPlayableCatalog`（355行、`ready !== true` なら START 時に throw）で**実行時に使っている**。そのため、ファイルは消さずに静的な値として残す。
- 台帳を読むのは scripts だけ。`data/second-edition/runtime-obligations.json`（10MB）も台帳スクリプト専用。`validate_second_edition.py` は台帳を読まない。
- `docs/operations/evidence` には追跡対象が 5,733ファイル（37MB）ある。うち `acceptance/` 配下が 5,257。直下は 477エントリ。`1dd5eb9a` 以降、evidence、data、台帳スクリプトに変更は無い（`scripts/load_test.ts` だけ変更）。
- 台帳専用の scripts は 21ファイル・3,184行。`pnpm test` は `test_prepare_assets.py` だけを実行し、台帳系の Python テストは含まない。
- ルートと worker のどちらにもカバレッジ用パッケージが入っていない。worker は `@cloudflare/vitest-pool-workers` を使うため、istanbul プロバイダが必要。
- E2E の状態投入は `apps/worker/test/fixtures/e2e-worker.ts`（304行、`test/wrangler.e2e.jsonc` の main）が担う。ここが約60個の `is*Scenario` と entropy の場合分けを import しているため、現在は 207フィクスチャのうち 205 が参照されている。
- worker のテストは `openTestRoom`（`fixtures/recovery-room.ts`）で DO を直接初期化する。`restart()` の対象は `evictDurableObject`。
- UI パネルは `apps/web/src/game/*Panel.tsx` に 25種ある。web の vitest（44ファイル）は Ability / BeastCapture / Combination / ConditionalAbility / FollowerAttack / FollowerBundle / Information / Lifecycle / Lifetime / MagicGate / Reclaim / Result / Suppression の各パネルを単体で持つ。AllArmy / SadLove / ShadowJump / VirtualBlade / TurnTechnique / TurnChoiceCard / Wish / Roll / Reaction / TurnCard / Anytime には web 単体テストが無い。
- 台帳の accepted 5,257行のうち、engine テストだけを根拠にする行が 5,124。3層すべてを根拠にする行が 128、engine＋worker が 4、worker だけが 1（`ruling:G11#semantic/disconnect-alarm-preserves-explicit-replies`。PR3 で残す `room-reclaim-disconnect.test.ts`）。カード1枚ごとの条項検証は engine テストに残る。
- `apps/web/src` には card ID リテラルによる分岐が 98種・20ファイルにある（`AbilityPanel.tsx` 41、`lifetime-input.ts` 21、`conditional-ability-input.ts` 8、`commands.ts` 8 など）。うち 34種は `apps/web/test` のどのファイルにも現れず、現状は E2E だけが通している可能性がある。`apps/worker/src` には card ID リテラルが無い。
- 重複の予備集計（`-physical` 接尾辞を同一視した場合。作業記録 `layer-overlap.json`）: worker∩e2e は 199機能。うち engine に同名があるのは 159、無いのは 40（接尾辞を区別すると 58）。40件のうち 24件は、engine テストも import しているシナリオモジュールを使う。残る 16件（abilities, basic-attachments, blessing-identity, blessing-privacy, combinations, death-rewards, lia-prayer, lifecycle, ordinary-follower-death, r6-combinations, reclaim, reclaim-aliases, reflect-limits, scenario-s11-s12, scenario-s27, suppression）は `game-scenarios.ts` の名前付きシナリオを使うため、振る舞い単位の照合が要る。

## PR 間の依存と順序

```
PR1（台帳切り離し・カバレッジ基準）
  └─ PR2（E2E 削減・58機能照合と engine 移植）
        └─ PR3（fixtures 移設・Worker 削減・e2e-worker の注入経路整理）
              └─ PR4（engine/protocol 整理、低優先）
```

- PR1 を最初に行う。台帳の freeze policy が残っていると、1ファイル変えるだけで検証が全滅し、build も通らない。
- PR2 ではフィクスチャを動かさない。残す E2E は引き続き `apps/worker/test/fixtures/game-scenarios.js` と `e2e-worker.ts` を参照する。PR2 の差分を「E2E の削除と engine への移植」に絞るため。
- 58機能の照合は PR2 で worker と e2e の両方について行い、移植も PR2 で済ませる。PR3 では照合済みの前提で worker を削る。
- フィクスチャの移設は PR3 で行う。移設先の import を直すのは engine 172ファイル、残す worker テスト、`e2e-worker.ts`、`tests/e2e/helpers.ts`。PR2 で E2E が減っているので、PR3 で直す E2E 側の import は `helpers.ts` と残す spec だけになる。
- PR4 は PR3 の移設後に行う。先に改名すると、移設の import 置換と衝突する。

## 共通: カバレッジの測り方（PR1 で導入し、各 PR で使う）

```bash
# engine / protocol / catalog / web（v8）
pnpm exec vitest run --coverage.enabled --coverage.provider=v8 \
  --coverage.include='packages/engine/src/**' --coverage.include='packages/protocol/src/**' \
  --coverage.reporter=json-summary --coverage.reportsDirectory=.cache/coverage/unit
```

- `--testTimeout=120000` を付ける。計測の負荷で `bot-legal-commands.test.ts` の 8席・10席が既定の時間内に終わらない。
- worker（`@cloudflare/vitest-pool-workers@0.22.0`）では `@vitest/coverage-istanbul@4.1.0` が `TypeError: template is not a function`（provider.js の requireVisitor）で起動できず、v8 も使えない。worker src のカバレッジは計測しない。PR3 では、`apps/worker/src` の各 export 関数が残すテストから到達することをレビュー観点で確認する。

### 基準値（PR1、base `2c5797d4`、2026-09-18 取得。8,012件すべて成功）

| 対象 | lines | statements | functions | branches |
|---|---|---|---|---|
| `packages/engine/src` | 97.53 | 94.81 | 98.42 | 92.80 |
| `packages/protocol/src` | 98.67 | 96.59 | 100.00 | 97.89 |

- `.cache/` は gitignore 済み。結果の `coverage-summary.json` の `total` を、PR の説明に基準値との比較表として貼る。
- 判定: engine src と protocol src の4指標がすべて基準値以上なら合格。下がった場合は、該当する src 行を通るテストを戻すか、代表シナリオを追加する。ファイル単位で戻す必要はない。

---

## PR1: 台帳ゲートの切り離し（このブランチで実装する）

### 方針: アーカイブではなく削除し、タグで残す

- 台帳は `1dd5eb9a` のツリー全体の hash に束縛されている。台帳を HEAD に残してもその後の変更で必ず不一致になり、アーカイブとして意味を持たない。そこで `1dd5eb9a` に注釈付きタグ `ledger-accepted-2026-09-15` を打ち、「全条項 accepted の証跡」はタグから `git show` / `git checkout` で参照する。
- 作業ツリーからは、台帳 2ファイル（30MB）、証跡 5,733ファイル（37MB）、台帳専用 scripts 21ファイルを削除する。
- `readiness.json` は削除せず、`{"ready": true, ...}` のまま静的ファイルとして残す（catalog が実行時に参照するため）。生成器を消すので、以後は手で書き換えない限り変わらない。deploy.md に「タグ時点の値で固定」と注記する。
- 過去の記録（`docs/checkpoints/*`、`docs/superpowers/plans/*`、`decision-*-2026-09-10.md`、`release-run-handoff-2026-09-12.md`）は当時の記録なので書き換えない。証跡へのリンクは切れるが、`acceptance-policy.md` の冒頭にタグでの参照方法を書いて補う。

### 削除対象の一覧

- data: `data/second-edition/runtime-coverage.json`、`data/second-edition/runtime-obligations.json`
- docs: `docs/operations/evidence/` 全体（5,733ファイル）
- scripts（本体 12）: `validate_runtime_coverage.py`、`generate_catalog_readiness.py`、`apply_ledger_bindings.py`、`build_character_bindings.py`、`build_owned_reclaim_bindings.py`、`build_scenario_bindings.py`、`generate_acceptance_receipt.py`、`ledger_report.py`、`promote_ledger.py`、`record_runtime_run.py`、`run_candidate.sh`、`runtime_coverage_ast.cjs`
- scripts（テスト 9）: `test_apply_ledger_bindings.py`、`test_build_character_bindings.py`、`test_build_owned_reclaim_bindings.py`、`test_build_scenario_bindings.py`、`test_generate_catalog_readiness.py`、`test_ledger_report.py`、`test_promote_ledger.py`、`test_record_runtime_run.py`、`test_validate_runtime_coverage.py`
- 残すもの: `validate_second_edition.py`、`prepare_assets.py` とそのテスト、`import_resources.py`、`inspect_*.py` とそのテスト、`load_test.ts`、`requirements-assets.txt`

### docs の更新範囲

- `docs/operations/acceptance-policy.md`: 冒頭に「2026-09 に台帳ゲートを廃止。`acceptance-policy/test-only-v1` による受け入れはタグ `ledger-accepted-2026-09-15`（`1dd5eb9a`）で凍結」と、`git show ledger-accepted-2026-09-15:data/second-edition/runtime-coverage.json` での参照方法を追記する。本文は歴史的記録として残す。
- `docs/operations/deploy.md`: 49行と56行の `generate_catalog_readiness.py --check --require-ready` を削除する。「build 成功だけを公開可能の証拠にしない」は、受け入れ基準を `pnpm test` と残した E2E に置き換える。101行と151行の evidence リンク、158〜162行の候補記録のパスはタグ上のパス表記にする。`readiness.json` はタグ時点の値で固定と注記する。
- `docs/implementation-progress.md`: 「Current phase」に、台帳ゲートの廃止とテストスリム化計画（このファイル）への参照を1段落で追記する。過去の件数表は変更しない。
- `docs/operations/playtest-results.md`: 85行と98行の evidence リンクを、タグ上のパスに書き換える。件数の記述は当時の実測なので変更しない。
- `docs/operations/recovery.md`: 43行の `evidence/2026-09-10-legacy-beneficiary-resume.md` へのリンクを、タグ上のパスに書き換える。
- `docs/operations/playtest-guide.md`: 38行は `tests/e2e/combat.spec.ts` への参照。PR1 では変えない（PR2 で扱う）。
- 実装中の追記（2026-09-18）: 上記の5ファイル以外に、`docs/rules/coverage.md` にも evidence への相対リンクが 10箇所あった（1233〜1271行）。これらは歴史的記録ではなく現行のルール網羅表なので、同じ規則でタグ上のパス表記へ書き換えた。`playtest-results.md` の 7行にも同種のリンクがあったため、85・98行と合わせてファイル内の 18箇所すべてを書き換えた。件数・測定値の記述は変更していない。

### 見込み規模と commit 分割

合計: 約5,770ファイル（ほぼ削除）、scripts −3,184行、data と evidence −67MB、追加・変更は数十行。

1. `build: 台帳検証をbuildから外す`（package.json の `build` と `verify:catalog`）
2. `chore: 台帳と受け入れ証跡・台帳スクリプトを削除する`（data 2、evidence、scripts 21）
3. `docs: 台帳ゲート廃止とタグでの参照方法を記す`（acceptance-policy、deploy、implementation-progress、playtest-results、recovery）
4. `test: カバレッジ計測用の依存を追加する`（ルートに `@vitest/coverage-v8@4.1.0`、worker に `@vitest/coverage-istanbul@4.1.0`、lockfile）

### タスク

- [x] 作業前の `pnpm test` を実行し、失敗があれば既存の失敗として記録する（作業記録の保存先へ）
- [x] `git tag -a ledger-accepted-2026-09-15 1dd5eb9a -m "全条項 accepted の台帳と証跡（acceptance-policy/test-only-v1）"` をローカルに作成する（既にあれば、指す commit が `1dd5eb9a` であることを確かめる）
- [x] `package.json` の `build` から `pnpm verify:readiness &&` を外し、`verify:readiness` スクリプトを削除し、`verify:catalog` を `python3 scripts/validate_second_edition.py` だけにする（commit 1）
- [x] 上記「削除対象の一覧」の data 2ファイル、`docs/operations/evidence/`、scripts 21ファイルを `git rm` する（commit 2）
- [x] `git grep -n "validate_runtime_coverage\|generate_catalog_readiness\|runtime-coverage\|runtime-obligations\|run_candidate\|record_runtime_run\|promote_ledger" -- ':!docs/checkpoints' ':!docs/superpowers' ':!docs/operations/decision-*' ':!docs/operations/release-run-handoff-2026-09-12.md'` が、この後の docs 更新対象以外で 0件であることを確かめる
- [x] `readiness.json` が変更されておらず、`packages/catalog/src/selected/index.ts` に差分が無いことを確かめる
- [x] 「docs の更新範囲」どおりに acceptance-policy / deploy / implementation-progress / playtest-results / recovery を更新する（commit 3）
- [x] ルートに `@vitest/coverage-v8@4.1.0`、`@madou/worker` に `@vitest/coverage-istanbul@4.1.0` を devDependency として追加する（commit 4）。istanbul は pool-workers 0.22 では `TypeError: template is not a function` で起動できない（上記「共通: カバレッジの測り方」に記録）。計測には使えないが、`--coverage.provider=istanbul` を指定したときにしか読み込まれず `pnpm test` には影響しないため、pool-workers を上げたときに PR3 で再試行できるよう宣言だけ残す
- [x] `apps/web/src` と `apps/web/test` の card ID リテラルの差集合（現状 34種）を取り、作業記録の保存先に `web-card-ids.json` として保存する（PR2 の入力）
- [x] 「共通: カバレッジの測り方」の2コマンドで基準値を取り、両方の `coverage-summary.json` の `total` を作業記録の保存先に `coverage-baseline.json` として保存する（worker の istanbul が pool-workers で動かない場合は、その旨とエラーを記録し、engine の基準値だけで進める）
- [x] `pnpm build` が成功することを確かめる
- [x] `pnpm typecheck` と `pnpm test` が成功することを確かめる（typecheck 成功。unit 8,012件成功、assets 7件成功。worker は全215ファイル同時実行（31分）で `room-black-bow-physical` / `room-fury-reflection` / `room-mercenary-physical` / `room-named-follower-death-negative` の 6件が 150〜316秒の遅延で失敗したが、この4ファイルの単独実行では 46件すべて成功（41秒）。PR1 は worker のソース・テストを変更していないので、負荷起因の既存の不安定さとして記録する。この4ファイルは PR3 の削除対象）

### 検証

```bash
pnpm build
pnpm typecheck
pnpm test
git tag -l ledger-accepted-2026-09-15 --format='%(objectname) %(*objectname)'   # *objectname が 1dd5eb9a…
git show ledger-accepted-2026-09-15:data/second-edition/runtime-coverage.json | head -c 100
```

### リスクと戻し方

- 台帳の再検証ができなくなる → タグを checkout すれば、当時のスクリプトと台帳で `python3 scripts/generate_catalog_readiness.py --check` を再実行できる。
- タグを push し忘れると、ローカルにしか証跡が残らない → 引き継ぎで push を必須にする。
- `@vitest/coverage-istanbul` が pool-workers 0.22 で動かない → worker は `apps/worker/src` の関数ごとの到達テストを PR3 のレビュー観点に置き換える。依存の追加は commit 4 だけを revert すれば戻る。
- 戻し方: PR を revert する（削除はすべて git 履歴とタグに残る）。

---

## PR2: E2E を 30件以下にする（別ブランチ・別実行）

### 残す基準

「ブラウザでしか確認できないこと」に限る。具体的には、実画面の操作、再読込での復元、複数タブ・複数席の同期、HTTP / WebSocket 本文の秘匿、ログイン、フォーカスやタッチの操作性。ルールの結果そのものは engine が正本なので、E2E では確認しない。

### 残すファイルとテスト（計30件）

中核（15件）:

| ファイル | 残すテスト | 件数 |
|---|---|---|
| `full-game.spec.ts` | `for (const count of [4])` に絞る（4人同期で終局まで） | 1 |
| `invite-game.spec.ts` | 招待参加・開始・再読込 | 1 |
| `login.spec.ts` | 3件すべて | 3 |
| `passkey-login.spec.ts` | 1件 | 1 |
| `lifecycle.spec.ts` | `a real final death shows a persisted result to winners and the defeated player`（ResultPanel） | 1 |
| `failure-recovery.spec.ts` | 1件 | 1 |
| `reconnect.spec.ts` | 3件すべて（再読込で復元、ACK 喪失時の再送、2つ目のタブ） | 3 |
| `privacy.spec.ts` | 2件すべて（4画面と JSON/WS 本文の秘匿、キーボード・タッチ・スマホ幅） | 2 |
| `blessing-privacy.spec.ts` | 1件 | 1 |
| `sad-love.spec.ts` | `for (const choice of ['aura'])` に絞る（web 単体テストの無いパネル） | 1 |

パネル種別ごとの代表（15件。web 単体テストの無いパネルを優先し、あるパネルは秘匿か再読込の組合せで1本）:

| パネル群 | ファイル / 残すテスト |
|---|---|
| ReactionPanel | `reaction-controls.spec.ts` / `defender can explicitly choose the dedicated counter effect` |
| RollPanel | `rolls.spec.ts` / `a roll can be rerolled after reload without revealing another player’s threshold` |
| AbilityPanel | `abilities.spec.ts` / `a concealed ability remains private after reload and Fate cancels it without refunding its cost` |
| ConditionalAbilityPanel | `conditional-abilities.spec.ts` / `${scenario}: actual ON/OFF controls…` を先頭の1シナリオに絞る |
| CombinationPanel | `combinations.spec.ts` / `Beast King explicitly combines two physical cards and displays the accepted pair after reload` |
| FollowerAttack / FollowerBundle | `fury-reflection.spec.ts` / 1件 |
| MagicGate / FollowerEditor | `followers.spec.ts` / `canceling a declared Gate after reload keeps both paid cards spent and the hidden target in place` |
| BeastCapturePanel | `beast-capture.spec.ts` / `earned capture survives reload and offers only the owner an unchecked subset of actual beasts` |
| Reclaim / TurnCard / Anytime / InformationHistory | `reclaim.spec.ts` / `named anytime ${kind} …` を1種類に絞る |
| Inspection（情報確認） | `turn-information.spec.ts` / `${entry.scenario} shows only the owner …` を先頭の1件に絞る |
| SuppressionPanel | `blessing-status.spec.ts` / `actual confusion remains after Blessing across all-seat reload` |
| Lifecycle（儀式・変身） | `lifecycle.spec.ts` / `Dia can explicitly hand the ritual to revealed Uonos during a lifecycle boundary` |
| LifetimeDecisionPanel | `lifetime-techniques.spec.ts` / `Soul drain keeps its explicit choice after reload and can choose stat loss instead of death` |
| AllArmyPanel | `all-army.spec.ts` / 先頭の mode 1つ |
| VirtualBladePanel | `virtual-blades.spec.ts` / `virtual-blade-ice cancel=false …` |

- 残すファイルは 24 spec と `helpers.ts`、`bot-client.ts`（full-game / failure-recovery / load_test が使う）、`tsconfig.json`。
- E2E に代表を置かないパネル: ShadowJump / TurnTechnique / TurnChoiceCard / Wish。engine と PR3 で残す worker の汎用再送テストで担保し、PR の説明に明記する。30件の枠内で入れ替えてもよい（入れ替える場合は同数を削る）。
- 絞り込み後に `playwright test --list` が 30件を超えたら、パネル代表のうち web 単体テストがあるものから削る。
- `docs/operations/playtest-guide.md:38` の `tests/e2e/combat.spec.ts` 参照は、削除に合わせて `full-game.spec.ts` へ書き換えるか、比較基準の記述ごと「過去の測定（タグ参照）」にする。

### 58機能の engine 側照合（削除前に必ず行う）

1. 対象の抽出: `apps/worker/test/room-<name>.test.ts` と `tests/e2e/<name>.spec.ts` の両方にあり、`packages/engine/test/<name>.test.ts` にも `<name>-physical.test.ts` にも無い `<name>` を列挙する（接尾辞を区別すると 58、同一視すると 40。58件すべてを対象にする）。
2. シナリオの抽出: 各ファイルから `openTestRoom('…')` と `tableFixture(…, '…')` の引数、および `it.each(<x>Scenarios)` で使うシナリオ配列を集める。
3. 照合（シナリオ単位）。次のどれかに当てはまれば `covered`:
   - a. そのシナリオ配列や名前を、engine テストが `it.each` か直接呼び出しで使っている。
   - b. `game-scenarios.ts` の定義から分かる対象カード / 能力 ID（例 `a2-p01-r3c2`、`c2-p02-r2c2-ab01`）を engine テストが実際の遷移で使い、worker / e2e と同じ最終状態（ダメージ、手札・捨て札、公開範囲、選択肢、ステータス）を検証している。
4. 次のどちらかなら `worker-only`（engine に移植しない）: 検証内容が永続化・再起動・再送・WebSocket 投影だけである。または PR3 の汎用テスト（再起動と再送の冪等性、参加者ごとの秘匿）に代表として入れる。
5. 上記以外は `needs-port`。worker テストが検証する最終状態のうち、envelope・restart・revision に関係しない部分を、振る舞いが最も近い既存の engine テストファイル（例: suppression → `suppression-blessing.test.ts`、reclaim → `owned-reclaim.test.ts`）へ `makeScenario` と `transition` を使う `it` として移す。
6. 照合表（機能、シナリオ、判定、根拠となる engine の `ファイル:テスト名`）を PR の説明に載せる。作業用のスクリプトと JSON はリポジトリに置かない。
7. 移植したテストが失敗した場合は、src を直さずにその機能の worker / e2e テストを削除対象から外し、不具合としてユーザーに報告する（挙動の変更は範囲外）。

### card 固有の UI 分岐を web 単体テストで担保する（削除前に必ず行う）

1. `grep -rhoE "'[ac][0-9]-p[0-9]{2}-r[0-9]c[0-9][^']*'" apps/web/src | sort -u` で src の card ID リテラルを列挙する（98種）。
2. 同じ grep を `apps/web/test` にかけ、差集合（現状 34種）を取る。
3. 差集合の ID ごとに、その分岐を持つファイルに対応する既存の web 単体テスト（`ability-panels` / `lifetime-input` / `conditional-ability-input` / `commands` / `information-input` など）へ、その ID を実際に通す `it` を追加する。追加先が無いファイル（`ActionSummary.tsx`、`Board.tsx`、`DispelFields.tsx`、`PrintedCombinationFields.tsx`）は、最も近いパネルのテストへ入れる。
4. 差集合が空になったことを同じ grep で確かめ、ID と追加先の一覧を PR の説明に載せる。

### 作業順序と commit 分割

1. `test: worker∩e2eのみの機能をengineで検証する`（needs-port の移植。移植が無ければこの commit は無い）
2. `test: card固有のUI分岐をweb単体テストで担保する`（上記の差集合 34種）
3. `test: 物理札のE2Eを削除する`（`*-physical.spec.ts` 107ファイル）
4. `test: engineで検証済みのE2Eを削除する`（残りの非 physical spec のうち、残す対象外の約90ファイル）
5. `test: 残すE2Eをパネル代表と中核シナリオに絞る`（24ファイル内のテスト削減）
6. `docs: E2Eの範囲と件数を更新する`（playtest-guide、implementation-progress の1行）

見込み: 約197ファイル削除（約8,000行）、約24ファイル変更、engine 追加 0〜数百行、web 単体テスト追加 約34 `it`。

### 検証

```bash
pnpm exec playwright test --list | tail -1     # 30 tests 以下
ls tests/e2e/*-physical.spec.ts 2>/dev/null | wc -l   # 0
pnpm typecheck && pnpm test
pnpm test:e2e                                  # 残す全件が成功（目安 30分以内）
# カバレッジ（engine src が基準値以上）
```

### 完了条件

受入条件 2、5、6。加えて、照合表の `needs-port` がすべて移植済みか、削除対象から外して報告済みであること。

### 実施済み: PR #8（2026-09-18）

E2E は 30件 / 24 spec。58機能・シナリオ 422行の照合はすべて `covered`（`needs-port` 0件）で、
engine への移植は発生しなかった。`apps/web/src` の card ID リテラル 34種は web 単体テストで担保済み。

受入条件4 のうち「`pnpm test:e2e` で残した全件が成功する」は**未達のまま PR3 へ送った**
（実測 27〜29/30。失敗の顔ぶれが実行ごとに入れ替わり、単独・少数では全成功、base でも同率で失敗する。
詳細は下の PR3 節「PR2 から送られた項目」）。

E2E に代表を置かなかったパネルの担保先: ShadowJump は engine の `attack-property-abilities.test.ts` ほか
（`c2-p04-r2c2-ab01`）、TurnTechnique は engine の lifetime 系と web `lifetime-input.test.ts`、
TurnChoiceCard は engine の手番カード試験、Wish は engine の `wish-physical-scenarios` を使う試験で、
いずれも再送・再起動の側面は PR3 で残す worker の汎用テスト（`room-command-replay.test.ts`）が担う。

### リスクと戻し方

- ブラウザ固有の退行（表示・操作）を見逃す → パネル代表と web 単体テストで補う。card 固有の UI 分岐は、削除前に web 単体テストで全 ID を通す（上記の工程）。消した spec は `git show <PR2 の親>:tests/e2e/<file>` で個別に戻せる。
- 照合の誤判定で engine に無いシナリオを失う → 判定 b は、状態の検証内容まで一致した場合に限る。迷ったら `needs-port` にする。
- 戻し方: commit 単位で revert する（2〜4 は独立している）。

---

## PR3: Worker を10ファイルにし、fixtures を engine へ移す（別ブランチ・別実行）

### 残す worker テスト（10ファイル）

| ファイル | 内容 |
|---|---|
| `auth.test.ts` | そのまま |
| `passkey.test.ts` | そのまま |
| `lobby.test.ts` | そのまま |
| `room-websocket.test.ts` | 参加者ごとの投影、revision / window の競合、ACK 再送、新しい接続の優先 |
| `room-storage.test.ts` | 永続化、eviction 後の再送、ロールバック |
| `room-recovery.test.ts` | 保留中の窓・判定の eviction 後の復元 |
| `room-reclaim-disconnect.test.ts` | 切断で自動パスしない |
| `room-lifecycle.test.ts` | 終局・膠着の永続化と再送 |
| `room-view-secrecy.test.ts`（新規統合） | `room-reveal-boundary`、`room-s21-secrecy`、`room-blessing-privacy`、`room-optional-activation-privacy` を、参加者ごとの view 秘匿の `it` 群としてまとめる |
| `room-command-replay.test.ts`（新規統合） | 汎用の「コマンドごとに `restart()` して同じ envelope を再送すると ack と保存状態が一致する」ヘルパーを1つ作り、代表シナリオ（`death-gift`、`amulet-refill`、`suppression-blessing`、`canonical-S04`（entropy が再送で呼ばれないこと。`room-canonical-scenarios` を吸収）、従者攻撃1つ、`r6-s26-revive`）で `it.each` する |
削除する worker テスト: 上記以外の `room-*.test.ts` 207ファイル（統合元4ファイルと `*-physical` を含む）。残りは既存8と新規2の計10ファイル。PR2 の照合で `worker-only` にした項目のうち代表でないものは、`room-command-replay` のシナリオに1つ加えるか、PR の説明に「汎用テストで担保」と書く。

### fixtures の移設と整理

1. 移設先は `packages/engine/test/fixtures/`（既存の JSON フィクスチャと同じ場所。`.ts` と `.json` は名前が衝突しない）。
2. 移すもの: `game-scenarios.ts` と、engine テスト・残す worker テスト・`e2e-worker.ts`・残す E2E のどれかから到達する `*-scenario(s).ts`。到達判定は、import グラフを辿るスクリプトで行う（PR1 の作業記録の方法）。`git mv` で移し、履歴を追えるようにする。
3. `suppression-scenarios.ts` にある `../../../../packages/engine/src/lifecycle/advance.js` は、`../../src/lifecycle/advance.js` に直す。
4. import を置換する対象: engine テスト（`../../../apps/worker/test/fixtures/X.js` → `./fixtures/X.js`）、`apps/worker/test/fixtures/recovery-room.ts` と `canonical-room.ts` と `e2e-worker.ts`（→ `../../../../packages/engine/test/fixtures/X.js`）、`tests/e2e/helpers.ts` と残す spec。
5. worker に残すもの: `recovery-room.ts`、`canonical-room.ts`（使われていれば）、`store-worker.ts`、`e2e-worker.ts`、`test-session.ts`、`schema.ts`、`webauthn.ts`、`raw.d.ts`。
6. `e2e-worker.ts` の整理: `/__test/rooms/:id/scenario` の許可リスト、`is*Scenario` の import、entropy の場合分けを、PR2 で残した E2E が使うシナリオだけに絞る（`playwright test --list` の対象 spec から `tableFixture` の引数を集めて決める）。`/__test/session`、メール捕捉、`/entropy`、`/game` は残す。
7. 未使用フィクスチャの削除: 手順 6 の後に import グラフを再計算し、どこからも到達しないシナリオモジュールを削除する。`pnpm typecheck` で確認する。

### PR2 から送られた項目: E2E の全件成功とセッション不安定さ

PR2（#8）で受入条件4 のうち「`pnpm test:e2e` で残した全件が成功する」が未達のまま送られた。
PR2 の実測は 27〜29/30 で、**失敗するテストの顔ぶれが実行ごとに入れ替わり**、単独・少数では全成功、
base（PR2 の親）でも同率で失敗する。PR2 の差分による退行ではない。PR3 で次を行う。

1. **セッション不安定さの切り分け。** 症状は `tests/e2e/helpers.ts` の `observe()` で
   `page.goto(table.url)` した後に盤面ではなくログイン画面が出るもの。`apps/web/src/session.ts` の
   `api()` にクライアント側タイムアウトは無いので、`/api/sessions/current` が実際に **401** を返している
   （`App.tsx:15` で `setSession(null)` → `LoginScreen`）。`tableFixture` の中では同じセッションで
   「ようこそ」まで出ているため、その後に無効化されている。
   `e2e-worker.ts` の `/__test/session` と `test-session.ts` の `createTestSession`
   （毎回 `DROP INDEX IF EXISTS user_name` してから better-auth でユーザーとセッションを作る）を
   手順 6 の整理と合わせて調べる。src の修正が要ると分かった場合は、範囲を分けて別途判断する。
2. **負荷の切り分け。** PR2 の実行中はロードアベレージが 11〜20 まで上がっていた（別ワークスペースの
   workerd 等が同時稼働）。他の作業を止めた状態で 1 回通し、負荷だけが原因かを確かめる。
3. **E2E 30件の通し全件成功を確認する。** これが PR3 の完了条件に加わる。
   `playwright.config.ts` の `retries` は、1・2 の切り分けが済むまで入れない。

### 作業順序と commit 分割

1. `test: シナリオfixturesをengineのテスト資産へ移す`（`git mv` と import 置換だけ。挙動・件数は不変。engine の vitest 件数が移設前と同じことを確かめる）
2. `test: 再起動と再送の冪等性を汎用テストにまとめる`（`room-command-replay.test.ts` の追加）
3. `test: 参加者ごとのview秘匿のWorkerテストを統合する`（`room-view-secrecy.test.ts` の追加と統合元4ファイルの削除）
4. `test: engineで検証済みのWorkerテストを削除する`（約200ファイル）
5. `test: E2E用のシナリオ注入経路を残す試験に絞る`（`e2e-worker.ts`）
6. `test: 未使用のシナリオfixturesを削除する`
7. `docs: Workerテストの範囲を更新する`（implementation-progress の1行、deploy.md のテスト用状態投入 API の記述が変わる場合だけ）

見込み: 207ファイル削除（約8,500行）、fixtures 約150ファイル移動（import 変更 約180ファイル、各1行）、未使用 fixtures の削除（数十ファイル、行数は移設後の到達判定で確定）、新規2ファイル 約300行、`e2e-worker.ts` −約200行。commit 1 は機械的な変更なので、レビューでは `git diff -M --stat` と import 行だけを見ればよい。

### 検証

```bash
git grep -n "apps/worker/test/fixtures" -- packages   # 0件
ls apps/worker/test/*.test.ts | wc -l                  # 15以下
pnpm typecheck && pnpm test
pnpm test:e2e                                          # PR2 で残した全件が成功
# カバレッジ（engine src と protocol src が基準値以上）
```

### 完了条件

受入条件 3、5、6。commit 1 の直後に、engine の vitest 件数が移設前と一致していること。
加えて、PR2 から送られた**受入条件4 の「`pnpm test:e2e` で残した全件が成功する」**
（上記「PR2 から送られた項目」）。

### リスクと戻し方

- worker src のカバレッジが下がる（room の分岐のうち、特定シナリオでしか通らないもの）→ 下がったファイルと行を summary から特定し、`room-command-replay` に代表シナリオを追加する。
- 移設で engine テストが worker 専用の型（`cloudflare:test` 等）を引き込む → 移すのはシナリオ定義だけ（`@madou/engine` / `@madou/catalog` にだけ依存することを確認済み）。DO を扱う `recovery-room.ts` は worker に残す。
- 戻し方: commit 1（移設）とそれ以外が独立しているので、削除 commit だけを revert できる。

---

## PR4: engine / protocol の整理（低優先・別ブランチ・別実行）

engine は仕様の正本なので、テストの中身（`it` の数と検証内容）は減らさない。変えるのはファイルの名前と置き場所、重複の解消だけ。web の 44ファイルは触らない。

### engine の改名・統合案

実装時に、各ファイルの `describe` / `it` 名を読んでから確定する。統合先に同じ `it` 名がある場合は、検証内容を比べて片方を残す。

| 現在 | 変更後 |
|---|---|
| `task7b-techniques.test.ts` | `printed-techniques.test.ts`（`techniques.test.ts` と重複する `it` は統合） |
| `task7c-magic-techniques.test.ts` | `magic-techniques.test.ts` |
| `task7d-rolls.test.ts` | `rolls.test.ts` |
| `task7e-status-defenses.test.ts` | `status-defenses.test.ts` |
| `task7f-lifecycle.test.ts` + `task7f-fix1.test.ts` | `lifecycle-outcomes.test.ts`（fix1 の R1/R2 は終局・膠着の `describe` へ） |
| `task7g-lifetime.test.ts` | `lifetime-effects.test.ts` |
| `task7h-abilities.test.ts` | `character-abilities.test.ts` |
| `task7i-combinations.test.ts` + `task7i-fix1.test.ts` | `combinations.test.ts`（fix1 の3つの `describe` をそのまま移す） |
| `r5-distance.test.ts` | `distance.test.ts` に統合 |
| `r5-combinations-riders.test.ts` | `combination-riders.test.ts` |
| `r6-combined-death.test.ts` / `-recovery` / `-suppression` + `r6-scenarios.test.ts` | `combined-scenarios.test.ts` |
| `review-regressions.test.ts` | 各 `it` を振る舞いの近いファイル（パリィ → `reaction-physical-boundaries.test.ts`、能力判定 → `character-abilities.test.ts`）へ移す |
| `release-character-predicates.test.ts` / `release-lifecycle-bindings.test.ts` | `character-predicates.test.ts` / `transformation-ownership.test.ts` |
| `owned-reclaim.test.ts`（171行） + `owned-reclaim-matrix.test.ts`（1,011行） | `owned-reclaim.test.ts` に統合。個別版の `it` のうちマトリクスの行と同じ入力・期待のものを削り、マトリクスに無い入力だけを残す |

- `scenario-s*.test.ts`（11ファイル、各5〜27行）は `original-scenarios.test.ts` にまとめる候補にする（対戦例番号で `describe`）。
- `docs/rules/coverage.md` にあるテストファイル名の参照（14箇所）を、新しい名前に置換する。

### protocol の統合案（33ファイル・499行 → 5ファイル）

- `validation.test.ts`（既存の共通検証）
- `commands-combat.test.ts`: attack-property / combination（task7i 含む）/ printed-combinations / received-defense / mental-* / named-ability-responses / shadow-jump / virtual-blades / zan / r5-commands
- `commands-followers.test.ts`: physical-followers / follower-bundles / follower-entry / dedicated-follower-attacks / dark-saint-ignore / beast-capture / all-army / maai-bundle
- `commands-abilities.test.ts`: task7h-abilities / conditional-stats / declaration-modifiers / suppression-blessing / cham-death-gift / lifecycle / lifetime-techniques / turn-information / sad-love / wish / dispel / reclaim
- `room-messages.test.ts`（既存）

各ファイルは `it.each([{ name, input, ok | error }])` のテーブル駆動にする。統合前後で `it` の件数（テーブル行数）が減っていないことを、vitest の JSON レポーターの件数で比べる。

### 作業順序と commit 分割

1. `test: 作業名のengineテストを振る舞い名に改名する`（`git mv` だけ。中身は変えない）
2. `test: 同じ振る舞いのengineテストを統合する`（task7f / task7i / r5 / r6 / review-regressions）
3. `test: 回収の個別試験をマトリクスへ統合する`
4. `test: protocolの入力検証をテーブル駆動にまとめる`
5. `docs: ルール網羅表のテストファイル名を更新する`

見込み: engine 約25ファイルの改名・統合（−約300行。主に owned-reclaim の重複分）、protocol 33 → 5ファイル（499 → 約350行）、docs 1ファイル。

### 検証と完了条件

```bash
ls packages/engine/test | grep -E 'task7|^r5-|^r6-|fix1|review-|release-'   # 0件
ls packages/protocol/test | wc -l                                          # 6以下
pnpm typecheck && pnpm test
# カバレッジ（engine src と protocol src が基準値以上）
```

受入条件 4、5、6。

### リスクと戻し方

- 統合で `it` を取りこぼす → commit 1 の後と各統合 commit の後に、vitest の JSON レポーターで件数とテスト名の差分を取る。減ったものは、マトリクスの行に対応があることを PR の説明に書く。
- 戻し方: commit 単位で revert する。

---

## 前提と判断（ユーザーに確認していないもの）

- アーカイブと削除の選択: **削除し、タグで残す**。理由は PR1 の方針に書いた（HEAD に置いても hash 不一致で証跡として使えない）。
- `readiness.json`: catalog が実行時に参照するので、**削除せず `ready: true` のまま固定**する。catalog の src には手を入れない。
- タグ名: `ledger-accepted-2026-09-15`（`1dd5eb9a` の commit 日）。
- 過去の記録（checkpoints、superpowers/plans、decision / handoff 文書）は書き換えない。切れるリンクは acceptance-policy.md の案内で補う。
- カバレッジ計測用に `@vitest/coverage-v8` と `@vitest/coverage-istanbul` を devDependency に追加する（テスト用のツールで、アプリの依存は増えない）。
- E2E の上限は 30件。4人以外の人数（6/8/10席）の full-game は削る。多人数は worker の `lobby.test.ts`（4/6/8/10席の START）と engine の `bot-full-game.test.ts` で担保する。
- Worker の目標は「約15」を上限にし、計画では 10ファイルにする。
- 58機能の照合で `needs-port` が見つかっても、移植は engine テストの追加に限り、src は変えない。移植したテストが失敗したら削除を保留して報告する。
- 実行時間の目安（E2E 30件で30分以内）は、既存記録（2,173件で約4.1時間、1件あたり約7秒に4ページ分の準備を加味）からの推定。

## 引き継ぎ

- この計画の承認をユーザーから得てから、01-implement で PR1 のチェックボックスに着手する。
- PR1 のブランチを commit して push し、PR を作成する（commit 分割は PR1 の節のとおり。メッセージは既存に倣い日本語の `build:` / `chore:` / `docs:` / `test:`）。
- タグ `ledger-accepted-2026-09-15` を origin へ push する（`git push origin ledger-accepted-2026-09-15`）。タグの push を PR のマージより前に行う。
- PR1 の独立レビュー。観点は、削除漏れと過剰削除、`readiness.json` と catalog が不変であること、docs のリンク。
- PR1 のマージ後、PR2 → PR3 → PR4 の順に、各節を元にしたチェックボックス付きの計画ファイルを別ブランチで作り、それぞれ実装・レビュー・PR を行う。
- CI workflow は無いので、各 PR の説明に `pnpm build` / `pnpm typecheck` / `pnpm test`（PR2・PR3 では `pnpm test:e2e` も）の結果とカバレッジの比較表を貼る。
