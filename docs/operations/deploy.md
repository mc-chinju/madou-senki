# Cloudflareへの配備

staging/productionのD1は作成済み。リモート実配備・休止復帰・負荷の記録は未完。アカウントIDと認証トークンは書かない。

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

以下は対象アカウント・環境・素材配信条件・完成候補を確認した後に実行する手順。D1 UUIDは `wrangler.jsonc` に設定済み。実配備の結果は「候補と配備先の記録」へ追記する。

1. 対象アカウントとstagingを確定し、D1 `madou-senki-staging`を作成する。返されたUUIDを `env.staging.d1_databases[0].database_id` へ設定する。productionも別DB/UUIDにする。
2. `python3 scripts/generate_catalog_readiness.py --check --require-ready`、`pnpm verify:assets`を通し、`pnpm build`と該当環境のdry-runを確認する。通常のbuildは検証用の`ready=false`も許すため、build成功だけを公開可能の証拠にしない。
3. D1の`0001_sessions_rooms.sql`を対象環境へ適用してからWorkerを配備する。
4. 別々のCookieを持つブラウザで招待・参加・開始・切断復帰を確認する。
5. stagingの実戦・障害試験を記録してから、同じビルドをproductionのbindingsで検証・配備する。

```bash
# 完成候補の確認。いずれか失敗した場合は以降の配備へ進まない:
python3 scripts/generate_catalog_readiness.py --check --require-ready
pnpm verify:assets
pnpm build
pnpm --filter @madou/worker exec wrangler deploy --env staging --dry-run --outdir dist-staging
# リモート実行の段階でのみ:
pnpm --filter @madou/worker exec wrangler d1 migrations apply DB --remote --env staging
pnpm --filter @madou/worker exec wrangler deploy --env staging
```

テスト設定 `test/wrangler.e2e.jsonc` と `test/wrangler.jsonc` は配備対象にしない。テスト用の状態投入APIとストレージ検査用DOは本番入口からexportされない。ソースPDF/ZIPも静的配信ディレクトリへ入れない。APIトークンやCookieをソース管理しない。

### 候補と配備先の記録

配備ごとに以下を実値で残す。現在の準備状況は[2026-09-10の記録](evidence/2026-09-10-r8-preparation.md)を参照する。空欄や未確認を成功扱いにしない。

- 候補: ソースを固定した識別子とハッシュ、rulesetId、readinessと台帳のハッシュ、実施した受け入れ結果。dirtyな作業ツリーではcommit IDだけを候補の識別子にしない。
- 成果物: Worker bundleと静的配信ファイル一式のハッシュ、画像manifestのハッシュ、使用したビルドコマンド。staging検証後に再ビルド・ソース変更した場合は同一候補とは扱わない。
- 対象: アカウントID、環境、Worker名、D1 UUID、ROOMS、公開originと配備ID。認証トークンは保存しない。
- 公開条件: 素材配信の確認根拠と範囲、クレジット表示場所、配備・負荷・復旧試験の結果。ローカル試験はリモート試験と分けて記録する。

## 型と互換性

本番型は `apps/worker/worker-configuration.d.ts`、テスト型は `apps/worker/test/worker-configuration.d.ts`。本番の型検査ではテスト用PROBE bindingを参照しない。bindings変更後は次で再生成する。

```bash
pnpm --filter @madou/worker exec wrangler types --include-runtime=false worker-configuration.d.ts
```

DO migration `v1`でSQLiteクラス`Room`を作る。保存済み卓の`schemaVersion`と`rulesetId`を検査し、非互換状態を初期化して上書きしない。現時点では1ルール版だけを実装している。非互換更新は以下の別Worker運用とし、同一Workerで複数版を扱う実装があるとはみなさない。

## 非互換なルール版の切り替え

現在の固定名を持つWorkerは、そのWorkerで最初に受け入れたルール版の配備先として保持する。非互換版を同じ名前へ上書きしない。新しい版には配備識別子（例: `r2`、実際の採用rulesetIdとは別）を割り当て、stagingとproductionの両方に別Worker・別D1・別の公開ホストを用意する。以下は命名例であり、作成済みリソースではない。

| 対象 | Worker名 | D1名 | 公開先の扱い |
|---|---|---|---|
| 旧production | `madou-senki` | `madou-senki-production` | 既存ホストを維持 |
| 新staging | `madou-senki-r2-staging` | `madou-senki-r2-staging` | 新しい検証専用ホスト |
| 新production | `madou-senki-r2` | `madou-senki-r2-production` | 新しい本番専用ホスト |

