# R4 予約所有者の実退去（17:07 JST）

対象: `packages/engine/test/reclaim-owner-otherworld.test.ts`

宣言: `Reservation owner actual Rift banishment preserves its life and returns prayer once after the root`

初期配置でシェリムA・リーアB、裂界と必勝の祈りを用意する。以降は実際のCHANT、手番進行、ATTACK、専用PLAY_REACTION、明示PASSのみ。presenceやlifeIdを操作して退去を作っていない。裂界の抵抗には失敗する固定ダイスを与える。

祈りを同じ親eventの予約へ移した後、Bがotherworldになった直後にも予約と手札不在を確認。退去でlifeIdが変わらず、親のactions/groups/lifecycle/未完回収窓が終了するとBの手札へ一回だけ戻る。祈りの同イベント使用記録を保持し、裂界は一回廃棄される。各コマンドは既存act helperでJSON復帰の同入力再現・220枚保存を確認し、予約後の各PASS前には全席viewの保存復帰一致も検査する。

結果:

- 対象Engine 1成功: `/tmp/madou-r4-otherworld-closed.log`。
- 全型成功: `/tmp/madou-r4-otherworld-types.log`。最終assertion修正後のroot型も成功: `/tmp/madou-r4-otherworld-types-final.log`。
- 台帳検査成功: `/tmp/madou-r4-otherworld-ledger.log`。12112行、pending8389/implemented3723。台帳・readiness内容は変更なし。

途中失敗は試験設定の修正。最初は印刷名の推測が一致せず、既知の物理IDから名前を取得するよう変更。次に省略された初期lifeIdを`initial-life:B`へ正規化。最後に回収記録の`closed`履歴が残るため、全履歴削除ではなく未完stageなしを確認した。順に`/tmp/madou-r4-otherworld.log`、`-fixed.log`、`-final.log`へ記録。ランタイム修正なし。

この実経路はotherworldだけを証明する。wandering/exited/死亡後復活の予約所有者条件、Worker保存・ACK再送、browser上の同組み合わせは未完。既存の状態直接設定の試験をそれらの実producer証明に格上げしない。全件acceptedやR4全体の完了は主張しない。レビュー実施なし。全プロセス終了。

## Worker・ブラウザ接続（17:12 JST）

上記のWorker/browser未完は今回解消した。otherworld以外の未完条件は維持する。

`fixtures/reclaim-otherworld-scenario.ts`を作成し、`lia-prayer-otherworld`として既存シナリオ入口へ登録。初期配置の後、実PASS_SETUP・CHANT・一周の手番・ATTACKからBの効果レベル応答まで進める。WebSocket試験もUI試験も、祈りの支払い・予約・退去・返却は投入後の実操作で行う。ブラウザでも抵抗失敗を確定できるよう初期B精神力を0に設定し、presence/lifeIdや予約を投入していない。テスト専用fixtureであり通常APIの正式START証明ではない。

- Worker宣言: `Actual Rift banishment keeps prayer reserved through every restart and receipt replay then returns it once` (`apps/worker/test/room-reclaim-owner-otherworld.test.ts`)。各コマンドに固定entropyを与え、220枚の実ID集合、保存→eviction→同一envelopeの同一ACK・不変snapshot、4席のsnapshotとviewFor一致を確認。実退去直後の予約保持と最終一回返却も確認。初回成功後に精神力0のfixtureへ揃えて再実行し、1成功（`/tmp/madou-r4-otherworld-do-final.log`）。
- Browser宣言: `Actual Rift banishment keeps the owners prayer reserved across reload then returns it once while absent` (`tests/e2e/reclaim-owner-otherworld.spec.ts`)。実UIから専用祈りを選択。予約後に所有者reload、退去後に全4画面reload、親終了後に所有者reload。一回返却、予約なし、他席手札に同札なしを確認。初回はE2E入口のシナリオ名未登録で失敗（`/tmp/madou-r4-otherworld-browser.log`）、登録後1成功（`/tmp/madou-r4-otherworld-browser-registered.log`）。DO終了後に実行し、同時稼働なし。
- 全型成功（`/tmp/madou-r4-otherworld-all-types.log`）、E2E入口変更後Worker型成功（`/tmp/madou-r4-otherworld-worker-types-final.log`）。
- 台帳機械検査valid12112、pending8389/implemented3723（`/tmp/madou-r4-otherworld-transport-ledger.log`）。新宣言はこの証跡に記録し、台帳/readinessへの登録・昇格は未実施。ランタイム変更なし。

全プロセス終了。次は新3層の宣言を該当条項へ対応付ける作業と、otherworld以外の未証明producer条件。レビューは実施していない。

## 条項への登録（17:15 JST）

`a2-p05-r2c3 / semantic/lia/unlimited-reuse`へ3層の新宣言を登録した。[正確な宣言とハッシュ](2026-09-10-r4-reclaim-otherworld-bindings.json)を保存。異界退去した所有者への予約返却という補足範囲をbindingNoteへ明記し、既存の別技再使用試験を保持した。通常の持ち技回収やS07全体へ同じ証拠を流用していない。

`python3 scripts/validate_runtime_coverage.py`は終了0（`/tmp/madou-r4-otherworld-bindings-ledger.log`）、12112行・pending8389/implemented3723のまま。台帳のハッシュ変更に合わせて`generate_catalog_readiness.py`で再生成し、終了0・ready=false（`/tmp/madou-r4-otherworld-bindings-readiness.log`）。acceptedへの昇格なし。コード・試験宣言の変更はないためゲーム試験・型検査の再実行なし。全プロセス終了。
