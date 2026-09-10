# R6 S01〜S03 反応境界依存

[対応表](2026-09-10-r6-s01-s03-dependencies.json)。優先権、親パス世代、取消後の支払い・補充保持を既存sourceから部分条項にしてimplementedで登録。

S01はC優先権中のD神性介入を状態不変で拒否し、その後Cの命運凶変を受ける。transitionCombatのPLAY_REACTIONは先に現在回答者を確認する。Engine、Workerの受理順と4人投影不変、browser継続caseを対応。HTTP snapshot単体は介入拒否そのものの新条項証跡へ入れていない。

S02はA/Bがパス済みの親からCの実神性介入→Dの実取消を解決する。resetParentはpassedを空にしrevisionを増やし、複数参加者窓のcursorを0へ戻す。既存DO caseは古い世代PASSを拒否し、現在世代AのPASSを受ける。ローカル防御窓の回答者維持を全て同じ起点に変更する条項ではない。

S03はB神性介入の受理で物理札を解決中へ移し、使用履歴を保存し、1枚補充する。Cの命運凶変が取消してもcontinueActionは効果を実行せず後処理するだけで、補充や使用履歴を戻さない。既存caseは元ロール試行1回のまま、補充札保持、使用札廃棄、手番不変を扱う。他の行動種類・全追加コストをこの一例で網羅したとはしない。

登録した現行宣言hashは既存source indexとASTで一致。歴史的成功runは保持し、現行固定候補の成功へ更新しない。全条項・全依存・最終受け入れは未完。

台帳機械検査終了0、12145行valid / pending8390 / implemented3755。ログ `/tmp/madou-r6-s01-s03-dependencies-ledger.log`。runtime/test本文変更なし、型・ゲーム試験再実行なし。レビューなし。

readiness生成終了0、valid=true / ready=false（`/tmp/madou-r6-s01-s03-dependencies-readiness.log`）。今回の全プロセス終了。
