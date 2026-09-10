# R4-B 実能力禁止下の通常回収

[具体対応](2026-09-10-r4-live-suppression-bindings.json)。新規reclaim-live-suppression.test.tsはフューリーの弓とランスロットの破山剣の2条件で、実攻撃の効果Lv窓から公開ヴァンミールの「神と人の差」を選択・解決する。禁止状態を直接作らない。

回収回答時に実Vanmil指定が有効であることを確認し、候補がbaseだけ（追加/無制限なし）であることを確認。JSON保存後に通常回収し、札が手札に1枚、捨て札になし、baseSpent=true/extraSpentByAbility=[]、物理220枚の一意性を確認する。

初回2失敗は、試験が禁止を汎用status配列に期待したため。実実装はsuppressionDesignationsとVanmil公開状態を使うので、指定元/対象と有効な禁止を確認する形に修正。runtime変更なし。

G11 paragraph/007の「人物能力禁止だけでは通常回収を失わない」を個別条項としてimplementedへ登録。baseClaimsはcanUseCharacterAbilityで通常権を消さず、reuseClaimsは能力禁止により追加/無制限権を除く。試験を全カード・全禁止方法・全輸送経路の成功とは扱わない。

Engine2件成功（`/tmp/madou-r4-live-suppression-engine-fixed.log`）、全型検査終了0（`/tmp/madou-r4-live-suppression-types.log`）、台帳12157行valid/pending8363/implemented3794（`/tmp/madou-r4-live-suppression-ledger.log`）。Worker/browser変更なし・未再実行。レビューなし。固定候補の最終受け入れは未完。

readiness生成終了0、valid=true / ready=false（`/tmp/madou-r4-live-suppression-readiness.log`）。今回の全プロセス終了。
