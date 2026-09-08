# Cloudflareへの配備

現在はローカル検証版。正式開始はカード・能力の未実装検査で止まり、Cloudflareのリソース作成・デプロイはまだ行っていない。

## 構成

Reactの静的ファイルと2ndのWebP画像はWorkers Static Assets、APIは同じWorkerの `/api/*`、試合は1卓1SQLite Durable Object、ゲストセッションと卓一覧はD1を使う。約6MBの固定画像はビルドと一緒に配信できるため、初期版ではR2を追加しない。[Static Assetsの設定](https://developers.cloudflare.com/workers/static-assets/binding/)に従い、卓URLの画面遷移はSPAへ、APIはWorkerへ送る。

| 環境 | Worker | D1名 | ローカル保存先 |
|---|---|---|---|
| 既定・ローカル | madou-senki-local | madou-senki-local | `.cache/local-state` |
| staging | madou-senki-staging | madou-senki-staging | ローカル運用とは別 |
| production | madou-senki | madou-senki-production | ローカル運用とは別 |
| ブラウザテスト専用 | madou-browser-test-local | madou-browser-test | `.cache/e2e-state` |

`ROOMS`/`DB`は環境ごとに明記する。[Wranglerの環境](https://developers.cloudflare.com/workers/wrangler/environments/)ではbindingsを継承しないため、検証用D1を本番へ流用しない。異なるWorkerに属するDO名前空間も別になる。

## ローカルで動かす

Node22.12以上、pnpm10.18を使用する。原本と配信用画像の準備は[素材手順](assets.md)。

```bash
pnpm install --frozen-lockfile
pnpm prepare:assets
pnpm verify:assets
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @madou/worker exec wrangler d1 migrations apply DB --local --env= --persist-to ../../.cache/local-state
pnpm --filter @madou/worker dev
```

`http://localhost:8787`で閲覧する。`pnpm build`は静的ファイル生成とWorkerのdry-runだけで、アップロードしない。ログはリポジトリの`.cache/wrangler`に置く。

ブラウザテストはテスト専用入口・保存先を使う。

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

既存のテスト用Chromiumを明示するときは `PLAYWRIGHT_CHROMIUM_EXECUTABLE` にその実行ファイルを指定する。通常はPlaywrightが対応するChromiumを利用する。ユーザーの通常ブラウザプロファイルを共有しない。

## リモート配備時の手順

以下は対象アカウント・環境・素材配信条件・完成候補を確認した後に実行する手順であり、実行済み記録ではない。`wrangler.jsonc`には実在D1の`database_id`をまだ入れていない。

1. 対象アカウントとstagingを確定し、D1 `madou-senki-staging`を作成する。返されたUUIDを `env.staging.d1_databases[0].database_id` へ設定する。productionも別DB/UUIDにする。
2. `pnpm build`と該当環境のdry-runを確認する。
3. D1の`0001_sessions_rooms.sql`を対象環境へ適用してからWorkerを配備する。
4. 別々のCookieを持つブラウザで招待・参加・開始・切断復帰を確認する。
5. stagingの実戦・障害試験を記録してから、同じビルドをproductionのbindingsで検証・配備する。

```bash
pnpm --filter @madou/worker exec wrangler deploy --env staging --dry-run --outdir dist-staging
# リモート実行の段階でのみ:
pnpm --filter @madou/worker exec wrangler d1 migrations apply DB --remote --env staging
pnpm --filter @madou/worker exec wrangler deploy --env staging
```

テスト設定 `test/wrangler.e2e.jsonc` と `test/wrangler.jsonc` は配備対象にしない。テスト用の状態投入APIとストレージ検査用DOは本番入口からexportされない。ソースPDF/ZIPも静的配信ディレクトリへ入れない。APIトークンやCookieをソース管理しない。

## 型と互換性

本番型は `apps/worker/worker-configuration.d.ts`、テスト型は `apps/worker/test/worker-configuration.d.ts`。本番の型検査ではテスト用PROBE bindingを参照しない。bindings変更後は次で再生成する。

```bash
pnpm --filter @madou/worker exec wrangler types --include-runtime=false worker-configuration.d.ts
```

DO migration `v1`でSQLiteクラス`Room`を作る。保存済み卓の`schemaVersion`と`rulesetId`を検査し、非互換状態を初期化して上書きしない。現時点では1ルール版だけを実装している。将来別の裁定版を追加する際は、既存版のハンドラーを保持するか旧版Workerを残して卓を振り分ける必要がある。版IDだけ変えて進行中卓を置き去りにする配備は受け入れ条件を満たさない。

配備済み環境でのDO休止復帰・更新中の試合継続、10人×10卓、課金、素材配信条件の最終確認は未完了。[検証記録](playtest-results.md)と[復旧手順](recovery.md)を参照。

## 認証確認の記録

2026-09-08、`wrangler whoami --json`は終了コード1。保存済み認証トークンが期限切れで更新できず、非対話環境のため再ログインが必要という結果だった。デプロイ・リモートD1操作は未実行。完成候補の配備時に、対象アカウントと有効な認証を確認する。トークンを文書やソースに記録しない。
