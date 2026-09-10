# R4 弓反射の実経路対応

R4-Cの構造試験を置換・削除せず、後続R5の実経路証拠を対応づける。

- 宣言: `actual Royal Knights reflect Fairy level4 damage9 with original dice and no new Fury bow numbers`
- ファイル: `packages/engine/test/fairy-folk-physical.test.ts`
- 初期fixture: `makeFairyFolkPhysicalScenario` の `fairy-grant-hand`、Aディア・Bフューリー、Bに実王立騎士団。初期配札以降は実PLACE_INITIAL_FOLLOWER・PASS_SETUP・START_TURN・CHOOSE_DRAW・攻撃・PASSを使用。反射属性や能力継承を注入しない。
- Aの実妖精族弓攻撃（使用/効果Lv4、damage9）をBの王立騎士団が反射。反射の戦・弓属性、元の数値と2個の出目を維持する。BのFury数値選択はなく、ability-valueロールは0、最終A9/B0、妖精族の廃棄は1枚。
- 再実行: `pnpm exec vitest run packages/engine/test/fairy-folk-physical.test.ts -t 'actual Royal Knights reflect Fairy level4 damage9 with original dice and no new Fury bow numbers'`。終了0、1成功。36件は対象外でskip。ログ `/tmp/madou-r4-fury-reflection-canonical.log`。

通常反射防御札のwarrior遮断と区別する。`combat/attack.ts`の通常reflectはmagicのみ反射する一方、`combat/followers.ts`の実王立騎士団はeffectLevel条件で反射を発生させる。元R4証跡の「実弓反射経路は未証明」は、この後続R5試験により解消した。

合法なFury自身の弓反撃・bundle能力継承・その他集合条件はこの試験では証明しない。今回コード・台帳・readinessは変更せず、レビュー・accepted昇格なし。型検査は文書対応だけのため再実行しない。実行プロセスは終了済み。

## Worker保存経路（17:57 JST）

`game-scenarios.ts`へ`fury-royal-reflection`を登録。既存の実初期fixtureをそのまま利用し、`room-fury-reflection.test.ts`で配置から反射終了まで実コマンドを送信する。

宣言: `Actual Fury Royal Knights bow reflection retains original dice through every Worker restart and replay`。

全コマンド後に220実ID集合、DO再起動、同一envelope再送の同一ACK・保存不変、4席のsnapshot/viewFor一致を確認。反射actionは一つ、効果4・damage9・戦/弓属性を保持し、追加ability-valueなし。最終A9/B0・元出目1/5・妖精族一回廃棄、actions/groups/windows空。

初回は固定出目を既存rollのpurposeだけで選び、damage roll生成時に1を渡してdamage5となり失敗（`/tmp/madou-r4-fury-reflection-do.log`）。damage窓でのroll生成時にも5を渡すテスト入力へ修正し、1成功・終了0（`/tmp/madou-r4-fury-reflection-do-fixed.log`）。ランタイム修正なし。全型終了0（`/tmp/madou-r4-fury-reflection-types.log`）。ブラウザの同経路と新DO宣言の台帳登録は未実施。

台帳機械検査終了0（`/tmp/madou-r4-fury-reflection-ledger.log`）。台帳status・readiness変更なし。今回起動した全プロセス終了。

## Browser接続と条項登録（18:01 JST）

`fury-reflection.spec.ts`宣言: `Actual Fury Royal Knights bow reflection survives browser reload without new bonus dice`。

実UIでB王立騎士団配置、Aディアの妖精族攻撃、明示PASSを実施。初回normal-defense、反射action中、終了後に全席reload。反射前の2個のnumeric roll全体が終了後も同一で、追加ability-valueなし、最終A5/B0、妖精族一回廃棄を確認。BrowserFixtureRoomの既存保存済みシナリオ別entropy選択に当該名を追加し、ブラウザでは全出目1（効果4/damage5）とする。Worker/Engineの1/5（damage9）とは区別する。本番Roomの乱数処理変更なし。

Browser1成功・終了0（`/tmp/madou-r4-fury-reflection-browser.log`）、全型終了0（`/tmp/madou-r4-fury-reflection-browser-types.log`）。DOとbrowserは重複実行なし。

3宣言をFury `c2-p02-r1c2-ab03` の `bow-effect-d6` と `bow-damage-independent-d6` に追加。[宣言・ハッシュ](2026-09-10-r4-fury-reflection-bindings.json)。2行ともpending維持、既存試験とその他残条件を保持。台帳機械検査終了0・12112行valid（`/tmp/madou-r4-fury-reflection-bindings-ledger.log`）。レビュー・accepted昇格なし。

readiness再生成終了0・valid=true/ready=false（`/tmp/madou-r4-fury-reflection-readiness.log`）。全実行プロセス終了。