1. 配備記録に旧・新版それぞれの候補ハッシュ、rulesetId、Worker名、公開origin、D1 UUID、ROOMSの対応を記録する。旧候補の成果物・設定も保存する。Cookieや招待トークンは記録しない。
2. 新版の配備設定は旧版と別ファイルで保持し、`main`は本番入口、assetsはその候補のビルドに固定する。`ROOMS`は新版自身の`Room`へ結び、旧Workerを参照する`script_name`を設定しない。`DB`には新版専用UUIDを指定する。旧DB・DOのコピー、既存卓のrulesetId書き換え、旧ホストの新版への付け替えは行わない。
3. 新stagingでR8の保存・通信・再配備試験を終えてから、同じ候補を新productionへ配備する。入口の新規プレイ案内を新版のoriginへ向ける。旧卓の招待・再接続URLは元のoriginのまま案内し、旧卓URLを新版へリダイレクトしない。
4. 旧Worker・旧D1・旧assetsと旧ホストを維持し、進行中卓を旧版で終了させる。現行実装には旧版の新規卓作成だけを止める運用スイッチがないため、案内の変更を作成禁止の保証と扱わない。旧版で卓が増えた場合も保持対象とする。
5. 旧版の進行中卓がなく、利用者への保存・閲覧期間の案内が済むまで旧リソースを削除しない。D1一覧は遅延し得るため、一覧が空であることだけで終了を判定しない。旧版終了の確認方法と保管期限が未確定なら削除を保留する。

セッションは`__Host-madou_session`と各環境のD1で照合する。新版のホストでは新しいセッションを作り、旧版の席は旧ホストに残るCookieで復帰する。新旧間の席移管は実装されていない。旧originを維持することが、既存卓の復帰経路を保つ条件になる。

切り替え失敗時は新規プレイ案内を旧版へ戻し、新版に既に卓がある場合は新版も保持する。保存後の新版卓を旧コードへ戻して継続させることはしない。同じ版の配備失敗は[復旧手順](recovery.md)に従う。実際のリソースID・公開URLと新旧同時稼働の結果は、配備時の記録が揃うまで未検証とする。

配備済み環境でのDO休止復帰・更新中の試合継続、10人×10卓、課金、素材配信条件の最終確認は未完了。[検証記録](playtest-results.md)と[復旧手順](recovery.md)を参照。

## 認証確認の記録

2026-09-14、`wrangler whoami` は終了コード0。トークンとアカウント識別子は記録しない。

## D1作成の記録（2026-09-14）

| 環境 | Worker | D1名 | database_id |
|---|---|---|---|
| staging | madou-senki-staging | madou-senki-staging | `0fc033a4-97d0-40f1-b627-7890f88c938e` |
| production | madou-senki | madou-senki-production | `f659209f-59b8-462f-80ed-d337e4af855b` |

staging へ `0001_sessions_rooms.sql` を `--remote` 適用済み。実測は [staging記録](evidence/2026-09-11-staging.md)。production へ同じ migration を `--remote` 適用済み。

## 候補と配備先の記録（production / 2026-09-15）

アカウントID・認証トークン・Cookieは書かない。

- 候補コミット: `1dd5eb9a15217076ae4c2372e2fc071f4e1d401a`（凍結 `31c3a718e8588388d5f345b69cecc2964a384791`）
- 候補記録: [2026-09-11-release-candidate.md](evidence/2026-09-11-release-candidate.md)
- run: `docs/operations/evidence/2026-09-11-candidate-run.json`
- run sha256: `7297a9e76b34edeabdeebaf767200a6b8d381bc287040f0b5bc8f8a7c3e43a43`
- readiness: `packages/catalog/src/selected/readiness.json`
- readiness sha256: `9ff25089e58440074f6319959b7eafa40e2961b4e6da33bce8867b3bb5858ba3`
- Worker: `madou-senki`
- D1: `madou-senki-production`（`f659209f-59b8-462f-80ed-d337e4af855b`）
- 公開 origin: `https://madou-senki.catalgorithm.workers.dev`
- 配備 Version ID: `fb25732e-aee5-40b8-85a6-ee57cb4750dd`
- 実施: 2026-09-14T16:05Z、production smoke 2 passed（hibernate は未実施）
- 既知の制限: 招待制のみ。対人評価（M5）は未実施。`verify:catalog` は C11 見出し重複と gitignore された原本 PDF 欠落で未成功。
- 復旧: [recovery.md](recovery.md)
