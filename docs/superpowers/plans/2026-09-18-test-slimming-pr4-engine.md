# テストスリム化 PR4: engine / protocol のテストを振る舞い名で整理し、E2E の不安定な 2件を正す

> 親計画: [2026-09-18-test-slimming.md](2026-09-18-test-slimming.md) の「PR4」節。改名・統合の対応表、protocol の統合案、リスクは親計画に従う。このファイルはその節を実行するチェックボックスである。
> ブランチ: `mc-chinju/test-slim-engine`（base は PR3 のブランチ `mc-chinju/test-slim-worker`。stacked PR）。
> engine は仕様の正本なので、テストの中身（`it` の数と検証内容）は減らさない。変えるのはファイル名・置き場所・重複の解消だけ。`packages/*/src` と `apps/*/src` は変更しない。web の 44ファイルは触らない。

## 目的

作業名由来の engine テストファイル（`task7*` / `r5-*` / `r6-*` / `*-fix1` / `review-*` / `release-*` / `scenario-s*`）を振る舞い名に改名・統合し、`owned-reclaim` の個別版とマトリクス版の重複を解消する。protocol の 33ファイル（499行）をテーブル駆動の 5ファイルにまとめる。あわせて、PR3 で原因を特定した E2E 2件の不安定さ（テスト側の barrier 不足と閾値）を正す。

## 受入条件

1. `ls packages/engine/test | grep -E 'task7|^r5-|^r6-|fix1|review-|release-'` が 0件。
2. `owned-reclaim.test.ts` に個別版とマトリクス版が統合されている。
3. `ls packages/protocol/test | wc -l` が 6以下（`*.test.ts` は 5ファイル）。
4. engine と protocol の vitest 件数（`it` の実行数）が、統合前と同じか、重複除去分だけ減っている。減った `it` は、対応するマトリクス行または統合先の `it` を PR 本文の表に示す。
5. `pnpm typecheck` と `pnpm test` が成功する。
6. engine / protocol の src カバレッジ 4指標が親計画「基準値」表を下回らない。
7. `PLAYWRIGHT_PORT=18787 pnpm test:e2e` の全件実行を 3回行い、`blessing-privacy.spec.ts` と `public-record.spec.ts` が 3回とも成功する（`retries` は入れない）。
8. `docs/rules/coverage.md` のテストファイル名参照（22箇所）が新しい名前を指す。

## タスク

### 1. E2E の不安定な 2件（PR3 の切り分け結果に基づく。検証内容は変えない）

- [x] `tests/e2e/blessing-privacy.spec.ts`: `click()` が owner 席（seat 0）の revision だけを待っているため、`same()` が seat 2 / 3 の古い view を比べることがある。`same()` の直前に「比較対象の全席の revision が owner と揃うまで」の `expect.poll` を 1つ入れる（または `click()` の待ちを全席に広げる）
- [x] `tests/e2e/public-record.spec.ts`: `expect(audits).toBeGreaterThan(5)` は bot 対戦が 200手未満だと満たせない。「audit は 40手ごと＋最後に 1回」という構造から、`audits` の期待値を実際の `steps` から導く（`Math.floor(steps / 40) + 1` と一致すること）に変え、加えて `audits >= 2` を要求する。秘密が漏れないことの検証は変えない
- [x] 2 spec を `--repeat-each=3` で実行して全件成功、さらに全件実行を 3回行って 31/31 が 3回続くことを確かめる（commit 1）

### 2. engine の改名（中身は変えない）

- [x] 親計画 PR4 の対応表どおりに `git mv` する: `task7b-techniques` → `printed-techniques`、`task7c-magic-techniques` → `magic-techniques`、`task7d-rolls` → `rolls`、`task7e-status-defenses` → `status-defenses`、`task7f-lifecycle` → `lifecycle-outcomes`、`task7g-lifetime` → `lifetime-effects`、`task7h-abilities` → `character-abilities`、`task7i-combinations` → `combinations`、`r5-combinations-riders` → `combination-riders`、`release-character-predicates` → `character-predicates`、`release-lifecycle-bindings` → `transformation-ownership`。改名先が既にある場合（`combinations.test.ts` など）は、この commit では `-printed` 等の仮名にせず、次の統合 commit で扱う
- [x] 改名の前後で engine の vitest 件数が一致することを確かめる（commit 2）

### 3. engine の統合

