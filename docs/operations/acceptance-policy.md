# 試験受け入れ方針 `acceptance-policy/test-only-v1`

> 2026-09 に台帳ゲートを廃止した。`acceptance-policy/test-only-v1` による受け入れは、タグ
> `ledger-accepted-2026-09-15`（`1dd5eb9a15217076ae4c2372e2fc071f4e1d401a`）で凍結している。
> 台帳・受け入れ証跡・台帳専用スクリプトは作業ツリーから削除したので、以後の受け入れ判断には使わない。
> 以下は当時の方針の記録であり、現在の受け入れ基準は `pnpm test` と `tests/e2e` の成功である。
>
> 凍結した台帳・証跡はタグから参照する。
>
> ```bash
> git show ledger-accepted-2026-09-15:data/second-edition/runtime-coverage.json
> git show ledger-accepted-2026-09-15:docs/operations/evidence/2026-09-11-candidate-run.json
> git checkout ledger-accepted-2026-09-15   # 当時のスクリプトごと再検証する場合
> ```
>
> このファイルと `deploy.md` / `playtest-results.md` / `recovery.md` / `docs/rules/coverage.md` に残る
> `docs/operations/evidence/…` のパスは、すべてタグ上のパスである。作業ツリーには存在しない。

採用日: 2026-09-10。判断は [判断結果](decision-result-2026-09-10.md)。人による妥当性判断は未実施である。

## 適用範囲

完成計画の台帳受け入れとカタログ readiness に適用する。原作ルールは変更しない。pending の一括昇格と正式 START の迂回は行わない。

## 受け入れ条件

semantic 行が `accepted` になる条件:

1. 方針識別子が `acceptance-policy/test-only-v1` である。
2. 現在の候補 hash・source・handler・AST 上の試験宣言に結びつく成功 run がある。
3. 依存行がすべて `accepted` または正当な `notApplicable` である。
4. `remaining` が空である。
5. 受け入れ receipt に `reviewer` / `reviewed` / `verdict` を置かない。

旧方針 `runtime-coverage-review/v2` の receipt は流用できない。

分類と集約 mapping は、manifest の digest 整合、covers の欠落／重複／循環、coverage class の機械検証だけを必須とする。独立した分類レビュー receipt は要求しない。

## 到達不能 / 適用外

`notApplicable` は未調査の `pending` ではない。必須項目は `reason`、`basis`、`edition`、`decidedOn`、`decidedBy: user`、`retainedTests`。`basis` が現在のカードデータまたは採用裁定と一致し、残した試験が成功 run に束縛されている場合だけ、受け入れ扱いとする。実カード経路が成功したとは記録しない。
