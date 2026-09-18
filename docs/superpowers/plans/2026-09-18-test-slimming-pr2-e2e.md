# テストスリム化 PR2: E2E を 30件以下にする

> 親計画: [2026-09-18-test-slimming.md](2026-09-18-test-slimming.md) の「PR2」節。残す基準・残すファイルとテストの表・照合の判定基準・リスクは親計画に従う。このファイルはその節を実行するチェックボックスである。
> ブランチ: `mc-chinju/test-slim-e2e`（base は PR1 のブランチ `mc-chinju/feature-close-test`。stacked PR）。
> PR2 ではフィクスチャ（`apps/worker/test/fixtures/*`）を移動・削除しない。worker テストも削除しない（PR3）。

## 目的

`tests/e2e` を 2,173件 / 221ファイルから 30件以下 / 24 spec にする。engine で検証済みのルール結果を E2E で再確認するのをやめ、ブラウザでしか確認できないもの（実画面の操作、再読込での復元、複数席の同期、本文の秘匿、ログイン、操作性）だけを残す。削除の前に、engine 側の照合と card 固有 UI 分岐の web 単体テストで検出力を移す。

## 受入条件

1. `pnpm exec playwright test --list` が 30件以下。`ls tests/e2e/*-physical.spec.ts` が 0件。
2. worker∩e2e のみの 58機能の照合表（機能、シナリオ、判定 `covered` / `worker-only` / `needs-port`、根拠となる engine の `ファイル:テスト名`）が PR 本文にあり、`needs-port` はすべて engine テストへ移植済み（移植テストが失敗したものは削除対象から外し、PR 本文で報告）。
3. `grep -rhoE "'[ac][0-9]-p[0-9]{2}-r[0-9]c[0-9][^']*'" apps/web/src | sort -u` の全 ID が `apps/web/test` のいずれかのファイルに現れる。
4. `pnpm typecheck` と `pnpm test` が成功する。`pnpm test:e2e` で残した全件が成功する。
5. engine / protocol の src カバレッジ（lines / statements / functions / branches）が親計画「基準値」表（engine 97.53 / 94.81 / 98.42 / 92.80、protocol 98.67 / 96.59 / 100.00 / 97.89）を下回らない。
6. ゲーム挙動・公開 API・`packages/*/src`・`apps/*/src` を変更しない。

## タスク

### 1. 照合（削除前）

- [x] worker∩e2e のみの機能 58件を列挙する（`apps/worker/test/room-<name>.test.ts` と `tests/e2e/<name>.spec.ts` があり、`packages/engine/test/<name>.test.ts` も `<name>-physical.test.ts` も無い `<name>`）
- [x] 各機能のシナリオ名（`openTestRoom(...)` / `tableFixture(..., '...')` の引数、`it.each(<x>Scenarios)` の配列）を集める
- [x] シナリオ単位で `covered` / `worker-only` / `needs-port` を判定する（判定基準は親計画 PR2「58機能の engine 側照合」3〜5。迷ったら `needs-port`）
- [x] `needs-port` を、振る舞いの最も近い既存 engine テストファイルへ `it` として移植する（`makeScenario` と `transition` を使う。src は変更しない）
- [x] 移植したテストが失敗した場合は src を直さず、その機能の e2e を削除対象から外し、作業記録に不具合として残す
- [x] 照合表を作業記録の保存先に `layer-reconciliation.md` として保存する（PR 本文に転記する。リポジトリには置かない）

### 2. card 固有の UI 分岐（削除前）

- [x] `apps/web/src` と `apps/web/test` の card ID リテラルの差集合を取る（PR1 時点で 34種）
- [x] 差集合の ID ごとに、その分岐を持つファイルに対応する既存の web 単体テストへ、その ID を実際に通す `it` を追加する（追加先が無い `ActionSummary.tsx` / `Board.tsx` / `DispelFields.tsx` / `PrintedCombinationFields.tsx` は最も近いパネルのテストへ）
- [x] 差集合が空であることを同じ grep で確かめ、ID と追加先の一覧を作業記録に保存する（PR 本文に転記）

### 3. 削除と絞り込み

- [x] `tests/e2e/*-physical.spec.ts`（107ファイル）を `git rm` する
- [x] 親計画の「残すファイルとテスト」表にある 24 spec と `helpers.ts` / `bot-client.ts` / `tsconfig.json` 以外の spec を `git rm` する
- [x] 残す 24 spec の中身を表のテストだけに絞る（`for` のループは表の値に固定、`it` は表の名前だけ残す）
- [x] `pnpm exec playwright test --list` が 30件以下であることを確かめる。超えたら、パネル代表のうち web 単体テストがあるものから削る
- [x] `tests/e2e/helpers.ts` と `bot-client.ts` から、残した spec が使わない export を削る（fixtures と `e2e-worker.ts` は触らない）
- [x] `scripts/load_test.ts` が `bot-client.ts` を引き続き import できることを `pnpm typecheck` で確かめる

### 4. docs