- [x] `task7f-fix1` の R1/R2 を `lifecycle-outcomes` の終局・膠着の `describe` へ移す。`task7i-fix1` の 3つの `describe` を `combinations` へ移す。`r5-distance` を `distance` へ統合。`r6-combined-death` / `-recovery` / `-suppression` + `r6-scenarios` を `combined-scenarios` にまとめる。`review-regressions` の各 `it` を振る舞いの近いファイルへ移す。統合先に同じ `it` 名がある場合は検証内容を比べて片方を残す（commit 3）
- [x] `scenario-s*.test.ts`（11ファイル）を `original-scenarios.test.ts` にまとめ、対戦例番号で `describe` する（commit 3 に含める）
- [x] `owned-reclaim.test.ts`（個別）と `owned-reclaim-matrix.test.ts` を `owned-reclaim.test.ts` に統合する。個別版の `it` のうち、マトリクスの行と同じ入力・期待のものを削り、マトリクスに無い入力だけを残す。削った `it` とその対応行の表を作業記録に残す（commit 4）
- [x] 各統合 commit の後に vitest の JSON レポーターで件数とテスト名の差分を取り、減ったものが表で説明できることを確かめる

### 4. protocol の統合

- [x] 親計画の案どおり `validation.test.ts`（既存）、`commands-combat.test.ts`、`commands-followers.test.ts`、`commands-abilities.test.ts`、`room-messages.test.ts`（既存）の 5ファイルにまとめる。各ファイルは `it.each([{ name, input, ok | error }])` のテーブル駆動にする
- [x] 統合前後で `it` の件数（テーブル行数）が減っていないことを JSON レポーターで確かめる（commit 5）

### 5. docs と検証

- [x] `docs/rules/coverage.md` のテストファイル名参照（22箇所）を新しい名前に置換する。`docs/implementation-progress.md` の「Current phase」に 1行追記する（commit 6）
- [x] 親計画 `2026-09-18-test-slimming.md` の PR4 節末尾に「実施済み: PR #<番号>」を 1行書く
- [x] `pnpm typecheck` と `pnpm test` が成功する
- [x] 親計画「共通: カバレッジの測り方」の unit コマンド（`--testTimeout=120000` 付き）で engine / protocol の 4指標を取り、基準値との比較表を作業記録に保存する（PR 本文に転記）

## commit 分割（この順）

1. `test: E2Eの席間同期とbot対戦の手数依存を正す`
2. `test: 作業名のengineテストを振る舞い名に改名する`（`git mv` だけ）
3. `test: 同じ振る舞いのengineテストを統合する`
4. `test: 回収の個別試験をマトリクスへ統合する`
5. `test: protocolの入力検証をテーブル駆動にまとめる`
6. `docs: ルール網羅表のテストファイル名を更新する`

## 検証コマンド

```bash
ls packages/engine/test | grep -E 'task7|^r5-|^r6-|fix1|review-|release-'   # 0件
ls packages/protocol/test | wc -l                                          # 6以下
pnpm exec vitest run packages/engine packages/protocol --reporter=json --outputFile=.cache/unit-after.json
pnpm typecheck && pnpm test
PLAYWRIGHT_PORT=18787 pnpm test:e2e   # 3回
```

## 実装で変えた点

- protocol の統合は **`it` を書き換えずに移設だけ**行い、テーブル駆動への書き換えはしなかった。
  「`it` の検証内容は変えない」を優先したため。`{ name, input, ok | error }` の表に収まらない検証が実在する:
  コピー（同一性）検査（`parsed.value.sources !== input.sources` など）、getter を実行しないことの検査
  （呼び出し回数カウンタ）、`Object.create(null)` / symbol / 非列挙プロパティなどの入力構築。
  元ファイル単位の `describe` で包んで 5ファイルにまとめた。受入条件 3 と 4 はこの方法で満たしている。
- engine の統合でも、トップレベル名の衝突を避けるために `describe` で包んだファイルがある
  （`combined-scenarios` / `original-scenarios`）。`it` のタイトルと本文は変えていない。
- 重複していたローカル補助関数だけは集約・改名した:
  `task7f-fix1` の `top()` → 本文が一致する既存 `takeTop()`、`task7i-fix1` の `prepared()` / `rejected()` →
  既存の同値な定義、`owned-reclaim` の `nextOwnAction` → `nextOwnTurn`（helpers の同名 export との衝突）、
  マトリクスの `finishOwnedResolution as finish` → `as finishOwned`（combat-helpers の `finish` との衝突）。
- `docs/rules/coverage.md` の置換は 20箇所だった（計画の見積りは 22箇所）。置換後、この文書が挙げる
  `*.test.ts` がすべて実在することを確認している。
- 親計画への「実施済み: PR #<番号>」は、この repo の前例（PR3 は先に番号を書き、作成後に `#10` へ直した）に従い
  **次に払い出される番号 `#11`** で書いた（現在の最大番号は PR #10、open な issue は 0件）。PR 作成時に実番号を確認し、
  違っていれば `docs: 親計画のPR4実施済み番号を#N に直す` で直す。

## 判断済み事項

- `it` の検証内容は変えない。改名・移動・重複除去だけ。
- E2E 2件の修正は barrier と期待値の導き方だけで、検証の意図（2卓の view 一致、秘密が漏れない）は変えない。`retries` は入れない。
- 作業用のスクリプトと JSON はリポジトリに置かない。
