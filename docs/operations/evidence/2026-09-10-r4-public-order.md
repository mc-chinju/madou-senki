# R4 使用者からの公開回答順

`packages/engine/test/reclaim-privacy.test.ts` に4席のパラメータ試験を追加した。通常の手番終了・開始で対象席まで進め、本人が封傷を実使用する。回収窓は使用者を先頭とする時計回りの4席となり、回収権がない席も明示的にパスする。各回答前にJSON保存復帰し、最初の回答後に元使用者が人物公開しても窓と回答席が変わらない。全員の投影で同じ回答者を確認し、4回答後に一枚だけ廃棄される。

- 対象Engineファイル10件成功: `/tmp/madou-r4-public-order-engine.log`。
- `pnpm typecheck` 成功: `/tmp/madou-r4-public-order-types.log`。
- 台帳valid、12,159行、pending 8,363 / implemented 3,796: `/tmp/madou-r4-public-order-ledger.log`。
- readiness生成成功、ready=false: `/tmp/madou-r4-public-order-readiness.log`。

G11段落010の使用者起点・時計回り・公開時の回答順維持をimplementedとして登録し、回収19条項に依存を追加した。具体的な宣言ハッシュとパラメータは `2026-09-10-r4-public-order-bindings.json` に保存。死亡等による公開不参加、切断時の待機、子反応後の回答順はこの新規試験の範囲外。無制限を含む全パス公開transcriptの条件変更案は未回答のまま。ランタイム変更・レビュー・全体完了の認定は行っていない。
