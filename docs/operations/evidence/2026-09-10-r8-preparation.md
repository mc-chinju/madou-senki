# R8 配備準備（2026-09-10）

実配備の記録ではない。R8第1項は未完。

| 項目 | 現在の状態 | 次の成立条件 |
|---|---|---|
| 完成候補 | 全件accepted未成立。通常buildはready=falseを許す | strict readinessとR7受け入れ、候補・成果物の固定 |
| 画像 | `pnpm verify:assets`終了0、246枚 | 完成候補の配信物にも同じ検査を適用 |
| アカウント | 未確定。2026-09-08の認証失効記録あり、今回未照会 | 配備段階で対象アカウントと有効な接続を確定 |
| staging | 設定名`madou-senki-staging`、D1 UUID未設定 | 実リソースと公開originの記録 |
| production | 設定名`madou-senki`、D1 UUID未設定 | stagingと別DBを確定し、同一候補で配備 |
| DO | 各環境にROOMS→Room、SQLite migration v1の設定あり | リモートの名前空間と保存・再配備試験 |
| 素材条件 | 外部配信の条件未確認 | 対象origin・画像・効果文の掲載範囲を確認 |
| クレジット | assets.mdの文案を共通フッターに実装 | 指定表記が得られた場合は調整 |

画像検査ログ: `/tmp/madou-r8-assets-verify.log`。検査はローカル生成物の整合性を示し、配信許諾や公開成功を示さない。

`python3 scripts/generate_catalog_readiness.py --check --require-ready`は終了1、`catalog has no complete accepted coverage`。ログは`/tmp/madou-r8-ready-check.log`。期待する未完成候補の拒否であり、配備前検査の成功ではない。以降のbuild・リモート配備は実行していない。変更3文書のローカルリンク先存在確認は成功。文書だけの変更のため型検査・ゲーム試験の再実行なし。

版分離の方針は[配備手順](../deploy.md#非互換なルール版の切り替え)に記載。新旧同時稼働は未実測。レビューはユーザー指定により実施していない。

## クレジット表示の実装（17:03 JST）

`apps/web/src/App.tsx`の共通フッターに原作名・作者名・出典リンクを追加。セッション確認中、未ログイン、ログイン後の各分岐で表示する。新しいタブで開くことをリンク文言に明記。`styles.css`に可変幅の余白・折り返しを指定。

- `pnpm typecheck`: 終了0（`/tmp/madou-r8-credits-types.log`）。
- 既存`tests/e2e/invite-game.spec.ts`: 1成功、終了0（`/tmp/madou-r8-credits-browser.log`）。ログイン・4人招待・準備・開始拒否・setup fixtureと再読込の回帰確認。クレジットの見た目や正式STARTの成功を検証する試験ではない。
- ゲームルール・台帳・readinessは変更なし。素材配信条件は未確認、外部配備なし。全実行プロセス終了。
