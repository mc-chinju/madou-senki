# S24 同名の物理札と通常回収権

`S24#acceptance-correspondence` の不足handler7件を接続しimplementedへ進めた。[具体対応](2026-09-10-s24-correspondence.json)。既存9具体試験の宣言hashとパラメータを保持する。

`baseClaims` は正規所有名と名称単位のbaseSpentを照合し、`commitReclaim` は予約成立時に同じ名称へ通常権利の消費を保存する。`eligibleClaims` / `chooseReclaim` は現在の権利を再評価するので、同名別札Yの捏造した通常claimや古い命令は権利を復活させない。`reuseClaims` / `beginReuse` / `resolveReuse` は追加権利を能力別に消費し、無制限権利も当該イベントの試行を保存する。印字能力の選択では通常回収権を消費しない。

今回Engine4成功。3件が既存S24具体参照で、残1件は物理の封傷2枚を持つfixtureの検証。同名X/Yの試験はジルが実際にXを使用・通常回収し、実手番を進めてYを使用する。候補なし、捏造claim・古い命令の拒否と状態不変、全パス後にYが捨て札へ進むことを確認する。追加回収は通常＋追加の後の3回目を拒否し、無制限回収は後の実攻撃でも通常権利を残す。

DO2成功（それぞれ取消あり/なしを実行）、browser4成功。これらは通常と印字の独立選択・取消・再起動/再読込を担い、X/Yの連続使用と拒否そのものはEngineの証拠である。transportで同名2枚の拒否まで検証したとはしない。

変更は台帳・証跡のみ。製品コード、原文、試験本文は変更しておらず、型検査は再実行していない。初期fixtureの使用は正式STARTを証明しない。固定候補receipt・依存のaccepted・独立受け入れは未完で、レビューは実施していない。

台帳機械検査は12,178行valid（pending8,352 / implemented3,826）。readinessはvalid=true / ready=false。全検証プロセス終了。
