# R4 切断とalarmで明示回答を省略しない

既存の `apps/worker/test/room-reclaim-disconnect.test.ts` を再実行した。権利なし/通常権ありの2卓で認証済みソケットを閉じ、Roomを退避復帰し、実際の `Room.alarm` を呼ぶ。Date.nowは初期時刻、1分後、1日後を指定する。いずれも保存された卓状態が不変で、第三者へのゲーム投影も2卓間で一致する。その後A/B/C/Dがそれぞれ明示パスし、ACK再送でも一回ずつしか進まない。

Worker `Room.alarm` はoutboxの配送・再試行・次alarm設定を処理する。`webSocketClose` / `webSocketError` はソケット終了とbroadcastを行う。回収の明示進行はEngineの保存された回収窓と選択処理にある。現在の台帳の関数索引はクラスメソッドを列挙しないため、Workerメソッドを架空の索引参照として登録せず、対応JSONに参照箇所を明示した。エラーcallbackは別途注入試験していない。

- Worker1件成功: `/tmp/madou-r4-disconnect-wait-do.log`。
- 台帳valid、12,166行（pending 8,363 / implemented 3,803）: `/tmp/madou-r4-disconnect-wait-ledger.log`。
- 対応: `2026-09-10-r4-disconnect-wait-bindings.json`。

今回の変更は条項・台帳・証跡のみ。コード/試験コードは変更していないため型検査は再実行していない（直前の型検査成功は `/tmp/madou-r4-public-absence-types-final.log`）。模擬時刻で実alarmを呼ぶ検証であり、実時間の1日負荷試験や外部ネットワーク耐久試験ではない。全条項・完成候補の受け入れは未達。レビューなし。
