# R4-B G11回収予算の共有条項

[個別対応](2026-09-10-r4-reclaim-budget-bindings.json)。G11 paragraph/007から通常/追加の別予算、無制限で通常枠を消費しない、追加取消でも追加枠と試行が戻らない3条件をimplementedとして登録。対応する追加/無制限の回収能力条項へ依存を追加した。

commitReclaimは予約成功後にbase権利だけbaseSpentを書き込む。beginReuseはextra権利だけextraSpentByAbilityを受理時点で追加し、全再使用権利でattemptedClaimIdsを保存する。resolveReuseは取消の場合にcommitせずresolvedClaimIdsを記録して回答を進める。通常と追加は同じ正規化名称の別フィールドとして保持される。

試験対応:

- 実フューリーの同名弓で通常→追加→第三回収なしを確認するS24 caseを別予算へ対応。
- 実ランスロットの無制限2回後も通常枠ありのS24 caseと、無制限6能力の具体回収成功caseを通常枠不消費へ対応。
- 追加4能力（フューリー、ランバ、マルフィー、バルドル）の実命運取消caseを、追加枠と試行の消費保持へ対応。各caseは手札に戻らず廃棄、通常枠未消費、attempt1回を確認する。

いずれも直前のreuse-abilities.test.ts全74成功に含まれ、現行ASTの宣言hashと具体tupleを登録した。全能力の全名称・全生命遷移・輸送層の全組合せ成功には広げない。通常枠が能力禁止で残る条件、無制限の同一イベント再試行拒否の直接証明などG11段落の残りは未完。

台帳機械検査終了0、12156行valid / pending8363 / implemented3793（`/tmp/madou-r4-reclaim-budget-bindings-ledger.log`）。今回runtime/test本文変更なし、型・ゲーム試験の再実行なし。レビューなし。固定候補の最終受け入れは未完。

readiness生成終了0、valid=true / ready=false（`/tmp/madou-r4-reclaim-budget-bindings-readiness.log`）。今回の全プロセス終了。
