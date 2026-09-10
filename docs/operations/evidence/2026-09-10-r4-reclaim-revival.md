# R4 同一親処理内の予約所有者の死亡・復活

Engine宣言: `Actual same-root death and FuSen revival do not give the old reserved prayer to the new life` (`packages/engine/test/reclaim-owner-revival.test.ts`)。

初期配置はAシン、Bリーア、Cガイナス、Dガーウィン。B/Cの既存損傷を残りHP1とし、必要札と補充用山札を用意する。以降はカード・presence・lifeId・予約・親イベントを直接操作せず、実際のPASS_SETUP、天地百撃斬のCHANT、一周の手番、B/Cへの専用ATTACK、Bの専用祈りを実行する。

祈りの予約成立後、同じ攻撃でB/Cが致死になる。Bの死亡確定後、Cの実PLAY_DEATH_GIFTへAが命運凶変を宣言し、その補充で伏線が公開される。BのCHOOSE_REVIVALとPASS_SETUPを行い、最後まで明示PASSで進める。

確認範囲:

- B死亡後と復活選択直前も祈りが予約に残る。復活時にも元攻撃eventを持つlifecycleが継続する。
- 復活によりBのlifeIdが変わっても、予約のownerLifeIdは死亡前の値のまま。復活した手札へ祈りを渡さない。
- 親終了後は予約とmetadataを解消し、祈りは捨て札へ一回だけ。B死亡・復活はそれぞれ一回、Cは死亡、actions/groups/windows/lifecycleは空。同イベント使用履歴を保持する。
- 全コマンドは既存act helperによる同入力JSON復帰再現と220枚の物理札保存を通る。復活選択と通常PASS前にもJSON復帰して継続する。

初回は伏線の初期山札位置が早く、Bの祈り補充時に開いて復活に到達しなかった。実イベント列でA詠唱補充・D不足手札補充・B祈り補充の3枚を確認し、その後へ伏線を配置した。失敗ログ: `/tmp/madou-r4-owner-revival.log`、`/tmp/madou-r4-owner-revival-trace.log`。修正後成功: `/tmp/madou-r4-owner-revival-deck.log`。同親event・旧life予約・単一死亡/復活のassertion追加後も対象1成功: `/tmp/madou-r4-owner-revival-final.log`。ランタイム修正なし。

これは実Engine経路の証拠。Worker保存・ACK再送・browserの同経路、台帳への宣言登録は未完。流浪・退出条件は代替していない。受け入れ状態を昇格せず、レビューも実施していない。

全型検査終了0（`/tmp/madou-r4-owner-revival-types.log`）。台帳機械検査終了0、12112行valid・pending8389/implemented3723（`/tmp/madou-r4-owner-revival-ledger.log`）。台帳/readiness変更なし。全プロセス終了（17:20 JST）。

## Worker・ブラウザ・台帳（17:27 JST）

`reclaim-revival-scenario.ts`を作成し、`lia-prayer-revival`として両テスト入口へ登録。Engine試験と同じ初期配置・実コマンドでBの祈り宣言前まで進む。死亡/復活/予約を直接投入しない。

- Worker: `Same-root prayer owner death and revival preserve the old reservation through every Worker restart`。全操作後に220物理ID集合、eviction後の同一envelope/ACKと保存内容、4席snapshotとviewForの一致を確認。死亡から復活時にも旧lifeId予約を保持し、最後に廃棄一回。対象1成功（`/tmp/madou-r4-owner-revival-do.log`）。
- Browser: `Same-root death and revival retain the old prayer reservation across browser reload and discard it once`。祈り・遺言・命運・復活・再準備を実UIから実行。予約後、死亡後、復活選択前、再準備中、最終全席でreloadし、最終一回廃棄と新手札不在を確認。対象1成功（`/tmp/madou-r4-owner-revival-browser-fixed-dice.log`）。
- 初回ブラウザはカタログimport解決で未実行（`/tmp/madou-r4-owner-revival-browser.log`）。相対import修正後は実伏線のd6判定に失敗し復活不成立（`/tmp/madou-r4-owner-revival-browser-import.log`）。再試行で偶然成功を待たず、テスト専用BrowserFixtureRoomでこのシナリオだけ出目1を供給するよう変更した。シナリオ名は専用SQLite表へ保存され、DO復帰後も条件を保持する。本番Roomに変更なし。他シナリオはsuper.commandEntropyをそのまま使用する。判定自体は実際のroll/窓を通る。
- 全型成功（`/tmp/madou-r4-owner-revival-final-types.log`）。DOとbrowserは重ねていない。
- 新3宣言を`a2-p05-r2c3 / semantic/lia/unlimited-reuse`へ補足登録。[宣言・ハッシュ](2026-09-10-r4-reclaim-revival-bindings.json)。機械検査終了0（`/tmp/madou-r4-owner-revival-bindings-ledger.log`）、12112行・pending8389/implemented3723不変。acceptedへ昇格なし。

同一親の死亡後復活条件の3層は今回通過。流浪・退出の実producer、その他共有条件と全候補の受け入れは未完。R7正式STARTの代用ではない。レビュー実施なし。

台帳更新後readiness再生成も終了0・ready=false（`/tmp/madou-r4-owner-revival-readiness.log`）。全プロセス終了。
