# R6 S07 の実使用依存

S07 acceptance-correspondenceの空だったdependsOnに、実試験が使用する以下の3条項を追加した。

- a2-p05-r2c3#semantic/prayer/effect-addition: 最初の技のeffect-levelで祈りを使用する前提。
- a2-p05-r2c3#semantic/lia/other-technique: BリーアがAの技へ祈りを使用する実入力。
- a2-p05-r2c3#semantic/lia/unlimited-reuse: 物理札を回収し、後の独立した技で再使用する期待結果。

出典は docs/rules/second-edition/scenarios.md のS07（65行）、実入力は packages/engine/test/scenario-s07-prayer.test.ts の既存宣言。関連するmanifestのmeaningと照合して依存を設定した。台帳statusを昇格させる作業ではなく、未成立のカード条項が残った状態でS07だけacceptedになることを防ぐ登録。

G04/G06の同一元イベント再試行拒否について、独立した正確な依存先条項は今回未特定。この3条項を依存条件の全量とはしない。S07出典全文・全期待結果の独立照合、最新候補でのrun receipt、残り31例とsource欄の依存も未完。既存の2026-09-10-r6-dependency-status.jsonは変更前の履歴として保持する。

runtime・試験本文・台帳status変更なし。manifest変更により過去のcandidate/manifest bindingは最新証拠にならない。現時点でverified/accepted行はないため一括hash更新はしない。機械検査後にreadinessを再生成し、全件受け入れまではfalseを維持する。

台帳機械検査終了0、12112行valid/pending8389/implemented3723（`/tmp/madou-r6-s07-dependencies-ledger.log`）。文書とmanifestの依存登録だけの変更のため、ゲーム試験と型検査は再実行しない。

readiness再生成終了0・valid=true/ready=false（`/tmp/madou-r6-s07-dependencies-readiness.log`）。全プロセス終了。

## G06個別依存の追加

G06の既存行は source-context/001（integrity）と ruling-paragraph/002・003（aggregate、covers空）だった。これらはsemantic依存先として使えない。既存の採用済み本文のsource参照を保持して、次の3個別semantic行をmanifestと台帳へ追加した。

- ruling:G06#semantic/physical-card-once-per-event
- ruling:G06#semantic/recovery-after-parent-event
- ruling:G06#semantic/physical-card-reuse-later-attack

S07 acceptance-correspondenceの依存を3から6へ増やした。新3行はpending、handler/test登録待ち。G06全段落の能力・失敗消費・イベントID再生成禁止・別防御等を全て分割したとは主張しない。aggregateのcoversは全量未確定のまま。これはS07に必要な既存ルールの登録であり、新しいゲームルールを採用する変更ではない。R0/R1全件再監査・人物/行動全文読みなし。

台帳機械検査終了0、12115行valid/pending8392/implemented3723（`/tmp/madou-r6-s07-g06-ledger.log`）。既存のS07実試験は候補更新前の証跡として保持し、成功runのbindingを新manifestへ偽装更新しない。

台帳summaryも実行数へ更新後、readiness再生成終了0・valid=true/ready=false（`/tmp/madou-r6-s07-g06-readiness-final.log`）。全プロセス終了。

## 個別実装・試験の登録

新3行へS07の既存Engine/DO/browser宣言を登録し、ASTで現在の宣言hashが既存証跡と一致することを確認。[対応表](2026-09-10-r6-s07-g06-bindings.json)。親イベント待機はreserveReclaimCard/eventPending/releaseReclaimReservations/finalizeReclaimReservations、物理札試行キーはtransitionCombatのPLAY_REACTION経路へ対応する。

PLAY_REACTIONはeventId:actorId:cardInstanceIdを保存し、同じキーをALREADY_USEDで拒否する。ただし既存S07試験はCARD_NOT_IN_HANDや終了したactionのINVALID_TARGETでも拒否され得る。ALREADY_USED分岐単独・所有者変更・他の防御/反応経路を証明したとは扱わず、各行のremainingに記載した。全3行pending維持。

既存の成功runは旧候補の履歴として参照。今回はruntime/test本文変更がないため、全スイートや型検査を再実行しない。台帳機械検査終了0、12115行valid/pending8392/implemented3723（`/tmp/madou-r6-s07-g06-bindings-ledger.log`）。

readiness再生成終了0・valid=true/ready=false（`/tmp/madou-r6-s07-g06-bindings-readiness.log`）。全プロセス終了。
