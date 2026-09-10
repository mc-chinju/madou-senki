# R6 S09を実際の同値反撃へ修正

旧S09は受け流し（parry）で戦士技を消していた。最終A0/B0/C12でも、counterの同値比較を通らず、S09「元技Lv6と反撃Lv6の相殺」の証拠として不足していた。旧S09を全条件成立の証拠として扱わない。

r6-defense-scenarios.tsと3層試験を修正。A実アスフェルトの2対象剣Lv6に、Bガーウィンが通常妖撃破山剣と実宣言能力「剣匠」を選ぶ。元の効果5へ宣言能力+1を適用し、確定したcounter効果6で比較する。B戦士Lv4で使用チェックが存在して成功する。実counter分岐がBの元ヒットを消し、反撃ヒットは作らず、Cの12ダメージは残る。

- 祈りを後から足す案は、counterの宣言受理に元効果Lv以上が必要であり不適切と判断して実装しなかった。宣言時から選べる剣匠を使う。
- 初回Engineは宣言直後の未確定effect5を6と期待して失敗（`/tmp/madou-r6-s09-real-counter-engine.log`）。効果確定後に6を確認するよう修正し対象4成功（`/tmp/madou-r6-s09-real-counter-engine-fixed.log`）。runtime修正なし。
- 旧parry経路は受け流しカードの証拠としてs09-parry fixtureと独立宣言へ残した。最終Engine5成功（`/tmp/madou-r6-s09-real-counter-engine-final.log`）。
- Worker4成功、全コマンド保存/restart/同ACK再送を維持（`/tmp/madou-r6-s09-real-counter-do.log`）。
- Browser4成功、実UIで妖撃破山剣と剣匠を選択、reload後にB相殺/C12（`/tmp/madou-r6-s09-real-counter-browser.log`）。DOとbrowserの重複なし。
- 全型終了0（`/tmp/madou-r6-s09-real-counter-types-final.log`）。

最初の台帳機械検査は変更宣言に対する旧参照/hashを検出（`/tmp/madou-r6-s09-real-counter-ledger-before.log`）。該当4参照のみ更新し、旧parry参照は独立parry宣言へ、S09は新counterのEngine/DO(s09 tuple)/browserの3参照を登録。[対応](2026-09-10-r6-s09-counter-bindings.json)。最終台帳終了0、12118行valid/pending8392/implemented3726（`/tmp/madou-r6-s09-real-counter-ledger-final.log`）。

旧R6候補runやsource-indexは旧実装の履歴。S09の完全な受け入れ証拠として流用しない。変更箇所に関する今回の実行ログを保存し、全候補固定runは後続R6/R7条件として残す。レビュー/status昇格なし。S09/S10の依存追加は今回の試験修正とは別の残件。

readiness再生成終了0・valid=true/ready=false（`/tmp/madou-r6-s09-real-counter-readiness.log`）。全プロセス終了。

## S09/S10依存登録

[依存と具体試験](2026-09-10-r6-s09-s10-dependencies.json)に各7依存を登録。S09はアスフェルト専用Lv6/対象選択、妖撃破山剣の使用Lv/基礎Lv/反撃用途、剣匠+1、同値相殺。S10は妖撃破山剣の使用Lv/基礎Lv/近射程/反撃用途、実祈りのd6/効果加算、遠距離で近反撃の返しなし。

G13の同値相殺と射程外近反撃の2個別条項を追加し、continueActionと各3層caseへ対応してimplemented。G13全段落の分割・source全欄・候補固定/独立受け入れは未完。既存の成功した対象実行を再実行せず参照し、新manifestへ旧candidate receiptのhashを書き換えない。

台帳機械検査終了0、12120行valid/pending8392/implemented3728（`/tmp/madou-r6-s09-s10-dependencies-ledger.log`）。今回runtime/test本文変更なし。

依存追加後のreadiness再生成終了0・valid=true/ready=false（`/tmp/madou-r6-s09-s10-dependencies-readiness.log`）。全プロセス終了。
