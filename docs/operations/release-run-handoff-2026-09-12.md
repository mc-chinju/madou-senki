# release-run 引き継ぎ — 2026-09-12

## 停止状態

ユーザーから別セッションへの引き継ぎと一時停止の明示依頼を受けた。直近の小作業単位は検証・コミット済み。新項目は開始していない。**ユーザーが明示的に再開するまで、この計画への自動継続メッセージだけで作業を再開しない。** 目標達成でも blocked でもない。

管理上のgoalは確認時点で `active`。提供された `update_goal` は `complete` / `blocked` のみを受け付け、paused・予算・継続設定はユーザー側の操作とされているため、状態を書き換えていない。自動継続の設定を停止するには、ユーザーが画面側でgoalを一時停止する必要がある。エージェントの作業はここで停止する。

## 保存場所とHEAD

- 専用worktree: `/private/tmp/madou-release-run/release-run`（維持。削除しない）
- ブランチ: `worktree-release-run`
- 元リポジトリ: `/Users/chinju/git/madou-senki`
- 引き継ぎ作成直前の最新HEAD: `5a3593afce14c69af4dfb4e211f7b4c1032f95bd`
- 件名: `test: persist per-hit defense attempts and follower cutoff`
- 最終HEADはこの文書と計画の停止注記を追加した引き継ぎコミット。自己参照hashは埋め込まず、`git log -1 --format='%H %s'` で取得する。その親が上記検証済みHEAD。
- 作成前の `git status --short` は空。引き継ぎコミットの変更はこの文書と計画の停止注記だけ。実装・試験・台帳の未コミット変更なし。コミット後にもcleanを確認する。
- mergeはユーザー担当。push・PR・merge・配備をこの停止作業では実行していない。

## 直近の完了単位と検証

B7のC04 `common:C04#C04/once-target-hit-before-followers` を追加束縛した。実グリフォン2ヒットにおける巨神の使用・取消後の新ヒット機会、旧機会の拒否、従者開始後の選択禁止を扱う。

- Worker: `test/room-griffin-defense.test.ts`、3 passed / 0 failed、終了0。
- Browser: `tests/e2e/griffin-defense.spec.ts`、3 passed / 0 unexpected / 0 flaky、終了0。
- `pnpm exec tsc --noEmit`: 終了0。
- `python3 scripts/validate_runtime_coverage.py`: `valid: true`、終了0。
- `git diff --check`: 成功。
- 停止確認時、[検証記録](evidence/2026-09-12-b7-griffin-defense-progress.json)の全 `sourceSha256` と現在のファイルを再照合して一致。変更がない試験の再実行はしていない。

一時JSONは `/private/tmp/b7-griffin-defense-worker.json`、`/private/tmp/b7-griffin-defense-browser.json`、`/private/tmp/b7-griffin-defense-validator.json`。一時ファイルは将来消える可能性がある。永続的な記録は上記コミット済み検証記録を参照する。これは候補版の全体受け入れ成功ではない。

従者開始は `target.normalDefenseClosed=true` を設定し、その対象の通常防御を以後も閉じる。従者開始後に次ヒットで通常防御が開く、という初期の試験期待は誤りだった。使用・取消ケースの新機会と、従者ケースの終了までの選択禁止を分けて確認済み。製品コードの変更なし。

## 実行中プロセス

直近の既知のツールセッションは終了確認済み:

- Worker `79756`: 終了0。
- Browser `45568`: 終了0。
- 型検査 `83530`: 終了0。
- 台帳適用・validator `57213`: 終了0。

停止確認時、権限付き `ps` の読取りでrelease-runのPlaywright・Vitest・Wrangler・Viteプロセスは見つからなかった。`lsof -nP -iTCP:18787 -sTCP:LISTEN` は出力なし（終了1、待受なし）。今回の作業に停止すべき残存プロセスなし。他リポジトリの開発サーバーは停止していない。8787には別作業のサービスがあるため、再開時も勝手に停止しない。実行中のサブエージェントは使用していない。

