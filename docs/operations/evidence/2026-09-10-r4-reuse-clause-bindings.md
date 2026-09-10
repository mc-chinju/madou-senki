# R4-B 再使用9能力・24条項の対応

[個別参照](2026-09-10-r4-reuse-clause-bindings.json)。フューリー以外の9能力の公開条件・持ち技/持ち従者追加・名称指定無制限24条項へreuseClaims/beginReuse/resolveReuseと具体試験を対応し、implementedにした。accepted/verifiedへの昇格なし。

名称指定は月の竪琴/魔詩/呪歌、歌う船/飛竜、グリフォン、スケルトン/ゾンビー/ワイト/デス・ナイト、狼牙/妖獣/餓狼を各具体引数で対応。通常の持ち技追加はその人物の実技、ランバの持ち従者追加は配置した小人族の実死亡で確認し、従者攻撃の使用とは区別した。ランスロットは実変身後の継承・消費済み通常枠保持の既存caseも対応。

新規6条件は未公開で実技/従者攻撃→回収回答へ入り、無制限claimなしを確認、実REVEAL_CHARACTER後に同じdecisionで無制限を選び、一枚だけ回収して通常枠を消費しない。最初の試験は公開用claimに存在しないabilityIdを参照して失敗したため、選択後の能力フレームでIDを確認するよう修正。runtimeの変更はない。

機械検査でit.each(rows)の引数が未解決と判定された。rowsは別の試験から添字参照もされるため、検証器の安全な定数判定から外れていた。5つのパラメーター試験用に専用immutable recoveryCasesを分け、ASTが全具体tupleを確定できる形にした。検証器自体は変更していない。実際に変わった5宣言の参照hashを更新した。

Engine対象ファイル74件成功（新規6件含む）。最終ログ `/tmp/madou-r4-reuse-bindings-engine-final.log`。台帳検査終了0、12148行valid / pending8363 / implemented3785（`/tmp/madou-r4-reuse-bindings-ledger-final.log`）。Worker/browserは今回未変更・未再実行。

古い「回収consumerなし」の不足理由を対象24行だけから除去。全名称・取消/禁止/寿命の交差・保存輸送の全条件・現行固定候補の最終受け入れは未完。公開全パス同一性の解釈とフューリー弓反撃条件は回答待ちを維持。レビューなし。

全型検査終了0（`/tmp/madou-r4-reuse-bindings-types-final.log`）。readiness生成終了0、valid=true / ready=false（`/tmp/madou-r4-reuse-bindings-readiness.log`）。今回の全プロセス終了。
