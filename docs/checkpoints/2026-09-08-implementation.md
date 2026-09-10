# 実装の再開メモ

## 現在の再開地点
- 次: 判断/外部条件の変更確認。行き詰まり連続確認3回、goalをblockedへ更新済み。残条件はdocs/operations/evidence/2026-09-10-remaining-blockers.md。R3人操作、R4裁定、R5実producer、R6受け入れ方針、R7全accepted、R8接続/素材条件。今回whoami終了1でexpired/not logged in確認（/tmp/madou-resume-auth-state.log）。回答なし・認証未成立で検査/既知探索を反復しない。全プロセス終了。
- 進捗: 用途条項218/220、Appendix A25/25、Other193/195（残2）。全件accepted・計画全体の完了は未達。
- 台帳: 12,178行valid、pending8,349／implemented3,829。判定は `python3 scripts/validate_runtime_coverage.py` に任せる。

- 証跡: [R8準備](../operations/evidence/2026-09-10-r8-preparation.md)。候補/アカウント/素材条件は未完。クレジット画面は実装。R8第2のみ完了、他は未完のまま。全プロセス終了。
- 作業制約: サブエージェント・レビュー（自己レビュー含む）・R0/R1再監査・人物/行動JSON全件読み・全スイートの毎回実行なし。dirty作業ツリーを保持。
- 検証範囲: 対象Engine/関連、DO分割、browser、型のみ。DO終了後にbrowserを1本実行。失敗範囲だけ修正・再実行する。
- 共有未完: 歌う船/有翼族の地属性戦士技除外2条項（実producer未証明）、strict A31、lifetime/回収交差、R3、R6、R7/R8。R4-B1回答待ち。
- 再開時: この入口と[完成計画の未完チェック](../superpowers/plans/2026-09-08-completion-plan.md)を読む。

## 次に必要な参照
- [実退出証跡](../operations/evidence/2026-09-10-r4-reclaim-exit.md)。reclaim-exit fixtureと3層テスト登録済。自己取消→予約→実覚醒→実退出。命運cancelには判定なし、勇気は儀式取消不可。
- [実流浪証跡](../operations/evidence/2026-09-10-r4-reclaim-wandering.md)。3層登録済・pending維持。
- [同親死亡復活証跡](../operations/evidence/2026-09-10-r4-reclaim-revival.md)。reclaim-owner-revival各層とfixture参照。伏線は初期deck index3。3宣言は祈り再使用条項へ登録済。
- [R4実退去証跡](../operations/evidence/2026-09-10-r4-reclaim-otherworld.md)。裂界a2-p14-r2c2。closed履歴は未完stageと分ける。3宣言登録済。
- R4質問をasync送信済・未回答: 無制限回収は人物公開必須なのに全パス公開transcript同一要求。公開前の窓/第三者同一性と公開後の回収予算を分けて検証してよいか。回答なしでルール変更しない、質問を重複送信しない。
- R4 exact条件は `2026-09-08-r4-suppression-reclaim.md` 行383、補足405。現状hidden Fury0/base/extra/bothは成功、無制限の厳密四世界は未証明。
- 受け入れ方針案: docs/operations/evidence/2026-09-10-acceptance-policy-decision.md。独立レビュー必須を試験受け入れへ変更するか回答待ち。現行gateを維持、再質問しない。
- readiness接続は前ターン完了。generator normal/strict validator、ready=false維持。root build/verify:catalogに--check。全accepted候補/実START/一戦/R8は未完、レビューは禁止のまま。
- A31直接山札廃棄/生存Cham付属廃棄は実producerなしと確認済。再検索を繰り返さない。R8はdeploy.md/recovery.mdを参照。現行に旧版の新規卓だけを止める機能はなく、旧originを維持する方針。配備認証は2026-09-10のwhoamiでも失効・未ログイン。

## 必要なときだけ読む履歴
- [整理前の全履歴](2026-09-10-implementation-history-105852.md)：内容をそのまま保存。通常の再開時には読む必要なし。
- [R5の詳細計画](../superpowers/plans/2026-09-08-r5-combat-cards.md)：今回までの対応と共有未完。
