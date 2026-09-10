# R6 S28から実儀式の条項への依存接続

S28のacceptance-correspondenceが参照するG16のVanmil変身条件に、完了した人物能力のtransform-Vanmil/full-heal/no-Uonos-inheritanceを依存先として追加した。G16条件にも、既存ritual-physicalの4具体parameterケースを登録した。

S28の元のdamage4比較試験はそのまま保持する。新しい物理儀式試験のdamage3→0をdamage4の代用にしていない。新規試験や本番コード変更はない。

宣言済み依存を機械的にたどると8行あり、6行implemented・2行pending。pendingはcommon:G09のactivation/explicit-optional-useとactivation/decline-preserves-secretで、現台帳はhandler/testsとも空。今回の8行はS28の依存グラフの現状であり、出典の全条件が網羅されたことや独立レビュー完了を意味しない。

manifest/ledgerのcanonical digest、追加した依存3件・試験4件、依存辺と各行のstatus/remainingは同名JSONへ記録した。行のstatusは変更していない。

検証: `python3 scripts/validate_runtime_coverage.py` 成功。`/tmp/madou-r6-s28-ritual-ledger.log`。12,178行、pending8,360/implemented3,818。metadataだけの変更のため、ゲームsuite・型検査は再実行していない。

R6の未完3チェックはいずれも独立レビューを含み、レビュー禁止下では完了にできない。未採用の方針変更案と現行gateは維持した。次は上記G09の2条項の実装・試験対応を対象限定で進める。R6・全goalは未完。
