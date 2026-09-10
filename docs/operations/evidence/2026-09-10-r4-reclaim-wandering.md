# R4 予約所有者の実流浪

Engine宣言: `Actual protected Lia death makes the counter reservation owner wander before one final return` (`packages/engine/test/reclaim-owner-wandering.test.ts`)。

`reclaim-wandering-scenario.ts`でAアーネス、Bランスロット、Cリーア、Dガイナスを初期配置し、Cの既存損傷を残りHP1にする。実PASS_SETUPからアーネス専用黒流弓(`a2-p07-r3c3`)をB/Cへ宣言する。試験ではBの専用妖撃破山剣による反撃、本人のCHOOSE_RECLAIMによる通常枠回収、その後の明示PASSを実行する。

予約成立時はCがまだ生存。実攻撃によるCの死亡で、保護対象を失ったBが流浪する。BのlifeIdと回収使用履歴は保持され、予約した反撃札は最後にBの手札へ一回だけ返る。予約中は山札・捨て札・全員の手札から除外され、最終的に予約metadataと親actions/groups/windows/lifecycleが空になる。流浪イベント一回、C死亡の元eventが親攻撃であることも確認した。

各操作は既存act helperで同入力JSON復帰再現と220枚保存を確認。予約後のPASS前に全席viewのJSON復帰一致を確認し、最終物理ID集合もカタログ220枚に一致する。presence・lifeId・予約の直接設定による流浪ではない。

途中の試験経路修正:

- 天地百撃斬は妖撃破山剣で反撃できる効果Lvを超えるため拒否。戦士Lv調整では解消しない（`/tmp/madou-r4-owner-wandering.log`、`-level.log`）。
- 死鬼旋風脚は印刷名の推測が不一致、その後物理IDで指定しても複数対象を指定できず拒否（`-whirlwind.log`、`-card.log`）。
- 実際の複数対象指定と反撃可能Lvを持つアーネス専用黒流弓へ変更し、対象1成功（`/tmp/madou-r4-owner-wandering-bow.log`）。合法性の制約は変更していない。

Worker・browserの同経路と台帳登録は未完。流浪条件だけの証拠で、退出を代替しない。ランタイム変更・レビュー・accepted昇格なし。

退出の実producerは`packages/engine/src/lifecycle/commands.ts`の`arseil-conspiracy`。ヴァンミール覚醒boundaryに限って提示され、成立で`presence='exited'`と個人勝利を記録することを今回確認。次回はこの限定された入口から予約との交差を検討し、全体検索を繰り返さない。

全型終了0（`/tmp/madou-r4-owner-wandering-types.log`）、台帳機械検査終了0・12112行valid/pending8389/implemented3723（`/tmp/madou-r4-owner-wandering-ledger.log`）。台帳/readiness変更なし。全プロセス終了（17:33 JST）。

## Worker・ブラウザ接続と登録（17:36 JST）

既存fixtureを`reclaim-wandering`としてgame-scenariosとE2E入口へ登録。初期normal-defenseまでがfixtureで、その後の反撃・回収・死亡・流浪・返却は投入後の実操作で進む。

- Worker宣言: `Actual protected death and wandering preserve counter reservation across every Worker restart and replay`。固定entropyで各操作を処理し、220枚実ID集合、保存後evictionと同一envelopeの同一ACK、保存内容不変、全4席snapshotとviewFor一致を検証。回収履歴を保持して一回返却。1成功（`/tmp/madou-r4-owner-wandering-do.log`）。
- Browser宣言: `Actual protected death returns the reserved counter once to its wandering owner after browser reloads`。実UIで専用反撃と表示された回収権を選ぶ。回収選択前・予約後に所有者reload、リーア致死後と親終了後に全席reload。流浪・一回返却・他席への誤返却なしを確認。1成功（`/tmp/madou-r4-owner-wandering-browser.log`）。このシナリオにはテスト専用固定出目を追加していない。
- 全型終了0（`/tmp/madou-r4-owner-wandering-transport-types.log`）。DO終了後にbrowserを実行し重複なし。
- 3宣言を`c2-p02-r2c2 / owned_techniques/1/reserve-before-parent-release`へ登録。[宣言とハッシュ](2026-09-10-r4-reclaim-wandering-bindings.json)。既存status=pendingと残件を維持。台帳機械検査終了0・12112行valid/pending8389/implemented3723（`/tmp/madou-r4-owner-wandering-bindings-ledger.log`）。

実流浪のこの経路は3層で通過。退出経路と全体の受け入れは未完。通常APIの正式STARTを証明する試験ではない。ランタイム変更・レビューなし。

台帳変更後のreadiness再生成は終了0・ready=false（`/tmp/madou-r4-owner-wandering-readiness.log`）。全プロセス終了。
