# R4 予約所有者の実退出

Engine宣言: `Actual Vanmil awakening lets the reserved Fate owner exit without return or refunded history` (`packages/engine/test/reclaim-owner-exit.test.ts`)。

初期配置はAウーノス、Bアルセイル、Cシン、Dガイナス。復活の儀式と命運凶変を持たせる。Bの実REVEAL_CHARACTER後、Aが実USE_REVIVAL_RITUALを宣言し、Bが命運凶変で取消を宣言する。その有料反応にB自身が印刷上のCANCEL_REACTIONを行い、命運凶変を取り消す。Bの通常回収権をCHOOSE_RECLAIMで選ぶと、支払い済み命運凶変が予約される。

儀式は取り消されずヴァンミールへ覚醒する。Bのarseil-conspiracyが提示されるまで、予約札はB手札へ戻らない。実USE_LIFECYCLE_ABILITYによる退出宣言と明示PASSで処理し、Bがexited・個人勝利となる。命運凶変は手札へ戻らず捨て札へ一回、通常枠baseSpentを含む履歴は保持する。予約metadataと親actions/groups/windows/lifecycleは解消し、220枚の物理ID集合を保持。退出イベントは一回だけ。

各コマンドは既存act helperで同入力JSON復帰再現と物理札保存を確認。覚醒待ちと退出宣言後にJSON復帰して進め、退出宣言後は全席viewの保存復帰一致も確認する。予約・lifeId・presence・覚醒boundaryを直接投入していない。

試験経路の修正:

- 勇気を儀式の取消として使う案はUNSUPPORTED_CARDで拒否（`/tmp/madou-r4-owner-exit.log`）。勇気の用途を拡張していない。
- 命運凶変が取消判定に失敗する案は、そもそも同反応に判定がなく儀式を取り消すため不成立（`/tmp/madou-r4-owner-exit-failed-cancel.log`、`-trace.log`、`-rolls.log`）。予約は通常の親終了で返ったため、ランタイム不具合とは扱わなかった。
- アルセイルの既存CANCEL_REACTIONで自分の有料反応を取り消す実経路に修正し、1成功（`/tmp/madou-r4-owner-exit-printed-cancel.log`）。退出宣言後の札不在assertionを追加後も1成功（`/tmp/madou-r4-owner-exit-final.log`）。

ランタイム変更なし。Worker保存・ACK再送・browserと台帳への宣言登録は未完。レビュー・accepted昇格なし。全体完了を主張しない。

全型終了0（`/tmp/madou-r4-owner-exit-types.log`）。台帳機械検査終了0・12112行valid/pending8389/implemented3723（`/tmp/madou-r4-owner-exit-ledger.log`）。台帳/readiness変更なし。全プロセス終了（17:43 JST）。

## Worker・ブラウザ接続と登録（17:47 JST）

`reclaim-exit-scenario.ts`を作成し、`reclaim-exit`として両テスト入口へ登録。実PASS_SETUP・START_TURN・CHOOSE_DRAW(false)・B公開までをfixtureで行い、儀式以降は試験中の実操作で進める。

- Worker宣言: `Actual Arseil exit discards reserved Fate once and keeps spent history through every Worker restart`。儀式・命運・自己取消・回収・覚醒・退出の全操作後、220枚の実ID集合、保存後evictionと同一envelopeの同一ACK、保存内容不変、4席snapshotとviewFor一致を検証。退出後の一回廃棄と回収履歴維持を確認。1成功（`/tmp/madou-r4-owner-exit-do.log`）。
- Browser宣言: `Actual Arseil exit after reserved self-canceled Fate survives browser reloads and discards once`。すべて実UIから選択し、自己取消前・回収選択前・予約後・覚醒後全席・退出宣言後・最終全席でreload。一回廃棄、手札不在、個人勝利、退出イベント一回を確認。1成功（`/tmp/madou-r4-owner-exit-browser.log`）。このシナリオには固定出目overrideを追加していない。
- 全型終了0（`/tmp/madou-r4-owner-exit-transport-types.log`）。DO終了後にbrowserを実行し重複なし。
- 3宣言を`c2-p04-r2c1 / owned_techniques/4/reserve-before-parent-release`へ登録。[宣言・ハッシュ](2026-09-10-r4-reclaim-exit-bindings.json)。status=pendingとその他受け入れ条件を維持。台帳機械検査終了0・12112行valid/pending8389/implemented3723（`/tmp/madou-r4-owner-exit-bindings-ledger.log`）。

実退出の同経路は3層で通過。レビュー・ランタイム変更なし。全件acceptedや通常APIの正式STARTは証明していない。

再開時確認: 旧readiness生成handle 49405は存在せず、ログはvalid=true/ready=false。`python3 scripts/generate_catalog_readiness.py --check`を実行して終了0・valid=true/ready=falseを再確認（`/tmp/madou-r4-owner-exit-readiness-final.log`）。実退出の3層証跡をR4所有者matrixと再開メモへ反映。全件accepted昇格なし。今回起動したプロセスは終了済み。
