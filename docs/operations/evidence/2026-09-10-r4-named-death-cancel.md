# R4 実従者死亡回収の辞退・取消・禁止

`named-follower-death-cancel.test.ts` に7従者×3条件の21ケースを追加した。既存の実配置/攻撃fixtureから実死亡まで進め、回収判断がfollower-diedであることを確認する。各反応前に保存復帰する。

- 辞退: 本人が回収せず進み、試行履歴は空のまま。
- 取消: 無制限回収を宣言した後、Bが命運凶変を実使用して当該能力を取消。試行・解決履歴が一回ずつ残る。
- 禁止: 無制限回収の受理後、Cヴァンミールが実際の能力禁止宣言を行う。禁止が有効なまま回収を解決し、受理済み試行を消さない。禁止状態はテストから直接設定しない。

いずれも対象札を予約へ入れず、最後に一枚だけ捨て札に残す。通常回収枠は未消費。初期手札の命運と初期人物Cはfixture入力であり、取消/禁止/死亡は実コマンドで進める。

- Engine21件成功: `/tmp/madou-r4-named-death-cancel-engine-final.log`。
- 最終型検査成功: `/tmp/madou-r4-named-death-cancel-types-final.log`。
- 台帳valid、12,178行（pending 8,363 / implemented 3,815）: `/tmp/madou-r4-named-death-cancel-ledger.log`。

7従者の能力条項へ21参照を追加した。対応は `2026-09-10-r4-named-death-cancel-bindings.json`。今回の追加はEngineの条件であり、同条件のWorker/UI再送・再読込は未検証。先に登録済みの成功経路から否定経路の成功を推定しない。ランタイム変更・レビューなし。全条項・完成候補の受け入れは未達。