- [x] `docs/operations/playtest-guide.md` の `tests/e2e/combat.spec.ts` 参照を `full-game.spec.ts` に書き換えるか、比較基準の記述ごと「過去の測定（タグ `ledger-accepted-2026-09-15` 参照）」にする
- [x] `docs/implementation-progress.md` の「Current phase」に E2E の件数（2,173 → 実数）を 1行追記する
- [x] 親計画 `2026-09-18-test-slimming.md` の PR2 節末尾に「実施済み: PR #<番号>」と、代表を置かなかったパネル（ShadowJump / TurnTechnique / TurnChoiceCard / Wish）の担保先を 1行書く

### 5. 検証

- [x] `pnpm typecheck` と `pnpm test` が成功する（typecheck 成功。unit 8,027件・assets 7件・worker 2,573件すべて成功、終了コード0）
- [ ] `pnpm test:e2e` で残した全件が成功する（`PLAYWRIGHT_PORT=18787`）— **27/30。残り3件は PR2 の差分が原因ではない（下記）**
- [x] 親計画「共通: カバレッジの測り方」の unit コマンド（`--testTimeout=120000` 付き）で engine / protocol の4指標を取り、基準値との比較表を作業記録に保存する（PR 本文に転記）— 8指標すべて基準値と同値

## 未達の項目: `pnpm test:e2e` の3件

いずれも PR2 の差分が原因ではないことを確認した。詳細は作業記録の `verification.md`。

1. `privacy.spec.ts` › card inspection … — カード画像アセットがこの環境に無いため
   `naturalWidth > 0` が満たせない。生成物 `apps/web/public/cards/second/` と生成元
   `resources/original/second-edition/*.pdf` はどちらも gitignore 済みで存在しない。
   **base の同じ spec でも同様に失敗する**。この spec は PR2 で1行も変更していない。
2. `blessing-status.spec.ts` › actual confusion … / `lifecycle.spec.ts` › Dia can explicitly hand the ritual …
   — 複数席・全席再読込の E2E に元からある不安定さ。この2 spec だけの `--repeat-each=3` は 9件全成功。
   **base の `blessing-privacy` / `blessing-status` / `lifecycle` 3 spec 全件（13件）を流すと 3件失敗し、
   失敗する顔ぶれも別**（blessing-privacy、lifecycle の death gift と Fusen revival）。
   症状は `observe()` の `page.goto` 後に盤面ではなくログイン画面が出るもので、
   PR2 は `helpers.ts`・`e2e-worker.ts`・認証 src のいずれも変更していない。
   切り分けと修正は E2E 注入経路を触る PR3 か、別の不具合として扱う。
   `playwright.config.ts` に `retries` を足せば通るが、既知の不安定さを隠すので入れていない。

## 実装中に判明したこと

- **照合の結果、`needs-port` は 0件だった**（シナリオ行 422件すべて `covered`）。58機能が使う
  card / ability ID 284種すべてが engine テストの照合対象（engine テスト本体と、それが import する
  fixture モジュール、`packages/engine/test/fixtures/` の JSON）に現れる。
  そのため commit 1（`test: worker∩e2eのみの機能をengineで検証する`）は発生しない。
  照合表は作業記録の `layer-reconciliation.md`。
- `helpers.ts` と `bot-client.ts` の export は、残した spec か `scripts/load_test.ts` の
  いずれかが引き続き使うため、削除するものが無かった（`payload()` は `failure-recovery.spec.ts` が使う）。
- `docs/operations/playtest-guide.md` は 2案のうち「比較基準の記述ごと過去の測定にする」を選んだ。
  残した `full-game.spec.ts` は 4人の通し対戦で、8人・パス数/窓数という測定項目と対応しないため。
- `Board.tsx` の `c2-p02-r2c1-ab03` 分岐は `act()` のイベントハンドラ内にあり、
  既存 web テストの静的描画では到達できない。新規 `apps/web/test/board-withdraw-ability.test.ts` で、
  engine の実遷移で離脱フェーズまで進めた実 view を `Board` に描画し、離脱の能力セレクタに
  この ID が決して現れないこと（＝ガードが前提にする engine 側の不変条件）を確かめる。

## commit 分割（この順）

1. ~~`test: worker∩e2eのみの機能をengineで検証する`~~（needs-port が 0件のため発生しない）
2. `test: card固有のUI分岐をweb単体テストで担保する`
3. `test: 物理札のE2Eを削除する`
4. `test: engineで検証済みのE2Eを削除する`
5. `test: 残すE2Eをパネル代表と中核シナリオに絞る`
6. `docs: E2Eの範囲と件数を更新する`

## 検証コマンド

```bash
pnpm exec playwright test --list | tail -1
ls tests/e2e/*-physical.spec.ts 2>/dev/null | wc -l
comm -23 <(grep -rhoE "'[ac][0-9]-p[0-9]{2}-r[0-9]c[0-9][^']*'" apps/web/src | sort -u) <(grep -rhoE "'[ac][0-9]-p[0-9]{2}-r[0-9]c[0-9][^']*'" apps/web/test | sort -u)   # 空
pnpm typecheck && pnpm test
PLAYWRIGHT_PORT=18787 pnpm test:e2e
```

## 判断済み事項

- E2E の上限は 30件。6/8/10席の full-game は削る（worker `lobby.test.ts` と engine `bot-full-game.test.ts` で担保）。
- 移植は engine テストの追加に限る。src は変えない。
- 作業用のスクリプトと JSON はリポジトリに置かない。
