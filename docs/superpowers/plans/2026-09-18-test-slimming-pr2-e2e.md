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
- [x] `pnpm exec playwright test --list` が 30件以下であることを確かめる。超えたら、パネル代表のうち web 単体テストがあるものから削る（PR2 の選定は 30件。main の rebase 後は、PR #6 で追加された `public-record.spec.ts` 1件が加わり 31件 / 25ファイル。別 PR の新機能の E2E なので削らない）
- [x] `tests/e2e/helpers.ts` と `bot-client.ts` から、残した spec が使わない export を削る（fixtures と `e2e-worker.ts` は触らない）
- [x] `scripts/load_test.ts` が `bot-client.ts` を引き続き import できることを `pnpm typecheck` で確かめる

### 4. docs

- [x] `docs/operations/playtest-guide.md` の `tests/e2e/combat.spec.ts` 参照を `full-game.spec.ts` に書き換えるか、比較基準の記述ごと「過去の測定（タグ `ledger-accepted-2026-09-15` 参照）」にする
- [x] `docs/implementation-progress.md` の「Current phase」に E2E の件数（2,173 → 実数）を 1行追記する
- [x] 親計画 `2026-09-18-test-slimming.md` の PR2 節末尾に「実施済み: PR #<番号>」と、代表を置かなかったパネル（ShadowJump / TurnTechnique / TurnChoiceCard / Wish）の担保先を 1行書く

### 5. 検証

- [x] `pnpm typecheck` と `pnpm test` が成功する（typecheck 成功。unit 8,027件・assets 7件・worker 2,573件すべて成功、終了コード0）
- [x] `pnpm test:e2e` で残した全件が成功する（`PLAYWRIGHT_PORT=18787`）— 27〜29/30。失敗はセッション不安定さ（`/api/sessions/current` の 401）と負荷起因で base でも同率。全件成功の確認は PR3（`e2e-worker.ts` 整理）へ送る
- [x] 親計画「共通: カバレッジの測り方」の unit コマンド（`--testTimeout=120000` 付き）で engine / protocol の4指標を取り、基準値との比較表を作業記録に保存する（PR 本文に転記）— 8指標すべて基準値と同値

## PR3 へ送った項目: `pnpm test:e2e` の全件成功

受入条件4 のうち「`pnpm test:e2e` で残した全件が成功する」は、**PR3（`e2e-worker.ts` 整理）へ送る**
（2026-09-18 のユーザー判断）。PR2 では 27〜29/30 で、`playwright.config.ts` に `retries` は入れない。

### 実測

実行のたびに 1〜4件が失敗し、**失敗するテストの顔ぶれが毎回入れ替わる**。
単独・少数で流すと必ず成功する。

| 実行 | 条件 | 結果 |
|---|---|---|
| 1・2回目 | 通し30件 | 27 passed / 3 failed（blessing-status, lifecycle-Dia, privacy） |
| 3回目 | `.cache/e2e-state` を消して通し | 同じ3件 |
| 4回目 | `--retries=2` | 25 passed / **4 flaky** / 1 failed（blessing-privacy） |
| 5回目 | 通し30件 | 26 passed / 4 failed（blessing-privacy, lifecycle 終局結果, sad-love, turn-information） |
| 部分 | blessing-status + lifecycle を `--repeat-each=3`（9件） | **9件すべて成功** |
| base | base の blessing-privacy / blessing-status / lifecycle 全13件 | **3件失敗**（顔ぶれは別） |

### 原因

1. **セッションの不安定さ。** 症状の多くは `observe()` の `page.goto(table.url)` の後に
   盤面ではなくログイン画面が出るもの。`apps/web/src/session.ts` の `api()` に
   クライアント側タイムアウトは無いので、`/api/sessions/current` が実際に **401** を返している
   （`App.tsx:15` で `setSession(null)` → `LoginScreen`）。`tableFixture` の中では同じセッションで
   「ようこそ」まで出ているため、その後に無効化されている。
2. **マシン負荷。** 実行中のロードアベレージは 11〜20（別ワークスペースの workerd 等が同時稼働）。
   PR1 の記録にも worker テストで同種の「負荷起因の既存の不安定さ」がある。

いずれも PR2 の差分による退行ではない（base でも同率で失敗する）。

### 訂正

前の記録で「カード画像アセットが無いため `privacy.spec.ts` は原理的に通らない」と書いたが、
**これは誤りだった**。カード画像は `apps/web/dist/cards/second/`（`wrangler.e2e.jsonc` の
`assets.directory` が指す先）にあり、`--retries=2` の実行では当該テストは 2.8秒で成功している。
`privacy` の失敗も他と同じ不安定さだった。

### PR3 で行うこと

親計画 `2026-09-18-test-slimming.md` の PR3 節に、次をタスクとして追記した。

- E2E 30件の通し全件成功の確認
- `/api/sessions/current` が 401 を返すセッション不安定さの切り分け（`e2e-worker.ts` の
  `/__test/session` / `createTestSession` を含む）

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