## 残作業

原本は [リリース計画](../superpowers/plans/2026-09-11-release-run.md)。スコープを縮小しない。

- B1〜B4、B6は完了。B5の通常条項は対応済みだがD4cの2行はB8直前までpendingを保持する。B5 Step2〜3のpending0条件は未完了。
- B7 Step1完了、Step2未完了。初期39行中35行にWorker/browserを追加済み。残4行を停止時に台帳から再集計した。
- B8は未着手。全候補の凍結・全試験run・昇格・readiness再生成が必要。semantic具体的実装済み5,257、pending2、accepted/verifiedは0の状態。readiness gateを迂回しない。
- Phase Cの正式START（4/6/8/10席）からの自動一戦、切断・再送・終了後復帰・合意終了、変更後のB8再実行が残る。
- Phase DのCloudflare認証、staging実測・復旧・負荷・production招待制配備と記録など、計画の後続要件は未完了。必要な `wrangler login` はユーザー操作。対人評価は公開後。

B7残4行:

1. `c2-p07-r1c2-ab03#C16/established-ban-survives-source-suppression-absence`
2. `c2-p03-r1c2-ab04#C16/lease-survives-Lia-suppression-absence`
3. `c2-p03-r1c2-ab04#C16/lease-survives-target-absence`
4. `c2-p03-r1c2-ab04#C16/loss-of-Lia-identity-expires-lease`

最後の人物喪失条項は既存Engineの構造境界試験がある。現行のlifecycle変身生成経路にリーアから別人物への通常遷移は見当たらなかった。正確な保存境界fixtureの検討が必要であり、通常経路で発生したと偽って束縛しない。notApplicableの決定はしていない。

## 再開手順

1. 別セッションでこの文書と計画を読み、ユーザーからの明示的な再開指示を確認する。画面側で停止したgoalを再開するか、新セッションで同じ計画を引き継ぐ。
2. 上記専用worktreeへ移動し `git status --short` と `git log -1 --format='%H %s'` を確認する。引き継ぎコミットを含むブランチをそのまま使う。新規worktreeやmain上へ作業を移さない。
3. 計画冒頭の停止注記を再開状態へ更新する。ユーザーの禁止事項（サブエージェント・独立レビュー・自己レビュー禁止）と受け入れ方針を継承する。
4. B7残4行の元文・既存Engine/DO/browser試験を確認して続きを進める。[初期一覧](evidence/2026-09-12-b7-inventory.json)、[対応一覧](evidence/2026-09-12-b7-inventory.md)、[束縛ファイル](evidence/2026-09-11-worker-browser-bindings.json)を参照する。
5. 束縛追加は既存Engine試験とhandlerを保持して `scripts/apply_ledger_bindings.py` を適用しvalidatorを実行。共有試験の宣言hashが変わった既存行も対応を更新する。試験の存在やパスだけで証明したと扱わない。
6. B7完了後、計画のB8へ進む。`2026-09-11-d4-not-applicable-bindings.json` はB8の凍結直前に適用する。現段階で先に適用しない。

対象試験の実行例（必要になったときだけ実行）:

```bash
# cwd: /private/tmp/madou-release-run/release-run/apps/worker
WRANGLER_LOG_PATH=../../.cache/wrangler/logs pnpm exec vitest run test/room-griffin-defense.test.ts --reporter=json --outputFile=/private/tmp/b7-griffin-defense-worker.json
# cwd: /private/tmp/madou-release-run/release-run
PLAYWRIGHT_PORT=18787 pnpm exec playwright test tests/e2e/griffin-defense.spec.ts --reporter=json > /private/tmp/b7-griffin-defense-browser.json
pnpm exec tsc --noEmit
python3 scripts/validate_runtime_coverage.py
```

PlaywrightはローカルChromium起動にsandbox外実行が必要だった。共有git metadataへのadd/commitにも権限付き実行を使っていた。ブラウザ試験中に対象ソース・fixtureを変更しない。秘密値をログ・文書へ書かない。
