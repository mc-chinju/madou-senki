# R4 実死亡回収の辞退・取消・禁止のWorker/UI

既存の成功用7シナリオを保持し、命運を初期手札に持つ取消用7シナリオ、Cがヴァンミールである禁止用7シナリオを追加した。辞退は既存の成功用fixtureを使う。すべて実配置と攻撃を経て通常防御窓で停止し、その後の死亡・回収回答・取消/禁止はWorker/UIから実コマンドで進める。

Workerは7種×3条件で受理入力の保存復帰とACK再送を確認する。終了後も元の入力を再送し、対象札は手札/予約に入らず捨て札に一枚、通常枠は未消費。辞退は試行0回、取消/禁止は試行1回となる。ブラウザでは回収窓、回収宣言後、反応者の操作前後、最終状態で再読込する。取消は命運凶変の実操作、禁止は対象をチェックして神と人の差を実宣言する。

初回のWorker28件（追加21+成功7）は成功。型検査ではchoiceとoptional claimIdを一つのobjectで組み立てる表現が判別共用体に合わなかったため、decline/takeの明示分岐へ変更した。ランタイムのルールや処理に変更なし。

- 初回Worker28件成功（追加21+成功7）: `/tmp/madou-r4-named-death-negative-do.log`。
- 型修正後Worker21件成功: `/tmp/madou-r4-named-death-negative-do-final.log`。
- ブラウザ21件成功: `/tmp/madou-r4-named-death-negative-browser.log`。
- 最終型検査成功: `/tmp/madou-r4-named-death-negative-types-final.log`。
- 台帳検証: `/tmp/madou-r4-named-death-negative-ledger.log`。

7従者の能力条項へ42参照を追加した。対応は `2026-09-10-r4-named-death-negative-bindings.json`。既存の実死亡Engine21件は `2026-09-10-r4-named-death-cancel.md` に記録済み。追加試験は成功経路を除いて実行した最終Worker試験と対応し、型修正前の結果だけを現在宣言の証拠にしていない。全条項・完成候補の受け入れは未達。レビューなし。
