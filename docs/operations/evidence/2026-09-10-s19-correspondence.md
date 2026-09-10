# S19 ジルの信仰心と通常判定失敗

`S19#acceptance-correspondence` の不足handlerを接続し、implementedへ進めた。[具体参照](2026-09-10-s19-correspondence.json)。既存Engine参照を保持し、DOのprotect-gil-sixという具体パラメータを追加した。

`resolveMentalProtection` は対象判定IDに選択した保護を保存し、`hasMentalDoubleGuard` が同じ判定への有効性を返す。`resolveMentalDefense` はその保護があればゾロ目効果を適用しないが、通常判定の失敗ではレスター宛の未命中ヒットを防御済みにする。その後ゾロ目なしとして戻るため、停止や転向は発生しない。

EngineのS19試験はジルの精神力加算を0に戻し、閾値が12未満であること、[6,6]の通常失敗、選択した信仰心、陣営保持、停止なし、レスターへの損害0を確認する。DO/browserのprotect-gil-six fixtureは精神力加算なし（実精神力7・閾値6）で、実攻撃とレスターの能力を通して[6,6]の未確定判定へ到達する。信仰心は実命令・画面で選択する。

今回Engine1、DO3、browser1成功。DOの3件中S19対応はジルの1件で、残2件は同じ宣言のガドューラ試験。最初のDO絞り込みは38件すべてskipだったため成功証拠に含めず、共通タイトルで再実行した。DOは確定前後の再起動と命令再送、browserは選択後の再読込と陣営・保護対象・停止なし・損害0を確認する。browserの動的タイトルは実行証跡として記録し、新しい具体AST参照とはしていない。

初期配置を投入するfixtureであり、正式STARTの証拠ではない。変更は台帳と証跡のみで、型検査は再実行していない。原文・製品コード・試験本文は変更していない。固定候補receipt・依存のaccepted・独立受け入れは未完。レビューは実施していない。

台帳機械検査は12,178行valid（pending8,353 / implemented3,825）。readinessはvalid=true / ready=falseを維持。全検証プロセス終了。
