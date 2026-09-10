# 実装の再開メモ

## 現在の再開地点
- 次: [公開走り切り計画](../superpowers/plans/2026-09-11-release-run.md) Task B2。release-run worktree / worktree-release-runで作業、タスクごとにコミット。A2〜A7・B1完了。A3集計4試験/A4記録7試験成功、実S01〜S05から13参照一致。候補snapshotはテスト前に作り実行後に検証。D5対人は公開後M5、D6は招待制公開。認証はTask D1。
- B1完了: 279行の不足を解消（束縛281行、既存具体行2行の参照更新を含む）。related-only0、no-tests0、implementedConcrete3829。直近の人物条件10/シナリオEngine10/DO6試験・型・全台帳validator成功。accepted昇格は候補固定後のB8で実施。
- B2進行中: Step1〜4完了。白輪の実使用・通常回収1回・辞退の3試験、生成器4試験、型、全台帳validator成功。実際の条項末尾は9種類、別名/同名物理札を展開した対象は技125組・従者23組。生成器は784行を対応付けるが、全9種類/148組の試験宣言が揃うまでCLIの束縛出力は失敗させる。台帳owned-reclaim784行はpendingのまま。次はStep5〜6の試験展開・各札の合法経路と変身/復活/予約/従者死亡のヘルパー拡張。
- A7: D4c 2行は一時notApplicableで全台帳valid確認済み、恒久適用はB8 snapshot前。D4a/b/dは独立行がないためbranchDecisionsに範囲記録。Python70試験・Engine対象4ファイル・型成功。
- 進捗: 用途条項218/220、Appendix A25/25、Other193/195（残2は D4c 到達不能。台帳は pending のまま）。全件accepted・計画全体の完了は未達。
- 台帳: 判定は `python3 scripts/validate_runtime_coverage.py` に任せる。受け入れ方針は `acceptance-policy/test-only-v1`。

- 証跡: [判断結果](../operations/decision-result-2026-09-10.md)。方針本文は [試験受け入れ方針](../operations/acceptance-policy.md)。
- 作業制約: サブエージェント・レビュー（自己レビュー含む）・R0/R1再監査・人物/行動JSON全件読み・全スイートの毎回実行なし。dirty作業ツリーを保持。
- 検証範囲: 対象Engine/関連、DO分割、browser、型のみ。DO終了後にbrowserを1本実行。失敗範囲だけ修正・再実行する。
- 共有未完: D4c の notApplicable 束縛、strict A31、lifetime/回収交差、R3、R6 の accepted、R7/R8。R4-B1 の公開比較は計画文面を D2 に更新済み。検証実装は残る。
- 再開時: この入口と[完成計画の未完チェック](../superpowers/plans/2026-09-08-completion-plan.md)を読む。

## 次に必要な参照
- [試験受け入れ方針](../operations/acceptance-policy.md)
- [判断結果](../operations/decision-result-2026-09-10.md)
- [地属性戦士技の不在検査](../../scripts/inspect_earth_warrior_actions.py)
- [実退出証跡](../operations/evidence/2026-09-10-r4-reclaim-exit.md)
- R4 exact条件は `2026-09-08-r4-suppression-reclaim.md`。無制限は秘匿分岐の公開比較。公開後の使用は別行。
- readiness は ready=false を維持。全accepted候補/実START/一戦/R8は未完。
- 対人R3は公開後M5。R8はrelease-run Phase D、認証はTask D1。

## 必要なときだけ読む履歴
- [整理前の全履歴](2026-09-10-implementation-history-105852.md)：内容をそのまま保存。通常の再開時には読む必要なし。
- [R5の詳細計画](../superpowers/plans/2026-09-08-r5-combat-cards.md)：今回までの対応と共有未完。
