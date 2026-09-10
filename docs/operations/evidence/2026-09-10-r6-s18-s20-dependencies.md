# R6 S18〜S20 既存条項への依存

[対応表](2026-09-10-r6-s18-s20-dependencies.json)。シナリオのacceptance-correspondenceにS18は5、S19は3、S20は4の既存semantic依存を登録した。新しい原文条項は作っていない。

- S18: 実詠唱の二対象三発に対してレスターが一回使用し、攻撃者の[2,3]通常失敗を一回判定する。Bの三発だけ防御済み、Cは三発21ダメージで継続。resolveMentalDefenseはcontextのtargetだけを処理する。mentalDefenseAttemptとmentalDefenseOptionsが対象ごとの使用済み能力と従者開始を扱う。未対応だったonce-group-target-before-followersとother-target-declared-hits-surviveに実装を登録しimplementedにした。S18単体は二回目試行や従者開始後拒否を直接検証しないので、その全境界の成功とは扱わない。
- S19: 実ジルの精神判定閾値を12未満とし、レスターへの[6,6]失敗後に信仰心を選ぶ。hasMentalDoubleGuardによってゾロ目追加効果を抑え、resolveMentalDefenseの!roll.successは残る。最終的に陣営不変・停止なし・Bへのダメージ0を確認するEngine caseを対応。S19専用DO/browser成功はこの登録にはない。
- S20: 物理魔詩a2-p17-r1c1の同じ停止IDで命中時−3失敗、次の手番−2失敗、次の−1成功。applyHitsは初回後nextCheck=1を保存、resumeTurnRollは次へ進め、advanceTurnRollsは対応する修正を選ぶ。停止解除で手札4→5補充、通常drawで6、その後実手番終了まで既存3層caseへ対応。修正末尾の反復や複数停止の全組合せをこの一例だけで証明していない。

全8宣言の現行AST hashとsource index記録の一致を確認した。歴史的成功runは旧候補のまま保持し、現在候補の成功へ書き換えていない。カードの全依存、元裁定全文、現在固定候補の受け入れは未完。

台帳機械検査終了0、12128行valid / pending8390 / implemented3738。ログ `/tmp/madou-r6-s18-s20-dependencies-ledger.log`。runtime/test本文変更なし、型・ゲーム試験の再実行なし。レビューなし。

readiness生成終了0、valid=true / ready=false（`/tmp/madou-r6-s18-s20-dependencies-readiness.log`）。今回の全プロセス終了。
